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
| `resources/.../ho-omh-customer-loan-mods-web/_plans/260209-Add-Trace-Decorator.md` | repo | plan at repo level, no `_features/` |
| `workspaces/nab/hod/ho-omh-customer-loan-mods-web/app/server/src/main.ts` | repo | source code path under repo |
| `resources/workspaces/nab/OVERVIEW.md` | project | only project-level path |

## Key Paths

| Purpose | Path |
|---------|------|
| **Source Code** | `workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/` |
| **Global Overview** | `resources/workspaces/<PROJECT_NAME>/OVERVIEW.md` |
| **Repo Overview** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/OVERVIEW.md` |
| **Feature Overview** | `resources/.../<REPO_NAME>/_features/<FEATURE_NAME>/OVERVIEW.md` |
| **Features** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_features/` |
| **Plans** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_plans/` |
| **Spikes** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_spikes/` |
| **Architecture** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_architecture/` |
| **Guides** | `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_guides/` |
| **Memory** | `user/memory/workspaces/<PROJECT_NAME>/` |

## Context Loading

**Preferred approach:** Use `workspace_get_context` tool for automated context retrieval.

```
workspace_get_context(workspace: "<PROJECT_NAME>")
workspace_get_context(workspace: "<PROJECT_NAME>", domain: "<DOMAIN>", repository: "<REPO_NAME>")
workspace_get_context(workspace: "<PROJECT_NAME>", topics: "plans,features")
```

**Manual loading (when tools unavailable):**

1. **OVERVIEW.md Chain** (based on scope — front-matter provides T0 summary):
   - Global: `resources/workspaces/<PROJECT_NAME>/OVERVIEW.md` (all scopes)
   - Repo: `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/OVERVIEW.md` (repo + feature scope)
   - Feature: `resources/.../<REPO_NAME>/_features/<FEATURE_NAME>/OVERVIEW.md` (feature scope only)

2. **Referenced Files** — any file the user explicitly references

3. **Task Rule** — `agent/rules/common/tasks/create-plan.md` or `implementation.md`

## Search Scope

Where to search for information, based on detected scope (in priority order):

| Scope | Search Locations |
|-------|------------------|
| **feature** | 1. Feature docs: `resources/.../_features/<FEATURE_NAME>/` 2. Repo docs + source 3. Global overview |
| **repo** | 1. Repo docs: `resources/.../<REPO_NAME>/` 2. Source: `workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/` |
| **project** | 1. Project docs: `resources/workspaces/<PROJECT_NAME>/` 2. All repo overviews under this project |

## Working with Plans

Plans are stored at: `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_plans/`

Feature-specific plans: `resources/.../<REPO_NAME>/_features/<FEATURE_NAME>/_plans/`

Naming convention: `YYMMDD-<Name>.md`

When creating plans, use rule: `agent/rules/common/tasks/create-plan.md`

## Working with Features

Feature documentation is stored at: `resources/workspaces/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_features/<FEATURE_NAME>/`

Each feature folder contains:
- `OVERVIEW.md` — Feature context (front-matter has T0 summary)
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
