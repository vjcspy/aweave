<!-- budget: 100 lines -->
# Workspace Workflow

## Context Parameter Detection

When handling a workspace-scoped task, extract `workspace`, `domain`, and `repository` from the task path to call `workspace_get_context`.

### Path → Parameter Mapping

**Business workspace path:** `workspaces/<workspace>/<domain>/<repo>/`

| Path Segment                              | Parameter    | Example |
|-------------------------------------------|--------------|---------|
| `workspaces/<workspace>/`                 | `workspace`  | `nab`   |
| `workspaces/<workspace>/<domain>/`        | `domain`     | `hod`   |
| `workspaces/<workspace>/<domain>/<repo>/` | `repository` | `eve`   |

**Example:** `workspaces/nab/hod/eve/` → `workspace=nab`, `domain=hod`, `repository=eve`

**Resources path:** `resources/workspaces/<workspace>/` → `workspace=<workspace>` only (no domain/repo)

**Devtools path:** `workspaces/devtools/` or `resources/workspaces/devtools/` → `workspace=devtools`

**No workspace path** → general context, no workspace_get_context call needed

If any parameter is ambiguous, ask the user.

## Task Detection

**Before handling any workspace-scoped task:** Call `workspace_get_context` first. See Context & Memory Usage.

| Signals | Task Type | Load Rule |
|---|---|---|
| "create plan", "write plan", path to `_plans/` | Plan | `agent/rules/common/tasks/create-plan.md` |
| "implement", "build", "fix", "update", "change" + code | Implementation | `agent/rules/common/tasks/implementation.md` |
| "refactor", "restructure", "rename", "move", "extract" | Refactoring | `agent/rules/common/tasks/implementation.md` |
| Acting as Proposer/Opponent, references debate commands | Debate | `agent/commands/common/debate-proposer.md` or `debate-opponent.md` — skip all other workflow |
| "what", "how", "why", "explain" — no action verb | Question | Answer directly |

**Ambiguity:** "implement the plan" → Implementation. "refactor and add" → Implementation. Uncertain → ask.
