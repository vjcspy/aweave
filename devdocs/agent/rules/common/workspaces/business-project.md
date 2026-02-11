# Business Project Workspace

Workspace for business projects located in `projects/` folder.

## Path Variables

Extracted from user input:

| Variable | Pattern | Example |
|----------|---------|---------|
| `<PROJECT_NAME>` | Folder directly under `projects/` | `tinybots`, `nab` |
| `<DOMAIN>` | Business domain within project | `backend`, `frontend`, `core` |
| `<REPO_NAME>` | Specific repository | `wonkers-api`, `user-service` |

## Key Paths

| Purpose | Path |
|---------|------|
| **Source Code** | `projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/` |
| **Global Overview** | `devdocs/projects/<PROJECT_NAME>/OVERVIEW.md` |
| **Repo Overview** | `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/OVERVIEW.md` |
| **Plans** | `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_plans/` |
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

3. **Project Structure** (if need to understand folder structure)
   ```
   devdocs/agent/rules/common/project-structure.md
   ```

> **CRITICAL:** If any required overview file does not exist or is empty, **STOP** and ask user to provide context before proceeding.

## Path Detection Examples

| User Input | Extracted Variables |
|------------|---------------------|
| `projects/tinybots/backend/wonkers-api/src/app.ts` | PROJECT=tinybots, DOMAIN=backend, REPO=wonkers-api |
| `devdocs/projects/tinybots/backend/wonkers-graphql/_plans/251223-PROD.md` | PROJECT=tinybots, DOMAIN=backend, REPO=wonkers-graphql |
| `devdocs/projects/nab/OVERVIEW.md` | PROJECT=nab (no specific repo) |

## Working with Plans

Plans are stored at: `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_plans/`

Naming convention: `[YYMMDD-Ticket-Name].md`

When creating plans, use template: `devdocs/agent/templates/common/create-plan.md`

## Local Development

Each project may have local dev infrastructure at `devtools/<PROJECT_NAME>/local/`:

- `docker-compose.yaml` — Local services
- `Justfile` — Common tasks
- `.env.example` — Environment template

Commands:
```bash
just -f devtools/<PROJECT_NAME>/local/Justfile <command>
```
