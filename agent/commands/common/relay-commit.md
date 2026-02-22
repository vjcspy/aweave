# Relay Commit

## Objective

Sync exactly the latest local commit (`HEAD`) to `vjcspy/aweave` on branch `master` via relay, then drop that local commit if relay push succeeds.

## Workflow Rule

- This flow is for **local-commit-first sync**.
- Agent must:
  1. Commit changes locally.
  2. Relay that local `HEAD` commit to `vjcspy/aweave:master`.
  3. Drop local `HEAD` only when relay status is `pushed`.
- Agent must **not** use regular `git push` for this flow.

## Input Variables

- No runtime input variables.
- This command is intentionally hard-coded for:
  - `REPO=vjcspy/aweave`
  - `TARGET_BRANCH=master`
  - `BASE_BRANCH=master`
  - `COMMIT_ID=HEAD`
  - `COMMITS=1`

## Execution

### Step 1: Pre-flight checks

Run from repository root and verify required tools/config:

```bash
command -v aw >/dev/null
git rev-parse --is-inside-work-tree
aw relay config show
git rev-parse --verify HEAD
```

Required relay config fields must exist:
- Always: `relayUrl`, `apiKey`
- Transport (v2): `serverKeyId`, `serverPublicKey` (pinned public-key mode)
  `HEAD` must be the local commit intended for relay sync.

Recommended check before relay push:
- `aw relay config show` should report `effectiveTransportMode` = `v2`
- `serverKeyId` and `serverPublicKeyFingerprint` should be populated

### Step 2: Relay latest commit (hard-coded target)

```bash
aw relay push \
  --repo vjcspy/aweave \
  --commit HEAD \
  --commits 1 \
  --branch master \
  --base master \
  --format json
```

### Step 3: Check result and drop local commit on success

- If response status is `"pushed"`:
  - Report `sessionId`, `commitSha`, `commitUrl`.
  - Drop the local latest commit immediately:
    ```bash
    git reset --hard HEAD~1
    ```
- If response status is `"failed"`:
  - Do not drop commit.
  - Report `message` and `details.error` (if available).

## Implementation-Aligned Notes

- Do not manually construct relay HTTP payloads.
- Transport encryption (`gameData` envelope), chunk upload, complete signal, and GR trigger are handled internally by `aw relay push`.
- This command assumes v2 transport is configured (`serverKeyId` + `serverPublicKey` pinned in CLI config).
- Polling endpoint is now under game transport flow; `aw relay status` already uses the correct API path.
- Session statuses can include: `receiving`, `complete`, `processing`, `pushed`, `failed`.
- Do not run `git push origin ...` as part of this command flow.

## Examples

User says: "relay commit"

```bash
aw relay push --repo vjcspy/aweave --commit HEAD --commits 1 --branch master --base master --format json
# if pushed:
git reset --hard HEAD~1
```

User says: "sync last commit via relay"

```bash
aw relay push --repo vjcspy/aweave --commit HEAD --commits 1 --branch master --base master --format json
# if pushed:
git reset --hard HEAD~1
```

User says: "relay commit and drop local commit if success"

```bash
aw relay push --repo vjcspy/aweave --commit HEAD --commits 1 --branch master --base master --format json
# if pushed:
git reset --hard HEAD~1
```
