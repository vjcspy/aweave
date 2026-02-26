---
name: Repo Structure Refactoring
description: Plan to refactor the repository structure to enhance modularity, ease of source code and dependency management.
status: done
created: 2026-02-19
tags: []
---

# 260219 — Repo Structure Refactoring

## References

- `README.md`
- `AGENTS.md` → symlink to `agent/rules/common/rule.md` (new target)
- `.gitignore`
- `.cursor/rules/gitignore-tool-behavior.mdc`
- `agent/rules/common/rule.md` (AGENTS.md source)
- `agent/rules/common/project-structure.md`
- `agent/rules/common/workspaces/business-workspace.md`
- `agent/rules/common/workspaces/devtools.md`
- `agent/rules/common/misc/multi-project-git-structure.md`
- `agent/rules/common/tasks/create-plan.md`
- `agent/rules/common/tasks/implementation.md`
- `agent/rules/common/debate/proposer/coding-plan.md`
- `agent/rules/common/debate/opponent/coding-plan.md`
- `agent/commands/common/create-overview.md`
- `agent/commands/common/debate-proposer.md`
- `agent/commands/common/debate-opponent.md`
- `agent/commands/common/review-branch.md`
- `agent/commands/common/review-plan.md`
- `agent/skills/common/devtools-cli-builder/SKILL.md`
- `agent/skills/common/workflow-builder/SKILL.md`
- `resources/workspaces/devtools/OVERVIEW.md`
- `resources/workspaces/devtools/common/OVERVIEW.md`
- `resources/workspaces/devtools/common/*/OVERVIEW.md` (14 package OVERVIEWs)
- `resources/workspaces/devtools/common/_plans/*.md` (15 plan files)

> All paths above use the NEW structure (post-refactoring).

## Why This Change

### Problems with Current Structure

1. **`projects/` is misleading** — The repo is a multi-workspace platform, but `projects/` implies individual projects. This term also collides with `resources/workspaces/` (documentation mirror), creating confusion about which `projects/` is being referenced.

2. **`devdocs/` mixes concerns** — It bundles three unrelated things: AI agent brain (`agent/`), project documentation (`projects/`), and misc docs (`misc/`). The agent configuration is behavioral, not documentation — it should live at root level.

3. **`devtools/` is isolated** — devtools follows the same `domain/repo` hierarchy as business workspaces, but sits at root as a separate entity. It should live alongside other workspaces for consistency.

4. **`resources/workspaces/devtools/`** — DevTools documentation is buried under a `misc/` folder with no clear relationship to the `devtools/` source code.

5. **No tiered context loading** — All OVERVIEW.md files are loaded as full documents. There's no lightweight "summary" layer for quick identification before committing to a full read.

6. **No user-specific storage** — No designated place for user preferences, memory, or personal context that AI agents can reference.

### Goals

- **Naming accuracy** — Folder names that match their actual purpose
- **Structural consistency** — Source code and documentation follow parallel hierarchies
- **Separation of concerns** — Agent brain, resources, workspaces, and user data are distinct top-level concepts
- **Tiered context loading** — ABSTRACT.md (L0, 100-200 tokens) alongside OVERVIEW.md (L1) enables cheaper agent decision-making
- **Self-documenting for AI** — Structure itself teaches agents where to find things

## Target State

### New Directory Structure

