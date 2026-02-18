# 260218 - Game Transport Layer: Full Payload Encryption + API Restructuring

## References

- Original plan: `devdocs/projects/k/misc/plans/260208-git-patch-relay.md`
- Server source: `projects/k/misc/git-relay-server/`
- Vercel relay source: `projects/k/misc/git-relay-vercel/`
- CLI plugin source: `devtools/common/cli-plugin-relay/`

## User Requirements

- Encrypt toàn bộ body payload (không chỉ `data` field) → Zscaler không thể thấy chunking structure (sessionId, chunkIndex, totalChunks, repo, branch, etc.)
- Body payload disguise thành game data: `{"gameData": "ENCRYPTED_DATA"}`
- Đổi API path từ `/api/relay/...` → `/api/game/...` cho consistent với game disguise
- Homepage đã có Sudoku game → toàn bộ app trông như 1 game app
- Tách riêng 2 concerns:
  - **General Data Transport API** — API chuyên dùng để gửi data từ private network ra ngoài (chunk upload, complete, status)
  - **Git Relay (code: GR)** — Feature-specific API xử lý git patch (decrypt, apply, push)
- API paths dùng feature code thay vì tên gọi rõ ràng. Git relay dùng code `GR`

## 🎯 Objective

Refactor hệ thống relay để:
1. Mọi HTTP body đều encrypted → Zscaler/proxy chỉ thấy `{"gameData": "..."}` (looks like game traffic)
2. Tách general data transport layer khỏi git relay feature
3. API paths mang tính disguise (`/api/game/...`) thay vì `/api/relay/...`

### ⚠️ Key Considerations

1. **Transport Encryption replaces Patch Encryption**: Hiện tại encrypt patch ở application layer (encrypt-then-chunk). Với transport encryption, MỌI request body đều được encrypt. Patch-level encryption trở nên dư thừa → loại bỏ để đơn giản hóa. Data at rest trên server temp dir là plaintext (acceptable — server là private machine của user).

2. **IV handling transparent cho caller**: AES-256-GCM yêu cầu unique IV mỗi lần encrypt. IV (12 bytes) + authTag (16 bytes) được prepend vào ciphertext → caller chỉ cần gọi `encryptPayload(json, key)` → base64 string. Không cần quản lý IV riêng.

3. **Binary framing tránh double base64**: Thay vì đặt raw chunk data dưới dạng base64 trong JSON `data` field (gây double base64), dùng binary framing: `[4B metadataLen] [JSON metadata] [raw binary data]`. Toàn bộ binary frame được encrypt rồi base64 **1 lần duy nhất** (outer `gameData`). Chunk size giữ nguyên như thiết kế ban đầu:

   ```
   Vercel body limit:        4.5 MB (4,718,592 bytes)
   Outer JSON envelope:      ~16 bytes ({"gameData":""})
   Outer base64 decode:      ×3/4
   IV + authTag overhead:    28 bytes
   Binary frame header:      4 bytes (uint32BE metadataLen)
   JSON metadata:            ~80 bytes ({sessionId, chunkIndex, totalChunks})

   Max raw chunk = (4,718,576 × 3/4) - 28 - 4 - 80 ≈ 3,538,820 bytes ≈ 3.37 MB

   Default:  3 MB (3,145,728) — same as original design
   Hard cap:  3.4 MB (3,400,000) — same as original design
   ```

4. **Vercel relay remains blind**: Vercel không decrypt — chỉ forward `{"gameData": "..."}` as-is. Key distribution không đổi.

5. **Session state machine thêm `complete` state**: `receiving → complete → processing → pushed | failed`. State `complete` = data uploaded xong, chờ feature-specific processing.

---

## Architecture Overview

### Before (current)

```
CLI:     encrypt(patch) → chunk(encryptedBlob) → send {sessionId, chunkIndex, data: base64EncryptedChunk}
                                                       ^^^^^^^^^^^^^^^^^^^^^^^^
                                                       Metadata visible to Zscaler

Vercel:  /api/relay/chunk      → forward
Server:  reassemble encrypted chunks → decrypt(iv, authTag) → git am → push
```

