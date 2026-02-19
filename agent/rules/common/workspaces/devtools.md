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
| **Plans** | `resources/workspaces/devtools/common/_plans/` |

## Folder Structure

```
workspaces/devtools/                # Source code (100% TypeScript)
├── common/                         # Shared tools across all domains
│   ├── cli-core/                   # @hod/aweave — root CLI + shared utilities
│   ├── cli-debate/                 # @hod/aweave-debate — aw debate commands
│   ├── cli-docs/                   # @hod/aweave-docs — aw docs commands
│   ├── server/                     # @hod/aweave-server — unified NestJS server
│   ├── nestjs-debate/              # @hod/aweave-nestjs-debate — debate backend module
│   └── debate-web/                 # Next.js debate monitoring UI
├── <domain>/                       # Domain-specific tools
│   ├── cli-<tool>/                 # CLI packages for this domain
│   └── local/                      # Local dev infrastructure
└── pnpm-workspace.yaml             # pnpm workspace packages

resources/workspaces/devtools/      # Documentation
├── OVERVIEW.md                     # Global devtools overview (MUST read)
├── _plans/                         # Implementation plans
│   └── [YYMMDD-name].md
├── common/                         # Package-level documentation
│   ├── server/OVERVIEW.md          # NestJS server docs
│   ├── nestjs-debate/OVERVIEW.md   # Debate module docs
│   ├── cli-<package>/OVERVIEW.md   # CLI package docs
│   └── <package>/OVERVIEW.md       # Other package docs
└── <domain>/                       # Domain-specific docs
```

## Required Context Loading

**Loading Order — MUST follow sequentially (general → specific → actionable):**

1. **OVERVIEW Chain** (based on scope):
   - Global OVERVIEW: `resources/workspaces/devtools/OVERVIEW.md` (all scopes)
   - Package OVERVIEW (package scope only — pick matching pattern):
     - CLI packages: `resources/workspaces/devtools/<DOMAIN>/cli-<PACKAGE_NAME>/OVERVIEW.md`
     - NestJS modules: `resources/workspaces/devtools/<DOMAIN>/nestjs-<PACKAGE_NAME>/OVERVIEW.md`
     - Server: `resources/workspaces/devtools/<DOMAIN>/server/OVERVIEW.md`
     - Other: `resources/workspaces/devtools/<DOMAIN>/<PACKAGE_NAME>/OVERVIEW.md`

2. **Referenced Files** (user-provided — plan, spike, guide, etc.):
   - Any file the user explicitly references or provides as input
   - Read AFTER OVERVIEW chain so project context is established first

3. **Task Rule** (based on detected task type):
   - `agent/rules/common/tasks/create-plan.md` (Plan task)
   - `agent/rules/common/tasks/implementation.md` (Implementation / Refactoring task)

> **CRITICAL:** If Global Overview does not exist or is empty, **STOP** and ask user to provide context before proceeding.

## Search Scope

Where to search for information, based on detected scope (in priority order):

| Scope | Search Locations |
|-------|------------------|
| **package** | 1. Package docs: `resources/workspaces/devtools/<DOMAIN>/<PACKAGE_NAME>/` 2. Source: `workspaces/devtools/<DOMAIN>/<PACKAGE_NAME>/` 3. Global OVERVIEW |
| **global** | 1. Global docs: `resources/workspaces/devtools/` (all subfolders) 2. All package OVERVIEWs 3. Source: `workspaces/devtools/` |

## Skill Loading

Load skill when task matches trigger. Read **after** context loading above.

| Skill | Trigger | Path |
|-------|---------|------|
| `devtools-cli-builder` | Create/modify CLI plugins, oclif commands, NestJS modules, API integration | `agent/skills/common/devtools-cli-builder/SKILL.md` |

## Path Detection Examples

| User Input | Scope | Package Type | Package Overview Path |
|------------|-------|--------------|----------------------|
| `workspaces/devtools/common/cli-core/` | package | CLI (core) | `resources/workspaces/devtools/common/cli-core/OVERVIEW.md` |
| `workspaces/devtools/common/cli-debate/` | package | CLI (debate) | `resources/workspaces/devtools/common/cli-debate/OVERVIEW.md` |
| `workspaces/devtools/common/server/` | package | NestJS Server | `resources/workspaces/devtools/common/server/OVERVIEW.md` |
| `workspaces/devtools/common/nestjs-debate/` | package | NestJS Module | `resources/workspaces/devtools/common/nestjs-debate/OVERVIEW.md` |
| `workspaces/devtools/nab/cli-confluence/` | package | Domain CLI | `resources/workspaces/devtools/nab/cli-confluence/OVERVIEW.md` |
| `resources/workspaces/devtools/common/_plans/260207-*.md` | global | Plan file | Load Global OVERVIEW + related package OVERVIEW |

## CLI Development

### CLI Architecture (Commander.js)

- Root program: `workspaces/devtools/common/cli-core/src/program.ts`
- Each domain exports a Commander `Command` object
- Root composes via `.addCommand()`
- Global install: `pnpm add -g @hod/aweave` → `aw` available globally
- Run dev mode: `cd workspaces/devtools/common/cli-core && node dist/bin/aw.js <cmd>`

### Adding New CLI Tools

1. Create package at `workspaces/devtools/<domain>/cli-<name>/`
2. Export Commander `Command` from package
3. Add to `pnpm-workspace.yaml`
4. Register in `cli-core/src/program.ts`
5. Build: `pnpm build`

### Backend Modules (NestJS)

- Server: `workspaces/devtools/common/server/` (imports all feature modules)
- Feature modules: `workspaces/devtools/<domain>/nestjs-<feature>/` (separate pnpm packages)
- Pattern: `resources/workspaces/devtools/common/server/OVERVIEW.md` → "Adding a New Feature Module"

## Development Commands

| Task | Command |
|------|---------|
| Install all | `cd workspaces/devtools && pnpm install` |
| Build all | `cd workspaces/devtools && pnpm -r build` |
| Build specific | `cd workspaces/devtools/common/<pkg> && pnpm build` |
| Run CLI (dev) | `cd workspaces/devtools/common/cli-core && node dist/bin/aw.js <cmd>` |
| Run CLI (global) | `aw <cmd>` |
| Start server | `cd workspaces/devtools/common/server && node dist/main.js` |

## Working with Plans

Plans are stored at: `resources/workspaces/devtools/common/_plans/`

Naming convention: `[YYMMDD-name].md`

When creating plans, use template: `agent/templates/common/create-plan.md`
