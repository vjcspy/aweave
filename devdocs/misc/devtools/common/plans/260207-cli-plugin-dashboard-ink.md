# 260207 - CLI Plugin Dashboard (Ink v6)

## References

- `devdocs/misc/devtools/OVERVIEW.md` — Global devtools overview
- `devdocs/misc/devtools/common/cli/OVERVIEW.md` — oclif CLI entrypoint
- `devdocs/misc/devtools/common/cli-plugin-debate/OVERVIEW.md` — Existing plugin pattern reference
- `devtools/common/cli/package.json` — Root CLI oclif config
- `devtools/pnpm-workspace.yaml` — Workspace packages
- Ink v6 docs: https://github.com/vadimdemedes/ink
- oclif ESM docs: https://oclif.github.io/docs/esm

## User Requirements

1. Sử dụng Ink v6 (ESM-only, React 19)
2. Scope dashboard: Real data (pm2, system info, health checks, workspace scan)
3. Command structure: Option B — Multiple commands (`aw dashboard`, `aw dashboard services`, etc.)
4. Mục đích: Sample CLI module thể hiện integration oclif + Ink, showcase đầy đủ tính năng Ink v6

## 🎯 Objective

Tạo oclif plugin `@aweave/cli-plugin-dashboard` sử dụng Ink v6 để build interactive terminal dashboard hiển thị real data từ hệ thống devtools. Plugin này vừa là công cụ monitoring thực tế, vừa là reference implementation cho việc tích hợp Ink vào oclif plugin ecosystem.

### ⚠️ Key Considerations

1. **ESM + CJS Interop**: Plugin là ESM (`"type": "module"`), root CLI (`@aweave/cli`) là CJS. oclif v4 hỗ trợ CJS root load ESM plugin, nhưng linked ESM plugin PHẢI được compile trước (`pnpm build`) — không hỗ trợ ts-node dev mode.

2. **Không dùng community Ink packages**: `ink-spinner`, `ink-table`, `ink-big-text`... đều có peer dep `ink ^4` hoặc `^5`, conflict với Ink v6/React 19. Tự build custom components từ Ink primitives — vừa showcase Ink tốt hơn, vừa zero conflicts.

3. **Selective reuse of `@aweave/cli-shared`**: Dashboard does not use MCPResponse format (interactive UI, not AI agent output). However, `@aweave/cli-shared` exports `checkHealth()` (already async) which will be reused directly. PM2 utilities in `cli-shared` are sync (`execSync`-based) and unsuitable for interactive rendering — dashboard builds its own async variants using `execFile`/`spawn`. Dependency tree: `@oclif/core` + `ink` + `react` + `@aweave/cli-shared` (for `checkHealth` only).

4. **Non-blocking data collection (CRITICAL)**: All external process calls (`pm2 jlist`, `df`, `pnpm --version`) MUST use async `child_process.execFile` or `spawn` — NEVER `execSync`. Synchronous calls block the Node event loop and freeze Ink's rendering/input handling. Each data source defines a timeout and stale-data indicator. Performance budget: no single data collection tick may block the event loop for >50ms.

5. **Real data reliability**: pm2, server health check có thể không available — mọi data source cần graceful fallback (show "unavailable" thay vì crash).

6. **Terminal compatibility**: Dashboard dùng Unicode characters (box drawing, progress blocks, sparkline) — cần fallback cho terminals không hỗ trợ full Unicode.

7. **Platform support matrix**:
   | Platform | Status | Notes |
   |----------|--------|-------|
   | macOS (darwin) | Fully supported | Primary dev platform |
   | Linux | Supported | All commands available |
   | Windows/WSL | Best-effort | `df` replaced with `wmic` or skipped; pm2 commands work |
   | Terminals with Unicode | Full rendering | Box drawing, sparkline, progress blocks |
   | Terminals without Unicode | Degraded mode | ASCII fallback: `[====----]`, `*` instead of `●`, plain borders |
   | Narrow terminals (<80 cols) | Responsive | Truncated columns, stacked layout for panels |

