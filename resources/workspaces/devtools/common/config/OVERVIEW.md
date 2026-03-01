---
name: Config Common
description: Default configuration schema, YAML files, and environment override maps for the common devtools domain
tags: []
---

# Config Common (`@hod/aweave-config-common`)

> **Source:** `workspaces/devtools/common/config/`

Centralizes default configuration specifications for the `common` devtools domain. Works in conjunction with `@hod/aweave-config-core` to provide safe, predictable configuration resolution across CLI and server packages.

## Purpose

Instead of scattering default values across distinct CLI plugins or the backend server, this package provides a single source of truth for defaults, schema validation, and environment variable override mapping.

## Key Exports

| Export | Description |
|--------|-------------|
| `DEFAULT_CONFIG_DIR` | Absolute path to the `defaults/` directory |
| `DOMAIN` | Domain name (`"common"`) for `~/.aweave/config/common/` resolution |
| `DEFAULT_CONFIG_FILES` | List of YAML files: `server.yaml`, `debate-web.yaml`, `cli.yaml` |
| `CONFIG_SCHEMAS` | Per-config validation schemas (`server`, `debate-web`, `cli`) |
| `SERVER_ENV_OVERRIDES` | Env var map for `server.yaml` |
| `DEBATE_WEB_ENV_OVERRIDES` | Env var map for `debate-web.yaml` |
| `CLI_ENV_OVERRIDES` | Env var map for `cli.yaml` |

## Config Files

### `defaults/server.yaml`

NestJS server configuration: port, host, database paths.

### `defaults/debate-web.yaml`

Next.js debate web UI configuration: port, API base URL.

### `defaults/cli.yaml`

CLI plugin configuration. Key sections:

```yaml
services:
  server:
    port: 3456
    healthUrl: "http://127.0.0.1:3456/health"
  debateWeb:
    port: 3457
    healthUrl: "http://127.0.0.1:3457"
  forwarder:
    enabled: false        # reserved for future auto-start
    listenHost: "127.0.0.1"
    listenPort: 3845
    targetHost: "127.0.0.1"
    targetPort: 3456
```

## Forwarder Config Schema

The `services.forwarder` section configures defaults for `aw server forward` commands.

| Field | Type | Default | Env Override |
|-------|------|---------|--------------|
| `services.forwarder.enabled` | boolean | `false` | `AWEAVE_FORWARDER_ENABLED` |
| `services.forwarder.listenHost` | string | `127.0.0.1` | `AWEAVE_FORWARDER_LISTEN_HOST` |
| `services.forwarder.listenPort` | number | `3845` | `AWEAVE_FORWARDER_LISTEN_PORT` |
| `services.forwarder.targetHost` | string | `127.0.0.1` | `AWEAVE_FORWARDER_TARGET_HOST` |
| `services.forwarder.targetPort` | number | `3456` | `AWEAVE_FORWARDER_TARGET_PORT` |

> `enabled` is reserved for future auto-start hooks. Manual `aw server forward start` always runs regardless of this value.

## Default Resolution Order

For any `aw server forward` command:

1. Explicit CLI flags (`--listen-port`, `--target-port`, etc.)
2. Environment variables (`AWEAVE_FORWARDER_*`)
3. User config (`~/.aweave/config/common/cli.yaml`)
4. Repository defaults (`workspaces/devtools/common/config/defaults/cli.yaml`)
5. Hardcoded fallback (if config package unavailable)

## Structure Guidelines

- **Sensitive values**: API tokens and secrets are excluded — use environment variables directly.
- **Exposure control**: `clientPublic` keys are safe for browser (Next.js) extrapolation; `server` keys remain backend-only.

## Development

```bash
cd workspaces/devtools/common/config
pnpm build
```

> Must be built before `@hod/aweave-cli-shared` and all CLI plugin packages.

## Related

- **Config Core:** `workspaces/devtools/common/config-core/` (`@hod/aweave-config-core`) — `loadConfig()`, `validateConfig()`
- **CLI Shared:** `workspaces/devtools/common/cli-shared/` — consumes this package for server and forwarder defaults
- **Forwarder Commands:** `workspaces/devtools/common/cli-plugin-server/src/commands/server/forward/`
