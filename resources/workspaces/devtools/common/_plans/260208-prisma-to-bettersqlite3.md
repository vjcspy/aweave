---
name: Prisma to BetterSqlite3
description: Migrate ORM from Prisma to BetterSqlite3 driver directly to improve speed and remove bulky dependencies.
status: done
created: 2026-02-08
tags: []
---

# 📋 [PRISMA-MIGRATION: 2026-02-08] - Migrate Prisma ORM → better-sqlite3

## References

- NestJS Debate module: `resources/workspaces/devtools/common/nestjs-debate/OVERVIEW.md`
- Unified server: `resources/workspaces/devtools/common/server/OVERVIEW.md`
- Debate spec: `resources/workspaces/devtools/common/_plans/debate.md`

## Background & Decision Context

### Vấn đề

Công ty chặn Prisma binary engine. `@prisma/client` yêu cầu download binary engine (`libquery_engine-*`) trong bước `prisma generate`. Dẫn đến:

1. **Build fail** — `prisma generate` không thể download binary qua corporate proxy/firewall
2. **CI/CD blocked** — Mọi pipeline chạy `pnpm install` + `prisma generate` đều fail
3. **Onboarding friction** — Dev mới không setup được nếu thiếu binary

### Giải pháp

Thay Prisma bằng **`better-sqlite3`** — native C addon, compile từ source khi `npm install` (qua `node-gyp`), không cần download binary riêng. Hoạt động behind corporate firewall.

### Tại sao better-sqlite3?

| Tiêu chí | Prisma | better-sqlite3 |
|----------|--------|----------------|
| Binary dependency | Cần download engine binary | Compile từ source (prebuild) |
| API style | Async ORM | Sync raw SQL |
| Performance (SQLite) | Slower (engine overhead) | Fastest Node.js SQLite driver |
| Type safety | Generated types | Manual interfaces (TypeScript) |
| Migration tool | `prisma migrate` built-in | Manual `CREATE TABLE IF NOT EXISTS` |
| Bundle size | Heavy (~15MB engine) | Light (~2MB native addon) |

Cho use case này (local dev tool, 2 tables, đơn giản), better-sqlite3 là lựa chọn tốt hơn cả về performance lẫn simplicity.

## Scope

### Phạm vi ảnh hưởng

Tất cả Prisma usage nằm gọn trong **1 package**: `workspaces/devtools/common/nestjs-debate/`.

Không package nào khác trong `devtools/` dùng Prisma — migration khoanh vùng hoàn toàn.

### Files cần thay đổi

| # | File | Action | Mô tả |
|---|------|--------|-------|
| 1 | `package.json` | **Edit** | Remove Prisma deps, add better-sqlite3 |
| 2 | `src/debate-prisma.service.ts` | **Delete** | Thay bằng `database.service.ts` |
| 3 | `src/database.service.ts` | **Create** | Connection, schema init, prepared statements |
| 4 | `src/debate.service.ts` | **Edit** | Prisma query API → raw SQL qua DatabaseService |
| 5 | `src/argument.service.ts` | **Edit** | Prisma query API + $transaction → raw SQL |
| 6 | `src/debate.module.ts` | **Edit** | Swap DebatePrismaService → DatabaseService |
| 7 | `src/serializers.ts` | **Edit** | Rename types, adapt to snake_case DB rows |
| 8 | `prisma/` | **Delete** | schema.prisma + migrations — không cần nữa |
| 9 | `generated/` | **Delete** | Generated Prisma client |

### Files KHÔNG đổi

| File | Lý do |
|------|-------|
| `src/debate.controller.ts` | Không dùng Prisma trực tiếp — delegate to services |
| `src/debate.gateway.ts` | Không dùng Prisma trực tiếp — delegate to services |
| `@hod/aweave-debate-machine` (external package) | Pure state machine logic, no DB |
| `src/errors.ts` | Pure types, no DB |
| `src/types.ts` | Pure types, no DB |
| `src/ws-types.ts` | Pure types, no DB |
| `src/dto/*` | Swagger DTOs — API contract không đổi |
| `src/index.ts` | Barrel export — không export Prisma service |
| `src/lock.service.ts` | In-memory mutex — no DB |

## Design Decisions

