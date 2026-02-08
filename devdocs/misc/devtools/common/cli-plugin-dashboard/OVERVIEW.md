# Dashboard CLI Plugin (`@aweave/cli-plugin-dashboard`)

> **Source:** `devtools/common/cli-plugin-dashboard/`
> **Last Updated:** 2026-02-07

oclif plugin sử dụng **Ink v6** (ESM-only, React 19) để render interactive terminal dashboard. Plugin này là **ESM package** — khác với các CJS plugin khác trong ecosystem. Đây là reference implementation cho việc tích hợp Ink vào oclif plugin, vừa là công cụ monitoring thực tế.

## Purpose

- **Real-time monitoring**: pm2 processes, health checks, system resources, workspace status
- **Interactive TUI**: Tab navigation, keyboard shortcuts, live data refresh
- **Ink v6 reference**: Showcase integration oclif + Ink v6 + React 19 trong ESM plugin
- **Dual output**: Interactive Ink UI (default) hoặc `--format json` cho CI/scripting

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                @aweave/cli-plugin-dashboard                      │
│                   (ESM oclif plugin)                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  commands/dashboard/                                         │
│  ├── index.ts        ← aw dashboard (full interactive)       │
│  ├── services.ts     ← aw dashboard services                 │
│  ├── system.ts       ← aw dashboard system                   │
│  ├── workspace.ts    ← aw dashboard workspace                │
│  └── logs.ts         ← aw dashboard logs                     │
│                                                              │
├──────────── Ink v6 Rendering Layer ──────────────────────────┤
│                                                              │
│  components/                                                 │
│  ├── Dashboard.tsx   ← Root: Header + TabBar + active panel  │
│  ├── Header.tsx      ← Title + live clock + version          │
│  ├── TabBar.tsx      ← [1] Services [2] System [3] ...      │
│  ├── panels/                                                 │
│  │   ├── ServicesPanel.tsx   ← pm2 table + health table      │
│  │   ├── SystemPanel.tsx     ← CPU/mem/disk bars + sparkline │
│  │   ├── WorkspacePanel.tsx  ← package list + build status   │
│  │   └── LogsPanel.tsx       ← live log stream (Static)     │
│  └── shared/                                                 │
│      ├── Table.tsx        ← Box grid layout table            │
│      ├── ProgressBar.tsx  ← ████░░░░ 65%                     │
│      ├── Spinner.tsx      ← ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ animation           │
│      ├── StatusBadge.tsx  ← ● online / ✗ offline             │
│      └── Sparkline.tsx    ← ▁▂▃▅▇ mini chart                │
│                                                              │
├──────────── Data Layer (100% async) ─────────────────────────┤
│                                                              │
│  hooks/                          lib/                        │
│  ├── useInterval.ts              ├── pm2.ts (execFile/spawn) │
│  ├── useServices.ts              ├── system.ts (os + execFile)│
│  ├── useSystemInfo.ts            └── health.ts (createRequire│
│  ├── useWorkspace.ts                  → cli-shared)          │
│  └── useLogs.ts                                              │
│                                                              │
├──────────── Data Sources ────────────────────────────────────┤
│                                                              │
│  pm2 jlist (execFile)     os.cpus()/totalmem()               │
│  pm2 logs --raw (spawn)   df -h / (execFile)                 │
│  checkHealth (cli-shared) pnpm --version (execFile)          │
│  pnpm-workspace.yaml (fs) process.version (direct)           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Dependencies

| Package | Role |
|---------|------|
| `@oclif/core` | oclif Command class, Flags |
| `ink` (^6.6.0) | Terminal UI rendering framework (ESM-only) |
| `react` (^19.0.0) | Component model for Ink |
| `@aweave/cli-shared` | `checkHealth()` reuse (imported via `createRequire`) |

