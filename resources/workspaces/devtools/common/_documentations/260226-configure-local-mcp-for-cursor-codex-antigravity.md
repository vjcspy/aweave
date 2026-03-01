---
name: Configure Local MCP for Cursor, Codex, and Antigravity
description: How to register local workspace-memory MCP using aw workspace mcp (recommended) or aw-mcp-memory (alternative) for Cursor, Codex, and Antigravity.
tags: [mcp, workspace-memory, cursor, codex, antigravity, stdio]
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

## Approach 1 (Recommended for Cursor): NestJS Server (SSE)

Use the NestJS server over SSE. This is the **recommended approach for Cursor**, as Cursor currently has policies that restrict executing arbitrary commands and enforce `localhost` connections.

1. Start the NestJS server:

   ```bash
   aw server start
   ```

2. The SSE endpoint will be available at `http://127.0.0.1:3456/mcp/sse`.

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

**Note:** Cursor currently operates with a policy that only allows running on localhost and restricts stdio command execution. Therefore, the NestJS SSE approach is recommended.

### Recommended (NestJS SSE)

First, start the NestJS server (`aw server start`). Then configure the SSE endpoint:

```json
{
  "mcpServers": {
    "workspace-memory": {
      "type": "sse",
      "url": "http://127.0.0.1:3456/mcp/sse"
    }
  }
}
```

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

### Recommended (`aw workspace mcp`)

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

### Alternative (`aw-mcp-memory`)

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
