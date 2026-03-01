---
name: Fix NestJS Logger — Support Pino-Style Call Signatures
description: Fix NestLoggerService.writeLog to detect and correctly handle Pino-style (mergingObject, messageString) call signatures alongside standard NestJS convention, resolving silent message loss and object-as-msg serialization bugs across 20+ call sites.
status: new
created: 2026-03-01
tags: [logging, nestjs, bugfix, nestjs-core]
---

# 260301 — Fix NestJS Logger Pino-Style Support

## References

- `workspaces/devtools/common/nestjs-core/src/logging/nest-logger.service.ts` — The wrapper to fix
- `workspaces/devtools/common/nestjs-debate/src/debate.gateway.ts` — Most affected file (6 Pino-style calls)
- `resources/workspaces/devtools/common/node-shared/OVERVIEW.md` — Pino logger factory docs
- `resources/workspaces/devtools/common/_plans/260301-shared-logger-node-shared.md` — Logger extraction plan (context)

## Problem

### Symptom

Log entries serialize the structured object as the `msg` field and lose the actual message string entirely:

```json
{"level":40,"time":1772364531349,"service":"nestjs-server","context":"DebateGateway","msg":"{\"debateId\":\"e102d117-...\",\"correlationId\":\"b5fe6b61-...\"}"}
```

Expected output:

```json
{"level":40,"time":1772364531349,"service":"nestjs-server","context":"DebateGateway","debateId":"e102d117-...","correlationId":"b5fe6b61-...","msg":"Failed to get initial state"}
```

### Root Cause

**API signature inversion between NestJS Logger and Pino:**

| Framework | Arg 1 | Arg 2 |
|-----------|-------|-------|
| **Pino** | merging object (structured data) | message string |
| **NestJS Logger** | message (what to log) | context (class name) |

Code throughout the NestJS codebase uses Pino convention:

```typescript
this.logger.warn({ debateId, correlationId }, 'Failed to get initial state');
```

But `this.logger = new Logger(DebateGateway.name)` is NestJS's Logger, which internally calls `NestLoggerService` with the arguments:

```
NestLoggerService.warn({ debateId, correlationId }, 'Failed to get initial state', 'DebateGateway')
```

(NestJS `Logger` appends its instance context `'DebateGateway'` as the last param.)

### Trace Through `writeLog`

1. `message` = `{ debateId, correlationId }` (object)
2. `params` = `['Failed to get initial state', 'DebateGateway']`
3. `parseParams` → last string is context: `{ context: 'DebateGateway', meta: 'Failed to get initial state' }`
4. `meta` is a string → `typeof meta === 'object'` = false → **dropped silently**
5. `message` is an object → `JSON.stringify(message)` → becomes `msg`
6. Actual message `'Failed to get initial state'` is **completely lost**

### Scope of Impact

**20+ call sites across 10 files** use the Pino-style `(object, string)` pattern:

| File | Calls | Severity |
|------|-------|----------|
| `nestjs-debate/src/debate.gateway.ts` | 6 | warn/error/log — all losing message |
| `nestjs-debate/src/argument.service.ts` | 4 | debug/log/warn — structured data serialized as msg |
| `nestjs-debate/src/debate.controller.ts` | 2 | log — structured data serialized as msg |
| `nestjs-debate/src/debate.service.ts` | 1 | log |
| `nestjs-debate/src/database.service.ts` | 1 | log |
| `nestjs-dashboard/src/services/logs.service.ts` | 2 | warn |
| `nestjs-dashboard/src/services/skills.service.ts` | 1 | warn |
| `nestjs-dashboard/src/services/configs.service.ts` | 1 | log |
| `nestjs-workspace-memory/src/workspace-memory.service.ts` | 1 | log |
| `nestjs-workspace-memory/src/mcp-tools.service.ts` | 1 | log |

> **Note:** This list is a snapshot. Use repo-wide grep for definitive verification — see Phase 2.3.

## Objective

Fix `NestLoggerService.writeLog` to support **both** NestJS and Pino call conventions without changing any call sites.

