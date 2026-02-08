# 📋 [CLI-TS-MIGRATION: 2026-02-07] - Migrate CLI Toolset from Python to TypeScript

> **SUPERSEDED**: The Commander.js approach in this plan has been replaced by oclif.
> See `devdocs/misc/devtools/plans/260207-cli-oclif-refactor.md` for the current architecture.
> This file is kept as historical record of the initial Python→TypeScript migration.

## References

- DevTools overview: `devdocs/misc/devtools/OVERVIEW.md`
- Debate ecosystem spec: `devdocs/misc/devtools/plans/debate.md`
- Unified NestJS server plan: `devdocs/misc/devtools/plans/260207-unified-nestjs-server.md`
- Debate server plan: `devdocs/misc/devtools/plans/260131-debate-server.md`
- Docs CLI plan: `devdocs/misc/devtools/plans/260131-docs-cli-tool.md`
- Bitbucket CLI implementation: `devdocs/misc/devtools/tinybots/260130-bitbucket-cli-implementation.md`
- Auto-start services plan: `devdocs/misc/devtools/plans/260204-debate-auto-start-services.md`
- Python MCP response: `devtools/common/cli/devtool/aweave/mcp/response.py`
- Python HTTP client: `devtools/common/cli/devtool/aweave/http/client.py`
- Python debate CLI: `devtools/common/cli/devtool/aweave/debate/cli.py`
- Python debate config: `devtools/common/cli/devtool/aweave/debate/config.py`
- Python debate services: `devtools/common/cli/devtool/aweave/debate/services.py`
- Python core entrypoint: `devtools/common/cli/devtool/aweave/core/main.py`
- Python bitbucket CLI: `devtools/tinybots/cli/bitbucket/tinybots/bitbucket/cli.py`
- Python bitbucket client: `devtools/tinybots/cli/bitbucket/tinybots/bitbucket/client.py`
- Python bitbucket models: `devtools/tinybots/cli/bitbucket/tinybots/bitbucket/models.py`

## Background & Decision Context

> This section explains **WHY** we are doing this migration and the reasoning behind key technical decisions. AI agents implementing this plan should read this section first to understand the motivation.

### Why migrate from Python to TypeScript?

The `devtools/` monorepo originally used Python for CLI tools (`aw` command) and Node.js for server-side (debate-server, debate-web). This created a dual-language maintenance burden:

1. **Two package managers**: `uv` (Python) + `pnpm` (Node.js)
2. **Two build systems**: Python entry points + Node.js builds
3. **Two plugin systems**: Python entry points (`aw.plugins`) + Node registry (`aw-plugins.yaml`)
4. **Context switching**: Contributors need both Python and Node.js knowledge

Since the server-side is already Node.js (NestJS — see `260207-unified-nestjs-server.md`), consolidating everything on TypeScript eliminates this complexity. Node.js has mature CLI frameworks that can replicate everything the Python toolchain does.

### Why Commander.js (not oclif or pastel)?

Three options were evaluated:

| Framework | Strengths | Weaknesses for our use case |
|-----------|-----------|----------------------------|
| **oclif** | Mature plugin system, TypeScript-first, production-proven (Heroku/Salesforce) | Heavy boilerplate, npm-distributed plugin system is overkill (we have pnpm workspace), poor ink integration |
| **pastel** | Native ink integration, file-based routing, Zod type safety | Every command renders through React/ink even for JSON output, doesn't align with monorepo plugin pattern, smaller ecosystem |
| **Commander.js** | Lightweight, `.addCommand()` composability, 35k+ stars, battle-tested | No built-in plugin system (not needed — pnpm workspace IS our plugin system) |

**Decision: Commander.js** because:

1. **90%+ CLI calls are from AI agents** — non-interactive, JSON output. No rendering framework needed. Commander.js parses args, calls handler, outputs JSON. Done.
2. **pnpm workspace IS the plugin system** — Each domain is a workspace package that exports a Commander program. The main `aw` package composes them via `.addCommand()`. No need for oclif's npm plugin machinery.
3. **ink when needed, not forced** — Dashboard features (debate monitoring, server status) will use ink in specific commands. Commander.js doesn't conflict with ink — a command handler can `render(<InkComponent />)`.
4. **Minimal migration friction** — Commander.js API is simple. Python Typer commands map 1:1 to Commander commands.

### Why ink for dashboards?

ink (React renderer for terminal) will be used for future interactive features:
- Debate monitoring dashboard (`aw debate dashboard`)
- Server status dashboard
- Real-time log viewing

