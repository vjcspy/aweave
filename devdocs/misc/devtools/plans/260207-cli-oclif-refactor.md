# 📋 [CLI-OCLIF: 2026-02-07] - Refactor CLI from Commander.js to oclif Plugin Architecture

## References

- Previous migration plan (superseded): `devdocs/misc/devtools/plans/260207-cli-typescript-migration.md`
- DevTools overview: `devdocs/misc/devtools/OVERVIEW.md`
- Debate ecosystem spec: `devdocs/misc/devtools/plans/debate.md`
- Unified NestJS server plan: `devdocs/misc/devtools/plans/260207-unified-nestjs-server.md`

## Background & Decision Context

> This plan supersedes the Commander.js approach from `260207-cli-typescript-migration.md`.

The `aw` CLI was initially migrated from Python to TypeScript using Commander.js. While functional, Commander.js showed architectural issues for a **multi-domain platform CLI**:

1. **Cyclic dependencies** — cli-core depended on plugins (to load them), plugins depended on cli-core (for utilities). pnpm warned about this.
2. **Fragile plugin loading** — `try { require() } catch {}` in bin/aw.ts. Silent failures, no standard discovery.
3. **Adding a domain = editing core** — Every new plugin required modifying cli-core's package.json AND bin/aw.ts.

### Why oclif?

`aw` is a **platform CLI** that serves multiple domains (`common/`, `tinybots/`, `nab/`, future domains). oclif provides:

- **Standard plugin system** — Plugins declared in `oclif.plugins` config, auto-discovered at runtime
- **No cyclic dependencies** — Shared utilities in `@aweave/cli-shared`, both main CLI and plugins depend on it independently
- **File-based command routing** — `src/commands/debate/create.ts` → `aw debate create`
- **Built-in flag validation** — Type-safe flags with required/optional, options validation
- **Manifest caching** — `oclif.manifest.json` for fast command lookup

### Architecture

```
@aweave/cli-shared (pure utilities — MCPResponse, HTTPClient, helpers)
     ↑                    ↑
     |                    |
@aweave/cli          @aweave/cli-plugin-*
(oclif main)         (oclif plugins)
```

No cycles. `@aweave/cli-shared` is a leaf dependency that both the main CLI and all plugins depend on.

## Current State (Post-Refactor Audit)

> The oclif refactor has been **completed**. This section documents what exists now.

### Packages

| Package | npm name | Folder | Status |
|---------|----------|--------|--------|
| CLI Shared | `@aweave/cli-shared` | `devtools/common/cli-shared/` | ✅ Complete — pure utility library, no framework deps |
| CLI Main | `@aweave/cli` | `devtools/common/cli/` | ✅ Complete — oclif app with `bin/run.js`, plugins declared |
| Debate Plugin | `@aweave/cli-plugin-debate` | `devtools/common/cli-plugin-debate/` | ✅ Complete — 11 commands under `aw debate *` |
| Docs Plugin | `@aweave/cli-plugin-docs` | `devtools/common/cli-plugin-docs/` | ✅ Complete — 7 commands under `aw docs *` |
| Bitbucket Plugin | `@aweave/cli-plugin-tinybots-bitbucket` | `devtools/tinybots/cli-plugin-bitbucket/` | ✅ Complete — domain plugin |

### Commander.js Removal

- Old `cli-core/` package: **Deleted** (no longer in `devtools/common/`)
- Old `cli-debate/`, `cli-docs/`: **Deleted** (replaced by `cli-plugin-*`)
- No `commander` dependency in any CLI package (only exists as transitive dep of unrelated tools like NestJS CLI, Next.js)

### Dependency Graph (verified, no cycles)

```
@aweave/cli (oclif main)
  ├── @aweave/cli-shared
  ├── @aweave/cli-plugin-debate ──► @aweave/cli-shared
  ├── @aweave/cli-plugin-docs ──► @aweave/cli-shared, better-sqlite3
  └── @aweave/cli-plugin-tinybots-bitbucket ──► @aweave/cli-shared
```

