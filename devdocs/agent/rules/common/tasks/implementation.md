# Task: Implementation / Refactoring

## Pre-requisites

- **MUST** load `devdocs/agent/rules/common/coding/coding-standard-and-quality.md` before writing any code

## Directives

- **Structure Analysis:** Always list or analyze the relevant project folder structure first to understand organization.
- **Locate Source:** Find the target repository in `projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/`.
- **Execution:** Follow explicit user instructions.
- **Testing:** **NO Unsolicited Tests.** Do not write or run test cases unless the user explicitly asks for it.
- **Plan Sync (When Provided):** If the user provides a plan file path (e.g. `devdocs/**/_plans/*.md`), after implementing:
  - Append `## Implementation Notes / As Implemented` to that same plan file (append-only; do not rewrite or reorder original plan sections).
  - If the plan contains an "Implementation Checklist" section and/or status tables, update only the status markers (e.g. `[ ]` → `[x]`, `⬜` → `✅`) without changing wording.

## Change Strategy

### Single-File Changes

- Read the target file → understand context → make changes → verify with linter

### Multi-File Changes

- **Dependency order:** Change leaf modules (no dependents) first, then work upward toward entry points
- **Interface first:** If changing a shared interface/type, update the definition first, then update all consumers
- **One logical change at a time:** Complete one cohesive change across all affected files before starting the next
- **Verify incrementally:** Run linter/type-check after each logical change, not only at the end

### Large Tasks (5+ files or 3+ logical changes)

- **Decompose first:** Break into smaller sub-tasks before starting. List them explicitly.
- **Checkpoint after each sub-task:** Verify the codebase is in a valid state before proceeding
- **If uncertain about scope:** ASK user whether to proceed with full scope or handle incrementally

## Validation Checkpoints

After each significant change:

1. **Linter/Type check** — Run `ReadLints` on modified files
2. **Import integrity** — Verify no broken imports were introduced
3. **Existing behavior** — Confirm unchanged code paths are not affected
4. **Plan alignment** — If working from a plan, verify the change matches the planned approach

## Error Recovery

If an error is introduced during implementation:

1. **Identify scope** — Is the error in the current change or pre-existing?
2. **Fix forward preferred** — If the fix is straightforward (< 3 lines), fix it immediately
3. **Rollback if complex** — If the fix requires significant rework, revert the current change and re-approach
4. **Report to user** — If the error reveals a gap in the plan or requirements, STOP and inform user before continuing

## Workflow

1. Verify coding standards rule is loaded
2. Analyze project/folder structure
3. For multi-file or large changes: decompose into sub-tasks
4. Implement changes following user instructions
5. Validate after each logical change (linter, types, imports)
6. Verify changes align with coding standards
7. If a plan file was provided, update it with "As Implemented" notes (and tick checklist/status markers if present)