## 🔄 Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Verify oclif v4 + ESM plugin interop
  - **Outcome**: Confirm CJS root CLI loads ESM plugin thành công
- [x] **GATE: Verify `@aweave/cli-shared` ESM import from ESM plugin**
  - **Steps:**
    1. Build `cli-shared` (`pnpm build` in `devtools/common/cli-shared`)
    2. Create minimal `src/test-interop.ts` in dashboard plugin that imports `{ checkHealth }` from `@aweave/cli-shared`
    3. Build dashboard plugin (`pnpm build`)
    4. Run: `node dist/test-interop.js` — must execute without import errors
  - **Pass criteria:** Named import resolves, function callable
  - **Fail criteria + fallback:** If named import fails, create `src/lib/health-bridge.ts` wrapper that uses `createRequire()` to import CJS module, then re-export as ESM
  - **MUST pass before proceeding to Phase 2**
- [x] Define Ink v6 component API surface cần sử dụng
  - **Outcome**: Box, Text, Newline, Spacer, Static, Transform, useInput, useFocus, useFocusManager, useApp, useStdout, useState, useEffect
- [x] Define real data sources + fallback strategy
  - **Outcome**: pm2 jlist, os module, fetch health, fs workspace scan — tất cả có try/catch fallback
- [x] Xác nhận dependency versions
  - **Outcome**: ink@^6.6.0, react@^19.0.0, @oclif/core@^4.2.8, @types/react@^19.0.0

### Phase 2: Implementation (File/Code/Test Structure)

```
devtools/common/cli-plugin-dashboard/           # 🚧 TODO - New ESM oclif plugin
├── package.json                                # "type": "module", oclif + ink + react + cli-shared
├── tsconfig.json                               # module: Node16, jsx: react-jsx
├── src/
│   ├── index.ts                                # Empty (oclif auto-discovers commands)
│   ├── commands/
│   │   └── dashboard/
│   │       ├── index.ts                        # aw dashboard — full interactive dashboard
│   │       ├── services.ts                     # aw dashboard services — pm2 + health
│   │       ├── system.ts                       # aw dashboard system — CPU/mem/disk
│   │       ├── workspace.ts                    # aw dashboard workspace — packages status
│   │       └── logs.ts                         # aw dashboard logs — live log stream
│   ├── components/
│   │   ├── Dashboard.tsx                       # Root: Header + TabBar + active panel
│   │   ├── Header.tsx                          # Title + clock + version
│   │   ├── TabBar.tsx                          # Tab navigation bar
│   │   ├── panels/
│   │   │   ├── ServicesPanel.tsx               # pm2 process list + health checks
│   │   │   ├── SystemPanel.tsx                 # CPU/memory/disk progress bars + sparkline
│   │   │   ├── WorkspacePanel.tsx              # Package tree + build status
│   │   │   └── LogsPanel.tsx                   # Live pm2 log stream (streaming, not polling)
│   │   └── shared/
│   │       ├── Table.tsx                       # Custom table (Box grid layout)
│   │       ├── ProgressBar.tsx                 # ████░░░░ 65%
│   │       ├── Spinner.tsx                     # ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ frame animation
│   │       ├── StatusBadge.tsx                 # ● online / ✗ offline (color-coded)
│   │       └── Sparkline.tsx                   # ▁▂▃▅▇ mini chart
│   ├── hooks/
│   │   ├── useInterval.ts                      # setInterval wrapper (auto-cleanup)
│   │   ├── useServices.ts                      # async pm2 data + health check fetcher
│   │   ├── useSystemInfo.ts                    # CPU/memory/disk async polling
│   │   ├── useWorkspace.ts                     # Workspace package scanner (async fs)
│   │   └── useLogs.ts                          # pm2 log stream (long-lived spawn, not polling)
│   └── lib/
│       ├── pm2.ts                              # Async pm2 jlist parser + log stream spawner
│       ├── system.ts                           # os module wrappers, async df, versions
│       └── health.ts                           # Re-exports checkHealth from @aweave/cli-shared + latency wrapper
└── test/
    ├── lib/
    │   ├── pm2.test.ts                         # pm2 parser + fallback tests
    │   ├── system.test.ts                      # df parser + OS-gated fallback tests
    │   └── health.test.ts                      # Health check + latency tests
    └── commands/
        └── dashboard.smoke.test.ts             # Smoke tests: --json output for each subcommand
```

