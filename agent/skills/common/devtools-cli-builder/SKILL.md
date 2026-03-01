---
name: devtools-cli-builder
description: Guide for building oclif CLI plugins and NestJS backend modules in the devtools TypeScript monorepo. All CLI outputs follow MCP-like response format for AI agent compatibility. Use when creating CLI commands, adding oclif plugins, building backend features, or integrating external APIs in workspaces/devtools/.
---

# Devtools CLI Builder

## Overview

Build CLI tools and backend modules in the `workspaces/devtools/` TypeScript monorepo. The CLI (`aw <command>`) uses oclif with a response format inspired by MCP (Model Context Protocol), designed so AI agents can consume CLI output as if it were MCP tool responses.

**Core Principles:**

1. **MCP-Like by Design** — CLI is NOT an MCP server, but mirrors MCP conventions in response format, error handling, input schemas, and tool descriptions. Standards live in `@hod/aweave-cli-shared`; all plugins inherit.
2. **oclif Plugin System** — Each domain ships commands as an oclif plugin (`@hod/aweave-plugin-<name>`), auto-discovered at startup.
3. **Shared Foundation** — `@hod/aweave-cli-shared` is a pure utility library (zero framework deps) providing MCP models, HTTP client, output helpers, and service/runtime management helpers.
4. **No Cyclic Dependencies** — cli-shared is a leaf dependency. Plugins never import each other or the main CLI package.
5. **Always Development Mode for Servers** — All server processes (NestJS, Next.js) **must** run with `NODE_ENV=development`. We are the only users — full error details (stack traces, verbose messages) help us debug immediately instead of getting generic "Internal Server Error".

---

## Architecture

### Dependency Graph

```
@hod/aweave-cli-shared (pure utilities — zero external deps)
     ↑                    ↑
     |                    |
@hod/aweave          @hod/aweave-plugin-*
(oclif main app)     (oclif plugins)
     |
     └── declares plugins in oclif.plugins config

@hod/aweave-server (NestJS — port 3456)
     ↑
     |
@hod/aweave-nestjs-<feature> (backend modules)
```

### Package Map

| Package | npm name | Location | Role |
|---------|----------|----------|------|
| CLI Shared | `@hod/aweave-cli-shared` | `workspaces/devtools/common/cli-shared/` | Pure utility library (MCP, HTTP, helpers) |
| CLI Main | `@hod/aweave` | `workspaces/devtools/common/cli/` | oclif app, plugin declarations, `aw` binary |
| Plugins | `@hod/aweave-plugin-<name>` | `workspaces/devtools/<domain>/cli-plugin-<name>/` | Domain command sets |
| Server | `@hod/aweave-server` | `workspaces/devtools/common/server/` | Unified NestJS server |
| Backend Modules | `@hod/aweave-nestjs-<name>` | `workspaces/devtools/common/nestjs-<name>/` | NestJS feature modules |

### Package Naming Convention (MANDATORY)

All packages are published under `@hod` scope to the company Artifactory registry. **Never use `@aweave` scope** — it is deprecated.

| Category | Pattern | Example |
|----------|---------|---------|
| CLI entrypoint | `@hod/aweave` | `@hod/aweave` |
| Common CLI plugins | `@hod/aweave-plugin-<name>` | `@hod/aweave-plugin-debate`, `@hod/aweave-plugin-docs` |
| NAB CLI plugins | `@hod/aweave-plugin-nab-<name>` | `@hod/aweave-plugin-nab-auth`, `@hod/aweave-plugin-nab-clm` |
| Common non-plugin packages | `@hod/aweave-<name>` | `@hod/aweave-cli-shared`, `@hod/aweave-server` |
| Common NestJS modules | `@hod/aweave-nestjs-<name>` | `@hod/aweave-nestjs-debate` |
| Common config packages | `@hod/aweave-config-<domain>` | `@hod/aweave-config-common`, `@hod/aweave-config-core` |
| NAB non-plugin packages | `@hod/aweave-nab-<name>` | `@hod/aweave-nab-config`, `@hod/aweave-nab-opensearch-client` |
| Web apps (common) | `@hod/aweave-<name>` | `@hod/aweave-debate-web` |
| Web apps (NAB) | `@hod/aweave-nab-<name>` | `@hod/aweave-nab-tracing-log-web` |
| Workspace root | `@hod/aweave-workspace` | `@hod/aweave-workspace` |

