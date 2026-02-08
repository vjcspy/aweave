# 260207 - OpenAPI Types Generation (NestJS → Next.js)

## References

- **NestJS module:** `devtools/common/nestjs-debate/`
- **NestJS module OVERVIEW:** `devdocs/misc/devtools/common/nestjs-debate/OVERVIEW.md`
- **Server:** `devtools/common/server/`
- **Server OVERVIEW:** `devdocs/misc/devtools/common/server/OVERVIEW.md`
- **Client:** `devtools/common/debate-web/`
- **Client OVERVIEW:** `devdocs/misc/devtools/common/debate-web/OVERVIEW.md`

## User Requirements

- Use Swagger/OpenAPI approach (Approach B) to auto-generate types from NestJS server
- Apply to NestJS first, then Next.js client for REST API
- WebSocket: define a shared generic event envelope type, with specific event data referencing generated entity types (reuse DebateDto, ArgumentDto from OpenAPI)
- Fix any format mismatches found during review

## 🎯 Objective

Add `@nestjs/swagger` to the NestJS debate module, auto-generate `openapi.json`, then use `openapi-typescript` + `openapi-fetch` in the Next.js client to replace hand-written types and manual fetch calls. WebSocket event types use a generic envelope referencing the same generated entity types.

### ⚠️ Key Considerations

1. **Bug found:** `broadcastNewArgument()` in `debate.service.ts` and `argument.service.ts` sends raw Prisma objects (camelCase: `debateType`, `createdAt`) via WebSocket, but `initial_state` properly serializes to snake_case (`debate_type`, `created_at`). Client expects snake_case for all events. **Must fix** as part of this work.

2. **Serialization layer:** Current `serializers.ts` converts Prisma camelCase → API snake_case at controller layer. Swagger DTOs should reflect the **serialized** (snake_case) output, not the Prisma model.

3. **No breaking changes to API contract:** The REST API response format (`{ success, data }` envelope, snake_case fields) must remain identical. This work adds type generation on top of the existing contract.

4. **Swagger setup lives in `@aweave/server`**, not in `nestjs-debate`. The module provides DTOs; the server configures SwaggerModule and generates the spec.

5. **WebSocket types are NOT covered by OpenAPI.** They will use a manually-defined generic envelope that references the same DTO types exported from `nestjs-debate`.

6. **`openapi.json` is a build artifact** — generated on demand, committed to repo so `debate-web` can consume it without running the server.

## 🔄 Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Catalog all REST endpoints, request bodies, and response shapes from `debate.controller.ts`
- [x] Catalog all WebSocket events and their data shapes from `debate.gateway.ts`
- [x] Identify all Prisma-to-API field mappings in `serializers.ts`
- [x] **Outcome:** Full map of every request/response shape that needs a DTO

#### Endpoint ↔ DTO Checklist

> Verified against current `debate.controller.ts` routes.

| # | Method | Path | Request Body DTO | Success Response DTO | Error Responses |
|---|--------|------|------------------|---------------------|-----------------|
| 1 | `GET` | `/health` | — | (inline `{ status: 'ok' }`) | — |
| 2 | `GET` | `/debates` | — | `ListDebatesResponseDto` | 400 |
| 3 | `POST` | `/debates` | `CreateDebateBodyDto` | `WriteResultResponseDto` | 400 |
| 4 | `GET` | `/debates/:id` | — | `GetDebateResponseDto` | 400, 404 |
| 5 | `DELETE` | `/debates/:id` | — | (inline success) | 400, 404 |
| 6 | `POST` | `/debates/:id/arguments` | `SubmitArgumentBodyDto` | `WriteResultResponseDto` | 400, 403, 404 |
| 7 | `POST` | `/debates/:id/appeal` | `SubmitAppealBodyDto` | `WriteResultResponseDto` | 400, 403, 404 |
| 8 | `POST` | `/debates/:id/resolution` | `RequestCompletionBodyDto` | `WriteResultResponseDto` | 400, 403, 404 |
| 9 | `POST` | `/debates/:id/intervention` | `SubmitInterventionBodyDto` | `WriteResultResponseDto` | 400, 403, 404 |
| 10 | `POST` | `/debates/:id/ruling` | `SubmitRulingBodyDto` | `WriteResultResponseDto` | 400, 403, 404 |
| 11 | `GET` | `/debates/:id/poll` | — | `PollResultNewResponseDto` / `PollResultNoNewResponseDto` | 400, 404 |

> **Note:** CLI command `aw debate request-completion` maps to `POST /debates/:id/resolution`. Route name kept as-is.