### Key Considerations

1. **Plain object detection must be strict:** A simple `typeof message === 'object'` also matches `Error`, `Date`, and class instances. The detection MUST use a proper `isPlainObject` guard (prototype check: `Object.getPrototypeOf(message) === Object.prototype || Object.getPrototypeOf(message) === null`) to avoid false positives like `logger.error(new Error('x'), 'failed')` being incorrectly treated as Pino-style structured merge.

2. **Backward compatibility:** Standard NestJS calls like `logger.log('some message')` and `logger.error('msg', stack, 'Context')` are unaffected — they don't match the detection pattern (message is a string or non-plain object).

3. **Error level: Pino-style detection must run BEFORE `parseParams`:** The current `parseParams` has separate error-level logic that maps two-string params as `(stack, context)`. For Pino-style `error({obj}, 'msg')`, this misidentifies the message string as `stack`. Fix: detect Pino-style based on raw `message` + `params` BEFORE calling `parseParams`, so the error-level parsing path is never reached for Pino-style calls.

4. **No call-site changes needed:** The fix is entirely within `NestLoggerService` — all 20+ call sites automatically start working correctly.

5. **Skill file update:** After this fix, the `devtools-nestjs-builder/SKILL.md` should document that Pino-style structured logging is the preferred convention.

## Implementation Plan

### Phase 1: Fix `writeLog` in `NestLoggerService`

**Target file:** `workspaces/devtools/common/nestjs-core/src/logging/nest-logger.service.ts`

- [ ] **1.1** Add `isPlainObject` helper to the service (private method or module-level function):

  ```typescript
  function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
  ```

  This prevents false positives on `Error`, `Date`, class instances, and arrays.

- [ ] **1.2** Restructure `writeLog` to detect Pino-style **before** calling `parseParams`.

  The core problem: `parseParams` runs first and misinterprets Pino-style params (especially at error level, where the message string gets assigned to `stack`). By detecting the Pino-style pattern on raw `message` + `params` before `parseParams`, the error-level parsing path is never reached for these calls.

  **Detection:** `message` is a plain object AND `params` contains at least one string (the first non-context string is the Pino-style message). Since NestJS `Logger` always appends the instance context as the last string param, the Pino-style message is the first string in `params`, and the NestJS context is the last.

  ```typescript
  private writeLog(
    level: pino.Level,
    message: unknown,
    params: unknown[],
  ): void {
    // Pino-style early detection: logger.warn({ key: val }, 'message string')
    // NestJS Logger appends instance context as last param, so params arrive as:
    //   ['message string', 'ContextName'] or ['message string'] (if no instance context)
    // Detect: message is plain object + first param is a string that is NOT the only param
    //         (or the only param but message is still a plain object)
    if (isPlainObject(message) && params.length > 0) {
      const pinoMsg = this.extractPinoMessage(params);
      if (pinoMsg !== undefined) {
        const nestContext = this.extractLastStringParam(params, pinoMsg);
        const asyncContext = this.logContext.getAll();
        const logObj: Record<string, unknown> = {
          ...asyncContext,
          ...(message as Record<string, unknown>),
        };
        if (nestContext) logObj.context = nestContext;
        this.pinoLogger[level](logObj, pinoMsg);
        return;
      }
    }

    // Standard NestJS-style path (unchanged)
    const { context, meta, stack } = this.parseParams(params, level);
    const asyncContext = this.logContext.getAll();
    const logObj: Record<string, unknown> = {
      ...asyncContext,
      ...(typeof meta === 'object' && meta !== null ? meta : {}),
    };

    if (context) logObj.context = context;
    if (stack) logObj.stack = stack;

    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    this.pinoLogger[level](logObj, msg);
  }
  ```