**No community Ink packages.** `ink-spinner`, `ink-table`, `ink-big-text` đều có `peerDependencies: ink ^4 hoặc ^5` — conflict với Ink v6/React 19. Tất cả UI components tự build từ Ink primitives (`Box`, `Text`, `Spacer`, `Static`, `Transform`).

## Commands

| Command | Description | Flags |
|---------|-------------|-------|
| `aw dashboard` | Full interactive dashboard with tab navigation | `--refresh-interval`, `--tab` |
| `aw dashboard services` | PM2 processes + health checks | `--watch`, `--format json` |
| `aw dashboard system` | CPU, memory, disk, versions | `--watch`, `--format json` |
| `aw dashboard workspace` | Workspace packages + build status | `--format json` |
| `aw dashboard logs` | Live PM2 log stream | `--lines`, `--service`, `--format json` |

### Dual Output Mode

Mỗi subcommand hỗ trợ 2 mode:
- **Default (interactive):** Render Ink UI với live refresh, keyboard shortcuts
- **`--format json`:** Output JSON to stdout (one-shot), không load Ink/React — phù hợp cho CI, scripting, AI agent consumption

## Project Structure

```
devtools/common/cli-plugin-dashboard/
├── package.json                    # "type": "module", ink + react
├── tsconfig.json                   # module: Node16, jsx: react-jsx
└── src/
    ├── index.ts                    # Empty (oclif auto-discovers commands)
    ├── commands/dashboard/
    │   ├── index.ts                # aw dashboard
    │   ├── services.ts             # aw dashboard services
    │   ├── system.ts               # aw dashboard system
    │   ├── workspace.ts            # aw dashboard workspace
    │   └── logs.ts                 # aw dashboard logs
    ├── components/
    │   ├── Dashboard.tsx            # Root: useInput + useApp + useStdout
    │   ├── Header.tsx               # Spacer-based layout
    │   ├── TabBar.tsx               # Number key hints [1-4]
    │   ├── panels/
    │   │   ├── ServicesPanel.tsx     # useServices hook consumer
    │   │   ├── SystemPanel.tsx      # useSystemInfo hook consumer
    │   │   ├── WorkspacePanel.tsx   # useWorkspace hook consumer
    │   │   └── LogsPanel.tsx        # useLogs + Static component
    │   └── shared/
    │       ├── Table.tsx            # Box grid (columns + rows)
    │       ├── ProgressBar.tsx      # Unicode + ASCII fallback
    │       ├── Spinner.tsx          # Frame animation + ASCII fallback
    │       ├── StatusBadge.tsx      # Color-coded status
    │       └── Sparkline.tsx        # Block character chart
    ├── hooks/
    │   ├── useInterval.ts           # setInterval + auto-cleanup
    │   ├── useServices.ts           # pm2 + health (polls 5s)
    │   ├── useSystemInfo.ts         # CPU/mem 2s, disk 10s, versions once
    │   ├── useWorkspace.ts          # Async fs scan (once on mount)
    │   └── useLogs.ts              # Long-lived spawn stream
    └── lib/
        ├── pm2.ts                   # execFile('pm2', ['jlist']) + spawn logs
        ├── system.ts                # os module + execFile('df') + execFile('pnpm')
        └── health.ts                # createRequire bridge to @aweave/cli-shared
```

## ESM + oclif Integration Guide

> **Đây là reference guide cho bất kỳ AI agent nào cần tạo ESM oclif plugin mới hoặc tích hợp Ink vào oclif.**

### Tại sao cần ESM?

Ink v6 và React 19 chỉ ship ESM (`"type": "module"`). Không có CJS build. Do đó bất kỳ oclif plugin nào dùng Ink v6 đều **bắt buộc phải là ESM package**.

### 3 lớp interop cần xử lý

```
CJS root CLI (@aweave/cli)
  │
  ├── [1] oclif v4 load ESM plugin ──── OK, built-in support
  │        (phải build trước, không có dev mode)
  │
  └── ESM plugin (@aweave/cli-plugin-dashboard)
        │
        ├── [2] dynamic import('ink') ──── ESM-only packages
        │        (lazy load, chỉ khi render interactive UI)
        │
        └── [3] createRequire() ──── import CJS packages
                 (cho @aweave/cli-shared và bất kỳ CJS dep nào)
```

