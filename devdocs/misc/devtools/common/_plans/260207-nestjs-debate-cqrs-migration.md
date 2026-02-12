# 260207 - Migrate nestjs-debate to CQRS (@nestjs/cqrs)

## References

- `devdocs/misc/devtools/OVERVIEW.md` — DevTools global overview
- `devdocs/misc/devtools/common/nestjs-debate/OVERVIEW.md` — Current debate module overview
- `devdocs/misc/devtools/common/_plans/Server-side Action-driven Architecture.md` — Original action-driven architecture proposal (superseded by this plan)
- `devtools/common/nestjs-debate/src/debate.module.ts` — Current module definition
- `devtools/common/nestjs-debate/src/debate.controller.ts` — Current controller
- `devtools/common/nestjs-debate/src/debate.service.ts` — Current debate service (reads + writes)
- `devtools/common/nestjs-debate/src/argument.service.ts` — Current argument service (writes + WS broadcast)
- `devtools/common/nestjs-debate/src/debate.gateway.ts` — Current WebSocket gateway
- `devtools/common/nestjs-debate/src/types.ts` — Current type definitions
- `devtools/common/server/src/main.ts` — Server bootstrap (logger config goes here)
- `devtools/common/server/src/app.module.ts` — Root module (LoggerModule import)
- @nestjs/cqrs docs: https://docs.nestjs.com/recipes/cqrs
- nestjs-pino docs: https://github.com/iamolegga/nestjs-pino
- pino docs: https://getpino.io

## User Requirements

1. **Event effect pipeline** — Core pattern: event → process → event. Extensibility by adding effects, not modifying existing code.
2. **In-memory state management** — Managed alongside event effects. No need for separate state library (Jotai ruled out — plain NestJS services sufficient).
3. **AI agent debuggability** — CQRS chosen specifically because named Commands/Events create structured, filterable logs. AI agents can reconstruct flow graphs from logs + correlationId. This is a primary motivation, not a secondary benefit.
4. **Bus-level middleware** — Auto-log all Commands/Events at bus level so developers don't need to manually add logging in every handler.
5. **CorrelationId** — Every Command and Event carries correlationId to enable end-to-end flow tracing from a single request.
6. **Pino structured logging** — Integrate pino as the logging backbone for the entire server. Structured JSON logs by default (production), pino-pretty for dev. HTTP request auto-logging via pino-http. pino child loggers carry correlationId context automatically.

## 🎯 Objective

Migrate `@aweave/nestjs-debate` from layered architecture (Controller → Service → DB + WS broadcast) to CQRS pattern using `@nestjs/cqrs`. This establishes the reference implementation for all future NestJS feature modules in the devtools ecosystem.

### ⚠️ Key Considerations

1. **Incremental migration** — The debate module is in production use. Each phase must be independently deployable. No big-bang rewrite.

2. **Read path stays simple** — QueryBus is optional overhead for reads. Plan uses direct service calls for GET endpoints (no QueryHandler boilerplate). Only write path goes through CommandBus.

3. **AI agent debuggability is a first-class concern** — Bus-level logging middleware must be implemented BEFORE migrating commands. Every command/event must produce structured log entries that an AI agent can filter by correlationId and reconstruct the full flow graph.

4. **Side effects decouple via Events** — WebSocket broadcast and auto-ruling currently live inside service methods. After migration, they become independent EventHandlers and Sagas — addable/removable without touching write logic.

5. **Dependencies: @nestjs/cqrs + pino stack** — RxJS already bundled with NestJS. No Jotai, no custom EventBus. Use @nestjs/cqrs Sagas for RxJS-based event effects. Pino stack (`nestjs-pino`, `pino-http`, `pino-pretty`) installed at server level — all modules benefit.

6. **Pino is server-wide, not debate-specific** — Pino logger is configured in `@aweave/server` (root module), not in `@aweave/nestjs-debate`. The debate module's CQRS middleware uses `PinoLogger` (injectable from `nestjs-pino`). This means pino setup is a prerequisite step that benefits all current and future NestJS modules.

7. **Pino replaces NestJS default Logger transparently** — After setup, existing `Logger` from `@nestjs/common` is backed by pino. No need to update every file at once. Explicit `PinoLogger` used only where structured context (correlationId, commandName) is needed (CQRS middleware, Sagas).

8. **Existing behavior must be preserved** — API contract (REST endpoints, WebSocket events, response format) does not change. Clients (CLI, debate-web) require zero updates.