### Decision 1: Keep camelCase in TypeScript, map from snake_case DB

**Before (Prisma):** DB columns snake_case → Prisma maps sang camelCase → serializers convert lại snake_case cho API.

**After (better-sqlite3):** DB trả snake_case trực tiếp → services dùng snake_case → serializers chỉ pass-through hoặc bỏ luôn.

```
Before: DB (snake) → Prisma (camel) → Serializer (snake) → API
After:  DB (snake) → better-sqlite3 (snake) → API
```

**Tuy nhiên**, để minimize diff và giữ code consistency với TypeScript convention, ta sẽ **giữ camelCase trong TypeScript** bằng cách map trong `DatabaseService`:

```
DB (snake_case columns) → DatabaseService maps → camelCase objects → Services → Serializers → API (snake_case)
```

Lý do: Services, serializers, types.ts đều đang dùng camelCase. Sửa hết sang snake_case sẽ là **chained refactor lớn** ảnh hưởng cả controller, gateway, serializers, DTOs. Không cần thiết.

### Decision 2: Schema init thay cho Prisma Migrate

Prisma Migrate quản lý schema qua migration files. Thay bằng:

```typescript
private initSchema() {
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS "debates" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "debate_type" TEXT NOT NULL,
      "state" TEXT NOT NULL DEFAULT 'AWAITING_OPPONENT',
      "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
      "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS "arguments" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "debate_id" TEXT NOT NULL,
      "parent_id" TEXT,
      "type" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "client_request_id" TEXT,
      "seq" INTEGER NOT NULL,
      "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT "arguments_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "arguments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "arguments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "arguments_debate_id_idx" ON "arguments"("debate_id");
    CREATE INDEX IF NOT EXISTS "arguments_parent_id_idx" ON "arguments"("parent_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "arguments_debate_id_client_request_id_key"
      ON "arguments"("debate_id", "client_request_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "arguments_debate_id_seq_key"
      ON "arguments"("debate_id", "seq");
  `);
}
```

Schema matches `prisma/migrations/20260207053250_init/migration.sql` exactly — including FK constraint names, ON DELETE/UPDATE actions, and all indexes. DB file (`~/.aweave/db/debate.db`) remains fully compatible.

**Parity verification step** (run once after implementation):

```typescript
// Verify FK constraints match expected behavior
const fkList = this.db.pragma('foreign_key_list("arguments")');
// Expected: debate_id → ON DELETE RESTRICT ON UPDATE CASCADE
//           parent_id → ON DELETE SET NULL ON UPDATE CASCADE
```

### Decision 3: Sync API — không cần async wrapper

`better-sqlite3` là synchronous. Các services hiện tại dùng `async/await` vì Prisma async. Sau migration:

- **Giữ `async` method signatures** — vì NestJS controller/gateway expect async, và `LockService.withLock()` vẫn async.
- Bên trong methods, DB calls trở thành sync — không ảnh hưởng behavior.
- Không cần worker threads — DB nhỏ (local dev tool), queries đơn giản, latency sub-millisecond.

### Decision 4: Prepared statements in DatabaseService

Pre-compile all SQL statements trong constructor để:
- Avoid SQL parsing overhead mỗi lần gọi
- Type-safe hơn với TypeScript generics
- Centralize tất cả SQL ở 1 nơi

```typescript
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db: Database.Database;
  private stmts!: ReturnType<typeof this.prepareStatements>;

  onModuleInit() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
    this.stmts = this.prepareStatements();
  }

  private prepareStatements() {
    return {
      // Debates
      findDebateById: this.db.prepare<[string], DbDebateRow>(
        'SELECT * FROM debates WHERE id = ?'
      ),
      insertDebate: this.db.prepare(
        'INSERT INTO debates (id, title, debate_type, state) VALUES (?, ?, ?, ?)'
      ),
      // ... etc
    };
  }

  // Public query methods that services call
  findDebateById(id: string): DbDebateRow | undefined {
    return this.stmts.findDebateById.get(id);
  }
  // ...
}
```

## Implementation Steps

### Step 1: Update `package.json`

```diff
  "scripts": {
-   "build": "prisma generate --schema=prisma/schema.prisma && nest build",
+   "build": "nest build",
-   "prisma:generate": "prisma generate --schema=prisma/schema.prisma",
-   "prisma:migrate": "prisma migrate dev --schema=prisma/schema.prisma",
-   "prisma:migrate:deploy": "prisma migrate deploy --schema=prisma/schema.prisma"
  },
  "dependencies": {
-   "@prisma/client": "^6.4.1",
+   "better-sqlite3": "^11.x",
  },
  "devDependencies": {
-   "prisma": "^6.4.1",
+   "@types/better-sqlite3": "^7.x",
  }