```
<PROJECT_ROOT>/
├── AGENTS.md                    → symlink to agent/rules/common/rule.md
├── README.md
├── .gitignore
│
├── agent/                       # AI Agent brain (moved from agent/)
│   ├── commands/
│   │   ├── common/              # Shared commands (tracked on master)
│   │   └── <ws>/                # Workspace-specific (tracked on ws branch)
│   ├── rules/
│   │   ├── common/
│   │   │   ├── rule.md          # AGENTS.md symlink target
│   │   │   ├── project-structure.md
│   │   │   ├── coding/
│   │   │   ├── debate/
│   │   │   ├── misc/
│   │   │   ├── tasks/
│   │   │   └── workspaces/
│   │   │       ├── business-workspace.md   # renamed from business-project.md
│   │   │       └── devtools.md
│   │   └── <ws>/
│   ├── skills/
│   │   ├── common/
│   │   └── <ws>/
│   └── templates/
│       ├── common/
│       └── <ws>/
│
├── resources/                   # Documentation & context (renamed from devdocs/)
│   ├── workspaces/              # Workspace docs
│   │   ├── devtools/            # DevTools docs (moved from resources/workspaces/devtools/)
│   │   │   ├── ABSTRACT.md      # L0: 100-200 tokens
│   │   │   ├── OVERVIEW.md      # L1: full overview
│   │   │   └── common/
│   │   │       ├── _plans/
│   │   │       └── <PACKAGE>/
│   │   │           ├── ABSTRACT.md
│   │   │           └── OVERVIEW.md
│   │   └── <WORKSPACE>/         # Business workspace docs
│   │       ├── ABSTRACT.md
│   │       ├── OVERVIEW.md
│   │       └── <DOMAIN>/<REPO>/
│   │           ├── ABSTRACT.md
│   │           ├── OVERVIEW.md
│   │           ├── _plans/
│   │           ├── _features/
│   │           ├── _architecture/
│   │           ├── _business/
│   │           ├── _guides/
│   │           ├── _spikes/
│   │           └── _releases/
│   └── misc/                    # Cross-cutting docs
│       └── workflow-optimization/
│
├── workspaces/                  # All source code
│   ├── devtools/                # Platform tooling (tracked in git)
│   │   ├── common/
│   │   ├── scripts/
│   │   ├── <domain>/
│   │   ├── pnpm-workspace.yaml
│   │   └── package.json
│   └── <WORKSPACE>/             # Business workspaces (gitignored)
│       └── <DOMAIN>/<REPO>/
│
├── user/                        # User-specific data
│   ├── profile.md               # tracked template
│   ├── preferences.yaml         # tracked template
│   ├── bookmarks.md             # tracked template
│   ├── memory/.gitkeep          # content ignored
│   ├── snippets/.gitkeep        # content ignored
│   └── context/.gitkeep         # content ignored
│
└── .cursor/rules/
```

### Path Mapping (Old → New)

| Purpose | Old Path | New Path |
|---------|----------|----------|
| Source code | `projects/<WS>/<DOMAIN>/<REPO>/` | `workspaces/<WS>/<DOMAIN>/<REPO>/` |
| Workspace docs | `resources/workspaces/<WS>/<DOMAIN>/<REPO>/` | `resources/workspaces/<WS>/<DOMAIN>/<REPO>/` |
| Agent rules | `agent/rules/common/` | `agent/rules/common/` |
| Agent commands | `agent/commands/common/` | `agent/commands/common/` |
| Agent skills | `agent/skills/common/` | `agent/skills/common/` |
| Agent templates | `agent/templates/common/` | `agent/templates/common/` |
| DevTools source | `devtools/common/<pkg>/` | `workspaces/devtools/common/<pkg>/` |
| DevTools docs | `resources/workspaces/devtools/common/<pkg>/` | `resources/workspaces/devtools/common/<pkg>/` |
| Misc docs | `resources/misc/<folder>/` | `resources/misc/<folder>/` |
| Workspace type | `business-project` | `business-workspace` |
| Branch names | `projects/<ws>` | `workspaces/<ws>` |
| AGENTS.md target | `agent/rules/common/rule.md` | `agent/rules/common/rule.md` |

### Git Branch Architecture (New)

```
master                      ← Common/shared content only
├── workspaces/k            ← master + k-specific content
├── workspaces/tinybots     ← master + tinybots-specific content
└── workspaces/<NEW>        ← master + new workspace content
```

### Context Loading Tiers

| Tier | File | Size | When Agent Loads |
|------|------|------|-----------------|
| L0 (Abstract) | `ABSTRACT.md` | 100-200 tokens | Always — for quick identification and routing |
| L1 (Overview) | `OVERVIEW.md` | 1-2 pages | When workspace/repo is identified as target |
| L2 (Details) | `_plans/`, `_architecture/`, etc. | Full docs | Only when deep reading is needed |

---

## Approach

### Strategy: Master First, Then Workspace Branches

1. **Phase A (master):** Move directories, update all common content, commit to master
2. **Phase B (per workspace branch):** Rebase on new master, move workspace-specific content, update paths, rename branch

