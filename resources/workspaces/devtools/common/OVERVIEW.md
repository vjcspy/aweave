# Common Devtools — Shared Platform Infrastructure

Common Devtools is the domain-agnostic foundation of the `aw` CLI ecosystem — providing the CLI framework, shared libraries, state machines, backend server, and UI components reused across all domains (NAB, future domains).
This overview lists all discovered packages grouped by role with links to their package overviews.
Use the coverage table to spot missing package overviews quickly.

## Platform Purpose & Landscape

- The `aw` CLI is an oclif-based platform CLI — a single binary that auto-loads domain plugins. The main entrypoint contains no business logic, only plugin composition.
- Shared utilities (`cli-shared`) provide the MCP response format (contract with AI agents), HTTP client, output helpers, content reading, and local server process management (start/stop/status/logs; replaces PM2) — consumed by every plugin.
- A debate system enables structured argumentation between AI agents — with CLI commands, state machine validation (xstate v5), NestJS backend (REST + WebSocket), SQLite persistence, and a React SPA arbitrator UI served through the unified server.
- A workflow engine provides multi-step task execution (sequential/parallel/race) with retry, human-in-the-loop, streaming, and an Ink v6 terminal dashboard.
- A document storage system provides versioned document management with direct SQLite access for AI agents.
- A unified NestJS server hosts all backend feature modules in a single process with shared auth, error handling, and OpenAPI/Swagger, and acts as the single frontend gateway (serving and/or proxying React SPAs under path prefixes like `/debate`).
- Shared Playwright wraps `playwright-core` for browser automation (SSO cookie capture, testing).
- An interactive terminal dashboard (Ink v6) provides real-time workflow and runtime monitoring, health checks, and system info.

## Packages

### CLI Core

- **cli:** oclif-based main CLI application — provides the global `aw` command. Contains no business logic — only bootstraps oclif, declares plugins, and auto-loads domain commands. Installed globally via `pnpm link --global` ([devdocs/misc/devtools/common/cli/OVERVIEW.md](devdocs/misc/devtools/common/cli/OVERVIEW.md))
- **cli-shared:** Pure utility library for the entire `aw` CLI ecosystem — MCP response format (AI agent contract), HTTP client (native fetch), output helpers, content reading (`--file`/`--content`/`--stdin`), and local server process management (replaces PM2). Zero external dependencies. Leaf dependency consumed by all plugins ([devdocs/misc/devtools/common/cli-shared/OVERVIEW.md](devdocs/misc/devtools/common/cli-shared/OVERVIEW.md))

### CLI Plugins

- **cli-plugin-debate:** oclif plugin providing `aw debate` topic — HTTP client to NestJS server for debate lifecycle (create, submit, appeal, wait, ruling). Enriches responses with `available_actions` computed via xstate machine. Token-optimized write responses for AI agents ([devdocs/misc/devtools/common/cli-plugin-debate/OVERVIEW.md](devdocs/misc/devtools/common/cli-plugin-debate/OVERVIEW.md))
- **cli-plugin-docs:** oclif plugin providing `aw docs` topic — document storage and versioning with direct SQLite access (better-sqlite3). Supports create, submit, get, list, history, export, delete with version history and soft-delete ([devdocs/misc/devtools/common/cli-plugin-docs/OVERVIEW.md](devdocs/misc/devtools/common/cli-plugin-docs/OVERVIEW.md))
- **cli-plugin-dashboard:** ESM oclif plugin using Ink v6 + React 19 for interactive terminal dashboard — real-time workflow/runtime monitoring, health checks, CPU/memory/disk stats, workspace status. Reference implementation for Ink v6 + oclif integration ([devdocs/misc/devtools/common/cli-plugin-dashboard/OVERVIEW.md](devdocs/misc/devtools/common/cli-plugin-dashboard/OVERVIEW.md))
- **cli-plugin-demo-workflow:** ESM oclif plugin running a 7-stage demo workflow showcasing all engine features (parallel, race, dynamic tasks, reducers, human-in-the-loop, retry, streaming, timeout). Reference implementation for new workflow plugins ([devdocs/misc/devtools/common/cli-plugin-demo-workflow/OVERVIEW.md](devdocs/misc/devtools/common/cli-plugin-demo-workflow/OVERVIEW.md))
- **cli-plugin-server:** oclif plugin providing `aw server` topic — local server lifecycle management (start/stop/status/restart/logs, optional `--open`). Replaces PM2 with native `child_process.spawn` daemonization ([devdocs/misc/devtools/common/cli-plugin-server/OVERVIEW.md](devdocs/misc/devtools/common/cli-plugin-server/OVERVIEW.md))
- **cli-plugin-config:** oclif plugin providing `aw config` topic — config inspection and management (overview missing)
- **cli-plugin-relay:** oclif plugin providing `aw relay` topic — push data with chunking and encryption. Commands: `push`, `status`, `config set`, `config show`, `config generate-key`

