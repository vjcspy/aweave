# DevTools Workspace

Workspace for development tools, CLI applications, and backend services — all TypeScript/Node.js.

## Path Variables

Extracted from user input:

| Variable | Pattern | Example |
|----------|---------|---------|
| `<DOMAIN>` | Folder directly under `devtools/` | `common`, `nab` |
| `<PACKAGE_NAME>` | Specific package within domain | `server`, `cli-plugin-debate`, `nestjs-debate` |

## Scope Detection

Determine working scope from the path:

| Path Contains | Scope | Variables Required |
|---------------|-------|--------------------|
| `<DOMAIN>/<PACKAGE_NAME>/` (specific package) | **package** | DOMAIN, PACKAGE |
| `devtools/` or `devdocs/misc/devtools/` only (no specific package) | **global** | — |

### Scope Detection Examples

| User Input | Scope | Reason |
|------------|-------|--------|
| `devtools/common/server/src/main.ts` | package | specific package `server` under `common` |
| `devdocs/misc/devtools/common/cli-plugin-debate/OVERVIEW.md` | package | docs for `cli-plugin-debate` package |
| `devdocs/misc/devtools/common/_plans/260212-rename.md` | global | plan at root level, not package-specific |
| `devtools/common/cli/` | package | specific package `cli` under `common` |

## Key Paths

| Purpose | Path |
|---------|------|
| **Source Code Root** | `devtools/` |
| **Documentation Root** | `devdocs/misc/devtools/` |
| **Global Overview** | `devdocs/misc/devtools/OVERVIEW.md` |
| **Plans** | `devdocs/misc/devtools/common/_plans/` |

## Folder Structure

```
devtools/                           # Source code (100% TypeScript)
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

devdocs/misc/devtools/              # Documentation
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
   - Global OVERVIEW: `devdocs/misc/devtools/OVERVIEW.md` (all scopes)
   - Package OVERVIEW (package scope only — pick matching pattern):
     - CLI packages: `devdocs/misc/devtools/<DOMAIN>/cli-<PACKAGE_NAME>/OVERVIEW.md`
     - NestJS modules: `devdocs/misc/devtools/<DOMAIN>/nestjs-<PACKAGE_NAME>/OVERVIEW.md`
     - Server: `devdocs/misc/devtools/<DOMAIN>/server/OVERVIEW.md`
     - Other: `devdocs/misc/devtools/<DOMAIN>/<PACKAGE_NAME>/OVERVIEW.md`

2. **Referenced Files** (user-provided — plan, spike, guide, etc.):
   - Any file the user explicitly references or provides as input
   - Read AFTER OVERVIEW chain so project context is established first

3. **Task Rule** (based on detected task type):
   - `devdocs/agent/rules/common/tasks/create-plan.md` (Plan task)
   - `devdocs/agent/rules/common/tasks/implementation.md` (Implementation / Refactoring task)

> **CRITICAL:** If Global Overview does not exist or is empty, **STOP** and ask user to provide context before proceeding.

## Search Scope

Where to search for information, based on detected scope (in priority order):

| Scope | Search Locations |
|-------|------------------|
| **package** | 1. Package docs: `devdocs/misc/devtools/<DOMAIN>/<PACKAGE_NAME>/` 2. Source: `devtools/<DOMAIN>/<PACKAGE_NAME>/` 3. Global OVERVIEW |
| **global** | 1. Global docs: `devdocs/misc/devtools/` (all subfolders) 2. All package OVERVIEWs 3. Source: `devtools/` |

## Skill Loading

Load skill when task matches trigger. Read **after** context loading above.

| Skill | Trigger | Path |
|-------|---------|------|
| `devtools-cli-builder` | Create/modify CLI plugins, oclif commands, NestJS modules, API integration | `devdocs/agent/skills/common/devtools-cli-builder/SKILL.md` |

## Path Detection Examples

| User Input | Scope | Package Type | Package Overview Path |
|------------|-------|--------------|----------------------|
| `devtools/common/cli-core/` | package | CLI (core) | `devdocs/misc/devtools/common/cli-core/OVERVIEW.md` |
| `devtools/common/cli-debate/` | package | CLI (debate) | `devdocs/misc/devtools/common/cli-debate/OVERVIEW.md` |
| `devtools/common/server/` | package | NestJS Server | `devdocs/misc/devtools/common/server/OVERVIEW.md` |
| `devtools/common/nestjs-debate/` | package | NestJS Module | `devdocs/misc/devtools/common/nestjs-debate/OVERVIEW.md` |
| `devtools/nab/cli-confluence/` | package | Domain CLI | `devdocs/misc/devtools/nab/cli-confluence/OVERVIEW.md` |
| `devdocs/misc/devtools/common/_plans/260207-*.md` | global | Plan file | Load Global OVERVIEW + related package OVERVIEW |

## CLI Development

### CLI Architecture (Commander.js)

- Root program: `devtools/common/cli-core/src/program.ts`
- Each domain exports a Commander `Command` object
- Root composes via `.addCommand()`
- Global install: `pnpm add -g @hod/aweave` → `aw` available globally
- Run dev mode: `cd devtools/common/cli-core && node dist/bin/aw.js <cmd>`

### Adding New CLI Tools

1. Create package at `devtools/<domain>/cli-<name>/`
2. Export Commander `Command` from package
3. Add to `pnpm-workspace.yaml`
4. Register in `cli-core/src/program.ts`
5. Build: `pnpm build`

### Backend Modules (NestJS)

- Server: `devtools/common/server/` (imports all feature modules)
- Feature modules: `devtools/<domain>/nestjs-<feature>/` (separate pnpm packages)
- Pattern: `devdocs/misc/devtools/common/server/OVERVIEW.md` → "Adding a New Feature Module"

## Development Commands

| Task | Command |
|------|---------|
| Install all | `cd devtools && pnpm install` |
| Build all | `cd devtools && pnpm -r build` |
| Build specific | `cd devtools/common/<pkg> && pnpm build` |
| Run CLI (dev) | `cd devtools/common/cli-core && node dist/bin/aw.js <cmd>` |
| Run CLI (global) | `aw <cmd>` |
| Start server | `cd devtools/common/server && node dist/main.js` |

## Working with Plans

Plans are stored at: `devdocs/misc/devtools/common/_plans/`

Naming convention: `[YYMMDD-name].md`

When creating plans, use template: `devdocs/agent/templates/common/create-plan.md`
