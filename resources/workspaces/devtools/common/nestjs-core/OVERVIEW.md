---
name: NestJS Core Module
description: Shared NestJS infrastructure module providing structured JSON logging and request context propagation
tags: []
---

# NestJS Core Module (`@hod/aweave-nestjs-core`)

> **Source:** `workspaces/devtools/common/nestjs-core/`
> **Last Updated:** 2026-02-22

Shared NestJS infrastructure module providing structured JSON logging via pino and AsyncLocalStorage-based request context propagation with correlation ID middleware.

## Purpose

- **Unified Logging:** Replace Nest's default console logger with pino-backed JSON output (JSONL file + dev pretty console)
- **Request Context:** AsyncLocalStorage-based context service for propagating per-request metadata through async call chains
- **Correlation Tracking:** HTTP middleware that generates/reads `x-correlation-id` headers and injects correlationId into all downstream logs
- **Global Module:** `@Global()` so all feature modules get `LogContextService` and `NestLoggerService` without explicit imports

## Architecture

```
@hod/aweave-nestjs-core
├── NestjsCoreModule (@Global)
│   ├── NestLoggerService (LoggerService adapter → pino)
│   ├── LogContextService (AsyncLocalStorage wrapper)
│   └── CorrelationIdMiddleware (HTTP x-correlation-id)
└── logger.factory.ts (pino instance creation)
```

## Project Structure

```
nestjs-core/
├── package.json            # @hod/aweave-nestjs-core
├── tsconfig.json
├── eslint.config.mjs
└── src/
    ├── index.ts            # Barrel exports
    ├── nestjs-core.module.ts  # @Global() module
    ├── logging/
    │   ├── logger.factory.ts        # Pino instance (dual transport: file + console)
    │   ├── nest-logger.service.ts   # NestJS LoggerService adapter
    │   └── log-context.service.ts   # AsyncLocalStorage context store
    └── middleware/
        └── correlation-id.middleware.ts  # HTTP correlation ID middleware
```

## Key Components

### `createLogger()` (`logger.factory.ts`)

Creates a pino instance with dual transport:

- **File:** JSONL to `~/.aweave/logs/server.jsonl` (always enabled, all levels)
- **Console:** `pino-pretty` in dev (`NODE_ENV !== 'production'`), raw JSON otherwise
- Default level: `debug` in dev, `info` in production
- Base bindings: `{ service: 'aweave-server' }`
- Overridable via `LOG_LEVEL` and `LOG_DIR` env vars

### `LogContextService` (`log-context.service.ts`)

AsyncLocalStorage-backed request context store:

- `run(context, fn)` — wraps `fn` in a context scope
- `get(key)` / `set(key, value)` — read/write context values
- `getAll()` — returns all context as a plain object
- Used by middleware to inject `correlationId` and by logger to merge it into logs

### `NestLoggerService` (`nest-logger.service.ts`)

Implements `LoggerService` from `@nestjs/common`:

- Methods: `log`, `error`, `warn`, `debug`, `verbose`, `fatal`
- Automatically merges AsyncLocalStorage context into every log record
- Handles NestJS call signature variations (message/context/stack/meta)
- Preserves Nest context labels (e.g. `new Logger('MyService')`)

### `CorrelationIdMiddleware` (`correlation-id.middleware.ts`)

Express middleware (`NestMiddleware`):

- Reads `x-correlation-id` from request headers
- Generates `crypto.randomUUID()` if absent/empty
- Sets response header `x-correlation-id` for traceability
- Wraps downstream handlers in `LogContextService.run({ correlationId })`

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Minimum log level |
| `LOG_DIR` | `~/.aweave/logs/` | Log directory path |
| `NODE_ENV` | — | Controls console transport (pretty vs raw JSON) |

## Log Output

### JSONL File (`~/.aweave/logs/server.jsonl`)

```json
{"level":30,"time":1771773637346,"service":"aweave-server","context":"Bootstrap","msg":"Server listening on http://127.0.0.1:3456"}
{"level":30,"time":1771773637400,"service":"aweave-server","correlationId":"d37b4b55-8ce0-430f-9161-41b5bf2bdca9","context":"DebateController","msg":"Health check"}
```

### Dev Console (pino-pretty)

```
[22:20:37.345] INFO: Server listening on http://127.0.0.1:3456
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

WebSocket connections are NOT covered by Express middleware. The `DebateGateway` handles per-connection correlation:

- Reads `x-correlation-id` from WS handshake `IncomingMessage.headers`
- Generates UUID if missing
- Stores per-connection mapping in `Map<WebSocket, string>`
- Includes correlationId in all gateway logs (connect/disconnect/errors)

### Logs Outside HTTP/WS Context

Logs emitted outside any request/connection scope (e.g. during module init, scheduled tasks) will have no `correlationId` — the field is simply absent, keeping the JSON schema stable.

## Related

- **Unified Server:** `workspaces/devtools/common/server/`
- **Server Overview:** `resources/workspaces/devtools/common/server/OVERVIEW.md`
- **Implementation Plan:** `resources/workspaces/devtools/common/_plans/260222-nestjs-core-logging-correlation-id.md`