This conversation covers Phase A only. Phase B is documented as a self-contained guide for AI agents to execute on each workspace branch independently.

### Content Update Strategy

Path references in files are updated using ordered replacement rules. Apply most-specific patterns first to avoid double-replacement:

| # | Old Pattern | New Pattern | Notes |
|---|-------------|-------------|-------|
| 1 | `resources/workspaces/devtools/` | `resources/workspaces/devtools/` | DevTools docs (most specific) |
| 2 | `resources/workspaces/` | `resources/workspaces/` | Workspace docs |
| 3 | `agent/` | `agent/` | Agent config |
| 4 | `resources/misc/` | `resources/misc/` | Remaining misc |
| 5 | `devdocs/` | *(should be empty after 1-4, flag if found)* | Catch-all |
| 6 | `devtools/` → `workspaces/devtools/` | Context-sensitive | Only standalone refs, not part of longer paths already handled |
| 7 | `projects/` → `workspaces/` | Context-sensitive | Only source code refs |
| 8 | `business-project` → `business-workspace` | Workspace type rename | |

**Rules 6-7 require manual review:** Some `devtools/` refs are shell commands (e.g., `cd devtools && pnpm install`) which need updating to `cd workspaces/devtools`. Others may already be correct after rules 1-4.

---

## Implementation Plan

### Phase 1: Preparation

- [ ] **1.1** Checkout master and create working branch
  ```bash
  git checkout master && git pull origin master
  git checkout -b refactor/repo-structure
  git status  # verify clean
  ```

### Phase 2: Directory Moves

All moves use `git mv` to preserve history. Order: deepest paths first.

- [ ] **2.1** Move `agent/` → `agent/`
  ```bash
  git mv devdocs/agent agent
  ```

- [ ] **2.2** Move `resources/workspaces/devtools/` → `resources/workspaces/devtools/`
  ```bash
  mkdir -p resources/workspaces
  git mv resources/misc/devtools resources/workspaces/devtools
  ```

- [ ] **2.3** Move `resources/misc/` → `resources/misc/`
  ```bash
  git mv devdocs/misc resources/misc
  ```

- [ ] **2.4** Move `resources/workspaces/.gitkeep` → `resources/workspaces/.gitkeep`
  ```bash
  git mv resources/workspaces/.gitkeep resources/workspaces/.gitkeep
  rmdir devdocs/projects 2>/dev/null || true
  ```

- [ ] **2.5** Remove empty `devdocs/`
  ```bash
  rmdir devdocs
  ```

- [ ] **2.6** Move `devtools/` → `workspaces/devtools/`
  ```bash
  mkdir -p workspaces
  git mv devtools workspaces/devtools
  touch workspaces/.gitkeep && git add workspaces/.gitkeep
  ```

- [ ] **2.7** Rename `business-project.md` → `business-workspace.md`
  ```bash
  git mv agent/rules/common/workspaces/business-project.md agent/rules/common/workspaces/business-workspace.md
  ```

- [ ] **2.8** Update AGENTS.md symlink
  ```bash
  rm AGENTS.md
  ln -s agent/rules/common/rule.md AGENTS.md
  ```

- [ ] **2.9** Create `user/` structure
  ```bash
  mkdir -p user/snippets user/context
  touch user/snippets/.gitkeep user/context/.gitkeep
  ```
  Create template files: `user/profile.md`, `user/preferences.yaml`, `user/bookmarks.md`

- [ ] **2.10** Verify moves
  ```bash
  # Old dirs should NOT exist
  test ! -d devdocs && test ! -d devtools && echo "OK: old dirs removed"
  # New dirs should exist
  ls agent/rules/common/rule.md resources/workspaces/devtools/OVERVIEW.md workspaces/devtools/common/
  ```

### Phase 3: Update `.gitignore`

- [ ] **3.1** Replace `.gitignore` with new version:

```gitignore
# ========================================
# OS & IDE
# ========================================
.DS_Store
.idea/
.cursor/
.trae/
personal/

# Symlinks
AGENTS.md

# ========================================
# User data (structure tracked, content ignored)
# ========================================
user/snippets/**
!user/snippets/.gitkeep
user/context/**
!user/context/.gitkeep

# ========================================
# Workspaces
# ========================================
workspaces/*/
!workspaces/devtools/

# DevTools — only common/, scripts/ and root files on master
workspaces/devtools/*/
!workspaces/devtools/common/
!workspaces/devtools/scripts/

# ========================================
# Agent — only common/ on master
# ========================================
agent/commands/*
!agent/commands/common/
agent/rules/*
!agent/rules/common/
agent/skills/*
!agent/skills/common/
agent/templates/*
!agent/templates/common/

# ========================================
# Resources — workspace docs excluded on master
# ========================================
resources/workspaces/*
!resources/workspaces/.gitkeep
!resources/workspaces/devtools/

# Resources — devtools docs, only common/ on master
resources/workspaces/devtools/*/
!resources/workspaces/devtools/common/
```

- [ ] **3.2** Verify gitignore
  ```bash
  git check-ignore -v workspaces/devtools/common/    # should NOT be ignored
  git check-ignore -v workspaces/k/                  # should be ignored
  git check-ignore -v agent/rules/common/            # should NOT be ignored
  git check-ignore -v resources/workspaces/k/        # should be ignored (on master)
  git check-ignore -v resources/workspaces/devtools/common/ # should NOT be ignored
  ```

### Phase 4: Update Agent Rules (Core — 5 files, ~155 refs)

These files define AI agent behavior. Correctness is critical.

- [ ] **4.1** Update `agent/rules/common/rule.md` (AGENTS.md source) — 17 refs
  - Frontmatter: update symlink note path
  - Workspace detection table: `projects/<project>/...` → `workspaces/<ws>/...`
  - Workspace detection table: `resources/workspaces/<project>/...` → `resources/workspaces/<ws>/...`
  - Workspace detection table: `devtools/...` → `workspaces/devtools/...`
  - Workspace detection table: `resources/workspaces/devtools/...` → `resources/workspaces/devtools/...`
  - Workspace type: `business-project` → `business-workspace`
  - Load path: `agent/rules/common/workspaces/business-project.md` → `agent/rules/common/workspaces/business-workspace.md`
  - Load path: `agent/rules/common/workspaces/devtools.md` → `agent/rules/common/workspaces/devtools.md`
  - Task rule paths: `agent/rules/common/tasks/*` → `agent/rules/common/tasks/*`
  - Contextual rules paths: `agent/rules/common/project-structure.md` → `agent/rules/common/project-structure.md`
  - Contextual rules paths: `agent/rules/common/coding/*` → `agent/rules/common/coding/*`
  - Examples: update all example paths
  - Fast Track paths: `agent/commands/common/debate-*.md` → `agent/commands/common/debate-*.md`
  - Source Code Location section: `projects/` → `workspaces/`

- [ ] **4.2** Update `agent/rules/common/workspaces/business-workspace.md` — 31 refs
  - Title: `Business Project Workspace` → `Business Workspace`
  - Description: `projects/` folder → `workspaces/` folder
  - Path variables: `projects/` → `workspaces/`
  - All Key Paths table entries
  - All scope detection examples
  - Context loading order paths
  - Search scope paths
  - Working with Plans paths
  - Working with Features paths
  - Local Development: `devtools/<PROJECT_NAME>/local/` → `workspaces/devtools/<PROJECT_NAME>/local/`

- [ ] **4.3** Update `agent/rules/common/workspaces/devtools.md` — 39 refs
  - Description: `devtools/` → `workspaces/devtools/`
  - Path variables: `devtools/` → `workspaces/devtools/`
  - All Key Paths: source and doc paths
  - Folder structure diagram: both `devtools/` and `resources/workspaces/devtools/`
  - Context loading paths
  - Search scope paths
  - Skill loading paths
  - Path detection examples
  - CLI development paths
  - Development commands

- [ ] **4.4** Update `agent/rules/common/project-structure.md` — 6 refs
  - Full directory structure diagram: rewrite with new structure
  - Reference to workspace rule files

- [ ] **4.5** Update `agent/rules/common/misc/multi-project-git-structure.md` — 61 refs
  - Branch architecture: `projects/<name>` → `workspaces/<name>`
  - All gitignore pattern examples: update paths
  - Master branch tracking table: all paths
  - "Creating a New Project Branch" → "Creating a New Workspace Branch"
  - All step-by-step commands and examples
  - Reference master `.gitignore` structure: full rewrite

