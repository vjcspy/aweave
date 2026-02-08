# Review Branch Command

> **Role:** Senior Code Reviewer and Software Engineer
> **Objective:** Review code changes on a feature branch compared to a base branch

## Required Skill (MUST LOAD FIRST)

**Before starting any review, LOAD this skill:**

```
devdocs/agent/skills/common/code-review/SKILL.md
```

This skill contains:
- Review workflow checklist
- Review categories (Security, Performance, Code Quality, Testing, etc.)
- Feedback format template
- Severity guidelines
- Common patterns to look for

**This command focuses on:**
- Git operations to prepare for review
- Branch comparison and diff extraction
- Integration with the code-review skill

---

## Main Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        REVIEW BRANCH WORKFLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────────┐                                                  │
│   │ Phase 0:         │                                                  │
│   │ Pre-flight Check │                                                  │
│   └────────┬─────────┘                                                  │
│            │                                                            │
│     ┌──────┴──────┐                                                     │
│     │             │                                                     │
│     ▼             ▼                                                     │
│  Clean?         Dirty?                                                  │
│     │             │                                                     │
│     │             ▼                                                     │
│     │     ┌──────────────────┐                                          │
│     │     │ ❌ STOP          │                                          │
│     │     │ Report to user   │                                          │
│     │     │ Wait for resolve │                                          │
│     │     └──────────────────┘                                          │
│     │                                                                   │
│     ▼                                                                   │
│   ┌──────────────────┐                                                  │
│   │ Phase 1:         │                                                  │
│   │ Git Setup        │                                                  │
│   │ - fetch --all    │                                                  │
│   │ - checkout       │                                                  │
│   │ - pull latest    │                                                  │
│   └────────┬─────────┘                                                  │
│            │                                                            │
│     ┌──────┴──────┐                                                     │
│     │             │                                                     │
│     ▼             ▼                                                     │
│  Success?      Failed?                                                  │
│     │             │                                                     │
│     │             ▼                                                     │
│     │     ┌──────────────────┐                                          │
│     │     │ ❌ STOP          │                                          │
│     │     │ Report git error │                                          │
│     │     └──────────────────┘                                          │
│     │                                                                   │
│     ▼                                                                   │
│   ┌──────────────────┐                                                  │
│   │ Phase 2:         │                                                  │
│   │ Generate Diff    │                                                  │
│   │ - merge-base     │                                                  │
│   │ - diff --stat    │                                                  │
│   │ - diff content   │                                                  │
│   └────────┬─────────┘                                                  │
│            │                                                            │
│            ▼                                                            │
│   ┌──────────────────┐                                                  │
│   │ Phase 3:         │                                                  │
│   │ Code Review      │                                                  │
│   │ (Load SKILL.md)  │                                                  │
│   └────────┬─────────┘                                                  │
│            │                                                            │
│            ▼                                                            │
│   ┌──────────────────┐                                                  │
│   │ Phase 4:         │                                                  │
│   │ Output Report    │                                                  │
│   └────────┬─────────┘                                                  │
│            │                                                            │
│            ▼                                                            │
│   ┌──────────────────┐                                                  │
│   │ Phase 5:         │                                                  │
│   │ Next Steps       │                                                  │
│   └──────────────────┘                                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Input Variables

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `REPO_PATH` | ✅ | - | Path to repo relative to workspace root | `projects/tinybots/backend/eve` |
| `FEATURE_BRANCH` | ✅ | - | Name of feature branch to review | `feature/PROD-437-sensara-endpoints` |
| `BASE_BRANCH` | ❌ | `develop` | Branch to compare against | `main`, `develop` |
| `REVIEW_SCOPE` | ❌ | `full` | Review depth: `quick`, `full`, `deep` | `full` |

---

## Critical Rules for AI Agent (MUST READ)

### ⛔ Hard Stops - NEVER Proceed If:

1. **Uncommitted changes detected** → Report and wait for user action
2. **Branch does not exist** → Report and ask for correct branch name
3. **Git operation fails** → Report error, do NOT retry automatically
4. **Repository path invalid** → Ask user to verify path

### ✅ Required Actions:

1. **LOAD the skill first** - `devdocs/agent/skills/common/code-review/SKILL.md`
2. **Run Phase 0 first** - Pre-flight check is non-negotiable
3. **Use `--ff-only`** for pull to avoid accidental merges
4. **Read full file context** when reviewing, not just diff lines

