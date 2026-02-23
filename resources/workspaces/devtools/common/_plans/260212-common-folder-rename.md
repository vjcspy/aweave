---
name: Common Folder Rename
description: Rename package folders to follow standard patterns by removing the @hod/aweave- prefix.
---

# 📋 [FOLDER-RENAME: 2026-02-12] - Common Folder Rename to Match Package Names

## References

- `resources/workspaces/devtools/nab/_plans/260212-package-rename-hod-scope.md` — Scope rename plan (nab folder names already follow pattern)
- `workspaces/devtools/pnpm-workspace.yaml` — Workspace package paths
- `workspaces/devtools/common/cli/package.json` — CLI entrypoint
- `workspaces/devtools/common/config/package.json` — Config common package

## User Requirements

1. **Rename `common/` folders** to match the pattern used in `nab/` domain — folder name = package name minus `@hod/aweave-` prefix
2. **`cli` → `aweave`** — because `@hod/aweave` IS the CLI
3. **`cli-plugin-*` → `plugin-*`** — drop `cli-` prefix, consistent with `nab/plugin-nab-*` pattern
4. **Rename package `@hod/aweave-config-common` → `@hod/aweave-config`** — cleaner, unambiguous since nab has `@hod/aweave-nab-config`
5. **Update devdocs** — all folder path refs in documentation

## 🎯 Objective

Rename 8 source folders in `workspaces/devtools/common/`, 6 matching devdocs folders, and 1 package name to align folder names with the convention already established in `devtools/nab/`.

### ⚠️ Key Considerations

