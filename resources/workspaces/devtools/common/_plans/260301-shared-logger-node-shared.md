---
name: Shared Logger — Move createLogger to node-shared with File Rotation
description: Extract pino logger factory from nestjs-core to node-shared, add date-based file rotation via pino-roll, error-level splitting, MCP-safe console output (stderr), and mandate logger usage in CLI/NestJS builder skills.
status: done
created: 2026-03-01
completed: 2026-03-01
tags: [logging, refactor, cli, nestjs, node-shared]
---

# 260301 — Shared Logger with File Rotation

## References

- `workspaces/devtools/common/nestjs-core/src/logging/logger.factory.ts` — Current `createLogger()` implementation
- `workspaces/devtools/common/nestjs-core/src/logging/nest-logger.service.ts` — NestJS pino wrapper (`import type pino from 'pino'`)
- `workspaces/devtools/common/nestjs-core/src/logging/log-context.service.ts` — AsyncLocalStorage context (stays in nestjs-core)
- `workspaces/devtools/common/nestjs-core/src/index.ts` — Current public API exports
- `workspaces/devtools/common/nestjs-core/package.json` — Current deps: `pino`, `pino-pretty`
- `workspaces/devtools/common/node-shared/package.json` — Target package (currently zero runtime deps)
- `workspaces/devtools/common/node-shared/src/index.ts` — Current exports (paths only)
- `workspaces/devtools/common/mcp-workspace-memory/src/stdio.ts` — MCP stdio entry (stdout concern)
- `workspaces/devtools/common/cli-plugin-workspace/src/commands/workspace/mcp.ts` — CLI MCP command (uses StdioServerTransport)
- `workspaces/devtools/common/server/src/main.ts` — NestJS server bootstrap
- `workspaces/devtools/common/nestjs-dashboard/src/services/logs.service.ts` — Dashboard log reader (reads `server.jsonl`)
- `workspaces/devtools/common/cli-plugin-dashboard/src/lib/file-tail.ts` — CLI dashboard file tailer (reads `server.jsonl`)
- `workspaces/devtools/common/cli-plugin-dashboard/src/hooks/useLogs.ts` — CLI dashboard log hook (filters by `service: 'aweave-server'`)
- `workspaces/devtools/common/cli-shared/src/services/process-manager.ts` — Native process manager (`aw server start/restart/status/logs`)
- `agent/skills/common/devtools-cli-builder/SKILL.md` — CLI builder skill (to update)
- `agent/skills/common/devtools-nestjs-builder/SKILL.md` — NestJS builder skill (to update)

## User Requirements

- Move `createLogger()` from `nestjs-core` to `node-shared` (pure Node, no NestJS deps). `nestjs-core` depends on `node-shared`.
- Always log to file in `~/.aweave/logs/`. Use date-based file rotation — not all logs in a single file.
- Error level splitting: one file for all levels, one file for error-only.
- Keep stdout/console output, but ensure it doesn't corrupt MCP stdio transport (which uses stdout for JSON-RPC messages).
- CLI commands must also use the shared logger.
- Keep `pino-pretty` for dev console output.
- Update `devtools-cli-builder/SKILL.md` and `devtools-nestjs-builder/SKILL.md` to mandate that AI agents MUST use logger for flow tracing and debugging.

## Objective

Create a shared, framework-agnostic pino logger factory in `@hod/aweave-node-shared` that all devtools packages (NestJS server, CLI commands, MCP servers) use for structured logging with file rotation and error splitting.

### Key Considerations

1. **MCP stdio safety:** MCP stdio transport uses `process.stdout` for JSON-RPC messages. Pino console output MUST go to `stderr` (fd 2), not `stdout` (fd 1). This also avoids interfering with CLI structured JSON output on stdout. `pino-pretty` supports `destination: 2` for stderr.

2. **`pino-roll` as transport:** `pino-roll` integrates as a standard pino transport target, supporting `frequency: 'daily'` for date-based rotation. Verify it works correctly inside a `pino.transport({ targets: [...] })` multi-target configuration.