### ❌ DO NOT:

- ❌ Skip loading the code-review skill
- ❌ Skip Phase 0 pre-flight checks
- ❌ Run `git checkout` before checking for uncommitted changes
- ❌ Auto-fix or auto-commit anything during review
- ❌ Proceed silently when errors occur

---

## Phase 0: Pre-flight Checks (CRITICAL - DO NOT SKIP)

**Action:** Verify workspace is clean before any git operations.

### Step 0.1: Navigate to Repository

```bash
cd {REPO_PATH}
```

**If directory does not exist:**
- ❌ STOP immediately
- Report: `Repository not found at {REPO_PATH}`
- Ask user to verify the path

### Step 0.2: Check Working Directory Status

```bash
git status --porcelain
```

**Decision tree:**

```
IF output is NOT empty:
    → ❌ STOP IMMEDIATELY
    → Report uncommitted changes to user
    → List changed files
    → Ask user to:
      1. Commit changes: `git add . && git commit -m "message"`
      2. Stash changes: `git stash push -m "before review"`
      3. Discard changes: `git checkout -- .`
    → DO NOT proceed until workspace is clean

IF output is empty:
    → ✅ Workspace is clean, proceed to Phase 1
```

**Sample stop message:**

```markdown
## ⚠️ Cannot Proceed - Uncommitted Changes Detected

Found uncommitted changes in `{REPO_PATH}`:

**Modified files:**
- `src/app.ts`
- `src/services/user.ts`

**Untracked files:**
- `test.log`

**Please resolve before continuing:**
1. `git stash push -m "before review"` - Stash changes temporarily
2. `git add . && git commit -m "WIP"` - Commit as work-in-progress
3. `git checkout -- .` - Discard all changes (⚠️ destructive)

Run the review command again after resolving.
```

---

## Phase 1: Git Setup and Synchronization

**Action:** Ensure both branches are up-to-date with remote.

### Step 1.1: Fetch All Remote Branches

```bash
git fetch --all --prune
```

### Step 1.2: Verify Feature Branch Exists

```bash
git branch -a | grep -E "(^|\s){FEATURE_BRANCH}$|remotes/origin/{FEATURE_BRANCH}$"
```

**If branch not found:**
- ❌ STOP
- Report: `Branch '{FEATURE_BRANCH}' not found locally or on remote`
- Suggest: `git fetch --all` or verify branch name

### Step 1.3: Verify Base Branch Exists

```bash
git branch -a | grep -E "(^|\s){BASE_BRANCH}$|remotes/origin/{BASE_BRANCH}$"
```

**If branch not found:**
- ❌ STOP
- Report: `Base branch '{BASE_BRANCH}' not found`

### Step 1.4: Update Base Branch

```bash
# Save current branch name
CURRENT_BRANCH=$(git branch --show-current)

# Update base branch (fetch + update local tracking)
git fetch origin {BASE_BRANCH}:{BASE_BRANCH} 2>/dev/null || git fetch origin {BASE_BRANCH}
```

### Step 1.5: Checkout Feature Branch

```bash
git checkout {FEATURE_BRANCH}
```

**If checkout fails:**
- Likely due to uncommitted changes (should have been caught in Phase 0)
- ❌ STOP and report the error

### Step 1.6: Pull Latest Changes

```bash
git pull origin {FEATURE_BRANCH} --ff-only
```

**If pull fails (diverged branches):**
- Report divergence to user
- Suggest: `git pull --rebase origin {FEATURE_BRANCH}` or merge

### Step 1.7: Confirm Setup Complete

```bash
echo "=== Review Setup Complete ==="
echo "Feature Branch: $(git branch --show-current)"
echo "Base Branch: {BASE_BRANCH}"
echo "Feature HEAD: $(git rev-parse --short HEAD)"
echo "Base HEAD: $(git rev-parse --short origin/{BASE_BRANCH})"
```

---

## Phase 2: Generate Diff Analysis

**Action:** Extract and categorize all changes between branches.

### Step 2.1: Get Merge Base

```bash
MERGE_BASE=$(git merge-base {FEATURE_BRANCH} origin/{BASE_BRANCH})
echo "Merge base: $MERGE_BASE"
```