### After (proposed)

```
CLI:     chunk(rawPatch) → for each: encryptPayload({sessionId, chunkIndex, totalChunks}, rawChunkBuffer)
                         → send {"gameData": "opaqueBase64Blob"}
                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^
                                  Zscaler sees: game data (single base64, no double encoding)

Vercel:  /api/game/chunk       → forward (blind)
Server:  decryptMiddleware → extract metadata + raw binary → store → complete → GR → git am → push
```

### New API Flow

```
1. CLI: POST /api/game/chunk         ×N   {"gameData": encrypt(metadata={sessionId,chunkIndex,totalChunks}, binary=rawChunk)}
2. CLI: POST /api/game/chunk/complete      {"gameData": encrypt(metadata={sessionId})}
3. CLI: POST /api/game/gr                  {"gameData": encrypt(metadata={sessionId,repo,branch,baseBranch})}
4. CLI: GET  /api/game/chunk/status/:id    (no body — sessionId as UUID in URL is acceptable)
```

### Encryption Flow (Binary Framing)

```
CLI                                              Server
┌──────────────────────────────┐                ┌─────────────────────────────────┐
│ encryptPayload(meta, binary):│                │ decryptPayload(base64str):      │
│                              │                │                                 │
│ 1. JSON.stringify(metadata)  │                │ 1. base64 decode                │
│ 2. Build binary frame:       │                │ 2. Extract iv (12B)             │
│    [4B len][JSON meta][data] │                │ 3. Extract authTag (16B)        │
│ 3. randomBytes(12) → iv     │  {"gameData":…} │ 4. AES-256-GCM decrypt          │
│ 4. AES-256-GCM encrypt      │ ──────────────>│ 5. Parse binary frame:          │
│ 5. Get authTag (16B)        │ (via Vercel)    │    read 4B len → JSON metadata  │
│ 6. Concat: iv+tag+cipher    │                │    remaining bytes → raw data   │
│ 7. base64 encode (1× only)  │                │ 6. Return {metadata, data?}     │
│ 8. Return string            │                │                                 │
└──────────────────────────────┘                └─────────────────────────────────┘

Binary frame format:  [uint32BE metadataLen] [JSON metadata bytes] [raw binary data (optional)]
Single base64 encoding — no double base64 overhead.

Pre-shared key: same AES-256 key on both CLI config and server .env
Vercel relay: forwards {"gameData":"..."} as-is, CANNOT decrypt
```

---

## Design Decisions

### Decision 1: Remove Patch-Level Encryption (single encryption layer)

| Approach | Pro | Con |
|----------|-----|-----|
| **Transport-only** (chosen) | Simple, single key usage per request, no iv/authTag management in complete payload | Data at rest (temp chunks) is plaintext |
| Transport + Patch (double) | Defense in depth | Double encrypt = complexity overhead, redundant if same key |

Lý do chọn transport-only: cùng 1 pre-shared key, double encrypt không thêm security value. Server là private machine → plaintext temp files acceptable.

### Decision 2: IV prepended to ciphertext (self-contained blob)

Mỗi encrypted blob chứa đủ info để decrypt: `base64(iv[12] + authTag[16] + ciphertext)`.

Caller chỉ cần:
- `encryptPayload(obj, key)` → string
- `decryptPayload(str, key)` → object

IV generated randomly per request (required for GCM security) nhưng transparent cho user.

### Decision 3: Separate Data Transport from Git Relay

| Concern | API Path (Vercel) | Server Route | Responsibility |
|---------|-------------------|--------------|----------------|
| Data Transport | `/api/game/chunk/*` | `/api/data/*` | Upload chunks, mark complete, check status |
| Git Relay (GR) | `/api/game/gr` | `/api/gr/process` | Process completed session → git am → push |

Data transport là generic — có thể reuse cho các feature khác trong tương lai (không chỉ git relay).

### Decision 4: Binary Framing (avoid double base64)