9. **Saga for auto-ruling** — The current nested `submitArgument()` call inside `submitResolution()` becomes a Saga: `ArgumentSubmittedEvent(RESOLUTION)` → `SubmitArgumentCommand(RULING, close=true)`. This decouples auto-ruling from the resolution submission path.

## 🔄 Implementation Plan

### Phase 1: Analysis & Preparation

- [ ] Install pino stack in `@aweave/server` (server-wide)
  - **Command**: `cd devtools/common/server && pnpm add nestjs-pino pino-http && pnpm add -D pino-pretty`
  - **Outcome**: Pino available to all NestJS modules. No behavior change yet (LoggerModule not imported).
  - **Note**: `pino` itself is a transitive dep of `nestjs-pino` — no need to install separately.
- [ ] Install `@nestjs/cqrs` dependency in `@aweave/nestjs-debate`
  - **Command**: `cd devtools/common/nestjs-debate && pnpm add @nestjs/cqrs`
  - **Outcome**: Dependency added, no breaking changes (CqrsModule not imported yet)
- [ ] Install `nestjs-pino` in `@aweave/nestjs-debate` (for `PinoLogger` injectable in CQRS middleware)
  - **Command**: `cd devtools/common/nestjs-debate && pnpm add nestjs-pino`
  - **Outcome**: `PinoLogger` importable. Actual pino instance provided by server's `LoggerModule.forRoot()`.
- [ ] Define Command/Event type inventory based on current service methods
  - **Outcome**: Complete list of Commands and Events (documented below in Phase 2)
- [ ] Define correlationId propagation strategy
  - **Outcome**: `pino-http` auto-generates request ID per HTTP request → used as correlationId. WebSocket connections generate their own correlationId. Threaded through Commands → Events → Sagas via `Correlatable` interface.
- [ ] Verify @nestjs/cqrs Saga behavior: confirm Saga emitted Commands go through CommandBus (and thus through logging middleware)
  - **Outcome**: Confirmed or documented workaround

### Phase 2: Implementation (File/Code/Test Structure)

```
devtools/common/server/src/
├── main.ts                           # 🔄 Add pino as NestJS logger (bufferLogs)
├── app.module.ts                     # 🔄 Import LoggerModule.forRoot(pinoConfig)
├── shared/
│   └── logger/
│       └── pino.config.ts            # 🚧 NEW — Pino configuration (env-based level, pino-pretty for dev)

devtools/common/nestjs-debate/src/
├── debate.module.ts                  # 🔄 Add CqrsModule import, register handlers/sagas
├── debate.controller.ts              # 🔄 Writes: dispatch commands. Reads: keep direct service calls
├── debate-prisma.service.ts          # ✅ No change
├── lock.service.ts                   # ✅ No change
├── errors.ts                         # ✅ No change
├── types.ts                          # ✅ No change
├── serializers.ts                    # ✅ No change
├── dto/                              # ✅ No change
│
├── cqrs/                             # 🚧 NEW — CQRS infrastructure
│   ├── interfaces.ts                 # Base interfaces: Correlatable (correlationId + causationId)
│   ├── logging-command-bus.ts        # Extends CommandBus, auto-log via PinoLogger
│   ├── logging-event-bus.ts          # Extends EventBus, auto-log via PinoLogger
│   └── index.ts                      # Barrel export
│
├── commands/                         # 🚧 NEW — Write operations
│   ├── create-debate.command.ts      # CreateDebateCommand
│   ├── create-debate.handler.ts      # Logic from DebateService.createDebate()
│   ├── submit-argument.command.ts    # SubmitArgumentCommand (covers CLAIM, APPEAL, RESOLUTION, INTERVENTION, RULING)
│   ├── submit-argument.handler.ts    # Logic from ArgumentService.submitArgument()
│   ├── delete-debate.command.ts      # DeleteDebateCommand
│   ├── delete-debate.handler.ts      # Logic from DebateService.deleteDebate()
│   └── index.ts                      # Barrel export: all handlers
│
├── events/                           # 🚧 NEW — Domain events + side effect handlers
│   ├── debate-created.event.ts       # DebateCreatedEvent
│   ├── argument-submitted.event.ts   # ArgumentSubmittedEvent (type field distinguishes CLAIM/APPEAL/etc)
│   ├── debate-deleted.event.ts       # DebateDeletedEvent
│   ├── broadcast.handler.ts          # EventHandler: WS broadcast on DebateCreated + ArgumentSubmitted
│   └── index.ts                      # Barrel export: all events + handlers
│
├── sagas/                            # 🚧 NEW — Event-to-Command orchestration (RxJS)
│   ├── debate.sagas.ts               # Auto-ruling: ArgumentSubmitted(RESOLUTION) → SubmitArgumentCommand(RULING)
│   └── index.ts                      # Barrel export
│
├── queries/                          # 🚧 NEW — Read services (thin refactor, no QueryBus)
│   └── debate-read.service.ts        # Extracted read methods from DebateService (getDebate, listDebates, poll)
│
├── debate.service.ts                 # 🔄 REMOVE after migration (replaced by commands/ + queries/)
├── argument.service.ts               # 🔄 REMOVE after migration (replaced by commands/)
└── debate.gateway.ts                 # 🔄 Minor: remove setHandlers pattern, EventHandler calls gateway directly
```

