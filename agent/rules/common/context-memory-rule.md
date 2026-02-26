<!-- budget: 80 lines -->
# Context & Memory Usage

## When to Load Workspace Context

Call `workspace_get_context` when the task involves:

- Workspace-specific code (path contains `workspaces/` or `resources/workspaces/`)
- Mentions of workspace, domain, or repository names
- Understanding project structure, conventions, or history
- Plans, features, or architecture decisions

**Skip context loading for:** General questions, simple file edits with sufficient inline context, infrastructure fixes unrelated to workspace logic.

## How to Use `workspace_get_context`

1. **First call** — Use defaults (no topics). Returns folder structure + T0 summaries + memory metadata.
2. **Decide topics** — Based on defaults, request what's needed: `plans`, `features`, `architecture`, `overview`, `decisions`, `lessons`.
3. **Follow-up calls** — Set `include_defaults: false` to skip redundant data.
4. **Filter** — Use tags/categories from memory metadata for targeted queries.

**Scope narrowing:**

- `workspace` only → aggregates across all domains/repos
- `workspace` + `domain` → narrows to that domain
- `workspace` + `domain` + `repository` → narrows to specific repo

## When to Save Memory

Detect these moments during work and save via `workspace_save_memory`:

| Trigger | What to save |
|---------|-------------|
| Hard-won fix (multiple failed attempts) | Lesson: root cause + solution |
| Non-obvious solution (not in existing docs) | Lesson: what worked and why |
| Architectural/design choice (made or confirmed) | Decision: choice + rationale |
| Contradicts existing memory | Prompt user to update/archive outdated entry |
| End of session | Auto-determine what's worth saving, write entries, report summary |

**Before saving:** Check for duplicates — call `workspace_get_context` with the relevant topic (`decisions` or `lessons`).

**Execution:** Save directly in the main conversation (not via sub-agent) to retain full context.

## Cold Memory Access

When warm tools don't surface needed context:

- Use `document_path` from tool responses → read full document directly
- Search `resources/workspaces/{scope}/` with keywords via Grep or SemanticSearch
- The workspace file structure is the index — no special tooling needed