| Approach | Chunk data encoding | base64 count | Max raw chunk | Complexity |
|----------|-------------------|--------------|---------------|------------|
| JSON + base64 data field | base64 in JSON | 2× (inner + outer) | ~2.53 MB | Simple |
| **Binary framing** (chosen) | raw bytes after metadata | 1× (outer only) | ~3.37 MB | Slightly more code |

Binary frame: `[4B metadataLen] [JSON metadata] [raw binary data]`. Toàn bộ frame encrypt → base64 1 lần duy nhất. Chunk size giữ nguyên design ban đầu (3 MB default, 3.4 MB hard cap). Không cần giảm chunk size.

### Decision 5: Chunk Size Unchanged

| Config | Value | Reason |
|--------|-------|--------|
| Default chunk size | 3 MB (3,145,728) | Binary framing avoids double base64 → same as original |
| Hard cap | 3.4 MB (3,400,000) | Same as original |
| Min chunk size | 64 KB | Same as original |

---

## 🔄 Implementation Plan

### Phase 1: Analysis

- [x] Analyze current payload structure and encryption flow
- [x] Calculate chunk size limits (binary framing → no reduction needed)
- [x] Design API path restructuring
- [x] Design session state machine update

### Phase 2: Implementation Structure

**Changes to CLI Plugin (`devtools/common/cli-plugin-relay/`):**

```
devtools/common/cli-plugin-relay/src/
├── lib/
│   ├── crypto.ts          # 🔄 Replace encrypt() with encryptPayload()/decryptPayload()
│   ├── chunker.ts         # ✅ No change (binary framing preserves original chunk sizes)
│   ├── relay-client.ts    # 🔄 Wrap bodies with gameData, update URLs, add triggerGR()
│   └── config.ts          # ✅ No change
├── commands/relay/
│   ├── push.ts            # 🔄 Remove patch-level encryption, add GR trigger step
│   ├── status.ts          # 🔄 Update URL path
│   └── config/            # ✅ No change
└── index.ts               # ✅ No change
```

**Changes to Vercel Relay (`projects/k/misc/git-relay-vercel/`):**

```
projects/k/misc/git-relay-vercel/src/
├── lib/
│   └── forward.ts         # 🔄 Update server path mappings
└── app/
    ├── api/
    │   ├── relay/          # ❌ DELETE entire directory
    │   └── game/           # 🚧 NEW
    │       ├── chunk/
    │       │   ├── route.ts              # 🚧 POST → forward to /api/data/chunk
    │       │   ├── complete/
    │       │   │   └── route.ts          # 🚧 POST → forward to /api/data/complete
    │       │   └── status/
    │       │       └── [sessionId]/
    │       │           └── route.ts      # 🚧 GET → forward to /api/data/status/:id
    │       └── gr/
    │           └── route.ts              # 🚧 POST → forward to /api/gr/process
    ├── layout.tsx          # ✅ No change
    └── page.tsx            # ✅ No change (Sudoku game)
```

**Changes to Server (`projects/k/misc/git-relay-server/`):**

```
projects/k/misc/git-relay-server/src/
├── server.ts              # 🔄 Add decrypt middleware, update route mounting
├── services/
│   ├── crypto.ts          # 🔄 Add decryptPayload(), keep decrypt() for reference
│   ├── session-store.ts   # 🔄 Add 'complete' status support
│   ├── repo-manager.ts    # ✅ No change
│   └── git.ts             # ✅ No change
├── routes/
│   ├── health.ts          # ✅ No change
│   ├── patches.ts         # ❌ DELETE (split into data.ts + gr.ts)
│   ├── data.ts            # 🚧 NEW — General data transport (chunk, complete, status)
│   └── gr.ts              # 🚧 NEW — Git Relay processing
├── lib/
│   ├── config.ts          # ✅ No change
│   ├── types.ts           # 🔄 Update interfaces
│   └── errors.ts          # ✅ No change (may add new error types)
└── index.ts               # ✅ No change
```

### Phase 3: Detailed Implementation Steps

#### Step 1: Transport Encryption Functions (Binary Framing)