### Phase 3: Detailed Implementation Steps

#### Step 1: Scaffold Package + ESM Config

- [x] Create `devtools/common/cli-plugin-dashboard/package.json`:
  ```json
  {
    "name": "@aweave/cli-plugin-dashboard",
    "version": "0.1.0",
    "private": true,
    "type": "module",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "scripts": {
      "build": "tsc",
      "test": "vitest run",
      "test:watch": "vitest"
    },
    "oclif": {
      "commands": "./dist/commands",
      "topicSeparator": " "
    },
    "dependencies": {
      "@aweave/cli-shared": "workspace:*",
      "@oclif/core": "^4.2.8",
      "ink": "^6.6.0",
      "react": "^19.0.0"
    },
    "devDependencies": {
      "@types/react": "^19.0.0",
      "@types/node": "^22.10.7",
      "typescript": "^5.7.3",
      "vitest": "^3.0.0"
    }
  }
  ```
- [x] Create `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "declaration": true,
      "module": "Node16",
      "moduleResolution": "node16",
      "outDir": "dist",
      "rootDir": "src",
      "strict": true,
      "target": "es2022",
      "jsx": "react-jsx",
      "esModuleInterop": true,
      "skipLibCheck": true
    },
    "include": ["./src/**/*"]
  }
  ```
- [x] Create empty `src/index.ts`
- [x] Add to `devtools/pnpm-workspace.yaml`: `common/cli-plugin-dashboard`
- [x] Add to `devtools/common/cli/package.json`:
  - dependency: `"@aweave/cli-plugin-dashboard": "workspace:*"`
  - oclif.plugins: add `"@aweave/cli-plugin-dashboard"`
- [x] `pnpm install` → verify dependency resolution

#### Step 2: Build Shared Components

- [x] `Spinner.tsx` — Frame animation với useEffect interval, configurable spinner styles
- [x] `ProgressBar.tsx` — Props: value (0-100), width, label, color. Render: `████░░░░ 65%`
- [x] `StatusBadge.tsx` — Props: status ('online'|'offline'|'loading'). Render: colored `●`/`✗`/`◌`
- [x] `Table.tsx` — Props: columns[], rows[]. Box-based grid với header row, alignment, borders
- [x] `Sparkline.tsx` — Props: data number[], width. Render: `▁▂▃▅▇` normalized to range

#### Step 3: Build Data Hooks + Lib

