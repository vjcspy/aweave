# [260222-relay-transport-encryption-hardening] - Relay Transport Encryption Hardening (Hybrid Envelope Encryption)

## References

- `resources/workspaces/k/misc/_plans/260218-game-transport-encryption.md`
- `resources/workspaces/k/misc/_plans/260222-git-bundle-relay.md`
- `resources/workspaces/k/misc/git-relay-server/OVERVIEW.md`
- `resources/workspaces/k/misc/git-relay-vercel/OVERVIEW.md`
- `workspaces/k/misc/git-relay-server/src/lib/config.ts`
- `workspaces/k/misc/git-relay-server/src/server.ts`
- `workspaces/k/misc/git-relay-server/src/services/crypto.ts`
- `workspaces/k/misc/git-relay-vercel/src/lib/forward.ts`
- `workspaces/devtools/common/cli-plugin-relay/src/lib/config.ts`
- `workspaces/devtools/common/cli-plugin-relay/src/lib/crypto.ts`
- `workspaces/devtools/common/cli-plugin-relay/src/lib/relay-client.ts`
- `workspaces/devtools/common/cli-plugin-relay/src/commands/relay/config/set.ts`
- `workspaces/devtools/common/cli-plugin-relay/src/commands/relay/config/show.ts`
- `workspaces/devtools/common/cli-plugin-relay/src/commands/relay/config/generate-key.ts`

## User Requirements

- Create a plan under `resources/workspaces/k/misc/_plans` to improve the current relay encryption mechanism.
- Use `resources/workspaces/k/misc/_plans/260222-git-bundle-relay.md` as the reference baseline for the current implementation state.

## Objective

Improve relay transport encryption so that the private-network CLI no longer relies on a long-lived shared symmetric `ENCRYPTION_KEY` for request payload confidentiality, while preserving the current relay workflow (`CLI -> Vercel -> server`) and the opaque `{"gameData":"..."}` transport shape.

### Key Considerations

- Current transport encryption uses a pre-shared AES-256-GCM key (`ENCRYPTION_KEY`) shared by CLI and server; this is symmetric, not asymmetric.
- If the shared symmetric key is leaked, captured payloads can be decrypted and forged by anyone with the key.
- Vercel relay must remain stateless and blind to decrypted payloads.
- The private environment can only reach `*.vercel.app` over HTTPS, so key bootstrap/distribution must work through that constraint.
- The transport body shape should remain disguised (`{"gameData":"..."}`) to avoid exposing chunk metadata to proxies.
- The design must preserve Vercel body size safety (4.5 MB limit) and keep chunk sizing compatible with current bundle relay behavior.
- Backward-compatible rollout is required because CLI, Vercel, and server may be deployed at different times.
- Public-key distribution reduces risk of decryption if the distributed key leaks, but server private key compromise remains a critical event and requires rotation.
- Replay protection is a separate control from encryption integrity (AES-GCM auth tag is not anti-replay by itself); v2 must define a transport-level anti-replay mechanism.
- This phase targets request payload confidentiality/integrity for `CLI -> Vercel -> server`; API response encryption is out of scope unless a concrete sensitive-response requirement is identified.

## Implementation Plan

### Phase 1: Analysis & Preparation

- [ ] Analyze the current transport encryption flow (`CLI encrypt -> Vercel forward -> server decrypt`) and document exact leakage/attack scenarios of the shared symmetric key model
  - **Outcome**: Clear threat model covering passive capture, replay, forged requests, secret exposure impact, and trust bootstrap/MITM assumptions.
- [ ] Define the target cryptography model and compatibility strategy
  - **Outcome**: Selected v2 scheme (hybrid envelope encryption using `X25519` + per-request AES-256-GCM content key), versioning strategy, key distribution trust model (manual pinning), and v1 fallback policy.
- [ ] Recalculate transport envelope overhead and validate chunk-size safety under Vercel limits
  - **Outcome**: Updated max payload math and confirmed default/hard-cap chunk size settings.
- [ ] Evaluate existing test structure and define new crypto/interoperability test cases
  - **Outcome**: Unit + integration test matrix for v1/v2 compatibility, malformed payloads, tamper detection, and rollout scenarios.

