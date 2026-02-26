---
name: Test CLI Plugin
description: oclif plugin providing browser-based testing commands — Cursor dashboard session management with Playwright for saving and reusing authenticated browser state
tags: [cli, test, playwright, browser]
---

# Test CLI Plugin (`@hod/aweave-plugin-test`)

> **Branch:** master
> **Last Commit:** 2b6635f
> **Last Updated:** 2026-02-26

## TL;DR

oclif plugin providing `aw test` commands for browser-based testing workflows. Currently focuses on Cursor dashboard session management — save authenticated browser state via Playwright and reuse it across sessions without re-login.

## Recent Changes Log

Initial Documentation.

## Repo Purpose & Bounded Context

- **Role:** CLI interface for browser-based testing and session management
- **Domain:** Developer tooling — testing infrastructure

## Project Structure

```
cli-plugin-test/
├── package.json                          # @hod/aweave-plugin-test
├── tsconfig.json
└── src/
    ├── index.ts                          # (empty — oclif auto-discovers)
    ├── commands/
    │   └── test/
    │       └── cursor/
    │           ├── open.ts               # aw test cursor open
    │           └── save.ts               # aw test cursor save
    └── lib/
        ├── browser-config.ts             # Browser channel selection (Chrome/Edge)
        └── session-provider.ts           # SessionProvider interface + JSON implementation
```

## Public Surface (Inbound)

- **`aw test cursor save`** — Launch headed browser, navigate to Cursor dashboard, wait for login/SSO, save browser storage state (cookies, localStorage) to `~/.aweave/userdata/cursor-session.json`
- **`aw test cursor open`** — Launch browser with saved session state, open Cursor dashboard in authenticated state. Keeps running until Ctrl+C.

## Core Services & Logic (Internal)

- **Browser config (`browser-config.ts`):** Selects Chrome or Edge channel via `AWEAVE_CURSOR_BROWSER_CHANNEL` env var or `cli.yaml` config. Default: `msedge`.
- **Session provider (`session-provider.ts`):** `SessionProvider` interface with `load()`, `save()`, `getPath()`. `JsonSessionProvider` implementation stores Playwright storage state as JSON. Path overridable via `AWEAVE_CURSOR_STATE_PATH`.

## External Dependencies & Contracts (Outbound)

- **`@hod/aweave-playwright`** — Playwright wrapper (`chromium`, `launchBrowser`)
- **`@hod/aweave-config-common`** — Shared config constants
- **`@hod/aweave-config-core`** — Config loading
- **Filesystem:** Reads/writes `~/.aweave/userdata/cursor-session.json`

## Related

- **Playwright Package:** `workspaces/devtools/common/playwright/`
- **Main CLI:** `workspaces/devtools/common/cli/`
