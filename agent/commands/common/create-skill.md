# Create Cursor Skill

## Role & Objective

Act as a **Senior AI Agent Developer** and **Prompt Engineer**.
Your goal is to create a Cursor Agent Skill (SKILL.md and supporting files) following the [Agent Skills open standard](https://cursor.com/docs/context/skills).

A skill extends Cursor's capabilities - it's a set of instructions the agent uses when relevant, or that users can invoke directly via `/skill-name`.

**Input Variables:**

- `SKILL_NAME`: Name of the skill (lowercase, hyphens allowed, max 64 chars)
- `SKILL_DESCRIPTION`: What the skill does and when to use it
- `SKILL_SCOPE`: `user` (global) | `project` (workspace)
- `AUTO_INVOKE`: `true` (agent decides) | `false` (user-only via `/skill-name`)

---

## Phase 0: Requirements Gathering (CRITICAL)

**Action:** Before creating any files, clarify the skill's purpose through questions.

### 0.1 Define Skill Intent

Ask the user:

1. **What task or knowledge does this skill provide?**
   - Is it **reference content** (conventions, patterns, domain knowledge)?
   - Or **task content** (step-by-step actions, workflows)?

2. **When should this skill be used?**
   - What keywords/scenarios should trigger it?
   - This directly informs the `description` field

3. **Who should invoke it?**
   - **Agent decides** (default): Agent applies automatically when relevant, user can also invoke via `/skill-name`
   - **User-only**: Only triggered when user explicitly types `/skill-name` (for workflows with side effects like deploy, publish)

4. **Does it need supporting files?**
   - Scripts the agent should execute?
   - Reference documentation too large for SKILL.md?
   - Static assets like templates or config files?

### 0.2 Validate Skill Name

- Must use **lowercase letters, numbers, and hyphens only**
- Maximum **64 characters**
- Must match the parent folder name
- Should be **descriptive but concise**

Good: `deploy-staging`, `api-conventions`, `create-migration`
Bad: `MySkill`, `deploy_staging`, `skill1`

---

## Phase 1: Directory Structure Setup

**Action:** Create the skill directory based on scope.

### Skill Locations

| Scope | Path | Use Case |
|-------|------|----------|
| User (global) | `~/.cursor/skills/{SKILL_NAME}/` | Personal skills, available in all projects |
| Project | `.cursor/skills/{SKILL_NAME}/` | Project-specific skills, version-controlled |

> **Compatibility Paths:** Cursor also discovers skills from `.claude/skills/` and `.codex/skills/` (both project and user level) for compatibility with other agents.

### Basic Structure

```
{SKILL_NAME}/
└── SKILL.md           # Main instructions (required)
```

### Extended Structure (with supporting files)

```
{SKILL_NAME}/
├── SKILL.md           # Main instructions (required)
├── scripts/           # Executable scripts the agent can run
│   ├── deploy.sh
│   └── validate.py
├── references/        # Additional documentation (loaded on demand)
│   └── api-docs.md
└── assets/            # Static resources
    └── config-template.json
```

### Directory Purpose

| Directory | Purpose | When to Use |
|-----------|---------|-------------|
| `scripts/` | Executable code (any language) | Automation, CLI tools, validation |
| `references/` | Extended documentation | Large reference material, API docs |
| `assets/` | Static files, templates | Config templates, data files, images |

---

## Phase 2: Frontmatter Configuration

**Action:** Configure the YAML frontmatter. Only use fields that Cursor supports.

### Supported Frontmatter Fields

```yaml
---
# Required
name: {SKILL_NAME}
description: {SKILL_DESCRIPTION}

# Optional
license: MIT                           # License name or reference
compatibility:                         # Environment requirements
  - "Node.js 18+"
  - "Docker"
metadata:                              # Arbitrary key-value data
  version: "1.0.0"
  author: "team-name"
disable-model-invocation: false        # true = user-only (not auto-applied)
---
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | **Yes** | Skill identifier. Must match folder name. |
| `description` | **Yes** | Explains what the skill does and when to use it. Agent uses this to determine relevance. |
| `license` | No | License name or path to license file |
| `compatibility` | No | List of environment requirements |
| `metadata` | No | Custom key-value pairs for additional info |
| `disable-model-invocation` | No | When `true`, only user can invoke via `/skill-name` |

### Auto-Invoke Mapping

| AUTO_INVOKE | Frontmatter |
|-------------|-------------|
| `true` (default) | (no extra fields needed) |
| `false` | `disable-model-invocation: true` |

### Description Best Practices

The `description` field is **critical** - it determines when the agent applies the skill.

**Good descriptions:**
```yaml
# Specific, action-oriented, includes trigger keywords
description: Deploy the application to staging or production environments. Use when deploying code, releasing, or pushing to environments.

description: TypeScript coding conventions for this codebase. Use when writing or reviewing TypeScript code.

description: Create database migrations using Prisma. Use when schema changes are needed or when creating new tables.
```

**Bad descriptions:**
```yaml
# Too vague, no trigger keywords
description: A helpful skill for deployment.

description: Code conventions.

description: Database stuff.
```

---

## Phase 3: Skill Content Writing

**Action:** Write the markdown content following these guidelines.

### Content Structure

1. **Purpose Statement** (brief)
   - What does this skill do?
   - When should it be used?

2. **Instructions** (main content)
   - Clear, actionable guidance
   - Step-by-step for tasks
   - Guidelines/patterns for reference

3. **Script References** (if applicable)
   - How to use scripts in `scripts/`
   - Expected inputs/outputs

4. **Additional Resources** (if applicable)
   - Links to files in `references/`
   - Links to files in `assets/`

### Reference Content Template

For skills that provide conventions, patterns, or domain knowledge:

```markdown
---
name: {SKILL_NAME}
description: {SKILL_DESCRIPTION}
---

# {Skill Title}

{Brief statement of when to apply these guidelines.}

## {Category 1}

- {Guideline 1}
- {Guideline 2}

## {Category 2}

- {Guideline 3}
- {Guideline 4}

## Examples

{Show examples of correct usage}
```

### Task Content Template

For skills that execute workflows or procedures:

```markdown
---
name: {SKILL_NAME}
description: {SKILL_DESCRIPTION}
disable-model-invocation: true
---

# {Task Name}

{Brief description of what this task accomplishes.}

## Prerequisites

- {Prerequisite 1}
- {Prerequisite 2}

## Steps

### Step 1: {Action}

{Detailed instructions}

### Step 2: {Action}

{Detailed instructions}

## Output

{What the user should expect after completion}
```

### Task with Scripts Template

For skills that execute scripts:

```markdown
---
name: {SKILL_NAME}
description: {SKILL_DESCRIPTION}
disable-model-invocation: true
---

# {Task Name}

{Brief description}

## Usage

Run the deployment script:

```bash
scripts/deploy.sh <environment>
```

Where `<environment>` is either `staging` or `production`.

## Pre-deployment Validation

Before deploying, run validation:

```bash
python scripts/validate.py
```

## What the Scripts Do

- `deploy.sh`: Builds and pushes the application to the specified environment
- `validate.py`: Checks configuration and dependencies
```

---

## Phase 4: Supporting Files (Optional)

**Action:** Create supporting files if needed.

### When to Use Each Directory

#### `scripts/`
- Automation that agent can execute
- Validation scripts
- Build/deploy scripts
- Data processing utilities

**Script Guidelines:**
- Make scripts self-contained
- Include helpful error messages
- Handle edge cases gracefully
- Add shebang and make executable

```bash
#!/bin/bash
# scripts/deploy.sh
set -e

ENVIRONMENT="${1:-staging}"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "Error: Environment must be 'staging' or 'production'"
    exit 1
fi

echo "Deploying to $ENVIRONMENT..."
# deployment logic here
```

#### `references/`
- Detailed API documentation
- Extended examples
- Technical specifications
- Content too large for SKILL.md

**Reference Guidelines:**
- Keep focused on one topic per file
- Use descriptive filenames
- Cross-reference from SKILL.md

#### `assets/`
- Configuration templates
- Sample data files
- Images (for documentation)
- Static resources

### Referencing Supporting Files

In SKILL.md, guide the agent to supporting files:

```markdown
## Additional Resources

For complete API documentation, see [references/api-docs.md](references/api-docs.md).

Use the configuration template at [assets/config-template.json](assets/config-template.json).

Run the validation script before proceeding: `scripts/validate.py`
```

### Size Guidelines

| File | Recommended Size |
|------|------------------|
| SKILL.md | < 500 lines |
| Individual reference files | < 1000 lines |
| Total skill size | Keep focused, split if growing large |

**Why?** Agent loads `SKILL.md` immediately but loads `references/` files on demand. Keep main instructions concise.

---

## Phase 5: Validation & Testing

**Action:** Verify the skill works correctly.

### Validation Checklist

1. **File Structure:**
   - [ ] `SKILL.md` exists in correct location
   - [ ] Folder name matches `name` in frontmatter
   - [ ] Frontmatter is valid YAML between `---` markers

2. **Frontmatter:**
   - [ ] `name` field is present and valid (lowercase, hyphens, max 64 chars)
   - [ ] `description` field is present and descriptive
   - [ ] Only supported fields are used (no unsupported fields)

3. **Content:**
   - [ ] Instructions are clear and actionable
   - [ ] Supporting files are properly referenced
   - [ ] Scripts are executable (if applicable)

4. **Discovery:**
   - [ ] Skill appears in Cursor Settings → Rules → Agent Decides section

### Testing Methods

1. **Check Skill Discovery:**
   - Open Cursor Settings (Cmd+Shift+J / Ctrl+Shift+J)
   - Navigate to Rules
   - Verify skill appears in "Agent Decides" section

2. **Direct Invocation:**
   ```
   /{SKILL_NAME}
   ```

3. **Automatic Invocation (if enabled):**
   - Ask the agent something that matches the skill description
   - Agent should automatically apply the skill

### Common Issues

| Issue | Solution |
|-------|----------|
| Skill not discovered | Check file path and folder structure |
| Frontmatter error | Validate YAML syntax, check for typos |
| Agent not using skill | Improve `description` with better trigger keywords |
| Scripts not running | Check file permissions, add shebang |

---

## Phase 6: Output & Delivery

**Action:** Create the skill files and confirm creation.

### Output Checklist

- [ ] Created `SKILL.md` with valid frontmatter and content
- [ ] Created supporting files (if applicable)
- [ ] Set correct file permissions for scripts
- [ ] Verified skill appears in Cursor Settings

### Delivery Report

After creating the skill, report to user:

```markdown
## Skill Created Successfully

**Location:** `{full path to skill}`

**Invoke:** 
- Direct: `/{SKILL_NAME}` in chat
- Auto: Agent applies when relevant (if not disabled)

**Summary:** {brief description of what the skill does}

**Files Created:**
- SKILL.md (main instructions)
- {list any supporting files}

**Next Steps:**
1. Open Cursor Settings → Rules to verify discovery
2. Test with `/{SKILL_NAME}` in chat
```

---

## Examples

### Example 1: API Conventions (Reference Content)

```markdown
---
name: api-conventions
description: REST API design patterns and conventions for this codebase. Use when writing or reviewing API endpoints.
---

# API Conventions

When writing API endpoints, follow these conventions:

## Naming

- Use plural nouns for resources: `/users`, `/orders`
- Use kebab-case for multi-word resources: `/order-items`
- Use path parameters for resource IDs: `/users/{id}`

## Response Format

- Always return JSON
- Use consistent error format:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "..." } }
  ```
- Include pagination metadata for list endpoints

## Status Codes

| Code | Usage |
|------|-------|
| 200 | Success with body |
| 201 | Resource created |
| 204 | Success, no body |
| 400 | Bad request (validation) |
| 401 | Unauthorized |
| 404 | Not found |
| 500 | Server error |
```

