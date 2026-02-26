---
name: Testing MCP Workspace Memory with Inspector
description: Guide on how to test the workspace_get_context MCP tool locally using the Anthropic MCP Inspector
tags: [mcp, testing, inspector, stdio]
---

# Testing MCP Workspace Memory with MCP Inspector

This guide explains how to test the `workspace_get_context` MCP tool locally using the official Anthropic MCP Inspector via the STDIO transport.

## Prerequisites

Ensure the `mcp-workspace-memory` package is fully built before testing. Run this command from the project root:

```bash
yarn workspace @hod/aweave-mcp-workspace-memory build
```

## Running the Inspector

Anthropic provides an official web-based Inspector to test MCP tools.

To launch the Inspector against the local `stdio.js` entry point, run the following command from the project root:

```bash
npx @modelcontextprotocol/inspector node workspaces/devtools/common/mcp-workspace-memory/dist/stdio.js
```

*(Note: If the server requires testing with `PROJECT_ROOT` pointing to a specific directory other than the current working directory, prepend it to the command. For example: `PROJECT_ROOT=$(pwd) npx ...`)*

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
7. The Output section will display the structured JSON response from the workspace memory retrieval. Verify that it correctly returns the folder structure, T0 front-matter, and other relevant context.
