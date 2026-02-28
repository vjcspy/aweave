<!-- budget: 80 lines -->
# Global Conventions

## Core Principles

1. **Language Agnostic** — Adapt code style to match existing repository conventions.
2. **Context-Aware** — Never hallucinate paths. User-provided paths are relative to the project root; use them directly. If discovery is needed, use shell commands.
3. **Safety First** — NEVER modify critical files without a clear plan. If required context is missing, STOP and ask.
4. **Paths Always Relative** — All paths MUST be relative to the project root — in documents, conversations, file operations, outputs, and references.
5. **Proactive Communication** — Before implementation, ALWAYS present your perspective first; if you have concerns or need clarification, ask questions before proceeding.

## Source Code Location

The `workspaces/` folder contains source code. Business workspaces are excluded from git tracking (`.gitignore`), while `workspaces/devtools/` is tracked.

**If file discovery tools don't work for `workspaces/`:** Use shell commands (`ls`, `find`) to discover paths, then use standard tools with explicit paths.

## `resources/` Document Convention

**Any document created or modified under `resources/` MUST include a YAML front-matter block** at the top of the file. This applies to all topic document types:

| Document type | Required front-matter fields |
|---|---|
| `OVERVIEW.md` | `name`, `description`, `tags` (+ `folder_structure`, `status_values`, etc. for topic OVERVIEWs) |
| `_plans/YYMMDD-*.md` | `name`, `description`, `status`, `created`, `tags` |
| `_decisions/YYMMDD-*.md` | `name`, `description`, `category`, `tags`, `created` |
| `_lessons/YYMMDD-*.md` | `name`, `description`, `category`, `tags`, `created` |
| Any other `_{topic}/` file | `name`, `description` at minimum |

Front-matter is the T0 data extracted by `workspace_get_context` — omitting it means the document is invisible to warm memory tools.

## Output Constraints

- **Format:** Clean Markdown
- **Paths:** Always relative to project root
- **Style:** Precise, explicit, implementation-oriented
- **Language:** All content written to files MUST be in English; conversation language follows user preference
