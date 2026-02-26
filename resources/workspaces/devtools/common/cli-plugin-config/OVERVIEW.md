---
name: Config CLI Plugin
description: oclif plugin providing configuration management commands — migrating legacy config files and syncing default configs into the centralized user config directory
tags: [cli, config]
---

# Config CLI Plugin (`@hod/aweave-plugin-config`)

> **Branch:** master
> **Last Commit:** 2b6635f
> **Last Updated:** 2026-02-26

## TL;DR

oclif plugin providing `aw config` commands for managing the centralized configuration system. Handles migrating legacy config files into the new structure and syncing default configs into the user config directory (`~/.aweave/config/`).

## Recent Changes Log

Initial Documentation.

## Repo Purpose & Bounded Context

- **Role:** CLI interface for configuration lifecycle management (migration + sync)
- **Domain:** Developer tooling — configuration infrastructure

## Project Structure

```
cli-plugin-config/
├── package.json                      # @hod/aweave-plugin-config
├── tsconfig.json
└── src/
    ├── index.ts                      # (empty — oclif auto-discovers commands)
    ├── commands/
    │   └── config/
    │       ├── migrate.ts            # aw config migrate
    │       └── sync.ts              # aw config sync
    └── lib/
        ├── discovery.ts             # Scan devtools domains for config/defaults/
        └── legacy.ts               # Legacy config file mapping registry
```

## Public Surface (Inbound)

- **`aw config migrate`** — Migrate legacy config files into centralized structure
  - Flags: `--domain` (optional, migrate single domain), `--format`
  - Uses `LEGACY_CONFIG_MAP` registry to locate and migrate legacy files via `@hod/aweave-config-core`
- **`aw config sync`** — Sync default config files into `~/.aweave/config/`
  - Flags: `--domain` (optional), `--force` (overwrite existing), `--format`
  - Auto-discovers domains with `config/defaults/` directories

## Core Services & Logic (Internal)

- **Discovery (`discovery.ts`):** Scans devtools domain directories for `config/defaults/` to find available default configs
- **Legacy registry (`legacy.ts`):** Maps legacy config file locations to new paths per domain

## External Dependencies & Contracts (Outbound)

- **`@hod/aweave-config-core`** — Core config logic: `migrateFromLegacy`, `syncDefaultConfigs`, `getConfigRoot`
- **`@hod/aweave-cli-shared`** — MCPResponse, output helpers
- **`@hod/aweave-node-shared`** — `resolveDevtoolsRoot()`
- **Filesystem:** Reads domain directories, writes to `~/.aweave/config/`

## Related

- **Config Core:** `workspaces/devtools/common/config-core/`
- **Config Package:** `workspaces/devtools/common/config/`
- **Main CLI:** `workspaces/devtools/common/cli/`
