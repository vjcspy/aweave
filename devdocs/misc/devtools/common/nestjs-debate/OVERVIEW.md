# Debate NestJS Module (`@aweave/nestjs-debate`)

> **Source:** `devtools/common/nestjs-debate/`
> **Last Updated:** 2026-02-07

NestJS module chứa toàn bộ debate feature: REST API, WebSocket gateway, state machine, Prisma ORM với SQLite database riêng.

## Purpose

Module này là **complete backend** cho hệ thống debate giữa AI agents:
- CRUD debates + arguments với state machine validation
- Interval polling endpoint để CLI chờ phản hồi
- WebSocket gateway cho real-time updates (debate-web)
- Idempotency qua `client_request_id`
- Per-debate mutex locking

**Thiết kế như separate pnpm package** để:
- Tách biệt concern: debate logic không mix với server infrastructure
- Có thể test độc lập
- Future features follow cùng pattern: `@aweave/nestjs-<feature>`

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    @aweave/nestjs-debate                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  DebateController (REST)        DebateGateway (WebSocket)    │
│  ├─ GET  /health                ├─ initial_state             │
│  ├─ POST /debates               ├─ new_argument              │
│  ├─ GET  /debates               ├─ submit_intervention       │
│  ├─ GET  /debates/:id           └─ submit_ruling             │
│  ├─ DELETE /debates/:id                                      │
│  ├─ POST /debates/:id/arguments                              │
│  ├─ POST /debates/:id/appeal                                 │
│  ├─ POST /debates/:id/resolution                             │
│  ├─ POST /debates/:id/intervention                           │
│  ├─ POST /debates/:id/ruling                                 │
│  └─ GET  /debates/:id/poll                                   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  DebateService            ArgumentService                    │
│  ├─ createDebate()        ├─ submitClaim()                   │
│  ├─ getDebateWithArgs()   ├─ submitAppeal()                  │
│  ├─ listDebates()         ├─ submitResolution()              │
│  ├─ deleteDebate()        ├─ submitIntervention()            │
│  └─ poll()                └─ submitRuling()                  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  LockService              State Machine                      │
│  (per-debate Mutex)       (isActionAllowed,                  │
│                            calculateNextState)               │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  DebatePrismaService                                         │
│  (PrismaClient → ~/.aweave/db/debate.db)                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Dependencies

| Package | Role |
|---------|------|
| `@nestjs/common` | NestJS decorators, Injectable, Module |
| `@nestjs/websockets`, `@nestjs/platform-ws` | WebSocket gateway |
| `@prisma/client` | Prisma ORM (generated client) |
| `prisma` (devDep) | CLI for generate/migrate |

**Peer dependency:** `@nestjs/core` (provided by `@aweave/server`)

## Exposed Exports

```typescript
// devtools/common/nestjs-debate/src/index.ts
export { DebateModule }        // NestJS Module — import này vào AppModule
export { DebateService }       // Injectable — nếu cần inject từ module khác
export { ArgumentService }     // Injectable — nếu cần inject từ module khác
export { DebateGateway }       // WebSocket gateway

// All DTOs (entity, request, response, error) — consumed by @aweave/server for Swagger setup
export * from './dto';

// WS event types — consumed by debate-web for WebSocket typing
export type { WsEvent, ServerToClientEvent, NewArgumentEvent, ... } from './ws-types';
```

**Primary export:** `DebateModule` — chỉ cần import module, tất cả providers/controllers tự register.

## Swagger DTOs (`src/dto/`)

Swagger DTO classes define the OpenAPI schema for all REST endpoints. They mirror the **serialized** (snake_case) API output, not the Prisma camelCase model.

| File | Contents |
|------|----------|
| `debate.dto.ts` | `DebateDto` — serialized debate entity |
| `argument.dto.ts` | `ArgumentDto` — serialized argument entity |
| `request.dto.ts` | `CreateDebateBodyDto`, `SubmitArgumentBodyDto`, `SubmitAppealBodyDto`, `RequestCompletionBodyDto`, `SubmitInterventionBodyDto`, `SubmitRulingBodyDto` |
| `response.dto.ts` | `ListDebatesResponseDto`, `GetDebateResponseDto`, `WriteResultResponseDto`, `PollResultNewResponseDto`, `PollResultNoNewResponseDto` — concrete `{ success, data }` envelopes |
| `error.dto.ts` | `ErrorResponseDto`, `ErrorDetailDto` — error envelope |
| `index.ts` | Barrel export |

**Key design:** Each response DTO is a concrete class with the full `{ success, data }` envelope so OpenAPI spec is self-describing. Poll endpoint uses `oneOf` with `PollResultNewResponseDto` / `PollResultNoNewResponseDto`.