ink is used by Claude Code, Gemini CLI, Cloudflare Wrangler, and others. It's the de-facto standard for terminal UIs in Node.js.

**Important:** ink is NOT used for the migration itself. It's a future addition for specific interactive commands. The migration focuses on Commander.js + MCP JSON output.

### MCP-style response format

All CLI tools output responses in a custom "MCP-like" format designed for AI agent consumption. This is NOT the official MCP protocol — it's an internal convention inspired by MCP's structured response pattern:

```json
{
  "success": true,
  "content": [{ "type": "json", "data": { ... } }],
  "metadata": { ... },
  "has_more": false,
  "total_count": 10
}
```

This format MUST be preserved exactly during migration. AI agent commands and rules depend on it.

## User Requirements

1. **Full migration**: Replace ALL Python CLI code with TypeScript. Remove Python CLI entirely after migration.
2. **Single language**: After migration, devtools monorepo is 100% TypeScript/Node.js.
3. **Tool-by-tool migration**: Each CLI tool migrated independently with its own utilities, but sharing a minimal foundation.
4. **Global `aw` command**: Install via `pnpm` global. Remove old Python `aw` from `~/.local/bin/`.
5. **Preserve MCP response format**: Exact same JSON structure for AI agent compatibility.
6. **Fresh database**: For debate, use the new NestJS server (no data migration). For docs, use `better-sqlite3` direct access.
7. **NestJS server assumed available**: The unified NestJS server (plan `260207-unified-nestjs-server.md`) is being implemented in parallel. CLI migration should assume server endpoints exist as specified.

## 🎯 Objective

Migrate the entire `aw` CLI toolset from Python (Typer) to TypeScript (Commander.js), organized as pnpm workspace packages. After migration, the Python CLI (`devtools/common/cli/devtool/`) is deleted and the `aw` command runs from Node.js globally installed via pnpm.

### ⚠️ Key Considerations

1. **MCP response format is the contract** — AI agent commands, rules, and skills all parse this format. Any deviation breaks the agent ecosystem. TypeScript models must produce identical JSON.

2. **Commander.js `.addCommand()` is the plugin pattern** — Each domain package exports a `Command` object. The core package imports and composes them. This replaces both Python entry points and the Node plugin registry.

3. **Interval polling (not long polling)** — The NestJS server uses interval polling (`GET /debates/:id/poll`). The TypeScript debate CLI must implement client-side polling with `POLL_INTERVAL=2s` and `WAIT_DEADLINE=120s`. See `260207-unified-nestjs-server.md` section 3.

4. **Token optimization in responses** — Write commands (create, submit, appeal, etc.) filter server responses to minimize token usage. Only IDs, state, type, seq are returned — content is stripped since the agent just submitted it. This pattern must be preserved.

5. **Service auto-start** — The debate CLI auto-starts `aweave-server` and `debate-web` via pm2 before creating debates. This service management must be migrated.

6. **pnpm global installation** — The `aw` binary is installed globally via `pnpm add -g`. The `package.json` `bin` field maps `aw` to the compiled entry point. pnpm global bin path is `~/Library/pnpm` (macOS).

## 📐 Spec / Decisions

### 1. Package Structure

```
devtools/
├── pnpm-workspace.yaml                    # 🔄 ADD cli packages
├── common/
│   ├── server/                            # NestJS server (existing/in-progress)
│   ├── nestjs-debate/                     # NestJS debate module (existing/in-progress)
│   ├── debate-web/                        # Next.js debate web (existing)
│   │
│   ├── cli-core/                          # 🚧 @aweave/cli — global entrypoint + shared utils
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── bin/aw.ts                  # #!/usr/bin/env node — entrypoint
│   │       ├── program.ts                 # Commander root program, registers subcommands
│   │       ├── mcp/
│   │       │   ├── response.ts            # MCPResponse, MCPContent, MCPError classes
│   │       │   ├── pagination.ts          # createPaginatedResponse helper
│   │       │   └── index.ts              # Barrel exports
│   │       ├── http/
│   │       │   ├── client.ts              # HTTPClient class (fetch-based)
│   │       │   └── index.ts
│   │       ├── services/
│   │       │   └── pm2.ts                 # pm2 service management utilities
│   │       └── index.ts                   # Package barrel exports
│   │
│   ├── cli-debate/                        # 🚧 @aweave/cli-debate — debate CLI commands
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── commands.ts                # Commander program: aw debate <subcommand>
│   │       ├── config.ts                  # Environment config
│   │       ├── services.ts                # Debate service management (pm2, health checks)
│   │       ├── helpers.ts                 # Shared CLI helpers (content reading, error handling)
│   │       └── index.ts                   # Export: debateCommand
│   │
│   └── cli-docs/                          # 🚧 @aweave/cli-docs — docs CLI commands
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── commands.ts                # Commander program: aw docs <subcommand>
│           ├── db.ts                      # SQLite database operations (better-sqlite3)
│           └── index.ts                   # Export: docsCommand
│
├── tinybots/
│   └── cli-bitbucket/                     # 🚧 @aweave/cli-bitbucket — bitbucket CLI commands
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── commands.ts                # Commander program: aw tinybots-bitbucket <subcommand>
│           ├── client.ts                  # Bitbucket API client
│           ├── models.ts                  # Data models (PR, Comment, Task)
│           └── index.ts                   # Export: bitbucketCommand
│
└── common/cli/devtool/                    # ⚠️ OLD Python CLI — DELETE after full migration
```

