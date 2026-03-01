<!-- budget: 100 lines -->

# Workspace Workflow

## BLOCKER: Scope Resolution Before First Tool Call

For any workspace-scoped task, the agent MUST resolve scope from the concrete path BEFORE calling any tool.

- MUST parse path first, then call `workspace_get_context`.
- MUST NOT use a default workspace as a warm-up when the path already indicates scope.
- NEVER call `workspace_get_context(workspace=devtools)` by default for non-`devtools` paths.
- MUST think out loud when detecting `workspace`, `domain`, `repository`, and related `topic` candidates, and state the concrete evidence (path segments, user text, or folder names).
- MUST NOT guess missing scope fields. If any required field cannot be derived from concrete evidence, STOP and ask the user.
- If scope cannot be resolved from user input, ask the user before proceeding.

### Path → Logical Scope Mapping (Source of Truth)

**Business workspace path:** `workspaces/<workspace>/<domain>/<repo>/`

| Path Segment                              | Logical Scope Field | Example |
|-------------------------------------------|---------------------|---------|
| `workspaces/<workspace>/`                 | `workspace`         | `nab`   |
| `workspaces/<workspace>/<domain>/`        | `domain`            | `hod`   |
| `workspaces/<workspace>/<domain>/<repo>/` | `repository`        | `eve`   |

**Business resources path:** `resources/workspaces/<workspace>/` → `workspace=<workspace>` (no domain/repo unless path
provides them)

**Devtools path:** `workspaces/devtools/` or `resources/workspaces/devtools/` → `workspace=devtools`

**No workspace path:** general task, no `workspace_get_context` required.

### Logical Scope → `workspace_get_context` Parameters

Use this exact order. Do not skip steps.

1. **PRIMARY (MUST try first):**  
   pass `workspace`, `domain`, `repository` directly as `workspace_get_context` parameters
2. **FAILURE HANDLING (MUST):**  
   if `workspace_get_context` fails (tool unavailable, scope mismatch, schema mismatch, or scope cannot be loaded), STOP and ask the user to provide/correct schema or scope details before continuing

Rules:

- NEVER use schema fallback (for example mapping to `workspace=devtools` for non-`devtools` scopes).
- NEVER bypass failed context loading by switching to direct file access for workspace-scoped tasks.
- MUST clearly report the concrete failure reason before asking the user for correction.
- NEVER ignore path-derived `workspaces/<workspace>/<domain>/<repository>`.

### Quick Examples

- `workspaces/nab/hod/eve/`  
  logical scope: `workspace=nab`, `domain=hod`, `repository=eve`  
  primary call: `workspace=nab, domain=hod, repository=eve`  

- `workspaces/devtools/common/server/`  
  call: `workspace=devtools, domain=common, repository=server`

## MANDATORY — CLI Execution Policy

**ALL `aw` CLI commands MUST be run through `pnpm`.** Running bare `aw` is **STRICTLY FORBIDDEN** and will be blocked by company policy.

- ✅ `pnpm aw debate list --limit 10`
- ❌ `aw debate list --limit 10`

**NEVER** invoke `aw` without the `pnpm` prefix. Working directory MUST be `workspaces/devtools`.

## Task Detection

**Before handling any workspace-scoped task:** call `workspace_get_context` first, after completing scope resolution
above.

| Signals                                                       | Task Type      | Load Rule                                                                                    |
|---------------------------------------------------------------|----------------|----------------------------------------------------------------------------------------------|
| "create plan", "write plan", "give me plan" path to `_plans/` | Plan           | `agent/rules/common/tasks/create-plan.md`                                                    |
| "implement", "build", "fix", "update", "change" + code        | Implementation | `agent/rules/common/tasks/implementation.md`                                                 |
| "refactor", "restructure", "rename", "move", "extract"        | Refactoring    | `agent/rules/common/tasks/implementation.md`                                                 |
| Acting as Proposer/Opponent, references debate commands       | Debate         | `agent/commands/common/debate-proposer.md` or `debate-opponent.md` — skip all other workflow |
| "what", "how", "why", "explain" — no action verb              | Question       | If workspace-scoped: load context first. If non-workspace-scoped: answer directly.          |

**Ambiguity:** "implement the plan" → Implementation. "refactor and add" → Implementation. Uncertain → ask.
