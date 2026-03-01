---
name: CLI Shared Utilities
description: Pure utility library providing MCP response format, HTTP client, process management, and TCP forwarder manager for the CLI ecosystem
tags: []
---

# CLI Shared Utilities (`@hod/aweave-cli-shared`)

> **Source:** `workspaces/devtools/common/cli-shared/`

Pure utility library for the entire `aw` CLI ecosystem. This package has **no CLI framework dependency** (no oclif, no commander) — only utility functions and models shared by the main CLI (`@hod/aweave`) and all plugins (`@hod/aweave-plugin-*`).

## Purpose

- **MCP Response Format** — Standardized JSON output for all CLI commands. AI agents parse this format to process results.
- **HTTP Client** — Base HTTP client with error handling, using native `fetch` (Node 18+).
- **Output Helpers** — Consistent formatting (JSON/Markdown), readable content mode for AI agents.
- **Content Reading** — Shared `--file` / `--content` / `--stdin` pattern for commands accepting input.
- **Server Process Manager** — Detached daemon lifecycle for the NestJS server.
- **TCP Forwarder Manager** — Manages lightweight Node.js TCP proxy workers for port forwarding.

**Why a separate package?** To avoid cyclic dependencies. With `@hod/aweave-cli-shared` as a leaf dependency, there's no cycle:

```
@hod/aweave-cli-shared  (leaf — no CLI framework dependency)
       ↑                         ↑
       |                         |
@hod/aweave               @hod/aweave-plugin-*
(depends on shared)        (depends on shared only)
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    @hod/aweave-cli-shared                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  mcp/                          http/                             │
│  ├── response.ts               └── client.ts                     │
│  │   MCPResponse                   HTTPClient                    │
│  │   MCPContent                    HTTPClientError               │
│  │   MCPError                                                    │
│  │   ContentType enum                                            │
│  └── pagination.ts                                               │
│      createPaginatedResponse()                                   │
│                                                                  │
│  helpers/                      services/                         │
│  ├── output.ts                 ├── process-manager.ts            │
│  │   output()                  │   startServer()                 │
│  │   errorResponse()           │   stopServer()                  │
│  │   handleServerError()       │   restartServer()               │
│  └── content.ts                │   getServerStatus()             │
│      readContent()             │   ensureServerRunning()         │
│                                │   readLogTail()                 │
│                                ├── forwarder-manager.ts          │
│                                │   startForwarder()              │
│                                │   stopForwarder()               │
│                                │   killForwarder()               │
│                                │   getForwarderStatus()          │
│                                │   listForwarders()              │
│                                ├── tcp-forwarder-worker.ts       │
│                                │   (standalone child process)    │
│                                └── pm2.ts  (legacy)              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Dependencies

| Package | Role |
|---------|------|
| `@hod/aweave-config-common` | Forwarder/server default config resolution |
| `@hod/aweave-config-core` | `loadConfig()` used by process managers |

**devDependencies:** `@types/node`, `typescript`

**Key design:** Minimal external dependencies. HTTP client uses native `fetch`. UUID uses `crypto.randomUUID()`. All process management uses Node.js built-ins (`child_process`, `net`, `fs`).

## Exposed Exports

```typescript
// MCP Response Format
export { ContentType, MCPContent, MCPError, MCPResponse } from './mcp';
export { createPaginatedResponse } from './mcp';
export type { MCPContentData, MCPErrorData, MCPResponseData } from './mcp';

// HTTP Client
export { HTTPClient, HTTPClientError } from './http';
export type { HTTPClientOptions } from './http';

// CLI Helpers
export { output, errorResponse, handleServerError } from './helpers';
export { readContent } from './helpers';
export type { ContentInput, ContentResult } from './helpers';

// Server process manager (replaces PM2)
export {
  startServer, stopServer, restartServer, getServerStatus,
  ensureServerRunning, readLogTail, resolveServerEntry, getLogFilePath,
} from './services';
export type { ServerState, ServerStatus } from './services';

