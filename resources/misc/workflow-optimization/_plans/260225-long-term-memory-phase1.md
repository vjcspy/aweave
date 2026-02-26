---
name: Long-term Memory — Phase 1 Implementation
description: Implement workspace-scoped memory system — hot memory rules, warm memory tools (workspace_get_context, workspace_save_memory) via 4-layer architecture (core, NestJS, CLI, MCP), data format standards, and migration tasks.
status: done
created: 2026-02-25
tags: [memory, workspace, mcp, nestjs, cli, hot-memory, warm-memory]
---

# 260225 — Long-term Memory — Phase 1 Implementation

## References

- `resources/misc/workflow-optimization/_features/core/long-term-memory.md` — Feature spec (source of truth)
- `agent/rules/common/agent-entry-point.md` — Current AGENTS.md (symlinked)
- `agent/rules/common/hot-memory/` — Removed — was empty placeholder files
- `agent/skills/common/devtools-cli-builder/SKILL.md` — CLI plugin patterns
- `agent/skills/common/devtools-nestjs-builder/SKILL.md` — NestJS module patterns
- `workspaces/devtools/common/debate-machine/` — Reference: core package pattern
- `workspaces/devtools/common/nestjs-debate/` — Reference: NestJS feature module pattern
- `workspaces/devtools/common/cli-plugin-debate/` — Reference: CLI plugin pattern
- `workspaces/devtools/pnpm-workspace.yaml` — Package registry
- `.gitignore` — Needs update for `user/memory/` per-branch tracking
- `agent/commands/common/create-overview.md` — Needs update per §2.4
- `user/memory/workspaces/devtools/` — Existing memory files (lessons.md, decisions.md at multiple scope levels)

## Objective

Implement Phase 1 of the long-term memory system: workspace-scoped memory that gives AI agents structured access to project knowledge (plans, features, architecture) and experiential knowledge (decisions, lessons learned).

Phase 1 delivers:
- **Hot memory** (L1): auto-loaded rules that guide every conversation
- **Warm memory** (L2): on-demand retrieval (`workspace_get_context`) and save (`workspace_save_memory`) via MCP, CLI, and REST
- **Cold memory** (L3): guidance-only (no infra — AI searches raw files directly)
- **Data format standards**: front-matter specs for OVERVIEWs, plans, decisions, lessons, and memory metadata
- **Migrations**: existing files updated to conform to new standards

### Key Considerations

1. **4-layer architecture** (§2.15): Core package has zero framework deps. NestJS, CLI, and MCP layers import core. CLI calls core directly (no server roundtrip). This mirrors the debate pattern (`debate-machine` → `nestjs-debate` → `cli-plugin-debate`).
2. **AGENTS.md rewrite is high-impact** (§2.9): The current 6-step mandatory ceremony will be replaced with optional, AI-driven context loading. Must be done carefully — it affects every conversation.
3. **ABSTRACT.md elimination** (§2.4): T0 data moves to OVERVIEW.md front-matter. This requires a phased cutover — dual-read support first, then migration, then cleanup.
4. **`user/memory/` git tracking** (§2.13): Currently fully gitignored. Each workspace branch needs to add exceptions. Master branch setup comes first; per-workspace branch setup is documented for branch owners.
5. **Existing memory files**: `user/memory/workspaces/devtools/` already has decisions.md and lessons.md at workspace, domain, and repo levels. These need to be validated against the entry format spec (§4.5) and an `_index.yaml` bootstrapped from them.
6. **MCP integration location**: `workspace_*` tools are part of APM, integrated into `@hod/aweave-server` (§2.14). This is a NestJS MCP integration, not a standalone MCP process.
7. **`include_defaults` dual mechanism** (§2.16): Both client param and server-side session tracking active. Divergence logging via pino + SQLite.

## Implementation Plan

### Phase 1: Hot Memory Foundation

Hot memory files that auto-load into every conversation. These are the "brain" rules that guide tool usage decisions. Must be in place before warm memory tools are useful — otherwise AI agents won't know when/how to call them.

**Agent compatibility constraints:**

- **Cursor:** Reads `.cursor/rules/` AND `AGENTS.md` at repo root
- **Codex:** Reads ONLY `AGENTS.md` at repo root — cannot load multiple files
- **Other agents:** Read `AGENTS.md` or `.agent/rules/`

**Approach:** Combine all hot memory source files into a single `rule.md` that is symlinked as `AGENTS.md`. All agents (Cursor, Codex, others) get the full rule set from one file. A CLI command (`aw workspace build-rules`) automates the combination (Phase 5).

