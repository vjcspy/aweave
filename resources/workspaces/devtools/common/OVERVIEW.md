# Common Devtools — Shared Platform Infrastructure

Common Devtools is the domain-agnostic foundation of the `aw` CLI ecosystem — providing the CLI framework, shared libraries, state machines, backend server, and UI components reused across all domains (NAB, future domains).
This overview lists all discovered packages grouped by role with links to their package overviews.
Use the coverage table to spot missing package overviews quickly.

## Platform Purpose & Landscape

- The `aw` CLI is an oclif-based platform CLI — a single binary that auto-loads domain plugins. The main entrypoint contains no business logic, only plugin composition.
- Shared utilities (`cli-shared`) provide the MCP response format (contract with AI agents), HTTP client, output helpers, content reading, and pm2 service management — consumed by every plugin.
- A debate system enables structured argumentation between AI agents — with CLI commands, state machine validation (xstate v5), NestJS backend (REST + WebSocket), SQLite persistence, and a Next.js arbitrator UI.
- A workflow engine provides multi-step task execution (sequential/parallel/race) with retry, human-in-the-loop, streaming, and an Ink v6 terminal dashboard.
- A document storage system provides versioned document management with direct SQLite access for AI agents.
- A unified NestJS server hosts all backend feature modules in a single process with shared auth, error handling, and OpenAPI/Swagger.
- Shared Playwright wraps `playwright-core` for browser automation (SSO cookie capture, testing).
- An interactive terminal dashboard (Ink v6) provides real-time pm2 monitoring, health checks, and system info.

## Packages

### CLI Core

- **cli:** oclif-based main CLI application — provides the global `aw` command. Contains no business logic — only bootstraps oclif, declares plugins, and auto-loads domain commands. Installed globally via `pnpm link --global` ([resources/workspaces/devtools/common/cli/OVERVIEW.md](resources/workspaces/devtools/common/cli/OVERVIEW.md))
- **cli-shared:** Pure utility library for the entire `aw` CLI ecosystem — MCP response format (AI agent contract), HTTP client (native fetch), output helpers, content reading (`--file`/`--content`/`--stdin`), and pm2 service management. Zero external dependencies. Leaf dependency consumed by all plugins ([resources/workspaces/devtools/common/cli-shared/OVERVIEW.md](resources/workspaces/devtools/common/cli-shared/OVERVIEW.md))

### CLI Plugins

- **cli-plugin-debate:** oclif plugin providing `aw debate` topic — HTTP client to NestJS server for debate lifecycle (create, submit, appeal, wait, ruling). Enriches responses with `available_actions` computed via xstate machine. Token-optimized write responses for AI agents ([resources/workspaces/devtools/common/cli-plugin-debate/OVERVIEW.md](resources/workspaces/devtools/common/cli-plugin-debate/OVERVIEW.md))
- **cli-plugin-docs:** oclif plugin providing `aw docs` topic — document storage and versioning with direct SQLite access (better-sqlite3). Supports create, submit, get, list, history, export, delete with version history and soft-delete ([resources/workspaces/devtools/common/cli-plugin-docs/OVERVIEW.md](resources/workspaces/devtools/common/cli-plugin-docs/OVERVIEW.md))
- **cli-plugin-dashboard:** ESM oclif plugin using Ink v6 + React 19 for interactive terminal dashboard — real-time pm2 monitoring, health checks, CPU/memory/disk stats, workspace status. Reference implementation for Ink v6 + oclif integration ([resources/workspaces/devtools/common/cli-plugin-dashboard/OVERVIEW.md](resources/workspaces/devtools/common/cli-plugin-dashboard/OVERVIEW.md))
- **cli-plugin-demo-workflow:** ESM oclif plugin running a 7-stage demo workflow showcasing all engine features (parallel, race, dynamic tasks, reducers, human-in-the-loop, retry, streaming, timeout). Reference implementation for new workflow plugins ([resources/workspaces/devtools/common/cli-plugin-demo-workflow/OVERVIEW.md](resources/workspaces/devtools/common/cli-plugin-demo-workflow/OVERVIEW.md))
- **cli-plugin-relay:** oclif plugin providing `aw relay` topic — push data with chunking and encryption. Commands: `push`, `status`, `config set`, `config show`, `config generate-key`

### Shared Libraries