### [1] CJS Root CLI Load ESM Plugin

**Cách hoạt động:** oclif v4 tự động detect `"type": "module"` trong plugin `package.json` và dùng `import()` thay vì `require()` để load command files.

**Yêu cầu:**
- Plugin **phải** được build trước (`pnpm build`) — oclif KHÔNG hỗ trợ ts-node dev mode cho ESM plugin
- `oclif.commands` trỏ tới `"./dist/commands"` (compiled JS, không phải src/)
- Plugin phải nằm trong `oclif.plugins` array của root CLI `package.json`

**Config pattern:**

```json
// Plugin package.json
{
  "type": "module",
  "main": "dist/index.js",
  "oclif": {
    "commands": "./dist/commands",
    "topicSeparator": " "
  }
}
```

```json
// Plugin tsconfig.json
{
  "compilerOptions": {
    "module": "Node16",
    "moduleResolution": "node16",
    "jsx": "react-jsx",
    "target": "es2022"
  }
}
```

**Tại sao `module: "Node16"` mà không phải `"ESNext"`?** `Node16` tạo ra đúng format ESM mà Node.js runtime hiểu (với `.js` extensions trong imports). `ESNext` có thể tạo syntax mà Node.js chưa hỗ trợ hoặc thiếu file extensions.

### [2] Dynamic Import cho ESM-only Packages

Ink và React là ESM-only. Trong oclif command files, dùng dynamic `import()` bên trong `async run()`:

```typescript
// ❌ SAI — top-level import sẽ fail khi oclif scan commands
import { render } from 'ink';
import React from 'react';

// ✅ ĐÚNG — dynamic import, chỉ load khi thực sự cần render
async run() {
  const { render } = await import('ink');
  const React = await import('react');
  const { Dashboard } = await import('../../components/Dashboard.js');

  render(React.createElement(Dashboard, { ...props }));
}
```

**Tại sao dynamic import?**
1. oclif scan tất cả command files lúc startup để build manifest. Top-level import sẽ load Ink/React cho MỌI command, kể cả `aw debate create` — lãng phí.
2. Với `--format json`, hoàn toàn không cần Ink/React. Dynamic import giúp skip loading.
3. `React.createElement()` thay vì JSX trong command file vì JSX chỉ dùng trong `.tsx` files — command files là `.ts`.

### [3] createRequire() cho CJS Dependencies

`@aweave/cli-shared` là CJS (`module: "commonjs"`, không có `"type": "module"`). ESM code không thể dùng `import { checkHealth } from '@aweave/cli-shared'` trực tiếp vì:
- Node.js ESM loader yêu cầu CJS packages export qua `module.exports` default
- Named imports từ CJS vào ESM có thể fail tùy cách package export

**Giải pháp — `createRequire()`:**

```typescript
import { createRequire } from 'node:module';

// Tạo require() function từ ESM context
const require = createRequire(import.meta.url);

// Load CJS module bình thường qua require()
const cliShared = require('@aweave/cli-shared') as {
  checkHealth: (url: string, timeout?: number) => Promise<boolean>;
};

const { checkHealth } = cliShared;
```

**Khi nào dùng `createRequire()` vs `import()`?**
- CJS package không có ESM exports → `createRequire()` (luôn work)
- ESM-only package → `import()` (bắt buộc)
- Dual package (có cả CJS + ESM) → `import` bình thường (Node.js tự chọn)

### Dev Workflow Cho ESM Plugin

```bash
# ESM plugin PHẢI build trước mỗi lần test
cd devtools/common/cli-plugin-dashboard && pnpm build

# Test via root CLI
cd devtools/common/cli && node bin/run.js dashboard --help
cd devtools/common/cli && node bin/run.js dashboard services --format json

# KHÔNG CÓ dev mode (ts-node không hỗ trợ ESM plugin trong oclif)
# Mỗi lần thay đổi source → pnpm build → test lại
```

