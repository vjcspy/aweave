---
name: Prefer zod/v3 with MCP registerTool to keep type safety
description: Replacing Function-cast on registerTool with native typing required aligning schema import to zod/v3 used by MCP SDK compatibility types.
category: typescript
tags: [mcp, sdk, zod, typesafety]
created: 2026-03-01
---

# Lesson

## Context

In `workspaces/devtools/common/mcp-workspace-memory/src/server.ts`, tool registration was written as `(server.registerTool as Function)(...)`.

## What Went Wrong

The cast bypassed TypeScript checks at the exact boundary where MCP tool schema and handler args must stay aligned. This hid the real typing mismatch.

## Root Cause

`@modelcontextprotocol/sdk` `registerTool` compatibility types are based on `zod/v3` (`AnySchema` uses `zod/v3` types).  
This package imported schemas from `zod`, which produced incompatible types at compile time, causing `TS2322` and `TS2589` when calling `registerTool` directly.

## Fix

- Switched schema import in `src/tools.ts` from `zod` to `zod/v3`.
- Removed `(server.registerTool as Function)` and called `server.registerTool(...)` directly.
- Rebuilt package (`pnpm -C workspaces/devtools/common/mcp-workspace-memory build`) to verify type safety and compilation.

## Guideline

When integrating MCP SDK tool registration:

1. Use Zod version-compatible imports (`zod/v3`) for input/output schemas.
2. Do not use `as Function` to bypass tool registration typing.
3. Treat type mismatch at registration as a contract issue, not a place for casting.
