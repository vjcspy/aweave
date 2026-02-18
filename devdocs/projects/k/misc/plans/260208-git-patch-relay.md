# 📋 [GIT-PATCH-RELAY: 2026-02-08] - Git Patch Relay System

## References

- CLI builder skill: `devdocs/agent/skills/common/devtools-cli-builder/SKILL.md`
- Devtools monorepo: `devtools/README.md`
- CLI shared library: `devtools/common/cli-shared/`
- Existing CLI plugin reference: `devtools/common/cli-plugin-docs/`
- pnpm workspace: `devtools/pnpm-workspace.yaml`

## User Requirements

- Môi trường private, DNS và port đều bị chặn
- Chỉ truy cập được `*.vercel.app` qua HTTPS
- Zscaler corporate proxy thực hiện TLS inspection (MITM) — HTTPS body readable bởi proxy
- Workflow: sửa code local → commit → gọi CLI với commit ID → gửi qua Vercel relay → server apply + push lên GitHub
- Patch cần chia nhỏ theo chunk size cấu hình được
- Hỗ trợ không giới hạn repo trong GitHub personal
- Không cần pull code ngược về (code đưa vào private env bằng cách khác)
- Server deploy lên Node.js server có sẵn PM2 (không dùng K8s/Docker)
- Bảo mật: API key + application-layer encryption (chống Zscaler đọc body)
- Git author/committer info không quan trọng — set mặc định là ok, chỉ cần giữ commit message

## 🎯 Objective

Xây dựng hệ thống 3 components cho phép push git patches từ private environment ra GitHub thông qua Vercel relay:

1. **CLI Plugin** (`@aweave/cli-plugin-relay`) — tạo patch từ commit ID, encrypt, chunk, gửi
2. **Vercel Relay** (`git-relay-vercel`) — stateless proxy forward requests
3. **Node.js Server** (`git-relay-server`) — nhận chunks, decrypt, git apply, push (deploy via PM2)

### ⚠️ Key Considerations

1. **Zscaler TLS Inspection**: Zscaler terminate TLS → decrypt → inspect → re-encrypt. Dù HTTPS, body vẫn readable bởi proxy. **BẮT BUỘC** phải encrypt payload ở application layer (AES-256-GCM) trước khi gửi. Vercel relay chỉ thấy encrypted blob.

2. **Vercel Constraints**:
   - Serverless function body limit: **4.5MB** → raw chunk size max ~3.4MB (base64 encoding adds ~33% overhead, see Decision 5)
   - Serverless timeout: 10s (hobby) / 60s (pro) → relay chỉ forward, không xử lý nặng
   - **Không có persistent storage** → mỗi request forward ngay, không buffer

3. **Stateless Relay**: Vercel app KHÔNG giữ state. Mọi state management nằm ở server. Vercel chỉ là transparent proxy thêm auth header.

4. **Multi-Repo Support**: Server quản lý repos dynamically — clone khi lần đầu gặp, fetch cho lần sau. Dùng single GitHub PAT (fine-grained) với quyền truy cập tất cả personal repos.

---

## Architecture Overview

```
[Private Env]                    [Vercel App]                [Node.js + PM2]
CLI Plugin                       Stateless Relay             Core Logic
                                 *.vercel.app
┌─────────────┐                 ┌──────────────┐            ┌──────────────────┐
│ commit local│   HTTPS         │              │   HTTPS    │                  │
│ format-patch│──(Zscaler)─────>│  Forward     │──────────>│  Store chunks    │
│ encrypt     │                 │  + Auth      │            │  Reassemble      │
│ chunk+send  │                 │              │            │  Decrypt         │
│ poll status │<────────────────│              │<───────────│  git am          │
└─────────────┘                 └──────────────┘            │  git push        │
                                                            │                  │
                                 Zscaler sees:              │  GitHub PAT      │
                                 encrypted blobs            └────────┬─────────┘
                                 (unreadable)                        │
                                                                     v
                                                              [GitHub API]
                                                              git push via HTTPS
```

### Encryption Flow

```
CLI (private env)                                    Node.js Server
┌──────────────────┐                                ┌──────────────────┐
│ Pre-shared key   │                                │ Same key         │
│ (AES-256-GCM)    │                                │ (env var)        │
│                  │                                │                  │
│ 1. Generate IV   │                                │ 4. Reassemble    │
│ 2. Encrypt patch │──> [encrypted blob] ──────────>│ 5. Decrypt       │
│ 3. Split chunks  │    (via Vercel relay)           │ 6. git am        │
└──────────────────┘                                └──────────────────┘

Vercel relay: forwards encrypted blob as-is, CANNOT decrypt
Zscaler: sees encrypted base64 in HTTPS body, CANNOT decrypt
```

### API Flow

```
1. CLI: POST /api/relay/chunk    ×N  (encrypted data chunks)
2. CLI: POST /api/relay/complete      (metadata + IV, triggers processing)
3. CLI: GET  /api/relay/status/:id    (poll until pushed/failed)
```

---

## Design Decisions

### Decision 1: Encrypt-then-Chunk (not Chunk-then-Encrypt)

Encrypt toàn bộ patch thành 1 encrypted blob, sau đó split thành chunks.