## WebSocket Event Types (`src/ws-types.ts`)

Generic envelope + specific events referencing entity DTOs:

```typescript
type WsEvent<E extends string, D> = { event: E; data: D };

// Server → Client
type InitialStateEvent = WsEvent<'initial_state', { debate: DebateDto; arguments: ArgumentDto[] }>;
type NewArgumentEvent = WsEvent<'new_argument', { debate: DebateDto; argument: ArgumentDto }>;

// Client → Server
type SubmitInterventionEvent = WsEvent<'submit_intervention', { debate_id: string; content?: string }>;
type SubmitRulingEvent = WsEvent<'submit_ruling', { debate_id: string; content: string; close?: boolean }>;
```

> **Note:** WS types are NOT covered by OpenAPI. They use a manually-defined generic envelope that references the same DTO types.

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `DEBATE_DB_DIR` | `~/.aweave/db/` | Directory chứa database file |
| `DEBATE_DB_NAME` | `debate.db` | Database filename |
| `DEBATE_DATABASE_URL` | — | Used by Prisma CLI (migrate/generate). Format: `file:/path/to/debate.db` |

> **Note:** Runtime database path được resolve trong `DebatePrismaService` constructor từ `DEBATE_DB_DIR` + `DEBATE_DB_NAME`. `DEBATE_DATABASE_URL` chỉ dùng khi chạy Prisma CLI commands.

## Database

### Prisma Schema

```
devtools/common/nestjs-debate/
├── prisma/
│   ├── schema.prisma           # Schema definition
│   └── migrations/             # Migration history
│       └── 20260207_init/
└── generated/
    └── prisma/                 # Generated Prisma Client (gitignored)
```

### Models

**Debate:**

| Field | Type | DB Column | Description |
|-------|------|-----------|-------------|
| `id` | String (PK) | `id` | UUID |
| `title` | String | `title` | Tiêu đề |
| `debateType` | String | `debate_type` | `coding_plan_debate` \| `general_debate` |
| `state` | String | `state` | State machine state |
| `createdAt` | String | `created_at` | ISO datetime |
| `updatedAt` | String | `updated_at` | ISO datetime |

**Argument:**

| Field | Type | DB Column | Description |
|-------|------|-----------|-------------|
| `id` | String (PK) | `id` | UUID |
| `debateId` | String (FK) | `debate_id` | Ref → debates.id |
| `parentId` | String? (FK) | `parent_id` | Ref → arguments.id (null for MOTION) |
| `type` | String | `type` | `MOTION` \| `CLAIM` \| `APPEAL` \| `RULING` \| `INTERVENTION` \| `RESOLUTION` |
| `role` | String | `role` | `proposer` \| `opponent` \| `arbitrator` |
| `content` | String | `content` | Nội dung argument |
| `clientRequestId` | String? | `client_request_id` | Idempotency key (UNIQUE per debate) |
| `seq` | Int | `seq` | Auto-increment per debate, ordering |
| `createdAt` | String | `created_at` | ISO datetime |

### Response Serialization

Prisma trả về camelCase (`debateType`, `createdAt`), nhưng API contract dùng snake_case (`debate_type`, `created_at`) để backward compatible với CLI. Module có `serializers.ts` xử lý conversion này tại controller layer.

## State Machine

### States

| State | Ai đang chờ? |
|-------|-------------|
| `AWAITING_OPPONENT` | Proposer waiting |
| `AWAITING_PROPOSER` | Opponent waiting |
| `AWAITING_ARBITRATOR` | Cả 2 waiting |
| `INTERVENTION_PENDING` | Cả 2 waiting |
| `CLOSED` | Không ai chờ |

### Transitions

| From | Action | By | To |
|------|--------|-----|-----|
| — | create (MOTION) | Proposer | `AWAITING_OPPONENT` |
| `AWAITING_OPPONENT` | submit CLAIM | Opponent | `AWAITING_PROPOSER` |
| `AWAITING_OPPONENT` | intervention | Arbitrator | `INTERVENTION_PENDING` |
| `AWAITING_PROPOSER` | submit CLAIM | Proposer | `AWAITING_OPPONENT` |
| `AWAITING_PROPOSER` | appeal | Proposer | `AWAITING_ARBITRATOR` |
| `AWAITING_PROPOSER` | request-completion | Proposer | `AWAITING_ARBITRATOR` |
| `AWAITING_PROPOSER` | intervention | Arbitrator | `INTERVENTION_PENDING` |
| `AWAITING_ARBITRATOR` | ruling | Arbitrator | `AWAITING_PROPOSER` |
| `AWAITING_ARBITRATOR` | ruling (close) | Arbitrator | `CLOSED` |
| `INTERVENTION_PENDING` | ruling | Arbitrator | `AWAITING_PROPOSER` |
| `INTERVENTION_PENDING` | ruling (close) | Arbitrator | `CLOSED` |

