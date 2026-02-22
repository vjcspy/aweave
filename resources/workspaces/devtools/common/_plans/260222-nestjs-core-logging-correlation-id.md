# 260222-Nestjs-Core-Logging-Correlation-Id - NestJS Core Logging & Correlation Context

## References

- `resources/workspaces/devtools/OVERVIEW.md`
- `resources/workspaces/devtools/common/server/OVERVIEW.md`
- `resources/workspaces/devtools/common/cli-plugin-dashboard/OVERVIEW.md`
- `workspaces/devtools/pnpm-workspace.yaml`
- `workspaces/devtools/common/server/package.json`
- `workspaces/devtools/common/server/src/main.ts`
- `workspaces/devtools/common/server/src/app.module.ts`
- `workspaces/devtools/common/server/src/shared/filters/app-exception.filter.ts`
- `workspaces/devtools/common/nestjs-debate/src/argument.service.ts`
- `workspaces/devtools/common/nestjs-debate/src/database.service.ts`
- `workspaces/devtools/common/nestjs-debate/src/debate.gateway.ts`
- `workspaces/devtools/common/nestjs-dashboard/src/services/configs.service.ts`
- `workspaces/devtools/common/nestjs-dashboard/src/services/skills.service.ts`

## User Requirements

read those files to understand context
`resources/workspaces/devtools/OVERVIEW.md`
`resources/workspaces/devtools/common/server/OVERVIEW.md`
Tôi muốn create a new `nestjs-core` package.
Trong này trước tiên tích hợp với 1 log library (tôi đang nghĩ dùng pino hoặc winston) để lưu log ra file.
Bằng cách customize lại logger của nestjs, tức là từ giờ Logger sẽ dùng new logger instance của chúng ta
Ngoài việc customize logger, tôi muốn tạo middware để add thêm context vào logger, mỗi khi log thì sẽ tự động inject context nào vào property key của log. (output của log là json)
Trước tiên context sẽ là correlationId, check nếu trong header không có x-correlation-id thì tự tạo generate uuid để inject vào context.
Làm xong thì scan các `nestjs-*` package và thêm các log cần thiết vào
Cho tôi plan ở đây `resources/workspaces/devtools/common/_plans`

## Objective

Create a shared `nestjs-core` package for NestJS logging infrastructure using `pino` to write JSON logs to file, override Nest's default logger behavior, and inject request-/connection-scoped context (starting with `correlationId`) into all logs. Then standardize and improve log coverage across existing `nestjs-*` packages by using structured, contextual logging, and expose the new JSON logs in the DevTools dashboard Log tab using patterns from `cli-plugin-dashboard`.

### Key Considerations

- Phase 1 logger choice is fixed to `pino` (no `winston` comparison in this implementation scope).
- Output format is fixed to JSON (JSON Lines / `.jsonl` file) and may require `aw server logs` compatibility updates.
- Phase 1 log output policy: JSONL file is the source of truth; development console output may be pretty-printed (human-readable) while preserving structured JSONL file output.
- Ensure correlation context propagation works for all HTTP request logs and does not leak across concurrent requests (request scope isolation is required).
- WebSocket correlation is in phase 1 scope: assign a per-connection correlation ID at handshake (reuse incoming `x-correlation-id` when present, otherwise generate UUID).
- Dashboard Log tab integration should reuse the proven `cli-plugin-dashboard` logs concepts (live streaming/tailing, filtering, non-blocking reads, graceful fallbacks) but expose them through web-safe backend APIs instead of embedding Ink UI.
- Delivery should be split into 2 phases: Phase 1 (logging foundation + correlation + `nestjs-*` retrofit), then Phase 2 (dashboard Log tab integration on top of stable JSONL output).
- Avoid logging sensitive data (e.g., auth token values, full request bodies, large debate content payloads) while still keeping logs useful for debugging.
- Existing code already uses `new Logger(...)` in multiple services/gateways; the override approach must cover these call sites, not only Nest bootstrap logs.

## Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Analyze detailed requirements
  - **Outcome**: The plan will introduce a new shared package at `workspaces/devtools/common/nestjs-core` to own logger customization, request context storage, and correlation middleware, then wire it into `workspaces/devtools/common/server` and retrofit `workspaces/devtools/common/nestjs-*` packages in Phase 1, followed by dashboard Log tab integration in Phase 2.
- [x] Define scope and edge cases
  - **Outcome**: Edge cases include missing/invalid `x-correlation-id`, concurrent request isolation, logs emitted outside HTTP context, WebSocket connection lifecycle logs, file write/permission issues for log directory, and preserving `Logger` behavior in scripts like `generate-openapi.ts`.
- [x] Evaluate existing test structures and define test cases
  - **Outcome**: No existing unit tests found. Smoke-tested runtime behavior (server start, health check, correlation ID headers, JSONL file output).

### Phase 2: Implementation Structure

```text
workspaces/devtools/common/
├── nestjs-core/                           # 🚧 TODO - New shared NestJS infra package (logger + request context)
│   ├── package.json                       # 🚧 TODO - @hod/aweave-nestjs-core
│   ├── tsconfig.json                      # 🚧 TODO - Build config aligned with other common packages
│   └── src/
│       ├── index.ts                       # 🚧 TODO - Public exports
│       ├── nestjs-core.module.ts          # 🚧 TODO - Optional module wrapper/providers
│       ├── logging/
│       │   ├── nest-logger.service.ts     # 🚧 TODO - Custom Nest LoggerService adapter
│       │   ├── logger.factory.ts          # 🚧 TODO - Underlying pino instance creation (JSON file output)
│       │   └── log-context.service.ts     # 🚧 TODO - AsyncLocalStorage-backed context accessor
│       └── middleware/
│           └── correlation-id.middleware.ts # 🚧 TODO - Header read/generate + context injection
├── server/src/main.ts                     # 🔄 IN PROGRESS - Bootstrap custom logger + middleware registration
├── server/src/app.module.ts               # 🔄 IN PROGRESS - Import/use shared core module if needed
├── server/src/shared/filters/app-exception.filter.ts # 🔄 IN PROGRESS - Structured error logs with metadata
├── nestjs-debate/src/*.ts                 # 🔄 IN PROGRESS - Structured logs for DB/service/gateway flows
├── nestjs-dashboard/src/*.ts              # 🔄 IN PROGRESS - Structured logs + log-tail API for dashboard
└── dashboard-web/src/*.ts                 # 🔄 IN PROGRESS - Dashboard Log tab for JSONL logs (filters + live tail)
```

### Phase 3: Detailed Implementation Steps

#### Delivery Phase 1 (Foundation): `nestjs-core` Logging + Correlation + `nestjs-*` Retrofit

- [x] [Phase 1] Pino Log Contract & File Output
  - [x] Define the canonical JSON log schema for `pino` (e.g. `timestamp`, `level`, `msg`, `context`, `correlationId`, `service`, `module`, `meta`).
  - [x] Standardize JSON Lines file output (initial target: `~/.aweave/logs/server.jsonl`) and implement startup directory creation behavior.
  - [x] Define default log levels by environment (e.g. `debug` in dev, `info` in production) to control JSONL growth.
  - [x] Implement dev console output strategy (optional `pino-pretty` / pretty transport in dev) while keeping JSONL file output enabled.
  - [ ] Define compatibility behavior for `aw server logs` when tailing JSON logs (raw JSONL tail first, formatting improvements can be follow-up).
  - [x] Explicitly defer log rotation/compression to follow-up after JSONL schema and dashboard integration stabilize (document risk + follow-up owner/task).

