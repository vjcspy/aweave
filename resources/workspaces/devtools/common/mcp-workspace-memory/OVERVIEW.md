---
name: MCP Workspace Memory
description: Shared MCP layer for workspace memory tools — provides transport-agnostic tool definitions, handlers, server factory, and a STDIO entry point for local AI agent access
tags: [mcp, memory, workspace, stdio, context]
---

# MCP Workspace Memory (`@hod/aweave-mcp-workspace-memory`)

> **Branch:** master
> **Last Commit:** 2b6635f
> **Last Updated:** 2026-02-26

## TL;DR

Transport-agnostic MCP layer that owns tool definitions and handler logic for workspace memory. Provides a `createWorkspaceMemoryServer(projectRoot)` factory consumed by both the NestJS SSE transport and the built-in STDIO transport. The STDIO entry point (`dist/stdio.js`) allows Cursor and other local AI agents to use workspace memory tools without running a server.

## Recent Changes Log

Initial Documentation — package created to extract shared MCP definitions from `nestjs-workspace-memory` and add STDIO transport support.

## Repo Purpose & Bounded Context

- **Role:** Shared MCP tool definitions + transport-agnostic server factory + STDIO transport for local AI agent access
- **Domain:** Developer tooling — AI agent context infrastructure

## Project Structure

```
mcp-workspace-memory/
├── package.json                  # @hod/aweave-mcp-workspace-memory
├── tsconfig.json
└── src/
    ├── index.ts                  # Barrel exports (server factory, handlers, tool defs)
    ├── tools.ts                  # WORKSPACE_TOOLS — single source of truth for tool definitions
    ├── handlers.ts               # handleToolCall() — param parsing + core delegation
    ├── server.ts                 # createWorkspaceMemoryServer() — transport-agnostic factory
    └── stdio.ts                  # STDIO entry point (Cursor spawns this via mcp.json)
```

## Public Surface (Inbound)

- **Library exports** (for NestJS and other consumers)
  - `createWorkspaceMemoryServer(projectRoot)` — returns a configured MCP `Server` with all tools registered
  - `handleToolCall(projectRoot, toolName, args)` — direct handler invocation (bypasses MCP protocol)
  - `WORKSPACE_TOOLS` — tool definition array (name, description, inputSchema)
- **STDIO entry point** (`dist/stdio.js`)
  - Spawned by Cursor via `.cursor/mcp.json` config
  - Reads `PROJECT_ROOT` env var or falls back to `process.cwd()`

## Core Services & Logic (Internal)

- **tools.ts:** Single source of truth for MCP tool definitions. Currently defines `workspace_get_context` with scope, topics, filters, and include_defaults parameters. Adding a new tool = adding an entry here + a case in handlers.
- **handlers.ts:** Routes tool calls by name to handler functions. Each handler parses MCP string params (comma-separated lists) into typed args and delegates to core `getContext()`. Returns MCP-compliant `{ content, isError }` responses.
- **server.ts:** Factory function that creates an MCP `Server` instance, wires `ListTools` and `CallTool` request handlers, and returns the server without connecting any transport. Consumer decides transport (STDIO, SSE, etc.).
- **stdio.ts:** Standalone entry point that creates the server and connects `StdioServerTransport`. Not imported by any other module — only executed directly as a process.

## External Dependencies & Contracts (Outbound)

- **`@hod/aweave-workspace-memory`** — Core context retrieval logic (`getContext()`)
- **`@modelcontextprotocol/sdk`** — MCP `Server` class, `StdioServerTransport`, request schemas

## Related

- **Core Library:** `workspaces/devtools/common/workspace-memory/`
- **NestJS Consumer:** `workspaces/devtools/common/nestjs-workspace-memory/` (uses `createWorkspaceMemoryServer` for SSE transport)
- **CLI Plugin:** `workspaces/devtools/common/cli-plugin-workspace/`
- **Cursor Config:** `.cursor/mcp.json` (STDIO transport entry)
- **Implementation Plan:** `resources/misc/workflow-optimization/_plans/260225-long-term-memory-phase1.md`
