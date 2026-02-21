# Business Workspace

Workspace for business projects located in `workspaces/` folder.

## Path Variables

Extracted from user input:

| Variable | Pattern | Example |
|----------|---------|---------|
| `<PROJECT_NAME>` | Folder directly under `workspaces/` | `nab` |
| `<DOMAIN>` | Business domain within project | `hod`, `core`, `frontend` |
| `<REPO_NAME>` | Specific repository | `ho-omh-customer-loan-mods-web` |
| `<FEATURE_NAME>` | Feature folder under `_features/` | `new-MHL` |

## Scope Detection

Determine working scope from the deepest meaningful path segment:

| Path Contains | Scope | Variables Required |
|---------------|-------|--------------------|
| `_features/<FEATURE_NAME>/` | **feature** | PROJECT, DOMAIN, REPO, FEATURE |
| `<PROJECT>/<DOMAIN>/<REPO>/` (any subfolder or file) | **repo** | PROJECT, DOMAIN, REPO |
| `<PROJECT>/` only (no repo identified) | **project** | PROJECT |

### Scope Detection Examples

| User Input | Scope | Reason |
|------------|-------|--------|
| `resources/.../ho-omh-customer-loan-mods-web/_features/new-MHL/` | feature | path contains `_features/new-MHL/` |
| `resources/.../ho-omh-customer-loan-mods-web/_features/new-MHL/_plans/260209-Something.md` | feature | plan under `_features/new-MHL/` |
| `resources/.../ho-omh-customer-loan-mods-web/_plans/260209-Add-Trace-Decorator.md` | repo | plan at repo level, no `_features/` |
| `workspaces/nab/hod/ho-omh-customer-loan-mods-web/app/server/src/main.ts` | repo | source code path under repo |
| `resources/workspaces/nab/OVERVIEW.md` | project | only project-level path |

## Key Paths

| Purpose | Path |
|---------|------|
| **Global Abstract** | `resources/workspaces/<PROJECT_NAME>/ABSTRACT.md` |
| **Source Code** | `workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/` |
| **Global Overview** | `resources/workspaces/<PROJECT_NAME>/OVERVIEW.md` |
| **Repo Abstract** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/ABSTRACT.md` |
| **Repo Overview** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/OVERVIEW.md` |
| **Feature Abstract** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_features/<FEATURE_NAME>/ABSTRACT.md` |
| **Feature Overview** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_features/<FEATURE_NAME>/OVERVIEW.md` |
| **Features** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_features/` |
| **Plans** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_plans/` |
| **Spikes** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_spikes/` |
| **Architecture** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_architecture/` |
| **Guides** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_guides/` |
| **Releases** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_releases/` |
| **Local DevTools** | `workspaces/devtools/<PROJECT_NAME>/local/` |

## Required Context Loading

**Loading Order — MUST follow sequentially (general → specific → actionable):**

1. **ABSTRACT Chain (Required, based on scope — load up to detected level):**
   - Global ABSTRACT: `resources/workspaces/<PROJECT_NAME>/ABSTRACT.md` (all scopes)
   - Repo ABSTRACT: `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/ABSTRACT.md` (repo + feature scope)
   - Feature ABSTRACT: `resources/.../<REPO_NAME>/_features/<FEATURE_NAME>/ABSTRACT.md` (feature scope only)

2. **OVERVIEW Chain (Conditional, based on ABSTRACT relevance):**
   - Global OVERVIEW: `resources/workspaces/<PROJECT_NAME>/OVERVIEW.md` (load only if Global ABSTRACT exists, non-empty, and relevant)
   - Repo OVERVIEW: `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/OVERVIEW.md` (load only if Repo ABSTRACT exists, non-empty, and relevant)
   - Feature OVERVIEW: `resources/.../<REPO_NAME>/_features/<FEATURE_NAME>/OVERVIEW.md` (load only if Feature ABSTRACT exists, non-empty, and relevant)

3. **Referenced Files** (user-provided — plan, spike, guide, etc.):
   - Any file the user explicitly references or provides as input
   - Read AFTER ABSTRACT/OVERVIEW context is established

4. **Task Rule** (based on detected task type):
   - `agent/rules/common/tasks/create-plan.md` (Plan task)
   - `agent/rules/common/tasks/implementation.md` (Implementation / Refactoring task)

> **CRITICAL:**
> - `ABSTRACT.md` is mandatory at project/repo/feature scope levels (as applicable to detected scope).
> - If a required `ABSTRACT.md` is missing or empty, skip its corresponding `OVERVIEW.md` (do not load OVERVIEW for that level).
> - Never load an `OVERVIEW.md` without its corresponding `ABSTRACT.md`.
> - If no required ABSTRACT is available for detected scope, **STOP** and ask user to provide context.

## Search Scope

Where to search for information, based on detected scope (in priority order):

| Scope | Search Locations |
|-------|------------------|
| **feature** | 1. Feature docs + Feature ABSTRACT: `resources/.../_features/<FEATURE_NAME>/` (all subfolders) 2. Repo ABSTRACT + repo docs 3. Source: `workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/` |
| **repo** | 1. Repo docs + Repo ABSTRACT: `resources/.../<REPO_NAME>/` (all subfolders) 2. Source: `workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/` |
| **project** | 1. Project docs + Global ABSTRACT: `resources/workspaces/<PROJECT_NAME>/` 2. Repo ABSTRACT files under this project (then conditional OVERVIEW where relevant) |

## Working with Plans

Plans are stored at: `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_plans/`

Feature-specific plans: `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_features/<FEATURE_NAME>/_plans/`

Naming convention: `YYMMDD-<Name>.md`

When creating plans, use template: `agent/templates/common/create-plan.md`

## Working with Features

Feature documentation is stored at: `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_features/<FEATURE_NAME>/`

Each feature folder contains:
- `ABSTRACT.md` — Feature short context (mandatory)
- `OVERVIEW.md` — Feature detailed context (conditional, loaded only when ABSTRACT is relevant)
- `confluence/` — Source of truth documents from Confluence
- `notes/` — Extracted/analyzed notes
- `_plans/` — Feature-specific implementation plans

## Local Development

Each project may have local dev infrastructure at `workspaces/devtools/<PROJECT_NAME>/local/`:

- `docker-compose.yaml` — Local services
- `Justfile` — Common tasks
- `.env.example` — Environment template

Commands:
```bash
just -f workspaces/devtools/<PROJECT_NAME>/local/Justfile <command>
```