3. **`node-shared` gains runtime deps:** Currently has zero runtime deps. Will add `pino`, `pino-pretty`, `pino-roll`. Acceptable — `node-shared` is shared Node infrastructure, and these are small, stable packages.

4. **Backward compatibility — log file contract (CRITICAL):** Existing dashboard consumers read from `~/.aweave/logs/server.jsonl` and filter by `service: 'aweave-server'`:
   - `nestjs-dashboard/src/services/logs.service.ts` — reads `server.jsonl` via `fs.readFileSync` / `fs.watch`
   - `cli-plugin-dashboard/src/lib/file-tail.ts` — tails `server.jsonl` via polling
   - `cli-plugin-dashboard/src/hooks/useLogs.ts` — filters by `DEFAULT_SERVICE = 'aweave-server'`

   Plan MUST either: (a) keep `server.jsonl` as the live file name that `pino-roll` writes to (rotated files get date suffix), or (b) update all consumers in the same change set. This plan uses approach (a) — see Phase 1.2 for details.

5. **Backward compatibility — API signature:** Current `createLogger()` takes no arguments. New API makes `name` required. To avoid breaking the re-export in `nestjs-core`, `name` MUST be optional with a sensible default (e.g., `'app'`), OR `nestjs-core` re-export wraps the call with `{ name: 'server' }`.

6. **Backward compatibility — pino types in `nestjs-core`:** `nest-logger.service.ts` uses `import type pino from 'pino'` and references `pino.Logger`, `pino.Level`. Under pnpm strict mode, removing `pino` from `nestjs-core` dependencies breaks type resolution even for type-only imports. Solution: move `pino` to `devDependencies` in `nestjs-core` (types resolved at compile time, runtime provided transitively by `node-shared`).

7. **NestJS-specific code stays in `nestjs-core`:** `LogContextService` (uses `@Injectable()`), `NestLoggerService` (wraps pino + injects `LogContextService`), `CorrelationIdMiddleware` — all remain in `nestjs-core`. Only the pure pino factory moves.

8. **CLI console noise:** CLI commands produce structured MCP-like JSON on stdout. Even with pino on stderr, interleaved log lines clutter terminal output. CLI logger should default to file-only (`console: false`). Developers can opt in to console via `LOG_CONSOLE=true` env var for local debugging.

9. **Process management:** The system uses a native process manager (`aw server start/restart/status/logs`) — NOT PM2. All verification runbook steps must use `aw server` commands.

## Implementation Plan

### Phase 1: Add Logger to `node-shared`

**Target file structure:**

```
workspaces/devtools/common/node-shared/
├── package.json              # 🔄 + pino, pino-pretty, pino-roll deps
├── tsconfig.json             # ✅ No changes
└── src/
    ├── index.ts              # 🔄 + export * from './logging'
    ├── logging/
    │   ├── index.ts          # 🚧 Barrel export
    │   └── logger.factory.ts # 🚧 createLogger() implementation
    └── paths/
        ├── index.ts          # ✅ Existing
        └── devtools-root.ts  # ✅ Existing
```

- [ ] **1.1** Add runtime dependencies to `node-shared/package.json`:

  ```json
  "dependencies": {
    "pino": "^9.6.0",
    "pino-pretty": "^13.0.0",
    "pino-roll": "^2.1.0"
  }
  ```

