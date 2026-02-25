# Proposal: New Logging Standard for Tinybots Backend

[TOC]

## 1. Problem Statement

### 1.1 Inconsistent log structure

We aim for structured JSON logging, but in practice the output is inconsistent. Some logs are well-structured, while others are plain text or have mismatched fields.

![image-20260225082902801](../../../../../../../../.assets/images/image-20260225082902801.png)

Current structured output (when it works):

```json
{
  "_appName": "sensara-adaptor",
  "_callRef": "sensara-adaptor_b71f6239-3a39-4662-90ed-2ed124238c5a",
  "_serviceRef": "sensara-adaptor_b71f6239-3a39-4662-90ed-2ed124238c5a",
  "level": "info",
  "message": "creating event stream for main for residents d37b9b20-b03e-44f2-8131-8e9b0c162162 from event 1771947773763-0",
  "timestamp": "2026-02-24T15:59:35.207Z"
}
```

The `callRef` field exists for cross-service tracing, but it is not consistently present and its format (e.g. `sensara-adaptor_<uuid>`) is not optimized for fast search in CloudWatch Log Insights. It should be a plain UUID.

### 1.2 Missing logs across entire flows

Entire service flows have zero log output. When a production issue occurs, there is no trace to observe, monitor, or debug the request path. This makes incident response slow and error-prone.

### 1.3 The current logging mechanism creates friction

Every function that needs to log must receive the request context (`ctx`) as a parameter:

```typescript
// Current pattern — repeated 25+ times in sensara-adaptor alone
const ctx = getContext(req)
const logger = Logger.loggerFromCtx(ctx)
```

This creates several problems:

- **Unnatural coupling**: every service method, utility function, and repository must be designed to accept a `ctx` parameter solely for logging purposes
- **Existing code doesn't have it**: many methods were written without `ctx`, and retrofitting them is tedious
- **Developers avoid logging**: when logging requires threading a parameter through 3-4 layers of function calls, developers simply skip it

**Evidence from `sensara-adaptor`:** a single service has **10+ places** that fall back to raw `console.error` / `console.info` — completely bypassing the structured logger. These are concentrated in:

- **Background jobs** (`LocationPoller`, `ActivityPoller`, `RestartPollerJobs`) — where no HTTP request context exists
- **Error catch blocks** in repositories and API services — where passing `ctx` is cumbersome

These `console.*` calls produce logs with **zero context**: no correlation ID, no app name, no structured fields. They are invisible to any query or dashboard built on structured log fields.

### 1.4 No sensitive data protection

There is no mechanism to mask or redact sensitive data (PII, tokens, credentials) before it reaches the log output. Any developer can accidentally log sensitive information.

### 1.5 Inconsistent error logging

Errors are logged differently across the codebase — some as objects, some as strings, some with stack traces, some without. A single request can produce multiple error log entries, creating noise in monitoring. For accurate alerting and dashboards, each request should produce at most one error entry with a single stack trace.

## 2. Root Cause: Manual Context Propagation

The core architectural problem is that **context propagation is manual**. The current design requires every function in the call chain to explicitly pass a `ctx` object.

Node.js has had a built-in solution for this since v16: **`AsyncLocalStorage`** (from the `node:async_hooks` module). It allows a value (like request context) to propagate automatically through the entire async call chain — across `await`, `Promise`, `setTimeout`, event handlers — without any parameter passing.

This is the same mechanism used by major observability frameworks (OpenTelemetry, Datadog APM, AWS X-Ray SDK) for automatic trace propagation.

### Before (current)

```typescript
// Context must be threaded through every layer
async function handleRequest(req, res) {
  const ctx = getContext(req)
  const logger = Logger.loggerFromCtx(ctx)
  logger.info('handling request')

  // Must pass ctx to service
  await residentService.findResident(ctx, residentId)
}

// Service must accept ctx just to log
async function findResident(ctx: IRequestContext, id: string) {
  const logger = Logger.loggerFromCtx(ctx)
  logger.debug('finding resident', { id })

  // Must pass ctx to repository...
  return repository.getById(ctx, id)
}
```

### After (with AsyncLocalStorage)

```typescript
// Context is set once at the middleware level, flows automatically
async function handleRequest(req, res) {
  const logger = getLogger()   // ← picks up context from AsyncLocalStorage
  logger.info('handling request')

  await residentService.findResident(residentId)
}

// No ctx parameter needed — logger has full context automatically
async function findResident(id: string) {
  const logger = getLogger()
  logger.debug('finding resident', { id })

  return repository.getById(id)
}
```

This applies equally to **background jobs, cron tasks, and event source handlers** — anywhere an async execution scope starts, we initialize `AsyncLocalStorage` once, and every function within that scope gets automatic context.

## 3. Proposed Solution: Pino + AsyncLocalStorage

### Why Pino over Winston (current)

| Aspect | Winston (current) | Pino |
|---|---|---|
| **Performance** | ~5-10x slower | Fastest Node.js logger ([benchmarks](https://github.com/pinojs/pino/blob/main/docs/benchmarks.md)) |
| **Output format** | Requires transport configuration for JSON | Native JSON output by default |
| **Child loggers** | Supported but verbose | First-class `child()` support — ideal for per-request context fields |
| **Ecosystem** | Mature but aging | Actively maintained, used by Fastify, NestJS, and others |
| **CloudWatch compatibility** | Needs formatting | Native JSON output is directly queryable in CloudWatch Log Insights |

Pino's native JSON output and `child()` logger pattern align perfectly with our existing `callRef`/`serviceRef` architecture. Each incoming request creates a child logger with correlation IDs, and that child automatically serializes every log entry with those fields.

### CloudWatch Log Insights integration

With consistent structured JSON, every log line becomes queryable:

```
# Find all logs for a specific request flow across services
fields @timestamp, @message
| filter callRef = "b71f6239-3a39-4662-90ed-2ed124238c5a"
| sort @timestamp asc

# Count errors per service in the last hour
fields @timestamp, appName, level
| filter level = "error"
| stats count() by appName

# Trace a slow request
fields @timestamp, appName, message, duration
| filter callRef = "b71f6239-3a39-4662-90ed-2ed124238c5a"
| sort @timestamp asc
```

This is only possible when **every log line** has consistent structured fields — which the current mix of `console.*` and Winston cannot guarantee.

## 4. Impact

### Scope

**19 backend services** depend on `tiny-backend-tools`. The new logging standard will be implemented in `tiny-backend-tools` and adopted by services incrementally.

### What changes for developers

| Today | After |
|---|---|
| `const ctx = getContext(req)` | `const logger = getLogger()` |
| `const logger = Logger.loggerFromCtx(ctx)` | `logger.info('message', { data })` |
| Pass `ctx` through every function | Context propagates automatically |
| `console.error(error)` in catch blocks | `getLogger().error('message', { error })` — with full context |
| No masking | Sensitive fields redacted automatically |
| Inconsistent JSON | Every line is structured, queryable JSON |

### What changes for QE / Ops

- Given a single `callRef` (correlation ID), trace the entire request flow across all 19 services in CloudWatch Log Insights
- Accurate error counts per service — no duplicates, no noise
- Foundation for future alerting and dashboards

## 5. Next Steps

This proposal focuses on **the "why" and "what"**. Upon approval, a detailed implementation plan will cover:

- Log schema definition (required fields, naming conventions)
- AsyncLocalStorage integration design for HTTP requests, background jobs, cron tasks, and event source handlers
- Sensitive data masking rules and implementation
- Error handling standardization
- Migration strategy and rollout plan per service
- Backward compatibility approach during transition