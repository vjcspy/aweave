---
name: Common Devtools — Shared Platform Infrastructure
description: Domain-agnostic foundation providing CLI framework, shared libraries, state machines, backend server, and UI components
tags: []
---

# Common Devtools — Shared Platform Infrastructure

Common Devtools is the domain-agnostic foundation of the `aw` CLI ecosystem — providing the CLI framework, shared libraries, state machines, backend server, and UI components reused across all domains (NAB, future domains).
This overview lists all discovered packages grouped by role with links to their package overviews.
Use the coverage table to spot missing package overviews quickly.

## Platform Purpose & Landscape

- The `aw` CLI is an oclif-based platform CLI — a single binary that auto-loads domain plugins. The main entrypoint contains no business logic, only plugin composition.
- Shared utilities (`cli-shared`) provide the MCP response format (contract with AI agents), HTTP client, output helpers, content reading, pm2 service management, and native process management for the server daemon — consumed by every plugin.
- A debate system enables structured argumentation between AI agents — with CLI commands, state machine validation (xstate v5), NestJS backend (REST + WebSocket), SQLite persistence, and a Next.js arbitrator UI.
- A workflow engine provides multi-step task execution (sequential/parallel/race) with retry, human-in-the-loop, streaming, and an Ink v6 terminal dashboard.
- A document storage system provides versioned document management with direct SQLite access for AI agents.
- A unified NestJS server hosts all backend feature modules in a single process with shared auth, error handling, structured pino logging with correlation ID tracking, and OpenAPI/Swagger.
- A shared NestJS core module (`nestjs-core`) provides structured JSON logging via pino (JSONL file + dev pretty console), AsyncLocalStorage-based request context, and HTTP/WebSocket correlation ID middleware — consumed by all NestJS feature modules.
- A DevTools dashboard system with NestJS backend (`nestjs-dashboard`) and React SPA frontend (`dashboard-web`) providing workspace config management, AI agent skill toggling, and server log viewing.
- Shared Playwright wraps `playwright-core` for browser automation (SSO cookie capture, testing).
- An interactive terminal dashboard (Ink v6) provides real-time workflow and runtime monitoring, health checks, and system info.

## Packages

### CLI Core

- **cli:** oclif-based main CLI application — provides the global `aw` command. Contains no business logic — only bootstraps oclif, declares plugins, and auto-loads domain commands. Installed globally via `pnpm link --global` ([resources/workspaces/devtools/common/cli/OVERVIEW.md](resources/workspaces/devtools/common/cli/OVERVIEW.md))
- **cli-shared:** Pure utility library for the entire `aw` CLI ecosystem — MCP response format (AI agent contract), HTTP client (native fetch), output helpers, content reading (`--file`/`--content`/`--stdin`), pm2 service management, and native process manager for server daemon lifecycle. Zero external dependencies. Leaf dependency consumed by all plugins ([resources/workspaces/devtools/common/cli-shared/OVERVIEW.md](resources/workspaces/devtools/common/cli-shared/OVERVIEW.md))

### CLI Plugins

- **cli-plugin-debate:** oclif plugin providing `aw debate` topic — HTTP client to NestJS server for debate lifecycle (create, submit, appeal, wait, ruling). Enriches responses with `available_actions` computed via xstate machine. Token-optimized write responses for AI agents ([resources/workspaces/devtools/common/cli-plugin-debate/OVERVIEW.md](resources/workspaces/devtools/common/cli-plugin-debate/OVERVIEW.md))
- **cli-plugin-docs:** oclif plugin providing `aw docs` topic — document storage and versioning with direct SQLite access (better-sqlite3). Supports create, submit, get, list, history, export, delete with version history and soft-delete ([resources/workspaces/devtools/common/cli-plugin-docs/OVERVIEW.md](resources/workspaces/devtools/common/cli-plugin-docs/OVERVIEW.md))
- **cli-plugin-dashboard:** ESM oclif plugin using Ink v6 + React 19 for interactive terminal dashboard — real-time pm2 monitoring, health checks, CPU/memory/disk stats, workspace status. Reference implementation for Ink v6 + oclif integration ([resources/workspaces/devtools/common/cli-plugin-dashboard/OVERVIEW.md](resources/workspaces/devtools/common/cli-plugin-dashboard/OVERVIEW.md))
- **cli-plugin-demo-workflow:** ESM oclif plugin running a 7-stage demo workflow showcasing all engine features (parallel, race, dynamic tasks, reducers, human-in-the-loop, retry, streaming, timeout). Reference implementation for new workflow plugins ([resources/workspaces/devtools/common/cli-plugin-demo-workflow/OVERVIEW.md](resources/workspaces/devtools/common/cli-plugin-demo-workflow/OVERVIEW.md))
- **cli-plugin-server:** oclif plugin providing `aw server` topic — server daemon lifecycle management (start, stop, restart, status, logs). Replaces PM2 with native Node.js `child_process.spawn` detached mode. Writes state to `~/.aweave/server.json`, polls health endpoint, manages PID lifecycle ([resources/workspaces/devtools/common/cli-plugin-server/OVERVIEW.md](resources/workspaces/devtools/common/cli-plugin-server/OVERVIEW.md))
- **cli-plugin-relay:** oclif plugin providing `aw relay` topic — push data with chunking and encryption. Commands: `push`, `status`, `config set`, `config show`, `config generate-key`

