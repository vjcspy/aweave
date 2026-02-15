# 📋 [NPM-PKG: 2026-02-11] - Single NPM Package Architecture

## References

- `devdocs/misc/devtools/OVERVIEW.md` — DevTools global overview
- `devdocs/misc/devtools/common/cli/OVERVIEW.md` — CLI entrypoint overview
- `devdocs/misc/devtools/common/server/OVERVIEW.md` — NestJS server overview
- `devdocs/misc/devtools/common/debate-web/OVERVIEW.md` — debate-web overview
- `devtools/ecosystem.config.cjs` — Current PM2 config
- `devtools/package.json` — Workspace root
- `devtools/pnpm-workspace.yaml` — Workspace packages
- `devtools/common/cli/package.json` — CLI oclif config
- `devtools/common/server/package.json` — NestJS server dependencies
- `devtools/common/debate-web/package.json` — debate-web dependencies

## User Requirements

1. Publish **duy nhất 1 npm package** chứa toàn bộ CLI, server, và web applications
2. Người dùng có thể cài và chạy trực tiếp từ `npx` hoặc `npm install -g` mà không cần pull repo
3. Frontend là static SPA (React thuần, không SSR)
4. Chỉ chạy **1 process duy nhất** (NestJS server) serve cả API + WebSocket + static frontend trên **1 port**
5. Loại bỏ hoàn toàn dependency vào PM2
6. CLI có commands quản lý server process (start, stop, status, restart)

## 🎯 Objective

Chuyển đổi devtools monorepo từ mô hình "pull repo + pnpm link + pm2 start nhiều process" sang mô hình "npm publishable, install global hoặc npx, 1 process, 1 port". Giữ nguyên monorepo structure cho development.

> **As implemented:** Publish tất cả workspace packages riêng lẻ lên npm (`pnpm -r publish`). User chạy `npx @hod/aweave server start --open` — npm tự resolve dependency graph. Approach "1 npm package duy nhất" (bundleDependencies) không khả thi với pnpm/yarn vì symlinks — xem Phase 4 implementation notes.

### ⚠️ Key Considerations

1. **Monorepo giữ nguyên cho dev** — pnpm workspaces, workspace:* protocol, package boundaries — tất cả giữ nguyên. Chỉ thêm publish pipeline ở cuối.

2. **`workflow-dashboard` KHÔNG phải web app** — Đây là Ink (terminal UI) package, dùng `ink` + `react` để render trong terminal. KHÔNG cần convert sang Rsbuild. Chỉ `debate-web` là web frontend cần convert.

3. **`better-sqlite3` là native module** — Cần compile cho target OS lúc `npm install`. Hoạt động bình thường nhưng cần test trên cả macOS và Linux.

4. **`@nestjs/serve-static` thay vì proxy** — NestJS trực tiếp serve static files, không cần proxy layer riêng. Đơn giản hơn và ít moving parts hơn.

5. **CORS không còn cần thiết** — Khi frontend và API cùng origin (same port), CORS config hiện tại (`origin: '*'`) có thể thu hẹp hoặc bỏ.

6. **Dev workflow thay đổi** — Dev frontend cần Rsbuild dev server + proxy tới NestJS. Cần document rõ.

7. **oclif `prepack` + `pnpm deploy`** — oclif có built-in `prepack` hook (generate manifest). Kết hợp với `pnpm deploy` để flatten workspace deps.

8. **Server name trong `package.json`** — Hiện tại `server/package.json` có `"name": "server"` (không scoped). Cần đổi thành `"name": "@hod/aweave-server"` để `pnpm deploy` resolve đúng.

## 🔄 Implementation Plan

### Phase 1: Setup `debate-web` với Rsbuild + React SPA

**Mục tiêu:** debate-web build ra static HTML/JS/CSS, không cần Node.js server runtime.

> **Tại sao Rsbuild:** Rsbuild dùng Rspack (Rust-based bundler), không phụ thuộc esbuild (bị chặn bởi company policy), performance tốt, built-in PostCSS/TypeScript support.

- [x] **1.1** Tạo Rsbuild project config cho `debate-web`
  - Thêm `rsbuild.config.ts` với React plugin + Tailwind CSS (PostCSS built-in)
  - Tạo `src/index.html` (HTML template)
  - Tạo `src/main.tsx` (React root mount, configured via `source.entry`)
  - **Outcome**: Rsbuild project có thể build, output ra `dist/` với static files

