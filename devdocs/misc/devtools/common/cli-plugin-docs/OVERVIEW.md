# Docs CLI Plugin (`@aweave/cli-plugin-docs`)

> **Source:** `devtools/common/cli-plugin-docs/`
> **Last Updated:** 2026-02-07

oclif plugin cung cấp topic `aw docs` — document storage và versioning cho AI agents. Plugin này access **SQLite database trực tiếp** qua `better-sqlite3` — không thông qua server.

## Purpose

Lưu trữ và quản lý documents (chủ yếu markdown) với version history:

- **Document Versioning:** Mỗi lần submit = version mới (immutable history)
- **Soft Delete:** Documents không bị xóa vật lý, chỉ đánh dấu `deleted_at`
- **Metadata:** JSON field cho phép AI agents lưu arbitrary data (debate_id, tags, etc.)
- **AI-Friendly Output:** `aw docs get` trả raw content mặc định (plain), `--format json/markdown` cho MCPResponse wrapper

**Cách tiếp cận:** Direct SQLite access (không qua server) vì docs là local-first tool:
- Database: `~/.aweave/docstore.db` (shared across projects)
- Concurrency: WAL mode + transaction retry cho version allocation
- Override: `AWEAVE_DB_PATH` env var cho testing

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   @aweave/cli-plugin-docs                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  commands/docs/                                              │
│  ├── create.ts            ← Create document (v1)             │
│  ├── submit.ts            ← Submit new version               │
│  ├── get.ts               ← Get document (json/plain)        │
│  ├── list.ts              ← List all documents               │
│  ├── history.ts           ← Version history                  │
│  ├── export.ts            ← Export to file                   │
│  └── delete.ts            ← Soft-delete                      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  lib/                                                        │
│  ├── db.ts                ← SQLite operations (better-sqlite3)│
│  └── helpers.ts           ← validateFormatNoPlain(),         │
│                             parseMetadata()                  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ~/.aweave/docstore.db   (SQLite, WAL mode)                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Dependencies

| Package | Role |
|---------|------|
| `@oclif/core` | oclif Command class, Flags, Args |
| `@aweave/cli-shared` | MCPResponse, output helpers, readContent |
| `better-sqlite3` | Synchronous SQLite driver (native binding) |

**No server dependency.** Plugin works standalone — chỉ cần SQLite database file.

## Commands

| Command | Description | Output Formats |
|---------|-------------|----------------|
| `aw docs create` | Create document (v1) | json, markdown |
| `aw docs submit <doc_id>` | Submit new version | json, markdown |
| `aw docs get <doc_id>` | Get latest (or specific version) | **plain** (default), json, markdown |
| `aw docs list` | List all documents | json, markdown |
| `aw docs history <doc_id>` | Show version history | json, markdown |
| `aw docs export <doc_id>` | Export content to file | json, markdown |
| `aw docs delete <doc_id>` | Soft-delete document | json, markdown |

### Special: `--format plain`

Chỉ `aw docs get` hỗ trợ `--format plain` — output raw document content (không JSON wrapper). Dùng cho piping:

```bash
aw docs get <id> --format plain > working.md
aw docs get <id> --format plain | wc -l
```

Các commands khác trả `INVALID_INPUT` error nếu dùng `--format plain`.

## Database Schema

Single table `document_versions` + `schema_meta`:

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID for each version record |
| `document_id` | TEXT | Logical document ID (groups versions) |
| `summary` | TEXT | Brief description |
| `content` | TEXT | Document content (markdown) |
| `version` | INTEGER | Version number (1, 2, 3...) |
| `metadata` | TEXT | JSON metadata (must be object) |
| `created_at` | TEXT | ISO-8601 UTC timestamp |
| `deleted_at` | TEXT | Soft-delete tombstone (NULL = active) |

**UNIQUE constraints:** `(document_id, version)`

**Indexes:** `document_id`, `(document_id, version DESC)`, `created_at DESC`, partial index on active (non-deleted)

### Version Allocation

Version numbers assigned within transaction + retry:
```
BEGIN IMMEDIATE → SELECT MAX(version)+1 → INSERT → COMMIT
```
Retry on UNIQUE constraint violation (concurrent writers).

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `AWEAVE_DB_PATH` | `~/.aweave/docstore.db` | Database file path (override for testing) |

## Project Structure

```
devtools/common/cli-plugin-docs/
├── package.json                    # @aweave/cli-plugin-docs
├── tsconfig.json
└── src/
    ├── index.ts                    # (empty — oclif auto-discovers commands)
    ├── commands/
    │   └── docs/
    │       ├── create.ts
    │       ├── submit.ts
    │       ├── get.ts
    │       ├── list.ts
    │       ├── history.ts
    │       ├── export.ts
    │       └── delete.ts
    └── lib/
        ├── db.ts                   # SQLite operations (better-sqlite3)
        └── helpers.ts              # validateFormatNoPlain(), parseMetadata()
```

## Development

```bash
cd devtools/common/cli-plugin-docs

# Build (requires cli-shared built first)
pnpm build

# Test
export AWEAVE_DB_PATH=/tmp/test-docs.db
aw docs create --summary "Test" --content "Hello"
aw docs list
aw docs get <doc_id>                  # plain (raw content, default)
aw docs get <doc_id> --format json    # MCPResponse JSON wrapper
rm -f /tmp/test-docs.db
```

## Related

- **Docs CLI Plan:** `devdocs/misc/devtools/plans/260131-docs-cli-tool.md`
- **Shared Utilities:** `devtools/common/cli-shared/`
- **Main CLI:** `devtools/common/cli/`
- **Architecture Plan:** `devdocs/misc/devtools/plans/260207-cli-oclif-refactor.md`