- [x] `lib/pm2.ts` — `getPm2Processes()`: async via `execFile('pm2', ['jlist'])`, parse JSON, return typed array. Timeout: 10s, fallback: empty list + stale indicator
- [x] `lib/pm2.ts` — `createPm2LogStream()`: spawn long-lived `pm2 logs --raw` child process, return EventEmitter/async iterable. Teardown on unmount to prevent leaked subprocesses
- [x] `lib/system.ts` — `getCpuUsage()`: os.cpus() delta calculation over interval (pure JS, no subprocess)
- [x] `lib/system.ts` — `getMemoryUsage()`: os.totalmem/freemem → percentage + formatted (pure JS)
- [x] `lib/system.ts` — `getDiskUsage()`: async via `execFile('df', ['-h', '/'])` → parse. OS-gated: skip on Windows. Timeout: 5s
- [x] `lib/system.ts` — `getVersions()`: node version (process.version), pnpm version (async execFile), os info (os module)
- [x] `lib/health.ts` — Reuse `checkHealth()` from `@aweave/cli-shared` (already async with AbortController). Extend with latency measurement: return `{ healthy: boolean, latencyMs: number | null }`
- [x] `hooks/useInterval.ts` — Generic interval hook: `useInterval(callback, delayMs)`, auto-cleanup on unmount
- [x] `hooks/useServices.ts` — Combines async pm2 + health, polls every 5s, tracks loading/stale state per source
- [x] `hooks/useSystemInfo.ts` — CPU/mem/disk, polls every 2s, maintains sparkline history (last 30 readings)
- [x] `hooks/useWorkspace.ts` — Scan once on mount: async fs.readFile pnpm-workspace.yaml, async fs.access dist/ check
- [x] `hooks/useLogs.ts` — Uses `createPm2LogStream()` for real-time streaming. Append-only with bounded rolling buffer (last 100 lines). Cleanup spawned process on unmount/exit via useEffect teardown

#### Step 4: Build Panels

- [x] `ServicesPanel.tsx`:
  - PM2 Processes table: Name, Status (StatusBadge), CPU%, Memory, Uptime
  - Health Checks table: Endpoint, URL, Status (StatusBadge), Latency
  - Auto-refresh indicator (Spinner + "Refreshing..." khi đang fetch)
- [x] `SystemPanel.tsx`:
  - CPU: ProgressBar + Sparkline (last 30 readings)
  - Memory: ProgressBar + used/total text
  - Disk: ProgressBar + used/total text
  - Info box: Node version, pnpm version, OS, hostname, uptime
- [x] `WorkspacePanel.tsx`:
  - Package list: Name, Path, Build Status (✓ dist/ exists / ✗ not built)
  - Dependency count per package
  - Total packages summary
- [x] `LogsPanel.tsx`:
  - Static component cho log history (không re-render old lines)
  - Color-coded: INFO=cyan, ERROR=red, WARN=yellow
  - Streaming: new lines appended via `createPm2LogStream()`, no polling
  - useEffect teardown: kill spawned pm2 log process on unmount
  - Line format: `[timestamp] [service] message`

#### Step 5: Build Dashboard Shell

- [x] `Header.tsx`:
  - Title: "AWeave DevTools" (bold, colored)
  - Clock: real-time HH:MM:SS (useEffect interval 1s)
  - Version: from package.json
- [x] `TabBar.tsx`:
  - Tabs: Services | System | Workspace | Logs
  - Active tab: bold + underline + color
  - Inactive: dim
  - Show keyboard hint: `[Tab]` or `[1-4]`
- [x] `Dashboard.tsx`:
  - State: activeTab (useState)
  - useInput: Tab/1-4 switch tabs, q quit, r force refresh
  - useApp: exit() on q
  - useStdout: get terminal width for responsive layout
  - Render: Header → TabBar → active panel component
  - Pass refresh signal to active panel

#### Step 6: Wire oclif Commands

- [x] `commands/dashboard/index.ts`:
  - oclif Command class
  - `run()`: `const {render} = await import('ink'); render(<Dashboard />);`
  - Flags: `--refresh-interval` (default 5s)
- [x] `commands/dashboard/services.ts`:
  - Render only ServicesPanel (standalone, không cần tab nav)
  - Flags: `--watch` (continuous) vs one-shot, `--format json` (non-interactive JSON output for CI/debugging)
- [x] `commands/dashboard/system.ts`:
  - Render only SystemPanel
  - Flags: `--watch`, `--format json`
- [x] `commands/dashboard/workspace.ts`:
  - Render only WorkspacePanel
  - Flags: `--format json` (one-shot, no watch needed — static data)
- [x] `commands/dashboard/logs.ts`:
  - Render only LogsPanel
  - Flags: `--lines` (default 50), `--service` (filter by pm2 service name), `--format json`

