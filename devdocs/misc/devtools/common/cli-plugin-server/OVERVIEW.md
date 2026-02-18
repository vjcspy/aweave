# CLI Plugin: Server (`@hod/aweave-plugin-server`)

> **Source:** `devtools/common/cli-plugin-server/`

oclif plugin providing server lifecycle management commands. Replaces PM2 for managing the aweave-server daemon.

## Purpose

- Start/stop NestJS server as a background daemon
- Health check monitoring
- Log file access
- No PM2 dependency — uses native Node.js `child_process.spawn` with detached mode

## Commands

| Command | Description |
|---------|-------------|
| `aw server start` | Start server daemon, show PID + port |
| `aw server stop` | Stop server daemon (SIGTERM → SIGKILL fallback) |
| `aw server status` | Show running/stopped, PID, port, uptime |
| `aw server restart` | Stop + start |
| `aw server logs` | Show last N lines of server log |

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

## State & Log Files

| File | Path | Description |
|------|------|-------------|
| State file | `~/.aweave/server.json` | PID, port, startedAt, version |
| Log file | `~/.aweave/logs/server.log` | Server stdout/stderr |

**State file format:**
```json
{ "pid": 12345, "port": 3456, "startedAt": "2026-02-11T...", "version": "0.1.0" }
```

## Architecture

The process manager is implemented in `@hod/aweave-cli-shared` (`src/services/process-manager.ts`). The CLI plugin is a thin oclif wrapper around the process manager API.

```
@hod/aweave-plugin-server
  └── @hod/aweave-cli-shared (process-manager.ts)
        ├── startServer()    → spawn detached + health check
        ├── stopServer()     → SIGTERM/SIGKILL + cleanup
        ├── getServerStatus() → PID check + health endpoint
        ├── restartServer()  → stop + start
        └── readLogTail()    → read last N lines of log
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
        └── logs.ts                 # aw server logs
```

## Dependencies

| Package | Role |
|---------|------|
| `@hod/aweave-cli-shared` | Process manager, output helpers |
| `@oclif/core` | CLI framework |

## Development

```bash
cd devtools/common/cli-plugin-server
pnpm build
```

## Related

- **Process Manager:** `devtools/common/cli-shared/src/services/process-manager.ts`
- **Server:** `devtools/common/server/`
- **CLI Root:** `devtools/common/cli/`
- **DevTools Overview:** `devdocs/misc/devtools/OVERVIEW.md`
