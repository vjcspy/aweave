# 📋 [UNIFIED-SERVER: 2026-02-07] - Unified NestJS Server Architecture

## References

- Debate spec: `devdocs/misc/devtools/plans/debate.md`
- Current debate-server plan: `devdocs/misc/devtools/plans/260131-debate-server.md`
- Auto-start services plan: `devdocs/misc/devtools/plans/260204-debate-auto-start-services.md`
- DevTools overview: `devdocs/misc/devtools/OVERVIEW.md`
- Current NestJS server (init): `devtools/common/server/`
- Current debate-server (to be replaced): `devtools/common/debate-server/`
- Debate CLI: `devtools/common/cli/devtool/aweave/debate/`
- Prisma v7 SQLite docs: https://www.prisma.io/docs/orm/overview/databases/sqlite

## User Requirements

1. Replace per-feature standalone servers with a **single unified NestJS server** at `devtools/common/server/`
2. Each feature builds a **separate pnpm package** containing a NestJS module, imported into the common server
3. Use **Prisma v7** with SQLite — each feature has its own database file and Prisma client
4. Database files stored at `~/.aweave/db/<DB_NAME>.db`
5. Server serves both **REST API** and **WebSocket** (`@nestjs/websockets` + `@nestjs/platform-ws`)
6. Migrate debate-server to the new architecture as first feature module
7. Replace **long polling** with **interval polling** (client re-fetches every 2s)
8. Update debate CLI to work with the new server
9. **Fresh database start** (no data migration needed)

## 🎯 Objective

Restructure the devtools Node.js backend from standalone per-feature servers (e.g. `debate-server`) to a unified NestJS server with modular feature packages. Each feature becomes a separate pnpm workspace package (`@aweave/nestjs-<feature>`) exporting a NestJS module. The common server (`devtools/common/server/`) imports all feature modules and provides shared infrastructure (auth, config, error handling).

The first migration target is `debate-server` → `@aweave/nestjs-debate`.

### ⚠️ Key Considerations

1. **Separate pnpm package per feature** — Each feature module is an independent pnpm workspace package with its own `package.json`, `tsconfig.json`, Prisma schema, and generated client. This enables future domain modules (e.g. `devtools/tinybots/nestjs-api/`) to follow the same pattern.

2. **Prisma v7 multi-database pattern** — Each feature module owns a separate SQLite database at `~/.aweave/db/<name>.db`. Each has its own `prisma/schema.prisma`, generated Prisma Client (output to `src/generated/prisma/`), and `DebatePrismaService`. No shared database between features.

3. **Interval polling replaces long polling** — The `wait` endpoint changes from server-holding-connection (60s timeout, in-memory EventEmitter notification) to immediate-response. CLI polls every 2s client-side. This **eliminates** the EventEmitter/notifier infrastructure in LockService and simplifies the server.

4. **Application-level Mutex retained** — Per-debate Mutex is kept in LockService to reduce SQLite write contention. Only the EventEmitter notification is removed (no longer needed with interval polling).

5. **API contract mostly preserved** — REST endpoints keep the same paths and request/response schemas. Only the wait endpoint changes: renamed from `/debates/:id/wait` to `/debates/:id/poll` with immediate response semantics. CLI command interface (`aw debate wait --debate-id X`) is unchanged externally.

6. **WebSocket via NestJS Gateway** — Migrated from raw `ws` library to `@nestjs/websockets` + `@nestjs/platform-ws`. Same event contract (`initial_state`, `new_argument`, `submit_intervention`, `submit_ruling`).

7. **Services management update** — CLI `services.py` needs path updates from `devtools/common/debate-server/` to `devtools/common/server/`. The pm2 ecosystem config moves to the common server.

## 📐 Spec / Decisions

### 1. Package Naming & Location

**Convention:** `@aweave/nestjs-<feature>` for package name, `devtools/<domain>/nestjs-<feature>/` for folder.

| Package | Folder | Database |
|---------|--------|----------|
| `@aweave/nestjs-debate` | `devtools/common/nestjs-debate/` | `~/.aweave/db/debate.db` |
| `@aweave/server` | `devtools/common/server/` | N/A (imports modules) |
| Future: `@aweave/nestjs-<x>` | `devtools/<domain>/nestjs-<x>/` | `~/.aweave/db/<x>.db` |

