# Create Overview

## Role & Objective

Act as a **Senior Polyglot Software Architect** and **Technical Writer**.
Your goal is to generate or update an OVERVIEW.md document.
This document serves as the primary context source for other AI Agents or Developers working on this scope.

**Input Variables:**

- `TARGET_PATH`: Path to the OVERVIEW.md file (auto-detected or user-provided)

---

## Path Resolution (Auto-Detection)

**Action:** Resolve `TARGET_PATH` based on user input.

**Input Patterns:**

| User Input | Resolved TARGET_PATH |
|------------|---------------------|
| `workspaces/<PROJECT>/<DOMAIN>/<REPO>` | `resources/workspaces/<PROJECT>/<DOMAIN>/<REPO>/OVERVIEW.md` |
| `resources/workspaces/<PROJECT>/<DOMAIN>/<REPO>/OVERVIEW.md` | Use as-is |
| `resources/workspaces/<PROJECT>/<DOMAIN>/OVERVIEW.md` | Use as-is (Domain Overview) |
| `resources/workspaces/<PROJECT>/OVERVIEW.md` | Use as-is (Workspace Overview) |

**Scope Detection:**

| TARGET_PATH Pattern | Scope |
|---------------------|-------|
| `resources/workspaces/<PROJECT>/OVERVIEW.md` | **workspace** |
| `resources/workspaces/<PROJECT>/<DOMAIN>/OVERVIEW.md` | **domain** |
| `resources/workspaces/<PROJECT>/<DOMAIN>/<REPO>/OVERVIEW.md` | **repo** |

**Resolution Logic:**

1. **IF** user provides a source path starting with `workspaces/`:
   - Extract: `workspaces/<PROJECT>/<DOMAIN>/<REPO>`
   - Derive: `TARGET_PATH` = `resources/workspaces/<PROJECT>/<DOMAIN>/<REPO>/OVERVIEW.md`
   - Set: `SOURCE_PATH` = user input (for code scanning)

2. **IF** user provides a path starting with `resources/workspaces/`:
   - Use the provided path as `TARGET_PATH`
   - Derive: `SOURCE_PATH` from TARGET_PATH (if repo scope)

3. **Confirm** both paths with user before proceeding:
   - "Source: `{SOURCE_PATH}`" (if applicable)
   - "Output: `{TARGET_PATH}`"
   - "Scope: `{SCOPE}`"

---

## Phase 0: Environment & Safety Validation (CRITICAL)

**Action:** Verify execution environment constraints before scanning code.

1. **Get Current Context:**
    - Current Branch: Execute `git branch --show-current` -> Store as `{CURRENT_BRANCH}`.
    - Current Hash: Execute `git log -1 --format="%h"` -> Store as `{CURRENT_HASH}`.
    - Current Date: Execute `git log -1 --format="%cd"` -> Store as `{CURRENT_DATE}`.

2. **Branch Allow-list Check:**
    - IF `{CURRENT_BRANCH}` is NOT `develop` OR `master`:
      - **STOP IMMEDIATELY.**
      - Output: "**Aborted:** Documentation can only be generated from 'develop' or 'master'. Current branch is '{CURRENT_BRANCH}'."

3. **Existing File Consistency Check:**
    - Check if `{TARGET_PATH}` exists.
    - **Scenario A (File Exists):**
      - Read the file content. Look for the metadata line: `> **Branch:** [Old_Branch_Name]`.
      - **Consistency Rule:** IF `[Old_Branch_Name]` != `{CURRENT_BRANCH}`:
        - **STOP IMMEDIATELY.**
        - Output: "**Aborted:** Branch Mismatch. The existing documentation belongs to branch '{Old_Branch_Name}', but you are currently on '{CURRENT_BRANCH}'."
    - **Scenario B (File Missing):**
      - Proceed to Phase 1 (Status: NEW GENERATION).

---

## Phase 1: Lifecycle & Freshness Check

**Action:** Determine if an update is strictly necessary based on Git history.

1. **Parse Existing Metadata (If file exists):**
    - Extract `> **Last Commit:** [Old_Hash]` from `{TARGET_PATH}`.

2. **Compare Hashes:**
    - IF `[Old_Hash]` == `{CURRENT_HASH}`:
      - **STOP.** Output: "Documentation is up to date. No changes detected."
    - IF `[Old_Hash]` != `{CURRENT_HASH}`:
      - Set Status: **[UPDATE REQUIRED]**
      - **Delta Analysis:** Execute `git diff --name-only [Old_Hash] HEAD`.
      - Keep this file list for "Recent Changes Log" section.

---

## Phase 2: Scope-Aware Content Generation

**Action:** Generate content based on detected scope. Each scope level has different content guidelines.

### ALL Scopes: Required Front-matter

Every OVERVIEW.md MUST include YAML front-matter:

```yaml
---
name: string                # Scope name (e.g., "DevTools", "DevTools Common", "CLI Plugin Debate")
description: string         # 1-2 sentence abstract — this IS the T0 summary
tags: string[]              # For filtering (optional)
updated: YYYY-MM-DD        # Last meaningful update (optional)
---
```

The `description` field is extracted by `workspace_get_context` as T0 data. It must be self-contained — a reader should understand the scope's purpose from this field alone.

### ALL Scopes: Metadata Header (after front-matter)

```markdown
> **Branch:** {CURRENT_BRANCH}
> **Last Commit:** {CURRENT_HASH}
> **Last Updated:** {CURRENT_DATE}
```

