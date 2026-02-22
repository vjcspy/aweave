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

## Implementation Plan

### Phase 1: Analysis & Preparation

- [ ] Analyze the current transport encryption flow (`CLI encrypt -> Vercel forward -> server decrypt`) and document exact leakage/attack scenarios of the shared symmetric key model
  - **Outcome**: Clear threat model covering passive capture, replay, forged requests, and secret exposure impact.
- [ ] Define the target cryptography model and compatibility strategy
  - **Outcome**: Selected v2 scheme (hybrid envelope encryption using server public key + per-request AES-256-GCM content key), versioning strategy, and v1 fallback policy.
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
│   └── crypto.ts            # 🚧 Add versioned decrypt dispatcher (v1 shared-key + v2 hybrid envelope)
├── routes/
│   ├── data.ts              # 🚧 Optional: expose crypto metadata endpoint (or mount via dedicated route)
│   └── gr.ts                # ✅ No functional change expected (transport decrypt remains upstream)
└── server.ts                # 🚧 Wire v2 decrypt support + optional crypto metadata route

workspaces/k/misc/git-relay-vercel/src/
├── lib/
│   └── forward.ts           # 🚧 Ensure GET proxy supports crypto metadata fetch and preserves headers/query
└── app/api/game/
    ├── crypto-meta/
    │   └── route.ts         # 🚧 New proxy route for server public key metadata (if API bootstrap is chosen)
    └── (existing relay routes) # ✅ No payload decryption changes; continues opaque forwarding

workspaces/devtools/common/cli-plugin-relay/src/
├── lib/
│   ├── config.ts            # 🚧 Add server public key config fields + migration compatibility for legacy encryptionKey
│   ├── crypto.ts            # 🚧 Add v2 hybrid envelope encryptor (per-request content key) and keep v1 path during rollout
│   └── relay-client.ts      # 🚧 Add crypto metadata fetch and v2 gameData envelope transmission
├── commands/relay/
│   ├── push.ts              # 🚧 Use v2 encryption path by default (with controlled fallback)
│   ├── status.ts            # 🚧 Relax config validation if status does not require encryption key material
│   └── config/
│       ├── set.ts           # 🚧 Add flags for public-key config and legacy deprecation messaging
│       ├── show.ts          # 🚧 Display key mode, key id/fingerprint, and mask legacy secrets
│       ├── generate-key.ts  # 🚧 Deprecate/rename legacy symmetric key generation command
│       └── fetch-public-key.ts # 🚧 New command to bootstrap/pin server public key (if API bootstrap is chosen)
└── index.ts                 # 🚧 Register new config command(s)
```

### Phase 3: Detailed Implementation Steps

- [ ] Define a versioned transport crypto envelope (`v2`) that still fits inside `gameData`
  - **Outcome**: Binary envelope spec (version byte, key id, wrapped content key, IV, auth tag, ciphertext) documented and implemented.

- [ ] Implement hybrid envelope encryption on the CLI (public-key wrap + per-request AES-256-GCM payload encryption)
  - **Outcome**: Each request uses a fresh random content encryption key; only the server private key can unwrap/decrypt the payload.

- [ ] Implement versioned decryption on the server with legacy support
  - **Outcome**: Server can decrypt both current v1 shared-key payloads and new v2 envelope payloads during rollout.

- [ ] Add server key configuration and startup validation for asymmetric mode
  - **Outcome**: New env vars for server private key, key id, and rollout mode are validated at startup; legacy `ENCRYPTION_KEY` can be optional when v1 is disabled.

- [ ] Add public key metadata exposure path (if automatic bootstrap is adopted)
  - **Outcome**: CLI can fetch current public key metadata (`kid`, algorithm, PEM/public material, fingerprint, supported versions) via Vercel without exposing private material.

- [ ] Add CLI config migration path from `encryptionKey` (shared secret) to public-key-based config
  - **Outcome**: CLI supports new config fields, preserves existing config file compatibility, and provides clear deprecation messaging for legacy keys.

- [ ] Update CLI command UX for key management
  - **Outcome**: `aw relay config set/show` supports public-key mode, legacy `generate-key` is deprecated (or clearly marked legacy), and a bootstrap command is available if selected.

- [ ] Ensure relay/Vercel proxy behavior remains opaque and compatible
  - **Outcome**: Vercel continues forwarding `{"gameData":"..."}` without decrypting, and only gains optional key-metadata proxy routing.

- [ ] Add anti-replay and request-integrity hardening checks at the transport boundary
  - **Outcome**: Server validates envelope version, optional timestamp/nonce fields, and rejects malformed/duplicate payloads beyond current session constraints.

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

- [ ] Choose the asymmetric wrapper primitive for v2 (`RSA-OAEP` with built-in Node crypto vs `X25519`-based design). This impacts envelope size, implementation complexity, and future key rotation ergonomics.
- [ ] Decide public-key bootstrap mode: manual key pinning in CLI config only, or API fetch through Vercel plus fingerprint verification.
- [ ] Define rollout policy for legacy fallback (`v1`): allow automatic fallback temporarily, or require explicit opt-in to avoid silent downgrade behavior.