### Step 2.2: Get Changed Files Summary

```bash
git diff --stat $MERGE_BASE..HEAD
```

### Step 2.3: Get List of Changed Files

```bash
git diff --name-status $MERGE_BASE..HEAD
```

**Categorize files:**
- `A` = Added (new files)
- `M` = Modified (changed files)
- `D` = Deleted (removed files)
- `R` = Renamed

### Step 2.4: Get Commit History

```bash
git log --oneline $MERGE_BASE..HEAD
```

### Step 2.5: Get Full Diff

```bash
# For each file, get the diff
git diff $MERGE_BASE..HEAD
```

**For large diffs:** Read file-by-file to manage context:

```bash
# Get diff for specific file
git diff $MERGE_BASE..HEAD -- path/to/file.ts
```

### Step 2.6: Large Diff Strategy (Token Optimization)

**When total changes exceed 500 lines:**

1. **Use `--stat` first** to get overview
2. **Review file-by-file** using: `git diff $MERGE_BASE..HEAD -- {file}`
3. **Prioritize by risk:**
   - Security-sensitive files first (`auth/`, `security/`)
   - Public API changes (`routes/`, `handlers/`, `api/`)
   - Core business logic (`services/`, `core/`)
   - Tests last (`tests/`, `*.test.*`)
4. **Read full file** for context, not just diff lines
5. **Group similar issues** - don't repeat same feedback

---

## Phase 3: Code Review Execution

**Action:** Apply the code-review skill to the diff.

### Step 3.1: Load Project Context (Optional but Recommended)

If `REPO_PATH` follows pattern `projects/<PROJECT>/<DOMAIN>/<REPO>`:

1. Check for: `devdocs/projects/<PROJECT>/OVERVIEW.md`
2. Check for: `devdocs/projects/<PROJECT>/<DOMAIN>/<REPO>/OVERVIEW.md`
3. Load if exists for architecture/conventions context

### Step 3.2: Execute Review Using Skill

**Follow the workflow in `devdocs/agent/skills/common/code-review/SKILL.md`:**

1. Use the **Review Workflow** checklist from the skill
2. Go through each **Review Category** (Security → Performance → Code Quality → etc.)
3. Check for **Common Patterns** in `patterns.md`
4. Apply **Severity Guidelines** from the skill

### Step 3.3: Context-Aware Review (Branch-Specific)

For each changed file in the diff:

1. **Read the full file** (not just diff lines) to understand context
2. **Check related files** that imports/exports to changed files
3. **Verify test files** exist for new code

---

## Phase 4: Review Output

**Action:** Generate structured review report.

### Step 4.1: Output Format

Use the **Feedback Format** from the skill, with this branch-specific header:

```markdown
## Code Review: {FEATURE_BRANCH}

**Repository:** {REPO_PATH}
**Feature Branch:** {FEATURE_BRANCH}
**Base Branch:** {BASE_BRANCH}
**Commits:** {N} commits
**Files Changed:** {N} files (+{additions} -{deletions})

### 📋 Change Summary

| Type | Count | Files |
|------|-------|-------|
| Added | N | `file1.ts`, `file2.ts` |
| Modified | N | `file3.ts` |
| Deleted | N | `old-file.ts` |

### 📝 Commit History

- `abc1234` feat: add user endpoint
- `def5678` fix: handle null case

---

[... Continue with Feedback Format from SKILL.md ...]
- 🔴 Critical (Must Fix)
- 🟡 Suggestions (Should Consider)
- 🟢 Nits (Optional)
- ✅ What's Good
- 📊 Review Summary with Recommendation
```

---

## Phase 5: Post-Review Actions

**Action:** Suggest next steps based on findings.

### Step 5.1: If Critical Issues Found

```markdown
### ⛔ Action Required

{N} critical issues must be addressed before merge.

**Suggested workflow:**
1. Fix issues on feature branch
2. Commit fixes: `git add . && git commit -m "fix: address code review feedback"`
3. Push: `git push origin {FEATURE_BRANCH}`
4. Re-run review: `review-branch {REPO_PATH} {FEATURE_BRANCH}`
```

### Step 5.2: If Suggestions Only