- [x] **1.2** Setup routing với `react-router`
  - Cấu trúc routes:
    - `/` → redirect tới `/debates`
    - `/debates` → debate list (empty state)
    - `/debates/:id` → debate detail với `useParams()`
  - Layout: sidebar layout wrapper + root layout (ThemeProvider) trong `src/main.tsx`
  - **Outcome**: 3 routes hoạt động: `/`, `/debates`, `/debates/:id`

- [x] **1.3** Setup component code trong `src/`
  - Tổ chức `components/`, `hooks/`, `lib/` trong `src/`
  - Routing hooks: dùng `react-router` (`useNavigate`, `useParams`, `useLocation`)
  - Fonts: self-hosted via `@fontsource/geist-sans` + `@fontsource/geist-mono` hoặc CSS `@font-face`
  - Title/description: đặt trong `src/index.html` `<head>`
  - Theme toggle: custom hook đơn giản (toggle class `dark` trên `<html>`, persist vào `localStorage`)
  - Path aliases: `@/` → Rsbuild `source.alias` config
  - **Outcome**: Tất cả components compile không lỗi, fonts render đúng

- [x] **1.4** Setup styling
  - Tailwind CSS v4 + PostCSS → Rsbuild có built-in PostCSS support
  - Global styles trong `src/globals.css`
  - shadcn/ui components hoạt động bình thường
  - **Outcome**: UI render đúng, dark/light mode hoạt động

- [x] **1.5** Cập nhật API client config
  - `lib/api.ts` dùng `openapi-fetch` — giữ nguyên
  - **Env vars:** dùng `process.env.PUBLIC_*` (Rsbuild convention, `PUBLIC_` prefix for client-side env vars)
  - Tạo runtime config module (`src/lib/config.ts`):
    ```typescript
    export const config = {
      // Base URL for REST API — code appends path like `/debates`
      apiBaseUrl: process.env.PUBLIC_API_URL || window.location.origin,
      // Base URL for WebSocket — code appends `/ws?debate_id=...`
      wsBaseUrl: process.env.PUBLIC_WS_URL ||
        `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`,
    };
    // Usage: `${config.wsBaseUrl}/ws?debate_id=${id}` — no double `/ws/ws`
    ```
  - Production (served by NestJS): `window.location.origin` (same origin, no env vars needed)
  - Dev mode: Rsbuild proxy handles `/debates` và `/ws` → relative URLs work, hoặc set `PUBLIC_API_URL` explicitly
  - **Outcome**: API calls và WebSocket hoạt động cả dev mode và production

- [x] **1.6** Cập nhật build scripts trong `package.json`
  - `"build": "rsbuild build"` → output `dist/` (static files)
  - `"dev": "rsbuild dev"` → dev server với HMR
  - `"preview": "rsbuild preview"` → preview production build
  - Giữ `"generate:types"` và `"prebuild"` scripts
  - **Outcome**: `pnpm build` tạo `dist/` chứa `index.html` + assets

- [x] **1.7** Cấu hình Rsbuild proxy cho dev mode
  - Config trong `rsbuild.config.ts` → `server.proxy`:
    - `/debates` → `http://127.0.0.1:3456` (REST API)
    - `/ws` → `ws://127.0.0.1:3456` (WebSocket, `ws: true`)
  - **Outcome**: Dev workflow: Rsbuild dev server (HMR) + NestJS server chạy song song

- [x] **1.8** Setup dependencies
  - Add Rsbuild: `@rsbuild/core`, `@rsbuild/plugin-react`
  - Add routing: `react-router` (hoặc `react-router-dom`)
  - Add fonts: `@fontsource/geist-sans`, `@fontsource/geist-mono`
  - Cleanup legacy config/deps nếu còn
  - **Outcome**: Dependencies sạch, chỉ có Rsbuild + React ecosystem

- [x] **1.9** Verify toàn bộ debate-web hoạt động
  - `pnpm build` → output static files
  - `pnpm dev` → Rsbuild dev server, HMR hoạt động
  - Tất cả UI: sidebar, debate list, argument cards, action area, theme toggle
  - WebSocket: real-time updates, reconnect
  - API: list debates, get debate, submit intervention/ruling
  - **Outcome**: Tất cả features hoạt động đúng

**Files thay đổi:**

