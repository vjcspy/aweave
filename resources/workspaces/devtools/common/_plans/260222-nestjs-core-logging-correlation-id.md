# 260222-Nestjs-Core-Logging-Correlation-Id - NestJS Core Logging & Correlation Context

## References

- `resources/workspaces/devtools/OVERVIEW.md`
- `resources/workspaces/devtools/common/server/OVERVIEW.md`
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

Create a shared `nestjs-core` package for NestJS logging infrastructure using `pino` to write JSON logs to file, override Nest's default logger behavior, and inject request-/connection-scoped context (starting with `correlationId`) into all logs. Then standardize and improve log coverage across existing `nestjs-*` packages by using structured, contextual logging.

### Key Considerations

- Phase 1 logger choice is fixed to `pino` (no `winston` comparison in this implementation scope).
- Output format is fixed to JSON (JSON Lines / `.jsonl` file) and may require `aw server logs` compatibility updates.
- Ensure correlation context propagation works for all HTTP request logs and does not leak across concurrent requests (request scope isolation is required).
- WebSocket correlation is in phase 1 scope: assign a per-connection correlation ID at handshake (reuse incoming `x-correlation-id` when present, otherwise generate UUID).
- Avoid logging sensitive data (e.g., auth token values, full request bodies, large debate content payloads) while still keeping logs useful for debugging.
- Existing code already uses `new Logger(...)` in multiple services/gateways; the override approach must cover these call sites, not only Nest bootstrap logs.

## Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Analyze detailed requirements
  - **Outcome**: The plan will introduce a new shared package at `workspaces/devtools/common/nestjs-core` to own logger customization, request context storage, and correlation middleware, then wire it into `workspaces/devtools/common/server` and retrofit `workspaces/devtools/common/nestjs-*` packages.
- [ ] Define scope and edge cases
  - **Outcome**: Edge cases include missing/invalid `x-correlation-id`, concurrent request isolation, logs emitted outside HTTP context, WebSocket connection lifecycle logs, file write/permission issues for log directory, and preserving `Logger` behavior in scripts like `generate-openapi.ts`.