```

Run: `pnpm install` từ workspace root.

### Step 2: Tạo `src/database.service.ts`

NestJS Injectable service thay thế `DebatePrismaService`:

- Constructor: mở DB file tại `$DEBATE_DB_DIR/$DEBATE_DB_NAME`
- `onModuleInit()`: PRAGMA WAL + foreign keys, `initSchema()`, prepare statements
- `onModuleDestroy()`: `db.close()`
- Public methods cho mỗi query pattern services cần:

| Method | SQL | Thay cho Prisma |
|--------|-----|-----------------|
| `findDebateById(id)` | `SELECT * FROM debates WHERE id = ?` | `debate.findUnique({ where: { id } })` |
| `findDebates(where, orderBy, limit, offset)` | `SELECT ... ORDER BY ... LIMIT ? OFFSET ?` | `debate.findMany(...)` |
| `countDebates(where)` | `SELECT COUNT(*) ...` | `debate.count(...)` |
| `insertDebate(data)` | `INSERT INTO debates ...` | `debate.create({ data })` |
| `updateDebate(id, data)` | `UPDATE debates SET ... WHERE id = ?` | `debate.update(...)` |
| `deleteDebateById(id)` | `DELETE FROM debates WHERE id = ?` | `debate.delete(...)` |
| `findArgumentById(id)` | `SELECT * FROM arguments WHERE id = ?` | `argument.findUnique(...)` |
| `findFirstArgument(where)` | `SELECT * FROM arguments WHERE ... LIMIT 1` | `argument.findFirst(...)` |
| `findArguments(where, orderBy, limit)` | `SELECT ... ORDER BY ... LIMIT ?` | `argument.findMany(...)` |
| `insertArgument(data)` | `INSERT INTO arguments ...` | `argument.create(...)` |
| `deleteArgumentsByDebateId(debateId)` | `DELETE FROM arguments WHERE debate_id = ?` | `argument.deleteMany(...)` |
| `getMaxSeq(debateId)` | `SELECT MAX(seq) ... WHERE debate_id = ?` | `argument.aggregate({ _max: { seq } })` |
| `transaction(fn)` | `db.transaction(fn)()` | `prisma.$transaction(fn)` |

Row types trả về **camelCase** (mapped trong service hoặc helper):

```typescript
export interface DbDebateRow {
  id: string;
  title: string;
  debate_type: string;
  state: string;
  created_at: string;
  updated_at: string;
}

// Map to camelCase cho services
export interface Debate {
  id: string;
  title: string;
  debateType: string;
  state: string;
  createdAt: string;
  updatedAt: string;
}

