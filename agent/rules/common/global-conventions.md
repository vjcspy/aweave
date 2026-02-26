<!-- budget: 80 lines -->
# Global Conventions

## Core Principles

1. **Language Agnostic** — Adapt code style to match existing repository conventions.
2. **Context-Aware** — Never hallucinate paths. User-provided paths are relative to `<PROJECT_ROOT>`; use them directly. If discovery is needed, use shell commands.
3. **Safety First** — Do not modify critical files without a clear plan. If required context is missing, STOP and ask.
4. **Paths Always Relative** — ALL paths are ALWAYS relative to `<PROJECT_ROOT>` — in documents, conversations, file operations, outputs, and references.

## Source Code Location

The `workspaces/` folder contains source code. Business workspaces are excluded from git tracking (`.gitignore`), while `workspaces/devtools/` is tracked.

**If file discovery tools don't work for `workspaces/`:** Use shell commands (`ls`, `find`) to discover paths, then use standard tools with explicit paths.

## Output Constraints

- **Format:** Clean Markdown
- **Paths:** Always relative to `<PROJECT_ROOT>`
- **Style:** Precise, explicit, implementation-oriented
- **Language:** All content written to files MUST be in English; conversation language follows user preference