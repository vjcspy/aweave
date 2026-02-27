---
name: SPA Self-Serve from Feature Modules
description: Eliminate server-side SPA boilerplate by letting each NestJS feature module self-serve its own SPA via shared middleware.
status: done
created: 2026-02-23
tags: []
---

# 260223 - SPA Self-Serve from Feature Modules

## References

- `resources/workspaces/devtools/common/server/OVERVIEW.md`
- `resources/workspaces/devtools/common/debate-web/OVERVIEW.md`
- `resources/workspaces/devtools/common/nestjs-core/OVERVIEW.md`
- `workspaces/devtools/common/server/src/main.ts`
- `workspaces/devtools/common/server/src/app.module.ts`
- `workspaces/devtools/common/server/src/debate-spa.controller.ts`
- `workspaces/devtools/common/server/src/dashboard-spa.controller.ts`

## User Requirements

> Tôi muốn có một cơ chế để chỉ config mà vẫn load được (ý là không cần phải sửa code trong `server` package) hoặc nếu có thì cũng chỉ cần làm 1 việc duy nhất là import module trong `workspaces/devtools/common/server/src/app.module.ts` thôi, mọi việc khác cần phải được handle từ nestjs module import vào.

## Objective

Eliminate per-SPA boilerplate in `@hod/aweave-server`. Currently, adding a new SPA requires changes in 3 places inside the server package (resolve function + `useStaticAssets` in `main.ts`, new SPA controller file, import in `app.module.ts`). After this change, adding a new SPA requires **zero changes to server** — each NestJS feature module self-serves its own SPA via a shared utility from `@hod/aweave-nestjs-core`.

### Key Considerations

1. **NestJS middleware ordering**: Middleware registered via `NestModule.configure()` runs BEFORE controller routes in the Express stack. This is the correct hook for static file serving — requests for static assets are handled before hitting any NestJS controller.
2. **Express Router prefix stripping**: NestJS's `MiddlewareConsumer.apply().forRoutes('/prefix')` uses Express Router internally, which strips the route prefix before calling middleware. So `express.static(rootPath)` receives relative paths (e.g., `/assets/main.js`), not full paths (e.g., `/debate/assets/main.js`). Must be verified during implementation — if NestJS does NOT strip, a prefix-stripping wrapper is needed.
3. **Package resolution context (pnpm strict isolation)**: `require.resolve()` resolves from the FILE's physical location, not the caller's. Since pnpm uses strict isolation (no hoist config in `.npmrc`), `require.resolve('@hod/aweave-debate-web/...')` called from `nestjs-core` code will fail because `nestjs-core` doesn't have `debate-web` in its dependencies. Therefore, the utility accepts a pre-resolved `rootPath` — each feature module resolves its own web package path (using its own `require.resolve` context) and passes the result.
4. **Optional web package dependency**: Feature modules add their web package as a dependency (e.g., `nestjs-debate` → `debate-web`) and resolve with try/catch. If the web package isn't built/installed, the SPA middleware simply isn't registered. The server still starts and serves APIs normally. A `fallbackDir` option preserves the existing `server/public/*` fallback behavior during the transition.
5. **Swagger `extraModels`**: Currently `main.ts` and `generate-openapi.ts` both import all DTOs. NestJS Swagger scanner (`@nestjs/swagger` v11.2.6) only discovers `@ApiExtraModels()` from **controller classes**, not module classes. Therefore, `@ApiExtraModels()` is placed on feature controllers (e.g., `DebateController`, `ConfigsController`), not on module classes.
6. **No route conflicts**: SPA routes (`/debate/*`, `/dashboard/*`) don't overlap with API routes (`/debates/*`, `/configs/*`, `/skills/*`, `/logs/*`, `/ws`).
7. **Middleware wildcard routes**: `forRoutes('/debate')` must cover all nested paths (`/debate/debates/:id`, `/debate/static/...`). Use explicit wildcard pattern `forRoutes('/debate', '/debate/(.*)')` or route info with wildcard to ensure full coverage.