**Key rules:**

1. **Scope is always `@hod`** — required by corporate Artifactory (`HOD-NPM-BUILD`)
2. **Prefix is always `aweave`** — e.g. `@hod/aweave-plugin-debate` not `@hod/plugin-debate`
3. **Domain qualifier for NAB** — NAB packages include `nab` after the category prefix: `@hod/aweave-plugin-nab-<name>`, `@hod/aweave-nab-<name>`
4. **No `cli-` in plugin names** — use `@hod/aweave-plugin-<name>` not `@hod/aweave-cli-plugin-<name>`
5. **Dependencies use `workspace:*`** — inter-package refs in `package.json` use pnpm workspace protocol

### File-Based Command Routing

oclif auto-discovers commands from file paths:

```
src/commands/<topic>/create.ts         → aw <topic> create
src/commands/<topic>/list.ts           → aw <topic> list
src/commands/<topic>/services/start.ts → aw <topic> services start
```

---

## MCP-Like Response Standard

### How the CLI Maps to MCP Concepts

| MCP Concept | CLI Equivalent | Where |
|-------------|---------------|-------|
| Tool name | oclif command path | `aw debate create` |
| Tool description | `static description` on Command class | Each command file |
| Input schema | `static flags` / `static args` with types | oclif flag definitions |
| Tool response | `MCPResponse` JSON output | `@hod/aweave-cli-shared` |
| Error response | `MCPError` with code/message/suggestion | `@hod/aweave-cli-shared` |
| Pagination | `has_more`, `next_offset`, `total_count` | `createPaginatedResponse()` |

### Response Contract

**Success:**

```json
{
  "success": true,
  "content": [{ "type": "json", "data": { "id": "abc", "title": "..." } }],
  "metadata": { "resource_type": "debate", "message": "Created" },
  "has_more": false,
  "total_count": 1
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Debate not found",
    "suggestion": "Verify the debate ID is correct"
  }
}
```

### Key Exports from `@hod/aweave-cli-shared`

| Export | Purpose |
|--------|---------|
| `MCPResponse` | Main response wrapper — `toDict()`, `toJSON()`, `toMarkdown()` |
| `MCPContent` | Content item — `{ type, text?, data? }` |
| `MCPError` | Error detail — `{ code, message, suggestion? }` |
| `ContentType` | Enum: `TEXT`, `JSON` |
| `createPaginatedResponse()` | Helper for list responses with pagination metadata |
| `HTTPClient` | fetch-based HTTP client with error mapping |
| `HTTPClientError` | Typed error with `code`, `message`, `suggestion` |
| `output()` | Print MCPResponse as JSON or Markdown |
| `errorResponse()` | Shorthand to create error MCPResponse |
| `handleServerError()` | Output error + `process.exit()` with appropriate code |
| `readContent()` | Read from `--file`, `--content`, or `--stdin` |
| Service runtime helpers | Managed service start/stop/health workflows |

### Error Codes & Exit Codes

| Code | Meaning | Exit Code |
|------|---------|-----------|
| `NOT_FOUND` | Resource not found (404) | 2 |
| `TIMEOUT` / `NETWORK_ERROR` | Server unreachable | 3 |
| `INVALID_INPUT` | Bad request / validation | 4 |
| `ACTION_NOT_ALLOWED` | Conflict / wrong state | 5 |
| `AUTH_FAILED` / `FORBIDDEN` | Authentication/authorization | 6 |
| `HTTP_<status>` | Other HTTP errors | 3 |

---

## Creating a New CLI Plugin

### Step 1: Scaffold Package

```
workspaces/devtools/<domain>/cli-plugin-<name>/
├── package.json
├── tsconfig.json
├── eslint.config.mjs
└── src/
    ├── index.ts
    ├── commands/
    │   └── <topic>/
    │       ├── list.ts
    │       └── create.ts
    └── lib/
        └── helpers.ts
```

Common-domain plugins go in `workspaces/devtools/common/cli-plugin-<name>/`.
NAB-domain plugins go in `workspaces/devtools/nab/cli-plugin-<name>/`.

### Step 2: package.json

**Package name depends on domain:**