**CLI — `devtools/common/cli-plugin-relay/src/lib/crypto.ts`**

- [ ] Replace `encrypt(data, keyBase64)` → `EncryptResult` with `encryptPayload(metadata, keyBase64, binaryData?)` → `string`

```typescript
/**
 * Encrypt metadata + optional binary data into a self-contained base64 blob.
 * Binary frame format: [4B metadataLen (uint32BE)] [JSON metadata] [raw binary data]
 * Encrypted blob: [12B iv] [16B authTag] [ciphertext]
 * Returns: base64(iv + authTag + ciphertext)
 */
export function encryptPayload(
  metadata: object,
  keyBase64: string,
  binaryData?: Buffer,
): string {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error(`Invalid encryption key length: expected 32 bytes, got ${key.length}`);
  }

  const metaBytes = Buffer.from(JSON.stringify(metadata), 'utf-8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(metaBytes.length);

  const plaintext = binaryData
    ? Buffer.concat([lenBuf, metaBytes, binaryData])
    : Buffer.concat([lenBuf, metaBytes]);

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}
```

**Server — `projects/k/misc/git-relay-server/src/services/crypto.ts`**

- [ ] Add `decryptPayload(gameData, key)` → `{ metadata, data? }`

```typescript
interface DecryptedPayload {
  metadata: unknown;
  data?: Buffer;  // raw binary data (present for chunk uploads)
}

/**
 * Decrypt a gameData base64 blob and parse the binary frame.
 * Extracts JSON metadata and optional raw binary data.
 */
export function decryptPayload(gameData: string, key: Buffer): DecryptedPayload {
  const blob = Buffer.from(gameData, 'base64');
  const iv = blob.subarray(0, 12);
  const authTag = blob.subarray(12, 28);
  const ciphertext = blob.subarray(28);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  const metaLen = plaintext.readUInt32BE(0);
  const metadata = JSON.parse(plaintext.subarray(4, 4 + metaLen).toString('utf-8'));
  const remaining = plaintext.subarray(4 + metaLen);
  const data = remaining.length > 0 ? remaining : undefined;

  return { metadata, data };
}
```

#### Step 2: Server Decrypt Middleware

**`projects/k/misc/git-relay-server/src/server.ts`**

- [ ] Add decrypt middleware **after auth middleware** (auth rejects unauthenticated requests first, then decrypt runs on verified requests only)
- [ ] Middleware: if `req.body.gameData` exists → decrypt → set `req.body` (metadata) + `req.binaryData` (raw data)
- [ ] Skip for GET requests (no body)
- [ ] Extend Express `Request` type to include `binaryData?: Buffer`

```typescript
// Auth middleware FIRST — rejects unauthenticated callers before any decrypt work
app.use('/api', (req: Request, _res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-server-key'] as string | undefined;
  if (apiKey !== config.apiKey) {
    throw new UnauthorizedError();
  }
  next();
});

// Decrypt middleware AFTER auth — only authenticated requests reach here
app.use('/api', (req: Request, _res: Response, next: NextFunction) => {
  if (req.method !== 'GET' && req.body?.gameData) {
    try {
      const { metadata, data } = decryptPayload(req.body.gameData, config.encryptionKey);
      req.body = metadata;           // JSON metadata → req.body (as before)
      (req as any).binaryData = data; // Raw binary data → req.binaryData (chunk uploads only)
    } catch (err) {
      throw new DecryptionError('Failed to decrypt request payload');
    }
  }
  next();
});
```

#### Step 3: Server Route Separation

**`projects/k/misc/git-relay-server/src/routes/data.ts`** (NEW — from patches.ts)

- [ ] Create `createDataRouter(config, sessionStore)` → Router
- [ ] `POST /chunk` — store chunk: metadata from `req.body` ({sessionId, chunkIndex, totalChunks}), raw data from `req.binaryData`
- [ ] `POST /complete` — validate all chunks received, set status → `'complete'`
  - Payload chỉ còn `{sessionId}` (không còn repo, branch, iv, authTag)
