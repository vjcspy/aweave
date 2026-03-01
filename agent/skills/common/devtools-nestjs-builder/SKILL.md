---
name: devtools-nestjs-builder
description: Guide for building NestJS backend modules and serving React SPAs in the devtools TypeScript monorepo. Use when creating NestJS feature modules, adding REST/WebSocket endpoints, registering OpenAPI schemas, adding SPA serving paths, or working with shared NestJS infrastructure in workspaces/devtools/.
---

# Devtools NestJS Builder

## Overview

Build NestJS backend modules in `workspaces/devtools/`. The unified server (`@hod/aweave-server`) imports feature modules — it contains **no business logic** itself. Each feature is a separate pnpm package (`@hod/aweave-nestjs-<feature>`) that owns its controllers, services, DTOs, and optionally serves a React SPA.

**Core Principles:**

1. **Server is a shell** — `app.module.ts` only imports modules. No feature-specific code in server.
2. **Feature modules own everything** — controllers, services, DTOs, OpenAPI schemas, SPA serving.
3. **Shared infra lives in `nestjs-core`** — logging, middleware, SPA utilities go in `@hod/aweave-nestjs-core`.
4. **pnpm strict isolation** — `require.resolve()` runs from the file's physical location. Packages only see their own declared dependencies.

---

## Architecture

```
@hod/aweave-server (shell — imports modules, global guards/filters)
     ↑
     ├── @hod/aweave-nestjs-core (@Global — logging, correlation ID, SPA utility)
     ├── @hod/aweave-nestjs-debate (feature module + serves debate-web SPA)
     ├── @hod/aweave-nestjs-dashboard (feature module + serves dashboard-web SPA)
     └── @hod/aweave-nestjs-<future> (new feature modules)
```

### Package Map

| Package | npm name | Location |
|---------|----------|----------|
| Server | `@hod/aweave-server` | `workspaces/devtools/common/server/` |
| Core | `@hod/aweave-nestjs-core` | `workspaces/devtools/common/nestjs-core/` |
| Feature modules | `@hod/aweave-nestjs-<name>` | `workspaces/devtools/common/nestjs-<name>/` |
| Web apps | `@hod/aweave-<name>-web` | `workspaces/devtools/common/<name>-web/` |

---

## Creating a New Feature Module

### Step 1: Scaffold Package

```
workspaces/devtools/common/nestjs-<feature>/
├── package.json
├── tsconfig.json
├── eslint.config.mjs
└── src/
    ├── index.ts                    # Barrel exports (module + DTOs)
    ├── <feature>.module.ts         # NestJS module
    ├── <feature>.controller.ts     # REST endpoints + @ApiExtraModels
    ├── <feature>.service.ts        # Business logic
    └── dto/
        ├── index.ts                # Re-export all DTOs
        └── <feature>.dto.ts        # Request/Response DTOs with Swagger decorators
```

### Step 2: package.json

```json
{
  "name": "@hod/aweave-nestjs-<feature>",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "dependencies": {
    "@hod/aweave-nestjs-core": "workspace:*",
    "@nestjs/common": "catalog:",
    "@nestjs/swagger": "catalog:"
  },
  "peerDependencies": {
    "@nestjs/core": "catalog:"
  }
}
```

### Step 3: Module Class

```typescript
import { Module } from '@nestjs/common';
import { FeatureController } from './<feature>.controller';
import { FeatureService } from './<feature>.service';

@Module({
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService],
})
export class FeatureModule {}
```

### Step 4: Register in Server

1. Add to `pnpm-workspace.yaml`
2. Add `"@hod/aweave-nestjs-<feature>": "workspace:*"` to `server/package.json` dependencies
3. Import in `server/src/app.module.ts`:

```typescript
import { FeatureModule } from '@hod/aweave-nestjs-<feature>';

@Module({
  imports: [NestjsCoreModule, DebateModule, DashboardModule, FeatureModule],
  // ...
})
export class AppModule {}
```

**That's it.** No changes to `main.ts`, no SPA controllers, no DTO imports in server.

---

## OpenAPI / Swagger (CRITICAL)

### Rule: Declare `@ApiExtraModels()` on CONTROLLERS, Not Modules

NestJS Swagger scanner (`@nestjs/swagger` v11+) only discovers `@ApiExtraModels()` from **controller classes**. Module-level decorators are ignored by the scanner.