### Allowed Actions Matrix

| State | Proposer | Opponent | Arbitrator |
|-------|----------|----------|------------|
| `AWAITING_OPPONENT` | — | submit | intervention |
| `AWAITING_PROPOSER` | submit, appeal, request-completion | — | intervention |
| `AWAITING_ARBITRATOR` | — | — | ruling |
| `INTERVENTION_PENDING` | — | — | ruling |
| `CLOSED` | — | — | — |

## API Endpoints

### REST (served by DebateController)

| Method | Endpoint | Description | CLI Command |
|--------|----------|-------------|-------------|
| `GET` | `/health` | Health check | — |
| `POST` | `/debates` | Create debate + MOTION | `aw debate create` |
| `GET` | `/debates` | List debates (filter, paginate) | `aw debate list` |
| `GET` | `/debates/:id` | Get debate + motion + arguments | `aw debate get-context` |
| `DELETE` | `/debates/:id` | Delete debate | — |
| `POST` | `/debates/:id/arguments` | Submit CLAIM | `aw debate submit` |
| `POST` | `/debates/:id/appeal` | Submit APPEAL | `aw debate appeal` |
| `POST` | `/debates/:id/resolution` | Submit RESOLUTION | `aw debate request-completion` |
| `POST` | `/debates/:id/intervention` | Submit INTERVENTION | `aw debate intervention` |
| `POST` | `/debates/:id/ruling` | Submit RULING | `aw debate ruling` |
| `GET` | `/debates/:id/poll` | Interval polling | `aw debate wait` |

### WebSocket (served by DebateGateway)

**Connect:** `ws://host:port/ws?debate_id=<uuid>[&token=<auth>]`

**Server → Client:**

| Event | Trigger | Data |
|-------|---------|------|
| `initial_state` | On connect | `{ debate, arguments[] }` |
| `new_argument` | After each write | `{ debate, argument }` |

**Client → Server:**

| Event | Description | Data |
|-------|-------------|------|
| `submit_intervention` | Arbitrator intervention | `{ debate_id, content? }` |
| `submit_ruling` | Arbitrator ruling | `{ debate_id, content, close? }` |

## Response Format

All REST responses wrapped in standard envelope:

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ACTION_NOT_ALLOWED",
    "message": "Role 'opponent' cannot perform 'submit_claim' in state 'AWAITING_PROPOSER'",
    "suggestion": "Wait for proposer to submit",
    "current_state": "AWAITING_PROPOSER",
    "allowed_roles": ["proposer"]
  }
}
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `DEBATE_NOT_FOUND` | 404 | Debate không tồn tại |
| `ARGUMENT_NOT_FOUND` | 404 | Argument không tồn tại |
| `INVALID_INPUT` | 400 | Input không hợp lệ |
| `ACTION_NOT_ALLOWED` | 403 | State machine violation |
| `CONTENT_TOO_LARGE` | 413 | Content > 10KB |
| `AUTH_FAILED` | 401 | Authentication failed |

## Key Design Decisions

### Auto-Ruling on Resolution

Khi Proposer submit RESOLUTION (`request-completion`), server **tự động** tạo thêm bản ghi RULING với `close=true` để close debate ngay lập tức — không cần Arbitrator can thiệp thủ công.

- RESOLUTION (seq N) được tạo → state = `AWAITING_ARBITRATOR` → broadcast WS
- RULING (seq N+1) được tạo tự động → state = `CLOSED` → broadcast WS
- Nếu client retry (idempotency hit), auto-ruling không chạy lại
- Nếu auto-ruling fail, RESOLUTION vẫn thành công — Arbitrator có thể ruling thủ công sau

> **Note:** Chỉ áp dụng cho RESOLUTION. APPEAL vẫn cần Arbitrator phán xử thủ công.

Xem plan: `devdocs/misc/devtools/plans/260207-auto-ruling-on-resolution.md`

### Interval Polling (thay vì Long Polling)

Old debate-server dùng **long polling** (server giữ connection 60s, in-memory EventEmitter notification). Module này dùng **interval polling**:

- Server respond **ngay lập tức** — query DB, trả kết quả
- Client (CLI) poll mỗi **2 giây**
- Không cần in-memory EventEmitter/notifier
- Đơn giản, stateless, Prisma-friendly

> Latency tối đa 2s — hoàn toàn chấp nhận cho AI agent debate.

### Per-Debate Mutex (LockService)