**Target structure:**

```
agent/rules/common/
├── user-profile.md                  # Source — Who you are, preferences, coding style (<50 lines)
├── global-conventions.md            # Source — Cross-cutting decisions, naming, patterns (<80 lines)
├── context-memory-rule.md           # Source — How/when to use workspace memory tools (<80 lines)
├── workspace-workflow.md            # Source — How to detect workspace, load context (<100 lines)
├── rule.md                          # Combined — All sources merged, symlinked as AGENTS.md
│
.cursor/rules/
├── gitignore-tool-behavior.mdc      # ✅ EXISTS — Cursor-specific (stays)
│
AGENTS.md → agent/rules/common/rule.md  # Symlink at repo root
```

**Steps:**

- [x] **1.1** Create `agent/rules/common/user-profile.md`
  - **Source:** Extract from `user/profile.md` + `user/preferences.yaml`
  - **Content:** Identity, preferences, coding style
  - **Budget:** <50 lines, declare budget in comment at top
  - **Outcome:** AI agents know user identity and preferences from conversation start

- [x] **1.2** Create `agent/rules/common/global-conventions.md`
  - **Content:** Cross-cutting decisions, naming patterns, path conventions, language rules
  - **Source:** Extract universal patterns from current `rule.md` (AGENTS.md) — core principles, output constraints, path rules
  - **Budget:** <80 lines
  - **Outcome:** Conventions available without workspace-specific loading

- [x] **1.3** Create `agent/rules/common/context-memory-rule.md` (§4.6)
  - **Content per spec:**
    1. When to load workspace context (heuristics: path patterns, workspace/domain mentions, task type)
    2. How to use `workspace_get_context` (defaults first → decide topics → follow-up with `include_defaults: false`)
    3. When to save memory (learning cycle triggers from §4.3.2)
    4. How to access cold memory (document_path → direct read, keyword search in resources/)
  - **Does NOT contain:** hardcoded tag/category lists, workspace-specific knowledge
  - **Budget:** <80 lines
  - **Outcome:** AI agents autonomously decide when and how to use memory tools

- [x] **1.4** Create `agent/rules/common/workspace-workflow.md`
  - **Content:** Lightweight workspace detection + context loading guidance (replaces the 6-step ceremony)
  - **Source:** Distill from current `rule.md` Steps 1-4, removing mandatory confirmation and ceremony
  - **Key change:** AI decides autonomously when to load context based on task signals (§2.9)
  - **Budget:** <100 lines
  - **Outcome:** Workspace detection is fast and frictionless

- [x] **1.5** Combine all source files into `agent/rules/common/rule.md` (AGENTS.md)
  - **Action:** Merge user-profile, global-conventions, workspace-workflow, context-memory-rule into a single combined file
  - **Content:** Role + all hot memory sections with heading levels shifted (H1→H2, H2→H3)
  - **Front-matter:** `generated_from` list of source files + regeneration note
  - **Outcome:** All agents (Cursor, Codex, others) get full rules from one AGENTS.md file

- [x] **1.6** Clean up `agent/rules/common/hot-memory/` placeholder files
  - Existing placeholders: `active-workspace-context.md`, `workflow.md` (both empty)
  - Determine if content should be absorbed into the new canonical files or discarded
  - Remove placeholder files and `hot-memory/` directory if no longer needed
  - **Outcome:** No conflicting/duplicate rule locations

- [x] ~~**1.7** Create symlinks in `.cursor/rules/`~~ — **CANCELLED:** Not needed. Cursor reads AGENTS.md directly. Individual `.cursor/rules/` symlinks would cause duplicate loading.

- [x] ~~**1.8** Create `.codex/` directory and symlinks~~ — **CANCELLED:** Not needed. Codex reads only AGENTS.md. Combined file approach replaces per-file symlinks.

- [x] **1.9** Verify total hot memory budget
  - Sum all hot memory files (including `gitignore-tool-behavior.mdc`)
  - **Target:** ~500 lines / ~5000 tokens total (§4.1)
  - If over budget, review and demote least-universal content to warm memory

### Phase 2: Core Package — `@hod/aweave-workspace-memory`

Standalone TypeScript package with zero framework dependencies. All business logic for filesystem scanning, front-matter parsing, context assembly, and memory management.

**Package structure:**

