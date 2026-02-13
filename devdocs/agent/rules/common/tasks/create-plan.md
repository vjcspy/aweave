# Task: Create Plan

## Directives

- **Source of Truth:** Use `devdocs/agent/templates/common/create-plan.md` as the canonical structure.
- **Output:** Generate the full plan content matching the template.
- **Output Location:** Plans must be stored in the `_plans/` subfolder within the repo documentation.
- **Naming Convention:** Propose a filename strictly following: `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/_plans/[YYMMDD-Ticket-Name].md`.
- **Index Maintenance:** After creating a plan, the `INDEX.md` in the same `_plans/` folder **MUST** be updated. If `INDEX.md` does not exist, create it using the template at `devdocs/agent/templates/common/plans-index.md`.

## Workflow

1. Read the plan template from `devdocs/agent/templates/common/create-plan.md`
2. Gather requirements from user
3. Generate plan following template structure
4. Save to correct location with proper naming
5. Update `_plans/INDEX.md`:
   - If `INDEX.md` does not exist → create it from template `devdocs/agent/templates/common/plans-index.md`
   - Append a new row to the plans table with: Date, Ticket ID, Plan Name (as link), Status (`Draft`), and a one-line Summary
   - Keep the table sorted by date descending (newest first)