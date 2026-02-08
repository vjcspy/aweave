# Task: Implementation / Refactoring

## Pre-requisites

- **MUST** load `devdocs/agent/rules/common/coding/coding-standard-and-quality.md` before writing any code

## Directives

- **Structure Analysis:** Always list or analyze the relevant project folder structure first to understand organization.
- **Locate Source:** Find the target repository in `projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/`.
- **Execution:** Follow explicit user instructions.
- **Testing:** **NO Unsolicited Tests.** Do not write or run test cases unless the user explicitly asks for it.
- **Plan Sync (When Provided):** If the user provides a plan file path (e.g. `devdocs/**/plans/*.md`), after implementing:
  - Append `## Implementation Notes / As Implemented` to that same plan file (append-only; do not rewrite or reorder original plan sections).
  - If the plan contains an “Implementation Checklist” section and/or status tables, update only the status markers (e.g. `[ ]` → `[x]`, `⬜` → `✅`) without changing wording.

## Workflow

1. Verify coding standards rule is loaded
2. Analyze project/folder structure
3. Implement changes following user instructions
4. Verify changes align with coding standards
5. If a plan file was provided, update it with “As Implemented” notes (and tick checklist/status markers if present)
