# Relay Commit

## Objective

Sync local commits up to `HEAD` to `vjcspy/aweave` on branch `master` via relay using Git Bundles.

## Workflow Rule

- This flow is for syncing commits from the local private network to the external remote.
- Agent must:
  1. Commit changes locally.
  2. Relay local `HEAD` up to `vjcspy/aweave:master`.
- Agent must **not** use regular `git push` for this flow.

## Input Variables

- No runtime input variables.
- This command is intentionally hard-coded for:
  - `REPO=vjcspy/aweave` (or omit to auto-detect from local origin)
  - `TARGET_BRANCH=master`

## Execution

### Step 1: Pre-flight checks

Run from repository root and verify required tools/config:

```bash
command -v aw >/dev/null
git rev-parse --is-inside-work-tree
aw relay config show
git rev-parse --verify HEAD
```

Required relay config fields must exist: `relayUrl`, `apiKey`, `serverKeyId`, `serverPublicKey`.
`aw relay config show` should indicate v2 transport is active (`effectiveTransportMode = v2`).
`HEAD` must be the local commit intended for relay sync.

### Step 2: Relay latest commits

```bash
aw relay push \
  --repo vjcspy/aweave \
  --branch master \
  --format json
```

### Step 3: Check result on success

- If response status is `"pushed"`:
  - Report `sessionId`, `commitSha`, `commitUrl`.
- If response status is `"failed"`:
  - Report `message` and `details.error` (if available).

## Implementation-Aligned Notes

- Do not manually construct relay HTTP payloads.
- Transport encryption (`gameData` envelope), chunk upload, complete signal, and GR trigger are handled internally by `aw relay push`.
- The CLI automatically performs an ancestry check (`git merge-base --is-ancestor`) and queries the remote SHA automatically.
- Polling endpoint is now under game transport flow; `aw relay status` already uses the correct API path.
- Session statuses can include: `receiving`, `complete`, `processing`, `pushed`, `failed`.
- Do not run `git push origin ...` as part of this command flow.

## Examples

User says: "relay commit"

```bash
aw relay push --repo vjcspy/aweave --branch master --format json
```

User says: "sync last commit via relay"

```bash
aw relay push --repo vjcspy/aweave --branch master --format json
```