```
devtools/common/debate-web/
├── rsbuild.config.ts             # 🚧 NEW — Rsbuild + React + Tailwind
├── package.json                  # 🔄 MODIFY — Rsbuild deps
├── tsconfig.json                 # 🔄 MODIFY — update for Rsbuild
├── src/                          # 🚧 NEW directory
│   ├── index.html                # 🚧 NEW — HTML template
│   ├── main.tsx                  # 🚧 NEW — React root mount + router (entry)
│   ├── globals.css               # 🔄 MOVE from app/globals.css
│   ├── components/               # 🔄 MOVE from components/
│   │   ├── ui/                   # unchanged (shadcn)
│   │   ├── debate/               # minor import path updates
│   │   ├── layout/               # minor import path updates
│   │   └── providers/            # theme provider (custom hook)
│   ├── hooks/                    # 🔄 MOVE from hooks/
│   ├── lib/                      # 🔄 MOVE from lib/
│   └── routes/                   # 🚧 NEW — route components
│       ├── root-layout.tsx       # from app/layout.tsx
│       ├── debates-layout.tsx    # from app/debates/layout.tsx
│       ├── debates-index.tsx     # from app/debates/page.tsx
│       └── debate-detail.tsx     # from app/debates/[id]/page.tsx
└── postcss.config.mjs            # ❌ DELETE (Rsbuild handles PostCSS)
```

---

### Phase 2: NestJS serve static frontend (Single Port)

**Mục tiêu:** NestJS server serve cả API + WebSocket + static frontend trên 1 port duy nhất.

- [x] **2.1** Install `@nestjs/serve-static` trong `@hod/aweave-server`
  - `pnpm add @nestjs/serve-static` trong `devtools/common/server/`
  - **Outcome**: Package available

- [x] **2.2** Configure `ServeStaticModule` trong `app.module.ts`
  - Serve `debate-web` SPA dưới prefix `/debate`
  - SPA fallback: mọi sub-path `/debate/*` trả về `index.html`
  - Static files path: resolve relative từ server package (xác định lúc build pipeline)
  - **Outcome**: `http://localhost:3456/debate` serve debate SPA

  ```typescript
  // devtools/common/server/src/app.module.ts
  import { DebateModule } from '@hod/aweave-nestjs-debate';
  import { Module } from '@nestjs/common';
  import { ServeStaticModule } from '@nestjs/serve-static';
  import { join } from 'path';
  import { DebateSpaController } from './debate-spa.controller';

  @Module({
    imports: [
      DebateModule,
      ServeStaticModule.forRoot({
        rootPath: join(__dirname, '..', 'public', 'debate'),
        serveRoot: '/debate',
        serveStaticOptions: {
          index: ['index.html'],
          fallthrough: true, // fall through to controller when file not found
        },
      }),
    ],
    controllers: [DebateSpaController],
  })
  export class AppModule {}
  ```

  **SPA fallback controller** — handles deep-link navigation (e.g. `/debate/debates/123`). `ServeStaticModule` alone only serves real files; unknown sub-paths need explicit fallback to `index.html`:

  ```typescript
  // devtools/common/server/src/debate-spa.controller.ts
  import { Controller, Get, Res } from '@nestjs/common';
  import { Response } from 'express';
  import { join } from 'path';

  @Controller()
  export class DebateSpaController {
    @Get(['/debate', '/debate/*'])
    serveDebateSpa(@Res() res: Response) {
      return res.sendFile(join(__dirname, '..', 'public', 'debate', 'index.html'));
    }
  }
  ```

  **How it works:** `ServeStaticModule` with `fallthrough: true` serves real static files (JS/CSS/images) under `/debate/`. When no matching file exists (e.g. `/debate/debates/123`), request falls through to `DebateSpaController` which returns `index.html`, enabling react-router client-side routing. API routes (`/debates`, `/ws`) are unaffected since they don't start with `/debate`.

- [x] **2.3** Cập nhật `debate-web` base path
  - Rsbuild config: `output.assetPrefix: '/debate/'` — tất cả asset paths prefix `/debate/`
  - `react-router` basename: `/debate`
  - **URL shape:** Server mounts SPA at `/debate`. Within the SPA, react-router handles sub-routes → full URL examples: `/debate` (root → redirect to list), `/debate/debates` (list), `/debate/debates/:id` (detail). Server API stays at root: `/debates`, `/ws`.
  - **Outcome**: SPA hoạt động đúng khi served dưới sub-path `/debate/`

- [x] **2.4** Cập nhật WebSocket URL trong debate-web
  - Production: `ws://${window.location.host}/ws` (same origin)
  - Không cần env var riêng cho WebSocket URL
  - **Outcome**: WebSocket kết nối qua same origin

- [x] **2.5** Thu hẹp CORS config
  - CORS chỉ relevant cho browser requests (CLI requests không dùng CORS)
  - Khi frontend same-origin (single port), browser requests **không trigger CORS** → có thể disable CORS entirely trong production mode
  - Dev mode: Rsbuild proxy handles cross-origin → CORS cũng không cần
  - **Outcome**: CORS config simplified — disable in production, optional for dev

