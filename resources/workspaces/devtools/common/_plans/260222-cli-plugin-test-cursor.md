---
name: CLI Plugin Test Cursor
description: Plan to create a CLI plugin integrating Playwright to automate saving and restoring session cookies for Cursor Dashboard.
status: done
created: 2026-02-22
tags: []
---

# 260222-cli-plugin-test-cursor - Implement cli-plugin-test for Cursor Session Management

## References

- `resources/workspaces/devtools/common/cli/OVERVIEW.md`
- `resources/workspaces/devtools/common/playwright/OVERVIEW.md`

## User Requirements

- Lập package tên `cli-plugin-test` với mục đích dùng playwright để lưu session của `https://cursor.com/dashboard`.
- Cách lưu trữ session: Dùng export `context.storageState` ra file JSON cho nhẹ, nhưng cần thiết kế có cơ chế để dễ dàng swap mechanism sau này.
- Lệnh 1 (`aw test cursor save`): Mở trình duyệt hướng vào `https://cursor.com/dashboard` (chưa login sẽ tự redirect qua auth/SSO). Tool sử dụng lệnh `page.waitForURL('**/dashboard', { timeout: 0 })` để phát hiện tự động khi người dùng login xong. Khi vào được dashboard, script sẽ lưu storageState ra file rồi tự đóng trình duyệt.
- Lệnh 2 (`aw test cursor open`): Mở trình duyệt, inject session đã lưu sẵn, tự động điều hướng vào `https://cursor.com/dashboard` và giữ trình duyệt mở.
- Tên plugin: `@hod/aweave-plugin-test`. Câu lệnh CLI: `aw test cursor save` và `aw test cursor open`.

## Objective

Create a new CLI plugin `@hod/aweave-plugin-test` in the `devtools/common` workspace to automate logging into Cursor's dashboard and persisting the session. This will utilize the existing `@hod/aweave-playwright` package for browser automation.

### Key Considerations

- **Session File Location:** Need a centralized and predictable location to store the JSON session file (e.g., `~/.aweave/userdata/cursor-session.json`).
- **Auto Close & Safe State Saving:** The `save` command will **replace** the manual `Press Enter` flow. It will automatically detect successful login by waiting for the browser to navigate back to `https://cursor.com/dashboard` (using `await page.waitForURL('**/dashboard', { timeout: 0 })`). Because the dashboard requires authentication, reaching this URL is a guaranteed indicator of a successful login. Once detected, the tool safely extracts `context.storageState()` and automatically closes the browser. If the user closes the browser manually before login completes, the command must catch the `browser.on('disconnected')` or `page.waitForURL` error and exit gracefully.
- **Architectural Isolation:** Keep the storage mechanism abstract (e.g., an interface `SessionProvider`) to decouple from the filesystem.
- **Configurability:** The default session path should be `~/.aweave/userdata/cursor-session.json`, but the code will use an environment variable `AWEAVE_CURSOR_STATE_PATH` as an override to support isolated test environments. The `JsonSessionProvider` (or its factory constructor) will be the single source of truth for resolving this path, ensuring both `save` and `open` commands read/write to the exact same location.
- **Browser Channel:** To ensure stability, the commands will explicitly request system `channel: 'chrome'` when launching the browser via `@hod/aweave-playwright`, with a graceful error if `chrome` is missing.

## Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Analyze detailed requirements
  - **Outcome**: Identified the need for two commands (`save` and `open`) within a new plugin `cli-plugin-test` using Playwright's `context.storageState`.
- [x] Define scope and edge cases
  - **Outcome**: Handled edge cases include users closing the browser manually before login completes, and missing session files during the `open` command.
- [x] Evaluate existing test structures and define test cases
  - **Outcome**: No automated unit tests for the browser interaction itself as it relies on a third-party auth UI. Will test command routing and storage abstraction.

### Phase 2: Implementation Structure

```text
workspaces/devtools/common/cli-plugin-test/
├── package.json                    # 🚧 TODO - Plugin configuration
├── tsconfig.json                   # 🚧 TODO - TypeScript config
├── src/
│   ├── commands/
│   │   └── test/
│   │       └── cursor/
│   │           ├── save.ts         # 🚧 TODO - 'aw test cursor save' command
│   │           └── open.ts         # 🚧 TODO - 'aw test cursor open' command
│   └── lib/
│       └── session-provider.ts     # 🚧 TODO - Abstraction for storage mechanism
```

### Phase 3: Detailed Implementation Steps