// TCP Forwarder manager
export {
  startForwarder, stopForwarder, killForwarder,
  getForwarderStatus, listForwarders, FORWARDER_DEFAULTS,
} from './services';
export type { ForwarderState, ForwarderStatusCode, ForwarderStatusResult } from './services';
```

### MCP Response Format (Contract)

All CLI commands output JSON in this format. **This is the contract with the AI agent ecosystem** — changes must be backward-compatible.

**Success:**

```json
{
  "success": true,
  "content": [
    { "type": "json", "data": { ... } }
  ],
  "metadata": { "message": "..." },
  "has_more": false,
  "total_count": 10
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "suggestion": "Use 'aw docs list' to see available documents"
  }
}
```

### Server Process Manager

Manages the NestJS server daemon (`@hod/aweave-server`).

- State file: `~/.aweave/server.json`
- Log file: `~/.aweave/logs/server.log`
- Config loaded from `@hod/aweave-config-common` → `cli.yaml` (env: `SERVER_PORT`, `SERVER_HOST`)

### TCP Forwarder Manager

Manages lightweight Node.js TCP proxy workers. Each forwarder proxies connections from a local listen port to a target host:port.

- State dir: `~/.aweave/forwarders/forwarder-<port>.json`
- Log dir: `~/.aweave/logs/forwarder-<port>.log`
- Config loaded from `@hod/aweave-config-common` → `cli.yaml` (`services.forwarder.*`)
- Env overrides: `AWEAVE_FORWARDER_LISTEN_PORT`, `AWEAVE_FORWARDER_TARGET_PORT`, etc.
- Worker (`tcp-forwarder-worker.ts`) is a standalone script spawned in detached mode

**API:**

| Function | Description |
|----------|-------------|
| `startForwarder(opts?)` | Spawn worker, write state, idempotent |
| `getForwarderStatus(port)` | Returns `running` / `stopped` / `stale` |
| `listForwarders()` | List all state files in `~/.aweave/forwarders/` |
| `stopForwarder(port, opts?)` | SIGTERM → optional SIGKILL (`opts.force`) |
| `killForwarder(port)` | Immediate SIGKILL |
| `FORWARDER_DEFAULTS` | Config-resolved defaults (listenPort, targetPort, etc.) |

## Project Structure

```
devtools/common/cli-shared/
├── package.json                    # @hod/aweave-cli-shared (no bin, no CLI framework)
├── tsconfig.json
└── src/
    ├── index.ts                    # Barrel exports
    ├── mcp/
    │   ├── response.ts            # MCPResponse, MCPContent, MCPError, ContentType
    │   ├── pagination.ts          # createPaginatedResponse()
    │   └── index.ts
    ├── http/
    │   ├── client.ts              # HTTPClient, HTTPClientError
    │   └── index.ts
    ├── helpers/
    │   ├── output.ts              # output(), errorResponse(), handleServerError()
    │   ├── content.ts             # readContent()
    │   └── index.ts
    └── services/
        ├── process-manager.ts     # Server daemon lifecycle
        ├── forwarder-manager.ts   # TCP forwarder lifecycle
        ├── tcp-forwarder-worker.ts # TCP proxy child process
        ├── pm2.ts                 # pm2 utilities (legacy)
        └── index.ts
```

## Development

```bash
cd workspaces/devtools/common/cli-shared

# Build (must be built FIRST — all other CLI packages depend on this)
pnpm build

# Dev mode
pnpm dev   # tsc --watch
```

**Build order:** `config` → `cli-shared` → plugins (`cli-plugin-*`) → `cli` (main)

## Related

- **Main CLI:** `workspaces/devtools/common/cli/`
- **Config Package:** `workspaces/devtools/common/config/` (`@hod/aweave-config-common`)
- **Server Plugin:** `workspaces/devtools/common/cli-plugin-server/`
- **Global DevTools Overview:** `resources/workspaces/devtools/OVERVIEW.md`
