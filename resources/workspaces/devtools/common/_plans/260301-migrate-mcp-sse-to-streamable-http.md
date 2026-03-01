---
name: Migrate MCP Transport from SSE to Streamable HTTP
description: Replace deprecated SSEServerTransport with StreamableHTTPServerTransport in NestJS workspace memory package, update MCP config, and align all documentation.
status: done
created: 2026-03-01
tags: [mcp, nestjs, migration, memory]
---

# 260301 — Migrate MCP Transport from SSE to Streamable HTTP

## References

- `workspaces/devtools/common/nestjs-workspace-memory/src/mcp-tools.service.ts` — Current SSE transport implementation
- `workspaces/devtools/common/nestjs-workspace-memory/src/mcp.controller.ts` — Current 2-endpoint SSE controller
- `workspaces/devtools/common/mcp-workspace-memory/src/server.ts` — MCP server factory (transport-agnostic)
- `.cursor/mcp.json` — Cursor MCP client config
- `resources/workspaces/devtools/common/_features/workflow-optimization/long-term-memory.md` — Feature spec
- `agent/skills/common/mcp-builder/reference/node_mcp_server.md` — Streamable HTTP reference
- MCP SDK: `@modelcontextprotocol/sdk@1.27.1` — already includes `StreamableHTTPServerTransport`

## Context

MCP SDK deprecated `SSEServerTransport` as of spec version 2025-03-26. The replacement is `StreamableHTTPServerTransport` (Streamable HTTP protocol):

| Aspect | SSE (deprecated) | Streamable HTTP (new) |
|--------|-------------------|-----------------------|
| Endpoints | 2: `GET /mcp/sse` + `POST /mcp/messages` | 1: `POST /mcp` (stateless mode — no GET/DELETE needed) |
| Session management | Client-managed via SSE sessionId | Optional — stateless mode available (`sessionIdGenerator: undefined`) |
| Server-side state | Transport map keyed by sessionId | Stateless: new transport per request (or stateful with session generator) |
| Client config | `{ "type": "sse", "url": "http://host/mcp" }` | `{ "url": "http://host/mcp" }` (remove `type`) |

The `@modelcontextprotocol/sdk@1.27.1` already ships `StreamableHTTPServerTransport` at `@modelcontextprotocol/sdk/server/streamableHttp.js`. No dependency upgrade needed.

## Objective

Replace the deprecated 2-endpoint SSE transport with the single-endpoint Streamable HTTP transport in the NestJS workspace memory package. Update all configuration and documentation to match.

## Scope

### In scope

- NestJS MCP transport layer (`mcp-tools.service.ts`, `mcp.controller.ts`)
- Cursor MCP client config (`.cursor/mcp.json`)
- All documentation referencing SSE endpoints or transport

### Out of scope

- Core package (`workspace-memory`) — transport-agnostic, no changes
- MCP package (`mcp-workspace-memory`) — `createWorkspaceMemoryServer()` returns a `Server` instance, transport is wired by consumers. No changes unless we want to add a convenience helper.
- CLI STDIO transport (`aw workspace mcp`) — uses `StdioServerTransport`, unrelated
- MCP SDK upgrade — already on v1.27.1 which includes Streamable HTTP

## Implementation Steps

### Step 1: Update `mcp-tools.service.ts`

Replace `SSEServerTransport` with `StreamableHTTPServerTransport`.

**Current** (2-endpoint, session map):

```typescript
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

private transports = new Map<string, SSEServerTransport>();

async handleSseConnection(req, res) {
  const transport = new SSEServerTransport('/mcp/messages', res);
  this.transports.set(transport.sessionId, transport);
  res.on('close', () => this.transports.delete(transport.sessionId));
  await this.server.connect(transport);
}

async handleMessage(req, res, sessionId) {
  const transport = this.transports.get(sessionId);
  await transport.handlePostMessage(req, res);
}
```

**Target** (single-endpoint, stateless):

```typescript
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

async handleRequest(req, res) {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => transport.close());
  await this.server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
```

Key changes:
- Remove `transports` Map and session tracking
- Remove `handleSseConnection` and `handleMessage` methods
- Add single `handleRequest` method
- Stateless mode: `sessionIdGenerator: undefined`

### Step 2: Update `mcp.controller.ts`

Replace 2 endpoints with a single endpoint.

**Current:**

```typescript
@Get('sse')
async sse(@Req() req, @Res() res) { ... }

@Post('messages')
async messages(@Req() req, @Res() res, @Query('sessionId') sessionId) { ... }
```

**Target** (stateless — POST-only):

