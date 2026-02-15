# 📋 [PLAYWRIGHT-SHARED: 2026-02-09] - Extract Playwright to Shared Package

## References

- DevTools monorepo: `devdocs/misc/devtools/OVERVIEW.md`
- CLI shared library pattern: `devtools/common/cli-shared/`
- Current playwright consumer: `devtools/nab/plugin-nab-auth/src/lib/browser-auth.ts`
- pnpm workspace config: `devtools/pnpm-workspace.yaml`

## Background & Decision Context

### Vấn đề

Hiện `playwright-core` được khai báo trực tiếp trong từng package (`cli-plugin-auth`). Gần như tất cả CLI tool trong monorepo đều cần browser automation (SSO login, scraping, testing). Nếu mỗi package tự khai báo `playwright-core`:

1. **Duplicate dependency** — Mỗi package lặp lại `"playwright-core": "^1.50.0"` trong `package.json`
2. **Duplicate code** — Mỗi nơi tự viết logic launch browser, Chrome args, context setup
3. **Inconsistent config** — Mỗi package có thể dùng args/options khác nhau
4. **Upgrade pain** — Upgrade playwright phải sửa N package

### Giải pháp

Tạo shared package `@hod/aweave-playwright` tại `devtools/common/playwright/`. Package này:

- Wrap `playwright-core` và re-export API gốc (chromium, firefox, webkit, types)
- Cung cấp helper functions với sensible defaults (launch browser, disable CORS, persistent context)
- Các package khác depend vào `@hod/aweave-playwright` thay vì `playwright-core` trực tiếp

### Tại sao shared package thay vì hoist lên root?

| Approach | Pros | Cons |
|----------|------|------|
| **Hoist lên root** | Đơn giản, nhanh | Implicit dependency, duplicate launch code, pnpm cần `public-hoist-pattern` |
| **Shared package** ✅ | Explicit dependency, single source of truth cho launch logic, đúng pattern monorepo | Thêm 1 package (overhead nhỏ) |

Chọn shared package vì nhất quán với pattern `@hod/aweave-cli-shared` đã có, và tập trung logic browser launch vào 1 chỗ.

## Scope

### Phạm vi ảnh hưởng

Tất cả playwright usage hiện tại nằm trong **1 package**: `devtools/nab/plugin-nab-auth/`.

Tuy nhiên package mới được thiết kế cho **mọi package** trong monorepo cần browser automation.

## 🎯 Objective

1. Tạo `@hod/aweave-playwright` — shared package wrap `playwright-core` với helper functions
2. Chuyển tất cả package đang depend `playwright-core` trực tiếp sang dùng `@hod/aweave-playwright`

### ⚠️ Key Considerations

- **Re-export API gốc** — Consumer vẫn có thể `import { chromium } from '@hod/aweave-playwright'` mà không bị giới hạn. Shared package không hide API, chỉ bổ sung helpers.
- **No breaking change** — `browser-auth.ts` chỉ đổi import path, logic không thay đổi.
- **Không cần `.npmrc` thay đổi** — Dùng `workspace:*` dependency, pnpm resolve bình thường.

## 🔄 Implementation Plan

### Phase 1: Create `@hod/aweave-playwright` Package

#### 1.1 — Tạo package structure

- [ ] Tạo folder `devtools/common/playwright/`
- [ ] Follow conventions từ `devtools/common/cli-shared/`

**File structure:**

```
devtools/common/playwright/            # 🚧 TODO - Shared playwright package
├── src/
│   ├── index.ts                       # 🚧 TODO - Barrel export
│   └── browser.ts                     # 🚧 TODO - Browser launch helpers
├── package.json                       # 🚧 TODO
├── tsconfig.json                      # 🚧 TODO
└── eslint.config.mjs                  # 🚧 TODO
```

#### 1.2 — `package.json`

- [ ] Tạo `devtools/common/playwright/package.json`

```json
{
  "name": "@hod/aweave-playwright",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "playwright-core": "^1.50.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "typescript": "^5.7.3"
  }
}
```

#### 1.3 — `tsconfig.json`

- [ ] Copy từ `devtools/common/cli-shared/tsconfig.json` (cùng config: commonjs, ES2023, strict, declaration)

#### 1.4 — `eslint.config.mjs`

- [ ] Copy từ `devtools/common/cli-shared/eslint.config.mjs`

```js
import { baseConfig } from '../../eslint.config.mjs';
export default [{ ignores: ['dist/**'] }, ...baseConfig];
```

#### 1.5 — `src/index.ts` (barrel export)

- [ ] Re-export playwright-core API gốc (chromium, firefox, webkit, devices, types)
- [ ] Export helper functions từ `./browser`

```typescript
// Re-export playwright-core API
export { chromium, firefox, webkit, devices } from 'playwright-core';
export type {
  Browser, BrowserContext, BrowserType, Page, LaunchOptions,
} from 'playwright-core';

// Helpers
export { launchBrowser, type LaunchBrowserOptions } from './browser';
```