### Domain Plugins

- **cli-plugin-tinybots-bitbucket:** TinyBots domain plugin providing `aw tinybots-bitbucket` topic — Bitbucket PR details, comments, tasks (direct Bitbucket REST API v2.0; auto-pagination) ([resources/workspaces/devtools/tinybots/cli-plugin-bitbucket/OVERVIEW.md](resources/workspaces/devtools/tinybots/cli-plugin-bitbucket/OVERVIEW.md))

### Shared Libraries

- **debate-machine:** Shared xstate v5 state machine for the debate system — single source of truth for debate states (5 states, 5 event types), transitions, and role-based action validation. Consumed by both CLI and NestJS server ([devdocs/misc/devtools/common/debate-machine/OVERVIEW.md](devdocs/misc/devtools/common/debate-machine/OVERVIEW.md))
- **workflow-engine:** Core workflow execution engine — pure TypeScript `WorkflowEngine` class (EventEmitter-based) with sequential/parallel/race strategies, retry with backoff, stage reducers, human-in-the-loop input, and xstate v5 machine for lifecycle management. Consumed by dashboard and workflow plugins ([devdocs/misc/devtools/common/workflow-engine/OVERVIEW.md](devdocs/misc/devtools/common/workflow-engine/OVERVIEW.md))
- **playwright:** Shared browser automation library — wraps `playwright-core` with `launchBrowser()` and `launchPersistentBrowser()` helpers. Uses system-installed Chrome/Edge via channel (no 500MB browser download). Consumed by `cli-plugin-auth` for SSO cookie capture ([devdocs/misc/devtools/common/playwright/OVERVIEW.md](devdocs/misc/devtools/common/playwright/OVERVIEW.md))
- **config-core:** Shared config loader and schema utilities (overview missing)
- **config:** Shared default configuration package (overview missing)

### Backend Services

- **server:** Unified NestJS server — single process hosting all feature modules (DebateModule, LogModule, future modules). Provides shared infrastructure: AuthGuard (Bearer token), AppExceptionFilter, CORS, WebSocket adapter, OpenAPI/Swagger. Runs on port 3456, started/stopped by the CLI (no PM2). Also acts as the frontend gateway (serves and/or proxies SPAs under path prefixes) ([devdocs/misc/devtools/common/server/OVERVIEW.md](devdocs/misc/devtools/common/server/OVERVIEW.md))
- **nestjs-debate:** NestJS module for the debate system — REST API (CRUD debates + arguments), WebSocket gateway (real-time updates), interval polling, state machine validation, idempotency, per-debate mutex locking, better-sqlite3 persistence. Imported by unified server ([devdocs/misc/devtools/common/nestjs-debate/OVERVIEW.md](devdocs/misc/devtools/common/nestjs-debate/OVERVIEW.md))

### Frontend Apps

- **debate-web:** React SPA for Arbitrator to monitor debates and submit RULING/INTERVENTION — sidebar debate list, real-time WebSocket updates, argument timeline, typed API client generated from OpenAPI spec. Served via the unified server under `/debate` (same origin with API + WebSocket) ([devdocs/misc/devtools/common/debate-web/OVERVIEW.md](devdocs/misc/devtools/common/debate-web/OVERVIEW.md))
- **workflow-dashboard:** Ink v6 + React 19 reusable terminal dashboard component for workflow engine — stage/task tree sidebar, live logs, task detail, human input panel, keyboard navigation. Consumed by workflow plugins via `<WorkflowDashboard actor={actor} />` ([devdocs/misc/devtools/common/workflow-dashboard/OVERVIEW.md](devdocs/misc/devtools/common/workflow-dashboard/OVERVIEW.md))

## Cross-Package Data Flows

### Debate System

- AI agents use `aw debate create/submit/appeal/...` (**cli-plugin-debate**) → HTTP requests to **server** (port 3456) → routed to **nestjs-debate** module.
- **nestjs-debate** validates state transitions using **debate-machine** (xstate), persists to SQLite (`~/.aweave/db/debate.db`), broadcasts via WebSocket.
- **cli-plugin-debate** enriches responses with `available_actions` computed locally via **debate-machine** — same machine, dual usage.
- **debate-web** is loaded through **server** (single origin) and connects to WebSocket at `/ws` for real-time updates, using typed API client generated from server's `openapi.json`.
- `aw debate wait` polls **server** every 2s until opponent responds or deadline reached.

### Workflow System

- Workflow plugins define `WorkflowDefinition` → create xstate actor via **workflow-engine**'s `workflowMachine` → `render(<WorkflowDashboard actor={...} />)`.
- **workflow-engine** runs stages/tasks, emits events → xstate machine bridges events to context → **workflow-dashboard** subscribes via `@xstate/react` and renders real-time UI.
- **cli-plugin-demo-workflow** is the reference implementation demonstrating all engine features.

