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

### 0. `workspaces/devtools/common/node-shared/` (Reuse/Extend Existing Root Discovery)

We will reuse the existing root-discovery primitives from `@hod/aweave-node-shared` and add a small extension so callers can resolve project root without duplicating path math.

#### [MODIFY] `src/paths/devtools-root.ts`

- Keep using the existing `resolveDevtoolsRoot()` precedence contract:
  1. `AWEAVE_DEVTOOLS_ROOT` env override
  2. `cwd`
  3. `moduleDir`
- Add `resolveProjectRootFromDevtools(options?)` helper that:
  - Calls `resolveDevtoolsRoot(options)`.
  - Returns monorepo project root via `path.resolve(devtoolsRoot, '..', '..')`.
  - Returns `null` if DevTools root cannot be resolved (preserves shared failure contract).

#### [MODIFY] `src/paths/index.ts` and `src/index.ts`

- Export the new `resolveProjectRootFromDevtools()` helper.

#### [MODIFY] `resources/workspaces/devtools/common/node-shared/OVERVIEW.md`

- Document the new helper and when callers should use it.

---

### 1. `workspaces/devtools/common/cli-plugin-workspace/`

We will add a new command `aw workspace mcp` that spawns or requires the MCP STDIO server.
Since this plugin already manages workspace context, adding the MCP server command here fits perfectly.

#### [MODIFY] `package.json`

- Add `@hod/aweave-mcp-workspace-memory` to `dependencies` (workspace dependency).
- Add `@modelcontextprotocol/sdk` to `dependencies` so `StdioServerTransport` can be imported directly.

#### [NEW] `src/commands/workspace/mcp.ts`

- Create a new oclif command `WorkspaceMcp`.
- Description: "Start the Workspace Memory MCP STDIO Server".
- Flags: Add a `--project-root` flag (optional) for fallback.
- Logic: Import `createWorkspaceMemoryServer` from `@hod/aweave-mcp-workspace-memory` and `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`. Resolve project root using this deterministic order:
  1. `--project-root` (explicit absolute path)
  2. `resolveProjectRootFromDevtools({ cwd: process.cwd(), moduleDir: __dirname })` from `@hod/aweave-node-shared`
  3. If still unresolved: **fail fast** with actionable error (`set --project-root or AWEAVE_DEVTOOLS_ROOT`)
- Then initialize the server and connect STDIO transport. We intentionally do not fallback to raw `process.cwd()` to avoid silent wrong-root behavior.

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
- Document `AWEAVE_DEVTOOLS_ROOT` and `--project-root` as explicit root controls for deterministic behavior.

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

- **Explicit Verification Matrix:**
  1. Run `aw workspace mcp` from the repository root and verify it serves the expected workspace context.
  2. Run from an unrelated directory (`~`) with `AWEAVE_DEVTOOLS_ROOT` set and verify context remains correct.
  3. Run from an unrelated directory with `aw workspace mcp --project-root /path/to/repo` and verify explicit path takes priority.
  4. Run from an unrelated directory **without** overrides and verify command fails with clear remediation message.
  5. Verify no non-MCP stdout noise before JSON-RPC handshake.
- Ask the user to configure their Cursor/Codex `mcp.json` using `aw workspace mcp` (plus `AWEAVE_DEVTOOLS_ROOT` or `--project-root` when needed) or `aw-mcp-memory` and confirm tools load correctly across working directories.