#### Step 7: Automated Tests

**Toolchain:** Vitest (ESM-native, zero-config for `"type": "module"` packages). Added to devDependencies.

**Run commands:**
- `pnpm test` — run all tests once (`vitest run`)
- `pnpm test:watch` — watch mode (`vitest`)
- Workspace-level: `pnpm -r test` runs all package tests

**Smoke test harness:** Build plugin first (`pnpm build`), then invoke subcommands via `execFile('node', ['dist/commands/dashboard/services.js', '--format', 'json'])` or via oclif test helper.

- [ ] Unit tests for `lib/pm2.ts`:
  - Parse valid `pm2 jlist` JSON output → typed process array
  - Handle malformed JSON → graceful fallback (empty array)
  - Handle `execFile` timeout/error → fallback + stale indicator
  - `createPm2LogStream()` teardown on abort signal
- [ ] Unit tests for `lib/system.ts`:
  - Parse `df -h /` output variants (macOS vs Linux format differences)
  - Handle missing `df` command (Windows) → "unavailable" fallback
  - CPU delta calculation correctness
- [ ] Unit tests for `lib/health.ts`:
  - Healthy endpoint → `{ healthy: true, latencyMs: N }`
  - Timeout → `{ healthy: false, latencyMs: null }`
  - Network error → `{ healthy: false, latencyMs: null }`
- [ ] Smoke tests for each command (requires `pnpm build` as prerequisite):
  - `aw dashboard services --format json` → valid JSON structure
  - `aw dashboard system --format json` → valid JSON structure
  - `aw dashboard workspace --format json` → valid JSON structure
- [ ] Narrow terminal test: render Dashboard at 60 cols width, verify no crash/overflow

#### Step 8: Integration + Polish

- [ ] Register plugin in root CLI (already done in Step 1 config)
- [ ] `pnpm install && pnpm build` (full workspace)
- [ ] Manual test: `aw dashboard` — verify full dashboard works
- [ ] Manual test: `aw dashboard services` — verify standalone panel
- [ ] Manual test: `aw dashboard system` — verify system info
- [ ] Manual test: `aw dashboard workspace` — verify workspace scan
- [ ] Manual test: `aw dashboard logs` — verify log stream
- [ ] Responsive: test with narrow terminal (< 80 cols) — graceful degradation
- [ ] Error handling: test with pm2 not running, server down, no build artifacts

### Ink v6 Features Coverage Matrix

| Ink Feature | Component/Hook | Status |
|-------------|---------------|--------|
| `Box` (border, padding, flexDirection) | Every panel, Dashboard layout | ✅ |
| `Box` (justifyContent, alignItems, flexGrow) | Dashboard grid, Table | ✅ |
| `Text` (color, bold, dim) | StatusBadge, headers, data | ✅ |
| `Text` (italic, underline, strikethrough) | TabBar active, warnings | ✅ |
| `Newline` | Panel spacing | ✅ |
| `Spacer` | Header layout (title ←→ clock) | ✅ |
| `Static` | LogsPanel (non-rerendering log history) | ✅ |
| `Transform` | Log line colorization | ✅ |
| `useInput` | Tab nav, quit, refresh, scroll | ✅ |
| `useFocus` / `useFocusManager` | Panel focus switching | ⏭️ Not needed |
| `useApp` (exit) | Quit handling (q key) | ✅ |
| `useStdout` (dimensions) | Responsive layout | ✅ |
| `useState` + `useEffect` | All data hooks, clock | ✅ |
| Custom Spinner | Spinner.tsx (frame animation) | ✅ |
| Custom ProgressBar | SystemPanel (CPU/mem/disk) | ✅ |
| Custom Table | ServicesPanel, WorkspacePanel | ✅ |
| Custom Sparkline | SystemPanel (CPU history) | ✅ |
| Custom StatusBadge | ServicesPanel (online/offline) | ✅ |

