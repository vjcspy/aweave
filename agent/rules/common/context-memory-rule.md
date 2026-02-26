<!-- budget: 80 lines -->
# Context & Memory Usage

## When to Load Workspace Context

Call `workspace_get_context` when the task involves:

- Workspace-specific code (path contains `workspaces/` or `resources/workspaces/`)
- Mentions of workspace, domain, or repository names
- Understanding project structure, conventions, or history
- Plans, features, architecture, decisions, or lessons

**Skip context loading for:** General questions, simple file edits with sufficient inline context, infrastructure fixes unrelated to workspace logic.

## How to Use `workspace_get_context`

**Initial orientation:** Call with defaults (no topics) to get folder structure + T0 summaries + available skills.

**During the conversation** — call again with specific topics whenever more context is needed:

- Request topics as needed: `plans`, `features`, `architecture`, `overview`, `decisions`, `lessons`, or any `_{topicName}/` folder
- Set `include_defaults: false` on follow-up calls to skip redundant data
- Use `filter_status`, `filter_tags`, `filter_category` for targeted queries — available values are visible in T0 summaries from previous topic responses

**Scope narrowing:**

- `workspace` only → aggregates across all domains/repos
- `workspace` + `domain` → narrows to that domain
- `workspace` + `domain` + `repository` → narrows to specific repo

**Topic discovery:** Topics map to `_{topicName}/` folders in `resources/`. Adding a new topic = creating a `_{topicName}/` folder with `.md` files (front-matter for T0). No code changes needed.

## When to Save Decisions & Lessons

Decisions and lessons are regular files in `resources/workspaces/{scope}/_{decisions,lessons}/`. Save them directly using file write tools (same as plans).

| Trigger | What to save |
|---------|-------------|
| Hard-won fix (multiple failed attempts) | Lesson file in `_lessons/` with root cause + solution |
| Non-obvious solution (not in existing docs) | Lesson file in `_lessons/` |
| Architectural/design choice (made or confirmed) | Decision file in `_decisions/` with rationale |
| End of session | Determine what's worth saving, write files, report summary |

**File format MUST follow:** `YYMMDD-name.md` with front-matter (`name`, `description`, `tags`, `category`). Same pattern as plans.

## Finding Additional Context

When `workspace_get_context` doesn't surface needed information:

- Use `document_path` from tool responses → read full document directly
- Search `resources/workspaces/{scope}/` with keywords via Grep or SemanticSearch