### Domain Plugins

- **cli-plugin-tinybots-bitbucket:** TinyBots domain plugin providing `aw tinybots-bitbucket` topic — Bitbucket PR details, comments, tasks (direct Bitbucket REST API v2.0; auto-pagination) ([resources/workspaces/devtools/tinybots/cli-plugin-bitbucket/OVERVIEW.md](resources/workspaces/devtools/tinybots/cli-plugin-bitbucket/OVERVIEW.md))

### Shared Libraries

- **config-core:** Shared config loader library (Node-only) providing YAML parsing, deep-merging, environment overrides, and Next.js client public projection. Resolves `env vars > user config > defaults` precedence. ([resources/workspaces/devtools/common/config-core/OVERVIEW.md](resources/workspaces/devtools/common/config-core/OVERVIEW.md))
- **config:** Default configurations, schemas, and environment override maps for the `common` domain devtools packages. ([resources/workspaces/devtools/common/config/OVERVIEW.md](resources/workspaces/devtools/common/config/OVERVIEW.md))
- **node-shared:** Neutral Node.js runtime helpers shared across CLI plugins and NestJS modules. Currently provides standardized DevTools root discovery (`env -> cwd -> moduleDir`) via marker-based walk-up. ([resources/workspaces/devtools/common/node-shared/OVERVIEW.md](resources/workspaces/devtools/common/node-shared/OVERVIEW.md))
- **debate-machine:** Shared xstate v5 state machine for the debate system — single source of truth for debate states (5 states, 5 event types), transitions, and role-based action validation. Consumed by both CLI and NestJS server ([resources/workspaces/devtools/common/debate-machine/OVERVIEW.md](resources/workspaces/devtools/common/debate-machine/OVERVIEW.md))
- **workflow-engine:** Core workflow execution engine — pure TypeScript `WorkflowEngine` class (EventEmitter-based) with sequential/parallel/race strategies, retry with backoff, stage reducers, human-in-the-loop input, and xstate v5 machine for lifecycle management. Consumed by dashboard and workflow plugins ([resources/workspaces/devtools/common/workflow-engine/OVERVIEW.md](resources/workspaces/devtools/common/workflow-engine/OVERVIEW.md))
- **playwright:** Shared browser automation library — wraps `playwright-core` with `launchBrowser()` and `launchPersistentBrowser()` helpers. Uses system-installed Chrome/Edge via channel (no 500MB browser download). Consumed by `cli-plugin-auth` for SSO cookie capture ([resources/workspaces/devtools/common/playwright/OVERVIEW.md](resources/workspaces/devtools/common/playwright/OVERVIEW.md))

### Backend Services

