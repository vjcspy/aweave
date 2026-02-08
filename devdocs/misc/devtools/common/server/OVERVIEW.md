# Unified NestJS Server (`@aweave/server`)

> **Source:** `devtools/common/server/`
> **Last Updated:** 2026-02-07

Unified NestJS server là **single entry point** cho tất cả backend services trong devtools. Thay vì mỗi feature có standalone server riêng, tất cả đều build thành NestJS modules và được import vào server này.

## Purpose

- **Single Process:** Chỉ cần start 1 server cho tất cả features (debate, docs, future features)
- **Shared Infrastructure:** Auth guard, exception filter, CORS — viết 1 lần, dùng chung
- **REST + WebSocket:** Phục vụ cả RESTful API cho CLI và WebSocket cho web UI
- **Module Composition:** Mỗi feature là 1 pnpm package riêng (`@aweave/nestjs-<feature>`), server chỉ import modules

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    @aweave/server                              │
│                   (NestJS Application)                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  AuthGuard   │  │  Exception  │  │   CORS Middleware    │  │
│  │ (Bearer JWT) │  │   Filter    │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                     Shared Infrastructure                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────┐  ┌────────────────────────────┐   │
│  │   DebateModule        │  │   Future: DocsModule       │   │
│  │ (@aweave/nestjs-debate)│  │ (@aweave/nestjs-docs)      │   │
│  └──────────────────────┘  └────────────────────────────┘   │
│           Feature Modules (separate pnpm packages)           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Express HTTP Server  │  WsAdapter (ws library)              │
│  Port: 3456           │  Path: /ws                           │
└──────────────────────────────────────────────────────────────┘
```

**Key design decision:** Server bản thân **không chứa business logic**. Tất cả logic nằm trong feature modules. Server chỉ cung cấp:
1. NestJS application bootstrap
2. Global guards, filters, middleware
3. Module composition (`imports: [DebateModule, ...]`)

## Dependencies

| Package | Role |
|---------|------|
| `@nestjs/core`, `@nestjs/common` | NestJS framework |
| `@nestjs/platform-express` | HTTP adapter |
| `@nestjs/platform-ws`, `@nestjs/websockets` | WebSocket adapter (ws library) |
| `@nestjs/swagger` | OpenAPI spec generation + Swagger UI |
| `@aweave/nestjs-debate` | Debate feature module (workspace dependency) |

**Dependency graph:**

```
@aweave/server
  └── @aweave/nestjs-debate (workspace:*)
  └── @aweave/nestjs-<future> (workspace:*)