---

### Scope: Workspace Overview

**Purpose:** High-level orientation for the entire workspace. Answers: "What is this workspace? How is it organized? How do things connect?"

**CRITICAL — What workspace overview MUST NOT contain:**

- **Individual package/repo listings with descriptions** — child OVERVIEW summaries are already returned in `workspace_get_context` defaults (`defaults.overviews`). Listing them in the workspace overview creates duplication.
- **Per-package documentation links** — `defaults.overviews` includes `_meta.document_path` for each OVERVIEW. No need to duplicate.
- **Detailed dependency graphs between packages** — belongs in repo-level or architecture docs.

**Content structure:**

```markdown
---
name: "<Workspace Name>"
description: "<1-2 sentences: what this workspace is and its primary purpose>"
tags: [<relevant tags>]
---

> **Branch:** {CURRENT_BRANCH}
> **Last Commit:** {CURRENT_HASH}
> **Last Updated:** {CURRENT_DATE}

## TL;DR
[1-3 sentences: what this workspace does, key technology choices, how it's organized]

## Purpose & Bounded Context
- **Role:** [High-level architectural role]
- **Domain:** [Business/technical domain]

## Design Philosophy
[Core principles that guide all repos in this workspace. Architecture-level decisions.]

## Architecture Overview
[High-level diagram showing how domains/major components interact.
Focus on CONNECTIONS and DATA FLOW, not listing individual packages.]

## Development Approach
[How to add new components, common patterns, workspace-level workflows]

## Quick Reference
[Common commands, entry points, useful links — workspace-level only]
```

**Anti-pattern example:** The workspace overview should NOT have sections like "Package Documentation" that list every package with links — this is exactly what the T0 defaults provide.

---

### Scope: Domain Overview

**Purpose:** Context for a specific domain within the workspace. Answers: "What does this domain handle? What cross-repo patterns exist?"

**Content structure:**

```markdown
---
name: "<Domain Name>"
description: "<1-2 sentences: what this domain covers>"
tags: [<relevant tags>]
---

> **Branch:** {CURRENT_BRANCH}
> **Last Commit:** {CURRENT_HASH}
> **Last Updated:** {CURRENT_DATE}

## TL;DR
[What this domain is responsible for]

## Domain Context
- **Business Context:** [What business problem this domain solves]
- **Relationship to Other Domains:** [How it connects to sibling domains]

## Cross-Repo Patterns
[Conventions, shared patterns, or architectural decisions that span multiple repos in this domain]

## Domain-Specific Development
[Any domain-specific setup, tooling, or conventions not covered at workspace level]
```

---

### Scope: Repo/Package Overview

**Purpose:** Detailed context for a specific repository or package. Answers: "How does this repo work? What does it expose? What does it depend on?"

**Content structure:**

```markdown
---
name: "<Repo/Package Name>"
description: "<1-2 sentences: what this repo does>"
tags: [<relevant tags>]
---

> **Branch:** {CURRENT_BRANCH}
> **Last Commit:** {CURRENT_HASH}
> **Last Updated:** {CURRENT_DATE}

## TL;DR
[Concise summary of what this repository does]

## Recent Changes Log (Only if Updating)
[Structural changes from git diff analysis. If new generation, state "Initial Documentation".]

## Repo Purpose & Bounded Context
- **Role:** [Architectural role, e.g., "Manages Order Lifecycle"]
- **Domain:** [Business domain it belongs to]

## Project Structure
[Tree view or bullet list of KEY top-level directories and their purposes]

## Public Surface (Inbound)
[Group by functionality. List endpoints/commands exposed]
- **[Group Name]:** [Description of key endpoints/commands]

## Core Services & Logic (Internal)
[Key services/modules and their responsibilities]
- **[Service Name]:** [What logic does it handle?]

## External Dependencies & Contracts (Outbound)
- **Databases:** [List DBs]
- **Message Queues:** [List Queues/Topics]
- **External APIs:** [List downstream services]
```

---

## Phase 3: Architectural Deep Scan (Repo Scope Only)

**Action:** For repo-scope overviews, scan the codebase to identify architectural patterns. Auto-detect the language to use correct terminology.

1. **Project Structure:** Map the directory tree. Identify where logic, configs, and tests live.
2. **Public Surface (Entry Points):** Controllers, route handlers, CLI commands, event listeners.
3. **Core Services & Domain Logic:** Where business logic is isolated. Map data flow.
4. **External Dependencies:** Scan imports and config files. List ALL external systems.

> **For workspace/domain scopes:** Skip deep code scanning. These overviews are based on understanding the overall structure and reading existing child OVERVIEW.md files, not scanning individual source files.

---

## Phase 4: Output & Validation

**Action:** Write the generated content to `{TARGET_PATH}`.

**Validation checklist:**

- [ ] Front-matter includes `name`, `description` (and optionally `tags`, `updated`)
- [ ] `description` field is self-contained (understandable without reading the full document)
- [ ] Metadata header has correct branch, commit hash, date
- [ ] Content follows scope-appropriate template
- [ ] **Workspace scope:** Does NOT list individual packages/repos with descriptions
- [ ] **All scopes:** No tables used in main content (use headings + bullets)
- [ ] Constraint: DO NOT use tables in main content. Use Hierarchical Headings (H2, H3, H4) and Bullet points.