| Approach | Pro | Con |
|----------|-----|-----|
| **Encrypt → Chunk** (chosen) | Single IV, simple, tamper detection on whole blob | Cần full patch in memory |
| Chunk → Encrypt | Streaming friendly | Multiple IVs, complex reassembly, per-chunk overhead |

Với patch size ≤ 10MB, encrypt-then-chunk là đủ tốt. Memory không phải concern.

### Decision 2: AES-256-GCM Pre-shared Key

| Option | Pro | Con |
|--------|-----|-----|
| **Pre-shared AES-256-GCM** (chosen) | Simple, fast, authenticated encryption | Key distribution manual |
| RSA + AES hybrid | No pre-shared symmetric key | Complex, overkill |
| No encryption | Simplest | Zscaler reads everything |

GCM mode cung cấp cả encryption + authentication (integrity check). Nếu ai đó tamper data, decrypt sẽ fail.

**Key generation:**
```bash
openssl rand -base64 32
# Output: <32-byte key in base64> → share giữa CLI config và server .env
```

### Decision 3: Commit-based workflow with `git format-patch`

User workflow: commit locally → call CLI with commit ID(s) → CLI generates patch → encrypt → send.

| Command | Server Action | Details |
|---------|---------------|---------|
| `git format-patch --binary --stdout <commitId>^..<commitId>` | `git am --3way` | Preserves commit message |

**Key points:**
- User MUST commit changes locally trước khi gọi CLI
- CLI nhận commit ID (hoặc range), dùng `git format-patch` để tạo patch
- Commit message được preserve qua `git am` — đây là thông tin quan trọng duy nhất cần giữ
- Author/committer info: server set mặc định (relay-bot), không cần preserve từ original commit
- `--binary` flag đảm bảo binary files được include

**Server-side `git am` behavior:**
- `git am` mặc định giữ author info từ patch. Để override dùng default identity:
  ```bash
  git am --3way --committer-date-is-author-date <patch>
  ```
  Git identity env vars (`GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL`) sẽ override committer.
  Author info từ patch cũng không quan trọng — chỉ cần commit message là đủ.

### Decision 4: Session-based chunk management

- CLI generates UUID v4 per push session
- Server stores chunks in temp directory: `/tmp/relay-sessions/<sessionId>/`
- On `complete`: reassemble → decrypt → apply → push → cleanup
- Timeout: sessions auto-cleanup sau 10 phút không activity
- Idempotent chunk upload: same (sessionId, chunkIndex) overwrites, không duplicate

### Decision 5: Chunk size vs Vercel body limit

Chunks are transported as **base64-encoded strings inside JSON**. Base64 adds ~33% overhead, plus JSON envelope (keys, sessionId, etc.) adds ~200-300 bytes. Therefore:

```
Vercel body limit:       4.5 MB (4,718,592 bytes)
JSON envelope overhead:  ~300 bytes
Base64 overhead:         raw_size × 4/3

Max raw chunk size:      (4,718,592 - 300) × 3/4 ≈ 3,538,719 bytes ≈ 3.37 MB
Safe default:            3,145,728 bytes (3 MB) — leaves comfortable buffer
Hard cap:                3,400,000 bytes (~3.24 MB)
```

CLI MUST validate: `chunkSize ≤ HARD_CAP` before sending. Default chunk size: **3 MB** (not 2 MB as previously stated).

| Config | Value | Reason |
|--------|-------|--------|
| Default chunk size | 3 MB (3,145,728) | Optimal throughput within safe limit |
| Hard cap | 3.4 MB (3,400,000) | Max before base64+JSON risks exceeding 4.5MB |
| Min chunk size | 64 KB (65,536) | Prevent excessive request count |

### Decision 6: Per-repo lock for concurrency safety

Multiple push sessions MAY target the same repo concurrently. Since all sessions share a single repo working directory (`REPOS_DIR/<owner>/<repo>`), concurrent checkout/apply/push operations would corrupt state.

**Chosen approach: Per-repo async lock (serialize per repo)**

```typescript
// repo-manager.ts — per-repo mutex
const repoLocks = new Map<string, Promise<void>>();

async function withRepoLock<T>(repoKey: string, fn: () => Promise<T>): Promise<T> {
  const prev = repoLocks.get(repoKey) ?? Promise.resolve();
  let resolve: () => void;
  const next = new Promise<void>(r => { resolve = r; });
  repoLocks.set(repoKey, next);
  await prev;
  try {
    return await fn();
  } finally {
    resolve!();
  }
}
```

| Alternative | Pro | Con | Decision |
|-------------|-----|-----|----------|
| **Per-repo lock** (chosen) | Simple, no extra disk, deterministic order | Sequential — can't parallel same repo | ✅ Good for personal dev tool, predictable |
| Per-session worktree | True parallel same repo | Disk overhead, cleanup complexity, clone per session | Overkill for v1 |
| No protection | Simplest | Data corruption | ❌ Unacceptable |

Sessions targeting **different repos** run fully in parallel. Only same-repo sessions are serialized.

### Decision 7: Single GitHub PAT for all repos

Dùng fine-grained Personal Access Token với quyền:
- `Contents: Read and Write` — cho git push
- `Metadata: Read` — cho repo info
- Scope: All repositories (hoặc chọn specific repos)