Mỗi debate có 1 Mutex riêng. Tất cả write operations (submit, appeal, ruling...) đều đi qua `lockService.withLock(debateId, fn)`. Đảm bảo:
- `seq` assignment atomic (get max + 1, rồi insert)
- State transition consistent (check state, then update)
- Không race condition giữa concurrent writers

### Idempotency

Mọi write endpoint nhận `client_request_id`:
- Server check `UNIQUE(debate_id, client_request_id)` trước khi insert
- Nếu đã tồn tại → return existing result (không tạo duplicate)
- Safe để CLI retry khi network error

### Prisma Transactions

Seq assignment + state update nằm trong cùng 1 `prisma.$transaction()`:

```typescript
await this.prisma.$transaction(async (tx) => {
  // 1. Idempotency check
  // 2. Validate state
  // 3. Get next seq (aggregate MAX + 1)
  // 4. Insert argument
  // 5. Update debate state
});
// 6. Broadcast via WebSocket (after commit)
```

## Project Structure

```
devtools/common/nestjs-debate/
├── package.json                    # @aweave/nestjs-debate
├── tsconfig.json
├── nest-cli.json
├── .gitignore
├── prisma/
│   ├── schema.prisma              # Debate + Argument models
│   └── migrations/
│       └── 20260207053250_init/
├── generated/
│   └── prisma/                    # Generated Prisma Client (gitignored)
├── src/
│   ├── index.ts                   # Barrel export: DebateModule, services, DTOs, WS types
│   ├── debate.module.ts           # NestJS module definition
│   ├── debate-prisma.service.ts   # PrismaClient for ~/.aweave/db/debate.db
│   ├── debate.controller.ts       # REST endpoints (Swagger-annotated)
│   ├── debate.service.ts          # Debate CRUD + poll logic
│   ├── argument.service.ts        # Argument operations (submit, appeal, ...)
│   ├── debate.gateway.ts          # WebSocket gateway (/ws)
│   ├── lock.service.ts            # Per-debate Mutex
│   ├── state-machine.ts           # isActionAllowed(), calculateNextState()
│   ├── errors.ts                  # AppError hierarchy
│   ├── types.ts                   # DebateState, Role, WaitAction, etc.
│   ├── serializers.ts             # camelCase → snake_case for API responses
│   ├── ws-types.ts                # WebSocket event type definitions
│   └── dto/                       # Swagger DTO classes
│       ├── debate.dto.ts          # DebateDto
│       ├── argument.dto.ts        # ArgumentDto
│       ├── request.dto.ts         # Request body DTOs
│       ├── response.dto.ts        # Response envelope DTOs
│       ├── error.dto.ts           # ErrorResponseDto
│       └── index.ts               # Barrel export
└── dist/                          # Build output
```

## Development

> **Package manager:** Workspace dùng **pnpm** (không phải npm). Tất cả commands dùng `pnpm`.

> **PM2:** `@aweave/server` (import module này) được quản lý bởi PM2 (`devtools/ecosystem.config.cjs`). Khi develop nestjs-debate, **phải stop PM2 server** trước, rồi chạy server ở dev mode để có hot-reload.

```bash
# Stop PM2 server trước khi dev
cd devtools
pm2 stop aweave-server

# Install (from workspace root)
pnpm install

# Generate Prisma client
cd common/nestjs-debate
DEBATE_DATABASE_URL="file:$HOME/.aweave/db/debate.db" pnpm prisma:generate

# Run migrations
DEBATE_DATABASE_URL="file:$HOME/.aweave/db/debate.db" pnpm prisma:migrate

# Build (generates Prisma client + compiles TypeScript)
pnpm build

# Build only TypeScript (if Prisma already generated)
npx nest build

# Chạy server dev mode (từ server package, auto-reload khi nestjs-debate thay đổi)
cd ../server && pnpm start:dev

# Start lại PM2 khi dev xong
cd devtools
pm2 start ecosystem.config.cjs --only aweave-server
```

**Note:** `pnpm build` chạy `prisma generate` trước `nest build` (configured trong `package.json` scripts).

## Related

- **Unified Server:** `devtools/common/server/`
- **Server Overview:** `devdocs/misc/devtools/common/server/OVERVIEW.md`
- **Debate CLI Plugin:** `devtools/common/cli-plugin-debate/`
- **Debate CLI Plugin Overview:** `devdocs/misc/devtools/common/cli-plugin-debate/OVERVIEW.md`
- **Debate Spec:** `devdocs/misc/devtools/plans/debate.md`
- **Architecture Plan:** `devdocs/misc/devtools/plans/260207-unified-nestjs-server.md`
- **Debate Web:** `devtools/common/debate-web/`