- [x] **2.6** Thêm redirect route `/` → `/debate`
  - Khi user truy cập `http://localhost:3456/`, redirect tới `/debate`
  - Implement bằng NestJS controller hoặc middleware
  - **Outcome**: UX mượt — user không cần nhớ sub-path

- [x] **2.7** Verify integration
  - `pnpm build` (server + debate-web)
  - Copy debate-web `dist/` → server `public/debate/`
  - Start server: `node dist/main.js`
  - Browser: `http://localhost:3456/debate` → debate SPA loads
  - **SPA deep-link:** `http://localhost:3456/debate/debates/<id>` → direct navigation works, refresh loads correctly (no 404)
  - API: `http://localhost:3456/debates` → JSON response (not intercepted by static middleware)
  - WebSocket: `ws://localhost:3456/ws` → connects (not intercepted by static middleware)
  - Static assets: `http://localhost:3456/debate/assets/xxx.js` → serves actual file
  - **Outcome**: 1 process, 1 port, SPA routing + API + WebSocket all work correctly

**Files thay đổi:**

```
devtools/common/server/
├── package.json                  # 🔄 ADD @nestjs/serve-static dependency
├── src/
│   ├── app.module.ts             # 🔄 ADD ServeStaticModule config + DebateSpaController
│   ├── debate-spa.controller.ts  # 🚧 NEW — SPA fallback for deep links
│   └── main.ts                   # 🔄 MODIFY CORS config
└── public/                       # 🚧 NEW — build pipeline copies SPA here
    └── debate/                   # debate-web build output (gitignored)

devtools/common/debate-web/
├── rsbuild.config.ts             # 🔄 ADD output.assetPrefix: '/debate/'
└── src/main.tsx                  # 🔄 ADD router basename
```

---

### Phase 3: CLI Process Management (Replace PM2)

**Mục tiêu:** CLI tự quản lý server process. Loại bỏ PM2 dependency hoàn toàn.

- [x] **3.1** Thiết kế process management module
  - Tạo module trong `@hod/aweave-cli-shared` (hoặc package riêng `@hod/aweave-process-manager`)
  - **Target platforms:** macOS + Linux only (Windows daemon management deferred — `detached` + signals behave differently on Windows, sẽ address nếu có demand)
  - Core functions:
    - `startServer()` — spawn detached child process
    - `stopServer()` — kill process by PID (SIGTERM → SIGKILL fallback)
    - `getServerStatus()` — check PID alive + health endpoint
    - `restartServer()` — stop + start
  - **Outcome**: Module API defined

- [x] **3.2** Implement daemonization with strict lifecycle contract
  - Sử dụng `child_process.spawn` với options:
    ```typescript
    spawn('node', [serverEntryPath], {
      detached: true,
      stdio: ['ignore', logFd, logFd],  // redirect stdout/stderr to log file
      env: { ...process.env, SERVER_PORT: '3456', SERVER_HOST: '127.0.0.1' },
    });
    child.unref();
    ```
  - **State file:** `~/.aweave/server.json` (replaces plain PID file):
    ```json
    { "pid": 12345, "port": 3456, "startedAt": "2026-02-11T...", "version": "0.1.0" }
    ```
  - Log file: `~/.aweave/logs/server.log`
  - **Lifecycle contract:**
    - `start`: check port in use first (`EADDRINUSE` detection) → refuse if port occupied; check health endpoint → refuse if already healthy (idempotent); detect stale PID file (process not running) → clean up and proceed
    - `stop`: send SIGTERM → wait up to 5s → SIGKILL if needed → verify process gone → then clear state file
    - `status`: check PID alive + health endpoint (both must pass) → report accurate state
    - `restart`: stop (full cleanup) → start
  - **Outcome**: Server start as background daemon, survives CLI exit, handles all failure modes

- [x] **3.3** Implement health check
  - Sau khi spawn, poll `http://127.0.0.1:3456/health` (đã có sẵn endpoint)
  - Timeout: 10s max, retry mỗi 500ms
  - Report success/failure cho user
  - **Outcome**: `aw server start` block cho đến khi server healthy