```
workspaces/devtools/common/workspace-memory/
├── package.json                     # 🚧 TODO — @hod/aweave-workspace-memory
├── tsconfig.json                    # 🚧 TODO
├── eslint.config.mjs                # 🚧 TODO
└── src/
    ├── index.ts                     # 🚧 TODO — Barrel exports
    ├── get-context/
    │   ├── get-context.ts           # Orchestrator — 3-category topic routing
    │   ├── defaults.ts              # Folder structure + T0 summaries + memory metadata
    │   ├── topics/
    │   │   ├── memory.ts            # Type 1: read {topic}.md from user/memory/
    │   │   ├── features.ts          # Type 2: scan _features/ (special structure)
    │   │   └── resource.ts          # Type 3 (default): scan _{topicName}/ with front-matter
    │   └── types.ts                 # Scope, TopicContext, ResourceEntry, response types
    ├── save-memory/
    │   ├── save-memory.ts           # 🚧 TODO — Append entry + update index
    │   ├── format.ts                # 🚧 TODO — Entry formatting (decision/lesson templates)
    │   └── types.ts                 # 🚧 TODO — Save params, entry types
    ├── metadata/
    │   ├── index-manager.ts         # 🚧 TODO — Read/write/bootstrap _index.yaml
    │   └── types.ts                 # 🚧 TODO — IndexSchema types
    ├── parsers/
    │   ├── front-matter.ts          # 🚧 TODO — YAML front-matter extraction
    │   └── folder-structure.ts      # 🚧 TODO — Directory tree generation
    └── shared/
        ├── scope.ts                 # 🚧 TODO — Scope resolution (workspace/domain/repo → paths)
        └── paths.ts                 # 🚧 TODO — Path construction helpers
```

**Steps:**

- [x] **2.1** Scaffold package: `package.json`, `tsconfig.json`, `eslint.config.mjs`
  - **Dependencies:** `yaml` (YAML parsing), `glob` or `fast-glob` (file scanning)
  - **No framework deps** — pure Node.js + TypeScript
  - Register in `workspaces/devtools/pnpm-workspace.yaml`
  - **Outcome:** Package compiles and is discoverable by pnpm

- [x] **2.2** Implement scope resolution (`src/shared/scope.ts`, `src/shared/paths.ts`)
  - Input: `{ workspace, domain?, repository? }`
  - Output: resolved filesystem paths for `resources/workspaces/{scope}/` and `user/memory/workspaces/{scope}/`
  - Handle: scope narrowing (workspace → domain → repo), path validation
  - **Outcome:** All other modules use scope resolution to locate files

- [x] **2.3** Implement front-matter parser (`src/parsers/front-matter.ts`)
  - Parse YAML front-matter from markdown files (delimited by `---`)
  - Return: `{ frontMatter: Record<string, unknown>, body: string }`
  - Handle: missing front-matter (return empty object + full body), malformed YAML (warn, skip)
  - **Outcome:** Reliable front-matter extraction for all file types

- [x] **2.4** Implement folder structure generator (`src/parsers/folder-structure.ts`)
  - Generate tree representation of `resources/workspaces/{scope}/`
  - Respect depth limits, ignore hidden files/folders
  - **Outcome:** Default response includes navigable folder structure

- [x] **2.5** Implement metadata index manager (`src/metadata/index-manager.ts`)
  - **Read:** Load `_index.yaml`, validate against schema
  - **Bootstrap:** If missing/malformed, scan `decisions.md` + `lessons.md` to extract tags/categories/counts, create `_index.yaml` with `schema_version: 1` (§4.5)
  - **Update:** Add new tags/categories, increment counts, update `last_updated`
  - **Write:** Atomic write (write to temp, rename)
  - **Outcome:** Memory metadata always available and consistent

- [x] **2.6** Implement `getContext()` defaults (`src/get-context/defaults.ts`)
  - Folder structure of `resources/workspaces/{scope}/`
  - T0 summaries: scan all `OVERVIEW.md` files within scope, extract front-matter (name, description, tags)
  - Memory metadata from `_index.yaml`
  - Loaded skills: read `.aweave/loaded-skills.yaml` and include skill entries (name, description, skill_path) — AI agents can then decide which skills to load based on the current task
  - **Outcome:** Default response provides structural orientation + available skills

