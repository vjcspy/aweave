---
name: Configure Local MCP for Cursor, Codex, and Antigravity
description: How to register the local workspace-memory STDIO MCP server in Cursor, Codex, and Antigravity using the built dist/stdio.js entry point.
tags: [mcp, workspace-memory, cursor, codex, antigravity, stdio]
category: documentation
---

# Configure `workspace-memory` MCP (Cursor, Codex, Antigravity)

This document shows how to configure the local `@hod/aweave-mcp-workspace-memory` STDIO server for:

- Cursor
- Codex
- Antigravity (Gemini)

## Server Entry Point

Use the built STDIO entry point:

- `workspaces/devtools/common/mcp-workspace-memory/dist/stdio.js`

The server resolves project root with:

- `env.PROJECT_ROOT` (recommended)
- fallback: process working directory (`cwd`)

## Prerequisites

1. Build the MCP package (so `dist/stdio.js` exists).
2. Run the client from the project root, or set `PROJECT_ROOT` / `cwd` explicitly.
3. `node` must be available on PATH.

## Shared Command (all clients)

- `command`: `node`
- `args`: `["workspaces/devtools/common/mcp-workspace-memory/dist/stdio.js"]`

Recommended environment:

- `PROJECT_ROOT`: absolute path to this repository root (example: `/Users/kai/work/aweave`)

## Cursor (`.cursor/mcp.json`)

Add/update the `workspace-memory` entry under `mcpServers` in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "workspace-memory": {
      "command": "node",
      "args": ["workspaces/devtools/common/mcp-workspace-memory/dist/stdio.js"],
      "env": {
        "PROJECT_ROOT": "/absolute/path/to/aweave"
      }
    }
  }
}
```

Notes:

- If Cursor always launches from the project root, `env.PROJECT_ROOT` may be omitted.
- If `.cursor/mcp.json` already contains other servers, only add the `workspace-memory` block.

## Codex (`~/.codex/config.toml`)

Add this table to `~/.codex/config.toml`:

```toml
[mcp_servers.workspace-memory]
command = "node"
args = ["workspaces/devtools/common/mcp-workspace-memory/dist/stdio.js"]
cwd = "/absolute/path/to/aweave"

[mcp_servers.workspace-memory.env]
PROJECT_ROOT = "/absolute/path/to/aweave"
```

Notes:

- `cwd` is supported by Codex and is recommended for stable relative path resolution.
- `PROJECT_ROOT` is redundant when `cwd` is correct, but keeping both makes behavior explicit.
- If you use a project-scoped `.codex/config.toml`, keep the same server block there instead of the global file.

## Antigravity (`~/.gemini/antigravity/mcp_config.json`)

Add/update the `workspace-memory` entry under `mcpServers` in `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "workspace-memory": {
      "command": "node",
      "args": ["workspaces/devtools/common/mcp-workspace-memory/dist/stdio.js"],
      "env": {
        "PROJECT_ROOT": "/absolute/path/to/aweave"
      },
      "disabled": false
    }
  }
}
```

Notes:

- `disabled` is optional; include it only if you want explicit enable/disable control.
- Keep existing servers in the same `mcpServers` object.

## Quick Verification

After configuring the client:

1. Restart the client (Cursor / Codex / Antigravity).
2. Confirm the `workspace-memory` MCP server is listed as connected/enabled.
3. Call `workspace_get_context` with a small request (for example, default params) to verify tool discovery and execution.

## Common Issues

### `Cannot find module .../dist/stdio.js`

- Build the package first so `dist/stdio.js` exists.

### Server starts but returns wrong project context

- Set `PROJECT_ROOT` to the correct repository root.
- For Codex, also set `cwd` to the repository root.

### `node` command not found

- Install Node.js or use a full path to the `node` executable in `command`.