### 2. Package Naming & Dependencies

| Package | npm name | Folder | Dependencies |
|---------|----------|--------|--------------|
| CLI Core | `@aweave/cli` | `devtools/common/cli-core/` | `commander` |
| Debate CLI | `@aweave/cli-debate` | `devtools/common/cli-debate/` | `@aweave/cli` |
| Docs CLI | `@aweave/cli-docs` | `devtools/common/cli-docs/` | `@aweave/cli`, `better-sqlite3` |
| Bitbucket CLI | `@aweave/cli-bitbucket` | `devtools/tinybots/cli-bitbucket/` | `@aweave/cli` |

**Why `@aweave/cli` not `@aweave/cli-core`?** The main package IS the `aw` CLI itself. It's what gets installed globally. The name `@aweave/cli` is cleaner and matches the `bin: { "aw": ... }` field.

### 3. Commander.js Composition Pattern

```typescript
// === @aweave/cli — devtools/common/cli-core/src/program.ts ===
import { Command } from 'commander';
import { debateCommand } from '@aweave/cli-debate';
import { docsCommand } from '@aweave/cli-docs';
import { bitbucketCommand } from '@aweave/cli-bitbucket';

export const program = new Command()
  .name('aw')
  .description('Unified CLI for development tools')
  .version('0.1.0');

// Register domain commands
program.addCommand(debateCommand);
program.addCommand(docsCommand);
program.addCommand(bitbucketCommand);

// === @aweave/cli — devtools/common/cli-core/src/bin/aw.ts ===
#!/usr/bin/env node
import { program } from '../program.js';
program.parse();

// === @aweave/cli-debate — devtools/common/cli-debate/src/commands.ts ===
import { Command } from 'commander';
import { MCPResponse, MCPContent, ContentType, HTTPClient } from '@aweave/cli';

export const debateCommand = new Command('debate')
  .description('Debate CLI - AI Agent debate management');

debateCommand
  .command('create')
  .requiredOption('--debate-id <id>', 'Debate UUID')
  .requiredOption('--title <title>', 'Debate title')
  .requiredOption('--type <type>', 'Debate type: coding_plan_debate|general_debate')
  .option('--file <path>', 'Path to motion content file')
  .option('--content <text>', 'Inline motion content')
  .option('--stdin', 'Read motion content from stdin')
  .option('--client-request-id <id>', 'Idempotency key')
  .option('--format <fmt>', 'Output format: json|markdown', 'json')
  .action(async (opts) => {
    // ... implementation
  });

// Sub-groups (e.g., aw debate services start)
const servicesCommand = new Command('services')
  .description('Manage debate services');

servicesCommand.command('start').action(async () => { /* ... */ });
servicesCommand.command('stop').action(async () => { /* ... */ });
servicesCommand.command('status').action(async () => { /* ... */ });

debateCommand.addCommand(servicesCommand);
```

### 4. MCP Response TypeScript Models

Direct port from Python `aweave/mcp/response.py`. Must produce **identical JSON output**.