- [ ] **1.2** Create `src/logging/logger.factory.ts` with the new `createLogger()`.

  **Public API:**

  ```typescript
  import type pino from 'pino';

  interface CreateLoggerOptions {
    /**
     * App/service name — used as log file prefix.
     * Examples: 'server', 'cli', 'mcp-memory'
     * Default: 'app'
     */
    name?: string;

    /**
     * Value for the `service` field in structured log entries.
     * Default: same as `name`.
     * Use to maintain backward compat (e.g., 'aweave-server' for server logs
     * while `name` is 'server' for file naming).
     */
    service?: string;

    /** Log file extension. Default: '.jsonl' */
    fileExtension?: string;

    /** Log directory. Default: ~/.aweave/logs */
    logDir?: string;

    /**
     * Minimum log level.
     * Default: 'debug' when NODE_ENV !== 'production', 'info' otherwise.
     * Override with LOG_LEVEL env var.
     */
    level?: pino.Level;

    /**
     * Enable console output on stderr.
     * Uses pino-pretty in dev, raw JSON in production.
     * Default: true.
     * Set false for CLI commands (stdout is for structured output)
     * or other contexts where console noise is unwanted.
     * Can be overridden with LOG_CONSOLE=true|false env var.
     */
    console?: boolean;
  }

  function createLogger(options?: CreateLoggerOptions): pino.Logger;
  ```

  **Transport configuration (3 targets):**

  | # | Transport | Level | Destination | Active |
  |---|-----------|-------|-------------|--------|
  | 1 | `pino-roll` | trace | `~/.aweave/logs/{name}.jsonl` → rotated: `{name}.jsonl.{date}` | Always |
  | 2 | `pino-roll` | error | `~/.aweave/logs/{name}.error.jsonl` → rotated: `{name}.error.jsonl.{date}` | Always |
  | 3 | `pino-pretty` (dev) / `pino/file` (prod) | per `level` | **stderr** (fd 2) | When `console !== false` |

  **File rotation details:**
  - `pino-roll` with `frequency: 'daily'` — current file keeps canonical name (e.g., `server.jsonl`), rotated files get date suffix (e.g., `server.jsonl.2026-03-01`)
  - This preserves backward compat: dashboard consumers always read from `server.jsonl` (the live file)
  - **VERIFY during implementation:** confirm `pino-roll` keeps the base filename for the current file and only renames on rotation. If not, use alternative approach (symlink or dual-write).
  - Consider `limit.count` for retention (e.g., keep last 30 files) — can be added later

  **Log entry `base` fields:**
  - `service`: from `options.service ?? options.name ?? 'app'`
  - Server must pass `service: 'aweave-server'` to maintain compat with dashboard filters

  **Console (stderr) details:**
  - Dev (`NODE_ENV !== 'production'`): `pino-pretty` with `destination: 2` (stderr), colorized
  - Prod: `pino/file` with `destination: 2` (stderr), raw JSON
  - All console output goes to stderr — **never stdout** — to protect MCP stdio transport and CLI structured output

- [ ] **1.3** Create `src/logging/index.ts` — barrel re-export of `createLogger` and `CreateLoggerOptions`

- [ ] **1.4** Update `src/index.ts` — add `export * from './logging'`

- [ ] **1.5** Run `pnpm install` in `workspaces/devtools/` to resolve new deps

- [ ] **1.6** Build `node-shared`: `cd workspaces/devtools/common/node-shared && pnpm build` — verify no errors

### Phase 2: Update `nestjs-core` to Use `node-shared` Logger

- [ ] **2.1** Add `"@hod/aweave-node-shared": "workspace:*"` to `nestjs-core/package.json` dependencies

- [ ] **2.2** Move `"pino"` from `dependencies` to `devDependencies` in `nestjs-core/package.json` (needed for type-only imports like `import type pino from 'pino'` in `nest-logger.service.ts`; runtime `pino` comes transitively via `node-shared`). Remove `"pino-pretty"` entirely (no longer used in `nestjs-core`).

- [ ] **2.3** Update `nestjs-core/src/logging/logger.factory.ts` — replace implementation with re-export:

  ```typescript
  export { createLogger } from '@hod/aweave-node-shared';
  export type { CreateLoggerOptions } from '@hod/aweave-node-shared';
  ```

  This preserves backward compat for any code importing from `@hod/aweave-nestjs-core`.

- [ ] **2.4** Update `nestjs-core/src/logging/nest-logger.service.ts`:
  - Change `import { createLogger } from './logger.factory'` → `import { createLogger } from '@hod/aweave-node-shared'`
  - Pass `{ name: 'server', service: 'aweave-server' }` to `createLogger()`. The `service: 'aweave-server'` maintains backward compat with dashboard log filters.

- [ ] **2.5** Verify `nestjs-core/src/index.ts` still exports `createLogger` (already does — no change needed, the re-export in 2.3 handles it)

- [ ] **2.6** Run `pnpm install && pnpm -r build` — verify no compilation errors across all packages