## Non-blocking Data Collection (Critical Pattern)

**Quy tắc #1:** KHÔNG BAO GIỜ dùng `execSync` trong code mà Ink render. `execSync` block Node event loop → Ink freeze, không respond keyboard input, không update UI.

**Pattern đúng:**

```typescript
// ❌ SAI — block event loop, freeze Ink
import { execSync } from 'node:child_process';
const result = execSync('pm2 jlist', { encoding: 'utf-8' });

// ✅ ĐÚNG — async, không block
import { execFile } from 'node:child_process';

function getPm2Processes(): Promise<Pm2Process[]> {
  return new Promise((resolve) => {
    execFile('pm2', ['jlist'], { timeout: 10_000 }, (err, stdout) => {
      if (err) { resolve([]); return; }
      resolve(JSON.parse(stdout));
    });
  });
}
```

**Performance budget:** Không có single data collection tick nào được block event loop >50ms.

| Data Source | Method | Blocking? | Timeout |
|-------------|--------|-----------|---------|
| pm2 processes | `execFile('pm2', ['jlist'])` | No | 10s |
| pm2 logs | `spawn('pm2', ['logs', '--raw'])` | No (stream) | N/A |
| CPU | `os.cpus()` delta calculation | No (pure JS) | N/A |
| Memory | `os.totalmem()` / `os.freemem()` | No (pure JS) | N/A |
| Disk | `execFile('df', ['-h', '/'])` | No | 5s |
| pnpm version | `execFile('pnpm', ['--version'])` | No | 5s |
| Health check | `fetch()` with AbortController | No | 2s |
| Workspace scan | `fs.readFile` + `fs.access` | No (async fs) | N/A |

### Graceful Fallback Strategy

Mọi data source đều có fallback — không bao giờ crash khi service/command không available:

```typescript
// Pattern: try async → catch → return safe default
const result = await getPm2Processes();
// result = { processes: [...], stale: false }       ← OK
// result = { processes: [], stale: true, error: "pm2 not found" }  ← fallback
```

UI hiển thị "(stale)" indicator khi data không fresh, thay vì crash hoặc show empty.

## Custom Ink Components Guide

**Tại sao tự build?** Community packages (`ink-spinner`, `ink-table`, `ink-big-text`) đều declare `peerDependencies: { ink: "^4.0.0" }` hoặc `^5.0.0` — conflict với Ink v6. Tự build từ primitives = zero conflicts + showcase Ink features tốt hơn.

### Pattern: Unicode + ASCII Fallback

Tất cả shared components hỗ trợ `ascii` prop cho terminals không hỗ trợ Unicode:

```typescript
// ProgressBar: Unicode (default) vs ASCII
<ProgressBar value={65} />           // ████████████░░░░░░░░  65%
<ProgressBar value={65} ascii />     // [============--------]  65%

// StatusBadge
<StatusBadge status="online" />      // ● online
<StatusBadge status="online" ascii /> // [OK] online

// Sparkline
<Sparkline data={[1,3,5,2,4]} />      // ▁▃▇▂▅
<Sparkline data={[1,3,5,2,4]} ascii /> // ._#-=
```

### Component API Summary

| Component | Key Props | Output |
|-----------|-----------|--------|
| `Spinner` | `label`, `color`, `ascii`, `interval` | `⠋ Loading...` |
| `ProgressBar` | `value` (0-100), `width`, `label`, `color`, `ascii` | `CPU   ████░░░░  65%` |
| `StatusBadge` | `status`, `label`, `ascii` | `● online` |
| `Table` | `columns[]`, `rows[]` | Box grid with header |
| `Sparkline` | `data[]`, `width`, `color`, `ascii` | `▁▂▃▅▇` |

