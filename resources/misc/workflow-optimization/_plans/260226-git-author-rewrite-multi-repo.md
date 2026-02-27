# 260226 - Git Author Rewrite (Multi-Repo)

## References

- `AGENTS.md` - AI agent entry point
- `agent/rules/common/tasks/create-plan.md` - Plan creation rules

## User Requirements

Implement "process each repo separately" and rewrite Git author/committer metadata for all commits across two independent repositories:

1. **Repo A (origin)** - Primary remote with many branches
2. **Repo B** - Derived from Repo A `master`, currently using `master` and `develop`

## Objective

Provide a repeatable, low-risk workflow to rewrite author and committer metadata in both repositories, then force-push safely. The flow must preserve cross-repo sync compatibility by using the exact same rewrite filter and identity values in both repos.

## Key Constraints

- **Back up first** - Always keep untouched backup mirrors before rewriting history
- **Deterministic identity** - Use one hardcoded identity for both repos, not local `git config`
- **Mirror-safe ref coverage** - Rewrite and push all refs via mirror clone and mirror push (no branch omissions)
- **Execution order** - Rewrite Repo A first, then Repo B
- **Collaboration impact** - History rewrite requires collaborators to re-clone or hard-reset
- **Branch protection** - Temporarily relax protected branch/tag rules if required

## Fixed Identity (Must Be Identical in A and B)

```bash
AUTHOR_NAME="Dinh Khoi Le"
AUTHOR_EMAIL="DinhKhoi.Le@nab.com.au"
```

## Implementation Plan

### Phase 1: Preparation

- [ ] **Create immutable backups for both repositories**
  - **Command pattern**: `git clone --mirror <url> <repo>-backup.git`
  - **Outcome**: `repo-a-backup.git` and `repo-b-backup.git` are available for rollback
- [ ] **Verify remote targets before destructive actions**
  - **Command**: `git remote -v` (inside each rewrite repo)
  - **Outcome**: Confirm each local mirror points to the intended remote
- [ ] **Announce rewrite window to collaborators**
  - **Outcome**: Team prepared for force-push and local history reset

### Phase 2: Repo A (Origin) - Rewrite All Refs

- [ ] **Mirror clone Repo A**

  ```bash
  git clone --mirror git@github.com:vjcspy/aweave.git repo-a-rewrite.git
  cd repo-a-rewrite.git
  ```

- [ ] **Rewrite author and committer using fixed identity**

  ```bash
  AUTHOR_NAME="Dinh Khoi Le"
  AUTHOR_EMAIL="DinhKhoi.Le@nab.com.au"

  git filter-branch -f --env-filter '
  export GIT_AUTHOR_NAME="'"$AUTHOR_NAME"'"
  export GIT_AUTHOR_EMAIL="'"$AUTHOR_EMAIL"'"
  export GIT_COMMITTER_NAME="'"$AUTHOR_NAME"'"
  export GIT_COMMITTER_EMAIL="'"$AUTHOR_EMAIL"'"
  ' --tag-name-filter cat -- --all
  ```

- [ ] **Force-push all rewritten refs**

  ```bash
  git push --force --mirror origin
  ```

### Phase 3: Repo B - Rewrite All Existing Refs

Scope decision: rewrite all refs in Repo B for consistency and safety. At minimum this includes `master` and `develop`; tags and additional refs (if present) are also rewritten.

- [ ] **Mirror clone Repo B**

  ```bash
  git clone --mirror <url-repo-B> repo-b-rewrite.git
  cd repo-b-rewrite.git
  ```

- [ ] **Run the exact same rewrite filter and identity as Repo A**

  ```bash
  AUTHOR_NAME="Dinh Khoi Le"
  AUTHOR_EMAIL="DinhKhoi.Le@nab.com.au"

  git filter-branch -f --env-filter '
  export GIT_AUTHOR_NAME="'"$AUTHOR_NAME"'"
  export GIT_AUTHOR_EMAIL="'"$AUTHOR_EMAIL"'"
  export GIT_COMMITTER_NAME="'"$AUTHOR_NAME"'"
  export GIT_COMMITTER_EMAIL="'"$AUTHOR_EMAIL"'"
  ' --tag-name-filter cat -- --all
  ```

- [ ] **Force-push all rewritten refs**

  ```bash
  git push --force --mirror origin
  ```

### Phase 4: Verification

- [ ] **Verify only the target identity remains in each rewritten repo**

  ```bash
  git log --all --format='%an <%ae>%n%cn <%ce>' | sort -u
  ```

  - **Expected**: Only `Dinh Khoi Le <DinhKhoi.Le@nab.com.au>` appears

- [ ] **Verify shared branch SHAs between Repo A and Repo B**

  ```bash
  SHA_A_MASTER=$(git ls-remote git@github.com:vjcspy/aweave.git refs/heads/master | awk '{print $1}')
  SHA_B_MASTER=$(git ls-remote <url-repo-B> refs/heads/master | awk '{print $1}')
  [ "$SHA_A_MASTER" = "$SHA_B_MASTER" ] && echo "master SHA aligned" || echo "master SHA mismatch"
  ```

  - **Expected**: `master SHA aligned`

- [ ] **Verify sync path A -> B without duplicate history**
  - In a clean clone of Repo B, add Repo A as upstream and run:

  ```bash
  git remote add upstream-a git@github.com:vjcspy/aweave.git
  git fetch upstream-a
  git merge --ff-only upstream-a/master
  ```

  - **Expected**: Fast-forward or already up to date; no duplicate commits created

## Optional: Scripted Workflow

A shell script can automate phases 2-3 with explicit inputs:

- `REPO_A_URL`, `REPO_B_URL`
- `AUTHOR_NAME`, `AUTHOR_EMAIL` (fixed values shared by both repos)

Suggested flow: mirror clone -> filter-branch -> mirror push, with explicit confirmation before each `git push --force --mirror`.

## Tooling Note

`git filter-branch` is supported and works for this plan, but is slower on large repositories. If performance becomes an issue, migrate the same logic to `git filter-repo` while preserving the exact same author/committer mapping in both repos.

## Summary of Results

### Completed Achievements

- [To be filled after implementation]

## Outstanding Issues & Follow-up

### Issues/Clarifications

- [ ] None at plan update time