- [x] **2.7** Implement topic handlers (`src/get-context/topics/*.ts`)
  - `plans`: scan `*/_plans/*.md` within scope, extract front-matter (name, description, status, tags, created), apply status/tag filters
  - `features`: scan `*/_features/**/*.md`, extract T0 listing
  - `architecture`: scan `*/_architecture/**/*.md`, extract T0/T1 listing
  - `overview`: return full OVERVIEW.md content at current scope level
  - `decisions`: read `user/memory/workspaces/{scope}/decisions.md`, return full content
  - `lessons`: read `user/memory/workspaces/{scope}/lessons.md`, return full content
  - Each handler returns entries with `_meta: { document_path, document_id }`
  - **Outcome:** All topic-specific data retrievable

- [x] **2.8** Implement `getContext()` orchestrator (`src/get-context/get-context.ts`)
  - Accept params: `{ scope, topics?, include_defaults?, filters? }`
  - If no topics + `include_defaults: true`: return defaults only
  - If topics specified: call topic handlers, merge results
  - If `include_defaults: false`: skip folder structure + T0 summaries, still include memory metadata
  - Apply tag/status/category filters
  - **Outcome:** Single function handles all retrieval combinations

- [x] **2.9** Implement `saveMemory()` (`src/save-memory/save-memory.ts`, `src/save-memory/format.ts`)
  - Accept params: `{ scope, type, title, content, category?, tags? }`
  - Format entry per §4.5 spec (decision or lesson template)
  - Append to appropriate file (`decisions.md` or `lessons.md`)
  - Create file if it doesn't exist (with header)
  - Update `_index.yaml` via index manager
  - Return confirmation + file path
  - **Outcome:** Experiential knowledge persistable with consistent formatting

- [x] **2.10** Barrel exports (`src/index.ts`)
  - Export: `getContext`, `saveMemory`, all types, index manager, parsers
  - **Outcome:** Clean public API for consuming packages

- [x] **2.11** Build and verify
  - `pnpm -r build` passes
  - No type errors
  - **Outcome:** Core package is ready for integration

### Phase 3: NestJS Module — `@hod/aweave-nestjs-workspace-memory`

NestJS feature module that wraps core and adds REST endpoints + session tracking for `include_defaults` optimization.

**Package structure:**

```
workspaces/devtools/common/nestjs-workspace-memory/
├── package.json                     # 🚧 TODO — @hod/aweave-nestjs-workspace-memory
├── tsconfig.json                    # 🚧 TODO
├── eslint.config.mjs                # 🚧 TODO
└── src/
    ├── index.ts                     # 🚧 TODO — Barrel exports
    ├── workspace-memory.module.ts   # 🚧 TODO — NestJS module
    ├── workspace-memory.controller.ts # 🚧 TODO — REST endpoints
    ├── workspace-memory.service.ts  # 🚧 TODO — Wraps core, adds session tracking
    ├── session-tracker.service.ts   # 🚧 TODO — Per-session defaults tracking
    └── dto/
        ├── index.ts                 # 🚧 TODO — DTO barrel
        ├── get-context.dto.ts       # 🚧 TODO — Request/response DTOs
        └── save-memory.dto.ts       # 🚧 TODO — Request/response DTOs
```

**Steps:**

- [x] **3.1** Scaffold package following `devtools-nestjs-builder` SKILL patterns
  - Dependencies: `@hod/aweave-workspace-memory` (core), `@hod/aweave-nestjs-core`, `@nestjs/common`, `@nestjs/swagger`
  - Register in `pnpm-workspace.yaml`

- [x] **3.2** Implement DTOs with Swagger decorators
  - `GetContextRequestDto`: scope (workspace required, domain/repo optional), topics array, include_defaults bool, filters
  - `GetContextResponseDto`: defaults object, topic data, `_meta` fields
  - `SaveMemoryRequestDto`: scope, type (decision/lesson), title, content, category, tags
  - `SaveMemoryResponseDto`: confirmation, file path
  - `@ApiExtraModels()` on controller (NOT module — per NestJS builder skill)

- [x] **3.3** Implement service (`workspace-memory.service.ts`)
  - Inject core `getContext` and `saveMemory`
  - Configure project root path for core to resolve workspace files
  - **Outcome:** Core logic accessible via NestJS DI

