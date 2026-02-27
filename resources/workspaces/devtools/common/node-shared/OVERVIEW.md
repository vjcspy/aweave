---
name: Node Shared
description: Node-only shared utility package for runtime helpers including DevTools root discovery. MUST load full overview content when implementing any new feature related to nodejs runtime.
tags: []
---

# Node Shared (@hod/aweave-node-shared)

Node-only shared utility package for runtime helpers that are not specific to oclif, NestJS, or React.

## Current Scope

This package currently provides a single responsibility: **DevTools root discovery** for workspace-aware packages that need to locate `workspaces/devtools/` reliably from different execution contexts (source, compiled `dist/`, PM2/Nest runtime, or CLI invocation from arbitrary directories).

## Public API

- `findAncestorWithMarker(startDir, markerName, options?)` → `string | null`
  - Walks up ancestor directories and returns the first directory containing the marker file.
  - Returns `null` on failure (never throws for "not found").
- `resolveDevtoolsRoot(options?)` → `string | null`
  - Uses a standardized precedence to resolve the DevTools workspace root (`pnpm-workspace.yaml` marker by default).
  - Returns `null` when no candidate resolves.
- `resolveProjectRootFromDevtools(options?)` → `string | null`
  - Resolves DevTools root with the same precedence as `resolveDevtoolsRoot()`.
  - Converts DevTools root to monorepo project root via `../..`.
  - Returns `null` when no candidate resolves.

## Resolution Precedence (Standardized)

1. Environment override (`AWEAVE_DEVTOOLS_ROOT` by default, validated by marker walk-up)
2. `cwd` (only if caller passes one)
3. `moduleDir` fallback (only if caller passes one, e.g. `__dirname` or `fileURLToPath(new URL('.', import.meta.url))`)

This keeps `__dirname`/module-directory discovery as a **fallback**, not the only strategy, while letting each caller opt in/out of sources explicitly.

## Failure Contract

- Shared functions return `null` on resolution failure.
- Callers keep business-specific behavior:
  - CLI helpers may return empty results
  - Dashboard commands/hooks may throw user-facing errors
  - NestJS services may warn or throw depending on endpoint behavior

## Consumers (Current)

- `workspaces/devtools/common/cli-plugin-config/`
- `workspaces/devtools/common/cli-plugin-dashboard/`
- `workspaces/devtools/common/nestjs-dashboard/`
- `workspaces/devtools/common/cli-plugin-workspace/`

## Design Notes

- Uses Node built-ins only (`fs`, `path`)
- CJS package output for broad compatibility
- Safe for ESM consumers through `createRequire()` interop when needed
