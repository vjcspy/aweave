---
name: Fix workspace_get_context tool description and projectRoot resolution
description: Fix two bugs — tool description making topics feel required, and broken projectRoot resolution using hardcoded relative path instead of resolveProjectRootFromDevtools.
status: new
created: 2026-03-01
tags: [mcp, memory, bugfix]
---

# 260301 — Fix workspace_get_context tool description and projectRoot resolution

## References

- `workspaces/devtools/common/mcp-workspace-memory/src/tools.ts` — Tool schema + description
- `workspaces/devtools/common/nestjs-workspace-memory/src/workspace-memory.service.ts` — NestJS service with broken projectRoot
- `workspaces/devtools/common/nestjs-workspace-memory/src/mcp-tools.service.ts` — MCP service with broken projectRoot
- `workspaces/devtools/common/node-shared/src/paths/devtools-root.ts` — Existing `resolveProjectRootFromDevtools` utility
- `workspaces/devtools/common/cli-plugin-workspace/src/commands/workspace/mcp.ts` — Reference usage of resolveProjectRootFromDevtools

## Problem

### Issue 1: Tool description makes `topics` feel required

The tool description groups `topics` with scope params in the sentence "MUST detect workspace/domain/repository/topics
from concrete evidence. NEVER guess missing scope or topic values." This instructs the AI to always detect topics,
making it behave as if topics is a required field even though the schema marks only `workspace` as required.

### Issue 2: projectRoot resolves to wrong directory

Both `WorkspaceMemoryService` and `McpToolsService` use:

```typescript
resolve(process.cwd(), '..', '..', '..')
```

Server CWD is `/Users/kai/work/aweave/workspaces/devtools` (2 levels from project root). Going up 3 levels produces
`/Users/kai/work` instead of `/Users/kai/work/aweave`. All resource paths then point to non-existent directories,
causing every scan to return empty results silently.

## Plan

### Step 1: Fix tool description (Issue 1)

**File:** `workspaces/devtools/common/mcp-workspace-memory/src/tools.ts`

Rewrite the `description` field to clearly separate required vs optional:

- `workspace` is always required
- `domain`, `repository`, `topics` are optional — only pass when detected from user context
- Calling without topics returns defaults (structural orientation)

### Step 2: Fix projectRoot resolution (Issue 2)

**2a.** Add `@hod/aweave-node-shared` dependency to `nestjs-workspace-memory/package.json`

**2b.** Replace hardcoded relative path in both files, following the pattern from
`cli-plugin-workspace/src/commands/workspace/mcp.ts`:

- `workspace-memory.service.ts`:
- `mcp-tools.service.ts`:

Both files MUST use the same implementation pattern:

```typescript
const projectRoot = resolveProjectRootFromDevtools({
  cwd: process.cwd(),
  moduleDir: __dirname,
});

if (!projectRoot) {
  throw new Error(
    'Could not resolve project root. Set AWEAVE_DEVTOOLS_ROOT or run from within the aweave workspace.',
  );
}
```

### Step 3: Build and verify

Build order (respecting dependency chain):

1. Build `mcp-workspace-memory` (tool description change from Step 1)
2. Build `nestjs-workspace-memory` (projectRoot fix from Step 2)
3. Restart server

Verification checklist:

- [ ] Call `workspace_get_context` with `workspace: devtools, domain: common, topics: ["plans"]` → verify non-empty
  `plans.entries` (Issue 2)
- [ ] Verify updated MCP tool descriptor shows new description clearly separating required vs optional fields (Issue 1)