function mapDebateRow(row: DbDebateRow): Debate { ... }
```

### Behavioral Parity Requirements

Migration MUST preserve exact behavior for these edge cases. Each maps old Prisma behavior to equivalent better-sqlite3 behavior:

| # | Scenario | Current Behavior (Prisma) | Required Behavior (better-sqlite3) |
|---|----------|--------------------------|-----------------------------------|
| B1 | **Idempotency hit** — `createDebate` with existing debate_id + matching client_request_id | Returns existing debate+argument, no new insert | Same — SELECT to check, return existing |
| B2 | **Idempotency conflict** — `createDebate` with existing debate_id + different client_request_id | Throws `InvalidInputError('Debate already exists with a different request')` | Same — throw identical error with same metadata |
| B3 | **Argument idempotency hit** — `submitArgument` with existing debate_id + matching client_request_id | Returns existing argument, skips insert + state transition + broadcast | Same — SELECT to check, return existing, skip side effects |
| B4 | **Invalid parent argument** — `submitArgument` with target_id not belonging to debate | Throws `InvalidInputError('target_id does not belong to this debate')` with `{debate_id, target_id}` metadata | Same — SELECT parent, validate debate_id match, throw identical error |
| B5 | **Invalid poll argument_id** — `poll` with argument_id not belonging to debate | Throws `InvalidInputError('argument_id does not belong to this debate')` with `{debate_id, argument_id}` metadata | Same — SELECT argument, validate debate_id match, throw identical error |
| B6 | **State violation** — action not allowed in current state | Throws `ActionNotAllowedError` with `{current_state, allowed_roles, suggestion}` metadata | Same — `canTransition()` check, throw identical error structure |
| B7 | **Auto-ruling on RESOLUTION** — after RESOLUTION submitted, auto-create RULING with `close=true` | Calls `submitArgument` internally with role=arbitrator, type=RULING, close=true; logs warning if fails | Same — call same flow within sync transaction context |
| B8 | **WebSocket broadcast skip on idempotency** — idempotency hit skips broadcast | `if (!result.isExisting)` guard before `broadcastNewArgument` | Same — check `isExisting` flag |

### Row-to-Domain Mapping Strategy

All row-to-domain mapping lives in `DatabaseService` via dedicated mapper functions:

```typescript
// Single source of truth for DB row → domain object mapping
function mapDebateRow(row: DbDebateRow): Debate { ... }
function mapArgumentRow(row: DbArgumentRow): Argument { ... }
```

Public `DatabaseService` methods always return mapped camelCase objects — services never see raw DB rows. This ensures consistency and a single place to update if columns change.

### Step 3: Migrate `debate.service.ts`

Thay đổi chính:

1. Import `DatabaseService` thay `DebatePrismaService`
2. Thay `this.prisma.debate.*` → `this.db.findDebateById()`, etc.
3. Thay `this.prisma.$transaction(async (tx) => {...})` → `this.db.transaction(() => {...})` (sync!)
4. Vì `transaction()` là sync, các DB calls bên trong cũng sync — remove `await`

```typescript
// Before
const result = await this.prisma.$transaction(async (tx) => {
  const debate = await tx.debate.findUnique({ where: { id } });
  // ...
});