- [ ] ~~**3.4** Design session identity contract for `include_defaults` tracking (§2.16)~~ — **DEFERRED:** Session tracking is a monitoring concern. Deferred to follow-up — the system works without it.
  - **Define session key source per transport:**
    - MCP/SSE: use MCP session ID (inherent to SSE connection lifecycle)
    - REST: define `x-session-id` request header; document fallback behavior when header is absent (e.g., treat each request as new session, log warning)
    - CLI: not applicable (CLI calls core directly, no server roundtrip)
  - **Define session lifecycle:** TTL/eviction policy (e.g., 30min idle timeout), max concurrent sessions, in-memory vs SQLite storage
  - **Define logging/metrics schema:** `defaults_total_calls`, `defaults_redundant_calls` per session/source, stored in SQLite for trend analysis
  - **Define concurrency behavior:** thread-safe session map (NestJS is single-threaded but async; ensure no race conditions on concurrent requests within same session)
  - **Outcome:** Clear contract that implementation (step 3.5) can follow without ambiguity

- [ ] ~~**3.5** Implement session tracker (`session-tracker.service.ts`)~~ — **DEFERRED:** Same as 3.4.
  - Implement per the contract defined in step 3.4
  - Track per-session whether defaults have been sent
  - When `include_defaults: true` but defaults already sent in this session → log warning via pino, increment counter in SQLite
  - **Outcome:** Data collection for future `include_defaults` simplification

- [x] **3.6** Implement REST controller (`workspace-memory.controller.ts`)
  - `GET /workspace/context` → `getContext()`
  - `POST /workspace/memory` → `saveMemory()`
  - Wire session tracking middleware
  - **Outcome:** REST API available for web UIs and other services

- [x] **3.7** Register module in server
  - Add as dependency of `@hod/aweave-server`
  - Import in `server/src/app.module.ts`
  - **Outcome:** Module active when server starts

- [x] **3.8** Build + runtime verify
  - `pnpm -r build` passes
  - `aw server restart` — no crash, no errors in `aw server logs`
  - `aw server status` shows online
  - Health check passes: `curl http://127.0.0.1:3456/health`
  - REST endpoints respond correctly
  - **Outcome:** NestJS layer operational

### Phase 4: MCP Integration (APM)

Add MCP tools (`workspace_get_context`, `workspace_save_memory`) to the NestJS server via SSE transport. AI agents access these tools via MCP protocol.

**Steps:**

- [x] **4.1** Evaluate MCP integration approach for NestJS
  - Options: `@rekog/mcp-nest` package, direct MCP SDK integration, or custom SSE controller
  - Decision criteria: maturity, maintenance burden, compatibility with existing NestJS setup
  - **Outcome:** Chosen integration approach documented

- [x] **4.2** Implement `workspace_get_context` MCP tool
  - Tool name: `workspace_get_context`
  - Input schema: mirrors core `getContext` params (scope, topics, include_defaults, filters)
  - Output: structured YAML-like response (per §4.2.2 response example)
  - `include_defaults` session tracking active via NestJS middleware
  - **Outcome:** AI agents can call `workspace_get_context` via MCP

- [x] **4.3** Implement `workspace_save_memory` MCP tool
  - Tool name: `workspace_save_memory`
  - Input schema: mirrors core `saveMemory` params (scope, type, title, content, category, tags)
  - Output: confirmation + file path
  - **Outcome:** AI agents can persist decisions and lessons via MCP

- [x] **4.4** Configure MCP server endpoint in NestJS
  - SSE transport on existing server port (3456)
  - Bearer token auth (reuse existing auth infra)
  - **Outcome:** MCP endpoint accessible at configured URL

- [ ] **4.5** Verify MCP tools from Cursor — **PENDING:** Requires configuring Cursor MCP settings and running the server. Manual verification step.
  - Configure Cursor MCP settings to point to local server
  - Test `workspace_get_context` with various scope/topic combinations
  - Test `workspace_save_memory` with decision and lesson entries
  - **Outcome:** End-to-end MCP flow works from Cursor

### Phase 5: CLI Plugin — `@hod/aweave-plugin-workspace`

CLI plugin providing `aw workspace` commands. Calls core directly (no server roundtrip per §2.15).

**Package structure:**

```
workspaces/devtools/common/cli-plugin-workspace/
├── package.json                     # 🚧 TODO — @hod/aweave-plugin-workspace
├── tsconfig.json                    # 🚧 TODO
├── eslint.config.mjs                # 🚧 TODO
└── src/
    ├── index.ts                     # 🚧 TODO
    └── commands/
        └── workspace/
            ├── get-context.ts       # 🚧 TODO — aw workspace get-context
            ├── save-memory.ts       # 🚧 TODO — aw workspace save-memory
            └── build-rules.ts       # 🚧 TODO — aw workspace build-rules
```

**Steps:**