- [ ] `GET /status/:sessionId` — return session status (same logic)

**`projects/k/misc/git-relay-server/src/routes/gr.ts`** (NEW)

- [ ] Create `createGRRouter(config, sessionStore, repoManager)` → Router
- [ ] `POST /process` — Git Relay processing trigger
  - Validate: `{sessionId, repo, branch, baseBranch}`
  - Validate session status === `'complete'`
  - Set status → `'processing'`, return 202
  - Async: reassemble raw chunks → `git am` → `git push` → status `'pushed'`

**`projects/k/misc/git-relay-server/src/server.ts`**

- [ ] Update route mounting:
  ```typescript
  app.use('/api/data', createDataRouter(config, sessionStore));
  app.use('/api/gr', createGRRouter(config, sessionStore, repoManager));
  ```
- [ ] Delete import of `createPatchesRouter`

**`projects/k/misc/git-relay-server/src/routes/patches.ts`**

- [ ] DELETE file (replaced by data.ts + gr.ts)

#### Step 4: Server Types Update

**`projects/k/misc/git-relay-server/src/lib/types.ts`**

- [ ] Add `'complete'` to `SessionStatus`: `'receiving' | 'complete' | 'processing' | 'pushed' | 'failed'`
- [ ] **State guard acceptance criteria:**
  - Server rejects `POST /chunk` when session status is `complete|processing|pushed|failed` (add `complete` to existing `storeChunk` guard)
  - Server rejects `POST /complete` when session status is not `receiving`
  - Server rejects `POST /gr/process` when session status is not `complete`
  - `complete → processing` transition validated and idempotent (re-trigger returns same 202)
  - All status type definitions and handlers across CLI/server include `complete`
- [ ] Simplify `CompleteRequest` → `{ sessionId: string }` (remove repo, branch, iv, authTag)
- [ ] Add `GRProcessRequest` interface:
  ```typescript
  interface GRProcessRequest {
    sessionId: string;
    repo: string;       // "owner/repo"
    branch: string;
    baseBranch: string;
  }
  ```
- [ ] Remove `iv` and `authTag` fields from all interfaces (no longer needed)
- [ ] Update `ChunkRequest`: remove `data: string` field (raw data comes from `req.binaryData` via binary framing, not from JSON body)

#### Step 5: Vercel Route Restructuring

**Delete old routes:**

- [ ] Delete `projects/k/misc/git-relay-vercel/src/app/api/relay/` directory

**Create new routes:**

- [ ] `src/app/api/game/chunk/route.ts` — POST → forward to `/api/data/chunk`
- [ ] `src/app/api/game/chunk/complete/route.ts` — POST → forward to `/api/data/complete`
- [ ] `src/app/api/game/chunk/status/[sessionId]/route.ts` — GET → forward to `/api/data/status/:id`
- [ ] `src/app/api/game/gr/route.ts` — POST → forward to `/api/gr/process`

**Update `src/lib/forward.ts`:**

- [ ] Update path mappings (no logic changes — relay still forwards as-is)

#### Step 6: CLI Client Updates

**`devtools/common/cli-plugin-relay/src/lib/relay-client.ts`**

- [ ] Import `encryptPayload` from `./crypto`
- [ ] Update `fetchWithRetry` to accept `encryptionKey` param and wrap body: `{"gameData": encryptPayload(metadata, encryptionKey, binaryData?)}`
  - Requires passing `encryptionKey` to all client functions
- [ ] Update URL paths: `/api/relay/*` → `/api/game/*`
  - `uploadChunk`: `/api/game/chunk`
  - `signalComplete`: `/api/game/chunk/complete`
  - `pollStatus`: `/api/game/chunk/status/:id`
- [ ] Add `triggerGR(relayUrl, apiKey, encryptionKey, payload)` function
  - POST to `/api/game/gr`
  - payload: `{sessionId, repo, branch, baseBranch}`
