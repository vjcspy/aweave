# 260222-Dashboard-Fancy-Log-Viewer - Dashboard Fancy Log Viewer Integration

## References

- `resources/workspaces/devtools/common/_plans/260222-nestjs-core-logging-correlation-id.md`
- `resources/workspaces/devtools/common/cli-plugin-dashboard/OVERVIEW.md`
- `resources/workspaces/devtools/common/dashboard-web/OVERVIEW.md`
- `resources/workspaces/devtools/common/nestjs-dashboard/OVERVIEW.md`
- `workspaces/devtools/common/dashboard-web/src/components/LogsView.tsx`
- `workspaces/devtools/common/dashboard-web/rsbuild.config.ts`
- `workspaces/devtools/common/nestjs-dashboard/src/controllers/logs.controller.ts`
- `workspaces/devtools/common/nestjs-dashboard/src/services/logs.service.ts`

## User Requirements

previously, we have implemented log follow this plan `resources/workspaces/devtools/common/_plans/260222-nestjs-core-logging-correlation-id.md`
now, I want to integrate it with `resources/workspaces/devtools/common/cli-plugin-dashboard/OVERVIEW.md`
dashboard cli we have a tab for show log, but now it's not showing anything.
Give me a plan to integrate a fancy log viewer

## Objective

Fix the broken log tab in the dashboard-web and upgrade the log viewer into a premium, fancy log viewer with modern UX patterns — expanding beyond the current basic table layout to include an expandable detail row, JSON syntax highlighting, level-based visual indicators, real-time statistics, and smoother interactions.

### Key Considerations

- **Root cause of "not showing anything":** The `rsbuild.config.ts` dev proxy is **missing the `/logs` route**. The frontend fetches `/logs/tail` and connects to SSE at `/logs/stream`, but in dev mode (Rsbuild on port 3458), these requests are not proxied to the NestJS backend (port 3456). This is a 1-line config fix.
- **Production mode works:** In production, the dashboard SPA is served from the same origin `/dashboard/` on port 3456, so `/logs/*` requests reach the NestJS controllers directly.
- **Backend functionality:** `LogsController` (REST tail + SSE stream) and `LogsService` (JSONL reader/watcher) are functionally complete for the MVP UI. However, the initial tail read implementation may block the event loop on very large files, so it should be monitored and optimized as a follow-up.
- **Current frontend `LogsView.tsx` is functional but basic:** 523-line component with table layout, filter bar, SSE streaming, pause/resume, and correlation ID copy/filter. It works once the proxy is fixed, but lack premium visual experience.
- **Design system:** Dashboard uses TailwindCSS v4 with custom `@utility` classes (`glass`, `glass-panel`, `glass-button`, `text-glow`, `glow-border`). Must use existing design tokens.
- **Existing patterns:** Follow the aesthetic patterns from `ConfigsView.tsx` and `SkillsView.tsx` for consistency (glassmorphism, smooth transitions, `lucide-react` icons).

## Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Analyze detailed requirements
  - **Outcome**: Root cause identified (missing `/logs` proxy in rsbuild config). Frontend `LogsView.tsx` exists and is functional but needs a premium visual upgrade. Backend is functionally complete for MVP (tail read needs monitoring/optimization).
- [x] Define scope and edge cases
  - **Outcome**: Edge cases include empty log file, SSE reconnection, large log volumes (2000+ entries), long messages/metadata wrapping, rapid log emission (backpressure), and filter state persistence across tab switches.
- [x] Evaluate existing test structures and define test cases
  - **Outcome**: No unit tests exist in `dashboard-web` or `nestjs-dashboard`. Verification will be manual browser testing.

### Phase 2: Implementation Structure

```
workspaces/devtools/common/
├── dashboard-web/
│   ├── rsbuild.config.ts            # 🚧 TODO – Add /logs proxy route (1-line fix)
│   └── src/
│       ├── App.tsx                  # 🚧 TODO – Implement keep-mounted tabs / state preservation
│       ├── index.css                # 🚧 TODO – Add log-viewer-specific utilities
│       └── components/
│           └── LogsView.tsx         # 🚧 TODO – Rewrite with fancy log viewer UI
└── nestjs-dashboard/src/            # ✅ DONE – No changes needed
```

### Phase 3: Detailed Implementation Steps

#### Step 1: Fix Dev Proxy (Critical Bug Fix)

- [ ] Add `/logs` proxy route to `workspaces/devtools/common/dashboard-web/rsbuild.config.ts`
  - Add entry under `server.proxy`:

    ```typescript
    '/logs': {
      target: 'http://127.0.0.1:3456',
      changeOrigin: true,
    },
    ```

  - This immediately fixes "not showing anything" in dev mode.