### Phase 3: Detailed Implementation Steps

---

#### Step 1: Pino Logger Setup (server-wide)

**Goal:** Replace NestJS default logger with pino. This is done FIRST at server level so all subsequent CQRS logging uses pino from day one.

##### 1.1 — Pino configuration (`devtools/common/server/src/shared/logger/pino.config.ts`)

```typescript
import type { Params } from 'nestjs-pino';

export function createPinoConfig(): Params {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

      // Dev: human-readable. Prod: structured JSON (no transport = raw JSON to stdout)
      transport: !isProduction
        ? { target: 'pino-pretty', options: { colorize: true, singleLine: false } }
        : undefined,

      // Auto-generate request ID → becomes correlationId for CQRS flow
      genReqId: (req, res) => {
        const existing = req.headers['x-correlation-id'];
        if (existing) return existing;
        const id = crypto.randomUUID();
        res.setHeader('x-correlation-id', id);
        return id;
      },

      // Avoid logging large request/response bodies
      serializers: {
        req: (req) => ({ method: req.method, url: req.url, id: req.id }),
        res: (res) => ({ statusCode: res.statusCode }),
      },

      // Custom log attributes per request
      customProps: (req) => ({
        correlationId: req.id,
      }),

      // Don't log health check requests (noise reduction)
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
    },
  };
}
```

**Key design decisions:**
- `genReqId`: Accepts `x-correlation-id` header from clients, or generates UUID. This ID propagates to all pino child loggers in the request scope.
- `autoLogging.ignore`: Suppresses `/health` endpoint logging (polled every few seconds by CLI, would flood logs).
- `pino-pretty` only in dev (via `transport`). In production, raw JSON to stdout — consumed by log aggregators or AI agents.

##### 1.2 — Wire pino into server (`devtools/common/server/src/app.module.ts`)

```typescript
import { LoggerModule } from 'nestjs-pino';
import { createPinoConfig } from './shared/logger/pino.config';

@Module({
  imports: [
    LoggerModule.forRoot(createPinoConfig()),
    DebateModule,
    // ... other modules
  ],
})
export class AppModule {}
```

##### 1.3 — Use pino as NestJS logger (`devtools/common/server/src/main.ts`)

```typescript
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));  // ← pino backs ALL NestJS logging from here
  // ... rest of bootstrap
}
```

**`bufferLogs: true`**: NestJS buffers log messages during startup until pino logger is ready. No log messages lost.

**After this step:** Every `Logger` from `@nestjs/common` (including existing debate module logs) automatically outputs via pino. Zero changes needed in existing files.

##### 1.4 — Pino log output examples

**Dev mode (pino-pretty):**
```
[14:32:05.123] INFO (aweave-server): Request completed
    correlationId: "abc-123"
    req: {"method":"POST","url":"/debates"}
    res: {"statusCode":201}
    responseTime: 12
```

**Production mode (JSON):**
```json
{"level":30,"time":1707307925123,"pid":1234,"hostname":"server","correlationId":"abc-123","req":{"method":"POST","url":"/debates"},"res":{"statusCode":201},"responseTime":12,"msg":"Request completed"}
```

**AI agent parses:** `jq 'select(.correlationId == "abc-123")' server.log` → all logs for one request.

---

#### Step 2: CQRS Infrastructure (cqrs/)

**Goal:** Base interfaces + logging bus middleware using PinoLogger. Built BEFORE any commands/events.

##### 2.1 — Base interfaces (`cqrs/interfaces.ts`)

```typescript
/**
 * All Commands and Events implement this for end-to-end tracing.
 * - correlationId: links all commands/events from the same originating request
 *   (originates from pino-http request ID or manually generated for WS)
 * - causationId: the specific command/event that directly caused this one
 */
export interface Correlatable {
  readonly correlationId: string;
  readonly causationId?: string;
}
```

##### 2.2 — Logging CommandBus (`cqrs/logging-command-bus.ts`)

