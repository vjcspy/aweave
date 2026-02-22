# CLI Plugin Relay (v2-only)

Relay flow:

`aw relay push` -> Vercel relay (`X-Relay-Key`) -> `git-relay-server` (`X-Server-Key`)

Transport encryption is **v2 only** (hybrid envelope encryption). The CLI does not support legacy v1 shared-key transport.

Config is stored at `~/.aweave/relay.json`.

## Required CLI Config (v2)

- `relayUrl`
  - Vercel relay base URL
- `apiKey`
  - Sent as `X-Relay-Key` to Vercel relay
- `serverKeyId`
  - Pinned server transport key id (`kid`)
- `serverPublicKey`
  - Pinned server public key PEM (SPKI PEM)

Optional:
- `serverPublicKeyFingerprint`
- `chunkSize` (max `3400000`)
- `defaultBaseBranch`

## Quick Setup

### 1. Set relay endpoint + relay API key

```bash
aw relay config set --relay-url <https://your-relay.vercel.app>
aw relay config set --api-key <relay-api-key>
```

### 2. Import/pin server public key

Get these from the server operator (trusted channel):
- `kid`
- server public key PEM
- optional fingerprint (`sha256:...`)

```bash
aw relay config import-public-key --key-id relay-v2-2026-02 --file ./relay-transport-v2-public.pem
```

With fingerprint verification:

```bash
aw relay config import-public-key \
  --key-id <kid> \
  --file ./relay-transport-v2-public.pem \
  --fingerprint 'sha256:<expected-fingerprint>'
```

### 3. Verify

```bash
aw relay config show
```

Check:
- `transportMode: "v2"`
- `serverKeyId` is set
- `serverPublicKeyFingerprint` is set

## Configuration Commands

```bash
# Common config
aw relay config set --relay-url <url>
aw relay config set --api-key <key>
aw relay config set --base-branch <branch>
aw relay config set --chunk-size <bytes>

# v2 transport key material (manual)
aw relay config set --server-key-id <kid>
aw relay config set --server-public-key '<PEM>'
aw relay config set --server-public-key-fingerprint 'sha256:<fp>'

# Recommended v2 pinning workflow
aw relay config import-public-key --key-id <kid> --file <public-key.pem>

# Show current config (sensitive values masked)
aw relay config show
```

## Usage

### Push commits

```bash
# Auto-detect repo from origin, push current branch to master base
aw relay push --branch master --format json

# Explicit repo / branch
aw relay push --repo owner/repo --branch feature/my-branch --format json
```

### Check status

`aw relay status` only requires `relayUrl` and `apiKey`.

```bash
aw relay status <sessionId>
```

## Troubleshooting

- `Missing relay config: serverKeyId, serverPublicKey`
  - Import/pin the server public key first (`aw relay config import-public-key ...`)
- `Unknown transport key id`
  - CLI pinned `serverKeyId` does not match server `TRANSPORT_KEY_ID`
- `Decryption failed` / integrity error
  - Wrong public key, malformed PEM, or server key rotation mismatch
- `401: UNAUTHORIZED`
  - Check `apiKey` (`X-Relay-Key`) for Vercel relay auth