#### Step 2: Upgrade LogsView to Fancy Log Viewer

- [ ] Rewrite `workspaces/devtools/common/dashboard-web/src/components/LogsView.tsx` with:

  **A. Stats Header Bar**
  - Real-time counters: total lines, error count, warn count, info rate
  - Animated pulse indicator for live stream status
  - Connection status badge with auto-reconnect indicator
  - Time range display (first log → latest log)

  **B. Enhanced Filter Bar**
  - Level selector with colored pills/badges (not dropdown)
  - Context filter with autocomplete/suggestions from observed contexts
  - Correlation ID filter with paste-friendly UX
  - Full-text search with highlight matching in results
  - Quick-filter presets: "Errors Only", "Last 5 min"
  - Active filter chips with individual dismiss

  **C. Log Entries — Expandable Row Design**
  - Compact row: `[time] [level-badge] [context] [message-preview] [correlation-short]`
  - Click to expand → full detail panel showing:
    - Full message text
    - JSON-formatted metadata with syntax highlighting. **Crucially: Ensure safe rendering!** Do not use `dangerouslySetInnerHTML` directly with raw log content. Either use tokenized React nodes or sanitize the output before rendering to prevent XSS.
    - Correlation ID with copy button
    - All pino fields in a key-value grid
  - Row background tinting: subtle red for errors, amber for warns
  - Hover reveal: correlation quick-actions (copy, filter)
  - Smooth max-height transition for expand/collapse

  **D. Visual Polish**
  - Level badges with glow effects (error badge pulses subtly)
  - Glassmorphism design matching existing dashboard panels
  - Smooth scroll-to-bottom animation
  - Keyboard shortcuts: `Esc` = clear filters, `Space` = pause/resume (Ensure focus-safety: ignore if focus is in `input`, `textarea`, `select`, or `[contenteditable]`)

  **E. Performance**
  - Virtual scrolling awareness: keep DOM render bounded at MAX_VISIBLE_LOGS (2000)
  - Debounced search input
  - `React.memo` on individual log rows
  - **Stable keys for list items:** Since backend `LogEntryDto` doesn't have an ID, the frontend must generate a stable internal `clientId` (e.g., UUID or local monotonic counter) during initial ingest to use as a stable key for `React.memo` and expandable rows.

#### Step 3: CSS Enhancements

- [ ] Add log-viewer-specific `@utility` classes in `workspaces/devtools/common/dashboard-web/src/index.css`:
  - `log-row-error` / `log-row-warn` background tints
  - `level-badge-glow` for error/warn level badges
  - Replace/manage the global `::-webkit-scrollbar*` selectors in `index.css`. If class-scoped styling is needed for `LogsView`, define a specific `@utility custom-scrollbar` class.

#### Step 4: Polish & Integration

- [ ] **Tab State Preservation:** Update `App.tsx` to implement a keep-mounted UI (e.g., hiding inactive tabs via CSS) or state lifting so that `LogsView` maintains its filter and connection state when switching between tabs.
- [ ] Test responsive layout (narrow viewport log row wrap)
- [ ] Ensure the SSE connection is managed properly with the chosen tab persistence strategy.

## Verification Plan

### Manual Verification

1. **Fix verification (dev mode):**
   - Run `pnpm dev` in `workspaces/devtools/common/dashboard-web/`
   - Open `http://localhost:3458` in browser
   - Navigate to "Server Logs" tab
   - Verify logs load from backend (should show log entries from `~/.aweave/logs/server.jsonl`)
   - Verify live SSE streaming works (trigger an API call on the server, e.g. open `/health` in another tab, and watch new log entries appear)

2. **Fancy UI verification:**
   - Verify level badges display with correct colors and glow effects
   - Click a log row → verify expansion animation and JSON metadata display
   - Test all filter controls (level pills, context, correlation ID, search)
   - Test pause/resume button stops auto-scroll
   - Verify error/warn count badges update in real-time
   - Test keyboard shortcuts (Esc to clear filters, Space to pause)

3. **Edge cases:**
   - Stop the NestJS server → verify graceful "Disconnected" state in log viewer
   - Clear all logs → verify empty state message
   - Apply filter that matches nothing → verify "No logs match filters" message
   - Rapidly switch tabs → verify no SSE connection leaks

## Summary of Results

### Completed Achievements

- [Placeholder — to be filled after implementation]

## Outstanding Issues & Follow-up

### Issues/Clarifications

- [ ] Consider adding virtual scrolling library (e.g. `@tanstack/react-virtual`) if 2000-entry DOM rendering causes performance issues on lower-end devices.
- [ ] Consider log export feature (download filtered logs as JSON/CSV) as follow-up.
- [ ] Consider adding persistent filter state to localStorage.