1. **Only folder paths change, NOT package names** (except #9). TypeScript `import from '@hod/aweave-plugin-debate'` stays — package names don't change. Only infrastructure files referencing folder paths are affected.

2. **`pnpm-lock.yaml` will regenerate.** After renaming folders and running `pnpm install`, the lockfile will update. Expected.

3. **`oclif.manifest.json` must be regenerated.** Run `pnpm oclif manifest` after rename.

4. **`cli-shared` stays as `cli-shared`.** Package name is `@hod/aweave-cli-shared` → stripping `@hod/aweave-` gives `cli-shared`. Already matches.

5. **Other `common/` folders already match.** `server`, `debate-web`, `config-core`, `debate-machine`, `nestjs-debate`, `playwright`, `workflow-dashboard`, `workflow-engine` — all already follow the pattern.

6. **`git mv` preserves history** for source folders. Use `mv` for devdocs folders (gitignored or not).

7. **Careful regex for `common/cli/`** — must NOT accidentally match `common/cli-shared/` or `common/cli-plugin-*`.

## Complete Rename Map

### Source Folders (8 renames)

| # | Current Path | New Path | Package Name (unchanged) |
|---|-------------|----------|--------------------------|
| 1 | `workspaces/devtools/common/cli` | `workspaces/devtools/common/aweave` | `@hod/aweave` |
| 2 | `workspaces/devtools/common/cli-plugin-config` | `workspaces/devtools/common/plugin-config` | `@hod/aweave-plugin-config` |
| 3 | `workspaces/devtools/common/cli-plugin-dashboard` | `workspaces/devtools/common/plugin-dashboard` | `@hod/aweave-plugin-dashboard` |
| 4 | `workspaces/devtools/common/cli-plugin-debate` | `workspaces/devtools/common/plugin-debate` | `@hod/aweave-plugin-debate` |
| 5 | `workspaces/devtools/common/cli-plugin-demo-workflow` | `workspaces/devtools/common/plugin-demo-workflow` | `@hod/aweave-plugin-demo-workflow` |
| 6 | `workspaces/devtools/common/cli-plugin-docs` | `workspaces/devtools/common/plugin-docs` | `@hod/aweave-plugin-docs` |
| 7 | `workspaces/devtools/common/cli-plugin-relay` | `workspaces/devtools/common/plugin-relay` | `@hod/aweave-plugin-relay` |
| 8 | `workspaces/devtools/common/cli-plugin-server` | `workspaces/devtools/common/plugin-server` | `@hod/aweave-plugin-server` |

### Devdocs Folders (6 renames)

| # | Current Path | New Path |
|---|-------------|----------|
| 1 | `resources/workspaces/devtools/common/cli` | `resources/workspaces/devtools/common/aweave` |
| 2 | `resources/workspaces/devtools/common/cli-plugin-dashboard` | `resources/workspaces/devtools/common/plugin-dashboard` |
| 3 | `resources/workspaces/devtools/common/cli-plugin-debate` | `resources/workspaces/devtools/common/plugin-debate` |
| 4 | `resources/workspaces/devtools/common/cli-plugin-demo-workflow` | `resources/workspaces/devtools/common/plugin-demo-workflow` |
| 5 | `resources/workspaces/devtools/common/cli-plugin-docs` | `resources/workspaces/devtools/common/plugin-docs` |
| 6 | `resources/workspaces/devtools/common/cli-plugin-server` | `resources/workspaces/devtools/common/plugin-server` |

> Note: No devdocs folders exist for `cli-plugin-config` and `cli-plugin-relay` (already noted as "Missing" in OVERVIEW).

### Package Rename (1 rename)

| Current | New | Folder (unchanged) |
|---------|-----|-------------------|
| `@hod/aweave-config-common` | `@hod/aweave-config` | `workspaces/devtools/common/config` |

## Affected Files Inventory

### Category 1: Workspace Config (1 file, 8 path entries)

- `workspaces/devtools/pnpm-workspace.yaml` — 8 entries to update:
  ```
  common/cli                     → common/aweave
  common/cli-plugin-debate       → common/plugin-debate
  common/cli-plugin-docs         → common/plugin-docs
  common/cli-plugin-dashboard    → common/plugin-dashboard
  common/cli-plugin-relay        → common/plugin-relay
  common/cli-plugin-config       → common/plugin-config
  common/cli-plugin-server       → common/plugin-server
  common/cli-plugin-demo-workflow → common/plugin-demo-workflow
  ```

### Category 2: Scripts (3 files, 5 refs)

- `workspaces/devtools/scripts/build-release.sh` — 1 ref: `common/cli` → `common/aweave`
- `workspaces/devtools/scripts/setup.sh` — 2 refs: `common/cli` → `common/aweave`
- `workspaces/devtools/scripts/nab-setup.sh` — 2 refs: `common/cli` → `common/aweave`

### Category 3: README (1 file)

- `devtools/README.md` — refs to `common/cli/` and `common/cli-plugin-<name>/`

### Category 4: Package Rename — `@hod/aweave-config-common` → `@hod/aweave-config` (5 files)

**package.json:**
- `workspaces/devtools/common/config/package.json` — `"name"` field
- `workspaces/devtools/common/server/package.json` — dependency key

**TypeScript:**
- `workspaces/devtools/common/server/src/main.ts` — import
- `workspaces/devtools/common/cli-shared/src/services/process-manager.ts` — require
- `workspaces/devtools/common/config/src/index.ts` — comment

### Category 5: Devdocs — folder path references (~230 refs across ~50 files)

**High-level breakdown:**
- `resources/workspaces/devtools/OVERVIEW.md` — ~15 refs
- `resources/workspaces/devtools/common/OVERVIEW.md` — ~15 refs
- `resources/workspaces/devtools/common/*/OVERVIEW.md` — ~30 refs
- `resources/workspaces/devtools/common/_plans/*.md` — ~40 refs
- `agent/skills/common/devtools-cli-builder/` — ~17 refs
- Other devdocs files — remaining refs
- `aweave-config-common` refs — ~15 refs

### Category 6: Auto-generated (skip — will regenerate)

- `workspaces/devtools/pnpm-lock.yaml` — regenerated by `pnpm install`
- `workspaces/devtools/common/cli/oclif.manifest.json` → moved to `workspaces/devtools/common/aweave/oclif.manifest.json` — regenerated by `pnpm oclif manifest`

## 🔄 Implementation Plan

### Phase 1: Source Folder Renames (8 folders)

**Approach:** `git mv` to preserve git history.

- [ ] **1.1** Rename all 8 source folders
  ```bash
  cd workspaces/devtools
  git mv common/cli common/aweave
  git mv common/cli-plugin-config common/plugin-config
  git mv common/cli-plugin-dashboard common/plugin-dashboard
  git mv common/cli-plugin-debate common/plugin-debate
  git mv common/cli-plugin-demo-workflow common/plugin-demo-workflow
  git mv common/cli-plugin-docs common/plugin-docs
  git mv common/cli-plugin-relay common/plugin-relay
  git mv common/cli-plugin-server common/plugin-server
  ```

- [ ] **1.2** Update `pnpm-workspace.yaml` — 8 path entries

- [ ] **1.3** Update scripts — `build-release.sh`, `setup.sh`, `nab-setup.sh`

- [ ] **1.4** Update `README.md`

**Outcome Phase 1:** All source folders renamed, workspace config updated.

---

### Phase 2: Package Rename — `@hod/aweave-config-common` → `@hod/aweave-config` (5 files)

- [ ] **2.1** Update `common/config/package.json` — `"name"` field
- [ ] **2.2** Update `common/server/package.json` — dependency key
- [ ] **2.3** Update TypeScript imports (3 files):
  - `common/server/src/main.ts`
  - `common/cli-shared/src/services/process-manager.ts` (→ now at `common/aweave/...`? No — cli-shared isn't renamed)
  - `common/config/src/index.ts` — comment

**Outcome Phase 2:** Package name updated, all cross-references point to new name.

---

### Phase 3: Devdocs Folder Renames (6 folders)

- [ ] **3.1** Rename 6 devdocs folders
  ```bash
  mv resources/workspaces/devtools/common/cli resources/workspaces/devtools/common/aweave
  mv resources/workspaces/devtools/common/cli-plugin-dashboard resources/workspaces/devtools/common/plugin-dashboard
  mv resources/workspaces/devtools/common/cli-plugin-debate resources/workspaces/devtools/common/plugin-debate
  mv resources/workspaces/devtools/common/cli-plugin-demo-workflow resources/workspaces/devtools/common/plugin-demo-workflow
  mv resources/workspaces/devtools/common/cli-plugin-docs resources/workspaces/devtools/common/plugin-docs
  mv resources/workspaces/devtools/common/cli-plugin-server resources/workspaces/devtools/common/plugin-server
  ```

**Outcome Phase 3:** Devdocs folder structure matches source.

---

### Phase 4: Devdocs Content — Update Path References (~230 refs)

**Approach:** Batch `sed` with ordered replacements (longest match first) to avoid partial matches.

**Replacement rules (ordered by specificity):**
```
# Folder path refs (source + devdocs paths)
common/cli-plugin-demo-workflow  → common/plugin-demo-workflow
common/cli-plugin-dashboard      → common/plugin-dashboard
common/cli-plugin-config         → common/plugin-config
common/cli-plugin-debate         → common/plugin-debate
common/cli-plugin-server         → common/plugin-server
common/cli-plugin-relay          → common/plugin-relay
common/cli-plugin-docs           → common/plugin-docs
common/cli/                      → common/aweave/         (with trailing slash to avoid matching cli-shared)

# Package name
aweave-config-common             → aweave-config
```

> **IMPORTANT:** `common/cli-shared` must NOT be affected. The trailing slash pattern `common/cli/` prevents matching `common/cli-shared`.

- [ ] **4.1** Update `resources/workspaces/devtools/OVERVIEW.md`
- [ ] **4.2** Update `resources/workspaces/devtools/common/OVERVIEW.md`
- [ ] **4.3** Update all `resources/workspaces/devtools/common/*/OVERVIEW.md` files
- [ ] **4.4** Update all `resources/workspaces/devtools/common/_plans/*.md` files
- [ ] **4.5** Update `agent/skills/common/devtools-cli-builder/` files
- [ ] **4.6** Update `agent/rules/common/workspaces/devtools.md`
- [ ] **4.7** Update remaining devdocs files

**Outcome Phase 4:** All documentation path references updated.

---

### Phase 5: Build & Verify

- [ ] **5.1** Regenerate lockfile
  ```bash
  cd workspaces/devtools
  rm pnpm-lock.yaml
  pnpm install
  ```

- [ ] **5.2** Build all packages
  ```bash
  pnpm -r build
  ```

- [ ] **5.3** Regenerate oclif manifest
  ```bash
  cd common/aweave && pnpm oclif manifest && cd ../..
  ```

- [ ] **5.4** Verify CLI commands work
  ```bash
  pnpm aw --help
  pnpm aw debate create --help
  pnpm aw server --help
  ```

- [ ] **5.5** Verify no stale refs remain
  ```bash
  # Source — no old folder names
  grep -r "common/cli-plugin-\|\"common/cli\"" --include="*.ts" --include="*.yaml" --include="*.sh" --include="*.json" . \
    | grep -v node_modules | grep -v pnpm-lock | grep -v dist/ | grep -v oclif.manifest

  # Source — no old package name
  grep -r "aweave-config-common" --include="*.ts" --include="*.json" . \
    | grep -v node_modules | grep -v pnpm-lock | grep -v dist/

  # Devdocs — no old folder names
  grep -rn "common/cli-plugin-\|common/cli/" --include="*.md" ../../devdocs/ | head -5
  ```

**Outcome Phase 5:** Everything builds, CLI works, no stale references.

## Execution Order

```
Phase 1 (source folders + workspace config)
    │
    ▼
Phase 2 (package rename)           ← depends on Phase 1 (cli-shared path)
    │
    ▼
Phase 3 (devdocs folders)          ← independent, can parallelize with Phase 2
    │
    ▼
Phase 4 (devdocs content refs)     ← depends on Phase 3
    │
    ▼
Phase 5 (build & verify)           ← depends on Phase 1 + 2
```

## Estimated Effort

| Phase | Effort | Description |
|-------|--------|-------------|
| Phase 1 | Low | 8 git mv + 4 config files |
| Phase 2 | Low | 1 name field + 4 ref updates |
| Phase 3 | Low | 6 folder renames |
| Phase 4 | Medium | ~230 refs across ~50 markdown files (batch sed) |
| Phase 5 | Low | Build + verify |

**Total: ~30-45 min** (Phase 4 devdocs is the bulk, but mechanical)

## 📊 Summary of Results

> Do not summarize the results until the implementation is done and I request it
