# Task: Create Plan

## Directives

- **Source of Truth:** Use `agent/templates/common/create-plan.md` as the canonical structure.
- **Output:** Generate the full plan content matching the template.
- **Output Location:** Plans must be stored in the `_plans/` subfolder within the repo documentation.
- **Naming Convention:** Propose a filename strictly following `[YYMMDD-Ticket-Name].md` within the appropriate `_plans/` directory.

## Generation Rules

- **References:** All file paths must be cited exactly as provided by the user (relative to project root) to ensure accessibility for other AI Agents.
- **User Requirements:** Preserve the user's original requirements verbatim. Omit the section entirely if user did not provide explicit requirements.
- **Summary of Results:** Leave with placeholder text only. Do NOT fill in results — this section is updated after implementation is complete, upon user request.
- **Outstanding Issues:** Include only if there are actual issues or clarifications needed. Omit if none.
- **HTML Comments:** Remove all `<!-- ... -->` template comments from the generated output.

## Workflow

1. Read the plan template from `agent/templates/common/create-plan.md`
2. Gather requirements from user
3. Generate plan following template structure and generation rules above
4. Save to correct location with proper naming
