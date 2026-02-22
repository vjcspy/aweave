# 260222-cli-plugin-test-cursor - Implement cli-plugin-test for Cursor Session Management

## References

- `resources/workspaces/devtools/common/cli/OVERVIEW.md`
- `resources/workspaces/devtools/common/playwright/OVERVIEW.md`

## User Requirements

- Lập package tên `cli-plugin-test` với mục đích dùng playwright để lưu session của `https://cursor.com/dashboard`.
- Cách lưu trữ session: Dùng export `context.storageState` ra file JSON cho nhẹ, nhưng cần thiết kế có cơ chế để dễ dàng swap mechanism sau này.
- Lệnh 1 (`aw test cursor save`): Mở trình duyệt, người dùng tự login, khi thành công tool tự động export cookie/session ra file rồi tự tắt trình duyệt.
- Lệnh 2 (`aw test cursor open`): Mở trình duyệt, inject session đã lưu sẵn, tự động điều hướng vào `https://cursor.com/dashboard` và giữ trình duyệt mở.
- Tên plugin: `@hod/aweave-plugin-test`. Câu lệnh CLI: `aw test cursor save` và `aw test cursor open`.

## Objective

Create a new CLI plugin `@hod/aweave-plugin-test` in the `devtools/common` workspace to automate logging into Cursor's dashboard and persisting the session. This will utilize the existing `@hod/aweave-playwright` package for browser automation.

### Key Considerations

- **Session File Location:** Need a centralized and predictable location to store the JSON session file (e.g., `~/.aweave/browser-data/cursor-state.json`).
- **Authentication Detection:** The `save` command needs a reliable way to detect when the user has successfully logged in before saving the state and closing the browser. We will wait for a specific URL pattern or element.
- **Architectural Isolation:** Keep the storage mechanism abstract (e.g., an interface `SessionProvider`) so we can easily swap between JSON file storage and other persistent profile methods in the future.

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

- [ ] 1. Scaffold the `@hod/aweave-plugin-test` package structure in `workspaces/devtools/common/cli-plugin-test`. Configure `package.json`, `tsconfig.json`, and add it to `pnpm-workspace.yaml`.
- [ ] 2. Implement `src/lib/session-provider.ts` with a `SessionProvider` interface and a `JsonSessionProvider` implementation targeting `~/.aweave/browser-data/cursor-state.json`.
- [ ] 3. Implement `aw test cursor save` command:
  - Launch browser (not headless) using `@hod/aweave-playwright`.
  - Navigate to `https://cursor.com/settings`.
  - Wait for successful login (using `.waitForURL` containing `settings` or `dashboard` with a very long timeout, or wait for an explicit user signal in the console if URL is unreliable).
  - Extract session using `context.storageState()`.
  - Save via `SessionProvider`.
  - Close the browser gracefully.
- [ ] 4. Implement `aw test cursor open` command:
  - Load session via `SessionProvider`. If absent, exit with error telling user to run `save` first.
  - Launch browser and create a new context, injecting the `storageState`.
  - Navigate to `https://cursor.com/settings`.
  - Await an unresolved promise to keep the process and browser open until the user manually terminates the CLI (`Ctrl+C`).
- [ ] 5. Register `@hod/aweave-plugin-test` in `workspaces/devtools/common/cli/package.json` (`oclif.plugins` array).
- [ ] 6. Run `pnpm install && pnpm build` inside `devtools` to build and link everything.
- [ ] 7. Perform manual verification.

## Summary of Results

<!-- Placeholder -->

## Outstanding Issues & Follow-up

### Issues/Clarifications

- [ ] **Detection Mechanism:** Sometimes Cursor's auth redirects are tricky. Is waiting for the URL to settle on `*cursor.com/settings*` sufficient? If not, we might need to wait for a specific DOM element (like the "Sign out" button or account avatar). We will start with URL detection.
