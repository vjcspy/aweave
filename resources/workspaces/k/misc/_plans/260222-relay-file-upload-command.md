# [260222-relay-file-upload-command] - Relay File Upload Command (Chunked Upload to git-relay-server)

## References

- `resources/workspaces/k/misc/git-relay-vercel/OVERVIEW.md`
- `resources/workspaces/k/misc/git-relay-server/OVERVIEW.md`
- `workspaces/devtools/common/cli-plugin-relay/README.md`
- `workspaces/devtools/common/cli-plugin-relay/src/commands/relay/push.ts`
- `workspaces/devtools/common/cli-plugin-relay/src/commands/relay/status.ts`
- `workspaces/devtools/common/cli-plugin-relay/src/lib/relay-client.ts`
- `workspaces/devtools/common/cli-plugin-relay/src/lib/chunker.ts`
- `workspaces/devtools/common/cli-plugin-relay/src/lib/config.ts`
- `workspaces/k/misc/git-relay-server/src/routes/data.ts`
- `workspaces/k/misc/git-relay-server/src/routes/gr.ts`
- `workspaces/k/misc/git-relay-server/src/services/session-store.ts`
- `workspaces/k/misc/git-relay-server/src/lib/types.ts`
- `workspaces/k/misc/git-relay-vercel/src/lib/forward.ts`
- `workspaces/k/misc/git-relay-vercel/src/app/api/game/chunk/route.ts`
- `workspaces/k/misc/git-relay-vercel/src/app/api/game/chunk/complete/route.ts`
- `workspaces/k/misc/git-relay-vercel/src/app/api/game/chunk/status/[sessionId]/route.ts`
- `workspaces/k/misc/git-relay-vercel/src/app/api/game/gr/route.ts`

## User Requirements

- `read those file to understand context:
  resources/workspaces/k/misc/git-relay-vercel/OVERVIEW.md
  resources/workspaces/k/misc/git-relay-server/OVERVIEW.md
  workspaces/devtools/common/cli-plugin-relay/README.md`
- `bây giờ tôi muốn rely on this approach để trong cli-plugin-relay tạo thêm 1 command có nhiệm vụ là sử dụng các api sẵn có(cũng có thể cần tạo mới) để đẩy 1 file từ trong private network ra ngoài git-relay-server`
- `new cli command sẽ tự động chia nhỏ file ra các chunk để đẩy ra server`
- Clarifications:
  - `Sau khi upload xong, file cần được server làm gì? -> lưu thành file lâu dài ở server`
  - `File là 1 file đơn  -> nếu nhiều file tôi sẽ tự zip`
  - `Kích thước file tối đa kỳ vọng là bao nhiêu? -> file nhỏ dưới 100mb`
  - `Có cần integrity check bắt buộc không? -> sha256 toàn file`
  - `Có cần resumable upload không? -> không`
  - `“Ra ngoài git-relay-server” nghĩa là -> tới được git-relay-server`
  - `muốn dùng chung aw relay status, nhưng câu hỏi là có bị breaking change gì ở chức năng git relay không? nếu làm thay đổi gì ở git relay command thì không cần dùng chung`
- `tạo plan ở đây resources/workspaces/k/misc/_plans`

## Objective

Add a new `cli-plugin-relay` command to upload a single file (under 100 MB) from the private network to `git-relay-server` using the existing encrypted chunk transport pipeline, with automatic chunking, server-side long-term file storage, mandatory full-file SHA256 verification, and no resumable-upload requirement.

### Key Considerations