#### 1.6 — `src/browser.ts` (launch helpers)

- [ ] Implement `launchBrowser()` function

**Interface:**

```typescript
interface LaunchBrowserOptions {
  channel?: 'chrome' | 'msedge';  // System browser channel
  headless?: boolean;              // Default: false
  disableCors?: boolean;           // Default: false — adds --disable-web-security + related flags
  args?: string[];                 // Extra Chromium args
}

interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

function launchBrowser(options?: LaunchBrowserOptions): Promise<BrowserSession>;
```

**Behavior khi `disableCors: true`:**

```typescript
args.push(
  '--disable-web-security',
  '--disable-features=IsolateOrigins',
  '--disable-site-isolation-trials',
);
// + context: bypassCSP: true
```

#### 1.7 — Register trong workspace

- [ ] Thêm `common/playwright` vào `devtools/pnpm-workspace.yaml`

```yaml
packages:
  - nab/plugin-nab-auth
  - nab/plugin-nab-confluence
  - nab/plugin-nab-opensearch
  - common/server
  - common/nestjs-debate
  - common/debate-machine
  - common/debate-web
  - common/cli-shared
  - common/playwright              # ← NEW
  - common/cli
  - common/cli-plugin-debate
  - common/cli-plugin-docs
  - common/cli-plugin-dashboard
  - common/cli-plugin-relay
```

#### 1.8 — Build & verify

- [ ] `cd devtools && pnpm install`
- [ ] `cd devtools/common/playwright && pnpm build`
- [ ] Verify `dist/` output có `index.js`, `index.d.ts`, `browser.js`, `browser.d.ts`

---

### Phase 2: Migrate Existing Consumers

#### 2.1 — Scan tất cả package đang depend `playwright-core`

Kết quả scan hiện tại (2026-02-09):

| # | Package | File | Usage |
|---|---------|------|-------|
| 1 | `devtools/nab/plugin-nab-auth` | `package.json` | `"playwright-core": "^1.50.0"` |
| 1 | `devtools/nab/plugin-nab-auth` | `src/lib/browser-auth.ts` | `import { chromium } from 'playwright-core'` |

> Chỉ có **1 package** dùng playwright hiện tại.

#### 2.2 — Migrate `cli-plugin-auth`

- [ ] **`devtools/nab/plugin-nab-auth/package.json`** — Thay dependency

```diff
  "dependencies": {
    "@hod/aweave-cli-shared": "workspace:*",
+   "@hod/aweave-playwright": "workspace:*",
    "@oclif/core": "^4.2.8",
-   "playwright-core": "^1.50.0"
  },
```

- [ ] **`devtools/nab/plugin-nab-auth/src/lib/browser-auth.ts`** — Đổi import

```diff
- import { chromium } from 'playwright-core';
+ import { chromium } from '@hod/aweave-playwright';
```

> Logic trong `browser-auth.ts` không thay đổi — chỉ đổi import source.

#### 2.3 — Rebuild & verify

- [ ] `cd devtools && pnpm install`
- [ ] `pnpm --filter @hod/aweave-playwright build`
- [ ] `pnpm --filter @hod/aweave-plugin-nab-auth build`
- [ ] Verify build thành công, không lỗi TypeScript

---

## Dependency Graph (sau migration)

```
@hod/aweave
  ├── @hod/aweave-cli-shared
  ├── @hod/aweave-plugin-nab-auth ──► @hod/aweave-cli-shared
  │                            ──► @hod/aweave-playwright ──► playwright-core
  ├── @hod/aweave-plugin-debate ──► @hod/aweave-cli-shared
  ├── @hod/aweave-plugin-docs ──► @hod/aweave-cli-shared
  └── ...

@hod/aweave-playwright              # NEW — shared browser automation
  └── playwright-core
```

## Usage Guide (sau khi hoàn thành)

Bất kỳ package nào cần browser automation:

**1. Thêm dependency:**

```json
"dependencies": {
  "@hod/aweave-playwright": "workspace:*"
}
```

**2. Import & sử dụng:**

```typescript
// Option A: Dùng playwright-core API trực tiếp (re-exported)
import { chromium } from '@hod/aweave-playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: false });

// Option B: Dùng helper có sẵn
import { launchBrowser } from '@hod/aweave-playwright';
const session = await launchBrowser({ channel: 'msedge', disableCors: true });
await session.page.goto('https://example.com');
await session.close();
```

## 📊 Summary of Results

> Do not summarize the results until the implementation is done and I request it

### ✅ Completed Achievements

- [ ] Pending implementation

## 🚧 Outstanding Issues & Follow-up

### Future Enhancements (không nằm trong scope plan này)

- [ ] Thêm `launchPersistentContext()` helper — giữ session/cookies giữa các lần chạy
- [ ] Thêm cookie extraction helpers — tái sử dụng pattern từ `browser-auth.ts`
- [ ] Cập nhật `devdocs/misc/devtools/OVERVIEW.md` — thêm `@hod/aweave-playwright` vào dependency graph documentation