- [ ] Evaluate existing test structures and define test cases
  - **Outcome**: Test strategy should include unit tests in `nestjs-core` (context store + middleware + logger adapter) plus server integration/e2e checks (header propagation and JSON log output); current baseline only shows `workspaces/devtools/common/server/test/app.e2e-spec.ts`.

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
└── nestjs-dashboard/src/*.ts              # 🔄 IN PROGRESS - Structured logs for config/skills flows
```

### Phase 3: Detailed Implementation Steps

- [ ] Pino Log Contract & File Output
  - [ ] Define the canonical JSON log schema for `pino` (e.g. `timestamp`, `level`, `msg`, `context`, `correlationId`, `service`, `module`, `meta`).
  - [ ] Standardize JSON Lines file output (initial target: `~/.aweave/logs/server.jsonl`) and implement startup directory creation behavior.
  - [ ] Define compatibility behavior for `aw server logs` when tailing JSON logs (raw JSONL tail first, formatting improvements can be follow-up).

- [ ] Scaffold `@hod/aweave-nestjs-core`
  - [ ] Add `common/nestjs-core` to `workspaces/devtools/pnpm-workspace.yaml`.
  - [ ] Create package skeleton (`package.json`, `tsconfig.json`, `eslint.config.mjs`, `src/index.ts`) following `common/nestjs-dashboard` / `common/nestjs-debate` conventions.
  - [ ] Add `pino` (and any required companion package/transport) plus NestJS peer/deps as needed.
  - [ ] Export reusable interfaces/types for log context payload and logger metadata.

- [ ] Implement Nest Logger Customization
  - [ ] Build a custom `LoggerService` adapter that writes JSON logs to file and supports Nest methods (`log`, `error`, `warn`, `debug`, `verbose`, `fatal` if supported).
  - [ ] Ensure adapter preserves Nest context labels (e.g. `new Logger(MyService.name)`) and maps them into structured JSON fields.
  - [ ] Implement metadata normalization so string messages and object payloads are emitted consistently.
  - [ ] Add a simple file write strategy (sync destination or transport) with startup-safe directory creation and sane error fallback behavior.

- [ ] Implement Request Context Storage & Correlation Middleware
  - [ ] Add an `AsyncLocalStorage`-based context service in `nestjs-core` for request-scoped log context.
  - [ ] Create HTTP middleware that reads `x-correlation-id`; if absent/empty, generates a UUID and initializes request context with `correlationId`.
  - [ ] Optionally reflect the resolved correlation ID back to the response header (`x-correlation-id`) for traceability.
  - [ ] Make the custom logger automatically merge current async context into every log record.
  - [ ] Add WebSocket phase 1 per-connection correlation handling (reuse handshake `x-correlation-id` if present; otherwise generate UUID and attach connection context for gateway logs).
  - [ ] Define fallback behavior for logs emitted outside HTTP/WS scope (omit `correlationId` or use `null`, but keep schema stable).

- [ ] Wire `nestjs-core` into `@hod/aweave-server`
  - [ ] Add `@hod/aweave-nestjs-core` dependency to `workspaces/devtools/common/server/package.json`.
  - [ ] Update `workspaces/devtools/common/server/src/main.ts` bootstrap to use the custom logger instance for Nest (`app.useLogger(...)` and/or Nest logger override path so `new Logger(...)` uses the shared logger).
  - [ ] Register correlation middleware early in the HTTP pipeline before controllers/services execute.
  - [ ] Wire WebSocket connection context initialization so gateway logs can include per-connection `correlationId` from handshake/generation.
  - [ ] Replace remaining bootstrap `console.log(...)` calls with the shared logger (including startup messages).
  - [ ] Review `src/scripts/generate-openapi.ts` and decide whether to keep plain console output or adopt a lightweight shared logger for script consistency.

- [ ] Structured Logging Retrofit Across `nestjs-*` Packages
  - [ ] Scan all current `workspaces/devtools/common/nestjs-*` packages (`nestjs-debate`, `nestjs-dashboard`) and catalog existing logger usage + missing observability points.
  - [ ] Convert interpolation-heavy string logs to structured logs with metadata objects where helpful (IDs, action names, state transitions, file paths, counts).
  - [ ] Add/upgrade logs in `nestjs-debate`:
    - [ ] `database.service.ts`: DB path, initialization, migration execution/results, close lifecycle, migration failures.
    - [ ] `argument.service.ts`: submission start/result, idempotency hits, auto-ruling attempts/failures, state transitions (without logging full content).
    - [ ] `debate.gateway.ts`: WS connect/disconnect/rejection reasons, debate subscription counts, per-connection correlation IDs, command failures with correlation-friendly metadata.
    - [ ] Evaluate `debate.service.ts` / controllers for key lifecycle logs (create/list/get/write actions, validation failures if not already covered).
  - [ ] Add/upgrade logs in `nestjs-dashboard`:
    - [ ] `configs.service.ts`: config discovery counts, read/write failures, save success events (domain/name/path).
    - [ ] `skills.service.ts`: scan roots, active skill load/write, generated `loaded-skills.md` path, parse errors and counts.
    - [ ] Evaluate controllers for mutation endpoints (`PUT`/`POST`) to ensure request outcomes are logged once (avoid duplicate noise with request middleware logs).

- [ ] Request Logging & Error Logging Conventions
  - [ ] Decide whether to add a second middleware/interceptor for standardized request lifecycle logs (request start/end, status, duration) or keep scope limited to correlation context only in phase 1.
  - [ ] Update `workspaces/devtools/common/server/src/shared/filters/app-exception.filter.ts` to emit structured error logs with `correlationId`, request path/method (if available), and safe error metadata.
  - [ ] Define redaction rules for sensitive headers and large payloads before broad rollout.

- [ ] Tests, Validation, and Rollout Checks
  - [ ] Add unit tests for correlation middleware (`header present` vs `header missing -> UUID generated`) and async context isolation.
  - [ ] Add unit tests for logger adapter JSON output shape and automatic context merge.
  - [ ] Add server integration/e2e test coverage to assert response header propagation and correlation presence in emitted HTTP logs (or add a focused test harness if file-log assertions are difficult in current e2e setup).
  - [ ] Add WebSocket-focused tests/smoke checks to verify per-connection correlation ID generation/reuse and gateway log enrichment.
  - [ ] Run package builds for `nestjs-core`, `server`, and affected `nestjs-*` packages; verify no runtime regressions.
  - [ ] Smoke-test API + WebSocket flows to confirm logs remain readable, structured, and not excessively noisy.

- [ ] Documentation Updates
  - [ ] Add `resources/workspaces/devtools/common/nestjs-core/ABSTRACT.md` and `resources/workspaces/devtools/common/nestjs-core/OVERVIEW.md`.
  - [ ] Update `resources/workspaces/devtools/common/server/OVERVIEW.md` to document shared `pino` logger integration, correlation behavior (HTTP + WebSocket), and JSONL log file location.
  - [ ] Update any operational docs/CLI docs if log file path or format changes impact `aw server logs`.

## Summary of Results

### Completed Achievements

- [List major accomplishments]

## Outstanding Issues & Follow-up

### Issues/Clarifications

- [ ] Confirm whether the scan scope for `nestjs-*` means only `workspaces/devtools/common/nestjs-*` or includes future domain packages under `workspaces/devtools/<domain>/nestjs-*`.
- [ ] Decide whether log rotation/compression is required in phase 1 or deferred to a follow-up after JSONL output is stable.