- [x] **3.4** Tạo oclif plugin `@hod/aweave-plugin-server`
  - Commands:
    - `aw server start` — start server daemon, show port + PID
    - `aw server stop` — stop server daemon
    - `aw server status` — show running/stopped, PID, port, uptime
    - `aw server restart` — stop + start
    - `aw server logs` — tail log file (hoặc show last N lines)
  - **Outcome**: Full server lifecycle management từ CLI

  ```
  devtools/common/cli-plugin-server/
  ├── package.json                # @hod/aweave-plugin-server
  ├── tsconfig.json
  └── src/
      └── commands/
          └── server/
              ├── start.ts        # aw server start
              ├── stop.ts         # aw server stop
              ├── status.ts       # aw server status
              ├── restart.ts      # aw server restart
              └── logs.ts         # aw server logs
  ```

- [x] **3.5** Register plugin trong CLI
  - Add `@hod/aweave-plugin-server` to `@hod/aweave` `package.json` dependencies
  - Add to `oclif.plugins` array
  - Add to `devtools/pnpm-workspace.yaml`
  - **Outcome**: `aw server start` available

- [ ] **3.6** Auto-start server từ commands khác (deferred — existing ensureServices() pattern covers this)
  - Khi `aw debate create ...` gọi API mà server chưa chạy → tự động start
  - Check: try API call → nếu `ECONNREFUSED` → prompt user hoặc auto-start
  - Implement trong `@hod/aweave-cli-shared` HTTP client wrapper
  - **Outcome**: UX mượt — user không cần nhớ start server trước

- [x] **3.7** Cập nhật `debate-web` URL config cho auto-open
  - `aw server start --open` → auto-open browser tại `http://localhost:3456/debate`
  - Sử dụng `open` npm package hoặc `child_process.exec('open <url>')`
  - **Outcome**: One command to start + view

- [x] **3.8** Cleanup PM2 artifacts
  - Remove `devtools/ecosystem.config.cjs`
  - Remove PM2 scripts từ `devtools/package.json` (`start`, `stop`, `logs`)
  - Cập nhật documentation
  - **Outcome**: Không còn reference nào tới PM2

**Files thay đổi:**

```
devtools/
├── common/
│   ├── cli-plugin-server/          # 🚧 NEW package
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/commands/server/
│   │       ├── start.ts
│   │       ├── stop.ts
│   │       ├── status.ts
│   │       ├── restart.ts
│   │       └── logs.ts
│   ├── cli-shared/
│   │   └── src/
│   │       └── process-manager.ts  # 🚧 NEW — daemon management utils
│   └── cli/
│       └── package.json            # 🔄 ADD cli-plugin-server dependency
├── pnpm-workspace.yaml             # 🔄 ADD common/cli-plugin-server
├── ecosystem.config.cjs            # ❌ DELETE
└── package.json                    # 🔄 REMOVE pm2 scripts
```

---

### Phase 4: Single NPM Package Publish Pipeline

**Mục tiêu:** Build pipeline flatten monorepo thành 1 publishable npm package.

- [x] **4.1** Fix package naming
  - `devtools/common/server/package.json`: đổi `"name": "server"` → `"name": "@hod/aweave-server"`
  - `devtools/common/debate-web/package.json`: đổi `"name": "debate-web"` → `"name": "@hod/aweave-debate-web"`
  - **Outcome**: Tất cả packages có scoped names, `pnpm deploy` resolve đúng

- [x] **4.2** Cập nhật `@hod/aweave` dependencies
  - Add `@hod/aweave-server` as dependency: `"@hod/aweave-server": "workspace:*"`
  - Add `@hod/aweave-debate-web` as dependency: `"@hod/aweave-debate-web": "workspace:*"`
  - Giữ `"private": true` trong cli `package.json` cho dev, toggle sang `false` lúc publish
  - **Outcome**: CLI package depends on tất cả packages cần publish

