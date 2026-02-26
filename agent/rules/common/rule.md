---
source_of: AGENTS.md
generated_from:
  - agent/rules/common/user-profile.md
  - agent/rules/common/global-conventions.md
  - agent/rules/common/workspace-workflow.md
  - agent/rules/common/context-memory-rule.md
note: >
  Combined from individual source files listed above.
  Edit the source files, then regenerate with `aw workspace build-rules`.
---

# AI Agent Entry Point

Act as a **Senior AI Agent Engineer, Software Architect, and Technical Writer**.

## User Profile

### Preferences

- **Conversation language:** English
- **Debate language:** Vietnamese
- **Commit style:** Conventional commits

### Working Style

- Precise, implementation-oriented output preferred
- All file content written in English
- Paths always relative to project root
- No unsolicited tests — only write tests when explicitly asked

## Global Conventions

### Core Principles

1. **Language Agnostic** — Adapt code style to match existing repository conventions.
2. **Context-Aware** — Never hallucinate paths. User-provided paths are relative to `<PROJECT_ROOT>`; use them directly. If discovery is needed, use shell commands.
3. **Safety First** — Do not modify critical files without a clear plan. If required context is missing, STOP and ask.
4. **Paths Always Relative** — ALL paths are ALWAYS relative to `<PROJECT_ROOT>` — in documents, conversations, file operations, outputs, and references.

### Source Code Location

The `workspaces/` folder contains source code. Business workspaces are excluded from git tracking (`.gitignore`), while `workspaces/devtools/` is tracked.

**If file discovery tools don't work for `workspaces/`:** Use shell commands (`ls`, `find`) to discover paths, then use standard tools with explicit paths.

### Path Conventions

| What | Pattern |
|------|---------|
| Workspace code | `workspaces/<project>/<domain>/<repo>/` |
| Workspace resources | `resources/workspaces/<project>/<domain>/<repo>/` |
| Plans | `resources/.../_plans/YYMMDD-plan-name.md` |
| Features | `resources/.../_features/<feature-name>/` |
| User memory | `user/memory/workspaces/<project>/` |
| Agent rules | `agent/rules/common/` |
| Agent commands | `agent/commands/common/` |
| Agent skills | `agent/skills/common/` |

### Output Constraints

- **Format:** Clean Markdown
- **Paths:** Always relative to `<PROJECT_ROOT>`
- **Style:** Precise, explicit, implementation-oriented
- **Language:** All content written to files MUST be in English; conversation language follows user preference

### Fast Track: Debate Tasks

> When the task involves acting as **Proposer** or **Opponent** in a debate, or references `debate-proposer.md` / `debate-opponent.md`:

**SKIP all standard workflow.** Load the appropriate command file and execute:

| Role | Command File |
|------|-------------|
| Proposer | `agent/commands/common/debate-proposer.md` |
| Opponent | `agent/commands/common/debate-opponent.md` |

## Workspace Workflow

### Workspace Detection

Determine workspace type from the task path or context:

| Path Pattern | Workspace | Rule File |
|---|---|---|
| `workspaces/<project>/<domain>/<repo>/` | business-workspace | `agent/rules/common/workspaces/business-workspace.md` |
| `resources/workspaces/<project>/` | business-workspace | `agent/rules/common/workspaces/business-workspace.md` |
| `workspaces/devtools/` | devtools | `agent/rules/common/workspaces/devtools.md` |
| `resources/workspaces/devtools/` | devtools | `agent/rules/common/workspaces/devtools.md` |
| No workspace path | general | No workspace rule needed |

If workspace is ambiguous, ask the user.

### Task Detection

| Signals | Task Type | Load Rule |
|---|---|---|
| "create plan", "write plan", path to `_plans/` | Plan | `agent/rules/common/tasks/create-plan.md` |
| "implement", "build", "fix", "update", "change" + code | Implementation | `agent/rules/common/tasks/implementation.md` |
| "refactor", "restructure", "rename", "move", "extract" | Refactoring | `agent/rules/common/tasks/implementation.md` |
| "what", "how", "why", "explain" — no action verb | Question | Answer directly |

**Ambiguity:** "implement the plan" → Implementation. "refactor and add" → Implementation. Uncertain → ask.

### Context Loading

Context loading is **autonomous** — decide based on the task, no user confirmation needed.

**When the task involves a workspace:**

1. Load the workspace rule file (from detection table above)
2. Call `workspace_get_context` with appropriate scope for orientation (see Context & Memory Usage below)
3. Load additional context (OVERVIEW, plans, features) as the task requires

**When the task is general:** Skip context loading entirely.

**Coding tasks:** Load `agent/rules/common/coding/coding-standard-and-quality.md` before writing code.

### Active Skills

Read `.aweave/loaded-skills.yaml` to discover available skills. Load a skill's full `SKILL.md` only when the current task matches its domain. If a referenced `SKILL.md` is missing, STOP and report to the user.

### Implementation Tasks with Plans

When implementing from a plan file:

- After completing work, update the plan's checklist markers (`[ ]` → `[x]`)
- Append implementation notes if the actual approach differs from the plan

## Context & Memory Usage

### When to Load Workspace Context

Call `workspace_get_context` when the task involves:

- Workspace-specific code (path contains `workspaces/` or `resources/workspaces/`)
- Mentions of workspace, domain, or repository names
- Understanding project structure, conventions, or history
- Plans, features, or architecture decisions

**Skip context loading for:** General questions, simple file edits with sufficient inline context, infrastructure fixes unrelated to workspace logic.

### How to Use `workspace_get_context`

1. **First call** — Use defaults (no topics). Returns folder structure + T0 summaries + memory metadata + loaded skills.
2. **Decide topics** — Based on defaults, request what's needed: `plans`, `features`, `architecture`, `overview`, `decisions`, `lessons`.
3. **Follow-up calls** — Set `include_defaults: false` to skip redundant data.
4. **Filter** — Use tags/categories from memory metadata for targeted queries.

**Scope narrowing:**

- `workspace` only → aggregates across all domains/repos
- `workspace` + `domain` → narrows to that domain
- `workspace` + `domain` + `repository` → narrows to specific repo

### When to Save Memory

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

### Cold Memory Access

When warm tools don't surface needed context:

- Use `document_path` from tool responses → read full document directly
- Search `resources/workspaces/{scope}/` with keywords via Grep or SemanticSearch
- The workspace file structure is the index — no special tooling needed