- **config-core:** Shared config loader library (Node-only) providing YAML parsing, deep-merging, environment overrides, and Next.js client public projection. Resolves `env vars > user config > defaults` precedence. ([resources/workspaces/devtools/common/config-core/OVERVIEW.md](resources/workspaces/devtools/common/config-core/OVERVIEW.md))
- **config:** Default configurations, schemas, and environment override maps for the `common` domain devtools packages. ([resources/workspaces/devtools/common/config/OVERVIEW.md](resources/workspaces/devtools/common/config/OVERVIEW.md))
- **debate-machine:** Shared xstate v5 state machine for the debate system — single source of truth for debate states (5 states, 5 event types), transitions, and role-based action validation. Consumed by both CLI and NestJS server ([resources/workspaces/devtools/common/debate-machine/OVERVIEW.md](resources/workspaces/devtools/common/debate-machine/OVERVIEW.md))
- **workflow-engine:** Core workflow execution engine — pure TypeScript `WorkflowEngine` class (EventEmitter-based) with sequential/parallel/race strategies, retry with backoff, stage reducers, human-in-the-loop input, and xstate v5 machine for lifecycle management. Consumed by dashboard and workflow plugins ([resources/workspaces/devtools/common/workflow-engine/OVERVIEW.md](resources/workspaces/devtools/common/workflow-engine/OVERVIEW.md))
- **playwright:** Shared browser automation library — wraps `playwright-core` with `launchBrowser()` and `launchPersistentBrowser()` helpers. Uses system-installed Chrome/Edge via channel (no 500MB browser download). Consumed by `cli-plugin-auth` for SSO cookie capture ([resources/workspaces/devtools/common/playwright/OVERVIEW.md](resources/workspaces/devtools/common/playwright/OVERVIEW.md))

### Backend Services

- **server:** Unified NestJS server — single process hosting all feature modules (DebateModule, LogModule, future modules). Provides shared infrastructure: AuthGuard (Bearer token), AppExceptionFilter, CORS, WebSocket adapter, OpenAPI/Swagger. Runs on port 3456 via PM2 ([resources/workspaces/devtools/common/server/OVERVIEW.md](resources/workspaces/devtools/common/server/OVERVIEW.md))
- **nestjs-debate:** NestJS module for the debate system — REST API (CRUD debates + arguments), WebSocket gateway (real-time updates), interval polling, state machine validation, idempotency, per-debate mutex locking, better-sqlite3 persistence. Imported by unified server ([resources/workspaces/devtools/common/nestjs-debate/OVERVIEW.md](resources/workspaces/devtools/common/nestjs-debate/OVERVIEW.md))

### Frontend Apps

- **debate-web:** Next.js 16 web application for Arbitrator to monitor debates and submit RULING/INTERVENTION — sidebar debate list, real-time WebSocket updates, argument timeline, typed API client generated from OpenAPI spec. Runs on port 3457 via PM2 ([resources/workspaces/devtools/common/debate-web/OVERVIEW.md](resources/workspaces/devtools/common/debate-web/OVERVIEW.md))
- **workflow-dashboard:** Ink v6 + React 19 reusable terminal dashboard component for workflow engine — stage/task tree sidebar, live logs, task detail, human input panel, keyboard navigation. Consumed by workflow plugins via `<WorkflowDashboard actor={actor} />` ([resources/workspaces/devtools/common/workflow-dashboard/OVERVIEW.md](resources/workspaces/devtools/common/workflow-dashboard/OVERVIEW.md))

## CLI Infrastructure

- **cli** bootstraps oclif → loads all plugins declared in `oclif.plugins`.
- Every plugin depends on **cli-shared** for MCP response format, output helpers, HTTP client.
- ESM plugins (**cli-plugin-dashboard**, **cli-plugin-demo-workflow**, **workflow-dashboard**) use `createRequire()` to import CJS packages like **cli-shared**.

