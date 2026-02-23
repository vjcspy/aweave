# 260222-Dashboard-Fancy-Log-Viewer - Dashboard Fancy Log Viewer Integration (CLI)

## References

- `resources/workspaces/devtools/common/_plans/260222-nestjs-core-logging-correlation-id.md`
- `resources/workspaces/devtools/common/cli-plugin-dashboard/OVERVIEW.md`
- `resources/workspaces/devtools/common/cli-plugin-server/OVERVIEW.md`
- `workspaces/devtools/common/cli-plugin-dashboard/src/commands/dashboard/logs.ts`
- `workspaces/devtools/common/cli-plugin-dashboard/src/commands/dashboard/services.ts`
- `workspaces/devtools/common/cli-plugin-dashboard/src/components/panels/ServicesPanel.tsx`
- `workspaces/devtools/common/cli-plugin-dashboard/src/components/panels/LogsPanel.tsx`
- `workspaces/devtools/common/cli-plugin-dashboard/src/lib/pm2.ts`
- `workspaces/devtools/common/cli-plugin-dashboard/src/hooks/useLogs.ts`
- `workspaces/devtools/common/cli-plugin-dashboard/src/hooks/useServices.ts`

## User Requirements

Previously, we have implemented structured logging (Pino, Correlation ID) following `resources/workspaces/devtools/common/_plans/260222-nestjs-core-logging-correlation-id.md`.
Now, I want to upgrade the `aw dashboard logs` command in the `cli-plugin-dashboard` workspace to be a **fancy log viewer**.
The current `LogsPanel.tsx` is very basic. It uses Ink's `<Static>` component to append raw log strings to the terminal. We need to upgrade this into a premium, interactive TUI (Terminal User Interface) log viewer.

Additionally, the dashboard still contains PM2 remnants that must be removed from the implementation plan:
- `workspaces/devtools/common/cli-plugin-dashboard/src/lib/pm2.ts` contains PM2 process list and log stream logic
- `workspaces/devtools/common/cli-plugin-dashboard/src/hooks/useLogs.ts` still depends on PM2 log streaming
- `workspaces/devtools/common/cli-plugin-dashboard/src/hooks/useServices.ts` still depends on PM2 process listing

`cli-plugin-server` has replaced PM2 with native `child_process.spawn(..., { detached: true })` process management and server logs written to `~/.aweave/logs/server.jsonl`, so the dashboard plan must migrate to that data source and remove PM2-specific assumptions.

## Objective

Transform the `LogsPanel.tsx` in the CLI into an interactive, feature-rich log viewer using Ink (React for CLI).
The new CLI log viewer should support interactive row selection, expandable JSON details, filtering, pause/resume streaming, and color-coded parsed pino logs.
At the same time, remove PM2-specific dashboard data plumbing (`src/lib/pm2.ts`, `useLogs`, `useServices`) and align the dashboard with the native `cli-plugin-server` daemon + log file architecture.

### Key Considerations

- **Current PM2 Remnants:** `src/lib/pm2.ts` is currently a mixed module that serves both the Logs tab (`pm2 logs --raw`) and Services tab (`pm2 jlist`). This coupling must be removed, not just patched for logs.
- **Server Runtime Source of Truth:** PM2 is deprecated in favor of the native daemon (`cli-plugin-server`). Dashboard runtime/service state should come from the server daemon state file (`~/.aweave/server.json`) plus health checks, and logs should come from `~/.aweave/logs/server.jsonl` (with compatibility fallback if needed).
- **Limitation of `<Static>`:** `<Static>` permanently prints to stdout and doesn't allow interactive re-rendering of previous lines (e.g., selecting a row to expand it). To make the log viewer interactive, we must switch to a full-screen or bounded `Box` rendering approach where we control the viewport and only render the visible slice of logs based on terminal height (`useStdout`).
- **Data Format:** The terminal will receive raw strings from `server.jsonl`. We need to parse these JSON lines to extract `level`, `time`, `msg`, `context`, and `correlationId` for rich formatting.
- **Services Tab Scope Change:** The old PM2 process table assumed multiple PM2-managed processes with CPU/memory/restarts fields. The new daemon model may require a revised Services panel data contract (single `aweave-server` daemon status row and health-centric metadata) rather than a PM2-shaped process list.
- **Dependencies:** `cli-plugin-dashboard` uses **Ink v6** and **React 19**. We CANNOT use community Ink packages like `ink-text-input` or `ink-table` because they are largely incompatible with v6. We must build custom primitives using `Box`, `Text`, `useInput`, etc.
- **Performance:** Rendering too many lines in a single React tree in Ink can be slow. We must implement virtual scrolling/slicing: keeping a large array in memory (e.g., 1000 lines) but only rendering the `terminalHeight - headerHeight` slice of items.

## Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Analyze detailed requirements
  - **Outcome**: The target is the `cli-plugin-dashboard` Ink UI, not the web dashboard.
- [x] Define scope and edge cases
  - **Outcome**: Must handle parsing failures gracefully (fallback to raw string). Must manage terminal resizing. Must handle keyboard input without blocking the event loop.

### Phase 2: Implementation Structure

```
workspaces/devtools/common/cli-plugin-dashboard/
└── src/
    ├── lib/
    │   ├── file-tail.ts             # 🆕 Robust file tailer for `~/.aweave/logs/server.jsonl`
    │   ├── server-daemon.ts         # 🆕 Read/normalize daemon state from `~/.aweave/server.json`
    │   └── pm2.ts                   # ❌ Remove after hooks/panels are migrated
    ├── hooks/
    │   ├── useLogs.ts               # 🚧 Migrate to file-tail + parsed JSONL + interactive buffer contract
    │   └── useServices.ts           # 🚧 Migrate from PM2 process list to server daemon status model
    └── components/
        └── panels/
            ├── LogsPanel.tsx        # 🚧 Rewrite to interactive UI
            ├── ServicesPanel.tsx    # 🚧 Update for non-PM2 daemon/service data shape
            └── log-viewer/          # 🆕 New inner components
                ├── LogRow.tsx       # 🆕 Renders single log line
                ├── LogDetails.tsx   # 🆕 Renders expanded JSON metadata
                └── LogHeader.tsx    # 🆕 Renders stats and filter indicators
```

### Phase 3: Detailed Implementation Steps

#### Step 1: Remove PM2 Data Layer Coupling

- **Delete/Replace `src/lib/pm2.ts`:** Split PM2-era responsibilities into server-native modules:
  - `server-daemon.ts` for daemon state/status normalization (read `~/.aweave/server.json`, detect stale PID, derive running/stopped state)
  - `file-tail.ts` for log streaming (`~/.aweave/logs/server.jsonl`)
- **No PM2 Binary Dependency:** Dashboard must not require `pm2` to be installed for either Services or Logs tabs.
- **Type Model Reset:** Introduce server-native types (for example `ServerDaemonStatus`, `ServerLogLine`) instead of reusing `Pm2Process` semantics.

#### Step 2: Migrate Hooks (`useLogs`, `useServices`)

- **File Tailing (`file-tail.ts`):** Implement a file watcher (`fs.watch` or tail equivalent) that reads `~/.aweave/logs/server.jsonl`. Handle file-not-created-yet and rotation/truncation gracefully. Emit completely framed log lines only.
- **Enhance `useLogs.ts`:**
  - Consume the new file tail stream instead of `createPm2LogStream()`.
  - Create a stable identity for each ingested line (e.g., a local incrementing `lineId`) to prevent index shifting bugs during streaming or filtering.
  - Attempt parsing JSON (Pino format) silently on the fully framed lines, falling back to plain text. The parsed structure should be `ParsedLogLine` extending the new server-native log type with `lineId`.
  - **The `--lines` Flag Contract:** Redefine the `maxLines` parameter (derived from `--lines` flag) explicitly as the `bufferLimit` (memory cap, overriding the 50 default to e.g. 1000 for interactive view, while preserving output count for `--format json`).
- **Refactor `useServices.ts`:**
  - Replace `getPm2Processes()` polling with server-daemon status polling + existing health checks.
  - Return a dashboard-friendly server service model (single daemon row or normalized list) that does not expose PM2 fields (`restarts`, PM2 status strings) unless explicitly synthesized.
  - Preserve existing stale/loading/error patterns so the Services panel remains resilient when the daemon is stopped or state file is missing.

#### Step 3: Build Interactive `LogsPanel`