### Phase 5: Update Agent Rules (Tasks + Debate — 4 files, ~10 refs)

- [ ] **5.1** Update `agent/rules/common/tasks/create-plan.md` — 2 refs
  - Template path: `agent/templates/common/create-plan.md` → `agent/templates/common/create-plan.md`

- [ ] **5.2** Update `agent/rules/common/tasks/implementation.md` — 2 refs
  - Coding standards path: `agent/rules/common/coding/...` → `agent/rules/common/coding/...`
  - Source locate: `projects/<PROJECT_NAME>/...` → `workspaces/<PROJECT_NAME>/...`
  - Plan file path pattern: `devdocs/**/_plans/*.md` → `resources/**/_plans/*.md`

- [ ] **5.3** Update `agent/rules/common/debate/proposer/coding-plan.md` — 2 refs
  - Command reference: `agent/commands/common/debate-proposer.md` → `agent/commands/common/debate-proposer.md`

- [ ] **5.4** Update `agent/rules/common/debate/opponent/coding-plan.md` — 4 refs
  - Workspace rule paths in table: `agent/rules/common/workspaces/business-project.md` → `agent/rules/common/workspaces/business-workspace.md`
  - Workspace rule paths in table: `agent/rules/common/workspaces/devtools.md` → `agent/rules/common/workspaces/devtools.md`
  - Coding standards: `agent/rules/common/coding/*.md` → `agent/rules/common/coding/*.md`
  - Project overview: `resources/workspaces/<PROJECT>/OVERVIEW.md` → `resources/workspaces/<PROJECT>/OVERVIEW.md`

### Phase 6: Update Agent Commands (6 files, ~28 refs)

- [ ] **6.1** Update + enhance `agent/commands/common/create-overview.md` — 5 refs + NEW ABSTRACT.md section
  - Path resolution table: `projects/<PROJECT>/...` → `workspaces/<WS>/...`
  - Path resolution table: `resources/workspaces/...` → `resources/workspaces/...`
  - Resolution logic: all path derivation rules
  - **NEW: Add Phase 4 — ABSTRACT.md Generation**
    - After generating/updating OVERVIEW.md, also create/update `ABSTRACT.md` in same directory
    - ABSTRACT.md content: 100-200 tokens max, one-paragraph summary
    - Template:
      ```markdown
      # <Name> — Abstract
      
      <One paragraph, 100-200 tokens. Describe: what this is, its primary purpose, key technologies, and relationship to other components.>
      ```
    - If ABSTRACT.md exists, update it to reflect any changes in OVERVIEW.md
    - If ABSTRACT.md does not exist, generate it from the OVERVIEW.md content

- [ ] **6.2** Update `agent/commands/common/debate-proposer.md` — 4 refs
  - CLI reference paths: `resources/workspaces/devtools/common/cli-plugin-debate/OVERVIEW.md` → `resources/workspaces/devtools/common/cli-plugin-debate/OVERVIEW.md`
  - CLI reference paths: `resources/workspaces/devtools/common/cli-plugin-docs/OVERVIEW.md` → `resources/workspaces/devtools/common/cli-plugin-docs/OVERVIEW.md`
  - Rule file paths: `agent/rules/common/debate/proposer/*.md` → `agent/rules/common/debate/proposer/*.md`

- [ ] **6.3** Update `agent/commands/common/debate-opponent.md` — 4 refs
  - Same CLI reference paths as debate-proposer
  - Rule file paths: `agent/rules/common/debate/opponent/*.md` → `agent/rules/common/debate/opponent/*.md`

- [ ] **6.4** Update `agent/commands/common/review-branch.md` — 6 refs
  - Skill path: `agent/skills/common/code-review/SKILL.md` → `agent/skills/common/code-review/SKILL.md`
  - REPO_PATH examples: `projects/nab/hod/...` → `workspaces/nab/hod/...`
  - Project context paths: `resources/workspaces/<PROJECT>/...` → `resources/workspaces/<PROJECT>/...`

