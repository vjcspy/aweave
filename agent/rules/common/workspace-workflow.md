<!-- budget: 100 lines -->
# Workspace Workflow

## Workspace Detection

Determine workspace type from the task path or context:

| Path Pattern | Workspace | Rule File |
|---|---|---|
| `workspaces/<project>/<domain>/<repo>/` | business-workspace | `agent/rules/common/workspaces/business-workspace.md` |
| `resources/workspaces/<project>/` | business-workspace | `agent/rules/common/workspaces/business-workspace.md` |
| `workspaces/devtools/` | devtools | `agent/rules/common/workspaces/devtools.md` |
| `resources/workspaces/devtools/` | devtools | `agent/rules/common/workspaces/devtools.md` |
| No workspace path | general | No workspace rule needed |

If workspace is ambiguous, ask the user.

## Task Detection

| Signals | Task Type | Load Rule |
|---|---|---|
| "create plan", "write plan", path to `_plans/` | Plan | `agent/rules/common/tasks/create-plan.md` |
| "implement", "build", "fix", "update", "change" + code | Implementation | `agent/rules/common/tasks/implementation.md` |
| "refactor", "restructure", "rename", "move", "extract" | Refactoring | `agent/rules/common/tasks/implementation.md` |
| "what", "how", "why", "explain" — no action verb | Question | Answer directly |

**Ambiguity:** "implement the plan" → Implementation. "refactor and add" → Implementation. Uncertain → ask.

## Context Loading

Context loading is **autonomous** — decide based on the task, no user confirmation needed.

**When the task involves a workspace:**

1. Load the workspace rule file (from detection table above)
2. Call `workspace_get_context` with appropriate scope for orientation (see `context-memory-rule.md`)
3. Load additional context (OVERVIEW, plans, features) as the task requires

**When the task is general:** Skip context loading entirely.

**Coding tasks:** Load `agent/rules/common/coding/coding-standard-and-quality.md` before writing code.

## Active Skills

Read `.aweave/loaded-skills.yaml` to discover available skills. Load a skill's full `SKILL.md` only when the current task matches its domain. If a referenced `SKILL.md` is missing, STOP and report to the user.

## Implementation Tasks with Plans

When implementing from a plan file:

- After completing work, update the plan's checklist markers (`[ ]` → `[x]`)
- Append implementation notes if the actual approach differs from the plan