**Path params:** `:id` → `@ApiParam({ name: 'id', description: 'Debate UUID' })`
**Query params:**
- `GET /debates` → `offset` (optional, number)
- `GET /debates/:id` → `limit` (optional, number — max arguments)
- `GET /debates/:id/poll` → `argument_id` (optional, string — last seen argument UUID), `role` (required, enum: `proposer | opponent`) — note: `arbitrator` not accepted by current controller validation

All query params annotated with `@ApiQuery` including types and enums where applicable.

### Phase 2: Implementation Structure

```
devtools/common/nestjs-debate/          # NestJS module
├── src/
│   ├── dto/                            # 🚧 NEW — Swagger DTO classes
│   │   ├── debate.dto.ts              # DebateDto, CreateDebateDto, etc.
│   │   ├── argument.dto.ts            # ArgumentDto, SubmitArgumentDto, etc.
│   │   ├── response.dto.ts            # Concrete response wrappers per endpoint
│   │   ├── error.dto.ts               # 🚧 NEW — ErrorResponseDto for error envelopes
│   │   └── index.ts                   # Barrel export
│   ├── ws-types.ts                     # 🚧 NEW — Generic WS event envelope types
│   ├── debate.controller.ts           # 🔄 MODIFY — Add @ApiResponse decorators
│   ├── debate.gateway.ts              # 🔄 MODIFY — Use serializers in broadcastNewArgument
│   ├── debate.service.ts              # 🔄 MODIFY — Serialize before broadcast
│   ├── argument.service.ts            # 🔄 MODIFY — Serialize before broadcast
│   ├── serializers.ts                 # ✅ KEEP — Still used, DTOs mirror its output
│   ├── types.ts                       # ✅ KEEP — Internal enums/union types
│   └── index.ts                       # 🔄 MODIFY — Export DTOs + WS types
├── package.json                        # 🔄 MODIFY — Add @nestjs/swagger dependency

devtools/common/server/                 # Unified NestJS server
├── src/
│   ├── main.ts                        # 🔄 MODIFY — Setup SwaggerModule + generate script
│   └── scripts/
│       └── generate-openapi.ts        # 🚧 NEW — Standalone spec generation script
├── openapi.json                        # 🚧 NEW — Generated OpenAPI spec (committed)
├── package.json                        # 🔄 MODIFY — Add @nestjs/swagger dep + script

devtools/common/debate-web/             # Next.js client
├── lib/
│   ├── api-types.ts                   # 🚧 NEW — Generated from openapi.json (do not edit)
│   ├── api.ts                         # 🔄 MODIFY — Replace manual fetch with openapi-fetch
│   ├── types.ts                       # 🔄 MODIFY — Only WS event types remain (reference generated)
│   └── utils.ts                       # ✅ KEEP
├── hooks/
│   ├── use-debate.ts                  # 🔄 MODIFY — Import types from new locations
│   └── use-debates-list.ts            # 🔄 MODIFY — Use typed API client
├── app/debates/[id]/
│   └── page.tsx                       # 🔄 MODIFY — Import deleteDebate from @/lib/api
├── components/debate/                  # 🔄 MODIFY — Update imports
├── package.json                        # 🔄 MODIFY — Add openapi-typescript, openapi-fetch
```

### Phase 3: Detailed Implementation Steps

#### Step 1: Fix WebSocket Serialization Bug

**Files:** `devtools/common/nestjs-debate/src/debate.service.ts`, `devtools/common/nestjs-debate/src/argument.service.ts`

Currently `broadcastNewArgument()` is called with raw Prisma objects:

```typescript
// debate.service.ts:145 — BUG: raw Prisma camelCase
this.gateway.broadcastNewArgument(input.debate_id, result.debate, result.argument);

// argument.service.ts:165 — BUG: same issue
this.gateway.broadcastNewArgument(input.debate_id, result.debate, result.argument);
```

Fix: serialize before broadcast in both files:

```typescript
import { serializeDebate, serializeArgument } from './serializers';

// After transaction commits
this.gateway.broadcastNewArgument(
  input.debate_id,
  serializeDebate(result.debate as any),
  serializeArgument(result.argument as any),
);
```

**Validation:** After fix, `new_argument` WebSocket events will use snake_case fields matching `initial_state` events and client `Argument`/`Debate` types.

---

#### Step 2: Create DTO Classes in `nestjs-debate`

**Files:** New `devtools/common/nestjs-debate/src/dto/` directory

Install dependency:

```bash
cd devtools/common/nestjs-debate
pnpm add @nestjs/swagger
```