Server config chỉ cần 1 PAT. Nếu sau này cần multi-account, mở rộng bằng mapping config.

---

## 🔄 Implementation Plan

### Phase 1: Node.js Server (`projects/meta/misc/git-relay-server/`)

Core logic server — deploy via PM2. Build trước để test với curl trực tiếp.

#### File Structure

```
projects/meta/misc/git-relay-server/
├── package.json               # 🚧 Express + simple-git + crypto
├── tsconfig.json              # 🚧
├── ecosystem.config.cjs       # 🚧 PM2 config
├── .env.example               # 🚧
├── .gitignore                 # 🚧
└── src/
    ├── index.ts               # 🚧 Entry point
    ├── server.ts              # 🚧 Express setup + middleware
    ├── routes/
    │   ├── health.ts          # 🚧 GET /health
    │   └── patches.ts         # 🚧 POST /chunk, POST /complete, GET /status/:id
    ├── services/
    │   ├── session-store.ts   # 🚧 Chunk storage + reassembly + TTL cleanup
    │   ├── crypto.ts          # 🚧 AES-256-GCM decrypt
    │   ├── git.ts             # 🚧 Clone, fetch, apply, commit, push
    │   └── repo-manager.ts    # 🚧 Multi-repo lifecycle (clone/fetch/cleanup)
    └── lib/
        ├── config.ts          # 🚧 Env-based config
        ├── types.ts           # 🚧 Shared types
        └── errors.ts          # 🚧 Custom error classes
```

#### Dependencies

```json
{
  "dependencies": {
    "express": "^5",
    "simple-git": "^3",
    "uuid": "^11"
  },
  "devDependencies": {
    "@types/express": "^5",
    "@types/node": "^22",
    "typescript": "^5.7"
  }
}
```

> Không dùng package ngoài cho crypto — Node.js built-in `crypto` module đủ cho AES-256-GCM.
> `simple-git` wrapper cho git CLI operations (clone, fetch, am, apply, push).

#### API Specification

**POST `/api/patches/chunk`**

```typescript
// Request
{
  sessionId: string;      // UUID v4, generated by CLI
  chunkIndex: number;     // 0-based
  totalChunks: number;    // total expected chunks
  data: string;           // base64 encoded encrypted chunk
}

// Response 200
{ success: true, received: number }  // number of chunks received so far

// Response 401
{ error: "UNAUTHORIZED" }

// Response 409
{ error: "SESSION_COMPLETED", message: "Session already processed" }
```

**POST `/api/patches/complete`**

```typescript
// Request
{
  sessionId: string;
  repo: string;           // "owner/repo"
  branch: string;         // target branch to push
  baseBranch: string;     // base branch (default: "main")
  iv: string;             // base64 encoded IV (12 bytes) for AES-256-GCM decryption
  authTag: string;        // base64 encoded auth tag (16 bytes) for GCM verification
}

// Response 202
{ success: true, status: "processing" }

// Response 400
{ error: "INCOMPLETE_CHUNKS", expected: 5, received: 3 }

// Response 401
{ error: "UNAUTHORIZED" }
```

**Async Processing Model for `/complete`:**

The `/complete` endpoint returns `202 Accepted` immediately and processes git operations asynchronously:

```typescript
// POST /api/patches/complete handler
async function handleComplete(req, res) {
  // 1. Validate all chunks received (sync, fast)
  // 2. Set status → "processing"
  // 3. Return 202 immediately
  res.status(202).json({ success: true, status: "processing" });

  // 4. Process async (fire-and-forget with error capture)
  processSession(sessionId, metadata).catch(err => {
    sessionStore.setFailed(sessionId, err.message);
  });
}

async function processSession(sessionId, metadata) {
  // Runs inside per-repo lock (Decision 6)
  await withRepoLock(repoKey, async () => {
    // a. Reassemble chunks → single encrypted buffer
    // b. Decrypt (AES-256-GCM)
    // c. Prepare repo (clone/fetch + checkout)
    // d. Apply patch (git am --3way)
    // e. Push to GitHub
    // f. Set status → "pushed" with commitSha
  });
}
```

**Session State Machine:**

```
                 chunk upload
  (new) ────────────────────► RECEIVING
                                  │
                           POST /complete
                                  │
                    ┌─────────────▼──────────────┐
                    │        PROCESSING           │
                    │  (reassemble, decrypt,       │
                    │   apply, push)               │
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
| `processing` | Git operations in progress | No |
| `pushed` | Successfully pushed to GitHub | Yes |
| `failed` | Error occurred (details in `error` field) | Yes |

**Restart Behavior:** Sessions are in-memory only (acceptable for personal dev tool). Server restart loses active sessions. CLI can detect stale session via status polling timeout and retry with a new session. No durable persistence needed for v1.

**GET `/api/patches/status/:sessionId`**

```typescript
// Response 200
{
  sessionId: string;
  status: "receiving" | "processing" | "pushed" | "failed";
  message: string;
  details?: {
    chunksReceived?: number;
    totalChunks?: number;
    commitSha?: string;
    commitUrl?: string;    // https://github.com/{owner}/{repo}/commit/{sha}
    error?: string;        // git apply/push error message
  }
}
```

#### Implementation Details

**`src/services/crypto.ts`**
```typescript
import { createDecipheriv } from 'node:crypto';

