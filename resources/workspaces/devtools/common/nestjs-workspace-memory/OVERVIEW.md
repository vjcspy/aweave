---
name: NestJS Workspace Memory
description: NestJS feature module wrapping the workspace-memory core library — provides REST endpoints and MCP SSE transport for workspace context retrieval
tags: [memory, nestjs, mcp, workspace, context]
---

# NestJS Workspace Memory (`@hod/aweave-nestjs-workspace-memory`)

> **Branch:** master
> **Last Commit:** 2b6635f
> **Last Updated:** 2026-02-26

## TL;DR

NestJS feature module that exposes workspace context via REST API (`GET /workspace/context`) and MCP over SSE transport. Uses `createWorkspaceMemoryServer()` from `@hod/aweave-mcp-workspace-memory` for MCP (tool defs and handlers live there). Registered in `@hod/aweave-server` as part of the main application.

## Recent Changes Log

Initial Documentation — package created as part of Long-term Memory Phase 1 implementation.

## Repo Purpose & Bounded Context

- **Role:** Server-side integration layer for workspace memory — bridges core library to REST and MCP consumers
- **Domain:** Developer tooling — AI agent context infrastructure

## Project Structure

```
nestjs-workspace-memory/
├── package.json                       # @hod/aweave-nestjs-workspace-memory
├── tsconfig.json
└── src/
    ├── index.ts                       # Barrel exports
    ├── workspace-memory.module.ts     # NestJS module (controllers + providers)
    ├── workspace-memory.service.ts    # Wraps core getContext(), resolves project root
    ├── workspace-memory.controller.ts # REST: GET /workspace/context
    ├── mcp-tools.service.ts           # MCP Server with workspace_get_context tool
    ├── mcp.controller.ts              # SSE transport: GET /mcp/sse, POST /mcp/messages
    └── dto/
        ├── index.ts                   # DTO barrel
        └── get-context.dto.ts         # Query + response DTOs with Swagger decorators
```

## Public Surface (Inbound)

- **REST API**
  - `GET /workspace/context` — Query params: workspace (required), domain, repository, topics, include_defaults, filter_status, filter_tags, filter_category
- **MCP Tool (SSE)**
  - `workspace_get_context` — Same parameters as REST, exposed via MCP protocol over SSE transport
  - SSE endpoint: `GET /mcp/sse` — Establishes MCP session
  - Message handler: `POST /mcp/messages?sessionId=` — Handles MCP requests

## Core Services & Logic (Internal)

- **WorkspaceMemoryService:** Injectable service wrapping core `getContext()`. Resolves project root from `process.cwd()` (3 levels up from devtools workspace). Provides `parseTopics()` helper for comma-separated topic strings.
- **McpToolsService:** Manages MCP `Server` instance (created via `createWorkspaceMemoryServer()` from mcp-workspace-memory) with SSE transports. Handles per-session transport lifecycle (create on SSE connect, cleanup on disconnect). Tool definitions and handlers live in `@hod/aweave-mcp-workspace-memory`.
- **WorkspaceMemoryController:** REST controller with Swagger-documented endpoint. Delegates to service, wraps response in `{ success, data }` envelope.
- **McpController:** Thin controller routing SSE and message HTTP endpoints to `McpToolsService`.

## External Dependencies & Contracts (Outbound)

- **`@hod/aweave-workspace-memory`** — Core context retrieval logic
- **`@hod/aweave-mcp-workspace-memory`** — Shared MCP tool definitions, handlers, and server factory
- **`@hod/aweave-nestjs-core`** — Shared NestJS infrastructure
- **`@modelcontextprotocol/sdk`** — SSE transport
- **`@nestjs/swagger`** — API documentation decorators

## Related

- **Core Library:** `workspaces/devtools/common/workspace-memory/`
- **MCP Layer:** `workspaces/devtools/common/mcp-workspace-memory/`
- **CLI Plugin:** `workspaces/devtools/common/cli-plugin-workspace/`
- **Server Registration:** `workspaces/devtools/common/server/src/app.module.ts`
- **Implementation Plan:** `resources/misc/workflow-optimization/_plans/260225-long-term-memory-phase1.md`