### Ink v6 Features Used

| Feature | Where | Purpose |
|---------|-------|---------|
| `Box` (flexDirection, border, padding) | Every component | Layout |
| `Text` (color, bold, dim, underline) | StatusBadge, TabBar, headers | Styling |
| `Newline` | Dashboard | Panel spacing |
| `Spacer` | Header | Push clock to right |
| `Static` | LogsPanel | Non-rerendering log history |
| `Transform` | LogsPanel | Log line decoration |
| `useInput` | Dashboard | Tab/1-4 switch, q quit, r refresh |
| `useApp` | Dashboard | `exit()` on q key |
| `useStdout` | Dashboard | Terminal width for responsive layout |

## Hooks Architecture

```
┌─────────────────────────────────────────────────────┐
│  useInterval(callback, delayMs)                     │
│  Generic setInterval + auto-cleanup on unmount      │
│  Pass null to pause. Used by all polling hooks.     │
└─────────────────┬───────────────────────────────────┘
                  │
    ┌─────────────┼──────────────┬──────────────┐
    │             │              │              │
    ▼             ▼              ▼              ▼
useServices   useSystemInfo  useWorkspace   useLogs
(5s poll)     (CPU/mem 2s,   (once on       (long-lived
              disk 10s,      mount, async   spawn stream,
              versions once) fs scan)       rolling buffer)
```

**Key conventions:**
- Hooks return `{ data, loading, error?, lastUpdated? }` — consumers show Spinner during loading, error message on failure
- All async operations are fire-and-forget inside hooks (no awaiting in render path)
- `useEffect` teardown used to kill spawned child processes (prevent leaked pm2 log subprocesses)

## Development

```bash
cd devtools/common/cli-plugin-dashboard

# Build (REQUIRED — no dev mode for ESM plugins)
pnpm build

# Test JSON output (no Ink rendering)
cd ../cli && node bin/run.js dashboard services --format json
cd ../cli && node bin/run.js dashboard system --format json
cd ../cli && node bin/run.js dashboard workspace --format json

# Test interactive (requires terminal)
cd ../cli && node bin/run.js dashboard
```

## Checklist: Adding a New Ink-based oclif Plugin

Khi tạo một ESM oclif plugin mới sử dụng Ink, follow checklist này:

1. **package.json:** `"type": "module"`, add `ink` + `react` dependencies
2. **tsconfig.json:** `module: "Node16"`, `jsx: "react-jsx"`, `moduleResolution: "node16"`
3. **src/index.ts:** Empty file (oclif auto-discovers commands)
4. **CJS deps:** Dùng `createRequire(import.meta.url)` cho bất kỳ CJS package nào
5. **Command files (.ts):** Dynamic `import('ink')` inside `async run()`, KHÔNG top-level import
6. **Component files (.tsx):** Import Ink/React bình thường (top-level OK vì chỉ load khi command gọi)
7. **Data fetching:** 100% async (`execFile`, `spawn`, `fetch`, async `fs`) — KHÔNG `execSync`
8. **Community packages:** Check `peerDependencies` trước — hầu hết Ink community packages chưa hỗ trợ Ink v6. Tự build custom components.
9. **Register:** Add to `pnpm-workspace.yaml` + `cli/package.json` (dependencies + oclif.plugins)
10. **Build trước test:** `pnpm build` mỗi lần thay đổi source — không có hot reload

## Related

- **Root CLI:** `devtools/common/cli/` — `devdocs/misc/devtools/common/cli/OVERVIEW.md`
- **CLI Shared:** `devtools/common/cli-shared/` — provides `checkHealth()` reused via `createRequire`
- **Debate Plugin:** `devtools/common/cli-plugin-debate/` — CJS plugin pattern reference
- **Implementation Plan:** `devdocs/misc/devtools/plans/260207-cli-plugin-dashboard-ink.md`
- **Global Overview:** `devdocs/misc/devtools/OVERVIEW.md`