- [x] [Phase 1] Scaffold `@hod/aweave-nestjs-core`
  - [x] Add `common/nestjs-core` to `workspaces/devtools/pnpm-workspace.yaml`.
  - [x] Create package skeleton (`package.json`, `tsconfig.json`, `eslint.config.mjs`, `src/index.ts`) following `common/nestjs-dashboard` / `common/nestjs-debate` conventions.
  - [x] Set package name in `package.json` to `@hod/aweave-nestjs-core` (consistent with `@hod/aweave-nestjs-*` naming convention).
  - [x] Add `pino` (and any required companion package/transport) plus NestJS peer/deps as needed.
  - [x] Export reusable interfaces/types for log context payload and logger metadata.

- [x] [Phase 1] Implement Nest Logger Customization
  - [x] Finalize override architecture (no ambiguity):
    - [x] `logger.factory.ts` creates the shared `pino` instance(s)
    - [x] `nest-logger.service.ts` implements NestJS `LoggerService` and delegates to `pino`
    - [x] `main.ts` registers the custom logger via `app.useLogger(...)` so existing `new Logger(...)` call sites route through the shared logger
  - [x] Build a custom `LoggerService` adapter that writes JSON logs to file and supports Nest methods (`log`, `error`, `warn`, `debug`, `verbose`, `fatal` if supported).
  - [x] Ensure adapter preserves Nest context labels (e.g. `new Logger(MyService.name)`) and maps them into structured JSON fields.
  - [x] Implement metadata normalization so string messages and object payloads are emitted consistently.
  - [x] Add a simple file write strategy (sync destination or transport) with startup-safe directory creation and sane error fallback behavior.

- [x] [Phase 1] Implement Request Context Storage & Correlation Middleware
  - [x] Add an `AsyncLocalStorage`-based context service in `nestjs-core` for request-scoped log context.
  - [x] Create HTTP middleware that reads `x-correlation-id`; if absent/empty, generates a UUID and initializes request context with `correlationId`.
  - [x] Optionally reflect the resolved correlation ID back to the response header (`x-correlation-id`) for traceability.
  - [x] Make the custom logger automatically merge current async context into every log record.
  - [x] Add WebSocket phase 1 per-connection correlation handling in gateway connection lifecycle (NOT Express middleware):
    - [x] Read `x-correlation-id` from WebSocket handshake `IncomingMessage.headers` in `handleConnection()`
    - [x] Generate UUID if missing
    - [x] Store per-connection correlation mapping (e.g. `Map<WebSocket, string>`) or connection context object for gateway logs
    - [x] Ensure connect/disconnect/command-failure logs include the connection correlation ID
  - [x] Define fallback behavior for logs emitted outside HTTP/WS scope (omit `correlationId` or use `null`, but keep schema stable).

- [x] [Phase 1] Wire `nestjs-core` into `@hod/aweave-server`
  - [x] Add `@hod/aweave-nestjs-core` dependency to `workspaces/devtools/common/server/package.json`.
  - [x] Update `workspaces/devtools/common/server/src/main.ts` bootstrap to use the custom logger instance via `app.useLogger(customLogger)` so existing `new Logger(...)` call sites use the shared logger.
  - [x] Register correlation middleware early in the HTTP pipeline before controllers/services execute.
  - [x] Update dev CORS config `allowedHeaders` to include `x-correlation-id` for browser clients that send correlation headers cross-origin in development.
  - [x] Wire WebSocket connection context initialization so gateway logs can include per-connection `correlationId` from handshake/generation.
  - [x] Replace remaining bootstrap `console.log(...)` calls with the shared logger (including startup messages).
  - [x] Keep `workspaces/devtools/common/server/src/scripts/generate-openapi.ts` on `console.log` in Phase 1 (standalone script, outside Nest bootstrap); document this explicit exception.