- [ ] **2.7** Restart NestJS server and verify:

  ```bash
  aw server restart
  aw server status    # confirm running + healthy
  aw server logs      # check for errors
  ```

  Verify:
  - `~/.aweave/logs/server.jsonl` exists and receives all-level logs (current file, same name as before)
  - `~/.aweave/logs/server.error.jsonl` exists with error-only logs
  - Log entries contain `"service":"aweave-server"` (backward compat)
  - Dashboard still works: `curl http://127.0.0.1:3456/logs/tail` returns log entries
  - No regression in existing functionality

### Phase 3: CLI Logger Integration

- [ ] **3.1** Determine where to place the CLI logger singleton. Two options:
  - **Option A:** In `@hod/aweave-cli-shared` — add `@hod/aweave-node-shared` as dependency, export a `getCliLogger()` helper
  - **Option B:** Each CLI plugin calls `createLogger({ name: 'cli', console: false })` directly
  - **Recommendation:** Option A — `cli-shared` provides a pre-configured singleton so all plugins share one logger instance per process

- [ ] **3.2** Add `@hod/aweave-node-shared` to `cli-shared/package.json` dependencies. No `pino` devDependency needed — use `ReturnType<typeof createLogger>` for type inference (see step 3.3).

- [ ] **3.3** Create CLI logger helper in `cli-shared`. Avoid direct `import type pino from 'pino'` — use inferred types from `@hod/aweave-node-shared` to avoid needing `pino` as a devDep:

  ```typescript
  import { createLogger } from '@hod/aweave-node-shared';

  type Logger = ReturnType<typeof createLogger>;
  let _logger: Logger | null = null;

  export function getCliLogger(): Logger {
    if (!_logger) {
      _logger = createLogger({ name: 'cli', console: false });
    }
    return _logger;
  }
  ```

  File-only by default. `LOG_CONSOLE=true` env var overrides for debugging.

- [ ] **3.4** Verify MCP stdio command (`aw workspace mcp`) is safe:
  - Console output goes to stderr (fd 2) — does not corrupt MCP JSON-RPC on stdout (fd 1)
  - Even if `console: true`, it's stderr — no conflict
  - Verify with: `aw workspace mcp 2>/dev/null` should still function; `aw workspace mcp 2>&1 | head` should show logs on stderr

- [ ] **3.5** Instrument existing CLI plugins with logger at key points. Scope: add `getCliLogger()` calls to the most important flow points in each major plugin. This is NOT a full audit — it establishes the pattern; the skill file update (Phase 4) ensures new code follows it.

  **Minimum instrumentation per plugin:**

  | Plugin | Key instrumentation points |
  |--------|---------------------------|
  | `cli-plugin-server` | Server start/stop/restart lifecycle |
  | `cli-plugin-workspace` | MCP server init, workspace context load |
  | `cli-plugin-debate` | Debate create/submit/wait (HTTP calls to server) |
  | `cli-plugin-docs` | Document create/submit/get |
  | `cli-plugin-config` | Config sync/migrate operations |

  Pattern for each: import `getCliLogger()`, add `.info()` at command entry, `.debug()` for key operations, `.error()` for caught errors.

- [ ] **3.6** Build all: `cd workspaces/devtools && pnpm -r build`

### Phase 4: Update Skill Files

- [ ] **4.1** Update `agent/skills/common/devtools-cli-builder/SKILL.md`:
  - Add a **Logging** section after "Shared Code Organization"
  - Content:
    - CLI commands MUST use `getCliLogger()` from `@hod/aweave-cli-shared` for flow tracing and debug logging
    - NEVER use `console.log` / `console.error` for logging — stdout is reserved for structured MCP-like JSON output
    - Log key decision points, external API calls, error details, and performance-sensitive operations
    - Logger writes to `~/.aweave/logs/cli.jsonl` (all levels) and `cli.error.jsonl` (errors), with daily rotation (rotated files: `cli.jsonl.{date}`)
    - Example usage pattern