### oclif Config (in `devtools/common/cli/package.json`)

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
      "@aweave/cli-plugin-tinybots-bitbucket"
    ]
  }
}
```

Key: `topicSeparator: " "` ensures commands remain `aw debate create` (not `aw debate:create`).

### Plugin Scope

All plugins are **workspace-only (internal)** — marked `"private": true`, referenced via `workspace:*`. Not published to npm. No external install support intended.

## 🎯 Objective

~~Refactor the `aw` CLI from Commander.js to oclif plugin architecture, eliminating cyclic dependencies and establishing a scalable multi-domain plugin pattern.~~

**Updated:** The core refactor is **complete**. Remaining objective is to verify correctness, update documentation, and finalize cleanup.

### ⚠️ Key Considerations

1. **All business logic is preserved** — MCP response models, HTTP client, debate/docs/bitbucket logic are unchanged. Only the command registration pattern changed.
2. **MCP response format unchanged** — The JSON output contract with AI agents is identical.
3. **oclif uses CommonJS** — All packages use `"module": "commonjs"` in tsconfig for oclif compatibility.

## Compatibility Contract (Must Not Change)

> This defines the CLI surface that AI agents and automation depend on. Any regression here breaks the agent toolchain.

### Command Surface

| Command | Type | Must Preserve |
|---------|------|---------------|
| `aw debate generate-id` | No args | JSON output with `id` field |
| `aw debate create --debate-id <id> --title "..." --type <type> --content "..." --client-request-id <id>` | Flags | All flag names, `argument_id` in response |
| `aw debate get-context --debate-id <id> --limit <n>` | Flags | `debate.state`, `arguments[]` in response |
| `aw debate submit --debate-id <id> --role <role> --target-id <id> --content "..." --client-request-id <id>` | Flags | `argument_id` in response |
| `aw debate wait --debate-id <id> --argument-id <id> --role <role>` | Flags | `action`, `argument`, timeout retry format |
| `aw debate appeal --debate-id <id> --target-id <id> --content "..." --client-request-id <id>` | Flags | `argument_id` in response |
| `aw debate request-completion --debate-id <id> --target-id <id> --content "..." --client-request-id <id>` | Flags | `argument_id` in response |
| `aw docs create --file <path> --summary "..."` | Flags | `document_id`, `version` in response |
| `aw docs create --content "..." --summary "..."` | Flags (inline) | `document_id`, `version` in response |
| `aw docs create --stdin --summary "..."` | Flags (stdin pipe) | `document_id`, `version` in response |
| `aw docs get <document_id>` | **Positional arg** | `content`, `version` in response (JSON/markdown format) |
| `aw docs get <document_id> --format plain` | **Positional arg + flag** | Raw content only (no MCPResponse wrapper) |
| `aw docs submit <document_id> --file <path> --summary "..."` | **Positional arg + flags** | `version` in response |
| `aw docs list` | No args | List of documents |
| `aw docs delete <document_id>` | Positional arg | Deletion confirmation |

### Output Contract

- All commands output `MCPResponse` JSON format: `{ success, content, metadata, has_more, total_count }`
- Debate write commands (create/submit/appeal/request-completion) return IDs and metadata only (token optimization)
- Docs write commands (create/submit) return the document object including `document_id`, `version`
- Exit code `0` on success, non-zero on error
- Error format: `{ success: false, error: { code, message, suggestion? } }` — `suggestion` field is optional and provides recovery hints

### Wait Semantics

- `aw debate wait` uses **client-side interval polling** (NOT long-polling)
- Endpoint: `GET /debates/:id/poll` with query params `argument_id`, `role`
- Polls every `DEBATE_POLL_INTERVAL` seconds (default: `2s`, env: `DEBATE_POLL_INTERVAL`)
- Overall deadline: `DEBATE_WAIT_DEADLINE` seconds (default: `120s`, env: `DEBATE_WAIT_DEADLINE`)
- On new argument: returns `{ status: "new_argument", action, debate_state, argument, next_argument_id_to_wait }`
- On timeout: returns `{ status: "timeout", debate_id, last_argument_id, last_seen_seq, retry_command }`
- Client must retry on timeout (not an error, expected behavior)

### Recovery (If Global CLI Breaks)

If `aw` becomes unusable after a build or link change:

1. `cd devtools && pnpm -r build` — rebuild all packages
2. `cd devtools/common/cli && pnpm link --global` — re-link global binary
3. `aw --version` — verify recovery
4. If plugin discovery fails: check `oclif.plugins` in `devtools/common/cli/package.json` matches installed packages

## 📐 Package Structure

| Package | npm name | Folder | Dependencies |
|---------|----------|--------|--------------|
| CLI Shared | `@aweave/cli-shared` | `devtools/common/cli-shared/` | (none) |
| CLI Main | `@aweave/cli` | `devtools/common/cli/` | `@oclif/core`, `cli-shared`, all plugins |
| Debate Plugin | `@aweave/cli-plugin-debate` | `devtools/common/cli-plugin-debate/` | `@oclif/core`, `cli-shared` |
| Docs Plugin | `@aweave/cli-plugin-docs` | `devtools/common/cli-plugin-docs/` | `@oclif/core`, `cli-shared`, `better-sqlite3` |
| Bitbucket Plugin | `@aweave/cli-plugin-tinybots-bitbucket` | `devtools/tinybots/cli-plugin-bitbucket/` | `@oclif/core`, `cli-shared` |

## 🔄 Implementation Plan

### Phase 1: Create @aweave/cli-shared ✅ DONE

- Moved mcp/, http/, helpers/, services/ from old cli-core
- Removed Commander.js, bin/, program.ts dependencies
- Pure utilities package, no CLI framework dependency
- Package: `devtools/common/cli-shared/`, no external deps

### Phase 2: Create @aweave/cli (oclif main) ✅ DONE

- New oclif CLI with `bin/run.js`, `bin/dev.js`
- oclif config declaring all plugins in `package.json`
- `topicSeparator: " "` for space-separated commands
- `pnpm link --global` for system-wide `aw` command

### Phase 3: Convert plugins to oclif ✅ DONE

- Each command → one file in `src/commands/<topic>/<command>.ts`
- Commander chains → oclif Command classes with static flags
- Import `@aweave/cli-shared` instead of `@aweave/cli`
- Plugins: debate (11 commands), docs (7 commands), bitbucket

### Phase 4: Cleanup & Verification ⬜ REMAINING

#### 4.1 Old Package Cleanup ✅ DONE

- [x] Delete old `cli-core/` (Commander.js root)
- [x] Delete old `cli-debate/`, `cli-docs/` (Commander-based plugins)
- [x] Update `pnpm-workspace.yaml` to remove old packages

#### 4.2 Documentation Updates ⬜ TODO

- [ ] Verify `devdocs/misc/devtools/OVERVIEW.md` matches current oclif architecture
- [ ] Verify `devdocs/misc/devtools/common/cli/OVERVIEW.md` references oclif patterns
- [ ] Verify `devdocs/misc/devtools/common/cli-plugin-debate/OVERVIEW.md` is current
- [ ] Verify `devdocs/misc/devtools/common/cli-plugin-docs/OVERVIEW.md` is current
- [ ] Verify `devdocs/agent/rules/common/workspaces/devtools.md` references oclif (not Commander)
- [ ] Remove references to `cli-core/`, `dist/bin/aw.js`, `program.ts` from all docs

#### 4.3 Smoke Test Verification ⬜ TODO

Run the following commands to verify compatibility:

```bash
# Build
cd devtools && pnpm -r build

