---
name: CLI Plugin Server
description: oclif plugin providing server lifecycle management and TCP forwarder commands for the aweave-server daemon
tags: []
---

# CLI Plugin: Server (`@hod/aweave-plugin-server`)

> **Source:** `workspaces/devtools/common/cli-plugin-server/`

oclif plugin providing server lifecycle management and TCP forwarder commands. Replaces PM2 for managing the aweave-server daemon.

## Purpose

- Start/stop NestJS server as a background daemon
- Health check monitoring
- Log file access
- TCP port forwarding (e.g. expose `3845 → 3456` for dual-port MCP access)
- No PM2 dependency — uses native Node.js `child_process.spawn` with detached mode

## Commands

### Server Lifecycle

| Command | Description |
|---------|-------------|
| `aw server start` | Start server daemon, show PID + port |
| `aw server stop` | Stop server daemon (SIGTERM → SIGKILL fallback) |
| `aw server status` | Show running/stopped, PID, port, uptime |
| `aw server restart` | Stop + start |
| `aw server logs` | Show last N lines of server log |

### TCP Forwarder

| Command | Description |
|---------|-------------|
| `aw server forward start` | Start a TCP forwarder as a background process |
| `aw server forward status` | Show status of one or all forwarders |
| `aw server forward stop` | Stop a forwarder gracefully (SIGTERM, optional `--force` SIGKILL) |
| `aw server forward kill` | Immediately SIGKILL a forwarder |

## Server Commands

### `aw server start`

```bash
aw server start               # Start on default port 3456
aw server start --port 4000   # Custom port
aw server start --open        # Start + open browser at /debate
```

**Lifecycle:**

1. Check for existing running server → refuse if already healthy (idempotent)
2. Detect stale PID file → clean up and proceed
3. Check port availability → refuse if occupied
4. Spawn `node @hod/aweave-server/dist/main.js` as detached process
5. Poll health endpoint (`/health`) until ready (10s timeout)
6. Write state file to `~/.aweave/server.json`

### `aw server stop`

```bash
aw server stop
```

**Lifecycle:**

1. Read PID from `~/.aweave/server.json`
2. Send SIGTERM → wait up to 5s → SIGKILL if needed
3. Verify process gone → clear state file

### `aw server status`

```bash
aw server status
```

Shows: status (running/stopped/unhealthy), PID, port, uptime, version.

### `aw server logs`

```bash
aw server logs           # Last 50 lines
aw server logs -n 100    # Last 100 lines
```

## TCP Forwarder Commands

The forwarder runs as a lightweight Node.js TCP proxy (no external tools required). It is **completely isolated** from `aw server` lifecycle — separate state directory, separate log files.

### `aw server forward start`

```bash
aw server forward start                                          # Uses config defaults (3845 → 3456)
aw server forward start --listen-port 3845 --target-port 3456   # Explicit
aw server forward start --listen-host 0.0.0.0                   # Bind to all interfaces
```

**Flags:** `--listen-port` (default 3845), `--listen-host` (default 127.0.0.1), `--target-port` (default 3456), `--target-host` (default 127.0.0.1), `--format json|markdown`

**Behavior:**

- Idempotent: if the same port is already forwarding, returns success immediately
- Detects port conflicts with unrelated processes and refuses
- Writes `~/.aweave/forwarders/forwarder-<port>.json`
- Logs to `~/.aweave/logs/forwarder-<port>.log`

### `aw server forward status`

```bash
aw server forward status                       # List all forwarders
aw server forward status --listen-port 3845    # Show specific forwarder
```

**Sample output:**

```json
{
  "status": "running",
  "listen_host": "127.0.0.1",
  "listen_port": 3845,
  "target_host": "127.0.0.1",
  "target_port": 3456,
  "pid": 12345,
  "started_at": "2026-03-01T10:00:00.000Z",
  "uptime": "0h 5m 12s",
  "log_file": "~/.aweave/logs/forwarder-3845.log",
  "state_file": "~/.aweave/forwarders/forwarder-3845.json"
}
```

Status values: `running`, `stopped`, `stale` (process died but state file present).

### `aw server forward stop`

```bash
aw server forward stop --listen-port 3845           # Graceful SIGTERM
aw server forward stop --listen-port 3845 --force   # SIGTERM → SIGKILL fallback
aw server forward stop --all                        # Stop all known forwarders
```

### `aw server forward kill`

```bash
aw server forward kill --listen-port 3845   # Immediate SIGKILL
aw server forward kill --all                # Kill all known forwarders
```

## State & Log Files

| File | Path | Description |
|------|------|-------------|
| Server state | `~/.aweave/server.json` | PID, port, startedAt, version |
| Server log | `~/.aweave/logs/server.log` | Server stdout/stderr |
| Forwarder state | `~/.aweave/forwarders/forwarder-<port>.json` | PID, mapping, startedAt |
| Forwarder log | `~/.aweave/logs/forwarder-<port>.log` | Worker stdout/stderr |

**Forwarder state file format:**

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

## Architecture

```
@hod/aweave-plugin-server
  ├── @hod/aweave-cli-shared (process-manager.ts)
  │     ├── startServer()       → spawn detached + health check
  │     ├── stopServer()        → SIGTERM/SIGKILL + cleanup
  │     ├── getServerStatus()   → PID check + health endpoint
  │     ├── restartServer()     → stop + start
  │     └── readLogTail()       → read last N lines of log
  │
  └── @hod/aweave-cli-shared (forwarder-manager.ts)
        ├── startForwarder()      → spawn detached worker
        ├── stopForwarder()       → SIGTERM/SIGKILL + cleanup
        ├── killForwarder()       → immediate SIGKILL
        ├── getForwarderStatus()  → PID + state check
        └── listForwarders()      → read all state files
```

## Project Structure

```
cli-plugin-server/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                    # oclif plugin entry
    └── commands/server/
        ├── start.ts                # aw server start
        ├── stop.ts                 # aw server stop
        ├── status.ts               # aw server status
        ├── restart.ts              # aw server restart
        ├── logs.ts                 # aw server logs
        └── forward/
            ├── start.ts            # aw server forward start
            ├── status.ts           # aw server forward status
            ├── stop.ts             # aw server forward stop
            └── kill.ts             # aw server forward kill
```

## Dependencies

| Package | Role |
|---------|------|
| `@hod/aweave-cli-shared` | Process manager, forwarder manager, output helpers |
| `@oclif/core` | CLI framework |

## Development

```bash
cd workspaces/devtools/common/cli-plugin-server
pnpm build
```

## Related

- **Process Manager:** `workspaces/devtools/common/cli-shared/src/services/process-manager.ts`
- **Forwarder Manager:** `workspaces/devtools/common/cli-shared/src/services/forwarder-manager.ts`
- **Forwarder Worker:** `workspaces/devtools/common/cli-shared/src/services/tcp-forwarder-worker.ts`
- **Server:** `workspaces/devtools/common/server/`
- **CLI Root:** `workspaces/devtools/common/cli/`
- **DevTools Overview:** `resources/workspaces/devtools/OVERVIEW.md`