Uses `PinoLogger` from `nestjs-pino` for structured logging with automatic context.

```typescript
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import type { Correlatable } from './interfaces';

@Injectable()
export class LoggingCommandBus extends CommandBus {
  constructor(private readonly logger: PinoLogger) {
    super();
    this.logger.setContext('CommandBus');
  }

  async execute<T>(command: any): Promise<T> {
    const name = command.constructor.name;
    const correlationId = (command as Correlatable).correlationId ?? 'unknown';
    const meta = this.extractMeta(command);

    this.logger.info({ phase: 'command:start', command: name, correlationId, ...meta });

    try {
      const result = await super.execute<T>(command);
      this.logger.info({ phase: 'command:done', command: name, correlationId });
      return result;
    } catch (err: any) {
      this.logger.error({
        phase: 'command:error',
        command: name,
        correlationId,
        error: err.message,
        errorCode: err.code,
      });
      throw err;
    }
  }

  /** Extract loggable metadata from command (exclude large content fields) */
  private extractMeta(command: any): Record<string, unknown> {
    const meta: Record<string, unknown> = {};
    if (command.debateId) meta.debateId = command.debateId;
    if (command.type) meta.argumentType = command.type;
    if (command.role) meta.role = command.role;
    if (command.actionName) meta.action = command.actionName;
    // Deliberately omit: content (up to 10KB), motionContent
    return meta;
  }
}
```

##### 2.3 — Logging EventBus (`cqrs/logging-event-bus.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import type { Correlatable } from './interfaces';

@Injectable()
export class LoggingEventBus extends EventBus {
  constructor(private readonly logger: PinoLogger) {
    super();
    this.logger.setContext('EventBus');
  }

  publish<T>(event: T): void {
    const name = (event as any).constructor.name;
    const correlationId = (event as Correlatable).correlationId ?? 'unknown';
    const meta: Record<string, unknown> = {};
    if ((event as any).debateId) meta.debateId = (event as any).debateId;
    if ((event as any).argumentType) meta.argumentType = (event as any).argumentType;

    this.logger.info({ phase: 'event', event: name, correlationId, ...meta });
    super.publish(event);
  }
}
```

##### 2.4 — Pino log output for CQRS flow (complete example)

**Dev mode (pino-pretty):**
```
[14:32:05.100] INFO (CommandBus): command:start
    command: "SubmitArgumentCommand"
    correlationId: "abc-123"
    debateId: "xyz-456"
    argumentType: "RESOLUTION"
    role: "proposer"
[14:32:05.115] INFO (CommandBus): command:done
    command: "SubmitArgumentCommand"
    correlationId: "abc-123"
[14:32:05.116] INFO (EventBus): event
    event: "ArgumentSubmittedEvent"
    correlationId: "abc-123"
    debateId: "xyz-456"
    argumentType: "RESOLUTION"
[14:32:05.117] INFO (Saga): saga:trigger
    saga: "autoRuling"
    from: "ArgumentSubmittedEvent(RESOLUTION)"
    to: "SubmitArgumentCommand(RULING)"
    correlationId: "abc-123"
[14:32:05.118] INFO (CommandBus): command:start
    command: "SubmitArgumentCommand"
    correlationId: "abc-123"
    argumentType: "RULING"
[14:32:05.130] INFO (CommandBus): command:done
    command: "SubmitArgumentCommand"
    correlationId: "abc-123"
[14:32:05.131] INFO (EventBus): event
    event: "ArgumentSubmittedEvent"
    correlationId: "abc-123"
    argumentType: "RULING"
```

**Production mode (JSON — AI agent consumes):**
```json
{"level":30,"time":1707307925100,"context":"CommandBus","phase":"command:start","command":"SubmitArgumentCommand","correlationId":"abc-123","debateId":"xyz-456","argumentType":"RESOLUTION","role":"proposer"}
{"level":30,"time":1707307925115,"context":"CommandBus","phase":"command:done","command":"SubmitArgumentCommand","correlationId":"abc-123"}
{"level":30,"time":1707307925116,"context":"EventBus","phase":"event","event":"ArgumentSubmittedEvent","correlationId":"abc-123","debateId":"xyz-456","argumentType":"RESOLUTION"}
{"level":30,"time":1707307925117,"context":"Saga","phase":"saga:trigger","saga":"autoRuling","correlationId":"abc-123"}
{"level":30,"time":1707307925118,"context":"CommandBus","phase":"command:start","command":"SubmitArgumentCommand","correlationId":"abc-123","argumentType":"RULING"}
{"level":30,"time":1707307925130,"context":"CommandBus","phase":"command:done","command":"SubmitArgumentCommand","correlationId":"abc-123"}
{"level":30,"time":1707307925131,"context":"EventBus","phase":"event","event":"ArgumentSubmittedEvent","correlationId":"abc-123","argumentType":"RULING"}
```

**AI agent flow reconstruction:**
```bash
# Filter all logs for one request
jq 'select(.correlationId == "abc-123")' server.log