### Real Data Sources

| Data | Source | Method | Timeout | Fallback |
|------|--------|--------|---------|----------|
| PM2 processes | `pm2 jlist` | Async `execFile` | 10s | Empty list + "pm2 not available" + stale indicator |
| Server health | `http://127.0.0.1:3456/health` | `checkHealth()` from `cli-shared` | 2s | Status: offline |
| Debate-web health | `http://127.0.0.1:3457` | `checkHealth()` from `cli-shared` | 2s | Status: offline |
| CPU usage | `os.cpus()` | Pure JS delta calculation | N/A | 0% |
| Memory | `os.totalmem()` / `os.freemem()` | Pure JS direct call | N/A | Show raw numbers |
| Disk | `df -h /` | Async `execFile` (OS-gated) | 5s | "unavailable" |
| Node version | `process.version` | Direct | N/A | Always available |
| pnpm version | `pnpm --version` | Async `execFile` | 5s | "unknown" |
| Workspace packages | `pnpm-workspace.yaml` + `fs` | Async `fs.readFile` + `fs.access` | N/A | Empty list |
| PM2 logs | `pm2 logs --raw` | Long-lived `spawn` stream | N/A | "No logs available" |
| Git activity | `git log --oneline -10` | Async `execFile` | 5s | "No git history" |

**Performance constraint:** No single data collection tick may block the event loop for >50ms. All external process invocations are async. Pure JS sources (CPU, memory) are non-blocking by nature.

### Command Reference

| Command | Description | Flags |
|---------|-------------|-------|
| `aw dashboard` | Full interactive dashboard with tab navigation | `--refresh-interval <seconds>` |
| `aw dashboard services` | PM2 processes + health checks | `--watch`, `--format json` |
| `aw dashboard system` | CPU, memory, disk, versions | `--watch`, `--format json` |
| `aw dashboard workspace` | Workspace packages + build status | `--format json` |
| `aw dashboard logs` | Live PM2 log stream | `--lines <n>`, `--service <name>`, `--format json` |

**`--format` flag:** Aligns with existing CLI ecosystem convention (`--format json|markdown`). Dashboard subcommands support `--format json` for deterministic non-interactive JSON output to stdout (one-shot, no Ink rendering). Default (no `--format`) renders interactive Ink UI. When `--format json` combined with `--watch`, outputs one JSON snapshot per refresh interval to stdout (newline-delimited JSON).

### Dashboard Visual Target

**Services Tab:**
```
┌──────────────────── AWeave DevTools ─── 14:32:05 ──────────────────────┐
│                                                                         │
│  ▸ Services    System    Workspace    Logs                              │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                         │
│  ┌─ PM2 Processes ──────────────────────────────────────────────────┐  │
│  │  Name              Status    CPU     Memory     Uptime           │  │
│  │  aweave-server     ● online  2.1%    48.2 MB    2d 5h           │  │
│  │  debate-web        ● online  0.3%    32.1 MB    2d 5h           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─ Health Checks ──────────────────────────────────────────────────┐  │
│  │  Server API    http://127.0.0.1:3456    ● healthy    12ms       │  │
│  │  Debate Web    http://127.0.0.1:3457    ● healthy    8ms        │  │
│  │  WebSocket     ws://127.0.0.1:3456/ws   ✗ offline    —          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  [Tab] switch  [↑↓] scroll  [r] refresh  [q] quit                     │
└─────────────────────────────────────────────────────────────────────────┘
```

