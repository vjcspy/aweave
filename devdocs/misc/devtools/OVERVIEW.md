# DevTools Overview

> **Branch:** master
> **Last Updated:** 2026-02-07

## TL;DR

Unified TypeScript monorepo with a single CLI entrypoint `aw <command>`. All tools built with Node.js: CLI (oclif), server (NestJS), frontend (Next.js). Organized with domain-first folder structure, pnpm workspaces for package management, pm2 for process management.

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

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Terminal / AI Agent                   │
│                         │                                    │
│                    aw <command>                               │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────┐             │
│  │              @aweave/cli (oclif)             │             │
│  │                      │                      │             │
│  │    @oclif/core.execute()                    │             │
│  │          │                                  │             │
│  │          ├── cli-plugin-debate               │             │
│  │          │   └── aw debate *                 │             │
│  │          ├── cli-plugin-docs                 │             │
│  │          │   └── aw docs *                   │             │
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
│  └───────────────┘                                           │
│                                                              │
│  ┌───────────────┐                                           │
│  │  debate-web   │  (Next.js — WebSocket to server)          │
│  └───────────────┘                                           │
└──────────────────────────────────────────────────────────────┘
```

## Project Structure

```
devtools/
├── common/                          # Shared tools & core infrastructure
│   ├── cli/                         # @aweave/cli — oclif app, plugin declarations
│   ├── cli-shared/                  # @aweave/cli-shared — shared utilities (MCP, HTTP, helpers)
│   ├── cli-plugin-debate/           # @aweave/cli-plugin-debate — aw debate *
│   ├── cli-plugin-docs/             # @aweave/cli-plugin-docs — aw docs *
│   ├── cli-plugin-dashboard/       # @aweave/cli-plugin-dashboard — aw dashboard * (Ink v6, ESM)
│   ├── server/                      # @aweave/server — unified NestJS server
│   ├── nestjs-debate/               # @aweave/nestjs-debate — debate backend module
│   └── debate-web/                  # Next.js debate monitoring UI
├── <domain>/                        # Domain-specific tools (e.g. nab/)
│   ├── cli-plugin-<name>/           # oclif plugin for this domain
│   └── local/                       # Local dev infrastructure
│       ├── docker-compose.yaml
│       ├── Justfile
│       └── .env.example
├── ecosystem.config.cjs             # pm2 config (server + debate-web)
├── pnpm-workspace.yaml              # Workspace package declarations
├── package.json                     # Root workspace scripts
└── .npmrc                           # Build permissions
```

## Core Components

### CLI (`@aweave/cli` — oclif)

- **oclif application** (`common/cli/`): Bootstraps oclif, declares plugins, provides `aw` binary
- **Shared library** (`common/cli-shared/`): MCP response format, HTTP client, output helpers — used by all plugins
- **Domain plugins** (`cli-plugin-*`): Each plugin registers commands under its own topic (e.g. `aw debate *`)
- **Plugin loading:** oclif reads `oclif.plugins` from `package.json`, auto-discovers command classes from each plugin's `dist/commands/`
- **Global install:** `pnpm link --global` in `common/cli/` → `aw` command available system-wide
- **Interactive UI plugins:** `cli-plugin-dashboard` uses Ink v6 (ESM-only, React 19) for terminal UI. This is a reference implementation for Ink + oclif integration — see its OVERVIEW for ESM interop patterns, non-blocking data collection rules, and custom component guide.

See: `devdocs/misc/devtools/common/cli/OVERVIEW.md`

### Server (`@aweave/server` — NestJS)

- Single unified server at port `3456`, bind to `127.0.0.1` (localhost only)
- Feature modules imported as separate pnpm packages (`@aweave/nestjs-<feature>`)
- Shared infrastructure: bearer token auth guard, exception filter, CORS
- REST API + WebSocket support (ws library, path `/ws`)
- The server itself **contains no business logic** — all logic lives in feature modules

See: `devdocs/misc/devtools/common/server/OVERVIEW.md`

### Process Management (pm2)

Services are managed via pm2 using `ecosystem.config.cjs`:

| Service | Package | Port |
|---------|---------|------|
| `aweave-server` | `@aweave/server` | 3456 |
| `debate-web` | Next.js debate UI | 3457 |

```bash
cd devtools
pm2 start ecosystem.config.cjs    # Start all services
pm2 logs                           # View logs
pm2 stop all                       # Stop all
```

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
6. `pnpm install && pnpm -r build`

### Adding an Ink-based (Interactive UI) Plugin

For plugins with interactive terminal UI using Ink v6 + React 19, the plugin **must be ESM** (`"type": "module"`) and follows a different pattern from standard CJS plugins. Key differences:

- ESM package config: `"type": "module"`, `tsconfig: { module: "Node16", jsx: "react-jsx" }`
- CJS dependencies imported via `createRequire(import.meta.url)` instead of `import`
- Ink/React loaded via dynamic `import()` inside command `run()` — not top-level
- No dev mode (ts-node): must `pnpm build` before every test
- All data fetching must be async — `execSync` blocks Ink rendering

**Full guide with code examples, interop patterns, and component reference:** `devdocs/misc/devtools/common/cli-plugin-dashboard/OVERVIEW.md`

### Adding a New Backend Feature

1. Create NestJS module package at `devtools/<domain>/nestjs-<feature>/`
2. Export NestJS module from the package
3. Add as dependency of `@aweave/server`
4. Import in `server/src/app.module.ts`
5. See: `devdocs/misc/devtools/common/server/OVERVIEW.md` for full pattern

## Package Management

- **pnpm workspaces** — All packages managed from `devtools/` root
- **`pnpm-workspace.yaml`** — Declares all workspace packages
- **`workspace:*`** — Internal dependency protocol (always resolves to local package)

### Dependency Graph (no cycles)

```
@aweave/cli
  ├── @aweave/cli-shared
  ├── @aweave/cli-plugin-debate ──► @aweave/cli-shared
  ├── @aweave/cli-plugin-docs ──► @aweave/cli-shared
  ├── @aweave/cli-plugin-dashboard ──► @aweave/cli-shared + ink + react  (ESM)
  └── @aweave/cli-plugin-<name> ──► @aweave/cli-shared