- [ ] **1.3** Implement `extractPinoMessage` and `extractLastStringParam` helpers:

  ```typescript
  /**
   * For Pino-style calls, extract the message string from params.
   * Params arrive as [pinoMsg, nestContext] after NestJS Logger processing.
   * Returns the message string, or undefined if pattern doesn't match.
   *
   * IMPORTANT: Only activates when params.length >= 2. When params.length === 1,
   * it's ambiguous — the single string could be either a Pino message or a NestJS
   * context appended by Logger. We fall back to NestJS-style to preserve backward
   * compatibility (e.g., `logger.warn({ foo: 'bar' })` where NestJS appends context).
   */
  private extractPinoMessage(params: unknown[]): string | undefined {
    if (params.length >= 2 && typeof params[0] === 'string') {
      return params[0];
    }
    return undefined;
  }

  /**
   * Extract NestJS context (last string param) excluding the pinoMsg.
   */
  private extractLastStringParam(
    params: unknown[],
    excludeMsg: string,
  ): string | undefined {
    if (params.length < 2) return undefined;
    const last = params[params.length - 1];
    return typeof last === 'string' && last !== excludeMsg ? last : undefined;
  }
  ```

  **Trace verification for all cases:**

  | Call style | `message` | `params` (after NestJS Logger) | Detection | Output |
  |---|---|---|---|---|
  | `warn({obj}, 'msg')` | `{obj}` | `['msg', 'Context']` | pinoMsg=`'msg'`, ctx=`'Context'` | `{...obj, context:'Context', msg:'msg'}` |
  | `error({obj}, 'msg')` | `{obj}` | `['msg', 'Context']` | pinoMsg=`'msg'`, ctx=`'Context'` | `{...obj, context:'Context', msg:'msg'}` |
  | `log({obj}, 'msg')` | `{obj}` | `['msg', 'Context']` | pinoMsg=`'msg'`, ctx=`'Context'` | `{...obj, context:'Context', msg:'msg'}` |
  | `log('simple msg')` | `'simple msg'` | `['Context']` | Skipped (message is string) | NestJS path |
  | `error('msg', stack, 'Ctx')` | `'msg'` | `[stack, 'Ctx']` | Skipped (message is string) | NestJS path |
  | `warn({obj})` (no msg) | `{obj}` | `['Context']` | Skipped (params.length < 2) | NestJS path — object stringified as msg, context preserved |

### Phase 2: Verify

- [ ] **2.1** Build `nestjs-core`: `cd workspaces/devtools/common/nestjs-core && pnpm build` — zero errors

- [ ] **2.2** Full build: `cd workspaces/devtools && pnpm -r build` — zero errors

- [ ] **2.3** Repo-wide scan to identify ALL affected call sites:

  ```bash
  rg 'this\.logger\.(warn|error|log|debug|verbose)\(\s*\{' --glob '*.ts' -A 2 workspaces/devtools/
  ```

  Verify at least one call from each affected NestJS module produces correct output after fix.

- [ ] **2.4** Restart NestJS server and trigger log calls:

  ```bash
  pnpm aw server restart
  pnpm aw server logs
  ```

  Verify log entries now show:
  - Structured fields as top-level keys (e.g., `"debateId": "..."`)
  - Actual message in `"msg"` field (e.g., `"msg": "Failed to get initial state"`)
  - Context still present (e.g., `"context": "DebateGateway"`)

- [ ] **2.5** Verify standard NestJS-style calls still work (no regression):
  - `logger.log('simple message')` → `{"msg": "simple message", "context": "ClassName"}`
  - `logger.error('error msg', stackTrace, 'Context')` → `{"msg": "error msg", "stack": "...", "context": "Context"}`

### Phase 3: Update Skill File

- [ ] **3.1** Update `agent/skills/common/devtools-nestjs-builder/SKILL.md` logging section to document the preferred Pino-style convention:

  ```
  // Preferred: Pino-style with structured data
  this.logger.log({ userId, action }, 'User action processed');
  this.logger.warn({ debateId, reason }, 'Debate state invalid');
  this.logger.error({ debateId, err }, 'Failed to process argument');

  // Also supported: NestJS-style simple message
  this.logger.log('Server started');
  ```
