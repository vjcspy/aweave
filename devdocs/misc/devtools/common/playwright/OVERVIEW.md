# Shared Playwright (`@aweave/playwright`)

> **Source:** `devtools/common/playwright/`
> **Last Updated:** 2026-02-10

Shared browser automation library cho toàn bộ DevTools monorepo. Package này wrap `playwright-core` và cung cấp helper functions với sensible defaults. Các package khác depend vào `@aweave/playwright` thay vì `playwright-core` trực tiếp.

## Purpose

- **Single source of truth** — Centralize `playwright-core` dependency, tránh duplicate version declarations across packages.
- **Re-export API gốc** — Consumer vẫn truy cập đầy đủ Playwright API (`chromium`, `firefox`, `webkit`, `devices`, types) mà không bị giới hạn.
- **Browser launch helpers** — `launchBrowser()` cung cấp sensible defaults cho common use cases: system browser channel, disable CORS, headless mode.
- **Persistent browser sessions** — `launchPersistentBrowser()` lưu cookies, localStorage, SSO sessions vào disk — cho phép reuse SSO session giữa các lần CLI invocation.
- **Consistent config** — Tất cả packages dùng cùng Chrome args, context options, launch pattern.

**Tại sao shared package thay vì hoist lên root?** Để giữ explicit dependency graph. Mỗi consumer khai báo `"@aweave/playwright": "workspace:*"` — rõ ràng hơn implicit hoisting. Nhất quán với pattern `@aweave/cli-shared`.

```
@aweave/playwright (wraps playwright-core)
     ↑
     |
@aweave/cli-plugin-auth
(and any future package needing browser automation)
```

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   @aweave/playwright                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  index.ts (barrel export)                                │
│  ├── Re-exports: chromium, firefox, webkit, devices      │
│  ├── Re-exports types: Browser, BrowserContext,          │
│  │   BrowserType, Page, LaunchOptions                    │
│  ├── Exports: launchBrowser(), LaunchBrowserOptions      │
│  └── Exports: launchPersistentBrowser(),                 │
│      LaunchPersistentBrowserOptions, PersistentSession   │
│                                                          │
│  browser.ts (launch helpers)                             │
│  ├── LaunchBrowserOptions                                │
│  │   { channel, headless, disableCors, args }            │
│  ├── BrowserSession                                      │
│  │   { browser, context, page, close() }                 │
│  ├── launchBrowser(options?) → Promise<BrowserSession>   │
│  │                                                       │
│  ├── LaunchPersistentBrowserOptions                      │
│  │   { userDataDir, channel, headless, disableCors, args }│
│  ├── PersistentBrowserSession                            │
│  │   { context, page, close() }                          │
│  └── launchPersistentBrowser(opts)                       │
│      → Promise<PersistentBrowserSession>                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
         │
         ▼
   playwright-core
```

## Dependencies

| Package | Role |
|---------|------|
| `playwright-core` | Playwright API without bundled browsers — uses system-installed Chrome/Edge via `channel` |

**devDependencies:** `@types/node`, `typescript`

**Key design:** Dùng `playwright-core` (không phải `playwright`) vì CLI tools launch system browser qua `channel: 'chrome'` hoặc `channel: 'msedge'`. Không cần download thêm ~500MB browser binaries.

## Exposed Exports

```typescript
// Re-exported Playwright API (from playwright-core)
export { chromium, firefox, webkit, devices } from 'playwright-core';
export type { Browser, BrowserContext, BrowserType, Page, LaunchOptions } from 'playwright-core';

// Helper functions
export {
  launchBrowser,
  launchPersistentBrowser,
  type LaunchBrowserOptions,
  type LaunchPersistentBrowserOptions,
  type PersistentBrowserSession,
} from './browser';
```

### `launchBrowser(options?)`

Launch Chromium-based browser với sensible defaults. Trả về `BrowserSession` gồm browser, context, page, và `close()` helper.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `channel` | `'chrome' \| 'msedge'` | `undefined` | System browser channel |
| `headless` | `boolean` | `false` | Headless mode |
| `disableCors` | `boolean` | `false` | Disable CORS (adds `--disable-web-security` + related flags, sets `bypassCSP: true`) |
| `args` | `string[]` | `[]` | Extra Chromium args |

**`disableCors: true` behavior:**

```typescript
// Chromium args added:
'--disable-web-security'
'--disable-features=IsolateOrigins'
'--disable-site-isolation-trials'

// Context option:
bypassCSP: true
```

**Usage:**

```typescript
// Option A: Use playwright-core API directly (re-exported)
import { chromium } from '@aweave/playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: false });

// Option B: Use helper with sensible defaults
import { launchBrowser } from '@aweave/playwright';
const session = await launchBrowser({ channel: 'msedge', disableCors: true });
await session.page.goto('https://example.com');
await session.close();
```

### `launchPersistentBrowser(options)`

Launch Chromium-based browser với **persistent user data directory**. Cookies, localStorage, SSO sessions được lưu vào disk và reuse giữa các lần launch — cho phép SSO auto-login.

Khác với `launchBrowser()`, function này dùng `chromium.launchPersistentContext()` — không có `Browser` object riêng, chỉ trả về `PersistentBrowserSession { context, page, close() }`.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `userDataDir` | `string` | (required) | Path to persistent browser profile directory |
| `channel` | `'chrome' \| 'msedge'` | `undefined` | System browser channel |
| `headless` | `boolean` | `false` | Headless mode |
| `disableCors` | `boolean` | `false` | Disable CORS |
| `args` | `string[]` | `[]` | Extra Chromium args |

**Usage:**

```typescript
import { launchPersistentBrowser } from '@aweave/playwright';

const session = await launchPersistentBrowser({
  userDataDir: '/home/user/.aweave/browser-data',
  channel: 'msedge',
});

// First launch: full SSO login required
// Subsequent launches: SSO session reused — auto-login or 1-click
await session.page.goto('https://example.com');
await session.close();
```

## Project Structure

```
devtools/common/playwright/
├── package.json                    # @aweave/playwright
├── tsconfig.json                   # commonjs, ES2023, strict, declaration
├── eslint.config.mjs
└── src/
    ├── index.ts                    # Barrel exports (re-export playwright-core + helpers)
    └── browser.ts                  # launchBrowser(), LaunchBrowserOptions, BrowserSession
```

## Development

```bash
cd devtools/common/playwright

# Build
pnpm build

# Dev mode
pnpm dev   # tsc --watch
```

## Related

- **Implementation Plan:** `devdocs/misc/devtools/common/plans/260209-shared-playwright-package.md`
- **CLI Shared (same pattern):** `devtools/common/cli-shared/`
- **CLI Shared Overview:** `devdocs/misc/devtools/common/cli-shared/OVERVIEW.md`
- **Global DevTools Overview:** `devdocs/misc/devtools/OVERVIEW.md`
