# CLI Plugin Relay

Relay transport flow:

`aw relay push` -> Vercel relay (`X-Relay-Key`) -> private `git-relay-server` (`X-Server-Key`)

The CLI stores relay configuration in `~/.aweave/relay.json`.

## Quick Setup (Recommended: v2 Transport)

### Step 1: Configure relay endpoint + relay API key

```bash
aw relay config set --relay-url <https://your-relay.vercel.app>
aw relay config set --api-key <relay-api-key>
```

### Step 2: Import/pin server public key (v2)

Get these from the server operator via a trusted channel:
- `kid` (server transport key id)
- server public key PEM
- optional fingerprint (`sha256:...`)

Import and pin:

```bash
aw relay config import-public-key --key-id <kid> --file ./relay-transport-v2-public.pem

# optional fingerprint verification
aw relay config import-public-key \
  --key-id <kid> \
  --file ./relay-transport-v2-public.pem \
  --fingerprint 'sha256:<expected-fingerprint>'
```

### Step 3: Verify config

```bash
aw relay config show
```

Look for:
- `effectiveTransportMode: "v2"`
- `serverKeyId` populated
- `serverPublicKeyFingerprint` populated

## Legacy Setup (v1, Shared Symmetric Key)

Legacy only. Prefer v2.

```bash
aw relay config set --relay-url <https://your-relay.vercel.app>
aw relay config set --api-key <relay-api-key>
aw relay config set --encryption-key '<base64-aes-256-key>'
```

Optional helper (legacy):

```bash
aw relay config generate-key
```

## CLI Config Keys (Stored in `~/.aweave/relay.json`)

### Required for all relay usage

- `relayUrl`
  - Vercel relay base URL
- `apiKey`
  - Sent as `X-Relay-Key` to Vercel relay

### Transport keys (v2 recommended)

- `transportMode`
  - `auto` (default behavior), `v1`, or `v2`
  - `auto` uses v2 when pinned public-key config exists, otherwise v1
- `serverKeyId`
  - Pinned server transport key id (`kid`) used by v2 envelopes
- `serverPublicKey`
  - Pinned server public key PEM (SPKI PEM)
- `serverPublicKeyFingerprint`
  - Local fingerprint record for verification/display (`sha256:...`)

### Legacy transport key (v1)

- `encryptionKey`
  - Legacy shared AES-256-GCM key (base64)
  - Deprecated in favor of v2 public-key transport

### Optional tuning

- `chunkSize`
  - Chunk size in bytes (max `3400000`)
- `defaultBaseBranch`
  - Default base branch for relay push (fallback when `--base` not set)

## Configuration Commands

```bash
# Set common values
aw relay config set --relay-url <url>
aw relay config set --api-key <key>
aw relay config set --base-branch <branch>
aw relay config set --chunk-size <bytes>

# Transport mode and keys
aw relay config set --transport-mode auto|v1|v2
aw relay config set --server-key-id <kid>
aw relay config set --server-public-key '<PEM>'
aw relay config set --server-public-key-fingerprint 'sha256:<fp>'

# Recommended v2 key pinning workflow
aw relay config import-public-key --key-id <kid> --file <public-key.pem>

# Legacy v1 (deprecated)
aw relay config set --encryption-key <base64-aes-256-key>
aw relay config generate-key

# Show current config (sensitive values masked)
aw relay config show
```

## Usage

### Push commits

```bash
# Push the latest commit
aw relay push --repo owner/repo --commit HEAD --branch feature/my-branch

# Push a specific commit
aw relay push --repo owner/repo --commit abc123 --branch hotfix/typo

# Push last 3 commits
aw relay push --repo owner/repo --commit HEAD --commits 3

# Specify base branch (default: main or config.defaultBaseBranch)
aw relay push --repo owner/repo --commit HEAD --branch feature/x --base develop
```

### Check status

`aw relay status` only needs `relayUrl` and `apiKey` (no transport key material required):

```bash
aw relay status <sessionId>
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

## Troubleshooting

- `Missing relay config: serverKeyId, serverPublicKey`
  - You are using v2 mode (or `auto` with partial v2 config) but have not pinned the server public key.
- `Unknown transport key id`
  - Your pinned `serverKeyId` does not match the server's current `TRANSPORT_KEY_ID`.
- `Decryption failed` / integrity error
  - Public key mismatch, corrupted PEM, or server/client key pair mismatch.
- `401: UNAUTHORIZED`
  - Check `apiKey` (`X-Relay-Key`) for Vercel relay auth.