```typescript
// ✅ CORRECT — on controller class
@ApiExtraModels(FeatureDto, ListFeatureResponseDto, ErrorResponseDto)
@Controller('features')
export class FeatureController { ... }

// ❌ WRONG — scanner doesn't read module metadata
@ApiExtraModels(FeatureDto, ListFeatureResponseDto, ErrorResponseDto)
@Module({ ... })
export class FeatureModule { ... }
```

### Rule: DTOs Stay in Feature Package

Each feature module declares and exports its own DTOs. Server does NOT import DTOs.

```typescript
// nestjs-<feature>/src/index.ts
export { FeatureModule } from './<feature>.module';
export * from './dto';     // DTOs consumed by CLI or other packages
```

### OpenAPI Spec Generation

Server provides a standalone script that boots the app and generates `openapi.json`:

```bash
cd workspaces/devtools/common/server && pnpm generate:openapi
```

The script uses `SwaggerModule.createDocument(app, config)` with NO `extraModels` option — schemas are discovered automatically from `@ApiExtraModels()` on controllers.

After API changes:

```bash
cd workspaces/devtools/common/server && pnpm generate:openapi
cd workspaces/devtools/common/<name>-web && pnpm generate:types
```

---

## Serving a React SPA from a Feature Module

### How It Works

Feature modules serve their React SPA using `applySpaMiddleware()` from `@hod/aweave-nestjs-core`. This registers Express static file serving + SPA fallback (serves `index.html` for client-side routes) via NestJS middleware.

### Step 1: Add Web Package Dependency

```json
{
  "dependencies": {
    "@hod/aweave-<feature>-web": "workspace:*"
  }
}
```

### Step 2: Implement `NestModule.configure()`

```typescript
import { applySpaMiddleware } from '@hod/aweave-nestjs-core';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { dirname, join } from 'path';

function resolveFeatureWebRoot(): string | null {
  try {
    const pkgPath = require.resolve('@hod/aweave-<feature>-web/package.json');
    return join(dirname(pkgPath), 'dist');
  } catch {
    return join(__dirname, '..', '..', '..', 'server', 'public', '<feature>');
  }
}

@Module({ ... })
export class FeatureModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    const rootPath = resolveFeatureWebRoot();
    if (rootPath) {
      applySpaMiddleware(consumer, { rootPath, routePrefix: '/<feature>' });
    }
  }
}
```

### Critical: pnpm Strict Isolation

`require.resolve()` resolves from the **file's physical location**, not the caller's. The resolve function **must live inside the feature module**, not in `nestjs-core`.

```typescript
// ❌ WRONG — nestjs-core can't see feature web packages
// (in @hod/aweave-nestjs-core/src/spa/spa-middleware.ts)
export function resolveWebRoot(pkg: string) {
  return require.resolve(`${pkg}/package.json`); // ALWAYS FAILS
}

// ✅ CORRECT — resolve in the feature module's own context
// (in @hod/aweave-nestjs-debate/src/debate.module.ts)
function resolveDebateWebRoot(): string | null {
  try {
    const pkgPath = require.resolve('@hod/aweave-debate-web/package.json');
    return join(dirname(pkgPath), 'dist');
  } catch {
    return join(__dirname, '..', '..', '..', 'server', 'public', 'debate');
  }
}
```

The utility `applySpaMiddleware()` accepts a pre-resolved `rootPath` — it never resolves packages itself.

### Route Behavior

| Request | Handling |
|---------|----------|
| `/<feature>/assets/main.js` | `express.static` serves the file |
| `/<feature>/some/client-route` | SPA fallback serves `index.html` |
| `/<feature>/missing.css` | Returns 404 (has file extension, not found) |
| `/api-routes/*` | Handled by NestJS controllers (no prefix conflict) |

---

## Shared Code: What Goes Where

| Code | Location | Package |
|------|----------|---------|
| Logging (pino, NestLoggerService) | `nestjs-core/src/logging/` | `@hod/aweave-nestjs-core` |
| Correlation ID middleware | `nestjs-core/src/middleware/` | `@hod/aweave-nestjs-core` |
| SPA middleware utility | `nestjs-core/src/spa/` | `@hod/aweave-nestjs-core` |
| Future shared NestJS infra | `nestjs-core/src/<domain>/` | `@hod/aweave-nestjs-core` |
| Feature controllers/services | `nestjs-<feature>/src/` | `@hod/aweave-nestjs-<feature>` |
| Feature DTOs | `nestjs-<feature>/src/dto/` | `@hod/aweave-nestjs-<feature>` |
| Auth guard, exception filter | `server/src/shared/` | `@hod/aweave-server` |