```typescript
// devtools/common/cli-core/src/mcp/response.ts

export enum ContentType {
  TEXT = 'text',
  JSON = 'json',
}

export interface MCPContentData {
  type: ContentType;
  text?: string;
  data?: Record<string, unknown>;
}

export interface MCPErrorData {
  code: string;
  message: string;
  suggestion?: string;
}

export interface MCPResponseData {
  success: boolean;
  content?: MCPContentData[];
  error?: MCPErrorData;
  metadata?: Record<string, unknown>;
  has_more?: boolean;
  next_offset?: number;
  total_count?: number;
}

export class MCPContent {
  constructor(
    public type: ContentType,
    public text?: string,
    public data?: Record<string, unknown>,
  ) {}

  toDict(): MCPContentData {
    const result: MCPContentData = { type: this.type };
    if (this.text !== undefined) result.text = this.text;
    if (this.data !== undefined) result.data = this.data;
    return result;
  }
}

export class MCPError {
  constructor(
    public code: string,
    public message: string,
    public suggestion?: string,
  ) {}

  toDict(): MCPErrorData {
    const result: MCPErrorData = { code: this.code, message: this.message };
    if (this.suggestion) result.suggestion = this.suggestion;
    return result;
  }
}

export class MCPResponse {
  constructor(
    public success: boolean,
    public content: MCPContent[] = [],
    public error?: MCPError,
    public metadata: Record<string, unknown> = {},
    public hasMore: boolean = false,
    public nextOffset?: number,
    public totalCount?: number,
  ) {}

  toDict(): MCPResponseData {
    const result: MCPResponseData = { success: this.success };

    if (this.content.length > 0) {
      result.content = this.content.map(c => c.toDict());
    }
    if (this.error) {
      result.error = this.error.toDict();
    }
    if (Object.keys(this.metadata).length > 0) {
      result.metadata = this.metadata;
    }

    // Pagination — match Python behavior: only include if has_more or total_count set
    if (this.hasMore || this.totalCount !== undefined) {
      result.has_more = this.hasMore;
      if (this.nextOffset !== undefined) result.next_offset = this.nextOffset;
      if (this.totalCount !== undefined) result.total_count = this.totalCount;
    }

    return result;
  }

  toJSON(indent = 2): string {
    return JSON.stringify(this.toDict(), null, indent);
  }

  toMarkdown(): string {
    const lines: string[] = [];

    if (!this.success && this.error) {
      lines.push(`## ❌ Error: ${this.error.code}`);
      lines.push(`\n${this.error.message}`);
      if (this.error.suggestion) {
        lines.push(`\n**Suggestion:** ${this.error.suggestion}`);
      }
      return lines.join('\n');
    }

    for (const item of this.content) {
      if (item.type === ContentType.TEXT) {
        lines.push(item.text ?? '');
      } else if (item.type === ContentType.JSON && item.data) {
        lines.push(`\`\`\`json\n${JSON.stringify(item.data, null, 2)}\n\`\`\``);
      }
    }

    if (this.hasMore) {
      const msg = this.totalCount !== undefined
        ? `Showing ${this.content.length} of ${this.totalCount} items.`
        : `Showing ${this.content.length} items. More available.`;
      lines.push(`\n---\n*${msg} Use --offset ${this.nextOffset} to see more.*`);
    }

    return lines.join('\n');
  }
}
```

### 5. HTTP Client

Port from Python `aweave/http/client.py`. Replace `httpx` with Node.js native `fetch` (available in Node 18+, stable in Node 21+).

```typescript
// devtools/common/cli-core/src/http/client.ts

export class HTTPClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public suggestion?: string,
  ) {
    super(message);
    this.name = 'HTTPClientError';
  }
}