**2a. Entity DTOs** (`dto/debate.dto.ts`, `dto/argument.dto.ts`)

These mirror the snake_case serialized output (what the API actually returns):

```typescript
// dto/debate.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class DebateDto {
  @ApiProperty({ description: 'UUID' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: ['coding_plan_debate', 'general_debate'] })
  debate_type!: string;

  @ApiProperty({
    enum: ['AWAITING_OPPONENT', 'AWAITING_PROPOSER', 'AWAITING_ARBITRATOR', 'INTERVENTION_PENDING', 'CLOSED'],
  })
  state!: string;

  @ApiProperty({ description: 'ISO datetime' })
  created_at!: string;

  @ApiProperty({ description: 'ISO datetime' })
  updated_at!: string;
}

export class ArgumentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  debate_id!: string;

  @ApiProperty({ nullable: true, type: String })
  parent_id!: string | null;

  @ApiProperty({ enum: ['MOTION', 'CLAIM', 'APPEAL', 'RULING', 'INTERVENTION', 'RESOLUTION'] })
  type!: string;

  @ApiProperty({ enum: ['proposer', 'opponent', 'arbitrator'] })
  role!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ nullable: true, type: String })
  client_request_id!: string | null;

  @ApiProperty()
  seq!: number;

  @ApiProperty({ description: 'ISO datetime' })
  created_at!: string;
}
```

**2b. Request DTOs** (`dto/request.dto.ts`)

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDebateBodyDto {
  @ApiProperty() debate_id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: ['coding_plan_debate', 'general_debate'] }) debate_type!: string;
  @ApiProperty() motion_content!: string;
  @ApiProperty() client_request_id!: string;
}

export class SubmitArgumentBodyDto {
  @ApiProperty({ enum: ['proposer', 'opponent'] }) role!: 'proposer' | 'opponent';
  @ApiProperty() target_id!: string;
  @ApiProperty() content!: string;
  @ApiProperty() client_request_id!: string;
}

export class SubmitAppealBodyDto {
  @ApiProperty() target_id!: string;
  @ApiProperty() content!: string;
  @ApiProperty() client_request_id!: string;
}

export class SubmitInterventionBodyDto {
  @ApiPropertyOptional() content?: string;
  @ApiPropertyOptional() client_request_id?: string;
}

export class SubmitRulingBodyDto {
  @ApiProperty() content!: string;
  @ApiPropertyOptional() close?: boolean;
  @ApiPropertyOptional() client_request_id?: string;
}

export class RequestCompletionBodyDto {
  @ApiProperty() target_id!: string;
  @ApiProperty() content!: string;
  @ApiProperty() client_request_id!: string;
}
```

**2c. Response DTOs** (`dto/response.dto.ts`)

Concrete response wrapper per endpoint — each includes the full `{ success, data }` envelope so OpenAPI spec is self-describing:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { DebateDto } from './debate.dto';
import { ArgumentDto } from './argument.dto';

// ── Data shapes ──

export class ListDebatesDataDto {
  @ApiProperty({ type: [DebateDto] }) debates!: DebateDto[];
  @ApiProperty() total!: number;
}

export class GetDebateDataDto {
  @ApiProperty() debate!: DebateDto;
  @ApiProperty({ nullable: true, type: ArgumentDto }) motion!: ArgumentDto | null;
  @ApiProperty({ type: [ArgumentDto] }) arguments!: ArgumentDto[];
}

export class WriteResultDataDto {
  @ApiProperty() debate!: DebateDto;
  @ApiProperty() argument!: ArgumentDto;
}

export class PollArgumentDataDto {
  @ApiProperty() id!: string;
  @ApiProperty() seq!: number;
  @ApiProperty({ enum: ['MOTION', 'CLAIM', 'APPEAL', 'RULING', 'INTERVENTION', 'RESOLUTION'] }) type!: string;
  @ApiProperty({ enum: ['proposer', 'opponent', 'arbitrator'] }) role!: string;
  @ApiProperty({ nullable: true, type: String }) parent_id!: string | null;
  @ApiProperty() content!: string;
  @ApiProperty() created_at!: string;
}

export class PollResultNewDataDto {
  @ApiProperty({ example: true }) has_new_argument!: true;
  @ApiProperty() action!: string;
  @ApiProperty() debate_state!: string;
  @ApiProperty() argument!: PollArgumentDataDto;
}

export class PollResultNoNewDataDto {
  @ApiProperty({ example: false }) has_new_argument!: false;
  @ApiProperty() debate_id!: string;
  @ApiProperty() last_seen_seq!: number;
}

// ── Concrete response envelopes ──

export class ListDebatesResponseDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty() data!: ListDebatesDataDto;
}

export class GetDebateResponseDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty() data!: GetDebateDataDto;
}

export class WriteResultResponseDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty() data!: WriteResultDataDto;
}

export class PollResultNewResponseDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty() data!: PollResultNewDataDto;
}

export class PollResultNoNewResponseDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty() data!: PollResultNoNewDataDto;
}
```

