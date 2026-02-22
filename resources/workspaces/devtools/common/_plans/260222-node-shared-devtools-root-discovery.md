# [260222-NODE-SHARED-DEVTOOLS-ROOT-DISCOVERY] - Extract DevTools Root Discovery to `@hod/aweave-node-shared`

## References

- `workspaces/devtools/common/nestjs-dashboard/src/services/configs.service.ts` - Current `ConfigsService` contains a private `findDevtoolsRoot()` implementation using `process.cwd()`
- `workspaces/devtools/common/cli-plugin-config/src/lib/discovery.ts` - Current config plugin discovery contains a duplicated `findDevtoolsRoot()` implementation using `__dirname`
- `workspaces/devtools/common/cli-plugin-dashboard/src/hooks/useWorkspace.ts` - ESM consumer with `import.meta.url`-based DevTools root discovery for workspace scan hook
- `workspaces/devtools/common/cli-plugin-dashboard/src/commands/dashboard/workspace.ts` - ESM consumer with `fileURLToPath(import.meta.url)` + relative path traversal in JSON output path
- `resources/workspaces/devtools/common/cli-shared/OVERVIEW.md` - Documents `cli-shared` as a CLI ecosystem utility package (boundary context)
- `workspaces/devtools/pnpm-workspace.yaml` - Workspace package registration to add `common/node-shared`
- `workspaces/devtools/common/cli-plugin-config/package.json` - Add dependency on `@hod/aweave-node-shared`
- `workspaces/devtools/common/nestjs-dashboard/package.json` - Add dependency on `@hod/aweave-node-shared`
- `resources/workspaces/devtools/common/OVERVIEW.md` - Update package inventory to include `node-shared`
- `resources/workspaces/devtools/OVERVIEW.md` - Update high-level package list if needed

## User Requirements

1. tên package: @hod/aweave-node-shared, tên folder: node-shared
2. __dirname as a fallback, không phải __dirname-only -> đồng ý

## Objective

Create a new neutral Node.js shared package (`@hod/aweave-node-shared` in `workspaces/devtools/common/node-shared`) and move DevTools root discovery logic there so both CLI-side and NestJS-side consumers use one consistent implementation with an explicit fallback order, including `__dirname`/module directory as a fallback rather than the only source.

### Key Considerations

- Keep package semantics neutral: this utility is for Node runtime consumers (CLI plugins and backend modules), not CLI-only concerns.
- Standardize discovery precedence to reduce environment-sensitive failures:
  - explicit environment override (e.g. `AWEAVE_DEVTOOLS_ROOT`)
  - runtime `cwd` (optional convenience)
  - module directory / `__dirname` walk-up fallback