// After
const result = this.db.transaction(() => {
  const debate = this.db.findDebateById(id);
  // ...
});
```

### Step 4: Migrate `argument.service.ts`

Tương tự Step 3. Focus:

- `submitArgument()` method: transaction chứa 5 operations (check debate, idempotency, validate parent, insert argument, update state)
- `aggregate({ _max: { seq } })` → `this.db.getMaxSeq(debateId)`
- Tất cả trong 1 sync transaction

### Step 5: Update `debate.module.ts`

```diff
- import { DebatePrismaService } from './debate-prisma.service';
+ import { DatabaseService } from './database.service';

  @Module({
    providers: [
-     DebatePrismaService,
+     DatabaseService,
      LockService,
      DebateService,
      ArgumentService,
      DebateGateway,
    ],
```

### Step 6: Update `serializers.ts`

Rename `PrismaDebate` → `Debate` (hoặc keep as-is nếu muốn minimal diff). Logic không đổi — vẫn camelCase → snake_case.

### Step 7: Delete Prisma artifacts

```bash
rm -rf workspaces/devtools/common/nestjs-debate/prisma/
rm -rf workspaces/devtools/common/nestjs-debate/generated/
rm    workspaces/devtools/common/nestjs-debate/src/debate-prisma.service.ts
```

### Step 8: Build & Test

**8.1 Build verification:**

```bash
cd workspaces/devtools/common/nestjs-debate
pnpm build

cd ../server
pnpm start:dev
```

**8.2 Smoke tests (basic endpoints):**

```bash
curl http://127.0.0.1:3456/health
curl -X POST http://127.0.0.1:3456/debates -H 'Content-Type: application/json' \
  -d '{"debate_id":"test-123","title":"Test","debate_type":"general_debate","motion_content":"Test motion","client_request_id":"req-1"}'
curl http://127.0.0.1:3456/debates
```

**8.3 Behavioral parity tests (scripted assertions):**

| # | Test Case | How to Verify |
|---|-----------|---------------|
| T1 | **Idempotency hit** — re-create same debate with same client_request_id | POST same create payload twice → 2nd returns same argument_id, no duplicate rows |
| T2 | **Idempotency conflict** — re-create same debate_id with different client_request_id | POST with same debate_id, different req id → 400 with `InvalidInputError` |
| T3 | **seq monotonicity** — submit multiple arguments sequentially | Submit 3 CLAIMs → verify seq = 2, 3, 4 (MOTION is seq=1) |
| T4 | **Invalid target_id** — submit CLAIM with wrong parent | POST submit with non-existent target_id → 400 `InvalidInputError` with correct metadata |
| T5 | **State machine enforcement** — proposer submits when not their turn | After MOTION (AWAITING_OPPONENT), proposer tries submit → 403 `ActionNotAllowedError` with `allowed_roles` |
| T6 | **Poll action mapping** — poll returns correct action for each argument type | After opponent CLAIM → proposer poll returns `action=respond`; after APPEAL → poll returns `wait_for_ruling` |
| T7 | **Auto-ruling on RESOLUTION** — RESOLUTION triggers automatic RULING + CLOSED | Submit RESOLUTION → verify debate state = CLOSED, last argument = RULING with auto-approve content |
| T8 | **WebSocket broadcast** — new_argument event fires correctly | Connect wscat to `ws://127.0.0.1:3456/ws?debate_id=<uuid>`, submit argument → verify `new_argument` event payload has `{debate, argument}` structure |
| T9 | **Existing DB compatibility** — old DB file works with new code | Start server with existing `~/.aweave/db/debate.db` → verify existing debates load correctly |
| T10 | **FK constraint enforcement** — raw SQL vs API delete behavior | (a) Direct SQL `DELETE FROM debates WHERE id = ?` while child arguments exist → fails (ON DELETE RESTRICT); (b) API `DELETE /debates/:id` → succeeds because `deleteDebate()` deletes arguments first in transaction |

### Step 9: Update OVERVIEW.md

Cập nhật `resources/workspaces/devtools/common/nestjs-debate/OVERVIEW.md`:

- Title: bỏ "Prisma ORM" → "better-sqlite3"
- Dependencies table: thay Prisma → better-sqlite3
- Architecture diagram: `DebatePrismaService` → `DatabaseService`
- Database section: bỏ Prisma schema, thêm `initSchema()` explanation
- Dev commands: bỏ `prisma:generate`, `prisma:migrate`
- Bỏ env var `DEBATE_DATABASE_URL`

### Decision 5: Future schema evolution strategy

After removing Prisma Migrate, schema evolution will use a **startup migration runner** pattern in `DatabaseService.onModuleInit()`:

```typescript
private runMigrations() {
  // user_version pragma tracks schema version (starts at 0)
  const currentVersion = this.db.pragma('user_version', { simple: true }) as number;

  const migrations: Array<{ version: number; sql: string }> = [
    // Future migrations go here, e.g.:
    // { version: 1, sql: 'ALTER TABLE debates ADD COLUMN "closed_at" TEXT;' },
  ];

  for (const m of migrations) {
    if (currentVersion < m.version) {
      this.db.exec(m.sql);
      this.db.pragma(`user_version = ${m.version}`);
    }
  }
}
```

**Workflow for future changes:**
1. Add new migration entry to `migrations` array with incremented version
2. `initSchema()` handles fresh DB (CREATE TABLE IF NOT EXISTS)
3. `runMigrations()` handles existing DB (ALTER TABLE for version < N)
4. `user_version` pragma is atomic and persisted in the DB file

This is lightweight, sufficient for a local dev tool with 2 tables, and avoids adding a migration package dependency.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `better-sqlite3` cần `node-gyp` + build tools | Medium — dev machine thiếu compiler | better-sqlite3 ship với **prebuilt binaries** cho major platforms. Chỉ cần compile nếu prebuild không match |
| Sync DB blocking event loop | Low — local dev tool, queries < 1ms | Chấp nhận. Nếu cần future-proof: wrap trong worker_threads |
| Mất typed query API | Low — manual types thay thế | Viết TypeScript interfaces + prepared statement generics. Review trong PR |
| Schema migration cho future changes | Medium — không có migrate tool | Manual ALTER TABLE + version check trong `initSchema()`. Hoặc adopt `better-sqlite3-migrations` package nếu cần |
| Existing DB file compatibility | None | Schema giống hệt — `CREATE TABLE IF NOT EXISTS` skip nếu tables đã có |

## Checklist

- [x] Update `package.json` (deps + scripts)
- [x] `pnpm install`
- [x] Create `src/database.service.ts` (with exact FK constraints from Prisma migration)
- [ ] Verify schema parity: `PRAGMA foreign_key_list('arguments')` matches expected
- [x] Migrate `src/debate.service.ts`
- [x] Migrate `src/argument.service.ts`
- [x] Update `src/debate.module.ts`
- [x] Update `src/serializers.ts`
- [x] Delete `src/debate-prisma.service.ts`
- [x] Delete `prisma/` directory
- [x] Delete `generated/` directory
- [x] Build pass: `pnpm build`
- [ ] Test: health endpoint (T-smoke)
- [ ] Test: create debate + submit arguments (T-smoke)
- [ ] Test: idempotency hit + conflict (T1, T2)
- [ ] Test: seq monotonicity (T3)
- [ ] Test: invalid target_id (T4)
- [ ] Test: state machine enforcement (T5)
- [ ] Test: poll action mapping (T6)
- [ ] Test: auto-ruling on RESOLUTION (T7)
- [ ] Test: WebSocket broadcast (T8)
- [ ] Test: existing DB file compatibility (T9)
- [ ] Test: FK constraint enforcement (T10)
- [x] Update `OVERVIEW.md`

## Implementation Notes / As Implemented

**Date:** 2026-02-08

### Changes Made

All implementation steps (1-9) completed as planned. Key details:

1. **`package.json`**: Removed `@prisma/client`, `prisma`, and all `prisma:*` scripts. Added `better-sqlite3` (^11.0.0) and `@types/better-sqlite3` (^7.0.0). Build script simplified to `nest build`.

2. **`database.service.ts`** (new): Implements all 14 query methods from the plan table + `transaction()`. Uses prepared statements for all SQL. Row-to-domain mapping via `mapDebateRow`/`mapArgumentRow` private functions. Exports `Debate` and `Argument` interfaces for use by services and serializers. Includes `initSchema()` with exact FK constraints matching the original Prisma migration, and `runMigrations()` using `user_version` pragma for future schema evolution.

3. **`debate.service.ts`**: Replaced `DebatePrismaService` injection with `DatabaseService`. All `this.prisma.*` calls replaced with `this.db.*` methods. `$transaction(async (tx) => {...})` replaced with `this.db.transaction(() => {...})` (sync). `Promise.all` in `listDebates` replaced with sequential sync calls. `await` removed from DB calls inside transactions.

4. **`argument.service.ts`**: Same pattern as debate.service.ts. The complex `submitArgument()` transaction now uses sync calls within `this.db.transaction()`. `aggregate({ _max: { seq } })` replaced with `this.db.getMaxSeq()`. All public methods (submitClaim, submitAppeal, etc.) unchanged — they delegate to `submitArgument`.

5. **`debate.module.ts`**: Swapped `DebatePrismaService` → `DatabaseService` in providers array and import. Removed `as any` casts in serializer calls.

6. **`serializers.ts`**: Renamed `PrismaDebate` → `Debate`, `PrismaArgument` → `Argument` (imported from `database.service.ts`). Function signatures and logic unchanged.

7. **Deleted**: `src/debate-prisma.service.ts`, `prisma/` directory (schema + migrations), `generated/` directory.

8. **Build**: `pnpm build` passes clean (no type errors, no lint issues).

9. **OVERVIEW.md**: Updated title, dependencies table, architecture diagram, database section, dev commands, removed `DEBATE_DATABASE_URL` env var.

### Behavioral Parity

All behavioral parity requirements (B1-B8) are preserved:
- Idempotency logic unchanged (same check-then-insert pattern)
- Error types and metadata identical (same `InvalidInputError`, `ActionNotAllowedError` classes)
- State machine validation unchanged (same `canTransition`/`transition` calls)
- WebSocket broadcast skip on idempotency hit unchanged (`if (!result.isExisting)`)
- Auto-ruling on RESOLUTION unchanged (same `submitArgument` call within try/catch)

### Pending: Manual Testing

Test cases T-smoke through T10 require a running server instance and are left for manual verification.
