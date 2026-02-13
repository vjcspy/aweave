# DevTools Overview

> **Branch:** master
> **Last Updated:** 2026-02-13

## TL;DR

Unified TypeScript monorepo with a single CLI entrypoint `aw <command>` (linked globally from this repo). All tools built with Node.js: CLI (oclif), server (NestJS), frontend (React SPA via Rsbuild). Organized with domain-first folder structure, pnpm workspaces for package management, CLI for process management. All packages published to npm under `@aweave/` scope — end users can run via `npx @aweave/cli` without pulling the repo.

## Purpose & Bounded Context

- **Role:** Provide unified CLI toolset and backend services for the entire development workflow
- **Domain:** Developer Experience, Automation, Local Development Infrastructure

## Design Philosophy

### Core Principles

1. **Single Entrypoint** — All tools accessed via `aw <command>`
2. **Domain-First Organization** — Folder structure by domain, not by tool type
3. **TypeScript Everywhere** — CLI, server, frontend — all TypeScript
4. **oclif Plugin System** — Each domain ships commands as an oclif plugin (`@aweave/cli-plugin-<name>`), auto-discovered at startup
5. **Modular Backend** — Each feature is a NestJS module in its own pnpm package, imported by a single unified server
6. **Single Process, Single Port** — NestJS server serves API + WebSocket + static SPA on port 3456
7. **npm Publishable** — All packages published to `@aweave/` npm scope, installable via `npx` or `npm install -g`

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Terminal / AI Agent                   │
│                         │                                    │
│                 aw server start --open                        │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────┐             │
│  │              @aweave/cli (oclif)             │             │
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
│  │ @aweave/server │  │  External APIs   │                     │
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
devtools/
├── common/                          # Shared tools & core infrastructure
│   ├── cli/                         # @aweave/cli — oclif app, plugin declarations, `aw` binary
│   ├── cli-shared/                  # @aweave/cli-shared — MCP format, HTTP client, process manager
│   ├── cli-plugin-debate/           # @aweave/cli-plugin-debate — aw debate *
│   ├── cli-plugin-docs/             # @aweave/cli-plugin-docs — aw docs *
│   ├── cli-plugin-dashboard/        # @aweave/cli-plugin-dashboard — aw dashboard * (Ink v6, ESM)
│   ├── cli-plugin-server/           # @aweave/cli-plugin-server — aw server * (start/stop/status)
│   ├── cli-plugin-config/           # @aweave/cli-plugin-config — aw config *
│   ├── cli-plugin-relay/            # @aweave/cli-plugin-relay — aw relay *
│   ├── server/                      # @aweave/server — unified NestJS server (API + WS + static SPA)
│   ├── nestjs-debate/               # @aweave/nestjs-debate — debate backend module
│   ├── debate-web/                  # @aweave/debate-web — React SPA (Rsbuild, served at /debate)
│   ├── debate-machine/              # @aweave/debate-machine — debate state machine (xstate)
│   ├── workflow-engine/             # @aweave/workflow-engine — workflow state machine
│   ├── workflow-dashboard/          # @aweave/workflow-dashboard — Ink terminal UI for workflows
│   ├── config-core/                 # @aweave/config-core — config file loader
│   └── config/                      # @aweave/config-common — shared config defaults
├── <domain>/                        # Domain-specific tools (e.g. nab/)
│   ├── cli-plugin-<name>/           # oclif plugin for this domain
│   └── local/                       # Local dev infrastructure
├── tinybots/                        # Domain: TinyBots
│   ├── cli-plugin-bitbucket/         # @aweave/cli-plugin-tinybots-bitbucket — aw tinybots-bitbucket *
│   ├── local/                       # TinyBots local DB tools (seed, prisma)
│   └── playwright/                  # TinyBots playwright tests/scripts
├── pnpm-workspace.yaml              # Workspace package declarations + version catalog
├── package.json                     # Root workspace scripts
├── scripts/
│   └── build-release.sh             # Build + generate oclif manifest
└── .npmrc                           # pnpm config
```

## Core Components

### CLI (`@aweave/cli` — oclif)

- **oclif application** (`common/cli/`): Bootstraps oclif, declares plugins, provides `aw` binary
- **Shared library** (`common/cli-shared/`): MCP response format, HTTP client, output helpers, process manager — used by all plugins
- **Domain plugins** (`cli-plugin-*`): Each plugin registers commands under its own topic (e.g. `aw debate *`)
- **Plugin loading:** oclif reads `oclif.plugins` from `package.json`, auto-discovers command classes from each plugin's `dist/commands/`
- **Global install:** `pnpm link --global` in `common/cli/` → `aw` command available system-wide
- **npx:** `npx @aweave/cli <command>` works without install (npm resolves all `@aweave/*` deps from registry)

See: `devdocs/misc/devtools/common/cli/OVERVIEW.md`

### Server (`@aweave/server` — NestJS)

- Single unified server at port `3456`, bind to `127.0.0.1` (localhost only)
- Feature modules imported as separate pnpm packages (`@aweave/nestjs-<feature>`)
- Shared infrastructure: bearer token auth guard, exception filter
- REST API + WebSocket support (ws library, path `/ws`)
- **Static SPA serving:** debate-web files served at `/debate/*` via `express.static()` in `main.ts`
- **SPA fallback:** `DebateSpaController` returns `index.html` for non-file routes under `/debate/*`
- **Root redirect:** `RootRedirectController` redirects `/` → `/debate`
- CORS disabled in production (same-origin), enabled in dev mode
- Static files resolved from `@aweave/debate-web/dist/` via `require.resolve()` — works both in dev (workspace) and published (node_modules)

See: `devdocs/misc/devtools/common/server/OVERVIEW.md`

### Process Management (CLI)

Server is managed via CLI commands (`@aweave/cli-plugin-server`). Replaces PM2 — uses native `child_process.spawn` with detached mode.

```bash
aw server start [--open] [--port 3456]   # Start daemon, poll health, optionally open browser
aw server stop                            # SIGTERM → SIGKILL fallback
aw server status                          # PID, port, uptime
aw server restart                         # stop + start
aw server logs [-n 50]                    # Tail ~/.aweave/logs/server.log
```

State file: `~/.aweave/server.json` | Log file: `~/.aweave/logs/server.log`

See: `devdocs/misc/devtools/common/cli-plugin-server/OVERVIEW.md`

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

All packages are published to npm under `@aweave/` scope. pnpm automatically rewrites `workspace:*` → actual versions and publishes in dependency order.

```bash
# Build → generate manifest → bump all → publish
pnpm turbo build
cd common/cli && pnpm exec oclif manifest && cd ../..
pnpm -r exec -- npm version patch --no-git-tag-version
pnpm -r publish --access public --no-git-checks
```

**Version bump chain:** When a leaf package changes (e.g. `@aweave/cli-shared`), all dependents must also bump (e.g. `cli-plugin-debate` → `cli`). pnpm pins exact versions at publish time.

**End user install:**
```bash
npx @aweave/cli server start --open     # No install needed
npm install -g @aweave/cli               # Or install globally
```

## Development Approach

### Adding a New CLI Plugin

1. Create `@aweave/cli-plugin-<name>` package at `devtools/<domain>/cli-plugin-<name>/`
2. Add commands under `src/commands/<topic>/` (file path = command name)
3. Add to `devtools/pnpm-workspace.yaml`
4. Add as dependency in `devtools/common/cli/package.json`:
   ```json
   "@aweave/cli-plugin-<name>": "workspace:*"
   ```
5. Add to `oclif.plugins` array in `devtools/common/cli/package.json`
6. `pnpm install && pnpm turbo build`

### Adding an Ink-based (Interactive UI) Plugin

For plugins with interactive terminal UI using Ink v6 + React 19, the plugin **must be ESM** (`"type": "module"`) and follows a different pattern from standard CJS plugins.

**Full guide:** `devdocs/misc/devtools/common/cli-plugin-dashboard/OVERVIEW.md`

### Adding a New Backend Feature

1. Create NestJS module package at `devtools/<domain>/nestjs-<feature>/`
2. Export NestJS module from the package
3. Add as dependency of `@aweave/server`
4. Import in `server/src/app.module.ts`
5. See: `devdocs/misc/devtools/common/server/OVERVIEW.md` for full pattern

## Package Management

- **pnpm workspaces** — All packages managed from `devtools/` root
- **`pnpm-workspace.yaml`** — Declares all workspace packages + version catalog
- **`workspace:*`** — Internal dependency protocol (always resolves to local package)
- **`catalog:`** — Shared version definitions in `pnpm-workspace.yaml` (e.g. TypeScript, React, NestJS versions)

### Dependency Graph (no cycles)

```
@aweave/cli
  ├── @aweave/cli-shared
  ├── @aweave/cli-plugin-debate ──► @aweave/cli-shared + @aweave/debate-machine
  ├── @aweave/cli-plugin-docs ──► @aweave/cli-shared
  ├── @aweave/cli-plugin-dashboard ──► @aweave/cli-shared + ink + react (ESM)
  ├── @aweave/cli-plugin-server ──► @aweave/cli-shared + @aweave/server
  ├── @aweave/cli-plugin-config ──► @aweave/cli-shared + @aweave/config-core
  ├── @aweave/cli-plugin-tinybots-bitbucket ──► @aweave/cli-shared
  └── @aweave/cli-plugin-<name> ──► @aweave/cli-shared

@aweave/server
  ├── @aweave/nestjs-debate ──► @aweave/debate-machine
  └── @aweave/debate-web (static SPA files resolved via require.resolve)
```

## Quick Reference

| Task | Command |
|------|---------|
| Install all | `cd devtools && pnpm install` |
| Build all | `cd devtools && pnpm turbo build` |
| Build specific | `cd devtools/common/<pkg> && pnpm build` |
| Run CLI (dev) | `cd devtools/common/cli && bin/dev.js <command>` |
| Run CLI (global) | `aw <command>` |
| Run CLI (npx) | `npx @aweave/cli <command>` |
| Link CLI globally | `cd devtools/common/cli && pnpm link --global` |
| Start server | `aw server start [--open]` |
| Stop server | `aw server stop` |
| Server status | `aw server status` |
| Server logs | `aw server logs` |
| Health check | `curl http://127.0.0.1:3456/health` |
| Debate Web UI | `http://127.0.0.1:3456/debate/` |
| Publish all | `pnpm -r publish --access public --no-git-checks` |

## Package Documentation

Each package has its own OVERVIEW at:
- **CLI entrypoint:** `devdocs/misc/devtools/common/cli/OVERVIEW.md`
- **CLI shared library:** `devdocs/misc/devtools/common/cli-shared/OVERVIEW.md`
- **CLI plugins:** `devdocs/misc/devtools/common/cli-plugin-<name>/OVERVIEW.md`
- **Server plugin:** `devdocs/misc/devtools/common/cli-plugin-server/OVERVIEW.md`
- **Dashboard plugin (Ink v6):** `devdocs/misc/devtools/common/cli-plugin-dashboard/OVERVIEW.md`
- **Server:** `devdocs/misc/devtools/common/server/OVERVIEW.md`
- **Debate Web:** `devdocs/misc/devtools/common/debate-web/OVERVIEW.md`
- **NestJS modules:** `devdocs/misc/devtools/common/nestjs-<name>/OVERVIEW.md`
- **Domain-specific:** `devdocs/misc/devtools/<domain>/<package>/OVERVIEW.md`