```
                    ┌──────────────────────────────┐
                    │          @hod/aweave          │
                    │     (oclif entrypoint)        │
                    └──┬───┬───┬───┬───┬───┬───┬──┘
                       │   │   │   │   │   │   │
        ┌──────────────┘   │   │   │   │   │   └──────────────┐
        ▼                  ▼   ▼   ▼   ▼   ▼                  ▼
   cli-plugin-        debate docs dashboard demo-wf  relay  (nab plugins)
                         │                    │
                         │                    ▼
                         │            workflow-engine ◄── workflow-dashboard
                         │
                         ▼
                    debate-machine ◄── nestjs-debate ◄── server (:3456)
                                                              │
                                                         debate-web (:3457)

   ═══════════════════════════════════════════════════════════════
   All plugins ──► cli-shared (MCP response, HTTP, output, pm2)
   Browser automation ──► playwright (wraps playwright-core)
```

## Operational Notes

- **Source Code Location:** `workspaces/devtools/common/<package>/` — following `workspaces/devtools/common/<PACKAGE_NAME>/` convention.
- All packages are **TypeScript** managed via pnpm workspaces.
- **CJS vs ESM:** Most packages are CJS. ESM-only packages: `cli-plugin-dashboard`, `cli-plugin-demo-workflow`, `workflow-dashboard` (required by Ink v6 + React 19).
- **Build order:** `cli-shared` → shared libraries (`debate-machine`, `workflow-engine`, `playwright`) → plugins/modules → `cli` (last).
- **PM2** manages long-running services via `devtools/ecosystem.config.cjs`:
  - `aweave-server` (port 3456) — unified NestJS server
  - `debate-web` (port 3457) — debate arbitrator UI
- **SQLite databases:**
  - `~/.aweave/db/debate.db` — debate data (managed by nestjs-debate)
  - `~/.aweave/docstore.db` — document versions (managed by cli-plugin-docs)
- **State machines:** `debate-machine` and `workflow-engine` both use xstate v5 — shared between CLI and server/dashboard respectively.
- **MCP response format** is the contract between CLI commands and AI agents — changes must be backward-compatible.
- **Global CLI installation:** `cd workspaces/devtools/common/cli && pnpm link --global` → `aw` available system-wide.
- Keep package overviews under `resources/workspaces/devtools/common/<package>/OVERVIEW.md` up to date; missing overviews should be added when the package is actively worked on.

## Package Coverage Table

| Package | Package Group | Overview Path | Status |
|---|---|---|---|
| cli | CLI Core | resources/workspaces/devtools/common/cli/OVERVIEW.md | ✅ Present |
| cli-shared | CLI Core | resources/workspaces/devtools/common/cli-shared/OVERVIEW.md | ✅ Present |
| cli-plugin-debate | CLI Plugins | resources/workspaces/devtools/common/cli-plugin-debate/OVERVIEW.md | ✅ Present |
| cli-plugin-docs | CLI Plugins | resources/workspaces/devtools/common/cli-plugin-docs/OVERVIEW.md | ✅ Present |
| cli-plugin-dashboard | CLI Plugins | resources/workspaces/devtools/common/cli-plugin-dashboard/OVERVIEW.md | ✅ Present |
| cli-plugin-demo-workflow | CLI Plugins | resources/workspaces/devtools/common/cli-plugin-demo-workflow/OVERVIEW.md | ✅ Present |
| config-core | Shared Libraries | resources/workspaces/devtools/common/config-core/OVERVIEW.md | ✅ Present |
| config | Shared Libraries | resources/workspaces/devtools/common/config/OVERVIEW.md | ✅ Present |
| cli-plugin-relay | CLI Plugins | resources/workspaces/devtools/common/cli-plugin-relay/OVERVIEW.md | ❌ Missing |
| debate-machine | Shared Libraries | resources/workspaces/devtools/common/debate-machine/OVERVIEW.md | ✅ Present |
| workflow-engine | Shared Libraries | resources/workspaces/devtools/common/workflow-engine/OVERVIEW.md | ✅ Present |
| playwright | Shared Libraries | resources/workspaces/devtools/common/playwright/OVERVIEW.md | ✅ Present |
| server | Backend Services | resources/workspaces/devtools/common/server/OVERVIEW.md | ✅ Present |
| nestjs-debate | Backend Services | resources/workspaces/devtools/common/nestjs-debate/OVERVIEW.md | ✅ Present |
| debate-web | Frontend Apps | resources/workspaces/devtools/common/debate-web/OVERVIEW.md | ✅ Present |
| workflow-dashboard | Frontend Apps | resources/workspaces/devtools/common/workflow-dashboard/OVERVIEW.md | ✅ Present |
