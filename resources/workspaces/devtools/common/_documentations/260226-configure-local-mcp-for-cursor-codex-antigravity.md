---
name: Configure Local MCP for Cursor, Codex, and Antigravity
description: How to register local workspace-memory MCP for Cursor (recommended: Streamable HTTP on port 3845 via TCP forwarder) and for Codex/Antigravity (recommended: aw workspace mcp stdio).
tags: [mcp, workspace-memory, cursor, codex, antigravity, streamable-http, stdio, tcp-forwarder]
category: documentation
---

# Configure `workspace-memory` MCP (Cursor, Codex, Antigravity)

This document shows supported ways to configure local `workspace-memory` MCP for:

- Cursor
- Codex
- Antigravity (Gemini)

## Prerequisites

1. Build packages from `workspaces/devtools/`:
   - `pnpm install`
   - `pnpm -r build`
2. Ensure `aw` is available (`pnpm link --global` in `workspaces/devtools/common/cli`, or use `bin/dev.js` for local testing).
3. Ensure Node.js is available on PATH.

## Approach 1 (Recommended for Cursor): NestJS Server via TCP Forwarder (Streamable HTTP)

Use the NestJS server over Streamable HTTP. This is the **recommended approach for Cursor**.

> **Company Policy:** Cursor is only permitted to connect to MCP on port **3845**. The NestJS server runs on `3456`; the TCP forwarder bridges `3845 → 3456`.

1. Determine your workspace root path (navigate to your project folder and run `pwd`):

   ```bash
   cd /absolute/path/to/aweave
   pwd
   ```

2. Start the NestJS server, providing the workspace root path as an environment variable:

   ```bash
   AWEAVE_DEVTOOLS_ROOT=$(pwd) aw server start
   ```

3. Start the TCP forwarder (port `3845 → 3456`):

   ```bash
   aw server forward start
   ```

   This uses the default config (`listenPort: 3845`, `targetPort: 3456`). To use different ports, pass `--listen-port` and `--target-port`.

4. The MCP endpoint for Cursor will be available at `http://127.0.0.1:3845/mcp`.

## Approach 2: `aw workspace mcp` (stdio)

Use the unified CLI command:

- `command`: `aw`
- `args`: `["workspace", "mcp"]`

### Root Resolution Contract

`aw workspace mcp` resolves project root in this order:

1. `--project-root /absolute/path/to/aweave` (if provided)
2. `AWEAVE_DEVTOOLS_ROOT` environment variable
3. Auto-discovery from `cwd` / module path
4. If unresolved: fail-fast with remediation error

For deterministic behavior across directories, set one of:

- `--project-root` in args, or
- `AWEAVE_DEVTOOLS_ROOT` in env

## Approach 3 (Alternative): `aw-mcp-memory` (stdio)

Use the standalone binary exported by `@hod/aweave-mcp-workspace-memory`:

- `command`: `aw-mcp-memory`
- `args`: `[]`
- Recommended env: `PROJECT_ROOT=/absolute/path/to/aweave`

This approach is useful when you want to run MCP without going through `aw` command dispatch.

## Cursor (`.cursor/mcp.json`)

**Note:** Company policy restricts Cursor to only connect to MCP on **port 3845**. The NestJS server runs on `3456`; you must start the TCP forwarder first (`aw server forward start`) so that `3845` proxies to `3456`.

### Recommended (NestJS Streamable HTTP via TCP Forwarder on port 3845)

1. Determine your workspace root path and start the NestJS server with it: `AWEAVE_DEVTOOLS_ROOT=$(pwd) aw server start`
2. Start the forwarder: `aw server forward start` (default: `3845 → 3456`)
3. Configure the MCP endpoint:

```json
{
  "mcpServers": {
    "workspace-memory": {
      "url": "http://127.0.0.1:3845/mcp"
    }
  }
}
```

Use URL mode only for this setup:

- Keep only the `url` field for `workspace-memory`.
- Do not set `command`/`args` when using `url`.
- Do not use `/sse` path. Streamable HTTP endpoint is `/mcp`.
- Always use port `3845` (not `3456`) in the Cursor config.

