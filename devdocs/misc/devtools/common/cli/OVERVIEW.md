# Unified CLI Entrypoint (`@aweave/cli`)

> **Source:** `devtools/common/cli/`
> **Last Updated:** 2026-02-07

oclif-based main CLI application — provides the global `aw` command. This package **contains no business logic** — it only bootstraps oclif, declares plugins, and provides shared infrastructure (help). All domain commands come from plugins.

## Purpose

- **Single Entrypoint:** `aw <command>` — one binary for the entire devtools CLI
- **Plugin Composition:** Declares and auto-loads domain plugins via the oclif plugin system
- **Global Install:** Installed via `pnpm link --global`, available system-wide
- **Extensible:** Adding a new domain = create `@aweave/cli-plugin-<name>`, add to oclif config

**Why oclif?** `aw` is a platform CLI serving multiple domains (e.g. `common/`, `nab/`, future domains). oclif provides:
1. Standard plugin system — auto-discovery, no manual require/catch
2. File-based command routing — `commands/debate/create.ts` → `aw debate create`
3. Built-in help, flag validation, topic grouping
4. Manifest caching for fast startup

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       @aweave/cli                              │
│                    (oclif Application)                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  bin/run.js ──► @oclif/core.execute()                        │
│                       │                                      │
│                       ├── Built-in commands (version)         │
│                       │                                      │
│                       ├── @aweave/cli-plugin-debate           │
│                       │   └── aw debate *                     │
│                       │                                      │
│                       ├── @aweave/cli-plugin-docs             │
│                       │   └── aw docs *                       │
│                       │                                      │
│                       └── @aweave/cli-plugin-<name>           │
│                           └── aw <name> *                     │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  @oclif/plugin-help — auto-generated help for all commands    │
└──────────────────────────────────────────────────────────────┘
```

**Plugin loading flow:**
1. `bin/run.js` calls `@oclif/core.execute()`
2. oclif reads `oclif.plugins` from `package.json`
3. Each plugin's `dist/commands/` is scanned for Command classes
4. Commands are registered based on file path (directory = topic, file = command)

## Dependencies

| Package | Role |
|---------|------|
| `@oclif/core` | oclif framework (command parsing, plugin loading) |
| `@oclif/plugin-help` | Auto-generated help text |
| `@aweave/cli-shared` | Shared utilities (MCP, HTTP, helpers) |
| `@aweave/cli-plugin-*` | Domain command plugins (workspace dependencies) |

**devDependencies:** `oclif` (CLI for manifest generation), `ts-node`, `typescript`

**Dependency graph (no cycles):**
```
@aweave/cli
  ├── @aweave/cli-shared
  ├── @aweave/cli-plugin-debate ──► @aweave/cli-shared
  ├── @aweave/cli-plugin-docs ──► @aweave/cli-shared
  └── @aweave/cli-plugin-<name> ──► @aweave/cli-shared
```

## Configuration

### oclif Config (package.json)

```json
{
  "oclif": {
    "bin": "aw",
    "dirname": "aweave",
    "commands": "./dist/commands",
    "topicSeparator": " ",
    "plugins": [
      "@aweave/cli-plugin-debate",
      "@aweave/cli-plugin-docs",
      "@aweave/cli-plugin-<name>"
    ]
  }
}
```

| Field | Value | Description |
|-------|-------|-------------|
| `bin` | `aw` | Binary name |
| `dirname` | `aweave` | Config/cache directory name |
| `commands` | `./dist/commands` | Built-in commands directory |
| `topicSeparator` | `" "` (space) | `aw debate create` (not `aw debate:create`) |
| `plugins` | array | Plugins to load at startup |

### Adding a New Plugin

1. Create `@aweave/cli-plugin-<name>` package (see plugin OVERVIEW files for pattern)
2. Add to `devtools/pnpm-workspace.yaml`
3. Add dependency in this package's `package.json`:
   ```json
   "@aweave/cli-plugin-<name>": "workspace:*"
   ```
4. Add to `oclif.plugins` array in this package's `package.json`
5. `pnpm install && pnpm build`

## Project Structure

```
devtools/common/cli/
├── package.json                    # @aweave/cli — oclif config, plugin declarations
├── tsconfig.json
├── bin/
│   ├── run.js                     # Production entrypoint (#!/usr/bin/env node)
│   └── dev.js                     # Dev entrypoint (ts-node)
├── src/
│   └── commands/
│       └── version.ts             # Built-in: aw version
└── dist/                          # Build output
```

## Global Installation

```bash
cd devtools/common/cli

# Build (after building cli-shared and all plugins first)
pnpm build

# Link globally — creates "aw" in pnpm global bin
pnpm link --global

# Verify
which aw                    # → ~/Library/pnpm/aw
aw --help                   # Shows all topics and commands
```

**pnpm global bin path:** `~/Library/pnpm` (macOS). Must be in `$PATH`.

## Development

```bash
# Build order (dependency chain):
cd devtools/common/cli-shared && pnpm build        # 1. Shared utilities
cd devtools/common/cli-plugin-debate && pnpm build  # 2. Plugins (parallel OK)
cd devtools/common/cli-plugin-docs && pnpm build
cd devtools/common/cli && pnpm build                # 3. Main CLI (last)

# Or from workspace root:
cd devtools && pnpm -r build   # Builds all packages (respects dependency order)

# Dev mode (run without building):
cd devtools/common/cli && bin/dev.js debate generate-id
```

## Related

- **Shared Utilities:** `devtools/common/cli-shared/`
- **Shared Overview:** `devdocs/misc/devtools/common/cli-shared/OVERVIEW.md`
- **Debate Plugin:** `devtools/common/cli-plugin-debate/`
- **Debate Plugin Overview:** `devdocs/misc/devtools/common/cli-plugin-debate/OVERVIEW.md`
- **Docs Plugin:** `devtools/common/cli-plugin-docs/`
- **Docs Plugin Overview:** `devdocs/misc/devtools/common/cli-plugin-docs/OVERVIEW.md`
- **Architecture Plan:** `devdocs/misc/devtools/plans/260207-cli-oclif-refactor.md`
- **Global DevTools Overview:** `devdocs/misc/devtools/OVERVIEW.md`