export class HTTPClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;

  constructor(options: {
    baseUrl: string;
    auth?: { username: string; password: string };
    headers?: Record<string, string>;
    timeout?: number;  // milliseconds
  }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.headers = { 'Content-Type': 'application/json', ...options.headers };
    this.timeout = options.timeout ?? 30_000;

    if (options.auth) {
      const encoded = Buffer.from(`${options.auth.username}:${options.auth.password}`).toString('base64');
      this.headers['Authorization'] = `Basic ${encoded}`;
    }
  }

  async get(path: string, params?: Record<string, string>): Promise<Record<string, unknown>> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }
    return this.request(url.toString(), { method: 'GET' });
  }

  async post(path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = new URL(path, this.baseUrl);
    return this.request(url.toString(), {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete(path: string): Promise<Record<string, unknown>> {
    const url = new URL(path, this.baseUrl);
    return this.request(url.toString(), { method: 'DELETE' });
  }

  async getUrl(absoluteUrl: string): Promise<Record<string, unknown>> {
    return this.request(absoluteUrl, { method: 'GET' });
  }

  private async request(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...init,
        headers: this.headers,
        signal: controller.signal,
      });

      if (response.status === 401) throw new HTTPClientError('AUTH_FAILED', 'Authentication failed', 'Check your credentials');
      if (response.status === 403) throw new HTTPClientError('FORBIDDEN', 'Access denied', 'Check permissions');
      if (response.status === 404) throw new HTTPClientError('NOT_FOUND', 'Resource not found', 'Verify the resource ID/path');
      if (response.status >= 400) throw new HTTPClientError(`HTTP_${response.status}`, `Request failed: ${await response.text()}`);
      if (response.status === 204) return {};

      return await response.json() as Record<string, unknown>;
    } catch (err) {
      if (err instanceof HTTPClientError) throw err;
      if ((err as Error).name === 'AbortError') throw new HTTPClientError('TIMEOUT', `Request timed out after ${this.timeout}ms`);
      throw new HTTPClientError('NETWORK_ERROR', `Network error: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
```

### 6. Global Installation via pnpm

```jsonc
// devtools/common/cli-core/package.json
{
  "name": "@aweave/cli",
  "version": "0.1.0",
  "bin": {
    "aw": "./dist/bin/aw.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "link-global": "pnpm link --global"
  }
}
```

**Installation workflow:**

```bash
# During development (from devtools/common/cli-core/)
pnpm build
pnpm link --global    # Creates global "aw" symlink to local build

# After build, aw is available globally:
aw --help
aw debate list
aw tinybots-bitbucket pr my-repo 123
```

**pnpm global bin path:** `~/Library/pnpm` (macOS). Must be in `$PATH`.

**Old Python aw removal:** The old symlink `~/.local/bin/aw -> devtools/.venv/bin/aw` must be deleted before installing the TypeScript version to avoid conflicts.

### 7. Output Helpers

```typescript
// Common pattern used in all CLI commands
export function output(response: MCPResponse, format: string, readableContent = false): void {
  if (format === 'markdown') {
    console.log(response.toMarkdown());
  } else {
    let json = response.toJSON();
    if (readableContent) {
      // Replace escaped newlines/tabs for AI agent readability
      // Matches Python behavior in debate CLI
      json = json.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    }
    console.log(json);
  }
}

export function errorResponse(code: string, message: string, suggestion?: string): MCPResponse {
  return new MCPResponse(false, [], new MCPError(code, message, suggestion));
}
```

### 8. Content Reading Pattern

```typescript
// Shared helper for --file / --content / --stdin
import { readFileSync, existsSync } from 'fs';

export async function readContent(opts: {
  file?: string;
  content?: string;
  stdin?: boolean;
}): Promise<{ content?: string; error?: MCPResponse }> {
  const sources = [opts.file, opts.content, opts.stdin].filter(Boolean).length;

  if (sources === 0) {
    return { error: errorResponse('INVALID_INPUT', 'No content provided', 'Use --file, --content, or --stdin') };
  }
  if (sources > 1) {
    return { error: errorResponse('INVALID_INPUT', 'Multiple content sources', 'Use only one of --file, --content, or --stdin') };
  }

  if (opts.stdin) {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return { content: Buffer.concat(chunks).toString('utf-8') };
  }

  if (opts.file) {
    if (!existsSync(opts.file)) {
      return { error: errorResponse('FILE_NOT_FOUND', `File not found: ${opts.file}`, 'Check the file path') };
    }
    return { content: readFileSync(opts.file, 'utf-8') };
  }

  return { content: opts.content ?? '' };
}
```

## 🔄 Implementation Plan

### Phase 1: Foundation — `@aweave/cli` Core Package

> Create the minimal shared infrastructure. All subsequent tools depend on this.

#### Step 0: Remove Old Python `aw`

- [ ] Delete symlink `~/.local/bin/aw` (currently points to `devtools/.venv/bin/aw`)
- [ ] Verify `which aw` returns nothing or the new TypeScript version
  - **Outcome**: No conflicting `aw` binary in PATH

#### Step 1: Create `@aweave/cli` Package

- [ ] Create `devtools/common/cli-core/` directory
- [ ] Create `package.json`:
  - name: `@aweave/cli`
  - bin: `{ "aw": "./dist/bin/aw.js" }`
  - dependencies: `commander`
  - devDependencies: `typescript`, `@types/node`
  - **Outcome**: Package initialized
- [ ] Create `tsconfig.json`:
  - target: `ES2022`, module: `Node16`, moduleResolution: `Node16`
  - outDir: `dist`, rootDir: `src`
  - declaration: `true` (for type exports to consumer packages)
  - strict: `true`
  - **Outcome**: TypeScript configured for Node.js ESM
- [ ] Update `devtools/pnpm-workspace.yaml`:
  - Add `common/cli-core`
  - **Outcome**: Package discoverable in workspace

#### Step 2: Implement MCP Response Models

- [ ] Create `src/mcp/response.ts` — `MCPResponse`, `MCPContent`, `MCPError` classes (see Spec section 4)
- [ ] Create `src/mcp/pagination.ts` — `createPaginatedResponse` helper
- [ ] Create `src/mcp/index.ts` — Barrel exports
- [ ] **Verify**: JSON output matches Python `MCPResponse.to_json()` exactly
  - Create a simple test script that outputs the same data through both Python and TypeScript, diff the results
  - **Outcome**: Identical JSON output format

#### Step 3: Implement HTTP Client

- [ ] Create `src/http/client.ts` — `HTTPClient` class using native `fetch` (see Spec section 5)
- [ ] Create `src/http/index.ts` — Barrel exports
  - **Outcome**: HTTP client with error handling matching Python behavior

#### Step 4: Implement Shared Helpers

- [ ] Create `src/helpers/output.ts` — `output()`, `errorResponse()` functions (see Spec section 7)
- [ ] Create `src/helpers/content.ts` — `readContent()` function (see Spec section 8)
- [ ] Create `src/helpers/index.ts` — Barrel exports
  - **Outcome**: Common CLI patterns reusable across all tools

#### Step 5: Create Entrypoint

- [ ] Create `src/bin/aw.ts` — Shebang + import program + parse
- [ ] Create `src/program.ts` — Commander root program (initially empty, no subcommands yet)
- [ ] Create `src/index.ts` — Package barrel exports (MCPResponse, HTTPClient, helpers)
- [ ] Run `pnpm build` to verify compilation
- [ ] Run `pnpm link --global` to make `aw` available
- [ ] Test: `aw --help` should show help text
  - **Outcome**: Global `aw` command works

### Phase 2: Migrate Debate CLI — `@aweave/cli-debate`

> **Dependency**: NestJS server must be running (plan `260207-unified-nestjs-server.md`).
> The debate CLI is an HTTP client to the NestJS debate server. All data operations go through REST API.

#### Step 6: Create `@aweave/cli-debate` Package

- [ ] Create `devtools/common/cli-debate/` directory
- [ ] Create `package.json`:
  - name: `@aweave/cli-debate`
  - dependencies: `@aweave/cli` (workspace:*), `commander`
  - **Outcome**: Package initialized
- [ ] Create `tsconfig.json` (same pattern as cli-core)
- [ ] Update `devtools/pnpm-workspace.yaml`: add `common/cli-debate`
  - **Outcome**: Package in workspace

#### Step 7: Implement Debate Config

- [ ] Create `src/config.ts` — Port from Python `debate/config.py`:
  - `DEBATE_SERVER_URL` (default: `http://127.0.0.1:3456`)
  - `DEBATE_AUTH_TOKEN` (optional)
  - `DEBATE_WAIT_DEADLINE` (default: `120` seconds)
  - `POLL_INTERVAL` (default: `2` seconds) — NEW, replaces POLL_TIMEOUT
  - `DEBATE_SERVER_PORT`, `DEBATE_WEB_PORT`
  - `AUTO_START_SERVICES` (default: `true`)
  - **Outcome**: All env vars configurable

#### Step 8: Implement Debate Service Management

- [ ] Create `src/services.ts` — Port from Python `debate/services.py`:
  - pm2 process management (start, stop, status)
  - Health checks (HTTP ping)
  - Build checks (dist/ exists)
  - pnpm install/build if needed
  - Path: `devtools/common/server/` (unified NestJS server, NOT old debate-server)
  - pm2 ecosystem config: `devtools/common/server/ecosystem.config.cjs`
  - Service names: `aweave-server` (renamed from `debate-server`), `debate-web`
  - **Outcome**: `aw debate services start/stop/status` works

#### Step 9: Implement Debate CLI Commands

Port all commands from Python `debate/cli.py`:

- [ ] `generate-id` — Generate UUID
- [ ] `create` — Create debate with MOTION (with auto-start services)
- [ ] `get-context` — Get debate + arguments (with `readable_content=true`)
- [ ] `submit` — Submit CLAIM argument
- [ ] `wait` — **Interval polling** (NOT long polling):
  - Endpoint: `GET /debates/:id/poll` (not `/wait`)
  - Poll every `POLL_INTERVAL` (2s) with `sleep()` between requests
  - Standard 10s HTTP timeout (not 65s)
  - Same 120s overall deadline
  - Same MCPResponse output format
  - Same timeout retry command in output
- [ ] `appeal` — Submit APPEAL
- [ ] `request-completion` — Submit RESOLUTION
- [ ] `ruling` — Submit RULING (DEV-ONLY)
- [ ] `intervention` — Submit INTERVENTION (DEV-ONLY)
- [ ] `list` — List debates with pagination
- [ ] `services start/stop/status` — Service management subcommands

**Token optimization**: All write commands use `_filter_write_response()` pattern — strip content, keep only IDs/state/type/seq.

  - **Outcome**: All debate commands work with NestJS server

#### Step 10: Register Debate in Core

- [ ] Update `devtools/common/cli-core/src/program.ts`:
  ```typescript
  import { debateCommand } from '@aweave/cli-debate';
  program.addCommand(debateCommand);
  ```
- [ ] Rebuild cli-core: `pnpm build`
- [ ] Test all debate commands against running NestJS server
  - **Outcome**: `aw debate <command>` works end-to-end

### Phase 3: Migrate Bitbucket CLI — `@aweave/cli-bitbucket`

> **No server dependency** — Bitbucket CLI calls Bitbucket API directly.

#### Step 11: Create `@aweave/cli-bitbucket` Package

- [ ] Create `devtools/tinybots/cli-bitbucket/` directory
- [ ] Create `package.json`:
  - name: `@aweave/cli-bitbucket`
  - dependencies: `@aweave/cli` (workspace:*), `commander`
  - **Outcome**: Package initialized
- [ ] Create `tsconfig.json`
- [ ] Update `devtools/pnpm-workspace.yaml`: add `tinybots/cli-bitbucket`

#### Step 12: Implement Bitbucket Client & Models

- [ ] Create `src/models.ts` — Port from Python `bitbucket/models.py`:
  - `PullRequest`, `PRComment`, `PRTask`, `BitbucketUser` interfaces
  - `fromApi()` factory functions (replace Python `@classmethod from_api`)
  - `toDict()` serialization
  - **Outcome**: Same data models in TypeScript

- [ ] Create `src/client.ts` — Port from Python `bitbucket/client.py`:
  - `BitbucketClient` class using `HTTPClient` from `@aweave/cli`
  - Auto-pagination: `_fetchAllPages()` method
  - `getPR()`, `listPRComments()`, `listPRTasks()` methods
  - Returns `MCPResponse` objects
  - **Outcome**: Same API client behavior

#### Step 13: Implement Bitbucket CLI Commands

- [ ] Create `src/commands.ts` — Port from Python `bitbucket/cli.py`:
  - `pr <repo> <pr_id>` — Get PR details
  - `comments <repo> <pr_id>` — List PR comments (auto-pagination)
  - `tasks <repo> <pr_id>` — List PR tasks (auto-pagination)
  - Options: `--workspace` (default: `tinybots`), `--format`, `--max`
  - Env vars: `BITBUCKET_USER`, `BITBUCKET_APP_PASSWORD`
  - **Outcome**: All bitbucket commands work

#### Step 14: Register Bitbucket in Core

- [ ] Update `devtools/common/cli-core/src/program.ts`:
  ```typescript
  import { bitbucketCommand } from '@aweave/cli-bitbucket';
  program.addCommand(bitbucketCommand);
  ```
- [ ] Rebuild and test
  - **Outcome**: `aw tinybots-bitbucket <command>` works

### Phase 4: Migrate Docs CLI — `@aweave/cli-docs`

> **Direct SQLite access** — No server. Uses `better-sqlite3` for `~/.aweave/docstore.db`.

#### Step 15: Create `@aweave/cli-docs` Package

- [ ] Create `devtools/common/cli-docs/` directory
- [ ] Create `package.json`:
  - name: `@aweave/cli-docs`
  - dependencies: `@aweave/cli` (workspace:*), `commander`, `better-sqlite3`
  - devDependencies: `@types/better-sqlite3`
  - **Outcome**: Package initialized
- [ ] Create `tsconfig.json`
- [ ] Update `devtools/pnpm-workspace.yaml`: add `common/cli-docs`

#### Step 16: Implement Docs Database

- [ ] Create `src/db.ts` — Port from Python `docs/db.py`:
  - `getDbPath()`: `~/.aweave/docstore.db` (override via `AWEAVE_DB_PATH`)
  - `initDb()`: Create tables, WAL mode, schema versioning
  - `createDocument()`, `submitVersion()`, `getDocument()`, `listDocuments()`, `getHistory()`, `softDeleteDocument()`
  - Transaction with retry for version allocation
  - **Outcome**: Same database operations in TypeScript

#### Step 17: Implement Docs CLI Commands

- [ ] Create `src/commands.ts` — Port from Python `docs/cli.py`:
  - `create` — Create document (v1)
  - `submit <document_id>` — Submit new version
  - `get <document_id>` — Get document (supports `--format plain`)
  - `list` — List all documents
  - `history <document_id>` — Version history
  - `export <document_id>` — Export to file
  - `delete <document_id>` — Soft-delete
  - **Outcome**: All docs commands work

#### Step 18: Register Docs in Core

- [ ] Update `devtools/common/cli-core/src/program.ts`:
  ```typescript
  import { docsCommand } from '@aweave/cli-docs';
  program.addCommand(docsCommand);
  ```
- [ ] Rebuild and test
  - **Outcome**: `aw docs <command>` works

### Phase 5: Cleanup — Remove Python CLI

#### Step 19: Remove Python CLI Infrastructure

- [ ] Delete `devtools/common/cli/devtool/` directory (entire Python CLI)
- [ ] Remove Python workspace members from `devtools/pyproject.toml`:
  - Remove `common/cli/devtool` from `[tool.uv.workspace].members`
  - Remove `aweave` from dependencies
- [ ] Remove `devtools/tinybots/cli/bitbucket/` directory (Python bitbucket CLI)
  - Remove `tinybots/cli/bitbucket` from workspace members
  - Remove `tinybots-bitbucket` from dependencies
- [ ] Remove `devtools/nab/cli/confluence/` if not needed (or migrate separately)
- [ ] Consider removing `devtools/.venv/` and `devtools/uv.lock` if no Python remains
- [ ] Delete `devtools/scripts/generate-registry.py` (Node plugin registry no longer needed)
- [ ] Delete `devtools/scripts/install-all.sh` (or rewrite for TypeScript-only)
  - **Outcome**: No Python CLI code remains

#### Step 20: Update Documentation

- [ ] Update `devdocs/misc/devtools/OVERVIEW.md`:
  - Architecture: Single language (TypeScript), no Python plugins
  - Package structure: pnpm workspace packages
  - Plugin system: Commander.js `.addCommand()` pattern
  - Quick reference: Updated commands
- [ ] Update `devtools/CLI_TOOLS.md` if it exists
- [ ] Update `devdocs/misc/devtools/plans/debate.md` section 2.3:
  - CLI language: TypeScript (was Python)
  - Same command interface
  - Interval polling (was long polling)
  - **Outcome**: Documentation reflects new architecture

### Phase 6 (Future): ink Dashboard Features

> Not part of this migration. Documented here for planning.

- [ ] Add `ink` and `react` as dependencies to relevant CLI packages
- [ ] Create `aw debate dashboard` command — Real-time debate monitoring
- [ ] Create `aw services dashboard` command — Server/pm2 status
- [ ] These commands use `render()` from ink within Commander.js action handlers

## 📊 Summary of Results

> Do not summarize until implementation is done

### ✅ Completed Achievements

- [ ] ...

## 🚧 Outstanding Issues & Follow-up

### ⚠️ Issues/Clarifications

- [ ] **Confluence CLI** (`devtools/nab/cli/confluence/`): Currently a Python plugin. Decide whether to migrate to TypeScript or remove. Not included in this plan's scope.
- [ ] **Node plugin registry** (`aw-plugins.yaml`): No longer needed after migration since all CLI tools are TypeScript packages in the workspace. The `generate-registry.py` script and `node_loader.py` can be deleted.
- [ ] **Python dev tools** (`ruff`, `pytest`): If any Python remains in the monorepo for other purposes, the `pyproject.toml` may need to be kept. If zero Python, the entire Python toolchain can be removed.
- [ ] **ESM vs CJS**: Commander.js works with both. Recommend ESM (`"type": "module"` in package.json) for consistency with the NestJS server. Verify `better-sqlite3` works with ESM (it does via default import).
- [ ] **Node.js version**: Native `fetch` requires Node 18+. Recommend Node 20 LTS or 22 LTS.
- [ ] **Testing strategy**: Consider adding vitest for unit tests on MCP response format, state machine logic, etc. Not blocking for migration but recommended.
- [ ] **CI/CD**: If there's any CI pipeline, update to remove Python steps and add TypeScript build/test steps.