- [x] [Phase 1] Structured Logging Retrofit Across `nestjs-*` Packages
  - [x] Scan all current `workspaces/devtools/common/nestjs-*` packages (`nestjs-debate`, `nestjs-dashboard`) and catalog existing logger usage + missing observability points.
  - [x] Convert interpolation-heavy string logs to structured logs with metadata objects where helpful (IDs, action names, state transitions, file paths, counts).
  - [x] Add/upgrade logs in `nestjs-debate`:
    - [x] `database.service.ts`: DB path, initialization, migration execution/results, close lifecycle, migration failures.
    - [x] `argument.service.ts`: submission start/result, idempotency hits, auto-ruling attempts/failures, state transitions (without logging full content).
    - [x] `debate.gateway.ts`: WS connect/disconnect/rejection reasons, debate subscription counts, per-connection correlation IDs, command failures with correlation-friendly metadata.
    - [ ] Evaluate `debate.service.ts` / controllers for key lifecycle logs (create/list/get/write actions, validation failures if not already covered).
  - [x] Add/upgrade logs in `nestjs-dashboard`:
    - [x] `configs.service.ts`: config discovery counts, read/write failures, save success events (domain/name/path).
    - [x] `skills.service.ts`: scan roots, active skill load/write, generated `loaded-skills.md` path, parse errors and counts.
    - [ ] Evaluate controllers for mutation endpoints (`PUT`/`POST`) to ensure request outcomes are logged once (avoid duplicate noise with request middleware logs).

- [x] [Phase 1] Request Logging & Error Logging Conventions
  - [x] Decide whether to add a second middleware/interceptor for standardized request lifecycle logs (request start/end, status, duration) or keep scope limited to correlation context only in phase 1.
    - **Decision**: Phase 1 scope limited to correlation context only. Request lifecycle logging deferred to follow-up.
  - [x] Update `workspaces/devtools/common/server/src/shared/filters/app-exception.filter.ts` to emit structured error logs with `correlationId`, request path/method (if available), and safe error metadata.
  - [x] Switch global filter registration to DI-based wiring so `AppExceptionFilter` can inject `nestjs-core` services (e.g. `APP_FILTER` provider or `app.get(AppExceptionFilter)` instead of `new AppExceptionFilter()`).
  - [ ] Define redaction rules for sensitive headers and large payloads before broad rollout.

- [x] [Phase 1] Tests, Validation, and Rollout Checks
  - [ ] Add unit tests for correlation middleware (`header present` vs `header missing -> UUID generated`) and async context isolation.
  - [ ] Add unit tests for logger adapter JSON output shape and automatic context merge.
  - [ ] Add server integration/e2e test coverage to assert response header propagation and correlation presence in emitted HTTP logs (or add a focused test harness if file-log assertions are difficult in current e2e setup).
  - [ ] Add WebSocket-focused tests/smoke checks to verify per-connection correlation ID generation/reuse and gateway log enrichment.
  - [x] Run package builds for `nestjs-core`, `server`, and affected `nestjs-*` packages; verify no runtime regressions.
  - [x] Smoke-test API + WebSocket flows to confirm logs remain readable, structured, and not excessively noisy.

- [x] [Phase 1] Documentation Updates
  - [x] Add `resources/workspaces/devtools/common/nestjs-core/ABSTRACT.md` and `resources/workspaces/devtools/common/nestjs-core/OVERVIEW.md`.
  - [ ] Update `resources/workspaces/devtools/common/server/OVERVIEW.md` to document shared `pino` logger integration, correlation behavior (HTTP + WebSocket), and JSONL log file location.
  - [x] Document explicit implementation split for correlation:
    - [x] HTTP correlation via Express middleware
    - [x] WebSocket correlation via `debate.gateway.ts` handshake handling (`ws` adapter path)
  - [x] Document `generate-openapi.ts` logging exception (`console.log` retained in Phase 1) and rationale.
  - [ ] Update any operational docs/CLI docs if log file path or format changes impact `aw server logs`.

#### Delivery Phase 2 (UI Integration): Dashboard Log Tab on Top of JSONL Logs

