<!-- budget: 100 lines -->
# Workspace Workflow

## Workspace Detection

Determine workspace from the task path or context:

| Path Pattern | Workspace |
|---|---|
| `workspaces/<project>/<domain>/<repo>/` | business workspace (scope: `<project>`) |
| `resources/workspaces/<project>/` | business workspace (scope: `<project>`) |
| `workspaces/devtools/` | devtools (scope: `devtools`) |
| `resources/workspaces/devtools/` | devtools (scope: `devtools`) |
| No workspace path | general — no workspace context needed |

If workspace is ambiguous, ask the user.

## Task Detection

| Signals | Task Type | Load Rule |
|---|---|---|
| "create plan", "write plan", path to `_plans/` | Plan | `agent/rules/common/tasks/create-plan.md` |
| "implement", "build", "fix", "update", "change" + code | Implementation | `agent/rules/common/tasks/implementation.md` |
| "refactor", "restructure", "rename", "move", "extract" | Refactoring | `agent/rules/common/tasks/implementation.md` |
| Acting as Proposer/Opponent, references debate commands | Debate | `agent/commands/common/debate-proposer.md` or `debate-opponent.md` — skip all other workflow |
| "what", "how", "why", "explain" — no action verb | Question | Answer directly |

**Ambiguity:** "implement the plan" → Implementation. "refactor and add" → Implementation. Uncertain → ask.
