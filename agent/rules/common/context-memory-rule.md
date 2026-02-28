<!-- budget: 100 lines -->
# Context & Memory Usage

> **BLOCKER:** For any task involving workspace-scoped content (plans, features, configs, conventions, etc.), your **first tool call** MUST be `workspace_get_context`. Do NOT bypass the warm memory layer and jump straight to raw file access — call the tool first, then use other methods only if needed or if the tool is unavailable.

**For workspace-scoped tasks, follow this order:**

1. [ ] Call `workspace_get_context` with appropriate scope (workspace, domain, topics)
2. [ ] If tool unavailable (e.g. MCP server not in session): fallback to direct file access, note the fallback in response
3. [ ] Only then: use other methods for deeper detail if needed

**Do NOT:** Skip `workspace_get_context` and go straight to reading or searching files when the task involves workspace content. The warm memory layer exists to provide structured orientation first.

## Key Concepts

**Memory layers (when to load):**

- **Hot** (L1): Auto-loaded rules (this file). Always in context, zero cost.
- **Warm** (L2): On-demand via `workspace_get_context`. Returns scoped T1 overview plus T0 listings.
- **Cold** (L3): Raw files in workspace. Read directly or search with keywords when warm data isn't enough.

**Data tiers (how much to load):**

- **T0 (Abstract):** ~100-200 tokens. Front-matter summaries (name, description, status, tags). Enough to orient and decide what to read next.
- **T1 (Overview):** Overview files are files that have been synthesized and summarized to provide a general perspective
- **T2 (Detail):** Full document content or check the source code, the actual implementation.

**Purpose of `workspace_get_context`:** Fast scoped retrieval on warm memory — defaults provide `scope_overview_t1` + T0 orientation, then topic calls provide `{ overview_t1, entries }` for targeted work.

**Topics:** Folders named `_{topicName}/` in workspace resources (e.g., `_plans/`, `_features/`, `_decisions/`, `_lessons/`, `_architecture/`, etc...). Topics are NOT hardcoded — user can flexibly create new topics by adding `_{topicName}/` folders. Discover existing topics from the folder structure returned by the first `workspace_get_context` call. Each topic folder may have its own OVERVIEW.md explaining organization, front-matter schema, and valid field values.

## When to Load Workspace Context

Context loading is **autonomous** — decide based on the task, no user confirmation needed.

Call `workspace_get_context` when the task involves:

- Workspace-specific code (paths contain `workspaces/` or `resources/workspaces/`)
- Mentions of workspace, domain, or repository names
- Project structure, conventions, history, plans, features, architecture, decisions, or lessons

**Skip for:**

- Direct file edits where the task is self-contained (fix typo, rename variable, add import)
- Tasks where user provides all needed context inline
- General questions unrelated to workspace structure
- Infra/tooling fixes unrelated to workspace logic
- User explicitly asks to skip

## How to Use `workspace_get_context`

1. **Orientation (first call):** Call with defaults (no topics) → returns `scope_overview_t1`, folder structure, OVERVIEW T0 summaries, and available skills. Inspect folder structure to discover which `_{topicName}/` topics exist in the workspace.
2. **Match user intent to topics:** Check if user's request relates to any discovered topic from step 1.
3. **Load topic context:** If matched, call with specific topics (e.g., `topics: ["plans"]`) and `include_defaults: false` → each topic returns `{ overview_t1, entries }`.
4. **Deep dive (T2):** Use `document_path` from `entries` → read specific files directly. Or search `resources/workspaces/{scope}/` with keywords via Grep/SemanticSearch.

**Scope narrowing:** `workspace` → all domains/repos. Add `domain` → narrows. Add `repository` → specific repo.

Use `filter_status`, `filter_tags`, `filter_category` for targeted queries — available values visible in previously returned entries or in topic OVERVIEW.md.

## When to Save Decisions & Lessons

Save directly as files in `resources/workspaces/{scope}/_{decisions,lessons}/` (same pattern as plans).

| Trigger | What to save |
|---------|-------------|
| Hard-won fix (multiple failed attempts) | Lesson in `_lessons/` — root cause + solution |
| Non-obvious solution | Lesson in `_lessons/` |
| Architectural/design choice confirmed | Decision in `_decisions/` — with rationale |
| End of session | Determine what's worth saving, write files, report |

**File format:** `YYMMDD-name.md` with front-matter (`name`, `description`, `tags`, `category`).

## Finding Additional Context

When `workspace_get_context` doesn't surface needed information:

- Use `document_path` from tool responses → read full document directly
- Search `resources/workspaces/{scope}/` with keywords via Grep or SemanticSearch