export function decrypt(
  encryptedData: Buffer,  // concatenated chunks
  key: Buffer,            // 32 bytes AES-256 key
  iv: Buffer,             // 12 bytes IV
  authTag: Buffer         // 16 bytes GCM auth tag
): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}
```

**`src/services/session-store.ts`**
```typescript
// In-memory + filesystem session store
// - Metadata in Map<sessionId, SessionInfo>
// - Chunks written to /tmp/relay-sessions/<sessionId>/chunk-<index>.bin
// - Reassembly: read chunks in order, concatenate
// - TTL: setInterval cleanup sessions older than 10 minutes
// - On complete: reassemble → return single Buffer → delete temp files

interface SessionInfo {
  sessionId: string;
  totalChunks: number;
  receivedChunks: Set<number>;
  status: 'receiving' | 'processing' | 'pushed' | 'failed';
  message: string;
  details: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}
```

**`src/services/git.ts`**
```typescript
// Git operations using simple-git
//
// applyPatch(repoPath, patchContent):
//   git am --3way <patch>
//   If fails: git am --abort, return error
//   Note: git am preserves commit message from patch.
//   Author/committer use default identity (relay-bot) from env vars.
//
// pushBranch(repoPath, branch):
//   git push origin <branch>
//   Return commit SHA
```

**`src/services/repo-manager.ts`**
```typescript
// Multi-repo lifecycle management
//
// REPOS_DIR = /data/repos (configurable)
//
// GIT AUTH: Embedded PAT in URL (simplest approach)
//   Server runs in private environment — no external access.
//   PAT embedded directly in git remote URL for simplicity.
//
//   Git URL: https://x-access-token:<PAT>@github.com/<owner>/<repo>.git
//
// getRepo(owner, repo, baseBranch):
//   path = REPOS_DIR/<owner>/<repo>
//   repoUrl = `https://x-access-token:${config.githubPat}@github.com/${owner}/${repo}.git`
//   if not exists:
//     git clone <repoUrl> <path>
//   else:
//     cd <path> && git fetch origin
//   git checkout -B <branch> origin/<baseBranch>
//   return path
```

#### Environment Variables

```bash
# .env.example
PORT=3000
API_KEY=<server-api-key>              # Auth from Vercel relay
ENCRYPTION_KEY=<base64-aes-256-key>   # Same key as CLI
GITHUB_PAT=<github-pat>              # Fine-grained PAT
REPOS_DIR=/data/repos                 # Git repo storage
SESSION_TTL_MS=600000                 # 10 min session timeout
GIT_AUTHOR_NAME=relay-bot             # Git identity for commits (required for git am/commit)
GIT_AUTHOR_EMAIL=relay@noreply        # Git identity email
GIT_COMMITTER_NAME=relay-bot          # Git committer identity
GIT_COMMITTER_EMAIL=relay@noreply     # Git committer email
```

**Startup Validation:** Server MUST validate at startup that all required env vars are set. For git identity, configure globally before any git operation:

```typescript
// src/lib/config.ts — startup validation
const REQUIRED_ENV = ['API_KEY', 'ENCRYPTION_KEY', 'GITHUB_PAT', 'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL'];