@aweave/server
  └── @aweave/nestjs-debate
```

## Quick Reference

| Task | Command |
|------|---------|
| Install all | `cd devtools && pnpm install` |
| Build all | `cd devtools && pnpm -r build` |
| Build specific | `cd devtools/common/<pkg> && pnpm build` |
| Run CLI (dev) | `cd devtools/common/cli && bin/dev.js <command>` |
| Run CLI (global) | `aw <command>` |
| Link CLI globally | `cd devtools/common/cli && pnpm link --global` |
| Start all services | `cd devtools && pm2 start ecosystem.config.cjs` |
| Start server only | `cd devtools/common/server && node dist/main.js` |
| Health check | `curl http://127.0.0.1:3456/health` |

## Package Documentation

Each package has its own OVERVIEW at:
- **CLI entrypoint:** `devdocs/misc/devtools/common/cli/OVERVIEW.md`
- **CLI shared library:** `devdocs/misc/devtools/common/cli-shared/OVERVIEW.md`
- **CLI plugins:** `devdocs/misc/devtools/common/cli-plugin-<name>/OVERVIEW.md`
- **Dashboard plugin (Ink v6):** `devdocs/misc/devtools/common/cli-plugin-dashboard/OVERVIEW.md` — ESM + Ink integration guide
- **Server:** `devdocs/misc/devtools/common/server/OVERVIEW.md`
- **NestJS modules:** `devdocs/misc/devtools/common/nestjs-<name>/OVERVIEW.md`
- **Domain-specific:** `devdocs/misc/devtools/<domain>/<package>/OVERVIEW.md`
