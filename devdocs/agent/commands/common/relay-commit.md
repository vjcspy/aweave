# Relay Commit

## Objective

Push local commit(s) from this repository to GitHub via the git relay system.

## Input Variables

- `COMMIT_ID` (optional): The commit ID to push. Default: `HEAD` (latest commit).

## Execution

### Step 1: Resolve commit

```bash
COMMIT_ID="${COMMIT_ID:-HEAD}"
```

Verify the commit exists:

```bash
git rev-parse --verify $COMMIT_ID
```

If invalid, stop and inform the user.

### Step 2: Push via relay

Run this command from the repository root:

```bash
aw relay push --repo vjcspy/aweave --commit $COMMIT_ID --branch master --base master
```

### Step 3: Report result

- If `"status": "pushed"` → report the `commitUrl` to the user.
- If `"status": "failed"` → report the error from `details.error`.

## Examples

User says: "relay commit"

```bash
aw relay push --repo vjcspy/aweave --commit HEAD --branch master --base master
```

User says: "relay commit abc123"

```bash
aw relay push --repo vjcspy/aweave --commit abc123 --branch master --base master
```

User says: "relay commit last 3 commits"

```bash
aw relay push --repo vjcspy/aweave --commit HEAD --commits 3 --branch master --base master
```