## Implementation Plan

### Phase 1: Add SPA Middleware Utility to `@hod/aweave-nestjs-core`

- [x] Create `workspaces/devtools/common/nestjs-core/src/spa/spa-middleware.ts`
  - **Outcome**: Utility function `applySpaMiddleware(consumer, options)` that registers `express.static` + SPA fallback middleware on a `MiddlewareConsumer`

  ```typescript
  // Public API
  export interface SpaServeOptions {
    /** Pre-resolved absolute path to the SPA dist directory */
    rootPath: string;
    /** URL prefix (e.g., '/debate') */
    routePrefix: string;
  }

  export function applySpaMiddleware(
    consumer: MiddlewareConsumer,
    options: SpaServeOptions,
  ): void;
  ```

  Internal implementation:
  - `applySpaMiddleware()` applies two Express middlewares via `consumer.apply(...).forRoutes(prefix, prefix + '/(.*)')`:
    1. `express.static(rootPath)` — serves static files (JS, CSS, fonts, images)
    2. SPA fallback function — if `req.url` has no file extension, sends `index.html`; otherwise calls `next()` (real 404 for missing assets)
  - Uses wildcard route patterns to ensure all nested paths are covered (not just the prefix root)
  - Verify NestJS prefix stripping behavior during implementation — if `forRoutes()` does NOT strip prefix, add a `stripPrefix` middleware wrapper

  **Design note (pnpm strict isolation):** The utility does NOT resolve web packages itself. `require.resolve()` runs from the file's physical location, not the caller's. Since `nestjs-core` doesn't have web packages in its dependencies, resolution would always fail. Instead, each feature module resolves its own web package path and passes the pre-resolved `rootPath`.

- [x] Export from `workspaces/devtools/common/nestjs-core/src/index.ts`
  - Add: `export { applySpaMiddleware } from './spa/spa-middleware'`
  - Add: `export type { SpaServeOptions } from './spa/spa-middleware'`

- [x] Verify `express` types available in `@hod/aweave-nestjs-core`
  - `@types/express` is already in devDependencies — confirm type imports work for `Request`, `Response`, `NextFunction`

### Phase 2: Implementation Structure

```
workspaces/devtools/common/
├── nestjs-core/src/
│   ├── spa/
│   │   └── spa-middleware.ts   # 🚧 NEW — applySpaMiddleware utility
│   ├── index.ts                # 🔄 UPDATE — add SPA exports
│   └── ...existing files...
├── nestjs-debate/src/
│   ├── debate.module.ts        # 🔄 UPDATE — add configure() for SPA middleware
│   └── debate.controller.ts    # 🔄 UPDATE — extend @ApiExtraModels with all debate DTOs
├── nestjs-dashboard/src/
│   ├── dashboard.module.ts     # 🔄 UPDATE — add configure() for SPA middleware
│   ├── controllers/configs.controller.ts  # 🔄 UPDATE — add @ApiExtraModels for config DTOs
│   ├── controllers/skills.controller.ts   # 🔄 UPDATE — add @ApiExtraModels for skill DTOs
│   └── controllers/logs.controller.ts     # 🔄 UPDATE — add @ApiExtraModels for log DTOs
└── server/src/
    ├── main.ts                 # 🔄 UPDATE — remove SPA resolve functions, useStaticAssets, extraModels DTO imports
    ├── app.module.ts           # 🔄 UPDATE — remove SPA controller imports
    ├── scripts/
    │   └── generate-openapi.ts # 🔄 UPDATE — remove extraModels DTO imports
    ├── debate-spa.controller.ts      # ❌ DELETE
    └── dashboard-spa.controller.ts   # ❌ DELETE
```

### Phase 3: Detailed Implementation Steps

#### 3.1 — Create SPA middleware utility