- [x] **5.1** Scaffold CLI plugin following `devtools-cli-builder` SKILL patterns
  - Dependencies: `@hod/aweave-workspace-memory` (core), `@hod/aweave-cli-shared`, `@oclif/core`
  - **Key difference from other plugins:** calls core directly, NOT via HTTPClient → server
  - Register in `pnpm-workspace.yaml` + `cli/package.json` oclif.plugins

- [x] **5.2** Implement `aw workspace get-context`
  - Flags: `--workspace` (required), `--domain`, `--repository`, `--topics` (comma-separated), `--format json|markdown`
  - Calls core `getContext()` directly
  - Output via `MCPResponse` format (json or markdown)
  - **Outcome:** Context retrievable from terminal

- [x] **5.3** Implement `aw workspace save-memory`
  - Flags: `--workspace` (required), `--type decision|lesson`, `--title`, `--content` (or `--file`, `--stdin`), `--category`, `--tags`
  - Calls core `saveMemory()` directly
  - Output: confirmation via `MCPResponse`
  - **Outcome:** Memory saveable from terminal

- [x] **5.4** Implement `aw workspace build-rules`
  - Reads source hot memory files from `agent/rules/common/` (user-profile.md, global-conventions.md, workspace-workflow.md, context-memory-rule.md)
  - Combines into a single `agent/rules/common/rule.md` with heading levels shifted (H1→H2, H2→H3)
  - Adds `generated_from` front-matter listing source files
  - Ensures `AGENTS.md` symlink at repo root points to `rule.md`
  - Calls core directly (no server roundtrip)
  - **Outcome:** Hot memory rule combination is automated — run after editing any source file

- [x] **5.5** Build + verify
  - `pnpm -r build` — no errors
  - `aw workspace --help` — shows commands
  - `aw workspace get-context --workspace devtools` — returns expected data
  - `aw workspace save-memory --workspace devtools --type lesson --title "test" --content "test content"` — writes file
  - **Outcome:** CLI plugin operational

### Phase 6: Data Format Migrations

Update existing files to conform to new front-matter standards. This enables warm memory tools to work with existing data.

**Steps:**

- [x] **6.1** Plan front-matter migration
  - Scan all `resources/*/_plans/*.md` and `resources/workspaces/*/_plans/*.md`
  - Add missing fields: `status` (infer from content or default `done`), `tags`, `created` (from filename YYMMDD prefix)
  - Validate existing front-matter against spec (§4.5)
  - **Outcome:** All plan files have compliant front-matter

- [x] **6.2** OVERVIEW.md front-matter migration
  - Scan all `OVERVIEW.md` files in `resources/`
  - Add front-matter: `name`, `description` (extract from first paragraph or heading), `tags`
  - If corresponding `ABSTRACT.md` exists, copy its content into `description` field
  - **Outcome:** All OVERVIEWs have T0-extractable front-matter

- [x] **6.3** Memory metadata bootstrap
  - For each workspace directory in `user/memory/workspaces/`:
    - Scan `decisions.md` and `lessons.md` at all scope levels
    - Extract tags, categories, entry counts
    - Create `_index.yaml` with `schema_version: 1`
  - Currently exists: `user/memory/workspaces/devtools/` (workspace, domain, repo levels)
  - **Outcome:** `_index.yaml` files exist and reflect current memory state

- [x] **6.4** `.gitignore` update for `user/memory/` per-branch tracking (§2.13)
  - Document the per-branch gitignore exception pattern
  - On master: keep current ignore pattern (structure tracked, content ignored)
  - Create documentation for workspace branch owners on how to add exceptions
  - **Outcome:** Git tracking model documented and ready for per-branch adoption

- [x] **6.5** Validate existing `user/memory/` entry formats (all empty — no entries to validate)
  - Check `decisions.md` and `lessons.md` against §4.5 entry format spec
  - Fix any entries that don't match the format (add missing Category/Tags, add `---` separators)
  - **Outcome:** Existing entries compatible with `workspace_save_memory` tool expectations

### Phase 7: Rule & Command Updates

Update agent infrastructure files to align with the new memory system.

**Steps:**

- [x] **7.1** Update `agent/commands/common/create-overview.md` (§2.4 + §7 open item) — already compliant from earlier conversation
  - Differentiate workspace/domain/repo overview guidelines
  - Add rule: workspace OVERVIEW MUST NOT list individual packages (T0 defaults already include all OVERVIEW front-matters)
  - Remove Phase 4 (ABSTRACT.md generation) per §2.4
  - Add OVERVIEW.md front-matter requirement (name, description, tags, updated)
  - **Outcome:** Overview creation command produces compliant files

