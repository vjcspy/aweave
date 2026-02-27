---
name: Workspace-Scoped Skills YAML
description: Migrate skills activation state from global ~/.aweave/ (JSON+MD) to a single repo-level .aweave/loaded-skills.yaml for workspace isolation and better AI consumption.
status: done
created: 2026-02-24
tags: []
---

# 260224-Workspace-Scoped-Skills-YAML — Workspace-Scoped Loaded Skills (YAML)

## References

- `AGENTS.md` (Step 5 — Load Active Skills)
- `workspaces/devtools/common/nestjs-dashboard/src/services/skills.service.ts`
- `workspaces/devtools/common/nestjs-dashboard/src/controllers/skills.controller.ts`
- `workspaces/devtools/common/nestjs-dashboard/src/dtos/skills.dto.ts`
- `workspaces/devtools/common/dashboard-web/src/components/SkillsView.tsx`
- `resources/workspaces/devtools/common/nestjs-dashboard/OVERVIEW.md`

## User Requirements

1. Workspace isolation — skills activation state must be scoped per workspace. When switching git branches (workspace boundaries), each workspace should have its own independent set of active skills.
2. Change format from Markdown (`loaded-skills.md`) to YAML (`loaded-skills.yaml`) for better AI agent consumption.
3. Consolidate two files (`~/.aweave/active-skills.json` + `~/.aweave/loaded-skills.md`) into a single file.

## Objective

Replace the current global skills state storage (`~/.aweave/active-skills.json` + `~/.aweave/loaded-skills.md`) with a single `<PROJECT_ROOT>/.aweave/loaded-skills.yaml` file. This provides:

- **Workspace isolation for free** — each git branch carries its own copy of the file.
- **Simpler AI consumption** — YAML is structured and token-efficient vs Markdown prose.
- **Single source of truth** — one file instead of two.

### Key Considerations

1. **API contract is unchanged** — the REST endpoints (`GET /skills`, `POST /skills/:id/toggle`) return the same DTO shape. The frontend (`SkillsView.tsx`) requires no changes.
2. **`gray-matter` already depends on `js-yaml`** — we can use `js-yaml` directly for YAML serialization/deserialization without adding a new top-level dependency, but adding it explicitly is cleaner.
3. **`.aweave/` at repo root** — this is a new directory convention. It must NOT be confused with `~/.aweave/` (user home). The dot-folder convention clearly signals "platform config, not source code."
4. **Global Skills Support** — The system must continue to support skills located in `~/.aweave/skills/`. The YAML schema needs to represent these correctly.
5. **Workspace Isolation via Git** — `.aweave/loaded-skills.yaml` must be **git-tracked**. This ensures that when a user switches branches, the file is swapped, providing workspace isolation.
6. **The `findProjectRoot()` method** already walks up from `__dirname` looking for `agent/skills/`. We reuse this for resolving `.aweave/loaded-skills.yaml` path.

## Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Analyze current skills state flow (read/write paths, file formats)
  - **Outcome**: Two files at `~/.aweave/`: `active-skills.json` (skill ID array) and `loaded-skills.md` (generated Markdown). Both are global, no workspace scoping. `SkillsService` manages both.
- [x] Define target YAML schema
  - **Outcome**: Single file `.aweave/loaded-skills.yaml` with `skills[]` array containing `name`, `description`, `skill_path` fields.
- [x] Confirm API contract stability
  - **Outcome**: REST API shape (`SkillDto`, `ListSkillsResponseDto`, etc.) is unchanged. Frontend needs no changes.

### Phase 2: Implementation Structure

```
.aweave/                                           # 🚧 NEW directory at repo root
└── loaded-skills.yaml                             # 🚧 NEW — single source of truth

workspaces/devtools/common/nestjs-dashboard/
├── src/
│   ├── services/skills.service.ts                 # 🔄 MODIFY — refactor to YAML
│   └── dtos/skills.dto.ts                         # 🔄 MODIFY — update description text
├── package.json                                   # 🔄 MODIFY — add js-yaml dependency

AGENTS.md                                          # 🔄 MODIFY — Step 5 reads new path/format
```

### Phase 3: Detailed Implementation Steps

#### Step 0: Ensure Git Tracking (Fix C1)

- [x] Update `<PROJECT_ROOT>/.gitignore` to explicitly allow tracking of the new config file. Currently, the root `/*/` rule ignores top-level directories.
  - Add explicit exception:

    ```gitignore
    !/.aweave/
    /.aweave/*
    !/.aweave/loaded-skills.yaml
    ```

#### Step 1: Add `js-yaml` dependency

- [x] Add `js-yaml` and `@types/js-yaml` to `nestjs-dashboard/package.json`
- [x] Run `pnpm install` from `workspaces/devtools/`

#### Step 2: Refactor `SkillsService`

- [x] **Define Internal Types (Fix M4)**:
  - Extend the existing `SkillItem` interface (used for API responses) to ensure it includes the new required fields:

    ```typescript
    export interface SkillItem {
      id: string;
      name: string;
      description: string;
      path: string;       // API contract: absolute path to SKILL.md
      source: 'project' | 'global';
      active?: boolean;
    }
    ```

  - Define `PersistedSkillState` for the `.aweave/loaded-skills.yaml` format:

    ```typescript
    export interface PersistedSkillState {
      name: string;
      description: string;
      skill_path: string; // absolute path to SKILL.md
    }
    ```

