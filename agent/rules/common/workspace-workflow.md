<!-- budget: 100 lines -->
# Workspace Workflow

## BLOCKER: Scope Resolution Before First Tool Call

For any workspace-scoped task, the agent MUST resolve scope from the concrete path BEFORE calling any tool.

- MUST parse path first, then call `workspace_get_context`.
- MUST NOT use a default workspace as a warm-up when the path already indicates scope.
- NEVER call `workspace_get_context(workspace=devtools)` by default for non-`devtools` paths.
- If scope cannot be resolved from user input, ask the user before proceeding.

### Path → Logical Scope Mapping (Source of Truth)

**Business workspace path:** `workspaces/<project>/<domain>/<repo>/`

| Path Segment                            | Logical Scope Field | Example   |
|-----------------------------------------|---------------------|-----------|
| `workspaces/<project>/`                 | `project`           | `nab` |
| `workspaces/<project>/<domain>/`        | `domain`            | `hod` |
| `workspaces/<project>/<domain>/<repo>/` | `repository`        | `eve`     |

**Business resources path:** `resources/workspaces/<project>/` → `project=<project>` (no domain/repo unless path provides them)

**Devtools path:** `workspaces/devtools/` or `resources/workspaces/devtools/` → `project=devtools`

**No workspace path:** general task, no `workspace_get_context` required.

### Logical Scope → `workspace_get_context` Parameters

Use this exact order. Do not skip steps.

1. **PRIMARY (MUST try first):**  
   map `project -> workspace`, `domain -> domain`, `repository -> repository`
2. **SCHEMA FALLBACK (ONLY if primary fails due to MCP namespace mismatch):**  
   map `workspace=devtools`, `domain=<project>`, `repository=<repository-if-applicable>`
3. **FINAL FALLBACK:**  
   if tool unavailable or scope cannot be loaded, use direct file access and explicitly note fallback in response

Rules:
- MUST record why fallback was needed.
- NEVER use schema fallback before primary fails.
- NEVER ignore path-derived `project/domain/repository`.

### Quick Examples

- `workspaces/nab/hod/eve/`  
  logical scope: `project=nab`, `domain=hod`, `repository=eve`  
  primary call: `workspace=nab, domain=hod, repository=eve`  
  schema fallback only if needed: `workspace=devtools, domain=nab, repository=eve`

- `workspaces/devtools/common/server/`  
  call: `workspace=devtools, domain=common, repository=server`

## Task Detection

**Before handling any workspace-scoped task:** call `workspace_get_context` first, after completing scope resolution above.

| Signals                                                       | Task Type      | Load Rule                                                                                    |
|---------------------------------------------------------------|----------------|----------------------------------------------------------------------------------------------|
| "create plan", "write plan", "give me plan" path to `_plans/` | Plan           | `agent/rules/common/tasks/create-plan.md`                                                    |
| "implement", "build", "fix", "update", "change" + code        | Implementation | `agent/rules/common/tasks/implementation.md`                                                 |
| "refactor", "restructure", "rename", "move", "extract"        | Refactoring    | `agent/rules/common/tasks/implementation.md`                                                 |
| Acting as Proposer/Opponent, references debate commands       | Debate         | `agent/commands/common/debate-proposer.md` or `debate-opponent.md` — skip all other workflow |
| "what", "how", "why", "explain" — no action verb              | Question       | Answer directly                                                                              |

**Ambiguity:** "implement the plan" → Implementation. "refactor and add" → Implementation. Uncertain → ask.