# Filter only CQRS events (commands + events + sagas)
jq 'select(.correlationId == "abc-123" and (.phase | startswith("command:") or startswith("event") or startswith("saga:")))' server.log

# Show only the flow graph (phase + name)
jq -r 'select(.correlationId == "abc-123") | "\(.time) [\(.context)] \(.phase) \(.command // .event // .saga // "")"' server.log
```

**Test:** Unit test that LoggingCommandBus and LoggingEventBus produce expected pino output.

---

#### Step 3: Command Definitions (commands/)

**Goal:** Define all Command classes. Pure data, no logic.

##### 3.1 — `CreateDebateCommand`

```typescript
export class CreateDebateCommand implements Correlatable {
  constructor(
    public readonly debateId: string,
    public readonly title: string,
    public readonly debateType: string,
    public readonly motionContent: string,
    public readonly clientRequestId: string,
    public readonly correlationId: string,
    public readonly causationId?: string,
  ) {}
}
```

##### 3.2 — `SubmitArgumentCommand`

Covers all argument types (CLAIM, APPEAL, RESOLUTION, INTERVENTION, RULING) — same as current `submitArgument()` private method.

```typescript
export class SubmitArgumentCommand implements Correlatable {
  constructor(
    public readonly debateId: string,
    public readonly role: Role,
    public readonly parentId: string | null,
    public readonly type: ArgumentType,
    public readonly content: string,
    public readonly clientRequestId: string | null,
    public readonly actionName: string,
    public readonly correlationId: string,
    public readonly close?: boolean,
    public readonly causationId?: string,
  ) {}
}
```

##### 3.3 — `DeleteDebateCommand`

```typescript
export class DeleteDebateCommand implements Correlatable {
  constructor(
    public readonly debateId: string,
    public readonly correlationId: string,
  ) {}
}
```

---

#### Step 4: Event Definitions (events/)

**Goal:** Define domain events. Past tense, immutable facts.

##### 4.1 — `DebateCreatedEvent`

```typescript
export class DebateCreatedEvent implements Correlatable {
  constructor(
    public readonly debateId: string,
    public readonly debate: any,       // serialized debate
    public readonly argument: any,     // serialized motion argument
    public readonly correlationId: string,
    public readonly causationId?: string,
  ) {}
}
```

##### 4.2 — `ArgumentSubmittedEvent`

```typescript
export class ArgumentSubmittedEvent implements Correlatable {
  constructor(
    public readonly debateId: string,
    public readonly debate: any,        // serialized updated debate
    public readonly argument: any,      // serialized new argument
    public readonly argumentType: ArgumentType,  // CLAIM, APPEAL, RESOLUTION, etc.
    public readonly correlationId: string,
    public readonly causationId?: string,
  ) {}
}
```

##### 4.3 — `DebateDeletedEvent`

```typescript
export class DebateDeletedEvent implements Correlatable {
  constructor(
    public readonly debateId: string,
    public readonly correlationId: string,
  ) {}
}
```

---

#### Step 5: Command Handlers (commands/)

**Goal:** Move business logic from services into handlers. Logic stays identical — just relocated.

##### 5.1 — `CreateDebateHandler`

- **Source:** Copy logic from `DebateService.createDebate()` (lines 56-133 of `debate.service.ts`)
- **Changes:**
  - Input: `CreateDebateCommand` (instead of plain object)
  - Inject: `DebatePrismaService`, `LockService`, `EventBus` (instead of `DebateGateway`)
  - After successful transaction: `this.eventBus.publish(new DebateCreatedEvent(...))` instead of `this.gateway.broadcastNewArgument()`
  - Return: `{ debate, argument }` (same shape)

##### 5.2 — `SubmitArgumentHandler`

- **Source:** Copy logic from `ArgumentService.submitArgument()` (lines 69-188 of `argument.service.ts`)
- **Changes:**
  - Input: `SubmitArgumentCommand`
  - Inject: `DebatePrismaService`, `LockService`, `EventBus`
  - After successful transaction: `this.eventBus.publish(new ArgumentSubmittedEvent(...))` instead of `this.gateway.broadcastNewArgument()`
  - **Remove auto-ruling logic** — this moves to Saga (Step 6)
  - Return: `{ debate, argument }`

##### 5.3 — `DeleteDebateHandler`

- **Source:** Copy logic from `DebateService.deleteDebate()` (lines 195-207 of `debate.service.ts`)
- **Changes:**
  - After successful deletion: `this.eventBus.publish(new DebateDeletedEvent(...))`

---

#### Step 6: Event Handlers (events/)

**Goal:** Extract side effects into independent, addable/removable handlers.

##### 6.1 — `BroadcastHandler`

Handles: `DebateCreatedEvent`, `ArgumentSubmittedEvent`

```typescript
@EventsHandler(DebateCreatedEvent, ArgumentSubmittedEvent)
export class BroadcastHandler
  implements IEventHandler<DebateCreatedEvent | ArgumentSubmittedEvent>
{
  constructor(private readonly gateway: DebateGateway) {}

  handle(event: DebateCreatedEvent | ArgumentSubmittedEvent) {
    this.gateway.broadcastNewArgument(
      event.debateId,
      event.debate,
      event.argument,
    );
  }
}
```

**This is the key decouple:** Adding new reactions (analytics, audit log, external webhook) = add new `@EventsHandler` class. Zero changes to CommandHandlers.

---

#### Step 7: Saga (sagas/)

**Goal:** Auto-ruling on resolution. Currently a nested `submitArgument()` call inside `submitResolution()`.

##### 7.1 — `DebateSagas`

```typescript
@Injectable()
export class DebateSagas {
  private readonly logger: PinoLogger;