- [x] **Remove** `activeSkillsPath` property (`~/.aweave/active-skills.json`)
- [x] **Remove** `loadedSkillsMdPath` getter (`~/.aweave/loaded-skills.md`)
- [x] **Add** `loadedSkillsYamlPath` getter → `path.join(findProjectRoot(), '.aweave', 'loaded-skills.yaml')`
- [x] **New method: `readSkillsYaml(): PersistedSkillState[]`** — reads and parses `.aweave/loaded-skills.yaml` using `js-yaml`. Returns the parsed skills array (which represents ONLY the active skills) or empty array if file doesn't exist.
- [x] **New method: `writeSkillsYaml(skills: PersistedSkillState[])`** — serializes to YAML and writes to `.aweave/loaded-skills.yaml`. Ensures `.aweave/` directory exists.
- [x] **Refactor `getAllSkills()`**:
  - Call internal `scanDirectory` logic.
  - Read `.aweave/loaded-skills.yaml`.
  - Calculate active IDs matching exact `skill_path` (both are absolute).
  - Return the merged list.
- [x] **Refactor `setSkillActive()` (Fix M2)**:
  - Algorithm:
    1. Call `getAllSkills()` to get the current deterministic snapshot.
    2. Find the target skill by `skillId`. If not found, throw an error.
    3. Update the `active` flag on the target skill.
    4. Build the YAML output array from the `active === true` skills, converting `path` to `skill_path` directly.
    5. Call `writeSkillsYaml()`.
- [x] **Refactor `getActiveSkillIds()`** — read from YAML instead of JSON. Extract IDs from the loaded array.
- [x] **Remove** `generateLoadedSkillsMd()` — replaced by `writeSkillsYaml()`.

**Target YAML format (Handling Global Skills - Fix M1):**

```yaml
# Auto-generated by DevTools Dashboard. Do not edit directly.
# This file only contains ACTUALLY LOADED skills.
skills:
  - name: bitbucket
    description: >-
      Provides Bitbucket API integration for interacting with
      repositories, pull requests, comments, and tasks.
    skill_path: /Users/kai/work/aweave/agent/skills/common/bitbucket/SKILL.md
```

> [!IMPORTANT]
> To properly support global skills (M1) and simplify AI agent tool commands, `skill_path` must always be an **absolute path** regardless of whether the skill comes from the project repository or `~/.aweave/skills`.

#### Step 3: Update `skills.dto.ts` (Fix m1)

- [x] Update `SkillDto.active` description (NOT `SkillDto.path`): change reference from `~/.aweave/active-skills.json` to `.aweave/loaded-skills.yaml`.
- [x] Regenerate OpenAPI definitions and types to ensure frontend/backend synchronization:
  - Run the scripts to regenerate `server/openapi.json` and `api-types.ts` in `dashboard-web` and `debate-web`.

#### Step 4: Update `AGENTS.md` Step 5

- [x] Change file path from `~/.aweave/loaded-skills.md` to `.aweave/loaded-skills.yaml`
- [x] Update instructions to parse YAML format (read ALL skills in the file, load their `SKILL.md` via `skill_path`)

#### Step 5: Update `nestjs-dashboard/OVERVIEW.md`

- [x] Update SkillsService description to reference `.aweave/loaded-skills.yaml` instead of `~/.aweave/active-skills.json` and `~/.aweave/loaded-skills.md`.

## Verification Plan

### Manual Verification

> No automated tests exist for `nestjs-dashboard` currently. Verification is manual via the running dashboard.

1. **Build the backend:**

   ```bash
   cd workspaces/devtools/common/nestjs-dashboard && pnpm build
   ```

   Confirm: no TypeScript compilation errors.

2. **Restart the server:**

   ```bash
   cd workspaces/devtools/common/server && node dist/main.js
   ```

3. **Open dashboard in browser** (<http://localhost:3456/dashboard/>) → navigate to "Agent Skills" tab.
   - Confirm: all skills still appear with correct names, descriptions, and toggle states.

4. **Toggle a skill ON** → verify:
   - `.aweave/loaded-skills.yaml` is created/updated at project root
   - The toggled skill is added to the YAML with its full details
   - No `~/.aweave/active-skills.json` or `~/.aweave/loaded-skills.md` is written

5. **Toggle a skill OFF** → verify:
   - The skill is removed from the YAML file
   - The dashboard UI reflects the change

6. **Verify AI agent consumption** — open `.aweave/loaded-skills.yaml` and confirm the format is valid YAML with correct `skill_path` (absolute paths) fields.

## Summary of Results

### Completed Achievements

- Workspace-scoped skill activation state now persists to `<PROJECT_ROOT>/.aweave/loaded-skills.yaml` (YAML single source of truth)
- `SkillsService` no longer writes `~/.aweave/active-skills.json` or `~/.aweave/loaded-skills.md`
- REST DTO shape remains unchanged (`id`, `name`, `description`, `path`, `active`)
- OpenAPI JSON and frontend generated API types were regenerated

## Outstanding Issues & Follow-up

- [ ] **Cleanup of old files** — `~/.aweave/active-skills.json` and `~/.aweave/loaded-skills.md` are orphaned after migration. User should delete manually or a future cleanup task can handle this.

## Implementation Notes / As Implemented

- Added root `.aweave/loaded-skills.yaml` seed file (`skills: []`) and `.gitignore` exceptions so the file is git-tracked.
- `SkillsService.getAllSkills()` now scans project + global skills, reads `.aweave/loaded-skills.yaml`, and returns merged `active` state internally.
- `SkillsController` was updated to map explicit DTO fields so the new internal `source` field does not leak into the REST response.
- `getActiveSkillIds()` is now async and derived from YAML-backed active paths (mapped back to current skill IDs).
- Validation run: `pnpm install --filter @hod/aweave-nestjs-dashboard`, `pnpm build`, `pnpm lint`, `pnpm generate:openapi`, `pnpm generate:types` (dashboard-web + debate-web).
- Manual browser/dashboard verification from the plan was not run in this implementation pass.
