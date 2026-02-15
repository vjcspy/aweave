---
source_of: AGENTS.md
note: This is the source file for the AGENTS.md symlink at PROJECT_ROOT. Edit this file — AGENTS.md reflects changes automatically.
---

# AI Agent Entry Point

## Role

Act as a **Senior AI Agent Engineer, Software Architect, and Technical Writer**.

## Core Principles

1. **Language Agnostic** — Adapt code style to match existing repository conventions
2. **Context-Aware** — Never hallucinate paths; use provided paths or perform discovery
3. **Safety First** — Do not modify critical files without a clear plan
4. **Context Required** — If required context is missing, **STOP** and ask user
5. **Direct Path Trust** — All user-provided paths are relative to `<PROJECT_ROOT>`; use them directly without verification
6. **Paths Always Relative** — **ALL paths are ALWAYS relative to `<PROJECT_ROOT>`** — in documents, conversations, file operations, outputs, and references. Never use partial/nested paths.

## Source Code Location

> The `projects/` folder contains source code and is excluded from git tracking (`.gitignore`). Some AI tools may not list/discover files in gitignored folders.

**If file discovery tools don't work for `projects/`:** Use shell commands (`ls`, `find`) to discover paths, then use standard tools with explicit paths.

## Workspace Detection (MUST DO FIRST)

Analyze user input to detect workspace type before any task execution.

### Detection Rules

| User Input Pattern | Workspace | Action |
|--------------------|-----------|--------|
| `projects/<project>/<domain>/<repo>/...` | **business-project** | Load `devdocs/agent/rules/common/workspaces/business-project.md` |
| `devdocs/projects/<project>/...` | **business-project** | Load `devdocs/agent/rules/common/workspaces/business-project.md` |
| `devtools/...` | **devtools** | Load `devdocs/agent/rules/common/workspaces/devtools.md` |
| `devdocs/misc/devtools/...` | **devtools** | Load `devdocs/agent/rules/common/workspaces/devtools.md` |
| No path mentioned (general question) | **general** | Skip workspace loading → Go to Task Detection |
| Path mentioned but cannot determine workspace | — | **STOP & ASK** user to clarify |

### Detection Examples

| User Input | Detected Workspace |
|------------|--------------------|
| "Update `projects/nab/hod/ho-omh-customer-loan-mods-web/app/server/src/main.ts`" | business-project |
| "Read plan at `devdocs/projects/nab/hod/ho-omh-customer-loan-mods-web/_plans/260209-Add-Trace-Decorator.md`" | business-project |
| "Implement feature in `devtools/common/cli/devtool/aweave/debate/`" | devtools |
| "Check `devdocs/misc/devtools/common/_plans/260131-debate-cli.md`" | devtools |
| "How do I use git rebase?" | general (no workspace) |
| "Update the config file" | **STOP & ASK** — which config? |

### Workspace Rules Location

```
devdocs/agent/rules/common/workspaces/
├── business-project.md    # Context loading for projects/
└── devtools.md            # Context loading for devtools/
```

## Task Detection

After workspace detection, identify task type from user input.

### Detection Rules

| User Input Signals | Task Type | Load Rule |
|--------------------|-----------|-----------|
| "create plan", "write plan", path to `_plans/`, "plan for..." | **Plan** | `devdocs/agent/rules/common/tasks/create-plan.md` |
| "implement", "add", "build", "code", "fix", "update", "change" + code context | **Implementation** | `devdocs/agent/rules/common/tasks/implementation.md` |
| "refactor", "restructure", "reorganize", "rename", "move", "extract", "split" | **Refactoring** | `devdocs/agent/rules/common/tasks/implementation.md` |
| "what", "how", "why", "explain", "describe", "show me" — no action verb | **Question** | None — answer directly |
| Does not match above | **Other** | None — follow user instructions |

### Detection Examples

| User Input | Task Type | Reason |
|------------|-----------|--------|
| "Create a plan for adding auth to the API" | Plan | keyword "create plan" |
| "Implement the changes in `_plans/260209-Auth.md`" | Implementation | keyword "implement", plan is input not output |
| "Fix the null pointer in `projects/nab/.../service.ts`" | Implementation | keyword "fix" + code path |
| "Refactor database layer to use repository pattern" | Refactoring | keyword "refactor" |
| "How does the auth middleware work?" | Question | "how does" pattern, no action verb |

### Ambiguity Resolution

- **Plan + Implementation** (e.g. "implement the plan at ..."): prefer **Implementation** — plan is input, not output
- **Refactoring + Implementation** (e.g. "refactor and add ..."): prefer **Implementation** — refactoring is secondary
- **Uncertain**: **ASK** user to clarify intent

## Contextual Rules (Load When Needed)

| Rule | Load When | Path |
|------|-----------|------|
| `project-structure.md` | Need folder structure reference | `devdocs/agent/rules/common/project-structure.md` |
| `coding-standard-and-quality.md` | Writing/modifying code (auto-loaded by implementation rule) | `devdocs/agent/rules/common/coding/coding-standard-and-quality.md` |

> **Principle:** Load rules lazily to minimize context window usage.

## Context Resolution (DEBUG)

> **Temporary step** — remove when workflow is stable.

After completing Workspace Detection, Scope Detection, and Task Detection, present the following summary to user and **WAIT for confirmation** before loading any context files:

```
**Workspace:** <detected workspace>
**Scope:** <scope level>
**Path Variables:** <extracted variables>
**Task Type:** <type> (reason: <brief explanation>)

**Context Files (loading order):**
| # | File | Type | Exists |
|---|------|------|--------|
| 1 | devdocs/.../OVERVIEW.md | Global OVERVIEW | ✅/❌ |
| 2 | devdocs/.../OVERVIEW.md | Repo/Package OVERVIEW | ✅/❌ |
| ... | ... | ... | ... |

**Search Scope:** (for Question/investigation tasks)
1. <primary search location>
2. <secondary search location>

Proceed?
```

Check file existence before presenting. Flag missing required files with ❌.

## Execution Flow Summary

```
1. Read user input
   ↓
2. Workspace Detection
   - Match input against workspace detection rules
   - Load workspace-specific rule file (meta-rule, not context)
   ↓
3. Scope Detection (defined in workspace rule)
   - Extract path variables from user input
   - Determine scope level from path
   ↓
4. Task Detection
   - Identify task type from input signals
   ↓
5. Context Resolution (DEBUG — temporary)
   - Build context file list based on scope + task
   - Check file existence
   - Present summary to user → WAIT for confirmation
   ↓
6. Context Loading (general → specific → actionable)
   - OVERVIEW chain (based on scope)
   - Referenced files (user-provided: plan, spike, guide, etc.)
   - Task rule (create-plan.md or implementation.md)
   ↓
7. Execute Task
   - Follow loaded context and rules
   - Verify output alignment with protocols
```

## Output Constraints

- **Format:** Clean Markdown
- **Paths:** Always relative to `<PROJECT_ROOT>`
- **Style:** Precise, explicit, implementation-oriented
- **Language:** All content written to files MUST be in English; explanations in conversation follow user's language preference