- **Replace `<Static>`**: Drop `<Static>`. Use `useStdout` to get `stdout.rows`.
- **State Management**:
  - `selectedLineId`: The stable ID of the currently focused log row (for viewing details). Default: `null` (auto-scroll mode). Do NOT use array index.
  - `isPaused`: Boolean. If false, auto-scroll to bottom when new logs arrive. If true, keep viewport static.
  - `filterLevel`: Filter by `info`, `warn`, `error`, or `all`.
- **Keyboard Controls (`useInput`)**:
  - **Ownership:** `Dashboard.tsx` owns global navigation (tabs, quit, refresh). `LogsPanel` should only consume keys when active, avoiding overlaps.
  - `Up/k`, `Down/j`: Change `selectedLineId` up/down relative to the currently filtered dataset. (Automatically pauses auto-scroll).
  - `Space`: Toggle pause/resume auto-scroll.
  - `Esc`: Clear `selectedLineId` and resume auto-scroll.
  - `l`: Cycle through level filters (All -> Error -> Warn -> Info).
  - `Enter`: Toggle expansion of the selected row's JSON details.

#### Step 4: UI Components Construction

- **Header (`LogHeader.tsx`)**:
  - Show connection status: `[LIVE]` (green) or `[PAUSED]` (yellow).
  - Show current filters, total logs in buffer, and keyboard hints (e.g., `[↑↓] Navigate | [Space] Pause | [L] Filter Level | [Enter] Details`).
- **List View**:
  - Calculate `visibleLines = stdout.rows - headerHeight - detailHeight`.
  - Slice the logs array to only render what's visible.
  - **LogRow (`LogRow.tsx`)**:
    - If selected, add an `>` cursor or inverse background color (`backgroundColor="white"` `color="black"`).
    - Format: `[TIME] [LEVEL] [CONTEXT] MESSAGE`. Colorize `LEVEL` (Cyan for Info, Yellow for Warn, Red for Error).
- **Details View (`LogDetails.tsx`)**:
  - If a row is selected and expanded, reserve the bottom ~10 lines of the terminal to show a pretty-printed JSON representation of the extra properties in the log (excluding msg, level, time). Use `JSON.stringify(..., null, 2)` inside a bordered `Box`.

#### Step 5: Services Panel/Command Alignment + Polish & Performance

- Update `ServicesPanel.tsx` copy/columns/status badges to remove PM2-specific language ("pm2 process", PM2 statuses, PM2 restarts) and reflect daemon/native server semantics.
- Update `aw dashboard services` command output/labels (if PM2 wording leaks into JSON or text descriptions).
- Ensure the slice recalculation is fast.
- Ensure that parsing JSON on thousands of rapid file logs doesn't lag the dashboard (e.g. catch JSON.parse quietly).
- Ensure all error messages/fallbacks mention server daemon/log file availability instead of PM2 availability.

## Verification Plan

### Manual Verification

1. **Interactive Mode**:
   - Run `aw dashboard` or `aw dashboard logs` directly.
   - Verify logs continue to work on a machine where `pm2` is not installed.
   - Verify that new logs append at the bottom and the view auto-scrolls.
   - Press `Up` arrow → verify that auto-scroll pauses (Header changing from LIVE to PAUSED), a cursor appears, and you can scroll back in history.
   - Press `Enter` on a selected log → verify the JSON details panel appears at the bottom.
   - Press `Space` → verify pause/resume toggles.
   - Press `l` → verify logs are filtered by level correctly.
   - Press `Esc` → verify the selection is cleared, details panel hides, and it snaps to the latest log (LIVE mode).
2. **Services Tab (PM2 Removal)**:
   - Run `aw dashboard services` and verify the tab/command renders without invoking `pm2`.
   - Stop the server daemon (`aw server stop`) and verify Services shows a clear stopped/offline state (not a PM2 error).
   - Start the server daemon (`aw server start`) and verify daemon status + health check become healthy.
3. **Formatting**:
   - Verify Pino logs have correct color coding based on level.
   - Verify non-JSON legacy logs still render gracefully as raw text.

## Outstanding Issues & Follow-up

- Full-text search (pressing `/` and typing a query) would require building a custom `TextInput` component from scratch natively in Ink v6, because `ink-text-input` is unsupported. Decided to leave this for a follow-up PR to keep this implementation scope manageable.
- If the dashboard later needs multi-service monitoring again, define a generic "managed services" abstraction that can aggregate multiple native daemons without reintroducing PM2-specific data models.
