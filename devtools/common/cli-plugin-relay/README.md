# CLI Plugin Relay

## Setup

```bash
aw relay config set --relay-url XXX
aw relay config set --api-key XXX
aw relay config set --encryption-key "eXYPtfy54J5+yjVdP4A9zeydLbpbGxZE8/9AewcgcHI="
```

Verify config:

```bash
aw relay config show
```

Config is stored at `~/.aweave/relay.json`.

## Usage

### Push commits

```bash
# Push the latest commit
aw relay push --repo owner/repo --commit HEAD --branch feature/my-branch

# Push a specific commit
aw relay push --repo owner/repo --commit abc123 --branch hotfix/typo

# Push last 3 commits
aw relay push --repo owner/repo --commit HEAD --commits 3

# Specify base branch (default: main)
aw relay push --repo owner/repo --commit HEAD --branch feature/x --base develop
```

### Check status

```bash
aw relay status <sessionId>
```

### Configuration commands

```bash
# Set individual values
aw relay config set --relay-url <url>
aw relay config set --api-key <key>
aw relay config set --encryption-key <key>
aw relay config set --chunk-size <bytes>
aw relay config set --base-branch <branch>

# Show current config (sensitive values masked)
aw relay config show

# Generate a new AES-256 encryption key
aw relay config generate-key
```

## Flags Reference

### `aw relay push`

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--repo` | Yes | — | GitHub repo (`owner/repo`) |
| `--commit` | Yes | — | Commit ID (`HEAD`, `abc123`, etc.) |
| `--branch` | No | current branch | Target branch to push |
| `--base` | No | `main` | Base branch on remote |
| `--commits` | No | `1` | Number of commits to include |
| `--chunk-size` | No | `3145728` (3MB) | Chunk size in bytes (max: 3400000) |
| `--format` | No | `json` | Output format (`json` or `markdown`) |
