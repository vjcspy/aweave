---
name: Testing MCP Workspace Memory with Inspector
description: Guide on how to test workspace_get_context locally with MCP Inspector using aw workspace mcp (recommended) or aw-mcp-memory (alternative)
tags: [mcp, testing, inspector, stdio]
---

# Testing MCP Workspace Memory with MCP Inspector

This guide explains how to test the `workspace_get_context` MCP tool locally using the official Anthropic MCP Inspector, with three supported server entrypoints:

1. NestJS server (Streamable HTTP - recommended for full functionality testing)
2. `aw workspace mcp` (stdio - recommended for CLI testing)
3. `aw-mcp-memory` (stdio - alternative binary)

## Prerequisites

From `workspaces/devtools/`, ensure everything required is built:

```bash
pnpm install
pnpm -r build
```

Ensure command availability:

- For `aw workspace mcp`: `aw` should be available (or use `bin/dev.js` under `workspaces/devtools/common/cli`).
- For `aw-mcp-memory`: binary should be available (for example via `pnpm link --global` in `workspaces/devtools/common/mcp-workspace-memory`).

## Running the Inspector (Recommended: NestJS Streamable HTTP)

Anthropic provides an official web-based Inspector to test MCP tools. For the NestJS MCP server, pass the MCP endpoint URL to the inspector.

1. First, start the NestJS server:

   ```bash
   aw server start
   ```

2. Then, run the inspector targeting the MCP endpoint:

   ```bash
   npx @modelcontextprotocol/inspector http://127.0.0.1:3456/mcp
   ```

## Running the Inspector (stdio: `aw workspace mcp`)

### Option A: Use environment override

Run from any directory:

```bash
AWEAVE_DEVTOOLS_ROOT=/absolute/path/to/aweave/workspaces/devtools \
  npx @modelcontextprotocol/inspector aw workspace mcp
```

### Option B: Use explicit `--project-root`

```bash
npx @modelcontextprotocol/inspector \
  aw workspace mcp --project-root /absolute/path/to/aweave
```

`aw workspace mcp` root resolution order:

1. `--project-root`
2. `AWEAVE_DEVTOOLS_ROOT`
3. auto-discovery from `cwd/moduleDir`
4. fail-fast if unresolved

## Running the Inspector (Alternative: `aw-mcp-memory`)

Use this when you want to test the standalone binary directly:

```bash
PROJECT_ROOT=/absolute/path/to/aweave \
  npx @modelcontextprotocol/inspector aw-mcp-memory
```

`aw-mcp-memory` resolves project root from `PROJECT_ROOT` and falls back to `cwd`.

## Test Steps

1. After running the command, the Inspector will start a local web server (usually at `http://localhost:5173`) and print the URL to the terminal.
2. Open that link in your web browser.
3. Click the **Connect** button on the interface.
4. Navigate to the **Tools** tab. You should see `workspace_get_context` listed.
5. In the tool arguments form, input a JSON payload to test. Example:

   ```json
   {
     "scope": {
       "workspace": "devtools"
     },
     "topics": ["plans", "overview"]
   }
   ```

6. Click **Run Tool**.
7. The Output section will display the structured JSON response from the workspace memory retrieval. Verify that it correctly returns `defaults.folder_structure` (directory-only), `defaults.overviews`, `defaults.decisions_t0`, `defaults.lessons_t0`, and other relevant context.

## Common Troubleshooting

### `aw workspace mcp` fails with root resolution error

- Set `AWEAVE_DEVTOOLS_ROOT`, or
- Pass `--project-root /absolute/path/to/aweave`.

### `aw-mcp-memory` returns wrong context

- Ensure `PROJECT_ROOT` points to the monorepo root (`/absolute/path/to/aweave`).

### `aw` or `aw-mcp-memory` command not found

- Link/install corresponding package globally before running Inspector.