# Basic CLI
aw --help
aw --version

# Debate commands
aw debate generate-id
aw debate create --help
aw debate get-context --help
aw debate wait --help

# Docs commands (positional arg verification)
aw docs create --help
aw docs get --help
aw docs list

# Plugin discovery
aw debate --help    # should show all debate subcommands
aw docs --help      # should show all docs subcommands
```

#### 4.4 Global Link Verification ⬜ TODO

```bash
cd devtools/common/cli
pnpm link --global
which aw              # should point to oclif bin/run.js
aw debate generate-id # should work from any directory
```

## 📊 Summary of Results

> Updated post-refactor.

### ✅ Completed Achievements

- [x] Commander.js → oclif migration complete
- [x] Cyclic dependency between cli-core ↔ plugins eliminated
- [x] `@aweave/cli-shared` as clean leaf dependency (no framework deps)
- [x] 3 plugins operational: debate, docs, bitbucket
- [x] Space-separated topic routing (`aw debate create`, not `aw debate:create`)
- [x] `pnpm-workspace.yaml` updated with new package paths
- [x] Old Commander packages deleted

### ⬜ Remaining

- [ ] Documentation audit and update (Phase 4.2)
- [ ] Full smoke test verification (Phase 4.3)
- [ ] Global link re-verification (Phase 4.4)