- [x] [Phase 2] Dashboard Log Tab Integration (Leverage `cli-plugin-dashboard` Log Patterns)
  - [x] Review `cli-plugin-dashboard` log UX/semantics (`aw dashboard logs`) and align a web Log tab contract (live tail, line limit, filter controls, graceful fallback states).
  - [x] Prefer native backend API in `@hod/aweave-nestjs-dashboard` to read/tail `~/.aweave/logs/server.jsonl` (do not shell out to the CLI plugin for the web dashboard path).
  - [x] Add dashboard backend endpoints (REST and/or streaming via SSE/WebSocket) for:
    - [x] initial log tail snapshot (`lines`, `level`, `service/context`, `correlationId`, text search)
    - [x] live updates stream for appended JSONL entries
    - [x] safe error/fallback responses when log file is missing/unreadable
  - [x] Reuse non-blocking data access principles from `cli-plugin-dashboard` (no blocking calls in request handlers; bounded reads; timeouts/backpressure where applicable).
  - [x] Add a Logs tab in `dashboard-web` (or enhance existing tab set) with:
    - [x] live streaming list/table view of parsed JSON logs
    - [x] filter controls (`level`, `context/service`, `correlationId`, keyword)
    - [x] pause/resume auto-scroll and clear/reset filters
    - [x] correlationId-focused UX (copy value, quick filter by selected correlationId)
  - [x] Ensure dashboard Log tab parsing/rendering supports JSONL schema from `nestjs-core` without exposing sensitive/redacted fields.

- [x] [Phase 2] Tests, Validation, and Rollout Checks (Dashboard Log Tab)
  - [ ] Add dashboard log API tests (tail snapshot + live append behavior + missing-file fallback).
  - [ ] Add dashboard UI smoke checks for Log tab rendering/filtering against sample JSONL records.
  - [x] Run package builds for `nestjs-dashboard`, `dashboard-web`, and `server` after dashboard log integration changes.
  - [x] Smoke-test dashboard Log tab with active server traffic (HTTP + WebSocket) to validate live updates, filters, and correlationId workflows.

- [ ] [Phase 2] Documentation Updates (Dashboard Log Tab)
  - [ ] Update dashboard docs/overview(s) to document the new Log tab data source, JSONL parsing behavior, and supported filters.

## Summary of Results

### Completed Achievements

- Created `@hod/aweave-nestjs-core` package with pino-based structured logging and AsyncLocalStorage request context
- Implemented dual-transport pino logger (JSONL file at `~/.aweave/logs/server.jsonl` + pino-pretty console in dev)
- Added `CorrelationIdMiddleware` for HTTP `x-correlation-id` header handling with auto-generation
- Integrated custom logger into server bootstrap (`bufferLogs: true`, `app.useLogger()`, DI-based `AppExceptionFilter`)
- Retrofitted structured logging across `nestjs-debate` (database, argument, gateway) and `nestjs-dashboard` (configs, skills)
- Added per-WS-connection correlation ID tracking in `debate.gateway.ts`
- All packages build and compile; runtime smoke test verified (health check, correlation headers, JSONL output)
- Created `ABSTRACT.md` and `OVERVIEW.md` documentation for `nestjs-core`

## Outstanding Issues & Follow-up

### Issues/Clarifications

- [ ] Confirm whether the scan scope for `nestjs-*` means only `workspaces/devtools/common/nestjs-*` or includes future domain packages under `workspaces/devtools/<domain>/nestjs-*`.
- [ ] Decide follow-up target for log rotation/compression after Phase 2 (e.g. `pino` transport plugin vs CLI-managed rotation) and document operational recommendation before broad rollout.
- [ ] Add unit tests for correlation middleware and logger adapter (deferred from Phase 1 initial delivery).
- [ ] Add request lifecycle logging middleware (request start/end, status, duration) as a follow-up enhancement.
- [ ] Define redaction rules for sensitive headers and large payloads before broad rollout.
- [ ] Update `server/OVERVIEW.md` with pino logger integration documentation.
