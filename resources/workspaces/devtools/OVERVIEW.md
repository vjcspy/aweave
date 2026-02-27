---
name: DevTools Overview
description: Unified TypeScript monorepo overview with CLI, server, and frontend architecture
tags: []
---

# DevTools Overview

> **Branch:** master
> **Last Updated:** 2026-02-12

## TL;DR

Unified TypeScript monorepo with a single CLI entrypoint `aw <command>`. All tools built with Node.js: CLI (oclif), server (NestJS), frontend (React SPA via Rsbuild). Organized with domain-first folder structure, pnpm workspaces for package management, CLI for process management. All packages published to npm under `@hod/` scope — users run via `npx @hod/aweave` without pulling the repo.

## Purpose & Bounded Context

- **Role:** Provide unified CLI toolset and backend services for the entire development workflow
- **Domain:** Developer Experience, Automation, Local Development Infrastructure

## Design Philosophy

### Core Principles

1. **Single Entrypoint** — All tools accessed via `aw <command>`
2. **Domain-First Organization** — Folder structure by domain, not by tool type
3. **TypeScript Everywhere** — CLI, server, frontend — all TypeScript
4. **oclif Plugin System** — Each domain ships commands as an oclif plugin (`@hod/aweave-plugin-<name>`), auto-discovered at startup
5. **Modular Backend** — Each feature is a NestJS module in its own pnpm package, imported by a single unified server
6. **Single Process, Single Port** — NestJS server serves API + WebSocket + static SPA on port 3456
7. **npm Publishable** — All packages published to `@hod/` scope on Artifactory, installable via `npx` or `npm install -g`

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Terminal / AI Agent                   │
│                         │                                    │
│           npx @hod/aweave server start --open                │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────┐             │
│  │              @hod/aweave (oclif)             │             │
│  │                      │                      │             │
│  │    @oclif/core.execute()                    │             │
│  │          │                                  │             │
│  │          ├── cli-plugin-debate               │             │
│  │          │   └── aw debate *                 │             │
│  │          ├── cli-plugin-docs                 │
│  │          │   └── aw docs *                   │
│  │          ├── cli-plugin-server               │
│  │          │   └── aw server *                 │             │
│  │          └── cli-plugin-<name>               │             │
│  │              └── aw <name> *                 │             │
│  └───────┬──────────────┬──────────────────────┘             │
│          │              │                                    │
│          ▼              ▼                                    │
│  ┌───────────────┐  ┌─────────────────┐                     │
│  │ @hod/aweave-server │  │  External APIs   │                     │
│  │   (NestJS)     │  │  (Bitbucket,    │                     │
│  │   port 3456    │  │   etc.)         │                     │
│  │ ┌───────────┐  │  └─────────────────┘                     │
│  │ │  Debate   │  │                                          │
│  │ │  Module   │  │                                          │
│  │ └───────────┘  │                                          │
│  │ ┌───────────┐  │  debate-web SPA served at /debate        │
│  │ │ debate-web │  │  (static HTML/JS/CSS, same-origin)      │
│  │ │  (static)  │  │                                          │
│  │ └───────────┘  │                                          │
│  └───────────────┘                                           │
└──────────────────────────────────────────────────────────────┘
```

## Project Structure

```
workspaces/devtools/
├── common/                          # Shared tools & core infrastructure
│   ├── cli/                         # @hod/aweave — oclif app, plugin declarations, `aw` binary
│   ├── cli-shared/                  # @hod/aweave-cli-shared — MCP format, HTTP client, process manager
│   ├── cli-plugin-debate/           # @hod/aweave-plugin-debate — aw debate *
│   ├── cli-plugin-docs/             # @hod/aweave-plugin-docs — aw docs *
│   ├── cli-plugin-dashboard/        # @hod/aweave-plugin-dashboard — aw dashboard * (Ink v6, ESM)
│   ├── cli-plugin-server/           # @hod/aweave-plugin-server — aw server * (start/stop/status)
│   ├── cli-plugin-config/           # @hod/aweave-plugin-config — aw config *
│   ├── cli-plugin-relay/            # @hod/aweave-plugin-relay — aw relay *
│   ├── node-shared/                 # @hod/aweave-node-shared — shared Node runtime helpers (e.g. root discovery)
│   ├── server/                      # @hod/aweave-server — unified NestJS server (API + WS + static SPA)
│   ├── nestjs-debate/               # @hod/aweave-nestjs-debate — debate backend module
│   ├── debate-web/                  # @hod/aweave-debate-web — React SPA (Rsbuild, served at /debate)
│   ├── debate-machine/              # @hod/aweave-debate-machine — debate state machine (xstate)
│   ├── workflow-engine/             # @hod/aweave-workflow-engine — workflow state machine
│   ├── workflow-dashboard/          # @hod/aweave-workflow-dashboard — Ink terminal UI for workflows
│   ├── config-core/                 # @hod/aweave-config-core — config file loader
│   └── config/                      # @hod/aweave-config-common — shared config defaults
├── <domain>/                        # Domain-specific tools (e.g. nab/)
│   ├── cli-plugin-<name>/           # oclif plugin for this domain
│   └── local/                       # Local dev infrastructure
├── pnpm-workspace.yaml              # Workspace package declarations + version catalog
├── package.json                     # Root workspace scripts
├── scripts/
│   └── build-release.sh             # Build + generate oclif manifest
└── .npmrc                           # pnpm config
```

## Core Components

### CLI (`@hod/aweave` — oclif)

- **oclif application** (`common/cli/`): Bootstraps oclif, declares plugins, provides `aw` binary
- **Shared library** (`common/cli-shared/`): MCP response format, HTTP client, output helpers, process manager — used by all plugins
- **Node runtime helpers** (`common/node-shared/`): neutral Node-only utilities shared across CLI plugins and NestJS modules (e.g. DevTools root discovery)
- **Domain plugins** (`cli-plugin-*`): Each plugin registers commands under its own topic (e.g. `aw debate *`)
- **Plugin loading:** oclif reads `oclif.plugins` from `package.json`, auto-discovers command classes from each plugin's `dist/commands/`
- **Global install:** `pnpm link --global` in `common/cli/` → `aw` command available system-wide
- **npx:** `npx @hod/aweave <command>` works without install (npm resolves all `@hod/aweave-*` deps from registry)

See: `resources/workspaces/devtools/common/cli/OVERVIEW.md`

### Server (`@hod/aweave-server` — NestJS)

- Single unified server at port `3456`, bind to `127.0.0.1` (localhost only)
- Feature modules imported as separate pnpm packages (`@hod/aweave-nestjs-<feature>`)
- Shared infrastructure: bearer token auth guard, exception filter
- REST API + WebSocket support (ws library, path `/ws`)
- **Static SPA serving:** debate-web files served at `/debate/*` via `express.static()` in `main.ts`
- **SPA fallback:** `DebateSpaController` returns `index.html` for non-file routes under `/debate/*`
- **Root redirect:** `RootRedirectController` redirects `/` → `/debate`
- CORS disabled in production (same-origin), enabled in dev mode
- Static files resolved from `@hod/aweave-debate-web/dist/` via `require.resolve()` — works both in dev (workspace) and published (node_modules)

See: `resources/workspaces/devtools/common/server/OVERVIEW.md`

### Process Management (CLI)

Server is managed via CLI commands (`@hod/aweave-plugin-server`). Replaces PM2 — uses native `child_process.spawn` with detached mode.

```bash
aw server start [--open] [--port 3456]   # Start daemon, poll health, optionally open browser
aw server stop                            # SIGTERM → SIGKILL fallback
aw server status                          # PID, port, uptime
aw server restart                         # stop + start
aw server logs [-n 50]                    # Tail ~/.aweave/logs/server.log
```

State file: `~/.aweave/server.json` | Log file: `~/.aweave/logs/server.log`

See: `resources/workspaces/devtools/common/cli-plugin-server/OVERVIEW.md`

### MCP Response Format

All CLI commands output responses in a structured format designed for AI agent consumption:

```json
{
  "success": true,
  "content": [{ "type": "json", "data": { ... } }],
  "metadata": { ... },
  "has_more": false,
  "total_count": 10
}
```

## Publishing to npm

All packages are published to npm under `@hod/` scope. pnpm automatically rewrites `workspace:*` → actual versions and publishes in dependency order.

```bash
# Build → generate manifest → bump all → publish
pnpm -r build
cd common/cli && pnpm exec oclif manifest && cd ../..
pnpm -r exec -- npm version patch --no-git-tag-version
pnpm -r publish --access public --no-git-checks
```

**Version bump chain:** When a leaf package changes (e.g. `@hod/aweave-cli-shared`), all dependents must also bump (e.g. `cli-plugin-debate` → `cli`). pnpm pins exact versions at publish time.

**End user install:**
```bash
npx @hod/aweave server start --open     # No install needed
npm install -g @hod/aweave               # Or install globally
```

## Development Approach

### Adding a New CLI Plugin

1. Create `@hod/aweave-plugin-<name>` package at `workspaces/devtools/<domain>/cli-plugin-<name>/`
2. Add commands under `src/commands/<topic>/` (file path = command name)
3. Add to `workspaces/devtools/pnpm-workspace.yaml`
4. Add as dependency in `workspaces/devtools/common/cli/package.json`:
   ```json
   "@hod/aweave-plugin-<name>": "workspace:*"
   ```
5. Add to `oclif.plugins` array in `workspaces/devtools/common/cli/package.json`
6. `pnpm install && pnpm -r build`

### Adding an Ink-based (Interactive UI) Plugin

For plugins with interactive terminal UI using Ink v6 + React 19, the plugin **must be ESM** (`"type": "module"`) and follows a different pattern from standard CJS plugins.

**Full guide:** `resources/workspaces/devtools/common/cli-plugin-dashboard/OVERVIEW.md`

### Adding a New Backend Feature

1. Create NestJS module package at `workspaces/devtools/<domain>/nestjs-<feature>/`
2. Export NestJS module from the package
3. Add as dependency of `@hod/aweave-server`
4. Import in `server/src/app.module.ts`
5. See: `resources/workspaces/devtools/common/server/OVERVIEW.md` for full pattern

## Package Management

- **pnpm workspaces** — All packages managed from `devtools/` root
- **`pnpm-workspace.yaml`** — Declares all workspace packages + version catalog
- **`workspace:*`** — Internal dependency protocol (always resolves to local package)
- **`catalog:`** — Shared version definitions in `pnpm-workspace.yaml` (e.g. TypeScript, React, NestJS versions)

### Dependency Graph (no cycles)

```
@hod/aweave
  ├── @hod/aweave-cli-shared
  ├── @hod/aweave-plugin-debate ──► @hod/aweave-cli-shared + @hod/aweave-debate-machine
  ├── @hod/aweave-plugin-docs ──► @hod/aweave-cli-shared
  ├── @hod/aweave-plugin-dashboard ──► @hod/aweave-cli-shared + @hod/aweave-node-shared + ink + react (ESM)
  ├── @hod/aweave-plugin-server ──► @hod/aweave-cli-shared + @hod/aweave-server
  ├── @hod/aweave-plugin-config ──► @hod/aweave-cli-shared + @hod/aweave-config-core + @hod/aweave-node-shared
  └── @hod/aweave-plugin-<name> ──► @hod/aweave-cli-shared

@hod/aweave-server
  ├── @hod/aweave-nestjs-debate ──► @hod/aweave-debate-machine
  └── @hod/aweave-debate-web (static SPA files resolved via require.resolve)

@hod/aweave (nab domain plugins)
  ├── @hod/aweave-plugin-nab-auth ──► @hod/aweave-cli-shared + @hod/aweave-playwright
  ├── @hod/aweave-plugin-nab-clm ──► @hod/aweave-cli-shared + @hod/aweave-nab-config + @hod/aweave-playwright
  ├── @hod/aweave-plugin-nab-opensearch ──► @hod/aweave-cli-shared + @hod/aweave-nab-opensearch-client
  ├── @hod/aweave-plugin-nab-opensearch-trace ──► @hod/aweave-cli-shared + @hod/aweave-nab-opensearch-client
  └── @hod/aweave-plugin-nab-confluence ──► @hod/aweave-cli-shared + cheerio

@hod/aweave-nab-opensearch-client ──► @hod/aweave-config-core + @hod/aweave-nab-config
```

## Quick Reference

| Task | Command |
|------|---------|
| Install all | `cd workspaces/devtools && pnpm install` |
| Build all | `cd workspaces/devtools && pnpm -r build` |
| Build specific | `cd workspaces/devtools/common/<pkg> && pnpm build` |
| Run CLI (dev) | `cd workspaces/devtools/common/cli && bin/dev.js <command>` |
| Run CLI (global) | `aw <command>` |
| Run CLI (npx) | `npx @hod/aweave <command>` |
| Link CLI globally | `cd workspaces/devtools/common/cli && pnpm link --global` |
| Start server | `aw server start [--open]` |
| Stop server | `aw server stop` |
| Server status | `aw server status` |
| Server logs | `aw server logs` |
| Health check | `curl http://127.0.0.1:3456/health` |
| Debate Web UI | `http://127.0.0.1:3456/debate/` |
| Publish all | `pnpm -r publish --access public --no-git-checks` |

## Package Documentation

Each package has its own OVERVIEW at:

**Common packages:**
- **CLI entrypoint:** `resources/workspaces/devtools/common/cli/OVERVIEW.md`
- **CLI shared library:** `resources/workspaces/devtools/common/cli-shared/OVERVIEW.md`
- **CLI plugins:** `resources/workspaces/devtools/common/cli-plugin-<name>/OVERVIEW.md`
- **Server plugin:** `resources/workspaces/devtools/common/cli-plugin-server/OVERVIEW.md`
- **Dashboard plugin (Ink v6):** `resources/workspaces/devtools/common/cli-plugin-dashboard/OVERVIEW.md`
- **Server:** `resources/workspaces/devtools/common/server/OVERVIEW.md`
- **Debate Web:** `resources/workspaces/devtools/common/debate-web/OVERVIEW.md`
- **NestJS modules:** `resources/workspaces/devtools/common/nestjs-<name>/OVERVIEW.md`

**NAB domain packages:** `resources/workspaces/devtools/nab/OVERVIEW.md` (domain overview)
- **Auth plugin:** `resources/workspaces/devtools/nab/plugin-nab-auth/OVERVIEW.md`
- **CLM plugin:** `resources/workspaces/devtools/nab/plugin-nab-clm/OVERVIEW.md`
- **OpenSearch search plugin:** `resources/workspaces/devtools/nab/plugin-nab-opensearch/OVERVIEW.md`
- **OpenSearch trace plugin:** `resources/workspaces/devtools/nab/plugin-nab-opensearch-trace/OVERVIEW.md`
- **OpenSearch client:** `resources/workspaces/devtools/nab/nab-opensearch-client/OVERVIEW.md`
- **Config (NAB defaults):** `resources/workspaces/devtools/nab/nab-config/OVERVIEW.md`
