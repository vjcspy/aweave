---
name: Dashboard Web Log Viewer
description: Rewrite the web dashboard (dashboard-web + nestjs-dashboard) log viewer to work with the new date-based file logger from node-shared, adding name/date/level filters, server-side pagination, file merging for "all", and live SSE tail.
status: done
created: 2026-03-01
tags:
  - dashboard
  - logging
  - nestjs
  - frontend
---

# 260301 — Dashboard Web Log Viewer

## References

- `resources/workspaces/devtools/common/node-shared/OVERVIEW.md` — logger factory, file naming convention
- `resources/workspaces/devtools/common/_plans/260301-shared-logger-node-shared.md` — the logger migration that changed file naming
- `resources/workspaces/devtools/common/_plans/260301-log-file-date-based-naming.md` — pino-roll Extension Last Format
- `resources/workspaces/devtools/common/dashboard-web/OVERVIEW.md`
- `resources/workspaces/devtools/common/nestjs-dashboard/OVERVIEW.md`
- `workspaces/devtools/common/nestjs-dashboard/src/services/logs.service.ts`
- `workspaces/devtools/common/nestjs-dashboard/src/controllers/logs.controller.ts`
- `workspaces/devtools/common/nestjs-dashboard/src/dtos/logs.dto.ts`
- `workspaces/devtools/common/dashboard-web/src/components/LogsView.tsx`
- `workspaces/devtools/common/dashboard-web/src/App.tsx`

## Problem

The web dashboard log viewer (`dashboard-web` + `nestjs-dashboard`) is broken after the shared logger migration:

1. **Backend hardcoded to `server.jsonl`** — `LogsService` reads from `~/.aweave/logs/server.jsonl` which no longer exists. The new logger produces date-based files per service.
2. **No multi-source support** — the system only knew about one log file. Now there are many: `cli`, `nestjs-server`, `mcp-workspace-memory`, `cli-plugin-*`, etc.
3. **No date awareness** — log files are now date-partitioned (`{name}.{date}.{count}.log`), but the backend has no concept of dates.

### New Log File Convention (from node-shared)

| Mode | All-levels pattern | Error-only pattern | Example |
|------|-------------------|--------------------|---------|
| Async (long-running) | `{name}.{date}.{count}.log` | `{name}.{date}.{count}.error.log` | `nestjs-server.2026-03-01.1.log` |
| Sync (CLI) | `{name}.{date}.log` | `{name}.error.{date}.log` | `cli.2026-03-01.log` |

Directory: `~/.aweave/logs/` (overridable via `LOG_DIR` env var).

Each line is JSONL (pino format):

```json
{"level":30,"time":1709294102582,"service":"nestjs-server","msg":"Server started","context":"NestApplication"}
```

Fields: `level` (number), `time` (unix ms), `service` (string), `msg` (string), `context?`, `correlationId?`, `pid?`, `hostname?`, plus arbitrary extra fields.

## Objective

Rewrite the web dashboard log viewer with:

1. **Name filter** (required) — dropdown of discovered log source names + "All" option
2. **Date filter** (required) — single date picker, defaults to today
3. **Level filter** — all / trace / debug / info / warn / error / fatal
4. **Search** — free-text search on message content
5. **Server-side pagination** — 500 entries per page with "Load more" button
6. **Merge for "all"** — when name = "all", merge all log files for the selected date, sorted by timestamp
7. **Live SSE tail** — real-time streaming of new log entries, respecting current name/date filter
8. **Beautiful UI** — consistent with existing glassmorphism theme

## Design Decisions

### File Scanning Strategy

Parse filenames in `~/.aweave/logs/` using regex to extract `(name, date, count?)`:

- Async pattern: `/^(.+?)\.(\d{4}-\d{2}-\d{2})\.(\d+)\.log$/`
- Sync pattern: `/^(.+?)\.(\d{4}-\d{2}-\d{2})\.log$/`
- Skip `.error.` files — level filter on main files is sufficient (requirement #5)

### Pagination Strategy

Cursor-based pagination using `beforeTime` to navigate backwards from the most recent entries. This aligns naturally with the UX: initial load returns the **latest** N entries (tail), and "Load more" fetches older entries by passing the `time` of the oldest entry in the current view as `beforeTime`.

- **Default query** (no cursor): returns the most recent `limit` entries, sorted `time` ascending within the page.
- **"Load more" query** (`cursor=<opaque>`): returns the `limit` entries immediately before the cursor, sorted ascending.
- Response includes `hasMore: boolean` and `nextCursor: string | null` for the next page.
- No `total` field needed — we don't count all lines (expensive for large files).

**Opaque cursor with tie-breaker:** The cursor is a base64-encoded JSON object `{time: number, skip: number}` where `skip` indicates how many entries at exactly that `time` have already been returned. This handles the case where multiple entries share the same millisecond timestamp (common in log bursts). The client treats the cursor as an opaque string and passes it back unchanged.

For "all" name: read all matching files for the date, merge into a single stream sorted by `time` field, then apply cursor/limit. This is bounded by single-day log volume which is manageable.

**Why not offset-based:** Offset pagination with ascending sort returns oldest entries first at `offset=0`. This conflicts with the UX requirement of showing latest entries and loading older ones. A `from=tail` mode could work but adds complexity vs. a clean cursor approach.

### SSE Streaming

The SSE endpoint watches the `~/.aweave/logs/` directory for changes. When a matching file is modified (based on current name + today's date), it reads the new bytes and emits entries. For "all" name, it watches all files matching today's date.

SSE only applies when `date` equals today. **The frontend is responsible for not opening an `EventSource` when viewing a historical date.** The backend does not need to handle non-today SSE requests — if the frontend sends one, it simply returns no events (the watched files won't change). This avoids protocol ambiguity between HTTP status codes and SSE event types.

### Error File Exclusion

Error-only files (`.error.log`) are duplicates of entries already in the main log files. We skip them entirely and rely on the level filter in the main files.

## API Design

### New Endpoints

#### `GET /logs/sources`

List available log source names and their date ranges.

```typescript
// Response
{
  success: true,
  data: [
    { name: "nestjs-server", dates: ["2026-03-01", "2026-02-28"], latestDate: "2026-03-01" },
    { name: "cli", dates: ["2026-03-01"], latestDate: "2026-03-01" },
    { name: "mcp-workspace-memory", dates: ["2026-03-01"], latestDate: "2026-03-01" },
    ...
  ]
}
```

#### `GET /logs/query`

Query log entries with cursor-based pagination. Default (no cursor) returns the **latest** entries (tail behavior).

```
GET /logs/query?name=nestjs-server&date=2026-03-01&level=info&search=started&limit=500
GET /logs/query?name=all&date=2026-03-01&limit=500
GET /logs/query?name=nestjs-server&date=2026-03-01&cursor=eyJ0aW1lIjoxNzA5Mjk0MTAyNTgyLCJza2lwIjoyfQ&limit=500
```

| Param | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Log source name or `"all"` |
| `date` | Yes | Date string `YYYY-MM-DD` |
| `level` | No | Minimum level: `trace`/`debug`/`info`/`warn`/`error`/`fatal` |
| `search` | No | Case-insensitive substring match on `msg` |
| `cursor` | No | Opaque cursor string from previous response's `nextCursor`. Omit for initial load (returns latest page). |
| `limit` | No | Max entries to return (default: 500, max: 2000) |

```typescript
// Response
{
  success: true,
  data: LogEntryDto[],   // sorted by time ascending within the page
  pagination: {
    limit: number,
    returned: number,
    hasMore: boolean,       // true if older entries exist before this page
    nextCursor: string | null,  // opaque cursor for "load more" (null when no more pages)
  }
}
```

The `nextCursor` is a base64-encoded `{time, skip}` object. `time` is the timestamp of the oldest entry in the current page, and `skip` is the count of entries at that exact `time` that were included. The backend decodes this to resume pagination without losing or duplicating entries when multiple entries share the same millisecond timestamp.

```

`LogEntryDto` extends current shape — no breaking changes, just add `source` field:

```typescript
interface LogEntryDto {
  level: number;
  time: number;
  msg: string;
  context?: string;
  correlationId?: string;
  service?: string;
  source?: string;     // NEW: log file name prefix (useful when name=all)
  meta?: Record<string, unknown>;
}
```

#### `GET /logs/stream` (updated)

SSE stream with query params for filtering. **Frontend must only connect when `date` is today.**

```
GET /logs/stream?name=nestjs-server
GET /logs/stream?name=all
```

No `date` param needed — SSE always watches today's files. If the frontend is viewing a historical date, it must not open an `EventSource` at all. The backend always returns `200` with SSE headers and watches for new log entries matching the `name` filter.

The `source` field is included in each emitted entry so the frontend can identify which log file the entry came from (especially useful when `name=all`).

### Deprecated Endpoints

- `GET /logs/tail` — replaced by `/logs/query`. Remove after frontend migration.

## Implementation Plan

### Phase 1: Backend — Log Discovery & Query

**Files to modify:**

- `nestjs-dashboard/src/services/logs.service.ts` — rewrite
- `nestjs-dashboard/src/controllers/logs.controller.ts` — add new endpoints
- `nestjs-dashboard/src/dtos/logs.dto.ts` — new DTOs

**Steps:**

- [ ] **Step 1.1: Log directory scanner**
  - Add `scanLogDirectory()` method to `LogsService`
  - Parse filenames with regex (async + sync patterns)
  - Filter out `.error.` files
  - Return `Map<name, Set<date>>` structure
  - Handle directory not existing gracefully

- [ ] **Step 1.2: New DTOs**
  - `LogSourceDto` — `{ name: string, dates: string[], latestDate: string }`
  - `ListLogSourcesResponseDto` — `{ success: boolean, data: LogSourceDto[] }`
  - `QueryLogsResponseDto` — `{ success: boolean, data: LogEntryDto[], pagination: PaginationDto }`
  - `PaginationDto` — `{ limit: number, returned: number, hasMore: boolean, nextCursor: string | null }`
  - Update `LogEntryDto` — add optional `source` field

- [ ] **Step 1.3: `/logs/sources` endpoint**
  - Controller: `GET /logs/sources` → calls `scanLogDirectory()`, formats response
  - Sort names alphabetically, dates descending

- [ ] **Step 1.4: Query engine**
  - `queryLogs(name, date, options)` method
  - For single name: find matching files (`{name}.{date}.*.log` or `{name}.{date}.log`), read all, parse JSONL
  - For "all": find all files for the date (excluding `.error.`), read all, merge
  - Sort all parsed entries by `time` descending (newest first for tail behavior)
  - Apply level filter server-side (skip entries below threshold)
  - Apply text search server-side (`msg` field contains search string, case-insensitive)
  - Apply cursor: if `cursor` provided, decode `{time, skip}`, exclude entries with `time > cursor.time`, and skip the first `cursor.skip` entries at exactly `cursor.time` (tie-breaker for entries sharing the same ms timestamp)
  - Take first `limit` entries from the filtered+cursored set → these are the page
  - Re-sort the page ascending for display (oldest-to-newest within page)
  - Build `nextCursor`: encode `{time: oldestEntryTime, skip: countOfEntriesAtOldestTime}` as base64. If no more entries before the page, return `null`
  - Return page + `hasMore` + `nextCursor`

- [ ] **Step 1.5: `/logs/query` endpoint**
  - Controller: `GET /logs/query` with query params: `name` (required), `date` (required), `level`, `search`, `cursor`, `limit`
  - Validate: name must be from discovered sources or "all", date must be valid `YYYY-MM-DD` format
  - Default limit=500, max limit=2000
  - `cursor` is optional opaque string — omit for initial load (returns tail)

### Phase 2: Backend — SSE Streaming Update

- [ ] **Step 2.1: Rewrite `watchLogs()`**
  - Accept `name` param (no `date` — always watches today's files)
  - Use `fs.watch` on the log directory
  - On change events, check if the changed file matches the name + today's date pattern
  - Maintain per-file state: `Map<filePath, { offset: number, remainder: string }>` where:
    - `offset` tracks bytes already read
    - `remainder` buffers incomplete trailing line from last read (no terminating `\n`)
  - On each file change: read new bytes from `offset`, prepend `remainder`, split by `\n`, parse complete lines only, update `remainder` with any trailing incomplete line
  - For "all" name: track all files matching today's date pattern
  - Handle file rotation: periodically scan directory for new files matching the pattern (pino-roll may create `{name}.{date}.2.log` mid-day when count increments). Add new files to the watch map with `offset=0, remainder=""`
  - Handle file truncation: if new file size < tracked `offset`, reset to `offset=0, remainder=""`

- [ ] **Step 2.2: Update `/logs/stream` endpoint**
  - Accept `name` query param only (no `date` — always today)
  - Call `watchLogs()` with name filter
  - Add `source` field to emitted entries (which log file the entry came from)
  - Frontend is responsible for not connecting when viewing historical dates

### Phase 3: Frontend — LogsView Rewrite

**Files to modify:**

- `dashboard-web/src/components/LogsView.tsx` — full rewrite
- `dashboard-web/rsbuild.config.ts` — add `/logs` proxy

**Steps:**

- [ ] **Step 3.1: Add API proxy**
  - Add `/logs` proxy rule to rsbuild dev server config (→ `http://127.0.0.1:3456`)

- [ ] **Step 3.2: Toolbar UI**
  - Name selector: dropdown populated from `/logs/sources`, default to first available or "all"
  - Date picker: HTML date input, default to today
  - Level filter: dropdown (All, ≥ Trace, ≥ Debug, ≥ Info, ≥ Warn, ≥ Error, ≥ Fatal)
  - Search input: free-text with debounce (300ms)
  - Live/Paused toggle button
  - Clear button
  - Scroll-to-bottom button
  - Status indicator: entry count, error/warn badges

- [ ] **Step 3.3: Log entries panel**
  - Initial load: fetch `/logs/query?name=X&date=YYYY-MM-DD&limit=500` (no `beforeTime` → returns latest entries)
  - Table layout: Time | Source (when name=all) | Level badge | Context | Message | CorrelationId
  - Color-coded level badges (existing LEVEL_MAP style)
  - Row hover effects, error/warn row tinting
  - "Load more" button at top (older entries) when `pagination.hasMore` is true
    - On click: fetch `/logs/query?...&cursor={pagination.nextCursor}` and prepend results to the list
  - Auto-scroll behavior: stick to bottom when live, pause when user scrolls up
  - On filter change (name, date, level, search): clear entries and re-fetch from tail

- [ ] **Step 3.4: SSE integration**
  - **Only connect when `date` is today** — frontend checks `date === todayString` before opening EventSource
  - Connect to `/logs/stream?name=X` (no date param — backend always watches today)
  - Append new entries to the bottom of the list
  - Cap client-side buffer at 2000 entries (trim from top)
  - Reconnect on disconnect with backoff
  - When user changes date to non-today: close existing EventSource, enter historical-only mode
  - When user changes date back to today: re-open EventSource

- [ ] **Step 3.5: UI polish**
  - Glassmorphism panels consistent with ConfigsView/SkillsView
  - Animations: `animate-in fade-in slide-in-from-top-2` for filter bar
  - Empty state: icon + message when no logs available
  - Loading state: spinner during initial fetch
  - "Source" color chips when name=all (different subtle colors per source for visual grouping)
  - Responsive: handle narrow viewports gracefully

### Phase 4: Cleanup & Integration

- [ ] **Step 4.1: Remove old endpoints**
  - Remove `GET /logs/tail` endpoint and its test
  - Remove old `watchLogs()` without name/date params

- [ ] **Step 4.2: Regenerate OpenAPI types for all consumers**
  - Regenerate `server/openapi.json` from the updated NestJS server
  - Run `pnpm generate:types` in `dashboard-web` to update `api-types.ts`
  - Run `pnpm generate:types` in `debate-web` to update its `api-types.ts` (both consume the same `server/openapi.json`)
  - Verify no build/lint errors from the removed `/logs/tail` endpoint types in either consumer
  - Update `api.ts` in `dashboard-web` if needed for new endpoints

- [ ] **Step 4.3: Update OVERVIEWs**
  - Update `resources/workspaces/devtools/common/nestjs-dashboard/OVERVIEW.md`
  - Update `resources/workspaces/devtools/common/dashboard-web/OVERVIEW.md`

## File Change Summary

```
workspaces/devtools/common/nestjs-dashboard/src/
├── controllers/
│   └── logs.controller.ts       # 🚧 Add /logs/sources, /logs/query, update /logs/stream
├── dtos/
│   └── logs.dto.ts              # 🚧 Add LogSourceDto, QueryLogsResponseDto, PaginationDto, update LogEntryDto
└── services/
    └── logs.service.ts          # 🚧 Rewrite: scanLogDirectory, queryLogs, updated watchLogs

workspaces/devtools/common/dashboard-web/
├── rsbuild.config.ts            # 🚧 Add /logs proxy
└── src/
    └── components/
        └── LogsView.tsx         # 🚧 Full rewrite with new filters and pagination
```

## Verification Plan

### Manual Verification

1. **Source discovery**: Navigate to dashboard → Logs tab. Verify name dropdown shows all log sources discovered from `~/.aweave/logs/`.
2. **Date filter**: Change date to a date with logs → entries load. Change to a date without logs → empty state shown.
3. **Name=all merge**: Select "All" in name dropdown → verify entries from multiple sources appear, sorted by time. Verify `source` column shows which log file each entry came from.
4. **Level filter**: Select "≥ Error" → only error/fatal entries visible. Select "All" → everything shows.
5. **Search**: Type a search term → entries filter to matching messages. Clear search → all entries return.
6. **Pagination**: If more than 500 entries exist, verify "Load more" button appears and loads older entries.
7. **Live tail**: With today's date selected, trigger some server activity → new log entries appear in real-time. The streaming indicator shows "Live".
8. **Pause**: Click pause → new entries are buffered but don't auto-scroll. Click resume → scrolls to latest.
9. **Historical date**: Select yesterday's date → SSE disconnects, "Load more" is the only way to see entries. Streaming indicator shows "Historical".
10. **Empty log directory**: Stop all services, delete logs → graceful empty state with no errors.

## Open Questions

- None — all decisions made in this plan.