**2d. Error DTO** (`dto/error.dto.ts`)

Common error response envelope — mirrors `ErrorResponse` interface in `types.ts`, including the context-specific fields that `ActionNotAllowedError` and others merge in:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorDetailDto {
  @ApiProperty({ example: 'VALIDATION_ERROR', description: 'Error code (NOT_FOUND, INVALID_INPUT, ACTION_NOT_ALLOWED, etc.)' })
  code!: string;

  @ApiProperty({ example: 'Invalid debate_id format' })
  message!: string;

  @ApiPropertyOptional({ description: 'Suggested action to fix the error' })
  suggestion?: string;

  @ApiPropertyOptional({ description: 'Current debate state (present in ACTION_NOT_ALLOWED errors)' })
  current_state?: string;

  @ApiPropertyOptional({ type: [String], description: 'Roles allowed for this action (present in ACTION_NOT_ALLOWED errors)' })
  allowed_roles?: string[];
}

export class ErrorResponseDto {
  @ApiProperty({ example: false }) success!: boolean;
  @ApiProperty() error!: ErrorDetailDto;
}
```

> **Note:** The actual `ErrorResponse` interface uses `[key: string]: unknown` for arbitrary extra fields. The DTO captures the known fields explicitly. Unknown extras will pass through at runtime but won't appear in the OpenAPI spec.

**2e. Barrel export** (`dto/index.ts`)

```typescript
export * from './debate.dto';
export * from './argument.dto';
export * from './request.dto';
export * from './response.dto';
export * from './error.dto';
```

---

#### Step 3: Create WebSocket Event Types

**File:** `devtools/common/nestjs-debate/src/ws-types.ts`

Generic envelope + specific events referencing entity DTOs:

```typescript
import type { DebateDto, ArgumentDto } from './dto';

/**
 * Generic WebSocket event envelope.
 * All WS messages follow this shape — only `event` name and `data` differ.
 */
export type WsEvent<E extends string = string, D = unknown> = {
  event: E;
  data: D;
};

// ── Server → Client ──

export type InitialStateEvent = WsEvent<'initial_state', {
  debate: DebateDto;
  arguments: ArgumentDto[];
}>;

export type NewArgumentEvent = WsEvent<'new_argument', {
  debate: DebateDto;
  argument: ArgumentDto;
}>;

export type ServerToClientEvent = InitialStateEvent | NewArgumentEvent;

// ── Client → Server ──

export type SubmitInterventionEvent = WsEvent<'submit_intervention', {
  debate_id: string;
  content?: string;
}>;

export type SubmitRulingEvent = WsEvent<'submit_ruling', {
  debate_id: string;
  content: string;
  close?: boolean;
}>;

export type ClientToServerEvent = SubmitInterventionEvent | SubmitRulingEvent;
```

**Export from `index.ts`:**

```typescript
// Add to devtools/common/nestjs-debate/src/index.ts

// All DTOs (entity, request, response, error) — consumed by @aweave/server for Swagger setup
export * from './dto';

// WS event types — consumed by debate-web for WebSocket typing
export type {
  WsEvent,
  ServerToClientEvent, InitialStateEvent, NewArgumentEvent,
  ClientToServerEvent, SubmitInterventionEvent, SubmitRulingEvent,
} from './ws-types';
```

> **Note:** `export * from './dto'` re-exports all DTO classes. This is the public contract — `@aweave/server` imports `ListDebatesResponseDto`, `PollResultNewResponseDto`, `ErrorResponseDto`, etc. from this path. Keep the barrel export in `dto/index.ts` complete.

---

#### Step 4: Annotate Controller with Swagger Decorators

**File:** `devtools/common/nestjs-debate/src/debate.controller.ts`

**4a. Register all `$ref`-referenced DTOs with `@ApiExtraModels` at class level:**

```typescript
import { ApiExtraModels, getSchemaPath } from '@nestjs/swagger';
import {
  PollResultNewResponseDto, PollResultNoNewResponseDto, ErrorResponseDto,
} from './dto';

