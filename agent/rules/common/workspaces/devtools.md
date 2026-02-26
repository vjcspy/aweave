# DevTools Workspace

Workspace for development tools, CLI applications, and backend services — all TypeScript/Node.js.

## Path Variables

Extracted from user input:

| Variable | Pattern | Example |
|----------|---------|---------|
| `<DOMAIN>` | Folder directly under `workspaces/devtools/` | `common`, `nab` |
| `<PACKAGE_NAME>` | Specific package within domain | `server`, `cli-plugin-debate`, `nestjs-debate` |

## Scope Detection

Determine working scope from the path:

| Path Contains | Scope | Variables Required |
|---------------|-------|--------------------|
| `<DOMAIN>/<PACKAGE_NAME>/` (specific package) | **package** | DOMAIN, PACKAGE |
| `workspaces/devtools/` or `resources/workspaces/devtools/` only (no specific package) | **global** | — |

### Scope Detection Examples

| User Input | Scope | Reason |
|------------|-------|--------|
| `workspaces/devtools/common/server/src/main.ts` | package | specific package `server` under `common` |
| `resources/workspaces/devtools/common/cli-plugin-debate/OVERVIEW.md` | package | docs for `cli-plugin-debate` package |
| `resources/workspaces/devtools/common/_plans/260212-rename.md` | global | plan at root level, not package-specific |
| `workspaces/devtools/common/cli/` | package | specific package `cli` under `common` |

## Key Paths

| Purpose | Path |
|---------|------|
| **Source Code Root** | `workspaces/devtools/` |
| **Documentation Root** | `resources/workspaces/devtools/` |
| **Global Overview** | `resources/workspaces/devtools/OVERVIEW.md` |
| **Package Overview** | `resources/workspaces/devtools/<DOMAIN>/<PACKAGE_NAME>/OVERVIEW.md` |
| **Plans** | `resources/workspaces/devtools/common/_plans/` |
| **Memory (decisions/lessons)** | `user/memory/workspaces/devtools/` |

## Context Loading

**Preferred approach:** Use `workspace_get_context` tool for automated context retrieval.

```
workspace_get_context(workspace: "devtools")                    # defaults: structure + T0 + metadata + skills
workspace_get_context(workspace: "devtools", topics: "plans")   # add specific topics
```

**Manual loading (when tools unavailable):**

1. **OVERVIEW.md** at the relevant scope level — front-matter provides T0 summary (`name`, `description`)
   - Global: `resources/workspaces/devtools/OVERVIEW.md`
   - Package: `resources/workspaces/devtools/<DOMAIN>/<PACKAGE_NAME>/OVERVIEW.md`

2. **Referenced Files** — plan, spike, guide the user explicitly references

3. **Task Rule** — `agent/rules/common/tasks/create-plan.md` or `implementation.md`

## Search Scope

Where to search for information, based on detected scope (in priority order):

| Scope | Search Locations |
|-------|------------------|
| **package** | 1. Package docs: `resources/workspaces/devtools/<DOMAIN>/<PACKAGE_NAME>/` 2. Source: `workspaces/devtools/<DOMAIN>/<PACKAGE_NAME>/` 3. Global overview |
| **global** | 1. Global docs: `resources/workspaces/devtools/` (all subfolders) 2. Source: `workspaces/devtools/` |

## CLI Development

### CLI Architecture (oclif)

- Root CLI: `workspaces/devtools/common/cli/` — `@hod/aweave` (oclif app)
- Plugins: `workspaces/devtools/common/cli-plugin-<name>/` — each ships oclif commands
- Shared utilities: `workspaces/devtools/common/cli-shared/` — `@hod/aweave-cli-shared`
- Global install: `pnpm link --global` from `common/cli/` → `aw` available globally

### Adding New CLI Tools

1. Create package at `workspaces/devtools/common/cli-plugin-<name>/`
2. Configure oclif in package.json
3. Add to `pnpm-workspace.yaml` and `cli/package.json` oclif.plugins
4. Build: `cd workspaces/devtools && pnpm -r build`

### Backend Modules (NestJS)

- Server: `workspaces/devtools/common/server/` (imports all feature modules)
- Feature modules: `workspaces/devtools/common/nestjs-<feature>/` (separate pnpm packages)
- Pattern: Read `resources/workspaces/devtools/common/server/OVERVIEW.md` → "Adding a New Feature Module"

## Development Commands

| Task | Command |
|------|---------|
| Install all | `cd workspaces/devtools && pnpm install` |
| Build all | `cd workspaces/devtools && pnpm -r build` |
| Build specific | `cd workspaces/devtools/common/<pkg> && pnpm build` |
| Run CLI (global) | `aw <cmd>` |
| Start server | `cd workspaces/devtools && pm2 restart aweave-server` |

## Working with Plans

Plans are stored at: `resources/workspaces/devtools/common/_plans/`

Naming convention: `YYMMDD-<plan-name>.md`

When creating plans, use rule: `agent/rules/common/tasks/create-plan.md`
