# DevTools

Unified TypeScript CLI + server + web UI for development workflow automation.

## For Users

### Install & Run (npx — no install needed)

```bash
# Start server + open debate web UI
npx @hod/aweave server start --open

# Or install globally
npm install -g @hod/aweave
aw server start --open
```

### Available Commands

```bash
# Server management
aw server start [--open] [--port 3456]   # Start server daemon
aw server stop                            # Stop server
aw server status                          # Show PID, port, uptime
aw server restart                         # Restart server
aw server logs [-n 50]                    # View server logs

# Debate
aw debate create --debate-id <uuid> --title "..." --type general_debate --content "..."
aw debate list
aw debate submit --debate-id <uuid> --role proposer --type CLAIM --content "..."

# Other tools
aw docs create ...                        # Document management
aw config sync                            # Config synchronization
aw dashboard                              # Interactive terminal UI
aw version                                # Show version
```

### What It Does

- **Server** starts on `http://127.0.0.1:3456` (1 process, 1 port)
- **Debate Web UI** at `http://127.0.0.1:3456/debate/` — monitor AI agent debates in real-time
- **REST API** at `/debates`, `/health` — create/manage debates programmatically
- **WebSocket** at `/ws` — real-time debate updates
- **Swagger UI** at `/api-docs` (dev mode)

---

## For Contributors

### Prerequisites

- Node.js >= 20
- pnpm (`npm install -g pnpm`)

### Setup

```bash
cd devtools
pnpm install          # Install all workspace dependencies
pnpm -r build         # Build all packages
```

### Development Workflow

```bash
# Link CLI globally for development
cd common/cli && pnpm link --global

# Now `aw` command is available system-wide (uses local source)
aw server start
aw debate list

# Start debate-web dev server (HMR + proxy to NestJS on port 3456)
cd common/debate-web && pnpm dev     # http://localhost:3457

# Build specific package
cd common/<package> && pnpm build

# Build all
cd devtools && pnpm -r build
```

### Project Structure

```
devtools/
├── common/                          # Shared packages
│   ├── cli/                         # @hod/aweave — oclif entrypoint, `aw` binary
│   ├── cli-shared/                  # @hod/aweave-cli-shared — HTTP client, output helpers
│   ├── cli-plugin-debate/           # aw debate *
│   ├── cli-plugin-docs/             # aw docs *
│   ├── cli-plugin-server/           # aw server * (start/stop/status/restart/logs)
│   ├── cli-plugin-dashboard/        # aw dashboard (Ink terminal UI)
│   ├── cli-plugin-config/           # aw config *
│   ├── cli-plugin-relay/            # aw relay *
│   ├── server/                      # @hod/aweave-server — NestJS (API + WebSocket + static SPA)
│   ├── nestjs-debate/               # @hod/aweave-nestjs-debate — debate backend module
│   ├── debate-web/                  # @hod/aweave-debate-web — React SPA (Rsbuild)
│   ├── debate-machine/              # @hod/aweave-debate-machine — debate state machine
│   ├── workflow-engine/             # @hod/aweave-workflow-engine — xstate workflow engine
│   ├── workflow-dashboard/          # @hod/aweave-workflow-dashboard — Ink workflow UI
│   ├── config-core/                 # @hod/aweave-config-core — config loader
│   └── config/                      # @hod/aweave-config-common — shared config
├── pnpm-workspace.yaml              # Workspace package list + version catalog
├── package.json                     # Root scripts (build, lint, publish)
└── scripts/
    └── build-release.sh             # Build + generate oclif manifest
```

### Publishing to Artifactory

All workspace packages are published to Artifactory under `@hod/` scope with a **unified version** (set in root `package.json`). The release script handles build, version bump, and publish automatically.

```bash
# Bump patch + publish (default)
pnpm run release

# Bump minor / major
pnpm run release:minor
pnpm run release:major

# Dry-run (build + bump, no publish)
pnpm run release:dry-run
```

**Version strategy:** All packages share a single version. The release script bumps root `package.json` and syncs to all workspace packages before publishing.

### Architecture

```
User: npx @hod/aweave server start --open
  │
  ├─ npm installs @hod/aweave + all @hod/* dependencies
  ├─ CLI resolves @hod/aweave-server/dist/main.js via require.resolve()
  ├─ Spawns detached Node.js process (daemon)
  ├─ NestJS server starts on port 3456:
  │   ├─ /debates, /ws         → REST API + WebSocket (from @hod/aweave-nestjs-debate)
  │   ├─ /debate/*             → Static SPA files (from @hod/aweave-debate-web/dist/)
  │   ├─ /health               → Health check
  │   └─ /                     → Redirect to /debate
  └─ Opens browser at http://127.0.0.1:3456/debate/
```

## Documentation

- **Full architecture:** `devdocs/misc/devtools/OVERVIEW.md`
- **Server:** `devdocs/misc/devtools/common/server/OVERVIEW.md`
- **Debate Web:** `devdocs/misc/devtools/common/debate-web/OVERVIEW.md`
- **CLI plugins:** `devdocs/misc/devtools/common/cli-plugin-<name>/OVERVIEW.md`
- **Plans:** `devdocs/misc/devtools/common/_plans/`
