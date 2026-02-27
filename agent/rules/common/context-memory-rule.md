<!-- budget: 100 lines -->
# Context & Memory Usage

## Key Concepts

**Memory layers (when to load):**
- **Hot** (L1): Auto-loaded rules (this file). Always in context, zero cost.
- **Warm** (L2): On-demand via `workspace_get_context`. Returns T0 data — fast, token-efficient.
- **Cold** (L3): Raw files in workspace. Read directly or search with keywords when warm data isn't enough.

**Data tiers (how much to load):**
- **T0 (Abstract):** ~100-200 tokens. Front-matter summaries (name, description, status, tags). Enough to orient and decide what to read next.
- **T1 (Overview):** Overview files are files that have been synthesized and summarized to provide a general perspective
- **T2 (Detail):** Full document content or check the source code, the actual implementation.

**Purpose of `workspace_get_context`:** Fast T0 query on warm memory — avoids reading all files which wastes tokens. Get T0 summaries first → identify exactly which files matter → then read only those for T1/T2 detail.

**Topics:** Folders named `_{topicName}/` in workspace resources (e.g., `_plans/`, `_features/`, `_decisions/`, `_lessons/`, `_architecture/`, etc...). Topics are NOT hardcoded — user can flexibly create new topics by adding `_{topicName}/` folders. Discover existing topics from the folder structure returned by the first `workspace_get_context` call. Each topic folder may have its own OVERVIEW.md explaining organization, front-matter schema, and valid field values.

## When to Load Workspace Context

Context loading is **autonomous** — decide based on the task, no user confirmation needed.

Call `workspace_get_context` when the task involves:
- Workspace-specific code (paths contain `workspaces/` or `resources/workspaces/`)
- Mentions of workspace, domain, or repository names
- Project structure, conventions, history, plans, features, architecture, decisions, or lessons

**Mandatory:** If user prompt or referenced paths include workspace path patterns, you MUST call `workspace_get_context` before answering or implementing.

**Skip for:** General questions, simple edits with sufficient inline context, infra fixes unrelated to workspace logic. Also skip if user explicitly asks to.

## How to Use `workspace_get_context`

1. **Orientation (first call):** Call with defaults (no topics) → returns folder structure + OVERVIEW summaries + available skills. Inspect folder structure to discover which `_{topicName}/` topics exist in the workspace.
2. **Match user intent to topics:** Check if user's request relates to any discovered topic from step 1.
3. **Load topic T0:** If matched, call with specific topics (e.g., `topics: ["plans"]`) and `include_defaults: false` → returns T0 summaries (front-matter) of all entries in that topic.
4. **Deep dive (T1/T2):** Use `document_path` from T0 results → read specific files directly. Or search `resources/workspaces/{scope}/` with keywords via Grep/SemanticSearch.

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