- [x] **4.3** Tạo build script: `devtools/scripts/build-release.sh`
  - **Location:** `devtools/scripts/build-release.sh` — chạy từ `devtools/` working directory
  - **Build tool:** Dùng `pnpm turbo build` (align với existing turbo config) thay vì `pnpm -r build`
  - Step 1: `pnpm turbo build` (build tất cả packages, leverage turbo caching)
  - Step 2: Copy debate-web `dist/` → server `public/debate/`
  - Step 3: `pnpm --filter @hod/aweave deploy ./release` (flatten workspace deps, rewrites `workspace:*` → actual versions)
  - Step 4: Update `release/package.json`: set `"private": false`
  - Step 5: **Validation** — verify publishability:
    - Check no `workspace:*` entries remain in `release/package.json`
    - Run `npm pack --dry-run` in `release/` to verify tarball creation
    - Print resolved server entry path for verification
  - **Outcome**: `./release/` là self-contained, validated npm package

  ```bash
  #!/bin/bash
  set -euo pipefail

  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"  # devtools/
  RELEASE_DIR="$ROOT_DIR/release"

  echo "=== Building all packages (turbo) ==="
  cd "$ROOT_DIR"
  pnpm turbo build

  echo "=== Copying debate-web static assets to server ==="
  rm -rf common/server/public/debate
  mkdir -p common/server/public/debate
  cp -r common/debate-web/dist/* common/server/public/debate/

  echo "=== Deploying CLI package (pnpm deploy) ==="
  rm -rf "$RELEASE_DIR"
  pnpm --filter @hod/aweave deploy "$RELEASE_DIR"

  echo "=== Post-processing ==="
  cd "$RELEASE_DIR"
  node -e "
    const pkg = require('./package.json');
    pkg.private = false;
    require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  "

  echo "=== Validation ==="
  # Check no workspace:* protocol remains
  if grep -q '"workspace:' package.json; then
    echo "ERROR: package.json still contains workspace: protocol entries!"
    exit 1
  fi

  # Verify npm pack works
  npm pack --dry-run

  # Print server entry path for verification
  echo ""
  echo "Server entry: $(node -e "console.log(require.resolve('@hod/aweave-server/dist/main.js'))")"

  echo ""
  echo "=== Release package ready at $RELEASE_DIR ==="
  echo "To publish: cd $RELEASE_DIR && npm publish"
  ```

- [x] **4.4** Cập nhật `@hod/aweave` `files` field
  - Ensure `"files"` bao gồm: `["bin", "dist", "oclif.manifest.json"]`
  - Server và frontend assets đi qua `node_modules/@hod/aweave-server/public/` (resolved by pnpm deploy)
  - **Outcome**: npm package chứa đúng files cần thiết

- [x] **4.5** Cập nhật server entry path resolution
  - CLI plugin `aw server start` cần biết path tới `@hod/aweave-server/dist/main.js`
  - Resolve bằng `require.resolve('@hod/aweave-server/dist/main.js')` — works cả dev và published
  - **Outcome**: CLI tìm đúng server entrypoint trong mọi context

- [x] **4.6** Tạo npm scripts trong `devtools/package.json`
  - `"release:build": "bash scripts/build-release.sh"` — build release (runs from `devtools/`)
  - `"release:publish": "cd release && npm publish"` — publish to npm
  - `"release:dry-run": "cd release && npm publish --dry-run"` — test publish
  - **Outcome**: Publish workflow standardized, aligns with existing turbo-based build

- [ ] **4.7** Test end-to-end: `npm install -g` flow (manual verification needed)
  - Build release package
  - `npm install -g ./release` (local test)
  - `aw server start` → server starts
  - `aw debate create --topic "test"` → works
  - Browser: `http://localhost:3456/debate` → SPA loads
  - `aw server status` → shows running
  - `aw server stop` → stops
  - **Outcome**: Full flow works from installed package

- [ ] **4.8** Test end-to-end: `npx` flow (manual verification needed)
  - `npm pack` trong `./release` → tạo tarball
  - `npx ./aweave-cli-0.1.0.tgz server start` → works
  - **Outcome**: npx flow verified

- [ ] **4.9** Cập nhật CI/CD (nếu có) (deferred — no CI/CD configured yet)
  - Add publish workflow
  - Version bumping strategy
  - **Outcome**: Automated publish pipeline

**Published package structure:**

```
@hod/aweave (npm)
├── bin/
│   └── run.js                              # CLI entrypoint
├── dist/
│   └── commands/                           # Built-in commands
├── oclif.manifest.json                     # oclif command manifest
├── node_modules/
│   ├── @hod/aweave-cli-shared/dist/            # Shared utilities
│   ├── @hod/aweave-plugin-debate/dist/     # debate commands
│   ├── @hod/aweave-plugin-server/dist/     # server commands
│   ├── @hod/aweave-plugin-docs/dist/       # docs commands
│   ├── @hod/aweave-plugin-*/dist/          # other plugins
│   ├── @hod/aweave-server/
│   │   ├── dist/main.js                    # NestJS server entrypoint
│   │   └── public/
│   │       └── debate/                     # debate SPA static files
│   │           ├── index.html
│   │           └── assets/
│   ├── @hod/aweave-nestjs-debate/dist/         # debate backend module
│   ├── @oclif/core/                        # oclif runtime
│   ├── @nestjs/*/                          # NestJS runtime
│   └── ...                                 # other dependencies
└── package.json
```

---

### Phase 5: Documentation & Cleanup

- [x] **5.1** Cập nhật `devdocs/misc/devtools/OVERVIEW.md`
  - Thay thế PM2 section bằng CLI process management
  - Thêm publish workflow
  - Cập nhật architecture diagram (1 process, 1 port)
  - **Outcome**: Overview phản ánh architecture mới