@ApiExtraModels(PollResultNewResponseDto, PollResultNoNewResponseDto, ErrorResponseDto)
@Controller()
export class DebateController { ... }
```

> **Why class-level `@ApiExtraModels`?** Any DTO referenced via `getSchemaPath()` must be registered so Swagger emits the corresponding `components.schemas` entry. Placing it on the class ensures both runtime Swagger UI and the standalone generation script (Step 6) produce valid `$ref`s.

**4b. For each endpoint, add:**
- `@ApiOperation({ summary })` — description
- `@ApiOkResponse({ type })` — success response using concrete response DTO
- `@ApiBadRequestResponse({ type: ErrorResponseDto })` — common error responses
- `@ApiNotFoundResponse({ type: ErrorResponseDto })` — for endpoints with `:id`
- `@ApiParam` / `@ApiQuery` — for all path and query parameters
- Replace inline body types with DTO classes (`@Body() body: CreateDebateBodyDto`)

Example for `GET /debates/:id`:

```typescript
@ApiOperation({ summary: 'Get debate with motion and arguments' })
@ApiParam({ name: 'id', description: 'Debate UUID', type: String })
@ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max arguments to return' })
@ApiOkResponse({ type: GetDebateResponseDto, description: 'Debate detail' })
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiNotFoundResponse({ type: ErrorResponseDto })
@Get('debates/:id')
async getDebate(@Param('id') debateId: string, @Query('limit') limitRaw?: string) {
  // ... existing logic unchanged
}
```

Example for `GET /debates/:id/poll`:

```typescript
@ApiOperation({ summary: 'Long-poll for new arguments' })
@ApiParam({ name: 'id', description: 'Debate UUID', type: String })
@ApiQuery({ name: 'argument_id', required: false, type: String, description: 'Last seen argument UUID' })
@ApiQuery({ name: 'role', required: true, enum: ['proposer', 'opponent'] })
@ApiOkResponse({
  description: 'Poll result — new argument or timeout',
  schema: { oneOf: [
    { $ref: getSchemaPath(PollResultNewResponseDto) },
    { $ref: getSchemaPath(PollResultNoNewResponseDto) },
  ]},
})
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiNotFoundResponse({ type: ErrorResponseDto })
@Get('debates/:id/poll')
async poll(@Param('id') debateId: string, @Query('argument_id') argumentId?: string, @Query('role') role?: string) { ... }
```

Apply to all 11 endpoints per the checklist in Phase 1. State-guarded write endpoints (arguments, appeal, resolution, intervention, ruling) also get `@ApiForbiddenResponse({ type: ErrorResponseDto })` for `ACTION_NOT_ALLOWED` errors. Body params switch from inline types to DTO classes.

---

#### Step 5: Setup SwaggerModule in Server

**File:** `devtools/common/server/package.json`

```bash
cd devtools/common/server
pnpm add @nestjs/swagger
```

**File:** `devtools/common/server/src/main.ts`

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
// Import ALL DTOs used in $ref / oneOf to ensure they appear in components.schemas
import {
  DebateDto, ArgumentDto,
  ListDebatesResponseDto, GetDebateResponseDto, WriteResultResponseDto,
  PollResultNewResponseDto, PollResultNoNewResponseDto,
  ErrorResponseDto,
} from '@aweave/nestjs-debate';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger setup (only registers schemas, no UI served in production)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Aweave Server API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    extraModels: [
      DebateDto, ArgumentDto,
      ListDebatesResponseDto, GetDebateResponseDto, WriteResultResponseDto,
      PollResultNewResponseDto, PollResultNoNewResponseDto,
      ErrorResponseDto,
    ],
  });

  // Optionally serve Swagger UI in dev
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api-docs', app, document);
  }

  // ... rest of existing bootstrap
}
```

---

#### Step 6: Create OpenAPI Spec Generation Script

**File:** `devtools/common/server/src/scripts/generate-openapi.ts`

Standalone script that boots the app, generates spec, writes to file. Uses `path.resolve` relative to CWD for CommonJS compatibility (the server package has no `"type": "module"`):

```typescript
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from '../app.module';
import {
  DebateDto, ArgumentDto,
  ListDebatesResponseDto, GetDebateResponseDto, WriteResultResponseDto,
  PollResultNewResponseDto, PollResultNoNewResponseDto,
  ErrorResponseDto,
} from '@aweave/nestjs-debate';

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Aweave Server API')
    .setVersion('1.0')
    .build();

  // Pass the same extraModels as main.ts to guarantee all $ref targets are emitted
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [
      DebateDto, ArgumentDto,
      ListDebatesResponseDto, GetDebateResponseDto, WriteResultResponseDto,
      PollResultNewResponseDto, PollResultNoNewResponseDto,
      ErrorResponseDto,
    ],
  });
  const outputPath = resolve(process.cwd(), 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`Generated ${outputPath}`);
  await app.close();
}

generate();
```