- **server:** Unified NestJS server — single process hosting all feature modules (NestjsCoreModule, DebateModule, DashboardModule, future modules). Provides shared infrastructure: AuthGuard (Bearer token), AppExceptionFilter, CORS, WebSocket adapter, OpenAPI/Swagger, SPA middleware. Integrates `nestjs-core` for structured pino logging and correlation ID tracking. Runs on port 3456 ([resources/workspaces/devtools/common/server/OVERVIEW.md](resources/workspaces/devtools/common/server/OVERVIEW.md))
- **nestjs-core:** Shared NestJS infrastructure module (`@Global`) — structured JSON logging via pino (dual transport: JSONL file at `~/.aweave/logs/server.jsonl` + pino-pretty console in dev), AsyncLocalStorage-based request context propagation, HTTP `x-correlation-id` middleware with auto-generation. Consumed by all feature modules without explicit imports ([resources/workspaces/devtools/common/nestjs-core/OVERVIEW.md](resources/workspaces/devtools/common/nestjs-core/OVERVIEW.md))
- **nestjs-debate:** NestJS module for the debate system — REST API (CRUD debates + arguments), WebSocket gateway (real-time updates), interval polling, state machine validation, idempotency, per-debate mutex locking, better-sqlite3 persistence. Per-connection WebSocket correlation ID tracking. Imported by unified server ([resources/workspaces/devtools/common/nestjs-debate/OVERVIEW.md](resources/workspaces/devtools/common/nestjs-debate/OVERVIEW.md))
- **nestjs-dashboard:** NestJS module for the DevTools dashboard — REST APIs for workspace YAML config management (via `@hod/aweave-config-core`), AI agent skill management (scan/parse `SKILL.md` files, toggle active state), and server log tailing (JSONL snapshot + SSE live stream). Imported by unified server ([resources/workspaces/devtools/common/nestjs-dashboard/OVERVIEW.md](resources/workspaces/devtools/common/nestjs-dashboard/OVERVIEW.md))

### Frontend Apps

- **debate-web:** Next.js 16 web application for Arbitrator to monitor debates and submit RULING/INTERVENTION — sidebar debate list, real-time WebSocket updates, argument timeline, typed API client generated from OpenAPI spec. Served via `@hod/aweave-server` SPA middleware on port 3456 at `/debate` ([resources/workspaces/devtools/common/debate-web/OVERVIEW.md](resources/workspaces/devtools/common/debate-web/OVERVIEW.md))
- **dashboard-web:** React SPA built with Rsbuild + TailwindCSS v4 for DevTools dashboard — workspace config editing, AI agent skill toggling, server log viewing with live streaming and filtering. Uses `openapi-fetch` with generated TypeScript types from backend OpenAPI schema. Served via `@hod/aweave-server` SPA middleware at `/dashboard` ([resources/workspaces/devtools/common/dashboard-web/OVERVIEW.md](resources/workspaces/devtools/common/dashboard-web/OVERVIEW.md))
- **workflow-dashboard:** Ink v6 + React 19 reusable terminal dashboard component for workflow engine — stage/task tree sidebar, live logs, task detail, human input panel, keyboard navigation. Consumed by workflow plugins via `<WorkflowDashboard actor={actor} />` ([resources/workspaces/devtools/common/workflow-dashboard/OVERVIEW.md](resources/workspaces/devtools/common/workflow-dashboard/OVERVIEW.md))

## CLI Infrastructure

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
   cli-plugin-        debate docs dashboard demo-wf  relay  server
                         │                                     │
                         │                                     ▼
                         ▼                              process-manager
                    debate-machine                      (cli-shared)
                         │
  ┌──────────────────────┼──────────────────────┐
  ▼                      ▼                      ▼
nestjs-core ◄──── nestjs-debate ◄────┐    nestjs-dashboard
  (logging,         (debate API,     │      (config/skills/
   context)          WebSocket)      │       log APIs)
                                     │          │
                                     ├──────────┤
                                     ▼          │
                                   server ◄─────┘
                                  (:3456)
                                  /  |  \
                                 /   |   \
                                ▼    ▼    ▼
                         debate-web  dashboard-web
                         (/debate)   (/dashboard)

   ═══════════════════════════════════════════════════════════════
   All plugins ──► cli-shared (MCP response, HTTP, output, process mgmt)
   Browser automation ──► playwright (wraps playwright-core)