- [ ] Update `CompletePayload` → `{sessionId}` only (remove iv, authTag, repo, branch, baseBranch)
- [ ] Add `GRPayload` interface: `{sessionId, repo, branch, baseBranch}`
- [ ] Update `uploadChunk` signature: accept raw `Buffer` chunk data (not base64 string), pass as `binaryData` to `encryptPayload`
- [ ] Update `ChunkUploadPayload`: remove `data: string` field (raw data passed separately as binary)

**`devtools/common/cli-plugin-relay/src/lib/chunker.ts`**

- [ ] No changes needed — chunk size defaults stay the same (3 MB default, 3.4 MB hard cap)

**`devtools/common/cli-plugin-relay/src/commands/relay/push.ts`**

- [ ] Remove step 5 (patch-level encryption): no more `encrypt(patch, key)` → `{encrypted, iv, authTag}`
- [ ] Update step 6 (chunk): split raw `patch` buffer directly (not `encrypted` buffer)
- [ ] Update step 7 (upload): pass `chunks[i]` as raw Buffer (not base64), relay-client handles binary framing
- [ ] Update step 8 (complete): payload = `{sessionId}` only
- [ ] Add step 8.5 (trigger GR): call `triggerGR()` with `{sessionId, repo, branch, baseBranch}`

**`devtools/common/cli-plugin-relay/src/commands/relay/status.ts`**

- [ ] Update URL path: `/api/relay/status/` → `/api/game/chunk/status/`

#### Step 7: Session Store Update

**`projects/k/misc/git-relay-server/src/services/session-store.ts`**

- [ ] Support `'complete'` status in status transitions
- [ ] Update `storeChunk` guard: add `'complete'` to rejected statuses (`processing|pushed|failed` → `complete|processing|pushed|failed`)
- [ ] Add method or update `setStatus` to transition `receiving` → `complete` (reject if not `receiving`)
- [ ] GR route transitions `complete` → `processing` → `pushed`/`failed` (reject if not `complete`)
- [ ] Make `complete → processing` idempotent: if already `processing`, return same 202 response

---

## Rollout Sequence

> Single-user private relay — coordinated cutover (no multi-user backward compatibility needed).

### Deploy Order

```
Step 1: Deploy Server (git-relay-server)
        - New routes (/api/data/*, /api/gr/*) live
        - Old routes (/api/patches/*) still present (not yet deleted)
        - Decrypt middleware active on new routes
        → Server accepts both old and new traffic

Step 2: Deploy Vercel Relay (git-relay-vercel)
        - New /api/game/* routes → forward to new server routes
        - Old /api/relay/* routes still present (safety net)
        → Vercel can forward both old and new traffic

Step 3: Deploy CLI (cli-plugin-relay)
        - CLI now sends encrypted payloads to /api/game/*
        → All traffic flows through new paths

Step 4: Cleanup (follow-up, after confirming new flow works)
        - Delete old /api/relay/* routes from Vercel
        - Delete old /api/patches/* routes + patches.ts from Server
```

### Rollback Criteria

- If Step 3 (CLI) fails: revert CLI, old paths still work via Steps 1-2
- If Step 2 (Vercel) fails: revert Vercel, CLI hasn't changed yet
- If Step 1 (Server) fails: revert Server, nothing else changed

### Validation Between Steps

- After Step 1: `curl <server>/health` confirms new server running
- After Step 2: Verify Vercel routes forward correctly (test with `curl`)
- After Step 3: Run `aw relay push` end-to-end to confirm full flow

---

## Session State Machine (Updated)

```
                 chunk upload
  (new) ────────────────────► RECEIVING
                                  │
                           POST /data/complete
                                  │
                                  ▼
                              COMPLETE
                                  │
                           POST /gr/process
                                  │
                    ┌─────────────▼──────────────┐
                    │        PROCESSING           │
                    │  (reassemble raw chunks,    │
                    │   git am, git push)         │
                    └──────┬──────────────┬───────┘
                           │              │
                      success          failure
                           │              │
                           ▼              ▼
                        PUSHED         FAILED
                     (terminal)      (terminal)
```