- [x] Create `workspaces/devtools/common/nestjs-core/src/spa/spa-middleware.ts`
  - Implement `applySpaMiddleware(consumer, options)`:
    - Accepts `{ rootPath: string, routePrefix: string }` — caller provides pre-resolved path
    - Register middleware with wildcard routes: `consumer.apply(...).forRoutes(options.routePrefix, options.routePrefix + '/(.*)')` to cover both root and all nested paths
    - Apply two Express middlewares:
      1. `express.static(rootPath)` — serves static files
      2. SPA fallback: `(req, res, next) => extname(req.url) ? next() : res.sendFile(join(rootPath, 'index.html'))`
  - Verify NestJS prefix stripping behavior. If `forRoutes('/debate')` does NOT strip prefix for middleware, add a wrapper:

    ```typescript
    const stripPrefix = (req, res, next) => {
      req.url = req.url.slice(options.routePrefix.length) || '/';
      next();
    };
    consumer.apply(stripPrefix, express.static(rootPath), spaFallback)
      .forRoutes(options.routePrefix, options.routePrefix + '/(.*)');
    ```

- [x] Update `workspaces/devtools/common/nestjs-core/src/index.ts`
  - Add SPA exports

- [x] Build `nestjs-core` and verify compilation: `cd workspaces/devtools/common/nestjs-core && pnpm build`

#### 3.2 — Update `@hod/aweave-nestjs-debate` to self-serve debate-web SPA