**Add to `devtools/common/server/package.json` scripts:**

```json
"generate:openapi": "ts-node -r tsconfig-paths/register src/scripts/generate-openapi.ts"
```

> **Run from server root:** `cd devtools/common/server && pnpm generate:openapi` — writes `openapi.json` to CWD.

> **Note:** `openapi.json` is committed to repo. Regenerated when API changes. `debate-web` reads it at build time.

**Validation checkpoint:** After running `pnpm generate:openapi`, verify no dangling `$ref`s by immediately running `pnpm generate:types` in `debate-web`. If `openapi-typescript` fails or emits `unknown` for any schema, the `extraModels` list or `@ApiExtraModels` decorator is incomplete.

---

#### Step 7: Generate Client Types from OpenAPI Spec

**File:** `devtools/common/debate-web/package.json`

```bash
cd devtools/common/debate-web
pnpm add openapi-fetch
pnpm add -D openapi-typescript
```

**Add script:**

```json
"generate:types": "openapi-typescript ../server/openapi.json -o lib/api-types.ts",
"prebuild": "pnpm generate:types"
```

**Run generation:**

```bash
pnpm generate:types
```

This produces `devtools/common/debate-web/lib/api-types.ts` with full typed `paths` and `components.schemas`.

---

#### Step 8: Replace Client API Layer

**File:** `devtools/common/debate-web/lib/api.ts`

Replace manual fetch with `openapi-fetch` typed client. Keep thin wrapper functions for migration safety — existing call sites (`use-debates-list.ts`, `use-debate.ts`, `app/debates/[id]/page.tsx`) continue calling named functions instead of raw `api.GET(...)` / `api.DELETE(...)`:

```typescript
import createClient from 'openapi-fetch';
import type { paths, components } from './api-types';

const SERVER_URL = process.env.NEXT_PUBLIC_DEBATE_SERVER_URL || 'http://127.0.0.1:3456';

// Re-export entity types from generated spec for convenience
export type Debate = components['schemas']['DebateDto'];
export type Argument = components['schemas']['ArgumentDto'];

// Typed API client — all paths, params, responses auto-inferred
export const api = createClient<paths>({ baseUrl: SERVER_URL });

export function getServerUrl(): string {
  return SERVER_URL;
}

export function getWsUrl(): string {
  return SERVER_URL.replace(/^http/, 'ws');
}

// ── Thin wrapper functions (migration-safe, typed via openapi-fetch) ──

export async function fetchDebates(offset?: number) {
  const { data, error } = await api.GET('/debates', { params: { query: { offset } } });
  if (error || !data) throw new Error('Failed to fetch debates');
  return data.data;
}

export async function fetchDebate(id: string, limit?: number) {
  const { data, error } = await api.GET('/debates/{id}', { params: { path: { id }, query: { limit } } });
  if (error || !data) throw new Error('Failed to fetch debate');
  return data.data;
}

export async function deleteDebate(id: string) {
  const { data, error } = await api.DELETE('/debates/{id}', { params: { path: { id } } });
  if (error || !data) throw new Error('Failed to delete debate');
  return data;
}
```

> **Note:** Wrapper functions provide a stable call-site contract. All existing callers (`useDebatesList`, `useDebate`, `app/debates/[id]/page.tsx`) update imports to `@/lib/api` and call these wrappers. The raw `api` client is also exported for one-off or new call sites.

---

#### Step 9: Update Client `lib/types.ts` — WS Types Only

**File:** `devtools/common/debate-web/lib/types.ts`

Remove manually-copied entity types. Keep only WS event types referencing generated types:

```typescript
import type { Debate, Argument } from './api';

/**
 * Generic WebSocket event envelope.
 */
export type WsEvent<E extends string = string, D = unknown> = {
  event: E;
  data: D;
};

// ── Server → Client ──

export type ServerToClientEvent =
  | WsEvent<'initial_state', { debate: Debate; arguments: Argument[] }>
  | WsEvent<'new_argument', { debate: Debate; argument: Argument }>;

// ── Client → Server ──

export type ClientToServerEvent =
  | WsEvent<'submit_intervention', { debate_id: string; content?: string }>
  | WsEvent<'submit_ruling', { debate_id: string; content: string; close?: boolean }>;
```

---

#### Step 10: Update Hooks

**File:** `devtools/common/debate-web/hooks/use-debates-list.ts`