**System Tab:**
```
┌──────────────────── AWeave DevTools ─── 14:32:05 ──────────────────────┐
│                                                                         │
│  Services    ▸ System    Workspace    Logs                              │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                         │
│  ┌─ Resources ──────────────────────────────────────────────────────┐  │
│  │  CPU    ████████████░░░░░░░░  58%    ▁▂▃▅▇▅▃▂▁▃▅▇▅▃           │  │
│  │  MEM    ██████████████░░░░░░  72%    11.5 GB / 16.0 GB         │  │
│  │  DISK   ████████░░░░░░░░░░░░  41%    195 GB / 476 GB           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─ Environment ────────────────────────────────────────────────────┐  │
│  │  Node.js     v20.11.0                                           │  │
│  │  pnpm        10.2.0                                             │  │
│  │  OS          darwin 24.6.0 (arm64)                              │  │
│  │  Hostname    kais-macbook                                       │  │
│  │  Uptime      5d 12h 30m                                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  [Tab] switch  [↑↓] scroll  [r] refresh  [q] quit                     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Workspace Tab:**
```
┌──────────────────── AWeave DevTools ─── 14:32:05 ──────────────────────┐
│                                                                         │
│  Services    System    ▸ Workspace    Logs                              │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                         │
│  ┌─ Packages (10) ─────────────────────────────────────────────────┐  │
│  │  Package                        Path                    Built   │  │
│  │  @aweave/cli                    common/cli/             ✓       │  │
│  │  @aweave/cli-shared             common/cli-shared/      ✓       │  │
│  │  @aweave/cli-plugin-debate      common/cli-plugin-...   ✓       │  │
│  │  @aweave/cli-plugin-docs        common/cli-plugin-...   ✓       │  │
│  │  @aweave/cli-plugin-dashboard   common/cli-plugin-...   ✗       │  │
│  │  @aweave/server                 common/server/          ✓       │  │
│  │  @aweave/nestjs-debate          common/nestjs-debate/   ✓       │  │
│  │  @aweave/debate-machine         common/debate-machine/  ✓       │  │
│  │  debate-web                     common/debate-web/      ✓       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Summary: 9/10 built  ·  Last scan: 14:32:05                          │
│                                                                         │
│  [Tab] switch  [↑↓] scroll  [r] refresh  [q] quit                     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Logs Tab:**
```
┌──────────────────── AWeave DevTools ─── 14:32:05 ──────────────────────┐
│                                                                         │
│  Services    System    Workspace    ▸ Logs                              │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                         │
│  14:31:42  aweave-server  INFO   Request POST /debates                 │
│  14:31:42  aweave-server  INFO   Response 201 Created (12ms)           │
│  14:31:45  debate-web     INFO   WebSocket connected                   │
│  14:31:50  aweave-server  INFO   Request GET /debates/abc-123          │
│  14:31:50  aweave-server  INFO   Response 200 OK (3ms)                 │
│  14:32:01  aweave-server  WARN   Poll timeout for debate xyz-789       │
│  14:32:05  debate-web     ERROR  WebSocket disconnected                │
│                                                                         │
│                                                                         │
│                                                                         │
│                                                                         │
│  Showing last 50 lines  ·  Auto-refresh: 3s                           │
│                                                                         │
│  [Tab] switch  [↑↓] scroll  [r] refresh  [q] quit                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## 📊 Summary of Results

> Do not summarize the results until the implementation is done and I request it

### ✅ Completed Achievements

- (pending implementation)

## 🚧 Outstanding Issues & Follow-up

### ⚠️ Issues/Clarifications

- [x] Verify oclif v4 CJS root + ESM plugin interop thực tế (Step 1 phải test trước khi build toàn bộ)
- [x] ink-spinner, ink-table community packages peer dep conflict với Ink v6 — decision: build custom components
- [x] `pm2 jlist` output format cần verify trên máy hiện tại (pm2 version specific)
- [ ] Terminal minimum width assumption (80 cols) — cần test narrow terminals
- [x] `@aweave/cli-shared` ESM/CJS interop — promoted to Phase 1 mandatory gate with pass/fail criteria and fallback strategy

## Implementation Notes / As Implemented

### ESM + CJS Interop

- Plugin uses `"type": "module"` and `tsconfig.json` with `module: "Node16"`, `jsx: "react-jsx"`
- `@aweave/cli-shared` imported via `createRequire(import.meta.url)` in `lib/health.ts` — the plan's fallback strategy. Named imports resolve correctly.
- oclif v4 CJS root CLI loads the ESM plugin successfully after `pnpm build`. All 5 commands are discoverable via `aw dashboard --help`.

### Architecture Decisions

- **No community Ink packages**: All 5 shared components (`Spinner`, `ProgressBar`, `StatusBadge`, `Table`, `Sparkline`) built from Ink primitives (`Box`, `Text`). Zero peer dep conflicts.
- **All data fetching is async**: `execFile` for pm2/df/pnpm, `os` module for CPU/memory (pure JS), `spawn` for log streaming. No `execSync` anywhere.
- **Dynamic imports for Ink**: oclif commands use `await import('ink')` and `await import('react')` to avoid loading Ink/React when running `--format json`.
- **ASCII fallback**: All shared components accept `ascii` prop for terminals without Unicode.

### Verified Smoke Tests

| Command | Status | Output |
|---------|--------|--------|
| `aw dashboard --help` | ✅ | Shows all 5 subcommands |
| `aw dashboard services --format json` | ✅ | Real pm2 processes + health checks with latency |
| `aw dashboard system --format json` | ✅ | CPU/memory/disk/versions with real data |
| `aw dashboard workspace --format json` | ✅ | 11 packages, 10/11 built |

### File Structure (As Built)

```
devtools/common/cli-plugin-dashboard/
├── package.json                    # ESM ("type": "module"), ink@^6.6.0, react@^19
├── tsconfig.json                   # module: Node16, jsx: react-jsx
├── src/
│   ├── index.ts                    # Empty (oclif auto-discovers)
│   ├── commands/dashboard/
│   │   ├── index.ts                # aw dashboard (full interactive)
│   │   ├── services.ts             # aw dashboard services
│   │   ├── system.ts               # aw dashboard system
│   │   ├── workspace.ts            # aw dashboard workspace
│   │   └── logs.ts                 # aw dashboard logs
│   ├── components/
│   │   ├── Dashboard.tsx            # Root: Header + TabBar + active panel
│   │   ├── Header.tsx               # Title + clock + version
│   │   ├── TabBar.tsx               # Tab navigation bar
│   │   ├── panels/
│   │   │   ├── ServicesPanel.tsx     # pm2 processes + health checks
│   │   │   ├── SystemPanel.tsx      # CPU/memory/disk + sparkline + versions
│   │   │   ├── WorkspacePanel.tsx   # Package tree + build status
│   │   │   └── LogsPanel.tsx        # Live pm2 log stream (Static + Transform)
│   │   └── shared/
│   │       ├── Table.tsx            # Custom Box grid table
│   │       ├── ProgressBar.tsx      # ████░░░░ 65%
│   │       ├── Spinner.tsx          # ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ frame animation
│   │       ├── StatusBadge.tsx      # ● online / ✗ offline
│   │       └── Sparkline.tsx        # ▁▂▃▅▇ mini chart
│   ├── hooks/
│   │   ├── useInterval.ts           # Generic setInterval + auto-cleanup
│   │   ├── useServices.ts           # pm2 + health polling (5s)
│   │   ├── useSystemInfo.ts         # CPU/mem (2s) + disk (10s) + versions (once)
│   │   ├── useWorkspace.ts          # Workspace scan (once on mount)
│   │   └── useLogs.ts              # pm2 log stream (long-lived spawn)
│   └── lib/
│       ├── pm2.ts                   # Async pm2 jlist + log stream spawner
│       ├── system.ts                # CPU delta, memory, disk (async df), versions
│       └── health.ts                # createRequire bridge to cli-shared checkHealth + latency
└── dist/                            # Build output (26 .js + 26 .d.ts files)
```
