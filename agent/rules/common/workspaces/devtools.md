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
| **Global Abstract** | `resources/workspaces/devtools/ABSTRACT.md` |
| **Global Overview** | `resources/workspaces/devtools/OVERVIEW.md` |
| **Package Abstract** | `resources/workspaces/devtools/<DOMAIN>/<PACKAGE_NAME>/ABSTRACT.md` |
| **Package Overview** | `resources/workspaces/devtools/<DOMAIN>/<PACKAGE_NAME>/OVERVIEW.md` |
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
├── ABSTRACT.md                     # Global short context (MUST read)
├── OVERVIEW.md                     # Global detailed context (conditional)
├── _plans/                         # Implementation plans
│   └── [YYMMDD-name].md
├── common/                         # Package-level documentation
│   ├── server/ABSTRACT.md          # NestJS server short context
│   ├── server/OVERVIEW.md          # NestJS server detailed context (conditional)
│   ├── nestjs-debate/ABSTRACT.md   # Debate module short context
│   ├── nestjs-debate/OVERVIEW.md   # Debate module detailed context (conditional)
│   ├── cli-<package>/ABSTRACT.md   # CLI package short context
│   ├── cli-<package>/OVERVIEW.md   # CLI package detailed context (conditional)
│   ├── <package>/ABSTRACT.md       # Other package short context
│   └── <package>/OVERVIEW.md       # Other package detailed context (conditional)
└── <domain>/                       # Domain-specific docs
```

## Required Context Loading

**Loading Order — MUST follow sequentially (general → specific → actionable):**

1. **ABSTRACT Chain (Required, based on scope):**
   - Global ABSTRACT: `resources/workspaces/devtools/ABSTRACT.md` (all scopes)
   - Package ABSTRACT (package scope only — pick matching pattern):
     - CLI packages: `resources/workspaces/devtools/<DOMAIN>/cli-<PACKAGE_NAME>/ABSTRACT.md`
     - NestJS modules: `resources/workspaces/devtools/<DOMAIN>/nestjs-<PACKAGE_NAME>/ABSTRACT.md`
     - Server: `resources/workspaces/devtools/<DOMAIN>/server/ABSTRACT.md`
     - Other: `resources/workspaces/devtools/<DOMAIN>/<PACKAGE_NAME>/ABSTRACT.md`

2. **OVERVIEW Chain (Conditional, based on ABSTRACT relevance):**
   - Global OVERVIEW: `resources/workspaces/devtools/OVERVIEW.md` (load only if Global ABSTRACT exists, non-empty, and relevant)
   - Package OVERVIEW (package scope only — pick matching pattern, load only if corresponding ABSTRACT exists, non-empty, and relevant):
     - CLI packages: `resources/workspaces/devtools/<DOMAIN>/cli-<PACKAGE_NAME>/OVERVIEW.md`
     - NestJS modules: `resources/workspaces/devtools/<DOMAIN>/nestjs-<PACKAGE_NAME>/OVERVIEW.md`
     - Server: `resources/workspaces/devtools/<DOMAIN>/server/OVERVIEW.md`
     - Other: `resources/workspaces/devtools/<DOMAIN>/<PACKAGE_NAME>/OVERVIEW.md`

3. **Referenced Files** (user-provided — plan, spike, guide, etc.):
   - Any file the user explicitly references or provides as input
   - Read AFTER ABSTRACT/OVERVIEW context is established

4. **Task Rule** (based on detected task type):
   - `agent/rules/common/tasks/create-plan.md` (Plan task)
   - `agent/rules/common/tasks/implementation.md` (Implementation / Refactoring task)

> **CRITICAL:**
>
> - `ABSTRACT.md` is mandatory at global/package scope levels (as applicable to detected scope).
> - If a required `ABSTRACT.md` is missing or empty, skip its corresponding `OVERVIEW.md` (do not load OVERVIEW for that level).
> - Never load an `OVERVIEW.md` without its corresponding `ABSTRACT.md`.
> - If no required ABSTRACT is available for detected scope, **STOP** and ask user to provide context before proceeding.

## Search Scope

Where to search for information, based on detected scope (in priority order):

| Scope | Search Locations |
|-------|------------------|
| **package** | 1. Package docs + Package ABSTRACT: `resources/workspaces/devtools/<DOMAIN>/<PACKAGE_NAME>/` 2. Source: `workspaces/devtools/<DOMAIN>/<PACKAGE_NAME>/` 3. Global ABSTRACT (then conditional OVERVIEW where relevant) |
| **global** | 1. Global docs + Global ABSTRACT: `resources/workspaces/devtools/` (all subfolders) 2. All package ABSTRACT files (then conditional OVERVIEW where relevant) 3. Source: `workspaces/devtools/` |

## Path Detection Examples

| User Input | Scope | Package Type | Package Abstract Path |
|------------|-------|--------------|----------------------|
| `workspaces/devtools/common/cli-core/` | package | CLI (core) | `resources/workspaces/devtools/common/cli-core/ABSTRACT.md` |
| `workspaces/devtools/common/cli-debate/` | package | CLI (debate) | `resources/workspaces/devtools/common/cli-debate/ABSTRACT.md` |
| `workspaces/devtools/common/server/` | package | NestJS Server | `resources/workspaces/devtools/common/server/ABSTRACT.md` |
| `workspaces/devtools/common/nestjs-debate/` | package | NestJS Module | `resources/workspaces/devtools/common/nestjs-debate/ABSTRACT.md` |
| `workspaces/devtools/nab/cli-confluence/` | package | Domain CLI | `resources/workspaces/devtools/nab/cli-confluence/ABSTRACT.md` |
| `resources/workspaces/devtools/common/_plans/260207-*.md` | global | Plan file | Load Global ABSTRACT + related package ABSTRACT, then conditional OVERVIEW |

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
- Pattern: `resources/workspaces/devtools/common/server/ABSTRACT.md` (required) then `resources/workspaces/devtools/common/server/OVERVIEW.md` (conditional) → "Adding a New Feature Module"

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