- This precedence is an **intentional behavior unification** across existing consumers (not a bug fix preserving each current package's exact order).
- Design the API so callers can pass `moduleDir` explicitly (for testability and future ESM compatibility; `__dirname` should remain call-site owned).
- Clarify shared API failure contract up front: shared function returns `null` on resolution failure, and each caller keeps its own business-specific fallback/throw behavior.
- Preserve current behavior for marker detection (`pnpm-workspace.yaml`) unless a broader marker strategy is explicitly introduced.
- Avoid introducing cyclic dependencies in the devtools workspace graph.
- Consider CJS/ESM interoperability: the shared package should be safe to consume from current CJS packages and future ESM packages.
- Add or update devdocs for the new package to keep package inventory coverage accurate.

## Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Analyze detailed requirements
  - **Outcome**: Confirm package/folder naming (`@hod/aweave-node-shared`, `common/node-shared`) and fallback strategy expectations (`env -> cwd -> moduleDir`)
- [x] Define scope and edge cases
  - **Outcome**: Define supported execution contexts (CLI plugin, NestJS service, compiled `dist/`, different process `cwd`, missing marker file, invalid env override path)
- [x] Evaluate existing test structures and define test cases
  - **Outcome**: Identify test pattern used by similar shared packages and specify test scenarios for root discovery precedence and failure behavior

### Phase 2: Implementation Structure

```text
workspaces/devtools/common/
├── node-shared/                          # 🚧 TODO - New neutral Node.js utility package
│   ├── package.json                      # 🚧 TODO - @hod/aweave-node-shared metadata
│   ├── tsconfig.json                     # 🚧 TODO - Build configuration aligned with common packages
│   └── src/
│       ├── index.ts                      # 🚧 TODO - Barrel exports
│       └── paths/
│           ├── devtools-root.ts          # 🚧 TODO - Root discovery utilities with fallback order
│           └── index.ts                  # 🚧 TODO - Path utility exports
├── cli-plugin-config/                    # 🔄 IN PROGRESS - Replace local `findDevtoolsRoot()` duplication
├── cli-plugin-dashboard/                 # 🔄 IN PROGRESS - Replace ESM relative-path root discovery duplication
└── nestjs-dashboard/                     # 🔄 IN PROGRESS - Replace private `findDevtoolsRoot()` with shared utility

resources/workspaces/devtools/common/
├── node-shared/                          # 🚧 TODO - New package docs (ABSTRACT/OVERVIEW)
│   ├── ABSTRACT.md
│   └── OVERVIEW.md
└── OVERVIEW.md                           # 🔄 IN PROGRESS - Add package inventory entry
```

### Phase 3: Detailed Implementation Steps

- [x] Create new workspace package `workspaces/devtools/common/node-shared`
  - Add `package.json`, `tsconfig.json`, source folder structure, and build scripts consistent with other common shared packages
  - Keep runtime dependencies minimal (prefer Node built-ins only unless clearly needed)

- [x] Register package in `workspaces/devtools/pnpm-workspace.yaml`
  - Ensure workspace build/discovery includes `common/node-shared`

- [x] Design and implement a reusable root discovery API
  - Proposed shape (subject to repo conventions):
    - `findAncestorWithMarker(startDir, markerName): string | null`
    - `resolveDevtoolsRoot(options): string | null`
  - Support explicit inputs such as `env`, `cwd`, `moduleDir`, `maxDepth`
  - Contract: `resolveDevtoolsRoot()` returns `null` on failure (no throw); callers decide whether to return empty results, log warnings, or throw
  - Caller strategy control: callers can opt out of a source by omitting it (`cwd`, `moduleDir`, etc.)
  - Implement precedence:
    1. environment override path (validated)
    2. `cwd` walk-up (if provided/enabled)
    3. `moduleDir` walk-up (callers pass `__dirname` in CJS builds)

- [x] Migrate `cli-plugin-config` to use `@hod/aweave-node-shared`
  - Replace local `findDevtoolsRoot()` in `workspaces/devtools/common/cli-plugin-config/src/lib/discovery.ts`
  - Pass `moduleDir: __dirname` and preserve current plugin behavior
  - Keep domain discovery logic local (only move generic path discovery)

- [x] Migrate `cli-plugin-dashboard` to use `@hod/aweave-node-shared`
  - Replace ESM root discovery duplication in:
    - `workspaces/devtools/common/cli-plugin-dashboard/src/hooks/useWorkspace.ts`
    - `workspaces/devtools/common/cli-plugin-dashboard/src/commands/dashboard/workspace.ts`
  - Migrate from hardcoded relative depth traversal to marker-based walk-up using shared utility (intentional consistency improvement)
  - For ESM callers, pass `moduleDir` derived from `import.meta.url` (e.g., `fileURLToPath(new URL('.', import.meta.url))` or equivalent normalized directory path)

- [x] Migrate `nestjs-dashboard` to use `@hod/aweave-node-shared`
  - Replace private `findDevtoolsRoot()` in `workspaces/devtools/common/nestjs-dashboard/src/services/configs.service.ts`
  - Provide `cwd` and `moduleDir` fallback inputs to reduce PM2/Nest runtime sensitivity
  - Preserve current warning/error behavior in `getAvailableConfigs()` and `getConfigDetails()`

- [ ] Add/update tests for root discovery behavior
  - Cover valid env override
  - Cover invalid env override (fallback continues or fails per chosen contract)
  - Cover `cwd` mismatch with successful `moduleDir` fallback
  - Cover ESM caller input path derived from `import.meta.url` (or equivalent directory path)
  - Cover missing marker file returns `null`
  - Cover max-depth traversal limits

- [x] Update package documentation
  - Add `resources/workspaces/devtools/common/node-shared/ABSTRACT.md`
  - Add `resources/workspaces/devtools/common/node-shared/OVERVIEW.md`
  - Update `resources/workspaces/devtools/common/OVERVIEW.md` package list and dependency diagram references
  - Update `resources/workspaces/devtools/OVERVIEW.md` if package listing or architecture notes mention shared library inventory

- [ ] Validate build and consumer integration
  - Build `node-shared`, then dependent packages (`cli-plugin-config`, `cli-plugin-dashboard`, `nestjs-dashboard`)
  - Confirm type resolution and runtime imports work from compiled output
  - Smoke-test config discovery flows in CLI plugin and dashboard API paths
  - Smoke-test dashboard workspace scan paths (hook/JSON mode) after ESM migration

## Summary of Results

### Completed Achievements

- [To be updated after implementation is complete]

## Implementation Notes / As Implemented

- Created new package `workspaces/devtools/common/node-shared` (`@hod/aweave-node-shared`) with CJS build, workspace registration, and package docs.
- Implemented shared root discovery utilities in `src/paths/devtools-root.ts`:
  - `findAncestorWithMarker(startDir, markerName, { maxDepth? })`
  - `resolveDevtoolsRoot({ env, envVarName, cwd, moduleDir, markerName, maxDepth })`
- Standardized resolution precedence to `AWEAVE_DEVTOOLS_ROOT` (validated by marker walk-up) -> optional `cwd` -> optional `moduleDir`, with `null` return on failure.
- Migrated duplicated root discovery logic in:
  - `workspaces/devtools/common/cli-plugin-config/src/lib/discovery.ts`
  - `workspaces/devtools/common/cli-plugin-dashboard/src/hooks/useWorkspace.ts`
  - `workspaces/devtools/common/cli-plugin-dashboard/src/commands/dashboard/workspace.ts`
  - `workspaces/devtools/common/nestjs-dashboard/src/services/configs.service.ts`
- ESM dashboard consumers now use `createRequire(import.meta.url)` for CJS interop and pass `moduleDir` from `fileURLToPath(new URL('.', import.meta.url))`.
- Updated package inventories/docs:
  - Added `resources/workspaces/devtools/common/node-shared/ABSTRACT.md`
  - Added `resources/workspaces/devtools/common/node-shared/OVERVIEW.md`
  - Updated `resources/workspaces/devtools/common/OVERVIEW.md`
  - Updated `resources/workspaces/devtools/OVERVIEW.md`
- Validation performed:
  - Ran `pnpm -C workspaces/devtools install` (workspace link/update for new package)
  - Built `node-shared`, `cli-plugin-config`, `cli-plugin-dashboard`, and `nestjs-dashboard` successfully
- Not completed in this implementation:
  - Root discovery tests were not added
  - Runtime smoke-tests for CLI/dashboard/Nest flows were not executed
