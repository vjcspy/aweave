# CLI Shared Utilities (`@aweave/cli-shared`)

> **Source:** `devtools/common/cli-shared/`
> **Last Updated:** 2026-02-07

Pure utility library cho toàn bộ `aw` CLI ecosystem. Package này **không chứa CLI framework nào** (không oclif, không commander) — chỉ chứa các utility functions và models mà cả main CLI (`@aweave/cli`) và tất cả plugins (`@aweave/cli-plugin-*`) đều sử dụng.

## Purpose

- **MCP Response Format** — Chuẩn hóa JSON output cho tất cả CLI commands. AI agents parse format này để xử lý kết quả.
- **HTTP Client** — Base HTTP client với error handling, dùng native `fetch` (Node 18+).
- **Output Helpers** — Consistent formatting (JSON/Markdown), readable content mode cho AI agents.
- **Content Reading** — Pattern `--file` / `--content` / `--stdin` dùng chung cho mọi command nhận input.
- **pm2 Service Management** — Utilities cho health check, process management qua pm2.

**Tại sao tách thành package riêng?** Để tránh cyclic dependencies. Nếu utilities nằm trong main CLI (`@aweave/cli`), thì plugins phải depend on main CLI, mà main CLI cũng depend on plugins → cycle. Với `@aweave/cli-shared` là leaf dependency, không có cycle:

```
@aweave/cli-shared (leaf — no CLI framework dependency)
     ↑                    ↑
     |                    |
@aweave/cli          @aweave/cli-plugin-*
(depends on shared)  (depends on shared only)
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    @aweave/cli-shared                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  mcp/                          http/                         │
│  ├── response.ts               └── client.ts                 │
│  │   MCPResponse                   HTTPClient                │
│  │   MCPContent                    HTTPClientError            │
│  │   MCPError                                                │
│  │   ContentType enum                                        │
│  └── pagination.ts                                           │
│      createPaginatedResponse()                               │
│                                                              │
│  helpers/                      services/                     │
│  ├── output.ts                 └── pm2.ts                    │
│  │   output()                      checkPm2Process()         │
│  │   errorResponse()               checkHealth()             │
│  │   handleServerError()           runCommand()              │
│  └── content.ts                    startPm2()                │
│      readContent()                 stopPm2()                 │
│                                    waitForHealthy()          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Dependencies

| Package | Role |
|---------|------|
| (none) | Không có runtime dependencies — chỉ dùng Node.js built-ins |

**devDependencies:** `@types/node`, `typescript`

**Key design:** Zero external dependencies. HTTP client dùng native `fetch`. UUID dùng `crypto.randomUUID()`. Filesystem dùng `fs`. Điều này giữ package nhẹ và tránh dependency conflicts.

## Exposed Exports

```typescript
// MCP Response Format
export { ContentType, MCPContent, MCPError, MCPResponse } from './mcp';
export { createPaginatedResponse } from './mcp';
export type { MCPContentData, MCPErrorData, MCPResponseData } from './mcp';

// HTTP Client
export { HTTPClient, HTTPClientError } from './http';
export type { HTTPClientOptions } from './http';

// CLI Helpers
export { output, errorResponse, handleServerError } from './helpers';
export { readContent } from './helpers';
export type { ContentInput, ContentResult } from './helpers';

// pm2 Service Management
export { checkPm2Process, checkHealth, runCommand, startPm2, stopPm2, waitForHealthy } from './services';
```

### MCP Response Format (Contract)

Tất cả CLI commands output JSON theo format này. **Đây là contract với AI agent ecosystem** — thay đổi phải backward-compatible.

**Success:**
```json
{
  "success": true,
  "content": [
    { "type": "json", "data": { ... } }
  ],
  "metadata": { "message": "..." },
  "has_more": false,
  "total_count": 10
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "suggestion": "Use 'aw docs list' to see available documents"
  }
}
```

Content types: `json` (structured data) hoặc `text` (plain text message).

### Output Helpers

| Function | Description |
|----------|-------------|
| `output(response, format, readableContent?)` | Print MCPResponse as JSON or Markdown. `readableContent=true` unescapes `\n` → real newlines cho AI agent readability |
| `errorResponse(code, message, suggestion?)` | Create error MCPResponse |
| `handleServerError(error, format)` | Output error and `process.exit()` with appropriate code |

**Exit codes:** `2` = not found, `3` = server/db error, `4` = invalid input, `5` = action not allowed, `6` = auth failed.

### Content Reading

`readContent({ file?, content?, stdin? })` — Shared pattern cho `--file` / `--content` / `--stdin` input. Returns `{ content }` or `{ error: MCPResponse }`. Validates exactly one source provided.

### HTTP Client

`HTTPClient` — Wrapper around native `fetch` with:
- Base URL composition
- Basic auth and Bearer token headers
- Timeout via `AbortController`
- Error mapping: HTTP status → `HTTPClientError` with code, message, suggestion
- Methods: `get()`, `post()`, `put()`, `delete()`, `getUrl()` (for absolute URLs like pagination links)

## Project Structure

```
devtools/common/cli-shared/
├── package.json                    # @aweave/cli-shared (no bin, no CLI framework)
├── tsconfig.json
└── src/
    ├── index.ts                    # Barrel exports
    ├── mcp/
    │   ├── response.ts            # MCPResponse, MCPContent, MCPError, ContentType
    │   ├── pagination.ts          # createPaginatedResponse()
    │   └── index.ts
    ├── http/
    │   ├── client.ts              # HTTPClient, HTTPClientError
    │   └── index.ts
    ├── helpers/
    │   ├── output.ts              # output(), errorResponse(), handleServerError()
    │   ├── content.ts             # readContent()
    │   └── index.ts
    └── services/
        ├── pm2.ts                 # pm2 utilities
        └── index.ts
```

## Development

```bash
cd devtools/common/cli-shared

# Build (must be built FIRST — all other CLI packages depend on this)
pnpm build

# Dev mode
pnpm dev   # tsc --watch
```

**Build order:** `cli-shared` → plugins (`cli-plugin-*`) → `cli` (main)

## Related

- **Main CLI:** `devtools/common/cli/` — oclif entrypoint, consumes this package
- **Main CLI Overview:** `devdocs/misc/devtools/common/cli/OVERVIEW.md`
- **Debate Plugin:** `devtools/common/cli-plugin-debate/`
- **Docs Plugin:** `devtools/common/cli-plugin-docs/`
- **Bitbucket Plugin:** `devtools/tinybots/cli-plugin-bitbucket/`
- **Architecture Plan:** `devdocs/misc/devtools/plans/260207-cli-oclif-refactor.md`
- **Global DevTools Overview:** `devdocs/misc/devtools/OVERVIEW.md`