### 2. Prisma v7 Per-Feature Setup

Each feature module has:

```
devtools/common/nestjs-debate/
├── prisma/
│   └── schema.prisma          # Feature-specific schema
└── src/
    └── generated/
        └── prisma/            # Generated Prisma Client (gitignored)
```

**schema.prisma (Prisma v7 style):**
```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
  url      = env("DEBATE_DATABASE_URL")
}

model Debate {
  id         String     @id
  title      String
  debateType String     @map("debate_type")
  state      String     @default("AWAITING_OPPONENT")
  createdAt  String     @default(dbgenerated("datetime('now')")) @map("created_at")
  updatedAt  String     @default(dbgenerated("datetime('now')")) @map("updated_at")
  arguments  Argument[]

  @@map("debates")
}

model Argument {
  id              String     @id
  debateId        String     @map("debate_id")
  parentId        String?    @map("parent_id")
  type            String
  role            String
  content         String
  clientRequestId String?    @map("client_request_id")
  seq             Int
  createdAt       String     @default(dbgenerated("datetime('now')")) @map("created_at")

  debate          Debate     @relation(fields: [debateId], references: [id])
  parent          Argument?  @relation("ArgumentParent", fields: [parentId], references: [id])
  children        Argument[] @relation("ArgumentParent")

  @@unique([debateId, clientRequestId])
  @@unique([debateId, seq])
  @@index([debateId])
  @@index([parentId])
  @@map("arguments")
}
```

**DebatePrismaService pattern:**
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';

