# Debate CLI Plugin (`@aweave/cli-plugin-debate`)

> **Source:** `devtools/common/cli-plugin-debate/`
> **Last Updated:** 2026-02-07

oclif plugin cung cấp topic `aw debate` — tất cả commands để AI agents quản lý và tham gia debate. Plugin này là **HTTP client** tới NestJS server — không access database trực tiếp.

## Purpose

Plugin này cung cấp CLI interface cho hệ thống debate giữa AI agents:

- **Debate Lifecycle:** Tạo debate (MOTION), submit arguments (CLAIM), appeal, request completion
- **Polling:** Chờ response từ bên đối diện qua interval polling (`aw debate wait`)
- **Service Management:** Auto-start/stop NestJS server và debate-web qua pm2
- **Token Optimization:** Write commands trả về filtered response (chỉ IDs/state/type/seq, bỏ content) để tiết kiệm tokens cho AI agents

**Cách tiếp cận:** CLI là primary state machine consumer via `@aweave/debate-machine` (xstate). Server validates + persists. CLI:
1. Parse flags → construct HTTP request
2. Call server REST API
3. Enrich response with `available_actions` (computed locally via xstate machine)
4. Wrap response trong MCPResponse format
5. Output JSON cho AI agent parse

**State Machine:** Defined in `@aweave/debate-machine` (shared xstate package). CLI uses it in `get-context` and `wait` to compute `available_actions` per role — AI agents see what actions are valid in current state without guessing. Server also imports the same package for final validation before persisting.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  @aweave/cli-plugin-debate                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  commands/debate/                                            │
│  ├── generate-id.ts          ← UUID generation (local)       │
│  ├── create.ts               ← POST /debates                 │
│  ├── get-context.ts          ← GET /debates/:id              │
│  ├── submit.ts               ← POST /debates/:id/arguments   │
│  ├── wait.ts                 ← GET /debates/:id/poll (loop)  │
│  ├── appeal.ts               ← POST /debates/:id/appeal      │
│  ├── request-completion.ts   ← POST /debates/:id/resolution  │
│  ├── ruling.ts               ← POST /debates/:id/ruling      │
│  ├── intervention.ts         ← POST /debates/:id/intervention│
│  ├── list.ts                 ← GET /debates                   │
│  └── services/                                               │
│      ├── start.ts            ← pm2 start                     │
│      ├── stop.ts             ← pm2 stop                      │
│      └── status.ts           ← health check                  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  lib/                                                        │
│  ├── config.ts               ← Env var configuration         │
│  ├── helpers.ts              ← getClient(), filterWriteResp()│
│  └── services.ts             ← pm2/build/health management   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                        HTTP                                  │
│            ┌───────────────────────────┐                     │
│            │  NestJS Server (:3456)    │                     │
│            │  @aweave/nestjs-debate    │                     │
│            └───────────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

## Dependencies

| Package | Role |
|---------|------|
| `@oclif/core` | oclif Command class, Flags, Args |
| `@aweave/cli-shared` | MCPResponse, HTTPClient, output helpers, pm2 utils |
| `@aweave/debate-machine` | xstate state machine — `getAvailableActions()` for response enrichment |

**Runtime dependency:** NestJS server phải running tại `DEBATE_SERVER_URL` (default `http://127.0.0.1:3456`). Plugin auto-starts server nếu `AUTO_START_SERVICES=true`.

## Commands

| Command | Description | Server Endpoint |
|---------|-------------|-----------------|
| `aw debate generate-id` | Generate UUID | (local, no server) |
| `aw debate create` | Create debate with MOTION | `POST /debates` |
| `aw debate get-context` | Get debate + arguments | `GET /debates/:id` |
| `aw debate submit` | Submit CLAIM argument | `POST /debates/:id/arguments` |
| `aw debate wait` | Interval poll for response | `GET /debates/:id/poll` |
| `aw debate appeal` | Submit APPEAL | `POST /debates/:id/appeal` |
| `aw debate request-completion` | Submit RESOLUTION | `POST /debates/:id/resolution` |
| `aw debate ruling` | Submit RULING (DEV-ONLY) | `POST /debates/:id/ruling` |
| `aw debate intervention` | Submit INTERVENTION (DEV-ONLY) | `POST /debates/:id/intervention` |
| `aw debate list` | List debates | `GET /debates` |
| `aw debate services start` | Start server + web via pm2 | (local) |
| `aw debate services stop` | Stop services | (local) |
| `aw debate services status` | Check service health | (local) |

