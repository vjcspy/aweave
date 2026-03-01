---
name: Log File Date-Based Naming
description: Upgrade pino-roll to 4.0.0 and configure dateFormat + extension options so all log files follow {name}.{date}.{count}.{ext} convention.
status: done
created: 2026-03-01
tags: [logging, node-shared]
---

# 260301 — Log File Date-Based Naming

## References

- `workspaces/devtools/common/node-shared/src/logging/logger.factory.ts` — `createLogger()` implementation
- `workspaces/devtools/common/node-shared/package.json` — current dep: `pino-roll: ^2.1.0`
- `resources/workspaces/devtools/common/node-shared/OVERVIEW.md` — Logger documentation
- `resources/workspaces/devtools/common/_plans/260301-shared-logger-node-shared.md` — Original logger plan (done)

## User Requirements

- Log files currently have numeric-only suffix (e.g., `mcp-memory.error.jsonl.1`) — want date-based naming
- Naming convention: `{name}.{date}.{count}.{ext}` (e.g., `server.2026-03-01.1.jsonl`)
- Both async mode (pino-roll) and sync mode (pino.destination) must use the same date-based format
- No backward compatibility needed for dashboard/log consumers — those will be migrated in a separate future plan

## Objective

Upgrade `pino-roll` from `^2.1.0` to `^4.0.0` to leverage its standardized **Extension Last Format**, add `dateFormat` for date-based naming. All loggers switch to new format exclusively.

### Key Considerations

1. **pino-roll 4.0.0 Extension Last Format:** When `file` has no extension and `extension` option is set, output follows `{file}.{date}.{count}.{ext}`. Clean names like `server.2026-03-01.1.jsonl`. The `.{count}` is always present — acceptable.

2. **Sync mode (CLI):** `pino.destination()` has no built-in rotation. Embed today's local date into the filename at logger creation time (e.g., `cli.2026-03-01.jsonl`). Short-lived CLI processes won't span midnight — acceptable.

3. **Timezone consistency:** Sync mode uses **local time** (not UTC `toISOString()`) matching pino-roll's local-time-based daily rotation.

4. **MCP stdio safety:** No impact. Changes only add pino-roll config options — don't touch stdout/stderr.

5. **Dashboard/log viewer:** Out of scope. Existing consumers (`logs.service.ts`, `file-tail.ts`) still hardcode `server.jsonl` — they will break and be fixed in a separate log viewer migration plan.

6. **Retention policy:** Out of scope. Follow-up change.

## Implementation Plan

### Phase 1: Upgrade pino-roll & fix naming

- [x] **1.1** Upgrade `pino-roll` in `node-shared/package.json` from `^2.1.0` to `^4.0.0`
- [x] **1.2** Check pino compatibility (pino-roll 4 works with pino 10)
- [x] **1.3** Modify `logger.factory.ts`:
  - **Async:** pass `file` without extension, add `extension: ext`, `dateFormat: 'yyyy-MM-dd'`
  - **Sync:** embed local date in filename using `getFullYear/getMonth/getDate`
- [x] **1.4** Build `node-shared`: `pnpm build`

### Phase 2: Build & Documentation

- [x] **2.1** Full build: `cd workspaces/devtools && pnpm -r build`
- [x] **2.2** Update `resources/workspaces/devtools/common/node-shared/OVERVIEW.md`:
  - pino-roll version bump to 4.0.0
  - File naming: `{name}.{date}.{count}.{ext}` (async), `{name}.{date}.{ext}` (sync)

### Phase 3: Verification

- [ ] Delete old log files: `rm ~/.aweave/logs/server.* ~/.aweave/logs/mcp-memory.* ~/.aweave/logs/cli.*`
- [ ] Start server: `aw server start` → check file matches `server.2026-03-01.1.jsonl` pattern
- [ ] Run CLI command → check `cli.2026-03-01.jsonl` is created (local date)
- [ ] Verify: no old-format numeric-only files (`*.jsonl.1`) — only date-based (`*.2026-03-01.1.jsonl`)
- [x] Full build: `cd workspaces/devtools && pnpm -r build` → zero errors

## Summary of Results

### Completed Achievements

- Upgraded `pino-roll` from `^2.1.0` to `^4.0.0` (Extension Last Format)
- Async mode: `file` passed without extension + `extension: 'jsonl'` + `dateFormat: 'yyyy-MM-dd'` → `{name}.{date}.{count}.{ext}`
- Sync mode: `getLocalDateStamp()` embeds local date → `{name}.{date}.{ext}`
- Removed now-unused `allLogsFile`/`errorLogsFile` variables
- Full workspace build (27 packages) passes with zero errors
- Updated `OVERVIEW.md` with new naming conventions and pino-roll version

## Outstanding Issues & Follow-up

- [ ] **Log viewer migration** — Dashboard consumers (`logs.service.ts`, `file-tail.ts`) hardcode `server.jsonl`. Need separate plan with `resolveActiveLogFile()` utility using strict regex `^{name}\.\d{4}-\d{2}-\d{2}\.\d+\.{ext}$` and rotation follow-through for live streams.
- [ ] **Retention policy** — Add `limit.count` with configurable value once retention requirements are determined.