- [ ] **6.5** Update `agent/commands/common/review-plan.md` — 4 refs
  - Plan path pattern: `devdocs/<project>/<domain>/<repo>/_plans/...` → `resources/workspaces/<ws>/<domain>/<repo>/_plans/...`
  - Overview paths: `devdocs/<PROJECT>/OVERVIEW.md` → `resources/workspaces/<WS>/OVERVIEW.md`

- [ ] **6.6** Update `agent/commands/common/create-skill.md` — check and update any paths

### Phase 7: Update Agent Skills (2 files, ~44 refs)

- [ ] **7.1** Update `agent/skills/common/devtools-cli-builder/SKILL.md` — 39 refs
  - All `devtools/` source paths → `workspaces/devtools/`
  - All `resources/workspaces/devtools/` doc paths → `resources/workspaces/devtools/`
  - Workspace config paths

- [ ] **7.2** Update `agent/skills/common/workflow-builder/SKILL.md` — 5 refs
  - Same pattern of replacements

### Phase 8: Update `.cursor/rules/` and README

- [ ] **8.1** Update `.cursor/rules/gitignore-tool-behavior.mdc` — 8 refs
  - Replace all `projects/` references with `workspaces/`
  - Note that `workspaces/devtools/` is tracked (exception to gitignore)
  - Update tool compatibility notes

- [ ] **8.2** Rewrite `README.md` — 17 refs
  - Directory structure diagram: full rewrite with new structure
  - Path conventions table: all paths updated
  - Workspace-aware routing table: updated patterns
  - Context layers diagram: add L0 (ABSTRACT.md) tier
  - Documentation links section: all paths updated
  - Add `user/` folder description
  - Add Tiered Context Loading section (ABSTRACT.md / OVERVIEW.md / detailed docs)
  - DevTools commands: `cd devtools` → `cd workspaces/devtools`

### Phase 9: Update DevTools Documentation (30+ files, ~594 refs)

#### Batch replacement approach

Most devtools doc files can be updated with ordered sed replacements:

```bash
find resources/workspaces/devtools/ -name '*.md' -exec sed -i '' \
  -e 's|resources/workspaces/devtools/|resources/workspaces/devtools/|g' \
  -e 's|resources/workspaces/|resources/workspaces/|g' \
  -e 's|agent/|agent/|g' \
  -e 's|resources/misc/|resources/misc/|g' \
  {} +
```

Then handle `devtools/` → `workspaces/devtools/` manually per file (context-sensitive).

- [ ] **9.1** Batch update OVERVIEW files (16 files)
  - `resources/workspaces/devtools/OVERVIEW.md` — 30 refs
  - `resources/workspaces/devtools/common/OVERVIEW.md` — 31 refs
  - 14 package OVERVIEW files — 4-17 refs each
  - After batch sed, manual review for standalone `devtools/` refs

- [ ] **9.2** Batch update plan files (15 files)
  - Apply same sed replacements
  - Manual review for `devtools/` context (e.g., `cd devtools && pnpm install` → `cd workspaces/devtools && pnpm install`)

- [ ] **9.3** Update `resources/misc/workflow-optimization/260215-agent-workflow-v1.md`

### Phase 10: Create ABSTRACT.md Files (L0 Tier)

Create ABSTRACT.md alongside each OVERVIEW.md on master. Content: 100-200 tokens, single paragraph.

- [ ] **10.1** Create `resources/workspaces/devtools/ABSTRACT.md`
- [ ] **10.2** Create ABSTRACT.md for each devtools package that has OVERVIEW.md (14 packages)

### Phase 11: Create User Template Files

- [ ] **11.1** Create `user/profile.md` with template:
  ```markdown
  # User Profile
  
  ## Identity
  - **Name:**
  - **Role:**
  - **Expertise:**
  
  ## Preferences
  - **Language:** (conversation language preference)
  - **Coding Style:** (any specific preferences)
  
  ## Working Context
  - **Current Focus:**
  - **Team:**
  ```

- [ ] **11.2** Create `user/preferences.yaml` with defaults:
  ```yaml
  language: en
  commit_style: conventional
  ```

- [ ] **11.3** Create `user/bookmarks.md` with template:
  ```markdown
  # Bookmarks
  
  ## Workspaces
  
  ## Tools & Dashboards
  
  ## Documentation
  ```

