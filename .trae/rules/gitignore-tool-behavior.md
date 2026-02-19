---
description: Tool behavior when `projects/` is gitignored (multi-project workspace)
alwaysApply: true
---

`projects/**` is ignored in `.gitignore` (except `projects/.gitkeep`). Some Trae tools may therefore miss code in `projects/` even though it exists on disk.

## What to trust in `projects/`

| Capability | Reliable? | Notes |
|---|---:|---|
| Read a file by explicit path | Yes | Prefer when user provides a path |
| Glob (file discovery) | Usually | Keep patterns narrow; avoid matching `node_modules/` trees |
| Directory listing (LS tool) | No | May show only `projects/.gitkeep` (false-negative) |
| Semantic/codebase search | No | Index excludes gitignored folders |
| Grep (content search) from `projects/` root | No | Frequently returns empty due to gitignore |
| Grep (content search) inside a repo subdir | Usually | Works when path is the repo itself (often nested git repo) |

## Operating rules

- If the user provides a path under `projects/`, read it directly. Do not “verify existence” via index-based search.
- If you must discover files, use narrow globs like `projects/<project>/<domain>/<repo>/src/**/*.ts` or `projects/<project>/**/package.json`. Avoid `projects/**` and avoid globbing that walks `node_modules/`.
- Never use the LS tool to determine what exists under `projects/`. If you need a directory listing, use the default shell (`ls`) instead.
- Avoid index-based tools for `projects/` (semantic/codebase search). Prefer “glob + read”, or default shell for discovery/search.
- For content search, prefer:
  - Grep scoped to a specific repo directory under `projects/` (not `projects/` root), or
  - Default shell `rg --no-ignore ...` when you must search broadly.
- If you must search content broadly, prefer default shell (filesystem search). Example:

```bash
rg --no-ignore --hidden -g '!**/.git/**' -g '!**/node_modules/**' <pattern> projects/
```

## Quick decision guide

- Need to confirm a file exists under `projects/` → use `glob` or default shell (`test -f`), not LS.
- Need to list directories under `projects/` → default shell (`ls`), not LS.
- Need to find where a symbol/string is used under `projects/` →
  - `glob` to find the repo dir(s),
  - Grep inside each repo dir,
  - fallback to default shell `rg --no-ignore ...`,
  - then `read` the exact hits.

## Recommended patterns (copy/paste)

### File discovery (glob)

- Find repo roots (top-level) without walking `node_modules/`:

  - `projects/*/*` (if you keep a consistent 2-level layout)
  - `projects/*/*/*` (if you keep a consistent 3-level layout)

- Find common project manifests (prefer constrained prefixes):

  - `projects/*/**/package.json`
  - `projects/*/**/Cargo.toml`
  - `projects/*/**/pyproject.toml`
  - `projects/*/**/go.mod`

### Content search (shell rg)

- Broad search under `projects/` while bypassing `.gitignore` and excluding common heavy dirs:

```bash
rg --no-ignore --hidden \
  -g '!**/.git/**' \
  -g '!**/node_modules/**' \
  -g '!**/dist/**' \
  -g '!**/build/**' \
  -g '!**/.next/**' \
  -g '!**/.turbo/**' \
  -g '!**/coverage/**' \
  '<pattern>' projects/
```

- Narrow search inside a specific repo (prefer this when you already know the repo path):

```bash
rg --no-ignore --hidden \
  -g '!**/.git/**' \
  -g '!**/node_modules/**' \
  '<pattern>' projects/<repo-path>/
```

- Find a symbol usage across TypeScript only (example):

```bash
rg --no-ignore --hidden \
  -g '!**/.git/**' \
  -g '!**/node_modules/**' \
  -g '*.ts' -g '*.tsx' \
  '<pattern>' projects/
```

## Heuristic: detect “hidden by .gitignore”

If glob finds files under `projects/` but listing/search returns nothing, assume `.gitignore`/index exclusion and switch to “glob + read” and/or default shell.