- Reuse the existing relay transport flow (`chunk -> complete -> status`) where possible to minimize risk and implementation time.
- Keep Git relay behavior (`aw relay push`) backward-compatible; file upload support must be additive and must not break bundle relay processing.
- `aw relay status` should support both Git sessions and file-upload sessions without forcing breaking changes to current Git workflows.
- Current transport status/poll logic in CLI is Git-specific (`pushed|failed`) and must be generalized via configurable terminal states so file sessions can use `stored|failed` without changing Git success semantics.
- `git-relay-server` session store is generic for chunk ingestion but currently patch-oriented in processing messages/state transitions.
- Server file storage must be durable (not `/tmp/relay-sessions`) and protect against path traversal via filename sanitization.
- Integrity verification must include full-file SHA256 and expected size validation before marking success.
- No resumable upload support is required, but per-request retry behavior should be preserved.
- File upload target is only `git-relay-server`; public download/retrieval APIs are out of scope for this plan.
- File upload must reuse the same encrypted transport path (`relay-client.ts` → `fetchWithRetry()` → `encryptPayload()`) as Git relay to preserve the current security model and Vercel opaque forwarding behavior.
- File success state is planned as additive terminal status `stored` with transition `receiving -> complete -> processing -> stored|failed`.
- Enforce a file size cap on both CLI and server (initial target: `100 MB`) to align with user expectation and avoid long-running uploads without resumable support.

## Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Confirm and lock the final CLI command naming and UX (recommended: `aw relay file push`)
  - **Outcome**: Stable command path (`aw relay file push`) with final flags (`--file`, `--name`, `--wait`, `--chunk-size`, `--format`).
- [x] Finalize the server-side file storage contract and lifecycle (based on preselected state model)
  - **Outcome**: API payload schema plus explicit transition chain `receiving -> complete -> processing -> stored|failed`, processing message text for file flow, and status details fields.
- [x] Finalize compatibility rules for shared status handling (`aw relay status`) across Git and file sessions
  - **Outcome**: `aw relay status` success criteria accept `pushed` and `stored`; `relay push` (Git) behavior remains unchanged.
- [x] Evaluate test coverage and identify required test levels (CLI unit, server route/service, E2E smoke)
  - **Outcome**: Test matrix covering chunk upload, checksum mismatch, invalid inputs, and successful store flow.

### Phase 2: Implementation Structure

```
resources/workspaces/k/misc/_plans/
└── 260222-relay-file-upload-command.md   # ✅ This plan

workspaces/devtools/common/cli-plugin-relay/src/
├── commands/relay/
│   ├── push.ts                 # ✅ Existing Git bundle relay command (must remain compatible)
│   ├── status.ts               # 🚧 Generalize success display for Git + file session terminal states
│   └── file/
│       └── push.ts             # 🚧 New command: upload single file with chunking + finalize + optional wait
├── lib/
│   ├── relay-client.ts         # 🚧 Add file finalize API client + configurable terminal-state polling
│   ├── chunker.ts              # ✅ Reuse existing chunking utility and size caps
│   ├── config.ts               # ✅ Reuse existing relay config (relayUrl/apiKey/transport keys/chunkSize)
│   └── file-upload.ts          # 🚧 New shared helper(s) for file metadata, SHA256, and upload orchestration (optional but recommended)
└── index.ts                    # ✅ oclif auto-discovers commands (no manual registration expected)

workspaces/k/misc/git-relay-vercel/src/
├── lib/
│   └── forward.ts                              # ✅ Reuse generic forwarding helper
└── app/api/game/
    ├── chunk/route.ts                          # ✅ Existing chunk upload forwarder (reuse)
    ├── chunk/complete/route.ts                 # ✅ Existing complete forwarder (reuse)
    ├── chunk/status/[sessionId]/route.ts       # ✅ Existing status forwarder (reuse)
    └── file/store/route.ts                     # 🚧 New forwarder: CLI `/api/game/file/store` -> Server `/api/file/store`

workspaces/k/misc/git-relay-server/src/
├── routes/
│   ├── data.ts                 # ✅ Existing generic chunk transport route (reuse)
│   ├── gr.ts                   # ✅ Existing Git relay process route (unchanged behavior)
│   └── file.ts                 # 🚧 New route for file finalize/store request (`/api/file/store`)
├── services/
│   ├── session-store.ts        # 🚧 Add additive status support/details helpers for file terminal state (`stored`) without breaking Git flow
│   └── file-store.ts           # 🚧 New service for reassemble + SHA256 verify + long-term file persistence
└── lib/
    ├── types.ts                # 🚧 Add file store request/response/status detail typings (additive)
    └── config.ts               # 🚧 Add file storage directory / limits configuration (if not already present)
```