```typescript
@Post()
async handle(@Req() req, @Res() res) {
  await this.mcpTools.handleRequest(req, res);
}
```

The `@Controller('mcp')` prefix stays the same, so the endpoint is `POST /mcp`. In stateless mode (`sessionIdGenerator: undefined`), only POST is needed:
- **POST** handles all client requests and responses (required).
- **GET** is only for server-initiated notifications via standalone SSE stream (not needed — we don't push notifications to clients).
- **DELETE** is for session termination (N/A in stateless mode — no sessions to terminate).

> **Note:** NestJS auto-parses JSON bodies. Pass `req.body` as the third argument to `transport.handleRequest()` to avoid double-parsing.

### Step 3: Update `.cursor/mcp.json`

**Current:**

```json
{
  "workspace-memory": {
    "type": "sse",
    "url": "http://127.0.0.1:3456/mcp"
  }
}
```

**Target:**

```json
{
  "workspace-memory": {
    "url": "http://127.0.0.1:3456/mcp"
  }
}
```

Remove `"type": "sse"` — URL stays the same (`/mcp`). Cursor auto-detects Streamable HTTP when no `type` is specified (same pattern as playwright: `"url": "http://localhost:8931/mcp"`).

### Step 4: Verify

- Start NestJS server (`aw server start`)
- Confirm `workspace_get_context` tool works via Cursor MCP integration
- Smoke check: call tool 2-3 times consecutively to confirm `server.connect()` lifecycle is stable across multiple requests
- Test with MCP Inspector: `npx @modelcontextprotocol/inspector --transport http --server-url http://127.0.0.1:3456/mcp`
- Verify CLI STDIO path still works: `aw workspace mcp` (should be unaffected)

### Step 5: Update documentation

All SSE references need updating across documentation files:

| # | File | Changes |
|---|------|---------|
| 1 | `resources/workspaces/devtools/common/_features/workflow-optimization/long-term-memory.md` | §2.14: "SSE/MCP" → "Streamable HTTP/MCP". §2.15 rationale: "SSE transport" → "Streamable HTTP transport". §8.3: "SSE transport" → "Streamable HTTP transport". §8.4: "MCP SSE transport" → "MCP Streamable HTTP transport". §8.7: update config example. |
| 2 | `resources/workspaces/devtools/common/nestjs-workspace-memory/OVERVIEW.md` | "MCP over SSE transport" → "MCP over Streamable HTTP transport". Update endpoint docs from `GET /mcp/sse` + `POST /mcp/messages` to `POST /mcp`. |
| 3 | `resources/workspaces/devtools/common/mcp-workspace-memory/OVERVIEW.md` | "SSE transport" → "Streamable HTTP transport" in NestJS usage description. |
| 4 | `resources/workspaces/devtools/common/_documentations/260226-configure-local-mcp-for-cursor-codex-antigravity.md` | Update Cursor config example. Replace SSE endpoint URL and type. |
| 5 | `resources/workspaces/devtools/common/_documentations/testing-with-inspector.md` | Update inspector command from `http://127.0.0.1:3456/mcp/sse` to `http://127.0.0.1:3456/mcp`. |
| 6 | `resources/workspaces/devtools/common/_plans/260225-long-term-memory-phase1.md` | Historical plan — add note at top: "Note: MCP transport migrated from SSE to Streamable HTTP per plan 260301." Leave body unchanged as historical record. |

## Key Decision: Singleton Server + New Transport Per Request

Current code creates one `Server` in `onModuleInit`. With stateless Streamable HTTP, each request creates a new transport and calls `server.connect(transport)`.

**Decision:** Keep singleton `Server`, create new `StreamableHTTPServerTransport` per request.

**Evidence:** MCP SDK reference (`agent/skills/common/mcp-builder/reference/node_mcp_server.md` lines 717-741) shows this exact pattern as the canonical approach:

```typescript
// Singleton server created once
const server = new McpServer({ name: '...', version: '...' });

// Per-request: new transport, connect, handle
app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

This confirms the SDK `Server` supports multiple sequential `connect()` calls by design.

## Risks & Considerations

1. **NestJS body parsing:** `StreamableHTTPServerTransport.handleRequest` expects raw body or pre-parsed JSON. NestJS auto-parses JSON bodies. Pass `req.body` as the third argument to avoid double-parsing.
2. **Cursor client compatibility:** Cursor must support Streamable HTTP. The playwright MCP server already uses this pattern (`"url": "http://localhost:8931/mcp"`) confirming Cursor client support.
3. **No backward compatibility needed:** The SSE endpoint is only used locally by Cursor. No external consumers. Clean cutover is safe.