- [x] **5.2** Cập nhật `devdocs/misc/devtools/common/server/OVERVIEW.md`
  - Thêm `@nestjs/serve-static` config
  - Thêm static file serving documentation
  - Remove PM2 references
  - **Outcome**: Server docs accurate

- [x] **5.3** Cập nhật `devdocs/misc/devtools/common/debate-web/OVERVIEW.md`
  - Document Rsbuild + React stack
  - Cập nhật tech stack table
  - Cập nhật project structure
  - Cập nhật dev workflow
  - **Outcome**: debate-web docs accurate

- [x] **5.4** Tạo OVERVIEW cho `cli-plugin-server`
  - `devdocs/misc/devtools/common/cli-plugin-server/OVERVIEW.md`
  - Document commands, process management, PID/log locations
  - **Outcome**: Plugin documented

- [x] **5.5** Cập nhật `devtools/README.md`
  - Quick start cho end users: `npm install -g @hod/aweave && aw server start`
  - Dev setup cho contributors
  - **Outcome**: README serves both audiences

## Execution Order & Dependencies

```
Phase 1 (debate-web → Rsbuild)
    │
    ▼
Phase 2 (NestJS serve static) ← depends on Phase 1 output
    │
    ▼
Phase 3 (CLI process management) ← independent of Phase 1/2 but test needs Phase 2
    │
    ▼
Phase 4 (Publish pipeline) ← depends on Phase 1, 2, 3
    │
    ▼
Phase 5 (Documentation) ← after all phases
```

**Có thể parallelize:** Phase 3 (CLI process management) có thể bắt đầu song song với Phase 1 vì nó không depend vào Rsbuild migration. Chỉ cần Phase 2 hoàn thành trước khi test integration.

## Estimated Effort

| Phase | Effort | Description |
|-------|--------|-------------|
| Phase 1 | Medium-High | Rsbuild + React SPA setup, routing, testing |
| Phase 2 | Low | `@nestjs/serve-static` config, CORS update |
| Phase 3 | Medium | New CLI plugin, daemon management, health check |
| Phase 4 | Medium | Build pipeline, pnpm deploy, path resolution |
| Phase 5 | Low | Documentation updates |

## 📊 Summary of Results

### ✅ Completed — All Phases Implemented & Published to npm

**Published packages (npm registry, `@hod/` scope):**

| Package | Version | Description |
|---------|---------|-------------|
| `@hod/aweave` | 0.1.6 | CLI entrypoint (`aw` binary) |
| `@hod/aweave-cli-shared` | 0.1.0 | Shared utilities, process manager |
| `@hod/aweave-plugin-debate` | 0.1.0 | `aw debate *` commands |
| `@hod/aweave-plugin-docs` | 0.1.0 | `aw docs *` commands |
| `@hod/aweave-plugin-dashboard` | 0.1.0 | `aw dashboard` (Ink terminal UI) |
| `@hod/aweave-plugin-server` | 0.1.4 | `aw server *` (start/stop/status/restart/logs) |
| `@hod/aweave-plugin-config` | 0.1.0 | `aw config *` commands |
| `@hod/aweave-plugin-relay` | 0.1.0 | `aw relay *` commands |
| `@hod/aweave-plugin-demo-workflow` | 0.1.2 | `aw demo` command |
| `@hod/aweave-server` | 0.0.6 | NestJS server (API + WS + static SPA) |
| `@hod/aweave-debate-web` | 0.1.1 | React SPA (Rsbuild, static HTML/JS/CSS) |
| `@hod/aweave-nestjs-debate` | 0.1.0 | Debate backend module |
| `@hod/aweave-debate-machine` | 0.1.0 | Debate state machine |
| `@hod/aweave-workflow-engine` | 0.1.0 | Workflow state machine |
| `@hod/aweave-workflow-dashboard` | 0.1.2 | Ink workflow UI |
| `@hod/aweave-config-core` | 0.1.0 | Config file loader |
| `@hod/aweave-config-common` | 0.1.0 | Shared config defaults |
| `@hod/aweave-playwright` | 0.1.0 | Playwright test utilities |

**Verified working:**
```bash
npx @hod/aweave server start --open   # Installs from npm, starts server, opens browser
npx @hod/aweave server status         # Shows PID, port, uptime
npx @hod/aweave --help                # All topics: debate, server, docs, config, relay, dashboard
```

## Implementation Notes / As Implemented

### Phase 1: debate-web → Rsbuild + React SPA ✅