### Common Flags

Tất cả commands hỗ trợ `--format json|markdown` (default: `json`).

Write commands (`create`, `submit`, `appeal`, `request-completion`, `ruling`, `intervention`) hỗ trợ:
- `--file <path>` / `--content <text>` / `--stdin` — content input (exactly one required)
- `--client-request-id <uuid>` — idempotency key (auto-generated nếu không provide)

### Interval Polling (`aw debate wait`)

```
Client (CLI)                    Server (NestJS)
    │                                │
    │── GET /debates/:id/poll ──────►│ (immediate response)
    │◄── {has_new_argument: false} ──│
    │                                │
    │   sleep(2s)                    │
    │                                │
    │── GET /debates/:id/poll ──────►│ (immediate response)
    │◄── {has_new_argument: true} ───│
    │                                │
    │   Output MCPResponse + exit    │
```

- Poll mỗi `POLL_INTERVAL` (default 2s)
- Overall deadline `DEBATE_WAIT_DEADLINE` (default 120s)
- Timeout → output retry command cho AI agent

### Token Optimization

Write commands filter server response:

```typescript
// Server returns full argument + debate objects (~500-2000 tokens)
// CLI returns only metadata (~50 tokens):
{
  argument_id: "...",
  argument_type: "CLAIM",
  argument_seq: 3,
  debate_id: "...",
  debate_state: "AWAITING_OPPONENT",
  client_request_id: "..."
}
```

Agent vừa submit content, không cần nhận lại → tiết kiệm 87-93% tokens.

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `DEBATE_SERVER_URL` | `http://127.0.0.1:3456` | NestJS server URL |
| `DEBATE_AUTH_TOKEN` | (none) | Bearer token cho server auth |
| `DEBATE_WAIT_DEADLINE` | `120` | Seconds trước khi `wait` timeout |
| `DEBATE_POLL_INTERVAL` | `2` | Seconds giữa mỗi poll request |
| `DEBATE_SERVER_PORT` | `3456` | Server port (for service management) |
| `DEBATE_WEB_PORT` | `3457` | Web UI port (for service management) |
| `DEBATE_AUTO_START` | `true` | Auto-start services khi `create` |

## Project Structure

```
devtools/common/cli-plugin-debate/
├── package.json                           # @aweave/cli-plugin-debate
├── tsconfig.json
└── src/
    ├── index.ts                           # (empty — oclif auto-discovers commands)
    ├── commands/
    │   └── debate/
    │       ├── generate-id.ts
    │       ├── create.ts
    │       ├── get-context.ts
    │       ├── submit.ts
    │       ├── wait.ts
    │       ├── appeal.ts
    │       ├── request-completion.ts
    │       ├── ruling.ts
    │       ├── intervention.ts
    │       ├── list.ts
    │       └── services/
    │           ├── start.ts
    │           ├── stop.ts
    │           └── status.ts
    └── lib/
        ├── config.ts                      # Env var configuration
        ├── helpers.ts                     # getClient(), filterWriteResponse(), sleep()
        └── services.ts                    # pm2 management, build, health checks
```

## Development

```bash
cd devtools/common/cli-plugin-debate

# Build (requires cli-shared built first)
pnpm build

# Test via main CLI
aw debate generate-id
aw debate services status
DEBATE_AUTO_START=false aw debate create --debate-id test --title test --type general_debate --content "test"
```

## Related

- **State Machine:** `devtools/common/debate-machine/` — shared xstate definition
- **NestJS Backend:** `devtools/common/nestjs-debate/`
- **Backend Overview:** `devdocs/misc/devtools/common/nestjs-debate/OVERVIEW.md`
- **Debate Spec:** `devdocs/misc/devtools/plans/debate.md`
- **Shared Utilities:** `devtools/common/cli-shared/`
- **Main CLI:** `devtools/common/cli/`
- **Architecture Plan:** `devdocs/misc/devtools/plans/260207-cli-oclif-refactor.md`
- **xstate Migration Plan:** `devdocs/misc/devtools/plans/260207-xstate-debate-machine.md`