### Phase 12: Final Verification & Commit

- [ ] **12.1** Search for remaining old paths
  ```bash
  rg 'devdocs/' --type md -l | grep -v 'resources/misc/_plans/260219'
  rg -w '^devtools/' --type md -l
  ```

- [ ] **12.2** Verify AGENTS.md symlink resolves correctly
  ```bash
  readlink AGENTS.md  # should show agent/rules/common/rule.md
  head -5 AGENTS.md   # should show content
  ```

- [ ] **12.3** Verify gitignore
  ```bash
  git status  # review what's tracked
  git check-ignore -v workspaces/devtools/common/cli/  # NOT ignored
  ```

- [ ] **12.4** Commit
  ```bash
  git add -A
  git diff --cached --stat
  git commit -m "refactor: restructure repo — workspaces, agent, resources, user

  - projects/ → workspaces/ (source code)
  - agent/ → agent/ (AI agent brain at root)
  - devdocs/ → resources/ (documentation & context)
  - devtools/ → workspaces/devtools/ (unified under workspaces)
  - Add user/ folder for user-specific data
  - Add ABSTRACT.md (L0) alongside OVERVIEW.md files
  - Rename business-project → business-workspace
  - Update all path references (~800+) across ~55 files"
  ```

- [ ] **12.5** Merge to master and push
  ```bash
  git checkout master
  git merge refactor/repo-structure
  git push origin master
  git branch -d refactor/repo-structure
  ```

---

## Guide for Workspace Branch Migration (Phase B)

> **Audience:** AI agents executing workspace branch migration after master restructuring is complete.
> **Prerequisites:** Master branch has been restructured per Phase A above.

### Context

Each workspace lives on its own git branch (e.g., `workspaces/k`, `workspaces/tinybots`). Currently these branches are named `projects/<ws>`. After master restructuring, workspace branches need to:

1. Rebase on the new master (picks up all common content moves)
2. Move workspace-specific files to new paths
3. Update path references in workspace-specific content
4. Update `.gitignore` branch-specific negate patterns
5. Add ABSTRACT.md files for workspace docs
6. Rename the branch

### Step-by-Step Instructions

#### B.1: Rebase on New Master

```bash
git checkout projects/<WS_NAME>
git fetch origin master
git rebase origin/master
```

**Conflict resolution:** Expect conflicts in `.gitignore` (the branch-specific negate section at the end). Resolution:
- Accept master's new gitignore structure (everything above the branch section)
- Update the branch-specific section to use new paths (see B.4)

After rebase, most common content is already at new paths (moved by master). Only workspace-specific files remain at old locations.

#### B.2: Move Workspace-Specific Files

Check what old-path files remain after rebase:

```bash
find devdocs/ -type f 2>/dev/null  # should show workspace-specific docs
find devtools/ -type d -maxdepth 1 2>/dev/null  # should show workspace domain dirs
```

Move them:

```bash
# Workspace docs: resources/workspaces/<WS>/ → resources/workspaces/<WS>/
git mv resources/workspaces/<WS_NAME> resources/workspaces/<WS_NAME>

# Workspace agent files (if any):
git mv agent/commands/<WS_NAME> agent/commands/<WS_NAME> 2>/dev/null
git mv agent/rules/<WS_NAME> agent/rules/<WS_NAME> 2>/dev/null
git mv agent/skills/<WS_NAME> agent/skills/<WS_NAME> 2>/dev/null
git mv agent/templates/<WS_NAME> agent/templates/<WS_NAME> 2>/dev/null

# Workspace devtools domain (if any):
git mv resources/workspaces/devtools/<WS_NAME> resources/workspaces/devtools/<WS_NAME> 2>/dev/null
git mv devtools/<WS_NAME> workspaces/devtools/<WS_NAME> 2>/dev/null

# Clean up empty old directories:
rmdir devdocs/projects agent/commands agent/rules agent/skills agent/templates resources/misc/devtools devdocs/misc devdocs/agent devdocs devtools 2>/dev/null
```

#### B.3: Update Workspace-Specific Content

Apply the same replacement rules to workspace docs:

```bash
find resources/workspaces/<WS_NAME>/ -name '*.md' -exec sed -i '' \
  -e 's|resources/workspaces/devtools/|resources/workspaces/devtools/|g' \
  -e 's|resources/workspaces/|resources/workspaces/|g' \
  -e 's|agent/|agent/|g' \
  -e 's|resources/misc/|resources/misc/|g' \
  -e 's|projects/<WS_NAME>/|workspaces/<WS_NAME>/|g' \
  {} +
```

Then manually review for standalone `devtools/` and `projects/` references:

```bash
rg 'devdocs/|projects/' resources/workspaces/<WS_NAME>/ --type md
```

Also update workspace-specific agent files if any:

```bash
rg 'devdocs/|projects/' agent/commands/<WS_NAME>/ agent/rules/<WS_NAME>/ agent/skills/<WS_NAME>/ 2>/dev/null
```

#### B.4: Update `.gitignore` Branch Section

Replace the old branch negate section at the end of `.gitignore`:

**Old:**
```gitignore
# ========================================
# Branch: projects/<WS_NAME>
# ========================================
!agent/commands/<WS_NAME>/
!agent/rules/<WS_NAME>/
!agent/skills/<WS_NAME>/
!agent/templates/<WS_NAME>/
!resources/workspaces/devtools/<WS_NAME>/
!resources/workspaces/<WS_NAME>/
!devtools/<WS_NAME>/
```

**New:**
```gitignore
# ========================================
# Branch: workspaces/<WS_NAME>
# ========================================
!agent/commands/<WS_NAME>/
!agent/rules/<WS_NAME>/
!agent/skills/<WS_NAME>/
!agent/templates/<WS_NAME>/
!resources/workspaces/devtools/<WS_NAME>/
!resources/workspaces/<WS_NAME>/
!workspaces/devtools/<WS_NAME>/
```

#### B.5: Add ABSTRACT.md Files

Create ABSTRACT.md alongside each OVERVIEW.md in the workspace docs:

```bash
# Find all OVERVIEW.md files under this workspace
find resources/workspaces/<WS_NAME>/ -name 'OVERVIEW.md'
```

For each OVERVIEW.md found, create a sibling ABSTRACT.md with:
- Read the OVERVIEW.md content
- Write a 100-200 token summary paragraph
- Save as ABSTRACT.md in the same directory

Template:
```markdown
# <Name> — Abstract

<One paragraph, 100-200 tokens. Describe: what this is, primary purpose, key technologies, domain context.>
```

#### B.6: Rename Branch

```bash
# Rename local
git branch -m projects/<WS_NAME> workspaces/<WS_NAME>

# Push new, delete old
git push origin workspaces/<WS_NAME>
git push origin --delete projects/<WS_NAME>
git branch -u origin/workspaces/<WS_NAME>
```

#### B.7: Verify

```bash
# No old paths
rg 'devdocs/' --type md -l

# Gitignore correct
git check-ignore -v workspaces/<WS_NAME>/       # should be ignored (source code)
git check-ignore -v resources/workspaces/<WS_NAME>/  # should NOT be ignored (docs)

# AGENTS.md works
readlink AGENTS.md && head -5 AGENTS.md

# Correct branch
git branch --show-current  # should show workspaces/<WS_NAME>
```

#### B.8: Commit and Push

```bash
git add -A
git commit -m "refactor: migrate workspace <WS_NAME> to new repo structure

- Move workspace docs to resources/workspaces/<WS_NAME>/
- Update all path references
- Add ABSTRACT.md files
- Update .gitignore branch section"
git push origin workspaces/<WS_NAME>
```

---

## Summary of Results

### Completed Achievements

*(To be filled during execution)*

## Outstanding Issues & Follow-up

- [ ] Shell commands in devtools docs (e.g., `cd devtools && pnpm install`) need manual update to `cd workspaces/devtools`
- [ ] `agent/commands/meta/` folder may need rename to match workspace name (currently `meta/` on `projects/k` branch)
- [ ] pnpm-workspace.yaml internal paths are relative to devtools root — should be unaffected by the move, but verify after
- [ ] Global npm install path (`pnpm link --global`) may need update in user shell configs
- [ ] Consider adding ABSTRACT.md auto-generation command to devtools CLI
- [ ] Consider creating an ABSTRACT.md template in `agent/templates/common/`