### Example 2: Deploy to Staging (Task with Scripts)

```markdown
---
name: deploy-staging
description: Deploy the application to staging environment. Use when deploying to staging or preparing a release.
disable-model-invocation: true
---

# Deploy to Staging

Deploy the current branch to the staging environment.

## Prerequisites

- Clean git working directory
- All tests passing
- Docker running locally

## Usage

Run the deployment:

```bash
scripts/deploy.sh staging
```

## Pre-deployment

Run validation first:

```bash
python scripts/validate.py
```

## What Happens

1. Builds Docker image with current commit SHA
2. Pushes to container registry
3. Updates staging Kubernetes deployment
4. Waits for rollout completion
5. Runs smoke tests

## Rollback

If deployment fails:

```bash
scripts/rollback.sh staging
```
```

### Example 3: Create Migration (Task Workflow)

```markdown
---
name: create-migration
description: Create a database migration using Prisma. Use when schema changes are needed, creating tables, or modifying database structure.
disable-model-invocation: true
---

# Create Database Migration

Generate and apply Prisma migrations for schema changes.

## Steps

### Step 1: Update Schema

Edit `prisma/schema.prisma` with the required changes.

### Step 2: Generate Migration

```bash
npx prisma migrate dev --name <migration-name>
```

Use descriptive names: `add_user_email_index`, `create_orders_table`

### Step 3: Review Generated SQL

Check the generated migration in `prisma/migrations/`

### Step 4: Apply to Development

Migration is auto-applied with `migrate dev`. For production:

```bash
npx prisma migrate deploy
```

## Conventions

- One logical change per migration
- Use snake_case for migration names
- Always include rollback consideration
```

---

## Migration from Legacy Commands

If migrating existing Cursor rules or commands to skills, use the built-in `/migrate-to-skills` command:

1. Type `/migrate-to-skills` in Agent chat
2. Agent will identify eligible rules/commands
3. Review generated skills in `.cursor/skills/`

**What Gets Migrated:**
- Dynamic rules (Apply Intelligently)
- Slash commands → Skills with `disable-model-invocation: true`

**Not Migrated:**
- Rules with `alwaysApply: true`
- Rules with specific `globs` patterns