```

## Operational Notes

- **Source Code Location:** `devtools/common/<package>/` — following `devtools/common/<PACKAGE_NAME>/` convention.
- All packages are **TypeScript** managed via pnpm workspaces.
- **CJS vs ESM:** Most packages are CJS. ESM-only packages: `cli-plugin-dashboard`, `cli-plugin-demo-workflow`, `workflow-dashboard` (required by Ink v6 + React 19).
- **Build order:** `cli-shared` → shared libraries (`debate-machine`, `workflow-engine`, `playwright`, `node-shared`, `config-core`) → `nestjs-core` → NestJS feature modules (`nestjs-debate`, `nestjs-dashboard`) → `server` → plugins → `cli` (last).
- **Server management:** `aw server start/stop/restart/status/logs` via `cli-plugin-server` (native process manager, no PM2).
- **SPA serving:** Both `debate-web` and `dashboard-web` are served as SPAs by the unified server via SPA middleware on port 3456.
- **Structured logging:** All NestJS modules use pino-based structured JSON logging via `nestjs-core`. Logs written to `~/.aweave/logs/server.jsonl` with correlation ID tracking across HTTP and WebSocket requests.
- **SQLite databases:**
  - `~/.aweave/db/debate.db` — debate data (managed by nestjs-debate)
  - `~/.aweave/db/docstore.db` — document versions (managed by cli-plugin-docs)
- **State machines:** `debate-machine` and `workflow-engine` both use xstate v5 — shared between CLI and server/dashboard respectively.
- **MCP response format** is the contract between CLI commands and AI agents — changes must be backward-compatible.
- **Global CLI installation:** `cd devtools/common/cli && pnpm link --global` → `aw` available system-wide.
- Keep package overviews under `devdocs/misc/devtools/common/<package>/OVERVIEW.md` up to date; missing overviews should be added when the package is actively worked on.

## Package Coverage Table

| Package | Package Group | Overview Path | Status |
|---|---|---|---|
| cli | CLI Core | resources/workspaces/devtools/common/cli/OVERVIEW.md | ✅ Present |
| cli-shared | CLI Core | resources/workspaces/devtools/common/cli-shared/OVERVIEW.md | ✅ Present |
| cli-plugin-debate | CLI Plugins | resources/workspaces/devtools/common/cli-plugin-debate/OVERVIEW.md | ✅ Present |
| cli-plugin-docs | CLI Plugins | resources/workspaces/devtools/common/cli-plugin-docs/OVERVIEW.md | ✅ Present |
| cli-plugin-dashboard | CLI Plugins | resources/workspaces/devtools/common/cli-plugin-dashboard/OVERVIEW.md | ✅ Present |
| cli-plugin-demo-workflow | CLI Plugins | resources/workspaces/devtools/common/cli-plugin-demo-workflow/OVERVIEW.md | ✅ Present |
| cli-plugin-server | CLI Plugins | resources/workspaces/devtools/common/cli-plugin-server/OVERVIEW.md | ✅ Present |
| cli-plugin-relay | CLI Plugins | resources/workspaces/devtools/common/cli-plugin-relay/OVERVIEW.md | ❌ Missing |
| config-core | Shared Libraries | resources/workspaces/devtools/common/config-core/OVERVIEW.md | ✅ Present |
| config | Shared Libraries | resources/workspaces/devtools/common/config/OVERVIEW.md | ✅ Present |
| node-shared | Shared Libraries | resources/workspaces/devtools/common/node-shared/OVERVIEW.md | ✅ Present |
| debate-machine | Shared Libraries | resources/workspaces/devtools/common/debate-machine/OVERVIEW.md | ✅ Present |
| workflow-engine | Shared Libraries | resources/workspaces/devtools/common/workflow-engine/OVERVIEW.md | ✅ Present |
| playwright | Shared Libraries | resources/workspaces/devtools/common/playwright/OVERVIEW.md | ✅ Present |
| server | Backend Services | resources/workspaces/devtools/common/server/OVERVIEW.md | ✅ Present |
| nestjs-core | Backend Services | resources/workspaces/devtools/common/nestjs-core/OVERVIEW.md | ✅ Present |
| nestjs-debate | Backend Services | resources/workspaces/devtools/common/nestjs-debate/OVERVIEW.md | ✅ Present |
| nestjs-dashboard | Backend Services | resources/workspaces/devtools/common/nestjs-dashboard/OVERVIEW.md | ✅ Present |
| debate-web | Frontend Apps | resources/workspaces/devtools/common/debate-web/OVERVIEW.md | ✅ Present |
| dashboard-web | Frontend Apps | resources/workspaces/devtools/common/dashboard-web/OVERVIEW.md | ✅ Present |
| workflow-dashboard | Frontend Apps | resources/workspaces/devtools/common/workflow-dashboard/OVERVIEW.md | ✅ Present |