### CLI Infrastructure

- **cli** bootstraps oclif → loads all plugins declared in `oclif.plugins`.
- Every plugin depends on **cli-shared** for MCP response format, output helpers, HTTP client.
- ESM plugins (**cli-plugin-dashboard**, **cli-plugin-demo-workflow**, **workflow-dashboard**) use `createRequire()` to import CJS packages like **cli-shared**.

```text
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
                                                     SPAs (served/proxied)
                                                     - /debate → debate-web

   ═══════════════════════════════════════════════════════════════
   All plugins ──► cli-shared (MCP response, HTTP, output, process mgmt)
   Browser automation ──► playwright (wraps playwright-core)
```

## Operational Notes

- **Source Code Location:** `devtools/common/<package>/` — following `devtools/common/<PACKAGE_NAME>/` convention.
- All packages are **TypeScript** managed via pnpm workspaces.
- **CJS vs ESM:** Most packages are CJS. ESM-only packages: `cli-plugin-dashboard`, `cli-plugin-demo-workflow`, `workflow-dashboard` (required by Ink v6 + React 19).
- **Build order:** `cli-shared` → shared libraries (`debate-machine`, `workflow-engine`, `playwright`) → plugins/modules → `cli` (last).
- **Local runtime:** one server process only. Start/stop via `aw server start|stop|status|restart|logs` (no PM2).
- **SQLite databases:**
  - `~/.aweave/db/debate.db` — debate data (managed by nestjs-debate)
  - `~/.aweave/docstore.db` — document versions (managed by cli-plugin-docs)
- **State machines:** `debate-machine` and `workflow-engine` both use xstate v5 — shared between CLI and server/dashboard respectively.
- **MCP response format** is the contract between CLI commands and AI agents — changes must be backward-compatible.
- **Global CLI installation:** `cd devtools/common/cli && pnpm link --global` → `aw` available system-wide.
- Keep package overviews under `devdocs/misc/devtools/common/<package>/OVERVIEW.md` up to date; missing overviews should be added when the package is actively worked on.

## Package Coverage Table

| Package | Package Group | Overview Path | Status |
| --- | --- | --- | --- |
| cli | CLI Core | devdocs/misc/devtools/common/cli/OVERVIEW.md | ✅ Present |
| cli-shared | CLI Core | devdocs/misc/devtools/common/cli-shared/OVERVIEW.md | ✅ Present |
| cli-plugin-debate | CLI Plugins | devdocs/misc/devtools/common/cli-plugin-debate/OVERVIEW.md | ✅ Present |
| cli-plugin-docs | CLI Plugins | devdocs/misc/devtools/common/cli-plugin-docs/OVERVIEW.md | ✅ Present |
| cli-plugin-dashboard | CLI Plugins | devdocs/misc/devtools/common/cli-plugin-dashboard/OVERVIEW.md | ✅ Present |
| cli-plugin-demo-workflow | CLI Plugins | devdocs/misc/devtools/common/cli-plugin-demo-workflow/OVERVIEW.md | ✅ Present |
| cli-plugin-server | CLI Plugins | devdocs/misc/devtools/common/cli-plugin-server/OVERVIEW.md | ✅ Present |
| cli-plugin-config | CLI Plugins | devdocs/misc/devtools/common/cli-plugin-config/OVERVIEW.md | ❌ Missing |
| cli-plugin-relay | CLI Plugins | devdocs/misc/devtools/common/cli-plugin-relay/OVERVIEW.md | ❌ Missing |
| config-core | Shared Libraries | devdocs/misc/devtools/common/config-core/OVERVIEW.md | ❌ Missing |
| config | Shared Libraries | devdocs/misc/devtools/common/config/OVERVIEW.md | ❌ Missing |
| debate-machine | Shared Libraries | devdocs/misc/devtools/common/debate-machine/OVERVIEW.md | ✅ Present |
| workflow-engine | Shared Libraries | devdocs/misc/devtools/common/workflow-engine/OVERVIEW.md | ✅ Present |
| playwright | Shared Libraries | devdocs/misc/devtools/common/playwright/OVERVIEW.md | ✅ Present |
| server | Backend Services | devdocs/misc/devtools/common/server/OVERVIEW.md | ✅ Present |
| nestjs-debate | Backend Services | devdocs/misc/devtools/common/nestjs-debate/OVERVIEW.md | ✅ Present |
| debate-web | Frontend Apps | devdocs/misc/devtools/common/debate-web/OVERVIEW.md | ✅ Present |
| workflow-dashboard | Frontend Apps | devdocs/misc/devtools/common/workflow-dashboard/OVERVIEW.md | ✅ Present |