### Alternative 1 (`aw workspace mcp` - stdio)

*If your Cursor policy allows command execution:*

```json
{
  "mcpServers": {
    "workspace-memory": {
      "command": "aw",
      "args": ["workspace", "mcp"],
      "env": {
        "AWEAVE_DEVTOOLS_ROOT": "/absolute/path/to/aweave"
      }
    }
  }
}
```

### Alternative 2 (`aw-mcp-memory`)

```json
{
  "mcpServers": {
    "workspace-memory": {
      "command": "aw-mcp-memory",
      "args": [],
      "env": {
        "PROJECT_ROOT": "/absolute/path/to/aweave"
      }
    }
  }
}
```

## Codex (`~/.codex/config.toml`)

### Recommended for Antigravity (`aw workspace mcp`)

```toml
[mcp_servers.workspace-memory]
command = "aw"
args = ["workspace", "mcp"]

[mcp_servers.workspace-memory.env]
AWEAVE_DEVTOOLS_ROOT = "/absolute/path/to/aweave"
```

If you prefer explicit arg over env:

```toml
[mcp_servers.workspace-memory]
command = "aw"
args = ["workspace", "mcp", "--project-root", "/absolute/path/to/aweave"]
```

### Alternative for Antigravity (`aw-mcp-memory`)

```toml
[mcp_servers.workspace-memory]
command = "aw-mcp-memory"
args = []

[mcp_servers.workspace-memory.env]
PROJECT_ROOT = "/absolute/path/to/aweave"
```

## Antigravity (`~/.gemini/antigravity/mcp_config.json`)

### Recommended (`aw workspace mcp`)

```json
{
  "mcpServers": {
    "workspace-memory": {
      "command": "aw",
      "args": ["workspace", "mcp"],
      "env": {
        "AWEAVE_DEVTOOLS_ROOT": "/absolute/path/to/aweave"
      },
      "disabled": false
    }
  }
}
```

### Alternative (`aw-mcp-memory`)

```json
{
  "mcpServers": {
    "workspace-memory": {
      "command": "aw-mcp-memory",
      "args": [],
      "env": {
        "PROJECT_ROOT": "/absolute/path/to/aweave"
      },
      "disabled": false
    }
  }
}
```

## Quick Verification

After configuring the client:

1. Restart the client (Cursor / Codex / Antigravity).
2. Confirm the `workspace-memory` MCP server is listed as connected/enabled.
3. Call `workspace_get_context` with a small request to verify tool discovery and execution.

## Common Issues

### `spawn http://127.0.0.1:3845/mcp ENOENT`

- Cause: URL was entered in a STDIO `command` field, so the client tried to execute the URL as a binary.
- Fix in Cursor config: keep `workspace-memory` as URL-only:

  ```json
  {
    "mcpServers": {
      "workspace-memory": {
        "url": "http://127.0.0.1:3845/mcp"
      }
    }
  }
  ```

### `ECONNREFUSED http://127.0.0.1:3845/mcp`

- Cause: TCP forwarder is not running.
- Fix: start the forwarder before opening Cursor:

  ```bash
  aw server forward start
  ```

  Then verify with: `aw server forward status --listen-port 3845`

### SSE deprecation / `/sse` connection errors

- Cause: stale SSE configuration (`type: "sse"` or `/mcp/sse`) is still being used.
- Fix: remove `type: "sse"` and point to `http://127.0.0.1:3456/mcp`.

### `aw workspace mcp` cannot resolve project root

- Set `AWEAVE_DEVTOOLS_ROOT` to repository root, or
- Add `--project-root /absolute/path/to/aweave` to args.

### `aw-mcp-memory` starts but returns wrong project context

- Set `PROJECT_ROOT` to the correct repository root.

### `aw-mcp-memory` command not found

- Ensure package is linked/installed so binary is available:
  - `cd workspaces/devtools/common/mcp-workspace-memory && pnpm link --global`

### `aw` command not found

- Ensure CLI is linked/installed:
  - `cd workspaces/devtools/common/cli && pnpm link --global`