#### Path Mapping (Explicit)

| Layer | Path | Purpose |
|------|------|---------|
| CLI -> Vercel | `POST /api/game/file/store` | Trigger file finalize/store after chunk upload complete |
| Vercel -> Server | `POST /api/file/store` | Forwarded authenticated finalize/store request |
| Server (route mount) | `/api/file` + `/store` | File finalize/store endpoint in new `routes/file.ts` |

#### File Session State Model (Explicit)

```
receiving -> complete -> processing -> stored | failed
```

- `processing` is retained for file flow because reassemble + SHA256 verification + durable write may take noticeable time.
- `SessionStore.startProcessing()` can be reused if generalized message text is provided (for example an optional message parameter) or supplemented by a file-specific wrapper method.

### Phase 3: Detailed Implementation Steps

- [x] Define and document the file finalize API contract (`POST /api/file/store`)
  - **Outcome**: Request fields include `sessionId`, `fileName`, `size`, `sha256` and response behavior (202 accepted + status polling compatible), with explicit path mapping `CLI /api/game/file/store` -> `Server /api/file/store`.

- [x] Add server configuration for long-term file storage
  - **Outcome**: Configurable storage root (for example `FILE_STORAGE_DIR`) with startup validation, `MAX_FILE_SIZE_BYTES` (default `104857600` = 100 MB), and sane defaults for local/dev.

- [x] Implement a server-side file storage service
  - **Outcome**: Service reassembles uploaded chunks, validates byte size, computes SHA256, compares with expected checksum, sanitizes filename, persists file to durable storage, and returns stored metadata.
  - **Outcome**: Storage strategy is explicit: `<FILE_STORAGE_DIR>/<YYYY>/<MM>/<DD>/<sessionId>-<sanitizedFileName>` (or equivalent deterministic layout) with no overwrite of an existing stored file path.

- [x] Add a new server file route (`/api/file/store`) and integrate with session lifecycle
  - **Outcome**: Route validates input, starts async processing for a completed session, updates status/messages/details, and marks terminal success as `stored`.
  - **Outcome**: File processing messages are file-specific (for example `Processing file`, `Stored file`) and do not regress Git relay messages.

- [x] Extend session status model additively for file-upload success
  - **Outcome**: `aw relay push` (Git) continues to end in `pushed`, while file uploads end in `stored`; shared status endpoint remains backward-compatible.
  - **Outcome**: Update all affected status unions/checks on both server and CLI sides (including `SessionStatus`, status response interfaces, and terminal-state reject lists such as `storeChunk()`).

- [x] Add a Vercel forward route for file finalize/store
  - **Outcome**: New route forwards authenticated requests from `POST /api/game/file/store` to `POST /api/file/store` using existing `forwardToServer()` helper.

- [x] Refactor CLI relay transport helpers for reuse
  - **Outcome**: Shared helpers cover chunk upload, complete signal, and polling with configurable terminal success states so both Git and file commands can reuse the same transport flow safely.
  - **Outcome**: `pollStatus()` accepts configurable terminal states (recommended API: `pollStatus(..., { successStates, failureStates })`) to prevent file sessions from timing out when status=`stored`.

- [x] Implement CLI file-upload command (recommended: `aw relay file push`)
  - **Outcome**: Command reads a local file, computes SHA256, enforces local max size (100 MB default/configurable), applies existing chunk-size rules, uploads encrypted chunks, signals completion, triggers server file-store finalize API, and returns MCP-style output including `sessionId`.

- [x] Add CLI wait/poll behavior for file sessions without breaking Git flow
  - **Outcome**: File command can optionally wait for `stored|failed`; Git command keeps current `pushed|failed` behavior (or uses generalized polling with default terminal states).

- [x] Update `aw relay status` for mixed session types
  - **Outcome**: Status command reports success for both Git (`pushed`) and file (`stored`) sessions while preserving existing output shape for current users.

- [x] Add validation and error handling for common file-upload failures
  - **Outcome**: Clear errors for missing file, oversized file (if limit configured), SHA256 mismatch, invalid filename, incomplete session, and duplicate/invalid state transitions.