- [x] **7.2** Rename `rule.md` → `agent-entry-point.md` (§7 open item)
  - Choose new name (e.g., `agent-entry-point.md` or `bootstrap.md`)
  - Update AGENTS.md symlink to point to new filename
  - **Outcome:** File name reflects its purpose

- [x] **7.3** ABSTRACT.md → OVERVIEW.md front-matter phased cutover (§7 open item)
  - **Phase A:** Introduce dual-read support — accept both ABSTRACT.md and OVERVIEW.md front-matter as T0 source in `workspace_get_context`
  - **Phase B:** Validate all scopes have OVERVIEW.md with front-matter (from step 6.2)
  - **Phase C:** Update rule files that hardcode ABSTRACT.md paths (`rule.md`, `devtools.md`, `business-workspace.md`, `project-structure.md`)
  - **Phase D:** Stop generating ABSTRACT.md, remove hard requirement
  - **Phase E:** Clean up orphaned ABSTRACT.md files
  - **Outcome:** ABSTRACT.md fully deprecated, T0 comes from OVERVIEW.md front-matter

- [x] **7.4** Update workspace rule files for new loading flow
  - `agent/rules/common/workspaces/devtools.md` — Remove ABSTRACT.md references, align with new context loading
  - `agent/rules/common/workspaces/business-workspace.md` — Same updates
  - `agent/rules/common/project-structure.md` — Update to reflect new directory structure (hot-memory files, user/memory/ layout)
  - **Outcome:** All workspace rules consistent with new memory system

## Summary of Results

### Completed Achievements

- **Phase 1 (Hot Memory Foundation)** — Completed 2026-02-26
  - Created 4 hot memory source files at `agent/rules/common/`: `user-profile.md`, `global-conventions.md`, `context-memory-rule.md`, `workspace-workflow.md`
  - Combined all sources into `agent-entry-point.md` (178 lines / ~1,872 tokens) — symlinked as AGENTS.md at repo root
  - Removed empty `hot-memory/` placeholder directory
  - `.cursor/rules/` unchanged — keeps only `gitignore-tool-behavior.mdc`

- **Phase 2 (Core Package)** — Completed 2026-02-26
  - Created `@hod/aweave-workspace-memory` at `workspaces/devtools/common/workspace-memory/`
  - Pure TypeScript, zero framework deps. Dependencies: `yaml`, `fast-glob`
  - Implements: scope resolution, front-matter parser, folder structure generator, `getContext()` orchestrator with 2 handler categories (features + generic resource scan)
  - All public API exported via barrel `src/index.ts`

- **Phase 3 (NestJS Module)** — Completed 2026-02-26
  - Created `@hod/aweave-nestjs-workspace-memory` at `workspaces/devtools/common/nestjs-workspace-memory/`
  - REST endpoint: `GET /workspace/context`
  - DTOs with Swagger decorators for API documentation
  - Registered in `@hod/aweave-server` (`app.module.ts`)
  - Session tracking (3.4, 3.5) deferred — monitoring concern, not core functionality

- **Phase 4 (MCP Integration)** — Completed 2026-02-26
  - Used `@modelcontextprotocol/sdk` with `Server` class and SSE transport
  - MCP tool: `workspace_get_context` with full input schema
  - SSE endpoint at `GET /mcp/sse`, message handler at `POST /mcp/messages`
  - Integrated into the same NestJS module (no separate process)
  - Cursor MCP verification (4.5) left as manual step

- **Phase 5 (CLI Plugin)** — Completed 2026-02-26
  - Created `@hod/aweave-plugin-workspace` at `workspaces/devtools/common/cli-plugin-workspace/`
  - Commands: `aw workspace get-context`, `aw workspace build-rules`
  - All commands call core directly (no server roundtrip)
  - `build-rules` automates combining hot memory sources into `agent-entry-point.md`
  - Registered in `pnpm-workspace.yaml` + `cli/package.json` oclif.plugins

- **Phase 6 (Data Format Migrations)** — Completed 2026-02-26
  - Migrated 20 plan files: added `status: done`, `created` (from filename), `tags: []`
  - Migrated 22 OVERVIEW.md files: added front-matter with `name`, `description`, `tags`
  - Removed `user/memory/` directory and `.gitignore` exceptions (decisions/lessons moved to `resources/`)