export function validateConfig() {
  const missing = REQUIRED_ENV.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

// Set git identity via env (applies to all child git processes)
// GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL
// are automatically respected by git commands.
// For format-patch mode: original author/committer from patch is preserved by git am.
// For diff mode: these env vars are used for the new commit.
```

#### PM2 Config (`ecosystem.config.cjs`)

```javascript
module.exports = {
  apps: [{
    name: 'git-relay-server',
    script: 'dist/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    // Sensitive env vars loaded from .env file or set via pm2 set
    // API_KEY, ENCRYPTION_KEY, GITHUB_PAT, etc.
  }],
};
```

#### Deployment

```bash
# On server (Node.js + PM2 already installed)
cd /path/to/git-relay-server
pnpm install --frozen-lockfile
pnpm build
cp .env.example .env  # Edit with actual values
pm2 start ecosystem.config.cjs
pm2 save
```

---

### Phase 2: Vercel Relay (`projects/meta/misc/git-relay-vercel/`)

Stateless Next.js app — thin proxy layer.

#### File Structure

```
projects/meta/misc/git-relay-vercel/
├── package.json               # 🚧 Next.js
├── next.config.ts             # 🚧
├── tsconfig.json              # 🚧
├── .env.example               # 🚧
├── .env.local                 # 🚧 (gitignored)
├── .gitignore                 # 🚧
└── src/
    └── app/
        ├── layout.tsx         # 🚧 Minimal root layout
        ├── page.tsx           # 🚧 Simple status page
        └── api/
            └── relay/
                ├── chunk/
                │   └── route.ts       # 🚧 POST - forward chunk
                ├── complete/
                │   └── route.ts       # 🚧 POST - forward complete
                └── status/
                    └── [sessionId]/
                        └── route.ts   # 🚧 GET - forward status
```

#### Core Logic

Mỗi API route chỉ làm 3 việc:
1. Validate API key từ request header (`X-Relay-Key`)
2. Forward request body tới server (thêm `X-Server-Key` header)
3. Return server response nguyên vẹn

```typescript
// src/app/api/relay/chunk/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SERVER_URL = process.env.SERVER_URL!;
const SERVER_KEY = process.env.SERVER_API_KEY!;
const RELAY_KEY = process.env.RELAY_API_KEY!;

export async function POST(req: NextRequest) {
  // 1. Auth
  if (req.headers.get('X-Relay-Key') !== RELAY_KEY) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // 2. Forward
  const body = await req.text();
  const res = await fetch(`${SERVER_URL}/api/patches/chunk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Server-Key': SERVER_KEY,
    },
    body,
  });

  // 3. Return
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

> **Tất cả 3 routes đều cùng pattern** — chỉ khác URL path và HTTP method. Có thể extract thành shared `forwardToServer()` helper.

#### Environment Variables (Vercel)

```bash
# .env.example
RELAY_API_KEY=<api-key-from-cli>       # CLI → Vercel auth
SERVER_URL=https://my-server.example.com  # Node.js server URL
SERVER_API_KEY=<api-key-to-server>     # Vercel → Server auth
```

#### Vercel Config Notes

- **Framework**: Next.js (auto-detected)
- **Build Command**: `next build` (default)
- **Function Region**: Chọn region gần server nhất để minimize latency
- **Body Size Limit**: 4.5MB per request (built-in Vercel limit)

---

### Phase 3: CLI Plugin (`devtools/common/cli-plugin-relay/`)

oclif plugin theo đúng convention của devtools monorepo.

#### File Structure

```
devtools/common/cli-plugin-relay/
├── package.json               # 🚧 @aweave/cli-plugin-relay
├── tsconfig.json              # 🚧
└── src/
    ├── index.ts               # 🚧 oclif plugin entry
    ├── commands/
    │   └── relay/
    │       ├── push.ts        # 🚧 aw relay push
    │       ├── status.ts      # 🚧 aw relay status <sessionId>
    │       └── config/
    │           ├── set.ts     # 🚧 aw relay config set
    │           ├── show.ts    # 🚧 aw relay config show
    │           └── generate-key.ts  # 🚧 aw relay config generate-key
    └── lib/
        ├── config.ts          # 🚧 Config file (~/.aweave/relay.json)
        ├── crypto.ts          # 🚧 AES-256-GCM encrypt
        ├── chunker.ts         # 🚧 Split encrypted blob into chunks
        └── relay-client.ts    # 🚧 HTTP client to Vercel relay
```

#### package.json

```json
{
  "name": "@aweave/cli-plugin-relay",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": { "build": "tsc" },
  "oclif": {
    "commands": "./dist/commands",
    "topicSeparator": " "
  },
  "dependencies": {
    "@aweave/cli-shared": "workspace:*",
    "@oclif/core": "^4.2.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "typescript": "^5.7.3"
  }
}
```

> **Không cần thêm dependency ngoài** — Node.js built-in `crypto`, `child_process` (cho git), `fs`, `path` là đủ.

#### Commands

**`aw relay push`** — Main command

```
USAGE
  $ aw relay push --repo <owner/repo> --commit <id> [--branch <name>] [--base <name>]
                   [--commits <N>] [--chunk-size <bytes>] [--format json|markdown]

FLAGS
  --repo          (required) GitHub repo, format: owner/repo
  --commit        (required) Commit ID to push (e.g., abc123, HEAD)
  --branch        Target branch to push (default: current branch name)
  --base          Base branch on remote (default: "main")
  --commits       Number of commits to include starting from --commit (default: 1)
  --chunk-size    Chunk size in bytes (default: from config or 3145728, max: 3400000)
  --format        Output format (default: json)

EXAMPLES
  # Push a specific commit
  $ git commit -m "feat: add auth"
  $ aw relay push --repo user/my-app --commit HEAD --branch feature/auth

  # Push last 3 commits
  $ aw relay push --repo user/my-app --commit HEAD --commits 3

  # Push specific commit by ID
  $ aw relay push --repo user/my-app --commit abc123 --branch hotfix/typo
```

**Flow trong `push.ts`:**

```typescript
async run() {
  const { flags } = await this.parse(RelayPush);
  const config = loadConfig();  // ~/.aweave/relay.json

  // 1. Preflight validation
  const chunkSize = flags.chunkSize || config.chunkSize || 3 * 1024 * 1024;
  if (chunkSize > 3_400_000) {
    return output(errorResponse('INVALID_CHUNK_SIZE', 'Max chunk size is 3.4MB (base64+JSON must fit in Vercel 4.5MB limit)'), flags.format);
  }

  // 2. Verify commit exists
  const commitId = flags.commit;
  const commitCount = flags.commits || 1;
  try {
    execGit('rev-parse', '--verify', commitId);
  } catch {
    return output(errorResponse('INVALID_COMMIT', `Commit ${commitId} not found`), flags.format);
  }

  // 3. Generate patch from commit(s)
  const range = `${commitId}~${commitCount}..${commitId}`;
  const patch = execGit('format-patch', '--binary', '--stdout', range);

  if (patch.length === 0) {
    return output(errorResponse('NO_CHANGES', 'No changes to push'), flags.format);
  }

  // 4. Encrypt
  const { encrypted, iv, authTag } = encrypt(patch, config.encryptionKey);

  // 5. Chunk
  const chunks = splitIntoChunks(encrypted, chunkSize);

  // 6. Upload chunks
  const sessionId = randomUUID();
  for (let i = 0; i < chunks.length; i++) {
    await uploadChunk(config.relayUrl, config.apiKey, {
      sessionId,
      chunkIndex: i,
      totalChunks: chunks.length,
      data: chunks[i].toString('base64'),
    });
    // Progress: chunk i+1/total uploaded
  }

  // 7. Signal complete
  await signalComplete(config.relayUrl, config.apiKey, {
    sessionId,
    repo: flags.repo,
    branch: flags.branch || getCurrentBranch(),
    baseBranch: flags.base || 'main',
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  });

  // 8. Poll status
  const result = await pollStatus(config.relayUrl, config.apiKey, sessionId);

  // 9. Output result
  output(new MCPResponse({
    success: result.status === 'pushed',
    content: [new MCPContent({ type: ContentType.JSON, data: result })],
    metadata: { resource_type: 'relay_push', message: result.message },
  }), flags.format);
}
```

**`aw relay config set`** — Configure relay settings

```
USAGE
  $ aw relay config set --relay-url <url>
  $ aw relay config set --api-key <key>
  $ aw relay config set --encryption-key <key>
  $ aw relay config set --chunk-size <bytes>

DESCRIPTION
  Set relay configuration values. Config stored at ~/.aweave/relay.json
```

**`aw relay config show`** — Show current config

```
USAGE
  $ aw relay config show [--format json|markdown]

DESCRIPTION
  Display current relay configuration (encryption key masked)
```

**`aw relay config generate-key`** — Generate encryption key

```
USAGE
  $ aw relay config generate-key [--format json|markdown]

DESCRIPTION
  Generate a random AES-256 encryption key (base64 encoded).
  Use this key in both CLI config and server .env.
```

**`aw relay status`** — Check push status

```
USAGE
  $ aw relay status <sessionId> [--format json|markdown]

DESCRIPTION
  Check the status of a previously submitted patch push
```

#### Config File (`~/.aweave/relay.json`)

```json
{
  "relayUrl": "https://my-relay.vercel.app",
  "apiKey": "relay-api-key-here",
  "encryptionKey": "base64-encoded-32-byte-key",
  "chunkSize": 3145728,
  "defaultBaseBranch": "main"
}
```

#### Crypto Implementation (`src/lib/crypto.ts`)

```typescript
import { createCipheriv, randomBytes } from 'node:crypto';

export interface EncryptResult {
  encrypted: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export function encrypt(data: Buffer, keyBase64: string): EncryptResult {
  const key = Buffer.from(keyBase64, 'base64');  // 32 bytes
  const iv = randomBytes(12);                     // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();            // 16 bytes
  return { encrypted, iv, authTag };
}
```

#### Chunker Implementation (`src/lib/chunker.ts`)

```typescript
export function splitIntoChunks(data: Buffer, chunkSize: number): Buffer[] {
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    chunks.push(data.subarray(offset, offset + chunkSize));
  }
  return chunks;
}
```

#### Registration Steps

1. Add to `devtools/pnpm-workspace.yaml`:
   ```yaml
   - common/cli-plugin-relay
   ```

2. Add to `devtools/common/cli/package.json`:
   ```json
   {
     "dependencies": {
       "@aweave/cli-plugin-relay": "workspace:*"
     },
     "oclif": {
       "plugins": ["@aweave/cli-plugin-relay"]
     }
   }
   ```

3. Build & verify:
   ```bash
   cd devtools && pnpm install && pnpm -r build
   aw relay --help
   ```

---

### Phase 4: Integration & Deployment

#### 4.1 Key Generation & Distribution

```bash
# Generate shared encryption key (run once)
openssl rand -base64 32
# Example output: K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=

# Generate API keys
openssl rand -hex 32  # → relay API key (CLI ↔ Vercel)
openssl rand -hex 32  # → server API key (Vercel ↔ Server)
```

Distribute:
| Key | CLI Config | Vercel Env | Server .env |
|-----|-----------|------------|-------------|
| Encryption Key | `~/.aweave/relay.json` | ❌ | `ENCRYPTION_KEY` |
| Relay API Key | `~/.aweave/relay.json` | `RELAY_API_KEY` | ❌ |
| Server API Key | ❌ | `SERVER_API_KEY` | `API_KEY` |
| GitHub PAT | ❌ | ❌ | `GITHUB_PAT` |

> **Vercel KHÔNG có encryption key** — chỉ forward encrypted blobs.

#### 4.2 Deploy Sequence

1. **Node.js Server**: `pnpm build` → `pm2 start ecosystem.config.cjs` → verify `/health`
2. **Vercel App**: `vercel deploy` → set env vars → verify forwarding
3. **CLI Plugin**: `pnpm -r build && aw relay config set ...` → test push

#### 4.3 Smoke Test

```bash
# 1. Generate key
aw relay config generate-key
# Copy key → set in server .env

# 2. Configure CLI
aw relay config set --relay-url https://my-relay.vercel.app
aw relay config set --api-key <relay-key>
aw relay config set --encryption-key <encryption-key>

# 3. Test push
cd /path/to/any/repo
echo "test" >> test.txt
git add -A && git commit -m "test: relay smoke test"
aw relay push --repo myuser/test-repo --commit HEAD --branch test/relay

# Expected output:
# {
#   "success": true,
#   "content": [{ "type": "json", "data": {
#     "status": "pushed",
#     "commitSha": "abc123...",
#     "commitUrl": "https://github.com/myuser/test-repo/commit/abc123"
#   }}],
#   "metadata": { "resource_type": "relay_push", "message": "Pushed 1 commit to myuser/test-repo:test/relay" }
# }
```

---

## Phase 2 Detail: Implementation Steps

### Step 1: Build Node.js Server

- [x] Init project: `package.json`, `tsconfig.json`, `.gitignore`
- [x] Implement `src/lib/config.ts` — env-based config with validation
- [x] Implement `src/lib/types.ts` — shared interfaces
- [x] Implement `src/lib/errors.ts` — custom error classes
- [x] Implement `src/services/crypto.ts` — AES-256-GCM decrypt
- [x] Implement `src/services/session-store.ts` — chunk storage + reassembly + TTL
- [x] Implement `src/services/repo-manager.ts` — multi-repo clone/fetch lifecycle
- [x] Implement `src/services/git.ts` — apply patch + push
- [x] Implement `src/routes/health.ts` — GET /health
- [x] Implement `src/routes/patches.ts` — POST /chunk, POST /complete, GET /status
- [x] Implement `src/server.ts` — Express setup, middleware, error handling
- [x] Implement `src/index.ts` — entry point
- [x] Write `ecosystem.config.cjs` — PM2 config
- [x] Write `.env.example`
- [ ] Test manually with curl

### Step 2: Build Vercel Relay

- [x] Create Next.js project with `create-next-app`
- [x] Implement `src/app/api/relay/chunk/route.ts`
- [x] Implement `src/app/api/relay/complete/route.ts`
- [x] Implement `src/app/api/relay/status/[sessionId]/route.ts`
- [x] Add minimal `page.tsx` (status/health indicator)
- [x] Write `.env.example`
- [ ] Deploy to Vercel, set env vars
- [ ] Test forwarding with curl

### Step 3: Build CLI Plugin

- [x] Scaffold `devtools/common/cli-plugin-relay/` (package.json, tsconfig, src/index.ts)
- [x] Implement `src/lib/config.ts` — config file CRUD
- [x] Implement `src/lib/crypto.ts` — AES-256-GCM encrypt
- [x] Implement `src/lib/chunker.ts` — split buffer into chunks
- [x] Implement `src/lib/relay-client.ts` — HTTP client (upload chunk, complete, poll status)
- [x] Implement `src/commands/relay/config/set.ts`
- [x] Implement `src/commands/relay/config/show.ts`
- [x] Implement `src/commands/relay/config/generate-key.ts`
- [x] Implement `src/commands/relay/push.ts` — main push command
- [x] Implement `src/commands/relay/status.ts` — check status
- [x] Register plugin in `pnpm-workspace.yaml` + `cli/package.json`
- [x] `pnpm install && pnpm -r build`
- [x] Verify: `aw relay --help`

### Step 4: Integration Test

- [ ] Generate encryption key + API keys
- [ ] Configure all 3 components
- [ ] End-to-end test: `aw relay push` → Vercel → Server → GitHub
- [ ] Test with large patch (> chunk size) to verify chunking
- [ ] Test error cases: invalid API key, bad patch, non-existent repo
- [ ] Test idempotency: resend same session chunks

---

## Error Handling Matrix

| Scenario | Component | Behavior |
|----------|-----------|----------|
| Invalid CLI config (missing key/url) | CLI | Error + suggestion: `aw relay config set --help` |
| Invalid API key (CLI→Vercel) | Vercel | 401 Unauthorized |
| Invalid API key (Vercel→Server) | Server | 401 Unauthorized |
| Chunk upload fails (network) | CLI | Retry up to 3 times with exponential backoff |
| Incomplete chunks on complete | Server | 400 with expected vs received count |
| Decryption fails (wrong key) | Server | 400 "Decryption failed — check encryption key" |
| Auth tag verification fails (tampered data) | Server | 400 "Data integrity check failed" |
| Patch doesn't apply cleanly | Server | Failed status with `git am` error output |
| Repo not found on GitHub | Server | Failed status with clone error |
| Push rejected (permissions) | Server | Failed status with push error |
| Session timeout (10 min) | Server | 404 "Session expired" |
| Vercel timeout (10s hobby) | Vercel | CLI retries; for large repos consider Vercel Pro (60s) |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Vercel 10s timeout (hobby plan) | High — clone large repos on server may exceed | Server pre-caches repos after first clone. Subsequent pushes only fetch (fast). First push to new repo may need Vercel Pro or CLI retry. |
| Chunk size vs Vercel body limit | Medium — exceeding 4.5MB breaks upload | Default chunk size 3MB, hard cap 3.4MB (accounts for base64+JSON overhead). CLI validates before send (Decision 5). |
| Encryption key compromise | High — all patches readable | Rotate key: generate new, update CLI config + server .env, old sessions become unreadable (acceptable). |
| Server disk space (many repos) | Low — local dev tool | Periodic cleanup of repos not accessed in N days. Configurable. |
| Git merge conflicts on apply | Medium — patch based on stale base | Server fetches latest before apply. If conflict: return error with details, user rebases locally and re-pushes. |
| Zscaler blocks specific content patterns | Low — encrypted payload looks like random base64 | GCM encryption produces uniform random output. No detectable patterns. |

---

## Estimation

| Component | Files | LOC (approx) | Effort |
|-----------|-------|-------------|--------|
| Node.js Server | ~12 | ~400 | 1-2 sessions |
| Vercel Relay | ~6 | ~120 | 0.5 session |
| CLI Plugin | ~10 | ~400 | 1-2 sessions |
| Integration + Testing | — | — | 0.5 session |
| **Total** | **~28** | **~970** | **3-5 sessions** |

---

## 📊 Summary of Results

> Do not summarize the results until the implementation is done and I request it

### ✅ Completed Achievements

_Pending implementation_

## Implementation Notes / As Implemented

### Phase 1: Node.js Server (`projects/meta/misc/git-relay-server/`)

**Files created (12 files):**

```
projects/meta/misc/git-relay-server/
├── package.json
├── tsconfig.json
├── .gitignore
├── .env.example
├── ecosystem.config.cjs
└── src/
    ├── index.ts
    ├── server.ts
    ├── lib/
    │   ├── config.ts
    │   ├── types.ts
    │   └── errors.ts
    ├── routes/
    │   ├── health.ts
    │   └── patches.ts
    └── services/
        ├── crypto.ts
        ├── session-store.ts
        ├── repo-manager.ts
        └── git.ts
```

**Key implementation details:**
- Express v5 with 5MB JSON body limit (supports base64 chunks)
- Auth via `X-Server-Key` header on `/api/*` routes
- `SessionStore` class with in-memory metadata + filesystem chunk storage (`/tmp/relay-sessions/`)
- `RepoManager` with per-repo async lock (via promise chain pattern)
- `git am --3way --committer-date-is-author-date` for patch application
- `--force-with-lease` on push for safety
- Custom error hierarchy: `RelayError` → `UnauthorizedError`, `SessionNotFoundError`, `SessionCompletedError`, `IncompleteChunksError`, `DecryptionError`, `GitOperationError`
- Global error handler middleware catches `UnauthorizedError`

### Phase 2: Vercel Relay (`projects/meta/misc/git-relay-vercel/`)

**Files created (8 files):**

```
projects/meta/misc/git-relay-vercel/
├── package.json
├── tsconfig.json
├── next.config.ts
├── .gitignore
├── .env.example
└── src/
    ├── lib/
    │   └── forward.ts
    └── app/
        ├── layout.tsx
        ├── page.tsx
        └── api/relay/
            ├── chunk/route.ts
            ├── complete/route.ts
            └── status/[sessionId]/route.ts
```

**Key implementation details:**
- Shared `forwardToServer()` helper in `src/lib/forward.ts` — all 3 routes use the same pattern
- Auth: validates `X-Relay-Key` header, forwards with `X-Server-Key` to server
- Error handling: returns 502 if server unreachable
- Next.js 15 with App Router

### Phase 3: CLI Plugin (`devtools/common/cli-plugin-relay/`)

**Files created (10 files):**

```
devtools/common/cli-plugin-relay/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── lib/
    │   ├── config.ts
    │   ├── crypto.ts
    │   ├── chunker.ts
    │   └── relay-client.ts
    └── commands/relay/
        ├── push.ts
        ├── status.ts
        └── config/
            ├── set.ts
            ├── show.ts
            └── generate-key.ts
```

**Key implementation details:**
- Config file at `~/.aweave/relay.json` — CRUD via `loadConfig()` / `saveConfig()`
- AES-256-GCM encrypt with key length validation (must be 32 bytes)
- Chunker validates hard cap (3.4MB) and min size (64KB)
- HTTP client with 3-retry exponential backoff (skips retry on 400/401)
- Status polling with 2s interval, 5-minute timeout
- All commands follow MCP response format via `@aweave/cli-shared`
- `relay config show` masks sensitive values (first 4 + last 4 chars)
- No external dependencies beyond `@aweave/cli-shared` and `@oclif/core`

**Registration:**
- Added `common/cli-plugin-relay` to `devtools/pnpm-workspace.yaml`
- Added `@aweave/cli-plugin-relay` to `devtools/common/cli/package.json` (dependencies + oclif.plugins)
- Build verified: `pnpm install && pnpm --filter @aweave/cli-plugin-relay build` — no errors
- Commands verified: `aw relay --help` shows `relay push`, `relay status`, `relay config` sub-commands

## 🚧 Outstanding Issues & Follow-up

### ⚠️ Future Enhancements (Out of Scope)

- [ ] **Pull/Clone through relay** — Reverse flow: server fetches repo archive → Vercel serves → CLI downloads. Useful nếu cần pull updates vào private env.
- [ ] **Web UI on Vercel** — Dashboard hiển thị push history, status, logs.
- [ ] **Multi-account GitHub** — Mapping config cho multiple PATs (personal + org repos).
- [ ] **Webhook notification** — Server gửi webhook (Slack, Discord) sau mỗi successful push.
- [ ] **Compression** — gzip patch trước khi encrypt để giảm chunk count.