```typescript
import { api, type Debate } from '@/lib/api';

export function useDebatesList(pollInterval = 5000) {
  // ...
  const refresh = useCallback(async () => {
    const { data, error } = await api.GET('/debates');
    if (error || !data) {
      setError('Failed to fetch debates');
      return;
    }
    setDebates(data.data.debates);
  }, []);
  // ...
}
```

**File:** `devtools/common/debate-web/hooks/use-debate.ts`

- Import `Debate`, `Argument` from `@/lib/api`
- Import `ServerToClientEvent`, `ClientToServerEvent` from `@/lib/types`
- Update type references (rename `ServerToClientMessage` → `ServerToClientEvent`, etc.)

---

#### Step 11: Update Component Imports and Page Call Sites

All components that currently import from `@/lib/types`:
- `components/debate/action-area.tsx` — imports `DebateState` → change to `Debate['state']` or keep `DebateState` as a type alias in `lib/types.ts`
- `components/debate/argument-card.tsx` — imports `Argument` → from `@/lib/api`
- `components/debate/debate-item.tsx` — imports `Debate` → from `@/lib/api`
- `components/debate/debate-list.tsx` — imports `Debate` → from `@/lib/api`
- **`app/debates/[id]/page.tsx`** — calls `deleteDebate()` → import from `@/lib/api` (uses thin wrapper)
- Other components — update as needed

> **Note:** Keep a `DebateState` type alias in `lib/types.ts` for convenience since components use it as a union type:
> ```typescript
> export type DebateState = Debate['state'];
> ```

---

#### Step 12: Update Documentation

- `devdocs/misc/devtools/common/nestjs-debate/OVERVIEW.md` — Add DTO section, WS types section, export list update
- `devdocs/misc/devtools/common/debate-web/OVERVIEW.md` — Add OpenAPI types generation section, update lib structure
- `devdocs/misc/devtools/common/server/OVERVIEW.md` — Add Swagger/OpenAPI generation section

## Execution Order

```
Step 1  → Fix broadcastNewArgument serialization bug
Step 2  → Create DTO classes
Step 3  → Create WS event types
Step 4  → Annotate controller
Step 5  → Setup SwaggerModule in server
Step 6  → Create openapi generation script + generate openapi.json
Step 7  → Generate client types
Step 8  → Replace client API layer
Step 9  → Update client types.ts (WS only)
Step 10 → Update hooks
Step 11 → Update component imports
Step 12 → Update documentation
```

Steps 1-6 are server-side. Steps 7-11 are client-side. Step 12 is docs.

## 📊 Summary of Results

> Do not summarize the results until the implementation is done and I request it

### ✅ Completed Achievements

- Fixed WebSocket serialization bug — `broadcastNewArgument()` now serializes via `serializeDebate()`/`serializeArgument()` in both `debate.service.ts` and `argument.service.ts`
- Created Swagger DTO classes in `nestjs-debate/src/dto/` — entity, request, response, error DTOs
- Created WebSocket event types in `nestjs-debate/src/ws-types.ts` with generic `WsEvent<E,D>` envelope
- Annotated all 11 controller endpoints with Swagger decorators (`@ApiOperation`, `@ApiOkResponse`, `@ApiBadRequestResponse`, etc.)
- Setup `SwaggerModule` in `server/src/main.ts` with `extraModels` list; Swagger UI at `/api-docs` in dev
- Created `server/src/scripts/generate-openapi.ts` + `generate:openapi` npm script
- Generated `server/openapi.json` (committed) — all 11 endpoints with proper schemas
- Added `openapi-fetch` + `openapi-typescript` to `debate-web`; `generate:types` + `prebuild` scripts
- Generated `debate-web/lib/api-types.ts` from `openapi.json`
- Replaced manual fetch in `debate-web/lib/api.ts` with typed `openapi-fetch` client + thin wrapper functions
- Updated `debate-web/lib/types.ts` to reference generated entity types (WS types only remain hand-written)
- Updated hooks (`use-debate.ts`, `use-debates-list.ts`) to import from `@/lib/api`
- All existing component imports remain valid via re-exports in `lib/types.ts` (no component changes needed)
- Updated all three OVERVIEW.md documentation files

## 🚧 Outstanding Issues & Follow-up

### ⚠️ Issues/Clarifications

