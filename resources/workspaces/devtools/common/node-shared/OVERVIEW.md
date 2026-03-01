---
name: Node Shared
description: Node-only shared utility package providing DevTools root discovery and shared pino logger factory. MUST load full overview when implementing any feature related to NodeJS runtime, CLI logging, or shared file-based logging.
tags: []
---

# Node Shared (`@hod/aweave-node-shared`)

> **Source:** `workspaces/devtools/common/node-shared/`
> **Last Updated:** 2026-03-01

Node-only shared utility package for runtime helpers that are not specific to oclif, NestJS, or React. Used by all layers of the devtools stack: CLI plugins, NestJS server, and MCP servers.

## Current Scope

Two responsibilities:

1. **DevTools root discovery** — workspace-aware path resolution from any execution context
2. **Shared pino logger factory** — structured logging with file rotation and MCP-safe stderr output

## Public API

### Logging

- `createLogger(options?)` → `pino.Logger`
  - Framework-agnostic pino logger factory used by all devtools packages.
  - Writes to `~/.aweave/logs/{name}.jsonl` (all levels) and `~/.aweave/logs/{name}.error.jsonl` (error-only).
  - Console output always goes to **stderr (fd 2)** — never stdout — preserving MCP stdio transport and CLI JSON output.

- `CreateLoggerOptions` interface:

  | Option | Type | Default | Description |
  |--------|------|---------|-------------|
  | `name` | `string` | `'app'` | Log file prefix (e.g. `'server'`, `'cli'`) |
  | `service` | `string` | same as `name` | `service` field in JSON entries (e.g. `'aweave-server'` for dashboard compat) |
  | `fileExtension` | `string` | `'.jsonl'` | Log file extension |
  | `logDir` | `string` | `~/.aweave/logs` | Log directory (overridden by `LOG_DIR` env var) |
  | `level` | `pino.Level` | `'debug'` dev / `'info'` prod | Min log level (overridden by `LOG_LEVEL` env var) |
  | `console` | `boolean` | `true` | Enable stderr console output (overridden by `LOG_CONSOLE` env var) |
  | `sync` | `boolean` | `false` | Synchronous file writes — **required for short-lived CLI processes** |

**Two transport modes:**

- **`sync: false`** (default) — async `pino.transport()` with `pino-roll` for daily file rotation. Use in long-running services (NestJS server). Rotated files: `{name}.jsonl.{date}`.
- **`sync: true`** — synchronous `pino.multistream()` + `pino.destination({ sync: true })`. Use in CLI commands where the process exits after a short run (async workers won't flush before exit).

### Paths (DevTools Root Discovery)

- `findAncestorWithMarker(startDir, markerName, options?)` → `string | null`
- `resolveDevtoolsRoot(options?)` → `string | null`
- `resolveProjectRootFromDevtools(options?)` → `string | null`

**Resolution precedence:**

1. `AWEAVE_DEVTOOLS_ROOT` env var (validated)
2. `cwd` (if passed by caller)
3. `moduleDir` fallback (e.g. `__dirname`)

## Project Structure

```
node-shared/
├── package.json            # @hod/aweave-node-shared
│                           # deps: pino, pino-pretty, pino-roll
├── tsconfig.json
└── src/
    ├── index.ts            # Barrel: export * from './logging'; export * from './paths'
    ├── logging/
    │   ├── logger.factory.ts  # createLogger() implementation
    │   └── index.ts           # Barrel re-export
    └── paths/
        ├── devtools-root.ts   # resolveDevtoolsRoot, resolveProjectRootFromDevtools
        └── index.ts
```

## Consumers

| Package | What it uses | Mode |
|---------|-------------|------|
| `@hod/aweave-nestjs-core` | `createLogger()` via re-export | async (sync: false) |
| `@hod/aweave-cli-shared` | `createLogger()` via `getCliLogger()` | sync (sync: true) |
| `@hod/aweave-plugin-workspace` | `resolveProjectRootFromDevtools()` | — |
| `@hod/aweave-plugin-config` | `resolveDevtoolsRoot()` | — |
| `@hod/aweave-plugin-dashboard` | `resolveDevtoolsRoot()` | — |
| `@hod/aweave-nestjs-dashboard` | `resolveDevtoolsRoot()` | — |

## Design Notes

- CJS output (`"module": "commonjs"`) for broad compatibility
- Only Node built-ins (`fs`, `path`, `os`) + pino family as runtime deps
- `pino` types in `nestjs-core` are resolved via `devDependencies` — runtime pino comes transitively from `node-shared`

## Related

- **Plan:** `resources/workspaces/devtools/common/_plans/260301-shared-logger-node-shared.md`
- **CLI logger singleton:** `workspaces/devtools/common/cli-shared/src/logger/index.ts`
- **NestJS logger service:** `workspaces/devtools/common/nestjs-core/src/logging/nest-logger.service.ts`