### Phase 2: Implementation Structure

```
resources/workspaces/k/misc/_plans/
└── 260222-relay-transport-encryption-hardening.md   # ✅ This plan

workspaces/k/misc/git-relay-server/src/
├── lib/
│   └── config.ts            # 🚧 Add asymmetric key config + rollout flags (retain legacy v1 support during migration)
├── services/
│   └── crypto.ts            # 🚧 Add versioned decrypt dispatcher (v1 shared-key + v2 hybrid envelope + anti-replay metadata validation hooks)
├── routes/
│   ├── data.ts              # ✅ No transport-surface change expected (anti-replay enforced before route handler)
│   └── gr.ts                # ✅ No functional change expected (transport decrypt remains upstream)
└── server.ts                # 🚧 Wire v2 decrypt support + pre-route anti-replay checks in decrypt middleware

workspaces/k/misc/git-relay-vercel/src/
├── lib/
│   └── forward.ts           # ✅ Existing opaque forwarding model retained (no trust bootstrap via Vercel)
└── app/api/game/
    └── (existing relay routes) # ✅ No payload decryption changes; continues opaque forwarding (no `crypto-meta` bootstrap route in v2)

workspaces/devtools/common/cli-plugin-relay/src/
├── lib/
│   ├── config.ts            # 🚧 Add pinned server public key / fingerprint config fields + migration compatibility for legacy encryptionKey
│   ├── crypto.ts            # 🚧 Add v2 hybrid envelope encryptor (`X25519` + per-request content key) and keep v1 path during rollout
│   └── relay-client.ts      # 🚧 Send v2 gameData envelope (no dynamic key bootstrap through Vercel)
├── commands/relay/
│   ├── push.ts              # 🚧 Use v2 encryption path by default (with controlled fallback)
│   ├── status.ts            # 🚧 Relax config validation if status does not require encryption key material
│   └── config/
│       ├── set.ts           # 🚧 Add flags for pinned public-key/fingerprint config and legacy deprecation messaging
│       ├── show.ts          # 🚧 Display key mode, key id/fingerprint, and mask legacy secrets
│       ├── generate-key.ts  # 🚧 Deprecate/rename legacy symmetric key generation command
│       └── import-public-key.ts # 🚧 New command to import/pin server public key material (out-of-band)
└── index.ts                 # 🚧 Register new config command(s)
```

### Phase 3: Detailed Implementation Steps

- [x] Define a versioned transport crypto envelope (`v2`) that still fits inside `gameData`
  - **Outcome**: Binary envelope spec (version byte, `kid`, ephemeral public key, wrapped/derived content key material, IV, auth tag, ciphertext) documented and implemented with overhead math for Vercel limits.

- [x] Implement hybrid envelope encryption on the CLI (`X25519` + per-request AES-256-GCM payload encryption)
  - **Outcome**: Each request uses a fresh ephemeral key agreement + content encryption key; only the server private key can derive the decrypt key and read the payload.

- [x] Implement versioned decryption on the server with legacy support
  - **Outcome**: Server can decrypt both current v1 shared-key payloads and new v2 envelope payloads during rollout.

- [x] Add server key configuration and startup validation for asymmetric mode
  - **Outcome**: New env vars for server private key, key id, and rollout mode are validated at startup; legacy `ENCRYPTION_KEY` can be optional when v1 is disabled.

- [x] Add out-of-band public key provisioning and pinning flow for CLI
  - **Outcome**: CLI can import/pin server public key material and fingerprint manually (copy/paste or file import), without trusting key delivery via Vercel runtime.

- [x] Add CLI config migration path from `encryptionKey` (shared secret) to public-key-based config
  - **Outcome**: CLI supports new config fields, preserves existing config file compatibility, and provides clear deprecation messaging for legacy keys.

- [x] Update CLI command UX for key management
  - **Outcome**: `aw relay config set/show` supports pinned public-key mode, legacy `generate-key` is deprecated (or clearly marked legacy), and `import-public-key` supports safe local pinning UX.