- Migrated from Next.js 16 to Rsbuild + React 19 + react-router v7
- **Fonts:** `@fontsource/geist-sans` + `@fontsource/geist-mono` (not `@fontsource-variable/*` — doesn't exist on npm)
- **PostCSS:** Kept `postcss.config.cjs` (Rsbuild auto-discovers it, inline `require()` fails in ESM)
- **Theme:** Custom `useTheme` hook replacing `next-themes`. `ThemeProvider` via React context
- **Config:** `src/lib/config.ts` uses `window.location.origin` directly (no `process.env` — causes ReferenceError in browser)
- **Router:** `BrowserRouter` with `basename="/debate"` — SPA served under `/debate/` path
- **Asset prefix:** `output.assetPrefix: '/debate/'` in `rsbuild.config.ts`
- Build output: ~960 KB total, ~540 KB gzipped

### Phase 2: NestJS Single Port ✅

- **NOT using `@nestjs/serve-static`** — it had issues with route priority (controller caught static file requests). Used `app.useStaticAssets()` (Express static middleware) in `main.ts` instead
- **Static files:** `app.useStaticAssets(debateWebRoot, { prefix: '/debate' })` — registered before routes
- **SPA fallback:** `DebateSpaController` checks `extname(req.path)` — only serves `index.html` for routes WITHOUT file extensions
- **Path resolution:** `require.resolve('@hod/aweave-debate-web/package.json')` → works both in dev (workspace) and published (node_modules)
- **Root redirect:** `RootRedirectController` → `res.redirect('/debate')`
- **CORS:** Disabled in production (same-origin), enabled in dev

### Phase 3: CLI Process Management ✅

- Process manager in `@hod/aweave-cli-shared/src/services/process-manager.ts`
- `@hod/aweave-plugin-server` with 5 commands: start, stop, status, restart, logs
- Daemon: `child_process.spawn` with `detached: true`, stdout/stderr → `~/.aweave/logs/server.log`
- State file: `~/.aweave/server.json` (PID, port, startedAt, version)
- Health check: polls `http://127.0.0.1:3456/health` after spawn (10s timeout, 500ms interval)
- PM2 removed: `ecosystem.config.cjs` deleted, pm2 scripts removed from root `package.json`

### Phase 4: Publish Pipeline ✅ (Changed Approach)

**Original plan: single bundled npm package.** This failed because:
1. **pnpm** uses `.pnpm/` virtual store + symlinks → `bundleDependencies` can't follow them
2. **Yarn 3** (`nodeLinker: node-modules`) also uses symlinks for workspace packages
3. **`node-linker=hoisted`** breaks NestJS CLI binary resolution
4. **Flatten script** caused version conflicts (e.g. `minimatch` v5 vs v9)

**Final approach: publish all packages separately.** `pnpm -r publish` handles:
- Dependency order (publishes deps before dependents)
- Rewriting `workspace:*` → actual versions
- Rewriting `catalog:` → actual versions

This is the standard approach for oclif-based CLIs (Salesforce CLI, Heroku CLI).

**npm org `@aweave`** created on npmjs.com. All packages published with `--access public`.

### Phase 5: Documentation ✅

- All OVERVIEW docs updated (devtools, server, debate-web, cli-plugin-server)
- README.md rewritten with user guide + contributor guide + publish workflow

### Additional Fixes

- **`@xstate/react`:** Updated from v4 → v6 (v4 didn't support React 19 peer dep)
- **Runtime config:** Removed `process.env.PUBLIC_*` from debate-web config.ts (causes `ReferenceError: process is not defined` in browser). Uses `window.location.origin` directly
- **`.npmrc`:** Removed `optional=true` (pnpm-specific, caused npm warnings for end users)

## 🚧 Outstanding Issues & Follow-up

### ⚠️ Remaining

- [ ] **Versioning strategy** — Currently manual (`npm version patch`). Consider `@changesets/cli` for automated version management and changelogs.
- [ ] **CI/CD** — No automated publish pipeline. Could add GitHub Actions for: build → test → publish on tag.
- [ ] **Future SPAs** — Pattern documented: Rsbuild SPA → add to server's `main.ts` `useStaticAssets()` → publish.
- [ ] **`better-sqlite3` prebuilt binaries** — Native compilation works but slow. Consider `@aspect-build/better-sqlite3` for prebuilt binaries.
- [ ] **Single-package approach** — If desired in future, the `file:` tarball approach (pack workspace packages → use as `file:./tarballs/*.tgz` deps → npm creates flat node_modules → bundleDependencies works) is the most viable path. See conversation notes for details.