### Logging

**MANDATORY rules:**

1. **NEVER use `console.log` / `console.error`** in any NestJS code — always use injected logger.
2. **Inject `NestLoggerService`** or NestJS built-in `Logger` (both back onto pino via the global provider).
   - `NestLoggerService` is globally available — `NestjsCoreModule` is `@Global()`. Just inject it.
3. **Underlying logger**: `createLogger({ name: 'server', service: 'aweave-server' })` from `@hod/aweave-node-shared`, created inside `NestLoggerService`.
4. **Log files**: `~/.aweave/logs/server.jsonl` (all levels) and `server.error.jsonl` (error-only), daily rotation.
5. **Console output**: goes to **stderr** (fd 2) — safe for MCP and CLI stdout. Never stdout.

**What to log:**

- Service method entry/exit for complex or async flows
- External API calls and their results
- Lifecycle events (module init, config load)
- Caught errors with full context

**Example — Pino-style (preferred):**

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DebateService {
  private readonly logger = new Logger(DebateService.name);

  async createDebate(dto: CreateDebateDto) {
    // Preferred: Pino-style with structured data as first arg, message string second
    this.logger.debug({ debateId: dto.debate_id }, 'Creating debate');
    try {
      const result = await this.db.create(dto);
      this.logger.log({ debateId: result.id }, 'Debate created');
      return result;
    } catch (e) {
      this.logger.error({ debateId: dto.debate_id, err: e }, 'Failed to create debate');
      throw e;
    }
  }
}
```

**Also supported — NestJS-style (simple messages):**

```typescript
this.logger.log('Server started');
this.logger.error('Failed to create debate', (e as Error).stack);
```

> **Note:** `NestLoggerService` auto-detects the call convention. Pino-style `(object, string)` merges the object as top-level log fields. NestJS-style `(string)` passes the string as the `msg` field. Both work — prefer Pino-style when you have structured data to include.

**Rules:**

1. **Generic NestJS utilities → `nestjs-core`** — anything reusable across feature modules
2. **Feature-specific logic → `nestjs-<feature>`** — never in server, never in nestjs-core
3. **`nestjs-core` is `@Global()`** — providers are available everywhere without explicit import
4. **No cross-feature imports** — `nestjs-debate` never imports from `nestjs-dashboard`

---

## Checklist

### New Feature Module

- [ ] Package at `workspaces/devtools/common/nestjs-<feature>/`
- [ ] `@ApiExtraModels()` on controller class (NOT module) with all DTOs
- [ ] DTOs exported from `src/index.ts` barrel
- [ ] Added to `pnpm-workspace.yaml`
- [ ] Added as dependency of `@hod/aweave-server`
- [ ] Imported in `server/src/app.module.ts` — **only change needed in server**
- [ ] `pnpm -r build` passes
- [ ] OpenAPI spec regenerated: `pnpm generate:openapi`

### Adding SPA Serving

- [ ] Web package added as dependency of the feature module (not server)
- [ ] `resolveXxxWebRoot()` function defined **inside the feature module** (pnpm isolation)
- [ ] `implements NestModule` + `configure()` calling `applySpaMiddleware()`
- [ ] Fallback path preserved for legacy `server/public/` layout
- [ ] SPA route prefix doesn't conflict with API routes
- [ ] Verified: static files, SPA fallback, and API all work after build

### Adding Shared Utility to nestjs-core

- [ ] Created in appropriate subfolder under `nestjs-core/src/`
- [ ] Exported from `nestjs-core/src/index.ts`
- [ ] No feature-specific or web-package dependencies in `nestjs-core`
- [ ] `nestjs-core` build passes independently

---

## Reference

- **Server OVERVIEW:** `resources/workspaces/devtools/common/server/OVERVIEW.md`
- **NestJS Core OVERVIEW:** `resources/workspaces/devtools/common/nestjs-core/OVERVIEW.md`
- **SPA middleware implementation:** `workspaces/devtools/common/nestjs-core/src/spa/spa-middleware.ts`
- **Example feature module (debate):** `workspaces/devtools/common/nestjs-debate/src/debate.module.ts`
- **Example feature module (dashboard):** `workspaces/devtools/common/nestjs-dashboard/src/dashboard.module.ts`
- **SPA self-serve plan:** `resources/workspaces/devtools/common/_plans/260223-spa-self-serve-from-feature-modules.md`
- **CLI builder skill:** `agent/skills/common/devtools-cli-builder/SKILL.md`