- [ ] Ensure relay/Vercel proxy behavior remains opaque and compatible
  - **Outcome**: Vercel continues forwarding `{"gameData":"..."}` without decrypting, and gains no trust-sensitive key bootstrap responsibility.

- [x] Add anti-replay and request-integrity hardening checks at the transport boundary
  - **Outcome**: CLI embeds mandatory `timestamp` + `nonce` in encrypted metadata; server decrypt middleware validates TTL, caches short-lived nonces before route dispatch, and rejects malformed/duplicate payloads before application logic runs.

- [ ] Define v2 API response encryption scope explicitly (non-goal for this phase)
  - **Outcome**: Plan and implementation keep server responses as HTTPS plain JSON unless a future endpoint returns sensitive metadata requiring response-side encryption.

- [ ] Expand test coverage for cryptographic interoperability and rollout safety
  - **Outcome**: Tests cover v1 decrypt, v2 decrypt, tamper failures, wrong-key failures, unknown key id, malformed envelope parsing, and CLI/server version mismatch.

- [ ] Execute phased rollout and deprecation plan
  - **Outcome**: Deployment sequence documented and implemented:
    1. Server accepts v1 + v2.
    2. CLI defaults to v2 (fallback optional).
    3. Legacy v1 shared-key mode disabled.
    4. `ENCRYPTION_KEY` removed from active runtime configuration (after cutover confirmation).

## Summary of Results

### Completed Achievements

- [To be updated after implementation]

## Outstanding Issues & Follow-up

### Issues/Clarifications

- [ ] Define exact nonce-cache storage strategy for anti-replay in server middleware (in-memory TTL map vs filesystem-backed cache) and failure behavior on process restart.
- [ ] Define rollout policy for legacy fallback (`v1`): allow automatic fallback temporarily, or require explicit opt-in to avoid silent downgrade behavior.

## Implementation Notes / As Implemented

- Implemented v2 hybrid request transport encryption in CLI and server using `X25519` key agreement + per-request AES-256-GCM content encryption, while retaining legacy v1 AES-256-GCM support for rollout compatibility.
- `gameData` remains the only transport field (`{"gameData":"..."}`); Vercel relay forwarding remains opaque and unchanged.
- CLI now supports v2 pinned-key config fields in `~/.aweave/relay.json`: `transportMode` (`auto|v1|v2`), `serverKeyId`, `serverPublicKey`, and `serverPublicKeyFingerprint`. Existing `encryptionKey` remains supported for legacy v1.
- New CLI command added: `aw relay config import-public-key` (file or PEM input, optional fingerprint verification) to pin server public key material out-of-band.
- CLI `aw relay config set/show` now exposes transport mode / key id / fingerprint and marks `encryptionKey` usage as legacy. `aw relay config generate-key` is explicitly labeled legacy v1.
- `aw relay push` now encrypts with v2 by default when pinned public-key config is present (or when `transportMode=v2`); otherwise it uses legacy v1. No automatic downgrade retry is implemented.
- `aw relay status` validation was relaxed to require only `relayUrl` and `apiKey` (no transport key material required for status polling).
- Server config now supports rollout modes via `TRANSPORT_CRYPTO_MODE` (`v1`, `compat`, `v2`; default `compat`), plus v2 key env vars `TRANSPORT_KEY_ID` and `TRANSPORT_PRIVATE_KEY_PEM` (supports escaped `\\n` in env strings).
- Legacy `ENCRYPTION_KEY` is optional only when `TRANSPORT_CRYPTO_MODE=v2`; otherwise it is still required and validated at startup.
- Anti-replay checks are enforced in server decrypt middleware before route handlers: CLI embeds encrypted `timestamp`/`nonce`; server validates TTL/skew (`TRANSPORT_REPLAY_TTL_MS`, `TRANSPORT_CLOCK_SKEW_MS`) and rejects duplicate nonces using an in-memory TTL cache.
- Current nonce cache is process-local and in-memory (resets on process restart), matching the open issue still tracked above.
- Verified compilation after changes with `npm run build` in:
  - `workspaces/k/misc/git-relay-server`
  - `workspaces/devtools/common/cli-plugin-relay`