```

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `SERVER_PORT` | `3456` | Listen port |
| `SERVER_HOST` | `127.0.0.1` | Bind address (localhost only by default) |
| `AUTH_TOKEN` | (none) | Bearer token. Nếu set → tất cả requests phải có `Authorization: Bearer <token>`. Nếu không set → no auth (dev mode) |

> **Note:** Feature-specific env vars (e.g. `DEBATE_DB_DIR`) được handle bởi feature module, không phải server.

## OpenAPI / Swagger

Server configures `@nestjs/swagger` in `main.ts`:
- **Swagger UI:** Served at `/api-docs` in non-production mode
- **OpenAPI spec generation:** `pnpm generate:openapi` runs a standalone script that boots the app, generates `openapi.json`, and writes it to `devtools/common/server/openapi.json`
- **`openapi.json` is committed** to the repo — `debate-web` consumes it at build time to generate typed client code
- **`extraModels` list** in both `main.ts` and the generation script must match — ensures all `$ref` targets appear in `components.schemas`

**Regenerate when API changes:**
```bash
cd devtools/common/server
pnpm generate:openapi   # writes openapi.json
cd ../debate-web
pnpm generate:types     # regenerates lib/api-types.ts from openapi.json
```

## Project Structure

```
devtools/common/server/
├── package.json                         # @aweave/server
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── openapi.json                         # Generated OpenAPI spec (committed)
├── src/
│   ├── main.ts                          # Bootstrap: NestFactory, WsAdapter, Swagger, guards, filters
│   ├── app.module.ts                    # Root module: imports feature modules
│   ├── scripts/
│   │   └── generate-openapi.ts          # Standalone OpenAPI spec generator
│   └── shared/
│       ├── guards/
│       │   └── auth.guard.ts            # Global bearer token auth
│       └── filters/
│           └── app-exception.filter.ts  # Global error envelope formatting
└── dist/                                # Build output
```

## Shared Infrastructure

### AuthGuard (`shared/guards/auth.guard.ts`)

- Reads `AUTH_TOKEN` from env
- Nếu không set → **pass through** (dev mode, no auth)
- Nếu set → require `Authorization: Bearer <token>` header
- Apply globally via `app.useGlobalGuards()`

### AppExceptionFilter (`shared/filters/app-exception.filter.ts`)

Catches tất cả exceptions và format thành standard error envelope:

```json
{
  "success": false,
  "error": {
    "code": "ACTION_NOT_ALLOWED",
    "message": "Role 'opponent' cannot submit in state 'AWAITING_PROPOSER'",
    "suggestion": "Wait for proposer to submit",
    "current_state": "AWAITING_PROPOSER",
    "allowed_roles": ["proposer"]
  }
}
```

Supports:
- Custom `AppError` từ feature modules (có `code`, `statusCode`, `suggestion`, `extraFields`)
- NestJS `HttpException`
- Unknown errors → 500 `INTERNAL_ERROR`

## Adding a New Feature Module

Pattern để thêm feature mới vào server:

1. **Tạo package** tại `devtools/<domain>/nestjs-<feature>/` (hoặc `devtools/common/nestjs-<feature>/`)
2. **Export** NestJS module từ package: `export { MyFeatureModule } from './my-feature.module'`
3. **Add dependency** trong `devtools/common/server/package.json`:
   ```json
   "@aweave/nestjs-<feature>": "workspace:*"
   ```
4. **Import** trong `app.module.ts`:
   ```typescript
   import { MyFeatureModule } from '@aweave/nestjs-<feature>';
   @Module({ imports: [DebateModule, MyFeatureModule] })
   export class AppModule {}
   ```
5. **Update** `devtools/pnpm-workspace.yaml` to include the new package path

## Development

> **Package manager:** Workspace dùng **pnpm** (không phải npm). Tất cả commands dùng `pnpm`.

> **PM2:** Production server được quản lý bởi PM2 (`devtools/ecosystem.config.cjs`). Trước khi chạy dev mode, **phải stop PM2** để tránh port conflict.

```bash
# Stop PM2 process trước khi dev
cd devtools
pm2 stop aweave-server

# Install dependencies (from workspace root)
pnpm install

# Build debate module first (dependency)
cd common/nestjs-debate && pnpm build

# Build server
cd common/server && pnpm build

# Dev mode (watch)
cd common/server && pnpm start:dev

# Start lại PM2 khi dev xong
cd devtools
pm2 start ecosystem.config.cjs --only aweave-server
```

**Health check:**
```bash
curl http://127.0.0.1:3456/health
# → {"success":true,"data":{"status":"ok"}}
```

## Related

- **Debate Feature Module:** `devtools/common/nestjs-debate/`
- **Debate Module Overview:** `devdocs/misc/devtools/common/nestjs-debate/OVERVIEW.md`
- **Debate CLI Plugin:** `devtools/common/cli-plugin-debate/`
- **Debate CLI Plugin Overview:** `devdocs/misc/devtools/common/cli-plugin-debate/OVERVIEW.md`
- **Debate Web (frontend):** `devtools/common/debate-web/`
- **Architecture Plan:** `devdocs/misc/devtools/plans/260207-unified-nestjs-server.md`
- **Global DevTools Overview:** `devdocs/misc/devtools/OVERVIEW.md`