  constructor(logger: PinoLogger) {
    this.logger = logger;
    this.logger.setContext('Saga');
  }

  @Saga()
  autoRulingOnResolution = (events$: Observable<IEvent>): Observable<ICommand> => {
    return events$.pipe(
      ofType(ArgumentSubmittedEvent),
      filter((event: ArgumentSubmittedEvent) => event.argumentType === 'RESOLUTION'),
      tap(event => this.logger.info({
        phase: 'saga:trigger',
        saga: 'autoRuling',
        from: `ArgumentSubmittedEvent(RESOLUTION)`,
        to: `SubmitArgumentCommand(RULING)`,
        correlationId: event.correlationId,
        debateId: event.debateId,
      })),
      map(event => new SubmitArgumentCommand(
        event.debateId,
        'arbitrator',
        null,
        'RULING',
        'Auto-approved: Debate completed as requested by proposer.',
        null,                    // no client_request_id
        'submit_ruling',
        event.correlationId,    // same correlationId!
        true,                   // close
        `ArgumentSubmittedEvent:${event.debateId}`,  // causationId
      )),
    );
  };
}
```

**Flow tracing via pino logs — see Step 2.4 for complete log output examples.**

AI agent filters `correlationId=abc-123` via `jq` → sees complete flow, reconstructs graph.

---

#### Step 8: Read Service (queries/)

**Goal:** Extract read methods from `DebateService` into `DebateReadService`. No QueryBus — direct service calls.

##### 8.1 — `DebateReadService`

- **Source:** Extract from `DebateService`:
  - `getDebate()` (line 135-141)
  - `getDebateWithArgs()` (line 143-171)
  - `listDebates()` (line 173-193)
  - `poll()` (line 213-271)
- **No CommandBus/EventBus needed** — pure reads
- **Controller calls directly:** `this.readService.getDebateWithArgs(id)`

---

#### Step 9: Update Controller

**Goal:** Controller becomes thin dispatcher for writes, direct caller for reads.

```typescript
@Controller()
export class DebateController {
  constructor(
    private readonly commandBus: CommandBus,     // writes
    private readonly readService: DebateReadService,  // reads (direct)
  ) {}

  // WRITE — dispatch command
  @Post('debates')
  async createDebate(@Body() body: CreateDebateBodyDto) {
    const correlationId = randomUUID();
    const result = await this.commandBus.execute(
      new CreateDebateCommand(body.debate_id, body.title, ..., correlationId)
    );
    return ok(serializeWriteResult(result));
  }

  // WRITE — dispatch command
  @Post('debates/:id/arguments')
  async submitArgument(@Param('id') debateId: string, @Body() body) {
    const correlationId = randomUUID();
    const result = await this.commandBus.execute(
      new SubmitArgumentCommand(debateId, body.role, ..., correlationId)
    );
    return ok(serializeWriteResult(result));
  }