| State | Description | Terminal? |
|-------|-------------|-----------|
| `receiving` | Chunks being uploaded | No |
| `complete` | All chunks uploaded, waiting for feature trigger | No |
| `processing` | Feature processing in progress (git am, push) | No |
| `pushed` | Successfully pushed to GitHub | Yes |
| `failed` | Error occurred | Yes |

---

## What Zscaler Sees (Before vs After)

### Before

```http
POST /api/relay/chunk HTTP/1.1
Content-Type: application/json
X-Relay-Key: abc123

{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "chunkIndex": 0,
  "totalChunks": 3,
  "data": "SGVsbG8gV29ybGQ..."
}
```
→ Zscaler thấy: chunked file transfer system, sessionId, chunk index, total chunks

### After

```http
POST /api/game/chunk HTTP/1.1
Content-Type: application/json
X-Relay-Key: abc123

{
  "gameData": "7f3a9b2c1e4d8f5a6b0c3d2e1f4a5b6c..."
}
```
→ Zscaler thấy: game app sending game state data. Nội dung body là 1 opaque base64 blob.

---

## Files Changed Summary

| Component | File | Action | Description |
|-----------|------|--------|-------------|
| CLI | `src/lib/crypto.ts` | MODIFY | Replace `encrypt()` with `encryptPayload()` |
| CLI | `src/lib/relay-client.ts` | MODIFY | Wrap bodies, update URLs, add `triggerGR()` |
| CLI | `src/commands/relay/push.ts` | MODIFY | Remove patch encrypt, add GR trigger step |
| CLI | `src/commands/relay/status.ts` | MODIFY | Update URL path |
| Vercel | `src/app/api/relay/` | DELETE | Remove old routes |
| Vercel | `src/app/api/game/chunk/route.ts` | CREATE | Forward chunk uploads |
| Vercel | `src/app/api/game/chunk/complete/route.ts` | CREATE | Forward complete signal |
| Vercel | `src/app/api/game/chunk/status/[sessionId]/route.ts` | CREATE | Forward status check |
| Vercel | `src/app/api/game/gr/route.ts` | CREATE | Forward GR trigger |
| Vercel | `src/lib/forward.ts` | MODIFY | Update server path mappings |
| Server | `src/services/crypto.ts` | MODIFY | Add `decryptPayload()` |
| Server | `src/server.ts` | MODIFY | Add decrypt middleware, update route mounting |
| Server | `src/routes/patches.ts` | DELETE | Split into data.ts + gr.ts |
| Server | `src/routes/data.ts` | CREATE | General data transport routes |
| Server | `src/routes/gr.ts` | CREATE | Git Relay processing route |
| Server | `src/lib/types.ts` | MODIFY | Add `complete` status, add `GRProcessRequest` |
| Server | `src/services/session-store.ts` | MODIFY | Support `complete` state |

**Total: 9 modified, 5 created, 3 deleted = 17 file operations**

---

## Estimation

| Step | Description | Effort |
|------|-------------|--------|
| Step 1 | Transport encryption functions (CLI + Server) | 0.5 session |
| Step 2 | Server decrypt middleware | 0.25 session |
| Step 3 | Server route separation (data.ts + gr.ts) | 0.5 session |
| Step 4 | Server types update | 0.25 session |
| Step 5 | Vercel route restructuring | 0.5 session |
| Step 6 | CLI client updates | 0.5 session |
| Step 7 | Session store update | 0.25 session |
| **Total** | | **~2.75 sessions** |

---

## 📊 Summary of Results

> Do not summarize the results until the implementation is done and I request it

### ✅ Completed Achievements

_Pending implementation_

## 🚧 Outstanding Issues & Follow-up

### ⚠️ Future Enhancements (Out of Scope)

- [ ] **Additional feature codes** — Data transport API is generic. Future features beyond GR can register their own processing endpoints (e.g., code `CF` for config sync).
- [ ] **POST-based status endpoint** — Currently GET with sessionId in URL. Could change to POST with encrypted body for full traffic disguise. Low priority (UUID in URL reveals nothing).