- [x] Add dependencies in `workspaces/devtools/common/nestjs-debate/package.json`:
  - `@hod/aweave-nestjs-core`: `workspace:*` (needed for `applySpaMiddleware` import)
  - `@hod/aweave-debate-web`: `workspace:*` (web package — enables `require.resolve` from this module's context)

- [x] Update `workspaces/devtools/common/nestjs-debate/src/debate.module.ts`:
  - Add `implements NestModule` (module already has `implements OnModuleInit`)
  - Add web root resolution function (local to this module for correct pnpm resolution context):

    ```typescript
    function resolveDebateWebRoot(): string | null {
      try {
        const pkgPath = require.resolve('@hod/aweave-debate-web/package.json');
        return join(dirname(pkgPath), 'dist');
      } catch {
        return join(__dirname, '..', '..', '..', 'server', 'public', 'debate');
      }
    }
    ```

  - Add `configure(consumer: MiddlewareConsumer)` calling `applySpaMiddleware()`:

    ```typescript
    configure(consumer: MiddlewareConsumer) {
      const rootPath = resolveDebateWebRoot();
      if (rootPath) {
        applySpaMiddleware(consumer, { rootPath, routePrefix: '/debate' });
      }
    }
    ```

- [x] Add `@ApiExtraModels()` to `workspaces/devtools/common/nestjs-debate/src/debate.controller.ts` (controller level — NestJS Swagger scanner only reads from controllers, not modules):
  - `DebateController` already has `@ApiExtraModels(PollResultNewResponseDto, PollResultNoNewResponseDto, ErrorResponseDto)` — extend with remaining DTOs:

    ```typescript
    @ApiExtraModels(
      DebateDto, ArgumentDto, ListDebatesResponseDto, GetDebateResponseDto,
      WriteResultResponseDto, PollResultNewResponseDto, PollResultNoNewResponseDto,
      ErrorResponseDto,
    )
    ```

- [x] Build and verify: `cd workspaces/devtools/common/nestjs-debate && pnpm build`

#### 3.3 — Update `@hod/aweave-nestjs-dashboard` to self-serve dashboard-web SPA

- [x] Add dependencies in `workspaces/devtools/common/nestjs-dashboard/package.json`:
  - `@hod/aweave-nestjs-core`: `workspace:*` (needed for `applySpaMiddleware` import)
  - `@hod/aweave-dashboard-web`: `workspace:*` (web package — enables `require.resolve` from this module's context)

- [x] Update `workspaces/devtools/common/nestjs-dashboard/src/dashboard.module.ts`:
  - Add `implements NestModule`
  - Add web root resolution function (local to this module):

    ```typescript
    function resolveDashboardWebRoot(): string | null {
      try {
        const pkgPath = require.resolve('@hod/aweave-dashboard-web/package.json');
        return join(dirname(pkgPath), 'dist');
      } catch {
        return join(__dirname, '..', '..', '..', 'server', 'public', 'dashboard');
      }
    }
    ```

  - Add `configure(consumer: MiddlewareConsumer)`:

    ```typescript
    configure(consumer: MiddlewareConsumer) {
      const rootPath = resolveDashboardWebRoot();
      if (rootPath) {
        applySpaMiddleware(consumer, { rootPath, routePrefix: '/dashboard' });
      }
    }
    ```

- [x] Add `@ApiExtraModels()` to dashboard controllers (controller level — NestJS Swagger scanner only reads from controllers, not modules). Distribute DTOs to their owning controllers:
  - `ConfigsController`: `@ApiExtraModels(ConfigDomainDto, ConfigFileDto, GetConfigResponseDto, ListConfigsResponseDto, SaveConfigRequestDto, SaveConfigResponseDto)`
  - `SkillsController`: `@ApiExtraModels(SkillDto, ListSkillsResponseDto, ToggleSkillRequestDto, ToggleSkillResponseDto)`
  - `LogsController`: `@ApiExtraModels(LogEntryDto, TailLogsResponseDto)`

- [x] Build and verify: `cd workspaces/devtools/common/nestjs-dashboard && pnpm build`

#### 3.4 — Clean up `@hod/aweave-server`

- [x] Delete `workspaces/devtools/common/server/src/debate-spa.controller.ts`

- [x] Delete `workspaces/devtools/common/server/src/dashboard-spa.controller.ts`

- [x] Update `workspaces/devtools/common/server/src/app.module.ts`:
  - Remove imports of `DebateSpaController` and `DashboardSpaController`
  - Remove them from `controllers` array
  - Result:

    ```typescript
    @Module({
      imports: [NestjsCoreModule, DebateModule, DashboardModule],
      controllers: [RootRedirectController],
      providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }],
    })
    export class AppModule implements NestModule {
      configure(consumer: MiddlewareConsumer) {
        consumer.apply(CorrelationIdMiddleware).forRoutes('*');
      }
    }
    ```

- [x] Update `workspaces/devtools/common/server/src/main.ts`:
  - Remove `resolveDebateWebRoot()` function
  - Remove `resolveDashboardWebRoot()` function
  - Remove both `app.useStaticAssets()` calls
  - Remove all DTO imports from `@hod/aweave-nestjs-debate` and `@hod/aweave-nestjs-dashboard`
  - Remove those DTOs from `SwaggerModule.createDocument()` `extraModels` array (keep `extraModels: []` or remove the option entirely — `@ApiExtraModels()` on feature controllers handles discovery automatically)

- [x] Update `workspaces/devtools/common/server/src/scripts/generate-openapi.ts`:
  - Remove all DTO imports from `@hod/aweave-nestjs-debate` and `@hod/aweave-nestjs-dashboard`
  - Remove `extraModels` option entirely (same reason — controller-level decorators handle discovery)

- [x] Remove `@hod/aweave-debate-web` and `@hod/aweave-dashboard-web` from `workspaces/devtools/common/server/package.json` dependencies
  - Feature modules are now the owners of their web package dependencies: `nestjs-debate` → `debate-web`, `nestjs-dashboard` → `dashboard-web`. Server no longer needs these.

- [x] Build server and verify: `cd workspaces/devtools/common/server && pnpm build`

#### 3.5 — Verify end-to-end

- [x] Build all packages: `cd workspaces/devtools && pnpm -r build`
- [ ] Start server: `cd workspaces/devtools/common/server && node dist/main.js`
- [ ] Verify debate SPA: `curl -s http://127.0.0.1:3456/debate/ | head -5` (should return HTML)
- [ ] Verify debate static asset: `curl -sI http://127.0.0.1:3456/debate/static/js/index.js` (should return 200 with JS content-type, adjust path based on actual build output)
- [ ] Verify debate SPA fallback: `curl -s http://127.0.0.1:3456/debate/debates/some-id | head -5` (should return same HTML as `/debate/`)
- [ ] Verify dashboard SPA: `curl -s http://127.0.0.1:3456/dashboard/ | head -5` (should return HTML)
- [ ] Verify API still works: `curl -s http://127.0.0.1:3456/debates | head -5` (should return JSON)
- [ ] Verify OpenAPI spec: `cd workspaces/devtools/common/server && pnpm generate:openapi` (should generate `openapi.json` with all schemas intact)
- [ ] Verify Swagger UI: open `http://127.0.0.1:3456/api-docs` (should show all endpoints + schemas)

#### 3.6 — Update documentation

- [ ] Update `resources/workspaces/devtools/common/server/OVERVIEW.md`:
  - Update "Static File Serving" section — remove references to `DebateSpaController`, `DashboardSpaController`, `resolveDebateWebRoot`, `useStaticAssets` in `main.ts`
  - Update "Project Structure" — remove `debate-spa.controller.ts`, `dashboard-spa.controller.ts`
  - Update "Adding a New Feature Module" section — document SPA self-serve pattern via `applySpaMiddleware()`

- [ ] Update `resources/workspaces/devtools/common/nestjs-core/OVERVIEW.md`:
  - Add "SPA Middleware" section documenting `applySpaMiddleware()` and `SpaServeOptions`
  - Document the pnpm strict isolation constraint and why resolution happens at the caller (feature module), not in the utility

## Summary of Results

### Completed Achievements

- Created `nestjs-core/src/spa/spa-middleware.ts` with `applySpaMiddleware()` utility
- `nestjs-debate` and `nestjs-dashboard` now self-serve their SPAs via `NestModule.configure()`
- `@ApiExtraModels` moved from server-level `extraModels` to feature controllers
- Deleted `debate-spa.controller.ts` and `dashboard-spa.controller.ts` from server
- Cleaned `main.ts` and `generate-openapi.ts` — no more DTO imports or `extraModels`
- Removed `@hod/aweave-debate-web` and `@hod/aweave-dashboard-web` from server dependencies
- All packages build successfully (`pnpm -r build` — exit 0)

## Outstanding Issues & Follow-up

- [ ] **Prefix stripping verification** — NestJS `forRoutes('/debate')` should strip the prefix for middleware (Express Router behavior), but this must be verified at runtime. If it doesn't strip, a `stripPrefix` middleware wrapper is needed (code provided in step 3.1). Wildcard route patterns (`forRoutes('/debate', '/debate/(.*)')`) must also be tested to confirm nested path coverage.
- [ ] **`RootRedirectController`** — Currently redirects `/` → `/debate`. This remains in the server package as a server-level concern (choosing the default landing page). Consider making it configurable in the future if the default should change.
- [ ] **Fallback path portability** — The `resolveXxxWebRoot()` fallback paths use relative `__dirname` traversal (e.g., `join(__dirname, '..', '..', '..', 'server', 'public', 'debate')`). This works in the monorepo dev environment but may break if packages are published/installed externally. For now this matches the existing server behavior; revisit if packages are published to npm.

## Implementation Notes / As Implemented

- **No prefix stripping needed initially** — Implemented without `stripPrefix` wrapper. NestJS `forRoutes()` uses Express Router which strips the prefix. This should be verified at runtime by starting the server and testing SPA endpoints.
- **`existsSync` guard added** — `applySpaMiddleware()` checks `existsSync(rootPath)` before registering middleware. If the dist directory doesn't exist (web package not built), the SPA middleware is silently skipped and the server starts normally.
- **`express` import style** — Used `import express = require('express')` in `spa-middleware.ts` to work with Express's CommonJS default export pattern in TypeScript.