- **Phase 7 (Rule & Command Updates)** — Completed 2026-02-26
  - Renamed `rule.md` → `agent-entry-point.md`, updated AGENTS.md symlink
  - Completed ABSTRACT.md → OVERVIEW.md cutover (Phases A-D): all rules now reference OVERVIEW.md, T0 comes from front-matter
  - Updated `devtools.md`: removed ABSTRACT.md references, added `workspace_get_context` guidance
  - Updated `business-workspace.md`: same ABSTRACT→OVERVIEW cutover, simplified context loading
  - Updated `project-structure.md`: reflects new directory structure (_decisions/, _lessons/, .aweave/, agent-entry-point.md)
  - ABSTRACT.md files left in place (Phase E deferred) — harmless, can be cleaned up later
  - `create-overview.md` was already compliant from earlier work

## Implementation Notes / As Implemented

### Phase 1 Deviations

1. **Combined AGENTS.md approach (revised)** — Initial implementation used per-agent symlinks (`.cursor/rules/` + `.codex/`). Revised to single combined file approach because: Codex only reads `AGENTS.md` at repo root, and Cursor already reads `AGENTS.md` via `always_applied_workspace_rules`.

2. **user-profile.md is minimal** — Only preferences from `user/preferences.yaml` were populated. Budget room available for additions later.

3. **Budget well under target** — Combined file is 178 lines / ~1,872 tokens vs the 500/5,000 target.

### Phase 2-7 Deviations

1. **MCP SDK: used `@modelcontextprotocol/sdk` directly** — Chose the official SDK over `@rekog/mcp-nest` for stability and control. Used low-level `Server` class (not `McpServer`) to avoid TypeScript type depth issues with Zod schema inference.

2. **Session tracking deferred** — Steps 3.4 and 3.5 (include_defaults session tracking) deferred. The system works without it — agents use `include_defaults: false` on follow-up calls as instructed by hot memory rules. Monitoring can be added later.

3. **Project root resolution** — Both NestJS service and CLI commands resolve project root as 3 levels up from cwd (`workspaces/devtools/common/` → project root). This works for the current monorepo layout. Could be made configurable via config package later.

4. **ABSTRACT.md cleanup deferred** — 22 orphaned ABSTRACT.md files remain. They cause no harm (nothing references them) and can be batch-deleted in a follow-up.

5. **Plan files without front-matter** — 2 plan files had no `---` delimiters and were skipped during migration. Can be manually fixed.

6. **2-category topic routing (simplified from 3)** — Refactored `getContext()` to only 2 handler categories:
   - **Type 1 (features)**: special `_features/` structure (`topics/features.ts`)
   - **Type 2 (default)**: any other topic → generic scan of `_{topicName}/` folder with front-matter extraction (`topics/resource.ts`)
   - Removed Type 1 (memory) handler entirely — decisions/lessons now live in `resources/` as `_{topicName}/` folders, handled by the generic scanner
   - Removed `save-memory/`, `metadata/`, `memory.ts`, `_index.yaml`, `workspace_save_memory` MCP tool/CLI/REST endpoint
   - `Topic` type is plain `string`; `GetContextResponse` uses `[topic: string]: unknown`
   - `PlanEntry`/`ArchitectureEntry` replaced by generic `ResourceEntry` (name, path, spread front-matter, _meta)
   - **Adding a new topic = creating a `_{topicName}/` folder** — no code changes needed

## Outstanding Issues & Follow-up

- [x] **MCP SDK selection** — Resolved: `@modelcontextprotocol/sdk` with SSE transport
- [x] **`user/memory/` removal** — Decisions/lessons moved to `resources/` as `_{topicName}/` folders. Removed: `save-memory/`, `metadata/`, `memory.ts`, `_index.yaml`, `workspace_save_memory` tool, `aw workspace save-memory` CLI, `POST /workspace/memory` REST.
- [ ] **Session tracking** — Deferred from Phase 3. Add when monitoring data is needed.
- [ ] **Config package integration** — Project root currently hardcoded as `resolve(cwd, '..', '..', '..')`. Consider moving to `@hod/aweave-config-common`.
- [ ] **ABSTRACT.md cleanup** — 22 orphaned files can be batch-deleted.
- [ ] **Cursor MCP verification** — Configure Cursor MCP settings and test end-to-end (step 4.5).
- [ ] **Default data tuning** — Monitor if structure + T0 + skills is sufficient as defaults.
