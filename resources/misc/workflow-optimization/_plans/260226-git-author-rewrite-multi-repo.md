# 260226 — Git Author Rewrite (Multi-Repo)

## References

- `AGENTS.md` — AI Agent entry point
- `agent/rules/common/tasks/create-plan.md` — Plan creation rules

## User Requirements

Implement "Cách 2: Xử lý từng repo riêng" — rewrite Git author/committer for all commits across two independent repositories:

1. **Repo A (origin)** — Primary remote with many branches
2. **Repo B** — Derived from Repo A's master; has `master` and `develop` branches

## Objective

Provide a repeatable, step-by-step workflow to change author and committer metadata for all commits in both repositories, then force-push to their respective remotes. The workflow must preserve sync compatibility between repos (identical filter ensures matching commit SHAs).

### Key Considerations

- **Backup first** — Clone both repos before any rewrite
- **Same filter** — Use identical `--env-filter` on both repos so resulting commit SHAs match; enables clean sync A → B afterward
- **Order matters** — Rewrite Repo A first (source), then Repo B
- **Collaboration impact** — Force push rewrites history; collaborators must re-clone or `git reset --hard`
- **Protected branches** — May require temporarily disabling branch protection on remotes

## Implementation Plan

### Phase 1: Preparation

- [ ] **Backup both repositories**
  - **Outcome**: Two backup clones (e.g. `repo-a-backup`, `repo-b-backup`) in a safe location
- [ ] **Capture current Git identity (local config → dùng thay thế toàn bộ author cũ)**
  - **Outcome**: `Dinh Khoi Le` / `DinhKhoi.Le@nab.com.au` — dùng làm author mới cho mọi commit

- [ ] **Verify remote URLs**
  - **Outcome**: Confirm Repo A and Repo B remote URLs before force push

### Phase 2: Repo A (Origin) — Rewrite All Branches

- [ ] Clone Repo A to a working directory

  ```bash
  git clone <url-repo-A> repo-a-rewrite
  cd repo-a-rewrite
  ```

- [ ] Run filter-branch with author/committer replacement

  ```bash
  git filter-branch -f --env-filter '
  export GIT_AUTHOR_NAME="Dinh Khoi Le"
  export GIT_AUTHOR_EMAIL="DinhKhoi.Le@nab.com.au"
  export GIT_COMMITTER_NAME="Dinh Khoi Le"
  export GIT_COMMITTER_EMAIL="DinhKhoi.Le@nab.com.au"
  ' --tag-name-filter cat -- --all
  ```

- [ ] Force push all branches and tags to Repo A remote

  ```bash
  git push --force --all origin
  git push --force --tags origin
  ```

### Phase 3: Repo B — Rewrite master and develop

- [ ] Clone Repo B to a working directory

  ```bash
  git clone <url-repo-B> repo-b-rewrite
  cd repo-b-rewrite
  ```

- [ ] Run the **same** filter-branch command (identical to Repo A)

  ```bash
  git filter-branch -f --env-filter '
  export GIT_AUTHOR_NAME="Dinh Khoi Le"
  export GIT_AUTHOR_EMAIL="DinhKhoi.Le@nab.com.au"
  export GIT_COMMITTER_NAME="Dinh Khoi Le"
  export GIT_COMMITTER_EMAIL="DinhKhoi.Le@nab.com.au"
  ' --tag-name-filter cat -- --all
  ```

- [ ] Force push all branches and tags to Repo B remote

  ```bash
  git push --force --all origin
  git push --force --tags origin
  ```

### Phase 4: Verification

- [ ] Verify author on sample commits in both repos

  ```bash
  git log --format="%H %an <%ae>" -n 5
  ```

- [ ] Test sync from Repo A to Repo B (e.g. `git pull` or `git fetch` + merge)
  - **Outcome**: No duplicate commits; Git recognizes shared history by SHA

## Optional: Scripted Workflow

A shell script can encapsulate Phases 2–3 with parameters:

- `REPO_A_URL`, `REPO_B_URL` — Clone URLs
- `AUTHOR_NAME`, `AUTHOR_EMAIL` — Override or use `git config user.*`

Script would: clone → filter-branch → force-push for each repo, with confirmation prompts before destructive steps.

## Summary of Results

### Completed Achievements

- [To be filled after implementation]

## Outstanding Issues & Follow-up

### Issues/Clarifications

- [ ] None at plan creation
