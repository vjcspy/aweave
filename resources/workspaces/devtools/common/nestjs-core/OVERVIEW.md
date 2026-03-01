---
name: NestJS Core Module
description: Shared NestJS infrastructure module providing structured JSON logging (backed by pino via node-shared) and request context propagation with correlation ID middleware.
tags: []
---

# NestJS Core Module (`@hod/aweave-nestjs-core`)

> **Source:** `workspaces/devtools/common/nestjs-core/`
> **Last Updated:** 2026-03-01

Shared NestJS infrastructure module providing structured JSON logging via pino and AsyncLocalStorage-based request context propagation with correlation ID middleware.

## Purpose

- **Unified Logging:** Replace Nest's default console logger with pino-backed structured JSON output.
  - All-levels JSONL file + error-only JSONL file + dev pretty console on **stderr** (never stdout)
  - Backed by `createLogger()` from `@hod/aweave-node-shared`
- **Request Context:** AsyncLocalStorage-based context service for propagating per-request metadata through async call chains
- **Correlation Tracking:** HTTP middleware that generates/reads `x-correlation-id` headers and injects `correlationId` into all downstream logs
- **Global Module:** `@Global()` so all feature modules get `LogContextService` and `NestLoggerService` without explicit imports

## Architecture

```
@hod/aweave-nestjs-core
├── NestjsCoreModule (@Global)
│   ├── NestLoggerService (LoggerService adapter → pino)
│   ├── LogContextService (AsyncLocalStorage wrapper)
│   └── CorrelationIdMiddleware (HTTP x-correlation-id)
└── logging/
    ├── logger.factory.ts    # Thin re-export from @hod/aweave-node-shared
    └── nest-logger.service.ts  # NestJS adapter, calls createLogger({ name: 'server', service: 'aweave-server' })
```

## Project Structure

```
nestjs-core/
├── package.json               # @hod/aweave-nestjs-core
│                              # deps: @hod/aweave-node-shared, @nestjs/common
│                              # devDeps: pino (type-only imports)
├── tsconfig.json
└── src/
    ├── index.ts               # Barrel exports
    ├── nestjs-core.module.ts  # @Global() module
    ├── logging/
    │   ├── logger.factory.ts        # Re-exports createLogger/CreateLoggerOptions from node-shared
    │   ├── nest-logger.service.ts   # NestJS LoggerService adapter
    │   └── log-context.service.ts   # AsyncLocalStorage context store
    └── middleware/
        └── correlation-id.middleware.ts  # HTTP correlation ID middleware
```

## Key Components

### `createLogger()` (`logger.factory.ts`)

Thin re-export from `@hod/aweave-node-shared`. Backward-compatible — any code importing from `@hod/aweave-nestjs-core` continues to work.

The actual implementation lives in `node-shared`. See `node-shared/OVERVIEW.md` for full options.

### `NestLoggerService` (`nest-logger.service.ts`)

Creates the pino logger with:

```typescript
createLogger({ name: 'server', service: 'aweave-server' })
```

- `name: 'server'` → log files: `~/.aweave/logs/server.jsonl` and `server.error.jsonl`
- `service: 'aweave-server'` → backward compat with dashboard log filters (`nestjs-dashboard` and `cli-plugin-dashboard` filter by this field)
- Uses async transport (default `sync: false`) — pino-roll daily rotation for long-running server

Methods: `log`, `error`, `warn`, `debug`, `verbose`, `fatal`. Merges AsyncLocalStorage context into every record.

### `LogContextService` (`log-context.service.ts`)

AsyncLocalStorage-backed request context store:

- `run(context, fn)` — wraps `fn` in a context scope
- `get(key)` / `set(key, value)` — read/write context values
- `getAll()` — returns all context as a plain object

### `CorrelationIdMiddleware`

- Reads `x-correlation-id` from request headers, generates UUID if absent
- Sets response header for traceability
- Wraps downstream handlers in `LogContextService.run({ correlationId })`

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Minimum log level |
| `LOG_DIR` | `~/.aweave/logs/` | Log directory |
| `LOG_CONSOLE` | `true` | Set `false` to disable stderr console output |
| `NODE_ENV` | — | Controls console transport (pino-pretty vs raw JSON) |

## Log Output

### JSONL Files

```
~/.aweave/logs/server.jsonl        ← all levels, rotated daily (server.jsonl.2026-03-01)
~/.aweave/logs/server.error.jsonl  ← error-only, rotated daily
```

```json
{"level":30,"time":1771773637346,"service":"aweave-server","context":"Bootstrap","msg":"Server listening on http://127.0.0.1:3456"}
{"level":30,"time":1771773637400,"service":"aweave-server","correlationId":"d37b4b55-...","context":"DebateController","msg":"Health check"}
```

### Dev Console (stderr — pino-pretty)

```
12:43:02.194 INFO: Server listening on http://127.0.0.1:3456
    service: "aweave-server"
    context: "Bootstrap"
```

## Integration with Server

```typescript
// main.ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(NestLoggerService));

// app.module.ts
@Module({
  imports: [NestjsCoreModule, DebateModule, DashboardModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```

### WebSocket Correlation

WebSocket connections are NOT covered by Express middleware. The `DebateGateway` handles per-connection correlation via handshake headers.

### Logs Outside HTTP/WS Context

Logs emitted during module init, scheduled tasks, etc. will have no `correlationId` — field is simply absent.

## Related

- **Logger implementation:** `resources/workspaces/devtools/common/node-shared/OVERVIEW.md`
- **Unified Server:** `workspaces/devtools/common/server/`
- **Server Overview:** `resources/workspaces/devtools/common/server/OVERVIEW.md`
- **Plan (logging + correlation ID):** `resources/workspaces/devtools/common/_plans/260222-nestjs-core-logging-correlation-id.md`
- **Plan (shared logger):** `resources/workspaces/devtools/common/_plans/260301-shared-logger-node-shared.md`