- Common domain: `@hod/aweave-plugin-<name>`
- NAB domain: `@hod/aweave-plugin-nab-<name>`

```json
{
  "name": "@hod/aweave-plugin-<name>",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "oclif": {
    "commands": "./dist/commands",
    "topicSeparator": " "
  },
  "dependencies": {
    "@hod/aweave-cli-shared": "workspace:*",
    "@oclif/core": "^4.2.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "typescript": "^5.7.3"
  }
}
```

### Step 3: tsconfig.json

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2023",
    "declaration": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "sourceMap": true,
    "incremental": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "allowSyntheticDefaultImports": true,
    "removeComments": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 4: eslint.config.mjs

Each package must have its own `eslint.config.mjs` that extends the shared base config from the workspace root. This enables per-package linting via `pnpm lint` / `pnpm lint:fix`.

```javascript
import { baseConfig } from '../../eslint.config.mjs';

export default [{ ignores: ['dist/**'] }, ...baseConfig];
```

The base config (`workspaces/devtools/eslint.config.mjs`) provides: TypeScript-ESLint, Prettier formatting, import sorting (`simple-import-sort`), and unused import removal (`unused-imports`). All auto-fixable with `--fix`.

### Step 5: Implement a Command

```typescript
// src/commands/<topic>/list.ts
import {
  ContentType,
  createPaginatedResponse,
  handleServerError,
  HTTPClient,
  HTTPClientError,
  MCPContent,
  output,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';

export class TopicList extends Command {
  static description = 'List all resources';

  static flags = {
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
    max: Flags.integer({
      default: 500,
      description: 'Maximum items to fetch',
    }),
  };

  async run() {
    const { flags } = await this.parse(TopicList);

    try {
      const client = new HTTPClient({ baseUrl: 'http://127.0.0.1:3456' });
      const data = (await client.get('/resources')) as {
        items: Record<string, unknown>[];
        total: number;
      };

      const response = createPaginatedResponse({
        items: data.items,
        total: data.total,
        hasMore: false, // Always false — CLI fetches all data
        formatter: (item) =>
          new MCPContent({ type: ContentType.JSON, data: item }),
        metadata: { resource_type: 'resources' },
      });

      output(response, flags.format);
    } catch (error) {
      if (error instanceof HTTPClientError) {
        handleServerError(error, flags.format);
      }
      throw error;
    }
  }
}
```

### Step 6: Register Plugin

1. Add to `workspaces/devtools/pnpm-workspace.yaml`:

```yaml
packages:
  - '<domain>/cli-plugin-<name>'
```

1. Add to `workspaces/devtools/common/cli/package.json`:

```json
{
  "dependencies": {
    "@hod/aweave-plugin-<name>": "workspace:*"
  },
  "oclif": {
    "plugins": ["@hod/aweave-plugin-<name>"]
  }
}
```

1. Build and verify:

```bash
cd workspaces/devtools && pnpm install && pnpm -r build
cd common/cli && pnpm link --global
aw <topic> --help
```

---

## Creating a New Backend Module

When a CLI plugin needs server-side logic (REST API, WebSocket, database):

### Package Structure

```
workspaces/devtools/common/nestjs-<feature>/
├── package.json          # @hod/aweave-nestjs-<feature>
├── tsconfig.json
└── src/
    ├── <feature>.module.ts
    ├── <feature>.controller.ts
    ├── <feature>.service.ts
    └── index.ts           # exports NestJS module
```

### Integration

1. Add to `pnpm-workspace.yaml`
2. Add as dependency of `@hod/aweave-server`
3. Import in `workspaces/devtools/common/server/src/app.module.ts`
4. CLI plugin calls server endpoints via `HTTPClient` from `@hod/aweave-cli-shared`

### Service Runtime Configuration (ecosystem.config.cjs)

When adding a new server process to `workspaces/devtools/ecosystem.config.cjs`, **always use `NODE_ENV: 'development'`** so full error details are shown:

**NestJS server:**

```javascript
{
  name: 'aweave-server',
  cwd: path.join(__dirname, 'common/server'),
  script: 'dist/main.js',
  env: {
    NODE_ENV: 'development',  // Always development — show full errors
    SERVER_PORT: 3456,
    SERVER_HOST: '127.0.0.1',
  },
}
```