  // READ — direct service call (no CommandBus overhead)
  @Get('debates/:id')
  async getDebate(@Param('id') debateId: string) {
    const result = await this.readService.getDebateWithArgs(debateId);
    return ok({ debate: serializeDebate(result.debate), ... });
  }

  // READ — direct
  @Get('debates')
  async listDebates(...) {
    return ok(await this.readService.listDebates({ state, limit, offset }));
  }
}
```

**Note:** Validation logic stays in controller (same as current). `commandBus.execute()` returns the result synchronously — client response is immediate. Events fire asynchronously after.

---

#### Step 10: Update Gateway

**Goal:** Simplify gateway — remove `setHandlers` pattern.

Current problem: `DebateModule.onModuleInit` wires gateway ↔ services via callbacks to avoid circular dependency. With CQRS:

- **Server → Client** (broadcast): Handled by `BroadcastHandler` (EventHandler) — gateway is a simple sink, no service dependency.
- **Client → Server** (submit_intervention, submit_ruling): Gateway dispatches commands via `CommandBus`.

```typescript
@WebSocketGateway({ path: '/ws' })
export class DebateGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly readService: DebateReadService,
  ) {}

  async handleConnection(client: WebSocket, ...args: unknown[]) {
    // ... auth, parse debate_id (same as current)
    // Send initial state directly
    const initial = await this.readService.getDebateWithArgs(debateId);
    this.send(client, { event: 'initial_state', data: serializeInitialState(initial) });
  }

  @SubscribeMessage('submit_intervention')
  async handleIntervention(client: WebSocket, data: { debate_id: string; content?: string }) {
    const correlationId = randomUUID();
    await this.commandBus.execute(
      new SubmitArgumentCommand(data.debate_id, 'arbitrator', null, 'INTERVENTION', ...)
    );
  }

  @SubscribeMessage('submit_ruling')
  async handleRuling(client: WebSocket, data: { debate_id: string; content: string; close?: boolean }) {
    const correlationId = randomUUID();
    await this.commandBus.execute(
      new SubmitArgumentCommand(data.debate_id, 'arbitrator', null, 'RULING', ...)
    );
  }

  // broadcastNewArgument() stays the same — called by BroadcastHandler
}
```

**Benefit:** `setHandlers()` pattern and `onModuleInit` wiring in `DebateModule` are eliminated. Circular dependency gone.

---

#### Step 11: Update Module + Cleanup

##### 11.1 — Update `debate.module.ts`

```typescript
import { CqrsModule } from '@nestjs/cqrs';

@Module({
  imports: [CqrsModule],
  providers: [
    // Infrastructure
    DebatePrismaService,
    LockService,
    DebateGateway,
    // Read service
    DebateReadService,
    // Command Handlers
    CreateDebateHandler,
    SubmitArgumentHandler,
    DeleteDebateHandler,
    // Event Handlers
    BroadcastHandler,
    // Sagas
    DebateSagas,
    // Logging (override default buses)
    { provide: CommandBus, useClass: LoggingCommandBus },
    { provide: EventBus, useClass: LoggingEventBus },
  ],
  controllers: [DebateController],
  exports: [DebateReadService],
})
export class DebateModule {}
```

##### 11.2 — Delete old services

- Delete `debate.service.ts` (replaced by `commands/create-debate.handler.ts` + `commands/delete-debate.handler.ts` + `queries/debate-read.service.ts`)
- Delete `argument.service.ts` (replaced by `commands/submit-argument.handler.ts`)

##### 11.3 — Update barrel export (`index.ts`)

```typescript
export { DebateModule } from './debate.module';
export { DebateReadService } from './queries/debate-read.service';
export { DebateGateway } from './debate.gateway';
export * from './dto';
export type { WsEvent, ServerToClientEvent, ... } from './ws-types';
// Export command/event classes for external consumers if needed
export * from './commands';
export * from './events';
```

---

#### Step 12: Verification

- [ ] **Pino logging works**: Server starts with pino → structured JSON logs visible in stdout
- [ ] **pino-pretty works in dev**: `pnpm start:dev` shows colorized, human-readable logs
- [ ] **HTTP auto-logging**: Every REST request logged with correlationId, method, url, statusCode, responseTime
- [ ] **Health check suppressed**: `GET /health` does NOT appear in logs (autoLogging.ignore)
- [ ] **CQRS bus logging**: Every CommandBus.execute and EventBus.publish logged with phase, name, correlationId
- [ ] **CorrelationId flow**: Filter logs by correlationId → see complete command/event chain for a single request
- [ ] All existing REST API tests pass (same endpoints, same request/response format)
- [ ] WebSocket events unchanged (initial_state, new_argument)
- [ ] Auto-ruling on resolution works via Saga
- [ ] CLI commands (`aw debate create`, `aw debate submit`, etc.) work without changes
- [ ] debate-web WebSocket client works without changes
- [ ] Saga failure (auto-ruling fails) does not break resolution submission (same as current try/catch behavior)
- [ ] Build passes: `cd devtools/common/nestjs-debate && pnpm build`
- [ ] Server build passes: `cd devtools/common/server && pnpm build`
- [ ] Server starts: `cd devtools/common/server && pnpm start:dev`

---

### Migration Summary: Before → After

**Before (layered):**
```
Controller.submitResolution()
  └── ArgumentService.submitResolution()
        ├── ArgumentService.submitArgument(RESOLUTION)    ← DB + broadcast
        └── ArgumentService.submitArgument(RULING)        ← DB + broadcast (auto-ruling, nested)
