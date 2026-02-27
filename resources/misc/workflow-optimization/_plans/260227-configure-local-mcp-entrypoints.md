---
title: "Configure Local MCP Entrypoints"
date: "2026-02-27"
status: "proposed"
---

# Goal Description

The user wants to configure the `@hod/aweave-mcp-workspace-memory` local MCP server to be usable without relative path (`cwd`) issues when specifying the command in AI agents like Cursor, Codex, and Antigravity.
Currently, using `node <relative-path>` or `npx <package>` is prone to "module not found" errors when the AI agent is opened in different directories.

We will implement two robust approaches to solve this:

1. **Approach 1: Unified CLI Entrypoint (`aw workspace mcp`)**: Integrate the MCP server into the existing `aw` CLI via the `@hod/aweave-plugin-workspace` plugin.
2. **Approach 2: Global Binary (`aw-mcp-memory`)**: Expose the MCP server directly as a global system binary.

## Proposed Changes

### 1. `workspaces/devtools/common/cli-plugin-workspace/`

We will add a new command `aw workspace mcp` that spawns or requires the MCP STDIO server.
Since this plugin already manages workspace context, adding the MCP server command here fits perfectly.

#### [NEW] `src/commands/workspace/mcp.ts`

- Create a new oclif command `WorkspaceMcp`.
- Description: "Start the Workspace Memory MCP STDIO Server".
- Logic: Import `dist/stdio.js` from `@hod/aweave-mcp-workspace-memory` or execute it as a child process. Since we are in the same monorepo and `dist` is published, we can either directly import the core logic or just execute the node script. For a clean integration, we will dynamically import the `stdio.js` script so it runs in the current process, connecting to STDIO.

#### [MODIFY] `resources/workspaces/devtools/common/cli-plugin-workspace/OVERVIEW.md`

- Update the "Public Surface" section to document the new `aw workspace mcp` command.

---

### 2. `workspaces/devtools/common/mcp-workspace-memory/`

We will make the package itself executable globally.

#### [MODIFY] `src/stdio.ts`

- Add the `#!/usr/bin/env node` shebang at the top of the file so it can be executed directly by the OS.

#### [MODIFY] `package.json`

- Add the `"bin"` field:

  ```json
  "bin": {
    "aw-mcp-memory": "./dist/stdio.js"
  }
  ```

#### [MODIFY] `resources/workspaces/devtools/common/mcp-workspace-memory/OVERVIEW.md`

- Document the new global binary output `aw-mcp-memory`.

---

### 3. Documentation

#### [MODIFY] `resources/workspaces/devtools/common/mcp-workspace-memory/_documentations/260226-configure-local-mcp-for-cursor-codex-antigravity.md`

- Rewrite the configuration instructions to use the two new approaches:
  1. `aw workspace mcp` (Recommended for `aw` CLI users).
  2. `aw-mcp-memory` (Fallback/Alternative).
- Deprecate the old relative path approach.

---

## Verification Plan

### Automated/Local Tests

1. **Build Packages:**
   - Run `pnpm install` and `pnpm build` in `workspaces/devtools/common/mcp-workspace-memory`.
   - Run `pnpm install` and `pnpm build` in `workspaces/devtools/common/cli-plugin-workspace`.
   - Run `pnpm install` and `pnpm build` in `workspaces/devtools/common/cli`.
2. **Test Approach 1 (CLI Command):**
   - Run `bin/dev.js workspace mcp` inside the CLI package or `aw workspace mcp` globally.
   - Verify it starts listening on STDIO (it should hang waiting for MCP JSON-RPC messages and not exit immediately).
3. **Test Approach 2 (Global Binary):**
   - Run `pnpm link --global` inside `workspaces/devtools/common/mcp-workspace-memory`.
   - Run `aw-mcp-memory` from any directory.
   - Verify it starts listening on STDIO.

### Manual Verification

- Ask the user to configure their Cursor/Codex `mcp.json` using `aw workspace mcp` or `aw-mcp-memory` and confirm the tools are loaded correctly regardless of the current working directory.
