---
name: Node TCP Forwarder Management Commands
description: Add dedicated aw server forward commands to run and manage a Node TCP forwarder (for example 3845 -> 3456) with start, status, stop, and kill, without changing the existing server process manager.
status: new
created: 2026-03-01
tags: [cli, server, networking, config]
---

# 260301 — Node TCP Forwarder Management Commands

## Perspective

The safest implementation is to keep `aw server` lifecycle management unchanged and introduce a separate forwarder manager.
This gives dual-port support (`3456` + `3845`) without changing NestJS server startup logic or touching the existing `process-manager.ts` behavior.
Forwarder defaults must also be integrated with `@hod/aweave-config-common` so listen/target ports can be configured centrally.

## Objective

Provide first-class CLI commands to manage a local Node-based TCP forwarder:

- Start forwarder process (detached)
- Check status
- Stop gracefully
- Kill immediately

Primary use case:

- Keep server on `127.0.0.1:3456`
- Open additional endpoint `127.0.0.1:3845`
- Keep MCP usable on both `/mcp` URLs

## Scope

### In scope

- New forwarder management service in `@hod/aweave-cli-shared`
- New command group under `aw server forward`
- Config integration in `@hod/aweave-config-common` (`defaults/cli.yaml`, schema, env overrides)
- Local state/log tracking for forwarder processes
- Manual verification flow for start/status/kill and dual-port health

### Out of scope

- Any change to `workspaces/devtools/common/cli-shared/src/services/process-manager.ts`
- Any change to NestJS server config model (`server.port` still single-port)
- Reverse proxy/Nginx setup

## Command UX Specification

### `aw server forward start`

Example:

```bash
aw server forward start --listen-port 3845 --target-port 3456 --host 127.0.0.1
```

Flags:

- `--listen-port` (default `3845`)
- `--target-port` (default `3456`)
- `--host` (default `127.0.0.1`)
- `--target-host` (default `127.0.0.1`)
- `--format` (`json|markdown`, default `json`)

Behavior:

- Defaults resolve from config if flags are omitted
- Idempotent for same mapping if process is already healthy
- Fails clearly if listen port is used by unrelated process
- Returns `pid`, mapping, state file path, log file path

### `aw server forward status`

Example:

```bash
aw server forward status --listen-port 3845
```

Flags:

- `--listen-port` (optional; if omitted, returns all forwarders)
- `--format` (`json|markdown`, default `json`)

Behavior:

- Shows running/stopped/stale status
- Includes `pid`, `started_at`, uptime, mapping, and file paths

### `aw server forward stop`

Example:

```bash
aw server forward stop --listen-port 3845
```

Flags:

- `--listen-port` (required unless `--all`)
- `--all` (stop all forwarders)
- `--force` (fallback to SIGKILL after timeout)
- `--format` (`json|markdown`, default `json`)

Behavior:

- Default: SIGTERM + wait timeout
- With `--force`: SIGTERM then SIGKILL if needed
- Cleans state file after successful stop

### `aw server forward kill`

Example:

```bash
aw server forward kill --listen-port 3845
```

Flags:

- `--listen-port` (required unless `--all`)
- `--all`
- `--format` (`json|markdown`, default `json`)

Behavior:

- Immediate SIGKILL
- Intended for stuck forwarder process
- Cleans stale state records

## Technical Design

## Isolation Rule (Critical)

Forwarder management is fully isolated from current server daemon management:

- Existing file remains unchanged: `~/.aweave/server.json`
- New state directory: `~/.aweave/forwarders/`
- New log files: `~/.aweave/logs/forwarder-<listen-port>.log`
- New services/functions and command files only

No changes to current server start/stop/restart/status logic.

## Configuration Integration (Config Package)

Forwarder defaults are loaded from `common/cli.yaml` through `loadConfig()` in cli-shared, same pattern used by server process manager.

Proposed new config section in `workspaces/devtools/common/config/defaults/cli.yaml`:

```yaml
services:
  forwarder:
    enabled: false
    listenHost: "127.0.0.1"
    listenPort: 3845
    targetHost: "127.0.0.1"
    targetPort: 3456
```

Schema updates in `workspaces/devtools/common/config/src/index.ts` (`CONFIG_SCHEMAS.cli.fields`):

- `services.forwarder.enabled` (boolean)
- `services.forwarder.listenHost` (string)
- `services.forwarder.listenPort` (number)
- `services.forwarder.targetHost` (string)
- `services.forwarder.targetPort` (number)

Env override updates in `CLI_ENV_OVERRIDES`:

- `services.forwarder.enabled` -> `AWEAVE_FORWARDER_ENABLED`
- `services.forwarder.listenHost` -> `AWEAVE_FORWARDER_LISTEN_HOST`
- `services.forwarder.listenPort` -> `AWEAVE_FORWARDER_LISTEN_PORT`
- `services.forwarder.targetHost` -> `AWEAVE_FORWARDER_TARGET_HOST`
- `services.forwarder.targetPort` -> `AWEAVE_FORWARDER_TARGET_PORT`

Default resolution order for `aw server forward start`:

1. Explicit CLI flags
2. Environment variables via `CLI_ENV_OVERRIDES`
3. User config `~/.aweave/config/common/cli.yaml`
4. Repository defaults `workspaces/devtools/common/config/defaults/cli.yaml`
5. Hardcoded fallback (only if config package is unavailable)

## Forwarder Process Model

- Worker process is a small Node TCP proxy using `net.createServer()`
- Parent command spawns worker in detached mode
- Stdout/stderr of worker are redirected to forwarder log file
- Worker handles shutdown signals (`SIGTERM`, `SIGINT`) for graceful close