@Injectable()
export class DebatePrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const dbDir = join(homedir(), '.aweave', 'db');
    mkdirSync(dbDir, { recursive: true });
    const dbPath = join(dbDir, 'debate.db');
    super({
      datasources: { db: { url: `file:${dbPath}` } }
    });
  }

  async onModuleInit() {
    // Enable WAL mode for better concurrent read performance
    await this.$executeRawUnsafe('PRAGMA journal_mode = WAL');
    await this.$executeRawUnsafe('PRAGMA foreign_keys = ON');
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### 3. Interval Polling (replaces Long Polling)

**Old: Long Polling (`GET /debates/:id/wait`)**
- Server holds HTTP connection for up to 60s
- Uses in-memory EventEmitter to wake waiters when new argument arrives
- Complex: listener lifecycle, race condition handling, missed-signal prevention
- CLI uses 65s HTTP timeout, client-side 120s overall deadline

**New: Interval Polling (`GET /debates/:id/poll`)**
- Server responds immediately — queries DB, returns result
- No in-memory state needed on server
- CLI polls every 2s with standard 10s HTTP timeout, same 120s overall deadline
- Much simpler, Prisma-friendly

**New endpoint contract:**

```
GET /debates/:id/poll?argument_id=<uuid>&role=<proposer|opponent>
```

Response (immediate):
```json
// Case 1: New argument exists (seq > lastSeenArg.seq)
{
  "success": true,
  "data": {
    "has_new_argument": true,
    "action": "respond",
    "debate_state": "AWAITING_PROPOSER",
    "argument": { "id": "...", "seq": 3, "type": "CLAIM", ... }
  }
}

// Case 2: No new argument
{
  "success": true,
  "data": {
    "has_new_argument": false,
    "debate_id": "...",
    "last_seen_seq": 2
  }
}
```

**Server logic (simplified vs old):**
```typescript
// New: Simple query, immediate response
async poll(debateId: string, argumentId: string | null, role: WaiterRole) {
  const debate = await this.prisma.debate.findUniqueOrThrow({ where: { id: debateId } });

  let lastSeenSeq = 0;
  if (argumentId) {
    const arg = await this.prisma.argument.findUnique({ where: { id: argumentId } });
    if (!arg || arg.debateId !== debateId) throw new InvalidInputError(...);
    lastSeenSeq = arg.seq;
  }

  const latest = await this.prisma.argument.findFirst({
    where: { debateId, seq: { gt: lastSeenSeq } },
    orderBy: { seq: 'desc' }
  });

  if (latest) {
    return { has_new_argument: true, action: buildWaitAction(latest, debate.state, role), ... };
  }
  return { has_new_argument: false, debate_id: debateId, last_seen_seq: lastSeenSeq };
}
```

### 4. Migration Mapping (Old → New)

| Old File (`debate-server/src/`) | New Location (`nestjs-debate/src/`) | Changes |
|---|---|---|
| `types.ts` | `types.ts` | Mostly copy, adapt for Prisma model types |
| `errors.ts` | `errors.ts` | Keep custom errors, add NestJS `ExceptionFilter` at server level |
| `stateMachine.ts` | `state-machine.ts` | Copy as-is (pure logic, no dependencies) |
| `lockService.ts` | `lock.service.ts` | **Remove** EventEmitter/notifier, keep only Mutex + `withLock()` |
| `db.ts` | **Replaced by** `debate-prisma.service.ts` | Raw SQL → Prisma Client |
| `services.ts` (`DebateService`) | `debate.service.ts` | Rewrite with Prisma, simplify poll |
| `services.ts` (`ArgumentService`) | `argument.service.ts` | Rewrite with Prisma |
| `http.ts` | `debate.controller.ts` | Express routes → NestJS `@Controller` decorators |
| `websocket.ts` | `debate.gateway.ts` | Raw `ws` → `@WebSocketGateway` |
| `config.ts` | **Moved to** `server/src/shared/config/` | Global server config |
| `index.ts` | **Replaced by** NestJS bootstrap (`server/src/main.ts`) | NestJS app init |

### 5. CLI Changes

**`devtools/common/cli/devtool/aweave/debate/config.py` changes:**
```python
# Remove:
POLL_TIMEOUT = 65  # No longer needed (was for long-poll HTTP timeout)

# Add:
POLL_INTERVAL = float(os.getenv("DEBATE_POLL_INTERVAL", "2"))  # seconds between polls

# Keep unchanged:
DEBATE_SERVER_URL = os.getenv("DEBATE_SERVER_URL", "http://127.0.0.1:3456")
DEBATE_WAIT_DEADLINE = int(os.getenv("DEBATE_WAIT_DEADLINE", "120"))
```

**`devtools/common/cli/devtool/aweave/debate/cli.py` — `wait` command changes:**
```python
# Old: Long polling with 65s HTTP timeout
client = _get_poll_client()  # 65s timeout
while time.time() - start < deadline:
    resp = client.get(f"/debates/{debate_id}/wait", params=..., timeout=65)
    if data.get("has_new_argument"):
        return
    # retry immediately (server already waited 60s)

# New: Interval polling with 10s HTTP timeout
client = _get_client()  # standard 10s timeout
while time.time() - start < deadline:
    resp = client.get(f"/debates/{debate_id}/poll", params=..., timeout=10)
    if data.get("has_new_argument"):
        return
    time.sleep(POLL_INTERVAL)  # wait 2s before retry
```

Key changes:
- Endpoint: `/wait` → `/poll`
- Remove `_get_poll_client()` function (no longer needed)
- Add `time.sleep(POLL_INTERVAL)` between requests
- Keep same overall deadline (120s default)
- Keep same output format (MCPResponse, readable_content=True)

**`devtools/common/cli/devtool/aweave/debate/services.py` changes:**

```python
# Old paths:
DEBATE_SERVER_DIR = DEVTOOLS_ROOT / "common" / "debate-server"
ECOSYSTEM_CONFIG = DEBATE_SERVER_DIR / "ecosystem.config.cjs"

# New paths:
SERVER_DIR = DEVTOOLS_ROOT / "common" / "server"
ECOSYSTEM_CONFIG = SERVER_DIR / "ecosystem.config.cjs"

# Service config changes:
SERVICES = {
    "aweave-server": ServiceConfig(   # renamed from "debate-server"
        name="aweave-server",
        port=3456,
        cwd=SERVER_DIR,               # changed from DEBATE_SERVER_DIR
        build_check_path="dist",
        health_url="http://127.0.0.1:3456/health",
    ),
    "debate-web": ServiceConfig(       # unchanged
        ...
    ),
}
```

### 6. Server Shared Infrastructure

The main server (`devtools/common/server/`) provides:

**Auth Guard:**
```typescript
// server/src/shared/guards/auth.guard.ts
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = this.configService.get('AUTH_TOKEN');
    if (!token) return true; // No auth in dev mode
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization || '';
    const [scheme, value] = header.split(' ');
    if (scheme !== 'Bearer' || value !== token) throw new UnauthorizedException();
    return true;
  }
}
```

**Global Exception Filter:**
```typescript
// server/src/shared/filters/app-exception.filter.ts
// Catches custom errors from feature modules and formats as:
// { success: false, error: { code, message, suggestion?, ...extra } }
// Same envelope format as old debate-server
```

**Config:**
```typescript
// server/src/shared/config/app.config.ts
export const appConfig = {
  port: parseInt(process.env.SERVER_PORT || '3456'),
  host: process.env.SERVER_HOST || '127.0.0.1',
  authToken: process.env.AUTH_TOKEN, // undefined = no auth
};
```

### 7. WebSocket Gateway Pattern

```typescript
// nestjs-debate/src/debate.gateway.ts
@WebSocketGateway({ path: '/ws' })
export class DebateGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  // Room-based: clients join debate_id rooms
  handleConnection(client: WebSocket, ...args: any[]) {
    // Parse debate_id from query params
    // Auth check if AUTH_TOKEN set
    // Send initial_state event
  }

  @SubscribeMessage('submit_intervention')
  handleIntervention(client: WebSocket, data: { debate_id: string; content?: string }) {
    // Delegate to ArgumentService
  }

  @SubscribeMessage('submit_ruling')
  handleRuling(client: WebSocket, data: { debate_id: string; content: string; close?: boolean }) {
    // Delegate to ArgumentService
  }

  // Called by services after successful argument insert
  broadcastNewArgument(debateId: string, debate: Debate, argument: Argument) {
    // Send to all clients subscribed to debateId
  }
}
```

### 8. Prisma Transaction Pattern for seq Assignment

The old debate-server used `BEGIN IMMEDIATE` + manual seq computation. With Prisma, use interactive transactions:

```typescript
// nestjs-debate/src/argument.service.ts
async submitClaim(input: SubmitClaimDto) {
  return this.lockService.withLock(input.debateId, async () => {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      const existing = await tx.argument.findFirst({
        where: { debateId: input.debateId, clientRequestId: input.clientRequestId }
      });
      if (existing) return { argument: existing, isExisting: true };

      // 2. Validate state
      const debate = await tx.debate.findUniqueOrThrow({ where: { id: input.debateId } });
      if (!isActionAllowed(debate.state, input.role, 'submit_claim')) {
        throw new ActionNotAllowedError(...);
      }

      // 3. Get next seq (within transaction = atomic)
      const maxSeq = await tx.argument.aggregate({
        where: { debateId: input.debateId },
        _max: { seq: true }
      });
      const nextSeq = (maxSeq._max.seq ?? 0) + 1;

      // 4. Insert argument
      const argument = await tx.argument.create({
        data: {
          id: crypto.randomUUID(),
          debateId: input.debateId,
          parentId: input.targetId,
          type: 'CLAIM',
          role: input.role,
          content: input.content,
          clientRequestId: input.clientRequestId,
          seq: nextSeq,
        }
      });

      // 5. Update debate state
      const nextState = calculateNextState(debate.state as DebateState, 'CLAIM', input.role as Role);
      await tx.debate.update({
        where: { id: input.debateId },
        data: { state: nextState, updatedAt: new Date().toISOString() }
      });

      return { argument, isExisting: false };
    });

    // 6. Broadcast via WebSocket (after transaction commits)
    if (!result.isExisting) {
      const debate = await this.prisma.debate.findUniqueOrThrow({ where: { id: input.debateId } });
      this.gateway.broadcastNewArgument(input.debateId, debate, result.argument);
    }

    return result.argument;
  });
}
```

## 🔄 Implementation Plan

### Phase 1: Analysis & Preparation

- [ ] Verify NestJS server at `devtools/common/server/` is correctly initialized and builds
  - **Outcome**: `pnpm build` succeeds in `devtools/common/server/`
- [ ] Verify Prisma v7 is available via `npm info prisma version`
  - **Outcome**: Confirm latest Prisma version to use
- [ ] Review all existing debate-server source files listed in References
  - **Outcome**: Full understanding of logic to migrate

### Phase 2: Implementation (File/Code Structure)

```
devtools/
├── pnpm-workspace.yaml                    # 🔄 UPDATE - add common/nestjs-debate
├── common/
│   ├── server/                            # 🔄 UPDATE - unified NestJS app
│   │   ├── package.json                   # 🔄 UPDATE - add @aweave/nestjs-debate dep
│   │   ├── nest-cli.json                  # ✅ EXISTS
│   │   ├── tsconfig.json                  # ✅ EXISTS
│   │   ├── ecosystem.config.cjs           # 🚧 NEW - pm2 config (moved from debate-server)
│   │   └── src/
│   │       ├── main.ts                    # 🔄 UPDATE - NestJS bootstrap with WS adapter
│   │       ├── app.module.ts              # 🔄 UPDATE - import DebateModule
│   │       └── shared/
│   │           ├── config/
│   │           │   └── app.config.ts      # 🚧 NEW - global server config
│   │           ├── guards/
│   │           │   └── auth.guard.ts      # 🚧 NEW - bearer token auth
│   │           └── filters/
│   │               └── app-exception.filter.ts  # 🚧 NEW - global error formatting
│   │
│   ├── nestjs-debate/                     # 🚧 NEW - debate feature package
│   │   ├── package.json                   # 🚧 NEW - @aweave/nestjs-debate
│   │   ├── tsconfig.json                  # 🚧 NEW
│   │   ├── prisma/
│   │   │   └── schema.prisma             # 🚧 NEW - debate DB schema
│   │   └── src/
│   │       ├── index.ts                   # 🚧 NEW - barrel export (DebateModule)
│   │       ├── debate.module.ts           # 🚧 NEW - NestJS module definition
│   │       ├── debate-prisma.service.ts   # 🚧 NEW - PrismaClient for debate.db
│   │       ├── debate.controller.ts       # 🚧 NEW - REST endpoints (from http.ts)
│   │       ├── debate.service.ts          # 🚧 NEW - debate CRUD + poll (from services.ts)
│   │       ├── argument.service.ts        # 🚧 NEW - argument operations (from services.ts)
│   │       ├── debate.gateway.ts          # 🚧 NEW - WebSocket gateway (from websocket.ts)
│   │       ├── lock.service.ts            # 🚧 NEW - Mutex only (from lockService.ts)
│   │       ├── state-machine.ts           # 🚧 NEW - copy from stateMachine.ts
│   │       ├── errors.ts                  # 🚧 NEW - adapted from errors.ts
│   │       ├── types.ts                   # 🚧 NEW - adapted from types.ts
│   │       └── dto/
│   │           ├── create-debate.dto.ts   # 🚧 NEW
│   │           ├── submit-argument.dto.ts # 🚧 NEW
│   │           └── ...                    # 🚧 NEW
│   │
│   ├── debate-server/                     # ⚠️ DEPRECATED after migration
│   │   └── (existing files)
│   │
│   ├── debate-web/                        # ✅ EXISTS (unchanged)
│   │
│   └── cli/devtool/aweave/debate/         # 🔄 UPDATE
│       ├── cli.py                         # 🔄 UPDATE - wait→poll, remove _get_poll_client
│       ├── config.py                      # 🔄 UPDATE - POLL_INTERVAL, remove POLL_TIMEOUT
│       └── services.py                    # 🔄 UPDATE - new paths for server
```

### Phase 3: Detailed Implementation Steps

#### Step 1: Create `@aweave/nestjs-debate` Package

- [ ] Create `devtools/common/nestjs-debate/` directory
- [ ] Create `package.json` with:
  - name: `@aweave/nestjs-debate`
  - dependencies: `@nestjs/common`, `@nestjs/websockets`, `@nestjs/platform-ws`, `@prisma/client`, `prisma`
  - peerDependencies: `@nestjs/core`
  - scripts: `build`, `prisma:generate`, `prisma:migrate`
  - **Outcome**: Package installable via pnpm workspace
- [ ] Create `tsconfig.json` matching server's NestJS TypeScript config (decorators, ESM)
- [ ] Update `devtools/pnpm-workspace.yaml` to include `common/nestjs-debate`
  - **Outcome**: `pnpm install` from `devtools/` resolves workspace links

#### Step 2: Prisma Schema & Client Generation

- [ ] Create `devtools/common/nestjs-debate/prisma/schema.prisma` (see Spec section 2)
- [ ] Set `DEBATE_DATABASE_URL=file:$HOME/.aweave/db/debate.db` in `.env` or configure in PrismaService constructor
- [ ] Run `npx prisma generate --schema=prisma/schema.prisma` to generate client to `src/generated/prisma/`
- [ ] Add `src/generated/` to `.gitignore`
- [ ] Run `npx prisma migrate dev --name init` to create initial migration
  - **Outcome**: Prisma Client generated, migration SQL created, empty `debate.db` at `~/.aweave/db/`

#### Step 3: Migrate Core Logic (Pure Functions)

These files have no framework dependencies and can be copied with minimal changes:

- [ ] `state-machine.ts` — Copy from `debate-server/src/stateMachine.ts` as-is
  - Same `isActionAllowed()` and `calculateNextState()` functions
  - **Outcome**: Pure state machine logic, no changes needed
- [ ] `types.ts` — Copy types, add Prisma-compatible types
  - Keep `DebateState`, `ArgumentType`, `Role`, `WaiterRole`, `WaitAction` as-is
  - Keep `SuccessResponse`, `ErrorResponse` envelope types
  - Remove `Debate` and `Argument` type aliases (use Prisma generated types instead, or keep for service layer DTOs)
  - **Outcome**: Type definitions for the module
- [ ] `errors.ts` — Copy error classes, keep same `code`/`statusCode`/`suggestion` pattern
  - `AppError`, `NotFoundError`, `DebateNotFoundError`, `ArgumentNotFoundError`, `InvalidInputError`, `ActionNotAllowedError`, `ContentTooLargeError`, `UnauthorizedError`
  - **Outcome**: Same error classes, will be caught by server-level ExceptionFilter

#### Step 4: Create NestJS Services

- [ ] `debate-prisma.service.ts` — Prisma Client wrapper (see Spec section 2)
  - Extends `PrismaClient`, configures database path in constructor
  - `onModuleInit()`: connect + set WAL mode + foreign keys
  - `onModuleDestroy()`: disconnect
  - **Outcome**: Injectable Prisma service for debate database

- [ ] `lock.service.ts` — Simplified from `debate-server/src/lockService.ts`
  - **Keep**: `Mutex` class, `withLock()` method
  - **Remove**: `notifyNewArgument()`, `waitForArgument()`, `notifiers` Map (no longer needed with interval polling)
  - **Outcome**: Per-debate write serialization only

- [ ] `debate.service.ts` — Migrate from `DebateService` in `debate-server/src/services.ts`
  - `createDebate()` — Rewrite with Prisma `$transaction` (see Spec section 8 for pattern)
  - `getDebate()` — Simple Prisma `findUniqueOrThrow`
  - `getDebateWithArgs()` — Prisma queries: `debate.findUnique` + `argument.findMany` with ordering/limit
  - `listDebates()` — Prisma `debate.findMany` with filters and pagination
  - `deleteDebate()` — Prisma `argument.deleteMany` + `debate.delete` in transaction
  - `poll()` — **NEW** (replaces `waitForResponse`): Simple DB query, immediate response (see Spec section 3)
  - **Outcome**: All debate CRUD operations using Prisma

- [ ] `argument.service.ts` — Migrate from `ArgumentService` in `debate-server/src/services.ts`
  - `submitClaim()` — Rewrite with Prisma `$transaction` (see Spec section 8)
  - `submitAppeal()` — Same pattern as submitClaim with type=APPEAL
  - `submitResolution()` — Same pattern with type=RESOLUTION
  - `submitIntervention()` — Same pattern with type=INTERVENTION, role=arbitrator
  - `submitRuling()` — Same pattern with type=RULING, optional close flag
  - All methods: keep idempotency check, state validation, seq assignment, broadcast after commit
  - Inject `DebateGateway` for WebSocket broadcast
  - **Outcome**: All argument operations using Prisma

#### Step 5: Create NestJS Controller

- [ ] `debate.controller.ts` — Migrate from `debate-server/src/http.ts`
  - Map all Express routes to NestJS decorators:

  | Old Express Route | NestJS Decorator | Method |
  |---|---|---|
  | `GET /health` | `@Get('health')` | healthCheck |
  | `GET /debates` | `@Get('debates')` | listDebates |
  | `POST /debates` | `@Post('debates')` | createDebate |
  | `GET /debates/:id` | `@Get('debates/:id')` | getDebate |
  | `DELETE /debates/:id` | `@Delete('debates/:id')` | deleteDebate |
  | `POST /debates/:id/arguments` | `@Post('debates/:id/arguments')` | submitArgument |
  | `POST /debates/:id/appeal` | `@Post('debates/:id/appeal')` | submitAppeal |
  | `POST /debates/:id/resolution` | `@Post('debates/:id/resolution')` | submitResolution |
  | `POST /debates/:id/intervention` | `@Post('debates/:id/intervention')` | submitIntervention |
  | `POST /debates/:id/ruling` | `@Post('debates/:id/ruling')` | submitRuling |
  | `GET /debates/:id/wait` → | `@Get('debates/:id/poll')` | poll |

  - Keep same request body schemas and response envelope format (`{ success: true, data: {...} }`)
  - Use NestJS `@Query()`, `@Param()`, `@Body()` decorators
  - **Outcome**: Same REST API, NestJS-style

- [ ] Create DTOs for request validation (optional: use `class-validator` decorators)
  - `create-debate.dto.ts`: debate_id, title, debate_type, motion_content, client_request_id
  - `submit-argument.dto.ts`: role, target_id, content, client_request_id
  - `submit-appeal.dto.ts`: target_id, content, client_request_id
  - `submit-resolution.dto.ts`: target_id, content, client_request_id
  - `submit-ruling.dto.ts`: content, close?, client_request_id?
  - `submit-intervention.dto.ts`: content?, client_request_id?
  - **Outcome**: Type-safe request handling

#### Step 6: Create WebSocket Gateway

- [ ] `debate.gateway.ts` — Migrate from `debate-server/src/websocket.ts`
  - `@WebSocketGateway({ path: '/ws' })` using `@nestjs/platform-ws`
  - Room-based subscription per debate_id (via query param on connection)
  - Same events: `initial_state`, `new_argument` (server→client), `submit_intervention`, `submit_ruling` (client→server)
  - Auth check on connection if `AUTH_TOKEN` is set (via query param `?token=...`)
  - **Outcome**: Same WebSocket contract, NestJS-style

#### Step 7: Wire Up Module

- [ ] `debate.module.ts`:
  ```typescript
  @Module({
    providers: [DebatePrismaService, LockService, DebateService, ArgumentService, DebateGateway],
    controllers: [DebateController],
    exports: [DebateService, ArgumentService],
  })
  export class DebateModule {}
  ```
- [ ] `index.ts` — Barrel export: `export { DebateModule } from './debate.module'`
- [ ] Run `pnpm build` in `devtools/common/nestjs-debate/` to verify compilation
  - **Outcome**: Package builds successfully

#### Step 8: Update Main Server

- [ ] Add `@aweave/nestjs-debate` as dependency in `devtools/common/server/package.json`:
  ```json
  "dependencies": {
    "@aweave/nestjs-debate": "workspace:*",
    "@nestjs/platform-ws": "^11.0.0",
    ...
  }
  ```
- [ ] Update `app.module.ts`:
  ```typescript
  import { DebateModule } from '@aweave/nestjs-debate';
  @Module({
    imports: [DebateModule],
  })
  export class AppModule {}
  ```
- [ ] Update `main.ts` with WsAdapter, CORS, global exception filter:
  ```typescript
  import { WsAdapter } from '@nestjs/platform-ws';

  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableCors();
  app.useGlobalFilters(new AppExceptionFilter());
  app.useGlobalGuards(new AuthGuard());
  await app.listen(config.port, config.host);
  ```
- [ ] Create `shared/config/app.config.ts`, `shared/guards/auth.guard.ts`, `shared/filters/app-exception.filter.ts`
- [ ] Create `ecosystem.config.cjs` for pm2 (similar to debate-server's, adjusted for new paths)
- [ ] Remove boilerplate `app.controller.ts`, `app.service.ts`, `app.controller.spec.ts`
- [ ] Run `pnpm build` and test `pnpm start` with `curl http://127.0.0.1:3456/health`
  - **Outcome**: Server starts, imports DebateModule, all debate endpoints work

#### Step 9: Update Debate CLI

- [ ] Update `devtools/common/cli/devtool/aweave/debate/config.py`:
  - Remove `POLL_TIMEOUT = 65`
  - Add `POLL_INTERVAL = float(os.getenv("DEBATE_POLL_INTERVAL", "2"))`
  - **Outcome**: Config reflects interval polling

- [ ] Update `devtools/common/cli/devtool/aweave/debate/cli.py`:
  - Remove `_get_poll_client()` function
  - Update `wait` command:
    - Change endpoint from `/debates/{debate_id}/wait` to `/debates/{debate_id}/poll`
    - Use `_get_client()` instead of `_get_poll_client()`
    - Add `time.sleep(POLL_INTERVAL)` between retry iterations
    - Keep same MCPResponse output format
  - **Outcome**: CLI works with interval polling, same user-facing behavior

- [ ] Update `devtools/common/cli/devtool/aweave/debate/services.py`:
  - Change `DEBATE_SERVER_DIR` to point to `devtools/common/server/`
  - Change `ECOSYSTEM_CONFIG` path
  - Rename service from `debate-server` to `aweave-server`
  - Update `build_check_path` for NestJS output
  - **Outcome**: `aw debate services start` works with new server location

#### Step 10: Integration Testing

- [ ] Start server: `cd devtools/common/server && pnpm start`
- [ ] Test all REST endpoints via curl:
  - `POST /debates` — create debate
  - `GET /debates/:id` — get context
  - `GET /debates/:id/poll` — poll for new arguments
  - `POST /debates/:id/arguments` — submit claim
  - `POST /debates/:id/appeal` — submit appeal
  - `POST /debates/:id/resolution` — request completion
  - `POST /debates/:id/ruling` — submit ruling
  - `POST /debates/:id/intervention` — submit intervention
  - `DELETE /debates/:id` — delete debate
  - `GET /debates` — list debates
- [ ] Test CLI commands:
  - `aw debate generate-id`
  - `aw debate create --debate-id ... --title "Test" --type general_debate --content "Test motion"`
  - `aw debate get-context --debate-id ...`
  - `aw debate submit --debate-id ... --role opponent --target-id ... --content "Test claim"`
  - `aw debate wait --debate-id ... --role proposer --argument-id ...`
  - `aw debate list`
- [ ] Test WebSocket connection from browser/wscat
- [ ] Test auto-start services: `aw debate services start`
  - **Outcome**: All endpoints and CLI commands work correctly

#### Step 11: Cleanup & Documentation

- [ ] Update `devtools/pnpm-workspace.yaml` — remove `common/debate-server` if no longer needed
- [ ] Add deprecation notice to `devtools/common/debate-server/README.md`
- [ ] Update `devdocs/misc/devtools/OVERVIEW.md` — reflect new server architecture
- [ ] Update `devdocs/misc/devtools/plans/debate.md` section 2.8 — reflect new server location and architecture
  - **Outcome**: Documentation reflects new architecture

## 📊 Summary of Results

> Do not summarize until implementation is done

### ✅ Completed Achievements

- [ ] ...

## 🚧 Outstanding Issues & Follow-up

### ⚠️ Issues/Clarifications

- [ ] **Prisma v7 availability** — Verify Prisma 7 is stable for SQLite. If v7 is not released yet, use latest v6 (same patterns, URL stays in schema.prisma instead of prisma.config.ts)
- [ ] **debate-web WebSocket compatibility** — `debate-web` currently connects to `ws://127.0.0.1:3456/ws?debate_id=X`. After migration, verify NestJS `@WebSocketGateway({ path: '/ws' })` maintains the same URL path and message format
- [ ] **pm2 ecosystem config** — Old config at `debate-server/ecosystem.config.cjs` manages both `debate-server` and `debate-web`. New config at `server/ecosystem.config.cjs` needs to manage `aweave-server` and `debate-web` with updated paths
- [ ] **Generated Prisma client in build** — The `@aweave/nestjs-debate` build step must run `prisma generate` before `tsc`. Configure in package.json scripts: `"build": "prisma generate --schema=prisma/schema.prisma && tsc"`
- [ ] **NestJS module resolution** — With separate packages and `workspace:*`, verify NestJS can resolve `@aweave/nestjs-debate` module at runtime. May need `paths` in tsconfig or `nest-cli.json` configuration