- [x] 1. Scaffold the `@hod/aweave-plugin-test` package structure in `workspaces/devtools/common/cli-plugin-test`. Configure `package.json`, `tsconfig.json`, and add it to `pnpm-workspace.yaml`.
- [x] 2. Implement `src/lib/session-provider.ts` with a `SessionProvider` interface and a `JsonSessionProvider` implementation targeting `~/.aweave/userdata/cursor-session.json`. `JsonSessionProvider` must internally resolve `AWEAVE_CURSOR_STATE_PATH` if present.
- [x] 3. Implement `aw test cursor save` command:
  - Launch browser (not headless) using `@hod/aweave-playwright` with `channel: 'chrome'`.
  - Navigate to `https://cursor.com/dashboard`.
  - Wait for successful login via `await page.waitForURL('**/dashboard', { timeout: 0 })`. Wrap this in a `try-catch` block.
  - If the user manually closes the browser during this wait, catch the 'target closed' error or `disconnected` event, and `process.exit(1)` with a message.
  - On resolution of `waitForURL`, carefully call `await context.storageState()`.
  - Save via `SessionProvider` (path resolution is fully handled here).
  - Gracefully close the browser via `await session.close()`.
- [x] 4. Implement `aw test cursor open` command:
  - Load session via `SessionProvider`. If absent, exit with error telling user to run `save` first.
  - Launch browser (not headless) with `channel: 'chrome'` and create a new context, injecting the `storageState`.
  - Navigate to `https://cursor.com/dashboard` (aligned with the strategy to use dashboard as the target).
  - Await an unresolved promise to keep the process and browser open.
  - To handle termination safely: register `process.once('SIGINT', cleanup)` and `SIGTERM`. The cleanup function should await `session.close()` inside a `try-catch` before calling `process.exit(0)`.
- [x] 5. Register `@hod/aweave-plugin-test` in `workspaces/devtools/common/cli/package.json`:
  - 5a. Add `"@hod/aweave-plugin-test": "workspace:*"` to `dependencies`.
  - 5b. Add `"@hod/aweave-plugin-test"` to the `oclif.plugins` array.
- [ ] 6. Run `pnpm install && pnpm build` inside `devtools` to build and link everything.
- [ ] 7. Perform manual verification.

## Summary of Results

<!-- Placeholder -->

## Outstanding Issues & Follow-up

### Issues/Clarifications

### Issues/Clarifications

- [x] **Graceful State Saving:** Handled automatically by waiting for the explicit `https://cursor.com/dashboard` URL, which serves as a definitive success signal for auth completion before saving the state and closing the browser.
- [x] **URL Consistency:** Standardized all URL references to `https://cursor.com/dashboard` which allows automatic URL gating detection.

## Implementation Notes / As Implemented

- Created new plugin package at `workspaces/devtools/common/cli-plugin-test` with oclif command discovery (`aw test cursor save`, `aw test cursor open`).
- Implemented `SessionProvider` abstraction and `JsonSessionProvider` in `src/lib/session-provider.ts` with default path `~/.aweave/userdata/cursor-session.json` and env override `AWEAVE_CURSOR_STATE_PATH`.
- `save` command uses `@hod/aweave-playwright` `launchBrowser({ channel: 'chrome' })`, navigates to `https://cursor.com/dashboard`, waits on `page.waitForURL('**/dashboard', { timeout: 0 })`, saves `context.storageState()`, and closes the browser automatically.
- `save` command handles manual browser close during login wait and exits with code `1` with a user-facing message.
- `open` command loads saved storage state, launches Chrome via shared Playwright package, injects `storageState` into a fresh context, opens `https://cursor.com/dashboard`, and keeps the browser/process alive until `SIGINT`/`SIGTERM`.
- Added cleanup handlers for `SIGINT`, `SIGTERM`, and browser disconnect to close context/browser safely before process exit.
- Registered `@hod/aweave-plugin-test` in `workspaces/devtools/common/cli/package.json` (`dependencies` + `oclif.plugins`) and added `common/cli-plugin-test` to `workspaces/devtools/pnpm-workspace.yaml`.
- Ran scoped dependency install and build for `@hod/aweave-plugin-test` (`pnpm install --filter @hod/aweave-plugin-test...` and `pnpm --filter @hod/aweave-plugin-test build`).
- Did not run full `pnpm install && pnpm build` for the entire `workspaces/devtools` workspace, and manual browser verification was not performed in this implementation pass.
