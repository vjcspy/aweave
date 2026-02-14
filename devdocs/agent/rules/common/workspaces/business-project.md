# Business Project Workspace

Workspace for business projects located in `projects/` folder.

## Path Variables

Extracted from user input:

| Variable | Pattern | Example |
|----------|---------|---------|
| `<PROJECT_NAME>` | Folder directly under `projects/` | `nab` |
| `<DOMAIN>` | Business domain within project | `backend`, `frontend`, `core` |
| `<REPO_NAME>` | Specific repository | `ho-omh-customer-loan-mods-web`, `ho-omh-loanmodifications-api` |

## Key Paths

| Purpose | Path |
|---------|------|
| **Source Code** | `projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/` |
| **Global Overview** | `devdocs/projects/<PROJECT_NAME>/OVERVIEW.md` |
| **Repo Overview** | `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/OVERVIEW.md` |
| **Features** | `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_features/` |
| **Plans** | `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_plans/` |
| **Spikes** | `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_spikes/` |
| **Architecture** | `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_architecture/` |
| **Guides** | `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_guides/` |
| **Releases** | `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_releases/` |
| **Local DevTools** | `devtools/<PROJECT_NAME>/local/` |

## Required Context Loading

**Loading Order — MUST follow sequentially:**

1. **Global Overview** (if working on any repo within project)
   ```
   devdocs/projects/<PROJECT_NAME>/OVERVIEW.md
   ```

2. **Repo Overview** (if working on specific repository)
   ```
   devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/OVERVIEW.md
   ```

3. **Feature Overview** (if working on a specific feature)
   ```
   devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_features/<FEATURE_NAME>/OVERVIEW.md
   ```

4. **Project Structure** (if need to understand folder structure)
   ```
   devdocs/agent/rules/common/project-structure.md
   ```

> **CRITICAL:** If any required overview file does not exist or is empty, **STOP** and ask user to provide context before proceeding.

## Path Detection Examples

| User Input | Extracted Variables |
|------------|---------------------|
| `projects/nab/hod/ho-omh-customer-loan-mods-web/app/server/src/main.ts` | PROJECT=nab, DOMAIN=hod, REPO=ho-omh-customer-loan-mods-web |
| `devdocs/projects/nab/hod/ho-omh-loanmodifications-api/_plans/260115-Kafka-Refactor.md` | PROJECT=nab, DOMAIN=hod, REPO=ho-omh-loanmodifications-api |
| `devdocs/projects/nab/hod/ho-omh-customer-loan-mods-web/_features/new-MHL/` | PROJECT=nab, DOMAIN=hod, REPO=ho-omh-customer-loan-mods-web, FEATURE=new-MHL |
| `devdocs/projects/nab/OVERVIEW.md` | PROJECT=nab (no specific repo) |

## Working with Plans

Plans are stored at: `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_plans/`

Feature-specific plans: `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_features/<FEATURE_NAME>/_plans/`

Naming convention: `YYMMDD-<Name>.md`

When creating plans, use template: `devdocs/agent/templates/common/create-plan.md`

## Working with Features

Feature documentation is stored at: `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_features/<FEATURE_NAME>/`

Each feature folder contains:
- `OVERVIEW.md` — Feature overview (mandatory)
- `confluence/` — Source of truth documents from Confluence
- `notes/` — Extracted/analyzed notes
- `_plans/` — Feature-specific implementation plans

## Local Development

Each project may have local dev infrastructure at `devtools/<PROJECT_NAME>/local/`:

- `docker-compose.yaml` — Local services
- `Justfile` — Common tasks
- `.env.example` — Environment template

Commands:
```bash
just -f devtools/<PROJECT_NAME>/local/Justfile <command>
```