- [ ] Add/refresh documentation
  - **Outcome**: `workspaces/devtools/common/cli-plugin-relay/README.md` includes file-upload setup/usage examples and notes on storage behavior/status values.

- [ ] Execute end-to-end smoke tests with representative file sizes (<100 MB)
  - **Outcome**: Verified CLI -> Vercel -> server flow for success and checksum mismatch failure paths.

## Summary of Results

### Completed Achievements

- Added `stored` as additive terminal state to `SessionStatus` union across server and CLI
- Created `FileStoreService` with SHA256 verification, size validation, filename sanitization, and date-partitioned durable storage
- Created `POST /api/file/store` server route with async processing pattern (matching `gr.ts`)
- Created Vercel forwarder at `POST /api/game/file/store` → `POST /api/file/store`
- Generalized `pollStatus()` with configurable terminal states for backward-compatible Git + file session support
- Implemented `aw relay file push` CLI command with full upload flow, SHA256 integrity, and optional wait/poll
- Updated `aw relay status` to recognize both `pushed` and `stored` as success states
- Added `fileStorageDir` and `maxFileSizeBytes` to server config with env var overrides
- All TypeScript compilations pass with zero errors

## Outstanding Issues & Follow-up

### Issues/Clarifications

- [x] Decide the exact terminal success status name for file uploads (`stored` recommended) and confirm whether any downstream tooling depends on the current `SessionStatus` union values.
- [ ] Define retention/backup policy for long-term stored files on `git-relay-server` (path layout, overwrite behavior, and cleanup ownership).
- [x] Decide whether file-processing helper should reuse `SessionStore.startProcessing()` with an optional message parameter or introduce a file-specific wrapper method to avoid patch-oriented wording.

## Implementation Notes / As Implemented

### Design Decisions

1. **`startProcessing()` optional message** — Chose the optional message parameter approach (default: `'Processing patch'`) over a file-specific wrapper, keeping the API surface minimal while allowing file flow to use `'Processing file'`.
2. **No separate `file-upload.ts` helper** — The plan suggested an optional `file-upload.ts` orchestration helper. SHA256 computation and upload orchestration are simple enough to inline directly in the command file, avoiding unnecessary abstraction.
3. **`pollStatus()` generalization** — Uses `PollOptions` interface with `successStates`/`failureStates` arrays and a `Set` for O(1) lookup. Defaults maintain backward compatibility with Git flow.
4. **File storage layout** — `<FILE_STORAGE_DIR>/<YYYY>/<MM>/<DD>/<sessionId>-<sanitizedFileName>` with overwrite prevention.

### Files Changed

| File | Change |
|------|--------|
| `workspaces/k/misc/git-relay-server/src/lib/types.ts` | Added `stored` to `SessionStatus`, `FileStoreRequest` interface, file details to `StatusResponse` |
| `workspaces/k/misc/git-relay-server/src/lib/config.ts` | Added `fileStorageDir`, `maxFileSizeBytes` to `AppConfig` |
| `workspaces/k/misc/git-relay-server/src/services/session-store.ts` | Added `stored` to storeChunk reject list, parameterized `startProcessing` message |
| `workspaces/k/misc/git-relay-server/src/services/file-store.ts` | **NEW** — `FileStoreService` with reassemble + SHA256 + sanitize + durable write |
| `workspaces/k/misc/git-relay-server/src/routes/file.ts` | **NEW** — `POST /api/file/store` route handler |
| `workspaces/k/misc/git-relay-server/src/server.ts` | Mounted `/api/file` route |
| `workspaces/k/misc/git-relay-vercel/src/app/api/game/file/store/route.ts` | **NEW** — Vercel forwarder |
| `workspaces/devtools/common/cli-plugin-relay/src/lib/relay-client.ts` | Added `triggerFileStore()`, generalized `pollStatus()`, added `stored` to `StatusResponse` |
| `workspaces/devtools/common/cli-plugin-relay/src/commands/relay/status.ts` | Updated success check for both `pushed` and `stored` |
| `workspaces/devtools/common/cli-plugin-relay/src/commands/relay/file/push.ts` | **NEW** — `aw relay file push` command |
