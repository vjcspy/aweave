# Multi-Workspace Git Structure

This workspace manages multiple independent workspaces in a single repository. Git branches and `.gitignore` patterns separate common (shared) content from workspace-specific content.

## Branch Architecture

```
master                    ← Common/shared content only
├── workspaces/nab        ← master + nab-specific content
├── workspaces/<OTHER>    ← master + other workspace content
└── workspaces/<NEW>      ← master + new workspace content
```

### master branch

Contains **only** shared/common content:

| Area | What is tracked | Pattern |
|---|---|---|
| `agent/commands/common/` | Shared agent commands | `commands/*` + `!commands/common/` |
| `agent/rules/common/` | Shared agent rules | `rules/*` + `!rules/common/` |
| `agent/skills/common/` | Shared agent skills | `skills/*` + `!skills/common/` |
| `agent/templates/common/` | Shared templates | `templates/*` + `!templates/common/` |
| `resources/workspaces/devtools/common/` | Shared devtools docs (includes _plans/) | `*/` + `!common/` |
| `workspaces/devtools/common/` | Shared dev tools (CLI, libs) | `*/` + `!common/` |
| `workspaces/devtools/scripts/` | Shared scripts | `*/` + `!scripts/` |
| `workspaces/devtools/` root files | Monorepo config (package.json, turbo.json, etc.) | Root files not matched by `*/` |

### Workspace branches (`workspaces/WORKSPACE_NAME`)

Inherit everything from master, plus workspace-specific content unlocked via negate patterns appended to `.gitignore`.

## Gitignore Pattern System

The `.gitignore` uses an **exclude-all + negate** strategy:

1. **Positive patterns** exclude all content in a directory (e.g., `agent/commands/*`)
2. **Negate patterns** (`!`) re-include specific subdirectories (e.g., `!agent/commands/common/`)
3. On master, only `common/` (and similar shared dirs) are negated
4. On workspace branches, additional negate patterns are **appended at the end** of the file

### Pattern Types Used

| Pattern | Matches | Used for |
|---|---|---|
| `dir/*` | All entries (files + dirs) one level inside `dir/` | `agent/commands/*`, `resources/workspaces/*` |
| `dir/*/` | All **directories** one level inside `dir/` (files untouched) | `resources/workspaces/devtools/*/`, `workspaces/devtools/*/` |
| `!dir/name/` | Re-include a specific directory | Negate patterns for common/ and workspace dirs |

### Why single star (`*`) not double star (`**`)

For directories where workspace branches need to negate entries, **always use single star** (`*` or `*/`):

- `resources/workspaces/*` — allows simple negation: `!resources/workspaces/nab/`
- `resources/workspaces/**` — negation requires **two lines** (`!.../nab/` + `!.../nab/**`) because `**` matches at all depths and blocks re-inclusion of nested content

Single star is used for both `workspaces/*` and `resources/workspaces/*` since both need negation patterns on workspace branches.

## Always Excluded (All Branches)

These are **never** tracked regardless of branch:

| Path | Reason |
|---|---|
| `workspaces/*` (except `devtools/`) | Business workspace source code — managed externally (separate repos, submodules, etc.) |
| `.DS_Store` | OS artifact |
| `.idea/`, `.cursor/`, `.trae/` | IDE configs |
| `AGENTS.md` | Symlink |

## Creating a New Workspace Branch

When setting up a new workspace (e.g., `newworkspace`):

### Step 1: Create and switch to branch

```bash
git checkout master
git pull origin master
git checkout -b workspaces/newworkspace
```

### Step 2: Append negate patterns to `.gitignore`

Add the following block at the **end** of `.gitignore`:

```gitignore
# ========================================
# Branch: workspaces/newworkspace
# ========================================
!agent/commands/newworkspace/
!agent/rules/newworkspace/
!agent/skills/newworkspace/
!agent/templates/newworkspace/
!resources/workspaces/devtools/newworkspace/
!resources/workspaces/newworkspace/
!workspaces/devtools/newworkspace/
!workspaces/newworkspace/
```

### Step 3: Create workspace directories (as needed)

```bash
mkdir -p agent/commands/newworkspace
mkdir -p agent/rules/newworkspace
mkdir -p agent/skills/newworkspace
mkdir -p agent/templates/newworkspace
mkdir -p resources/workspaces/newworkspace
mkdir -p workspaces/devtools/newworkspace/local
```

### Step 4: Verify

```bash
# Should show new workspace dirs as untracked (??)
git status

# Should confirm workspace dirs are NOT ignored
git check-ignore -v resources/workspaces/newworkspace/
# Expected: exit code 1 (not ignored) or shows negation pattern

# Should confirm other workspaces ARE still ignored
git check-ignore -v resources/workspaces/otherworkspace/
# Expected: shows positive ignore pattern from master
```

### Step 5: Commit and push

```bash
git add .gitignore
git commit -m "chore: setup workspaces/newworkspace branch gitignore"
git push -u origin workspaces/newworkspace
```

## Merging Updates from Master

Workspace branches should periodically sync with master:

```bash
git checkout workspaces/newworkspace
git rebase master
# Or: git merge master
```

Since workspace branches only **append** negate patterns at the end of `.gitignore`, merge conflicts are minimal. Conflicts only occur if master also modifies the last lines of the file.

## Reference: Master `.gitignore` Structure

```gitignore
# OS & IDE
.DS_Store
.idea/
.cursor/
.trae/
AGENTS.md

# workspaces — devtools tracked, rest excluded
workspaces/*
!workspaces/devtools/
!workspaces/.gitkeep

# workspaces/devtools — only common/, scripts/ and root files
workspaces/devtools/*/
!workspaces/devtools/common/
!workspaces/devtools/scripts/

# agent — only common/
agent/commands/*
!agent/commands/common/
agent/rules/*
!agent/rules/common/
agent/skills/*
!agent/skills/common/
agent/templates/*
!agent/templates/common/

# resources/workspaces — only devtools/
resources/workspaces/*
!resources/workspaces/devtools/
!resources/workspaces/.gitkeep

# resources/workspaces/devtools — only common/
resources/workspaces/devtools/*/
!resources/workspaces/devtools/common/
```