```markdown
### ✅ Ready for Merge (with suggestions)

No critical issues found. Consider addressing {N} suggestions before merge.

**To merge:**
```bash
git checkout {BASE_BRANCH}
git merge {FEATURE_BRANCH}
git push origin {BASE_BRANCH}
```
```

### Step 5.3: If Clean

```markdown
### ✅ Approved - Ready to Merge

Code review passed with no significant issues.

**To merge:**
```bash
git checkout {BASE_BRANCH}
git merge {FEATURE_BRANCH}
git push origin {BASE_BRANCH}
```
```

---

## Error Handling

### Git Errors

| Error | Action |
|-------|--------|
| `not a git repository` | Wrong path, ask user to verify |
| `pathspec did not match` | Branch doesn't exist, verify name |
| `Your local changes would be overwritten` | Uncommitted changes, run Phase 0 again |
| `CONFLICT` | Merge conflict, report and stop |
| `Permission denied` | Auth issue, ask user to check credentials |

### Recovery Commands

```bash
# Return to original branch
git checkout {ORIGINAL_BRANCH}

# Abort any merge in progress
git merge --abort

# Reset to clean state
git reset --hard HEAD

# Unstash changes (if stashed in Phase 0)
git stash pop
```

---

## Quick Reference

### Git Command Sequence

```bash
# Phase 0: Pre-flight
cd {REPO_PATH}
git status --porcelain  # Must be empty!

# Phase 1: Setup
git fetch --all --prune
git checkout {FEATURE_BRANCH}
git pull origin {FEATURE_BRANCH} --ff-only
git fetch origin {BASE_BRANCH}

# Phase 2: Diff
MERGE_BASE=$(git merge-base HEAD origin/{BASE_BRANCH})
git diff --stat $MERGE_BASE..HEAD
git diff --name-status $MERGE_BASE..HEAD
git diff $MERGE_BASE..HEAD

# Phase 3-4: Review
# → Follow: devdocs/agent/skills/common/code-review/SKILL.md
```

### Review Scope Options

| Scope | Description | Use When |
|-------|-------------|----------|
| `quick` | Changed files only, basic checks | Small PRs, quick sanity check |
| `full` | Full file context, all categories (default) | Standard review |
| `deep` | Include related files, test coverage analysis | Critical changes, security-sensitive |

---

## Checklist Before Starting

- [ ] User provided `REPO_PATH`
- [ ] User provided `FEATURE_BRANCH`
- [ ] Confirmed `BASE_BRANCH` (default: `develop`)
- [ ] Workspace is clean (no uncommitted changes)
- [ ] Network access to fetch remote branches

---

## Appendix A: Parsing User Input

### Common Input Patterns

| User Says | Extract |
|-----------|---------|
| "review `projects/tinybots/backend/eve` branch `feature/PROD-123`" | REPO_PATH=`projects/tinybots/backend/eve`, FEATURE_BRANCH=`feature/PROD-123` |
| "review code on `feature/PROD-123` in eve repo" | Ask for full REPO_PATH |
| "review `feature/PROD-123` against `main`" | Ask for REPO_PATH, BASE_BRANCH=`main` |
| "quick review `projects/foo/bar` `feat/x`" | REVIEW_SCOPE=`quick` |

### Ambiguous Input - ASK

If user input is ambiguous, ASK before proceeding:

```markdown
I need clarification to start the code review:

1. **Repository path:** What is the full path? (e.g., `projects/tinybots/backend/eve`)
2. **Feature branch:** Which branch to review?
3. **Base branch:** Compare against which branch? (default: `develop`)
```

### Extract Branch Name from PR URL

If user provides GitHub/GitLab PR URL:

```
https://github.com/org/repo/pull/123 → Use API or ask for branch name
https://bitbucket.org/org/repo/pull-requests/123 → Use API or ask
```

**Recommended:** Ask user for branch name directly to avoid API dependency.

---

## Appendix B: Sample User Prompts

### Minimal

```
Review branch `feature/PROD-437` in `projects/tinybots/backend/eve`
```

### Full

```
Review branch `feature/PROD-437-sensara-endpoints` in `projects/tinybots/backend/eve` against `main`, do a deep review
```

### With Context

```
Review the implementation on `feature/PROD-437` in `projects/tinybots/backend/eve`. 
Focus on the new REST endpoints and their security implications.
Compare against `develop` branch.
```
