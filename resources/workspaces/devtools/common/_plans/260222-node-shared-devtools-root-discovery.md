# [260222-NODE-SHARED-DEVTOOLS-ROOT-DISCOVERY] - Extract DevTools Root Discovery to `@hod/aweave-node-shared`

## References

- `workspaces/devtools/common/nestjs-dashboard/src/services/configs.service.ts` - Current `ConfigsService` contains a private `findDevtoolsRoot()` implementation using `process.cwd()`
- `workspaces/devtools/common/cli-plugin-config/src/lib/discovery.ts` - Current config plugin discovery contains a duplicated `findDevtoolsRoot()` implementation using `__dirname`
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
- Design the API so callers can pass `moduleDir` explicitly (for testability and future ESM compatibility; `__dirname` should remain call-site owned).
- Preserve current behavior for marker detection (`pnpm-workspace.yaml`) unless a broader marker strategy is explicitly introduced.
- Avoid introducing cyclic dependencies in the devtools workspace graph.
- Consider CJS/ESM interoperability: the shared package should be safe to consume from current CJS packages and future ESM packages.
- Add or update devdocs for the new package to keep package inventory coverage accurate.

## Implementation Plan

### Phase 1: Analysis & Preparation

- [ ] Analyze detailed requirements
  - **Outcome**: Confirm package/folder naming (`@hod/aweave-node-shared`, `common/node-shared`) and fallback strategy expectations (`env -> cwd -> moduleDir`)
- [ ] Define scope and edge cases
  - **Outcome**: Define supported execution contexts (CLI plugin, NestJS service, compiled `dist/`, different process `cwd`, missing marker file, invalid env override path)
- [ ] Evaluate existing test structures and define test cases
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
└── nestjs-dashboard/                     # 🔄 IN PROGRESS - Replace private `findDevtoolsRoot()` with shared utility

resources/workspaces/devtools/common/
├── node-shared/                          # 🚧 TODO - New package docs (ABSTRACT/OVERVIEW)
│   ├── ABSTRACT.md
│   └── OVERVIEW.md
└── OVERVIEW.md                           # 🔄 IN PROGRESS - Add package inventory entry
```

### Phase 3: Detailed Implementation Steps

- [ ] Create new workspace package `workspaces/devtools/common/node-shared`
  - Add `package.json`, `tsconfig.json`, source folder structure, and build scripts consistent with other common shared packages
  - Keep runtime dependencies minimal (prefer Node built-ins only unless clearly needed)

- [ ] Register package in `workspaces/devtools/pnpm-workspace.yaml`
  - Ensure workspace build/discovery includes `common/node-shared`

- [ ] Design and implement a reusable root discovery API
  - Proposed shape (subject to repo conventions):
    - `findAncestorWithMarker(startDir, markerName): string | null`
    - `resolveDevtoolsRoot(options): string | null`
  - Support explicit inputs such as `env`, `cwd`, `moduleDir`, `maxDepth`
  - Implement precedence:
    1. environment override path (validated)
    2. `cwd` walk-up (if provided/enabled)
    3. `moduleDir` walk-up (callers pass `__dirname` in CJS builds)

- [ ] Migrate `cli-plugin-config` to use `@hod/aweave-node-shared`
  - Replace local `findDevtoolsRoot()` in `workspaces/devtools/common/cli-plugin-config/src/lib/discovery.ts`
  - Pass `moduleDir: __dirname` and preserve current plugin behavior
  - Keep domain discovery logic local (only move generic path discovery)

- [ ] Migrate `nestjs-dashboard` to use `@hod/aweave-node-shared`
  - Replace private `findDevtoolsRoot()` in `workspaces/devtools/common/nestjs-dashboard/src/services/configs.service.ts`
  - Provide `cwd` and `moduleDir` fallback inputs to reduce PM2/Nest runtime sensitivity
  - Preserve current warning/error behavior in `getAvailableConfigs()` and `getConfigDetails()`

- [ ] Add/update tests for root discovery behavior
  - Cover valid env override
  - Cover invalid env override (fallback continues or fails per chosen contract)
  - Cover `cwd` mismatch with successful `moduleDir` fallback
  - Cover missing marker file returns `null`
  - Cover max-depth traversal limits

- [ ] Update package documentation
  - Add `resources/workspaces/devtools/common/node-shared/ABSTRACT.md`
  - Add `resources/workspaces/devtools/common/node-shared/OVERVIEW.md`
  - Update `resources/workspaces/devtools/common/OVERVIEW.md` package list and dependency diagram references
  - Update `resources/workspaces/devtools/OVERVIEW.md` if package listing or architecture notes mention shared library inventory

- [ ] Validate build and consumer integration
  - Build `node-shared`, then dependent packages (`cli-plugin-config`, `nestjs-dashboard`)
  - Confirm type resolution and runtime imports work from compiled output
  - Smoke-test config discovery flows in both CLI and dashboard API paths

## Summary of Results

### Completed Achievements

- [To be updated after implementation is complete]