- [ ] **Poll endpoint response** is a union type (`has_new_argument: true | false` with different shapes). OpenAPI handles this with `oneOf` and concrete DTOs (`PollResultNewResponseDto` / `PollResultNoNewResponseDto`). Generated TS types may be slightly verbose; may need a discriminated union helper on client side.
- [ ] **`openapi.json` generation requires server bootable** — the generate script creates a full NestJS app instance. This means Prisma client must be generated first, and DB file must exist (or script should handle graceful init). Consider if a lighter approach (like `@nestjs/swagger` CLI plugin) becomes available.
- [ ] **`DebateState` as enum vs string:** Currently `state` field is typed as `string` in DTOs with `enum` constraint. The generated TypeScript type will be a string union. Components that use `DebateState` type should still work, but verify autocomplete behavior.
- [ ] **`debate-web` has no dependency on `@aweave/nestjs-debate`** — WS event types are duplicated (mirrored) in client's `lib/types.ts`. This is intentional to avoid pulling NestJS packages into Next.js. If types drift, the entity types (Debate, Argument) from OpenAPI act as the shared anchor.
- [ ] **CI enforcement for `openapi.json` freshness** — currently manual regeneration + commit. Consider adding a CI step that runs `generate:openapi` and fails if the output differs from the committed file, as a follow-up task.

## Implementation Notes / As Implemented

### Deviations from Plan

1. **Step 11 (Component imports) — No changes needed.** The plan anticipated updating imports in `action-area.tsx`, `argument-card.tsx`, `debate-item.tsx`, etc. In practice, the re-export pattern in `lib/types.ts` (`export type { Debate, Argument } from './api'` + derived aliases `DebateState`, `ArgumentType`, `Role`) means all existing component imports from `@/lib/types` continue to work without modification.

2. **Type cast for broadcastNewArgument.** The gateway's `broadcastNewArgument` signature accepts `Record<string, unknown>`. The serialized types (`SerializedDebate`, `SerializedArgument`) are interfaces without index signatures, so `as unknown as Record<string, unknown>` cast was needed at the call sites in `debate.service.ts` and `argument.service.ts`.

3. **`use-debates-list.ts` — `fetchDebates()` return shape changed.** The old `fetchDebates()` returned `Debate[]` directly. The new typed wrapper returns `{ debates: Debate[], total: number }` (matching the API envelope `data` shape). The hook was updated to `setDebates(data.debates)`.

### Build Verification

- `nestjs-debate`: `pnpm build` — clean (0 errors)
- `server`: `pnpm build` — clean (0 errors)
- `server`: `pnpm generate:openapi` — generated `openapi.json` with all 11 endpoints
- `debate-web`: `pnpm generate:types` — generated `lib/api-types.ts` (786 lines)
- `debate-web`: `npx tsc --noEmit` — clean (0 errors)

### Files Changed

**New files:**
- `devtools/common/nestjs-debate/src/dto/debate.dto.ts`
- `devtools/common/nestjs-debate/src/dto/argument.dto.ts`
- `devtools/common/nestjs-debate/src/dto/request.dto.ts`
- `devtools/common/nestjs-debate/src/dto/response.dto.ts`
- `devtools/common/nestjs-debate/src/dto/error.dto.ts`
- `devtools/common/nestjs-debate/src/dto/index.ts`
- `devtools/common/nestjs-debate/src/ws-types.ts`
- `devtools/common/server/src/scripts/generate-openapi.ts`
- `devtools/common/server/openapi.json` (generated)
- `devtools/common/debate-web/lib/api-types.ts` (generated)

**Modified files:**
- `devtools/common/nestjs-debate/src/debate.service.ts` — serialize before WS broadcast
- `devtools/common/nestjs-debate/src/argument.service.ts` — serialize before WS broadcast
- `devtools/common/nestjs-debate/src/debate.controller.ts` — Swagger decorators + DTO body types
- `devtools/common/nestjs-debate/src/index.ts` — export DTOs + WS types
- `devtools/common/nestjs-debate/package.json` — added `@nestjs/swagger`
- `devtools/common/server/src/main.ts` — SwaggerModule setup
- `devtools/common/server/package.json` — added `@nestjs/swagger` + `generate:openapi` script
- `devtools/common/debate-web/lib/api.ts` — openapi-fetch typed client
- `devtools/common/debate-web/lib/types.ts` — WS types only, references generated entity types
- `devtools/common/debate-web/hooks/use-debate.ts` — import from `@/lib/api`
- `devtools/common/debate-web/hooks/use-debates-list.ts` — import from `@/lib/api`, `data.debates`
- `devtools/common/debate-web/package.json` — added `openapi-fetch`, `openapi-typescript`, scripts
- `devdocs/misc/devtools/common/nestjs-debate/OVERVIEW.md`
- `devdocs/misc/devtools/common/server/OVERVIEW.md`
- `devdocs/misc/devtools/common/debate-web/OVERVIEW.md`