- [ ] **4.2** Update `agent/skills/common/devtools-nestjs-builder/SKILL.md`:
  - Add a **Logging** section (or expand existing logging references in "Shared Code: What Goes Where")
  - Content:
    - All NestJS code MUST use injected `NestLoggerService` or NestJS `Logger` (backed by pino) — NEVER `console.log`
    - Logger is globally available via `@hod/aweave-nestjs-core` (`NestjsCoreModule` is `@Global()`)
    - Log key lifecycle events, service method entry/exit for complex flows, error details with context
    - Logs write to `~/.aweave/logs/server.jsonl` (all levels) and `server.error.jsonl` (errors), with daily rotation (rotated files: `server.jsonl.{date}`)
    - Underlying logger created by `createLogger()` from `@hod/aweave-node-shared`

### Phase 5: End-to-End Verification

- [ ] **5.1** NestJS server: `aw server restart && aw server status`, confirm `~/.aweave/logs/server.jsonl` and `server.error.jsonl` are created and receiving logs

- [ ] **5.2** Dashboard compat: verify dashboard log API still works (`curl http://127.0.0.1:3456/logs/tail`), confirm entries include `service: 'aweave-server'`

- [ ] **5.3** CLI: run any `aw` command (e.g., `aw config list`), confirm `~/.aweave/logs/cli.jsonl` and `cli.error.jsonl` are created

- [ ] **5.4** MCP stdio: verify stdout/stderr separation deterministically:

  ```bash
  # Capture stdout and stderr separately, with 5s timeout to avoid hang
  timeout 5 aw workspace mcp > /tmp/mcp-stdout.log 2> /tmp/mcp-stderr.log || true
  # stdout must be empty or valid JSON-RPC only (no pino output)
  # stderr may contain pino log lines (safe — does not corrupt MCP)
  ```

- [ ] **5.5** Full build: `cd workspaces/devtools && pnpm -r build` — zero errors

- [ ] **5.6** Check log content: entries contain `service` field, structured JSON format, timestamps. Server logs have `service: 'aweave-server'`, CLI logs have `service: 'cli'`

## Summary of Results

### Completed Achievements

- **Phase 1 ✅** — `createLogger()` implemented in `node-shared/src/logging/logger.factory.ts` with:
  - Two modes: `sync: false` (async pino-roll, for NestJS long-running) and `sync: true` (pino.multistream + pino.destination, for short-lived CLI processes)
  - Three targets: all-levels JSONL file, error-only JSONL file, console on stderr (fd 2)
  - `LOG_LEVEL`, `LOG_DIR`, `LOG_CONSOLE` env var overrides
- **Phase 2 ✅** — `nestjs-core/src/logging/logger.factory.ts` replaced with thin re-export. `nest-logger.service.ts` passes `{ name: 'server', service: 'aweave-server' }`. `pino` moved to devDeps, `pino-pretty` removed.
- **Phase 3 ✅** — `getCliLogger()` singleton in `cli-shared/src/logger/index.ts` with `sync: true`. CLI plugins instrumented: `cli-plugin-server` (start/stop/restart), `cli-plugin-workspace` (mcp), `cli-plugin-debate` (create), `cli-plugin-docs` (create), `cli-plugin-config` (sync).
- **Phase 4 ✅** — `devtools-cli-builder/SKILL.md` and `devtools-nestjs-builder/SKILL.md` updated with mandatory Logging sections.
- **Phase 5 ✅** — E2E verified:
  - `pnpm -r build` → exit code 0, all 28 packages
  - `~/.aweave/logs/server.jsonl` receiving logs, `service: 'aweave-server'` confirmed via `curl /logs/tail`
  - `~/.aweave/logs/cli.jsonl` created after `aw server restart`, structured JSON with `service: 'cli'`
  - MCP stdout: 0 bytes (clean), stderr has pino lines (safe)

## Outstanding Issues & Follow-up

- [ ] **Log retention policy** — `pino-roll` supports `limit.count` to cap rotated files. Decide on retention (e.g., 30 days). Can be added as a follow-up.
- [ ] **Log level per-transport override** — Currently console level follows the global level. Consider allowing separate console vs file levels if needed.
- [ ] **Structured context for CLI** — CLI doesn't have AsyncLocalStorage context like NestJS. Consider whether CLI commands need correlation IDs or command-scoped context in logs.