**Next.js web app:**

```javascript
{
  name: '<app-name>',
  cwd: path.join(__dirname, '<domain>/<app-name>'),
  script: 'node_modules/next/dist/bin/next',
  args: 'start',
  env: {
    NODE_ENV: 'development',  // Always development — show full errors
    PORT: <port>,
  },
}
```

> **Why development?** We are the only users of these devtools. Production mode hides error details behind generic messages — useless for debugging. Development mode shows full stack traces and verbose error info so we can fix issues immediately.

**Full NestJS patterns:** `resources/workspaces/devtools/common/server/OVERVIEW.md`

---

## Centralized Configuration

All non-sensitive config values (URLs, ports, timeouts, feature flags, service definitions) **MUST** be stored in the centralized config package for the domain — **never** scattered inside individual plugin/module packages.

### Architecture

```
@hod/aweave-config-core (shared loader — Node-only, zero oclif deps)
     ↑
     |
@hod/aweave-config-<domain> (default YAML files + schemas + env override maps)
     ↑
     |
@hod/aweave-plugin-*, @hod/aweave-server, debate-web, etc. (consumers)
```

### Packages

| Package | npm name | Location | Role |
|---------|----------|----------|------|
| Config Core | `@hod/aweave-config-core` | `workspaces/devtools/common/config-core/` | Shared loader: YAML parse, deep-merge, env override, sync, migration, projection |
| Config Common | `@hod/aweave-config-common` | `workspaces/devtools/common/config/` | Default configs + schemas for the `common` domain |
| Config CLI Plugin | `@hod/aweave-plugin-config` | `workspaces/devtools/common/cli-plugin-config/` | `aw config sync`, `aw config migrate` commands |

### Rules (MANDATORY)

1. **No hardcoded config in plugins/modules** — Do NOT create `src/lib/config.ts` with hardcoded URLs, ports, or defaults inside plugins or backend modules. All such values belong in the domain's config package (`workspaces/devtools/<domain>/config/defaults/*.yaml`).
2. **Sensitive values stay as env vars** — Tokens, API keys, secrets are NEVER stored in config files. Only reference them via `process.env` directly in the consuming code.
3. **Config precedence** — `env vars > user config (~/.aweave/config/) > defaults (in-source)`. This is enforced by `@hod/aweave-config-core`'s `loadConfig()`.
4. **One config package per domain** — Each domain (`common`, `nab`, etc.) has exactly one config package at `workspaces/devtools/<domain>/config/` containing all default YAML files for that domain.
5. **Next.js projection contract** — Config files used by Next.js apps must split values into `server` (private) and `clientPublic` (safe for browser) sections. Use `projectClientConfig()` from `@hod/aweave-config-core` to enforce this.

### Where to Put Config Values

| Value type | Where | Example |
|------------|-------|---------|
| URLs, ports, hosts | Domain config YAML (`defaults/*.yaml`) | `server.port: 3456` |
| Timeouts, intervals, limits | Domain config YAML | `debate.waitDeadline: 120` |
| Feature flags | Domain config YAML | `features.enableNewUI: false` |
| Service definitions (service names, health URLs) | Domain config YAML | `services.server.healthUrl` |
| Tokens, API keys, secrets | Environment variables ONLY | `process.env.AUTH_TOKEN` |
| Database paths | Domain config YAML | `database.debate.dir: "~/.aweave/db"` |

### How to Consume Config (in a plugin or module)

```typescript
import { loadConfig } from '@hod/aweave-config-core';
import { DEFAULT_CONFIG_DIR, CLI_ENV_OVERRIDES } from '@hod/aweave-config-common';

// Load config with full precedence: defaults → user override → env vars
const config = loadConfig({
  domain: 'common',
  name: 'cli',             // loads defaults/cli.yaml
  defaultsDir: DEFAULT_CONFIG_DIR,
  envOverrides: CLI_ENV_OVERRIDES,
});

// Use typed values
const serverUrl = config.debate.serverUrl as string;
const timeout = config.debate.waitDeadline as number;

// Sensitive values — always direct env var
const authToken = process.env.DEBATE_AUTH_TOKEN;
```

### Adding New Config Values

When a package needs a new config value:

1. **Add the default** to the appropriate YAML file in `workspaces/devtools/<domain>/config/defaults/<name>.yaml`
2. **Add env override mapping** (if applicable) in `workspaces/devtools/<domain>/config/src/index.ts` → env overrides map
3. **Add schema field** (if applicable) in `workspaces/devtools/<domain>/config/src/index.ts` → `CONFIG_SCHEMAS`
4. **Consume via `loadConfig()`** in the plugin/module — never hardcode the default
5. **Run `aw config sync --force`** to update user config files

### Adding Config for a New Domain

If creating tools for a new domain (e.g. `workspaces/devtools/newdomain/`):

1. Create `workspaces/devtools/<domain>/config/` package following the same structure as `workspaces/devtools/common/config/`
2. Add default YAML files in `defaults/`
3. Export `DEFAULT_CONFIG_DIR`, `DOMAIN`, `DEFAULT_CONFIG_FILES`, `CONFIG_SCHEMAS`, env override maps from `src/index.ts`
4. Register in `workspaces/devtools/pnpm-workspace.yaml`
5. The `aw config sync` command auto-discovers domains with `config/defaults/` — no additional registration needed

---

## Shared Code Organization

### Decision Matrix

| Code Type | Location | Example |
|-----------|----------|---------|
| MCP response models | `cli-shared/src/mcp/` | `MCPResponse`, `MCPContent` |
| HTTP client | `cli-shared/src/http/` | `HTTPClient`, `HTTPClientError` |
| Output/content helpers | `cli-shared/src/helpers/` | `output()`, `readContent()` |
| Service runtime utilities | `cli-shared/src/services/` | health checks and managed lifecycle helpers |
| Cross-plugin domain logic | New `@hod/aweave-<name>` package | `@hod/aweave-debate-machine` |
| Non-sensitive config (URLs, ports, timeouts) | Domain config package `defaults/*.yaml` | `@hod/aweave-config-common` — see [Centralized Configuration](#centralized-configuration) |
| Plugin helpers | Plugin `src/lib/helpers.ts` | `getClient()`, `filterResponse()` |
| Plugin models | Plugin `src/lib/models.ts` | Domain interfaces/types |

### Rules

1. **`cli-shared` must be generic** — no domain logic, no oclif dependency, zero external deps
2. **New common package** — if logic is shared across plugins but too specific for cli-shared, create `@hod/aweave-<name>` in `workspaces/devtools/common/`
3. **Never plugin-to-plugin imports** — shared code goes up to cli-shared or a new common package
4. **Never plugin-to-cli-main imports** — only cli-main depends on plugins (via oclif config)

---

## Logging

### Rules (MANDATORY)

1. **ALWAYS use `getCliLogger()` from `@hod/aweave-cli-shared`** — NEVER use `console.log`, `console.error`, or `console.warn` in CLI commands. stdout is reserved for structured MCP-like JSON output; console calls corrupt it.
2. **File-only by default** — `getCliLogger()` is pre-configured with `console: false`. Logs go to `~/.aweave/logs/cli.jsonl` (all levels) and `~/.aweave/logs/cli.error.jsonl` (error-only), with daily rotation (rotated files: `cli.jsonl.{date}`).
3. **Override for debugging** — set `LOG_CONSOLE=true` to enable stderr output (colorized pino-pretty in dev) without breaking stdout.

### What to log

- **Entry point** — `log.info({ ...keyFlags }, '<command>: initiating')` at the start of `run()`
- **Key operations** — `log.debug()` for HTTP calls, DB operations, config loads
- **Success** — `log.info({ resultId }', '<command>: success')` after successful writes
- **Errors** — `log.error({ err: e }, '<command>: error')` in every catch block

### Example

```typescript
import { getCliLogger, output, MCPResponse } from '@hod/aweave-cli-shared';

async run() {
  const { flags } = await this.parse(MyCommand);
  const log = getCliLogger();

  log.info({ resourceId: flags.id }, 'my-command: initiating');

  try {
    const result = await client.post('/resources', { id: flags.id });
    log.info({ id: result.id }, 'my-command: success');
    output(/* ... */, flags.format);
  } catch (e) {
    log.error({ err: e }, 'my-command: error');
    if (e instanceof HTTPClientError) handleServerError(e, flags.format);
    throw e;
  }
}
```

---

For commands with interactive terminal UI (dashboards, real-time monitoring), use Ink v6 + React 19. The plugin **must be ESM** (`"type": "module"`) and follows different patterns from standard CJS plugins.

**Reference implementation:** `resources/workspaces/devtools/common/cli-plugin-dashboard/OVERVIEW.md`

Key differences: ESM package config, dynamic `import()` for Ink/React, no dev mode (must build first), async-only data fetching.

---

## Checklist

### Before Implementation

- [ ] Read `resources/workspaces/devtools/OVERVIEW.md` for architecture context
- [ ] Check existing exports from `@hod/aweave-cli-shared` — don't duplicate
- [ ] Decide: CLI-only or CLI + Backend?

### CLI Plugin

- [ ] Package name follows `@hod` scope naming convention (see [Package Naming Convention](#package-naming-convention-mandatory))
- [ ] Package created with correct `oclif` config in package.json
- [ ] `eslint.config.mjs` created extending `baseConfig` from workspace root
- [ ] `lint` and `lint:fix` scripts added to package.json
- [ ] `pnpm lint` passes (run `pnpm lint:fix` first to auto-fix formatting/imports)
- [ ] All commands output `MCPResponse` via `output()` helper
- [ ] `--format json|markdown` flag on every command (default: `json`)
- [ ] Error handling: `HTTPClientError` → `handleServerError()`
- [ ] Credentials via environment variables (never CLI flags — shell history risk)
- [ ] Config values loaded via `@hod/aweave-config-core` from domain config package — NO hardcoded defaults in plugin code (see [Centralized Configuration](#centralized-configuration))
- [ ] List commands auto-fetch all pages (`has_more: false`)
- [ ] Write commands return minimal data — IDs, state only (token optimization)
- [ ] Plugin registered in `pnpm-workspace.yaml` + `cli/package.json` oclif.plugins

### Backend Module (if needed)

- [ ] NestJS module created with controller + service
- [ ] Added as dependency of `@hod/aweave-server`
- [ ] Imported in `app.module.ts`
- [ ] CLI plugin calls endpoints via `HTTPClient`
- [ ] Service runtime config uses `NODE_ENV: 'development'` (full error visibility)

### Verification

- [ ] `pnpm -r build` — no compilation errors
- [ ] `aw <topic> --help` — shows commands
- [ ] JSON output is valid MCPResponse format
- [ ] Error cases return `{ success: false, error: { code, message, suggestion } }`

### Runtime Verification (NestJS / Next.js)

> **Mandatory** when implementation involves NestJS server or Next.js app. Do NOT report completion to the user until this passes.

After build succeeds, restart the affected service process and verify it runs without errors:

```bash
# 1. Build
cd workspaces/devtools && pnpm -r build

# 2. Restart affected service(s)
aw server restart            # NestJS

# 3. Wait a moment, then check logs for errors
aw server logs --lines 30
```

- [ ] Service status is healthy/running
- [ ] No crash loops — status remains stable after restart
- [ ] No errors in service logs (stack traces, unhandled rejections, module not found, etc.)
- [ ] Health check passes (NestJS): `curl http://127.0.0.1:3456/health`

**If errors found:** Fix the code, rebuild, restart the service, and re-check. Repeat until clean. Only then notify the user that implementation is complete.

---

## Reference

- **Best practices:** [cli_best_practices.md](reference/cli_best_practices.md)
- **Full example (debate plugin):** [example_implementation.md](reference/example_implementation.md)
- **DevTools overview:** `resources/workspaces/devtools/OVERVIEW.md`
- **CLI shared library:** `resources/workspaces/devtools/common/cli-shared/OVERVIEW.md`
- **Server patterns:** `resources/workspaces/devtools/common/server/OVERVIEW.md`
- **Ink/Dashboard patterns:** `resources/workspaces/devtools/common/cli-plugin-dashboard/OVERVIEW.md`
- **Config core API:** `workspaces/devtools/common/config-core/src/index.ts` (public API exports)
- **Common domain config:** `workspaces/devtools/common/config/` (default YAML files + schemas)
- **MCP server guide (if converting):** `agent/skills/common/mcp-builder/SKILL.md`
- **Package rename plan (`@aweave` → `@hod`):** `resources/workspaces/devtools/nab/_plans/260212-package-rename-hod-scope.md`
