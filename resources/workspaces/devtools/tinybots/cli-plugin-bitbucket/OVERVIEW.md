---
name: "cli-plugin-bitbucket"
description: "Oclif CLI plugin cung cấp topic `aw tinybots-bitbucket` — Bitbucket PR tools cho TinyBots domain, gọi trực tiếp Bitbucket REST API v2.0 với auto-pagination."
tags: ["tinybots", "cli", "bitbucket", "oclif"]
---

> **Branch:** workspaces/tinybots
> **Last Commit:** 114ae5b
> **Last Updated:** Fri Feb 27 09:31:44 2026 +0000

## TL;DR

Thay thế curl commands bằng structured CLI tool cho Bitbucket PR operations trong TinyBots domain. Plugin gọi trực tiếp Bitbucket API, auto-fetches tất cả pages cho paginated endpoints, và trả về `MCPResponse` JSON format nhất quán với toàn bộ `aw` commands.

## Repo Purpose & Bounded Context

- **Role:** Domain-specific CLI extension cho Bitbucket PR workflows — get PR info, list comments, list tasks
- **Domain:** `devtools/tinybots` — chỉ dành cho TinyBots workspace. Pattern cho future domain-specific tools: `workspaces/devtools/<domain>/cli-plugin-<name>/`

## Project Structure

```
workspaces/devtools/tinybots/cli-plugin-bitbucket/
├── package.json                    # @aweave/cli-plugin-tinybots-bitbucket
├── tsconfig.json
└── src/
    ├── index.ts                    # (empty — oclif auto-discovers commands)
    ├── commands/
    │   └── tinybots-bitbucket/
    │       ├── pr.ts               # Get PR details
    │       ├── comments.ts         # List comments (auto-paginate)
    │       └── tasks.ts            # List tasks (auto-paginate)
    └── lib/
        ├── client.ts               # BitbucketClient (HTTPClient wrapper)
        └── models.ts               # PullRequest, PRComment, PRTask, parsers
```

## Public Surface (Inbound)

- **`aw tinybots-bitbucket pr <repo> <pr_id>`:** Get PR details (title, description, author, branches, state)
- **`aw tinybots-bitbucket comments <repo> <pr_id>`:** List all PR comments — auto-pagination, supports inline comments với file path + line
- **`aw tinybots-bitbucket tasks <repo> <pr_id>`:** List all PR tasks với state (`RESOLVED` / `UNRESOLVED`)

**Common flags:**

- `--workspace` (default: `tinybots`) — Bitbucket workspace slug
- `--format` (`json` | `markdown`, default: `json`) — output format
- `--max` (default: `500`) — giới hạn số items fetch (comments/tasks only)

## Core Services & Logic (Internal)

- **`BitbucketClient` (`lib/client.ts`):** Wrapper quanh `@aweave/cli-shared` `HTTPClient`. Xử lý Basic Auth (`BITBUCKET_USER` + `BITBUCKET_APP_PASSWORD`), auto-pagination (`response.next`), và trả về `MCPResponse`
- **Models (`lib/models.ts`):** Parse raw Bitbucket API responses thành typed objects: `PullRequest`, `PRComment` (có `file_path`/`line` cho inline comments), `PRTask`, `BitbucketUser`

**Auto-pagination flow:**

```
Page 1: GET /pullrequests/{id}/comments?pagelen=100
Page 2: GET {response.next}
... until no more pages or --max reached
→ Aggregate all items → MCPResponse với total_count
```

## External Dependencies & Contracts (Outbound)

- **External APIs:** Bitbucket REST API v2.0 (`https://api.bitbucket.org/2.0`) — Basic Auth via `BITBUCKET_USER` + `BITBUCKET_APP_PASSWORD` env vars
- **Internal packages:** `@aweave/cli-shared` (MCPResponse, HTTPClient, output helper, createPaginatedResponse), `@oclif/core` (Command, Flags, Args)