```
3 layers, side effects mixed in, 2 files.

**After (CQRS):**
```
Controller.submitResolution()
  └── CommandBus.execute(SubmitArgumentCommand(RESOLUTION))     ← log: command:start
        └── SubmitArgumentHandler.execute()                      ← DB only
              └── EventBus.publish(ArgumentSubmittedEvent(RESOLUTION))  ← log: event
                    ├── BroadcastHandler → WS broadcast           ← log: event:handler
                    └── DebateSagas.autoRuling                    ← log: saga:trigger
                          └── CommandBus.execute(SubmitArgumentCommand(RULING))  ← log: command:start
                                └── SubmitArgumentHandler.execute()               ← DB only
                                      └── EventBus.publish(ArgumentSubmittedEvent(RULING))
                                            └── BroadcastHandler → WS broadcast
```
Each node has a name. Each transition logged. AI agent reconstructs from correlationId.

## 📊 Summary of Results

> Do not summarize the results until the implementation is done and I request it

### ✅ Completed Achievements

- (pending implementation)

## 🚧 Outstanding Issues & Follow-up

### ⚠️ Issues/Clarifications

- [ ] **LoggingCommandBus/EventBus override** — Need to verify @nestjs/cqrs allows overriding `CommandBus`/`EventBus` via module providers. If not, alternative: use NestJS Interceptor on CommandBus, or subscribe to `EventBus` stream for logging.
- [ ] **Saga error handling** — If auto-ruling Saga fails, should the error propagate? Current behavior: try/catch in `submitResolution()`, warn log, continue. Saga must replicate this: errors in Saga-emitted commands should not crash the Saga stream. Confirm `catchError` in RxJS pipe + re-subscribe behavior.
- [ ] **Gateway circular dependency** — Current `setHandlers` pattern exists because Gateway and Services have circular deps. With CQRS, Gateway depends on CommandBus (no circular). But `BroadcastHandler` depends on Gateway. Verify NestJS DI resolves `BroadcastHandler → DebateGateway` without circular issues (both are providers in same module, should be fine).
- [ ] **Event serialization in logs** — Command/Event payloads may contain large content strings (up to 10KB). Logging middleware (Step 2) deliberately omits `content` and `motionContent` fields. Verify no accidental serialization of large fields via pino's default behavior.
- [ ] **pino-http + WebSocket** — `pino-http` auto-logs HTTP requests but does NOT auto-log WebSocket messages. WS commands are logged explicitly via LoggingCommandBus when gateway dispatches commands. Verify WS-originated flows have correlationId (generated in gateway's `handleIntervention`/`handleRuling`).
- [ ] **pino-pretty as devDependency** — `pino-pretty` installed as devDependency in `@aweave/server`. In production, `transport` is `undefined` → pino writes raw JSON to stdout. Verify production build does NOT fail due to missing `pino-pretty` (it should be fine since transport is conditionally set).
- [ ] **Log level configuration** — `LOG_LEVEL` env var controls pino level. Default: `debug` (dev), `info` (production). CommandBus/EventBus logs at `info` level. Verify CQRS logs are visible at default `info` level.
- [ ] **Existing Logger calls** — After pino setup, all existing `Logger` from `@nestjs/common` (in debate-prisma.service, debate.gateway, argument.service) automatically output via pino. No code changes needed. Verify output format is consistent.
- [ ] **OVERVIEW updates** — After migration, update:
  - `devdocs/misc/devtools/common/nestjs-debate/OVERVIEW.md` — New architecture, CQRS patterns
  - `devdocs/misc/devtools/common/server/OVERVIEW.md` — Pino logger configuration
  - `devdocs/misc/devtools/OVERVIEW.md` — Add logging section to global overview