Data flow:

`client:3845 -> forwarder worker -> 127.0.0.1:3456`

## State Model

One state file per listen port:

`~/.aweave/forwarders/forwarder-3845.json`

Proposed schema:

```json
{
  "pid": 12345,
  "listenHost": "127.0.0.1",
  "listenPort": 3845,
  "targetHost": "127.0.0.1",
  "targetPort": 3456,
  "startedAt": "2026-03-01T10:00:00.000Z",
  "version": "0.1.24"
}
```

## File Changes Plan

### `@hod/aweave-cli-shared`

Add:

- `workspaces/devtools/common/cli-shared/src/services/tcp-forwarder-worker.ts`
- `workspaces/devtools/common/cli-shared/src/services/forwarder-manager.ts`

Update:

- `workspaces/devtools/common/cli-shared/src/services/index.ts` (export forwarder APIs)
- `workspaces/devtools/common/cli-shared/src/index.ts` (re-export new service APIs)
- `workspaces/devtools/common/cli-shared/src/services/forwarder-manager.ts` loads defaults from config package (`DEFAULT_CONFIG_DIR`, `DOMAIN`, `CLI_ENV_OVERRIDES`)

### `@hod/aweave-plugin-server`

Add:

- `workspaces/devtools/common/cli-plugin-server/src/commands/server/forward/start.ts`
- `workspaces/devtools/common/cli-plugin-server/src/commands/server/forward/status.ts`
- `workspaces/devtools/common/cli-plugin-server/src/commands/server/forward/stop.ts`
- `workspaces/devtools/common/cli-plugin-server/src/commands/server/forward/kill.ts`

Optional docs update (same PR):

- `resources/workspaces/devtools/common/cli-plugin-server/OVERVIEW.md`

### `@hod/aweave-config-common`

Update:

- `workspaces/devtools/common/config/defaults/cli.yaml` (add `services.forwarder` defaults)
- `workspaces/devtools/common/config/src/index.ts`
  - extend `CONFIG_SCHEMAS.cli.fields`
  - extend `CLI_ENV_OVERRIDES`

## Implementation Phases

### Phase 0 — Config package integration

1. Add `services.forwarder` defaults into `config/defaults/cli.yaml`
2. Add schema fields in `CONFIG_SCHEMAS.cli`
3. Add env mappings in `CLI_ENV_OVERRIDES`
4. Build `@hod/aweave-config-common` and verify no schema/type regressions

### Phase 1 — Forwarder manager in cli-shared

1. Add state/log constants and helper functions (`ensureDirs`, `readState`, `writeState`, `clearState`)
2. Implement process checks (`isProcessAlive`, `isPortInUse`)
3. Implement APIs:
   - `startForwarder()`
   - `getForwarderStatus()`
   - `listForwarders()`
   - `stopForwarder()`
   - `killForwarder()`
4. Export APIs from package barrels

### Phase 2 — Node worker

1. Implement TCP proxy worker with backpressure-safe piping
2. Add signal handlers for clean shutdown
3. Ensure non-zero exit on bind/connect failures

### Phase 3 — CLI commands

1. Add `aw server forward start/status/stop/kill`
2. Follow existing MCP-like output format (`MCPResponse`, `MCPContent`, `ContentType.JSON`)
3. Keep flag conventions aligned with existing `aw server` commands

### Phase 4 — Validation and docs

1. Build packages:
   - `pnpm -C workspaces/devtools/common/config build`
   - `pnpm -C workspaces/devtools/common/cli-shared build`
   - `pnpm -C workspaces/devtools/common/cli-plugin-server build`
   - `pnpm -C workspaces/devtools/common/cli build`
2. Manual verification runbook
3. Update `cli-plugin-server` overview with new subcommands

## Manual Verification Runbook

1. Start base server:
   - `aw server restart --port 3456 --host 127.0.0.1`
2. Start forwarder:
   - `aw server forward start --listen-port 3845 --target-port 3456`
3. Verify config-driven start (no flags):
   - set `services.forwarder.listenPort` in `~/.aweave/config/common/cli.yaml`
   - run `aw server forward start`
   - confirm it uses config value
4. Verify env override precedence:
   - `AWEAVE_FORWARDER_LISTEN_PORT=3945 aw server forward start`
   - confirm env value wins over yaml default
5. Validate dual-port health:
   - `curl http://127.0.0.1:3456/health`
   - `curl http://127.0.0.1:3845/health`
6. Validate MCP endpoint on both:
   - `POST http://127.0.0.1:3456/mcp`
   - `POST http://127.0.0.1:3845/mcp`
7. Validate status:
   - `aw server forward status --listen-port 3845`
8. Validate graceful stop:
   - `aw server forward stop --listen-port 3845`
9. Restart and validate force kill:
   - `aw server forward start --listen-port 3845 --target-port 3456`
   - `aw server forward kill --listen-port 3845`
10. Confirm `aw server status` still works and is unaffected

## Risks and Mitigations

- Port collision on `3845`
  - Mitigation: pre-bind check + clear error message
- Stale PID/state after crash
  - Mitigation: status path auto-detects stale state and reports cleanup hint
- Worker process orphaning
  - Mitigation: state-based PID management + explicit stop/kill commands
- Breaking existing server process flow
  - Mitigation: strict isolation; no edits in `process-manager.ts`

## Acceptance Criteria

- `aw server forward start/status/stop/kill` work on macOS/Linux
- Forwarder can expose `3845 -> 3456` reliably
- MCP and health endpoints are reachable on both ports while running
- Existing `aw server` commands behave exactly as before
- No external dependency (`socat`, nginx, etc.) is required
