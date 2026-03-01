# Long-term Memory

## 1. Objective

Long-term memory for AI agents — not just one agent but for each agent that works within the workspace ecosystem.

**Per sub-agent (Phase 2):**

- Know what it is currently doing
- Know what it has done

**Per workspace scope (Phase 1):**

- What has been done? (work history via plans)
- What mistakes were made? (lessons learned)
- What important decisions were made that must be respected? (decisions)
- What experiences/skills were gained? → `CAS`/`APM` will provide a way for agents to create and self-save new skills (
  organized by workspace)

## 2. Key Decisions

### 2.1 Build custom vs. external tools (OMEGA, Mem0, etc.)

**Decision:** Build custom MCP tools tailored to the workspace structure.

**Rationale:**

- External platforms provide less of what we need but more than necessary — they don't fit the specific requirements
- Custom filtering requirements: beyond category, we need tag-based filtering. Data includes `_meta` fields (
  `document_path`) returned on retrieval but NOT included in search
- All data already exists in the workspace filesystem, organized by workspace/domain/repo. Only need to build retrieval
  tools on top of existing structure
- Data is already optimized for workspace-scoped access — when an AI agent (or human) works with a workspace, they only
  care about data within that workspace
- `resources/` data lives in git → scope-based query already provides sufficient context. `user/memory/` is local
  workspace-scoped data (gitignored, see §2.13)
- External memory servers are more suitable for cross-workspace / general-purpose scenarios (e.g., orchestrator
  assistant) — deferred to Phase 2

**When to reconsider:** If the workspace grows to a scale where file-based aggregation becomes slow, or when
cross-workspace semantic search becomes a concrete need. Phase 2 may introduce a custom-built centralized memory
platform for orchestrator use.

### 2.2 File-based memory vs. database

**Decision:** File-based (markdown + YAML front-matter).

**Rationale:**

- Simplicity — no additional infrastructure (no vector DB, no graph DB)
- Human-readable and human-editable
- AI agents already have tools to read/write files
- Workspace structure IS the index — no separate indexing needed

**Git tracking:** Both `resources/` and `user/memory/workspaces/{W}/` are git-tracked per workspace branch. Git provides
versioning, diff, and conflict resolution for all memory data. See §2.13 for `user/memory/` branching model.

### 2.3 Write path: direct file access

**Decision:** All knowledge (plans, OVERVIEWs, features, decisions, lessons) lives in `resources/`. AI agents write
directly to local files.

**Rationale:**

- All data follows the same pattern: `_{topicName}/YYMMDD-name.md` with front-matter
- Direct file edit is simpler and more flexible — no tool abstraction layer needed
- Decisions and lessons are just another topic type, same as plans or architecture docs
- No `user/memory/` directory, no `_index.yaml`, no `workspace_save_memory` tool — significantly simpler architecture
- `resources/` is already git-tracked — no special `.gitignore` gymnastics needed

### 2.4 No separate abstract summary files

**Decision:** Remove abstract summary file as a standalone file type. T0 (abstract) data is stored in YAML front-matter
of OVERVIEW.md files instead.

**Rationale:**

- MCP tools already extract T0 data from front-matter — a separate file is redundant
- Reduces file count and maintenance burden
- Single source of truth: OVERVIEW.md contains both T0 (front-matter) and T1 (body content)
- Plans already use front-matter for T0 — this makes OVERVIEW.md consistent with that pattern

### 2.5 Phase strategy

| Phase   | Scope                          | Focus                                                                                            |
|---------|--------------------------------|--------------------------------------------------------------------------------------------------|
| Phase 1 | Workspace-scoped memory        | Hot memory (cursor rules), warm memory (MCP read tools), write path (rules + direct file access) |
| Phase 2 | Cross-workspace + orchestrator | Centralized memory platform, sub-agent communication, semantic search, integration with CAS/APM  |

### 2.6 Tool consolidation: Single retrieval tool

**Decision:** Consolidate all retrieval into one tool: `workspace_get_context`.

**Rationale:**

- Multiple separate tools = multiple round trips. AI must wait for each response before deciding next action — wasteful
  in latency and token cost
- From AI agent's perspective, it just needs "context to work with" — all data comes from `resources/`
- One tool with `topics[]` parameter gives AI flexibility to request exactly what it needs in a single call
- Default response (no topics) provides structural overview — AI can then make informed decisions about what else to
  load
- Topics are auto-discovered from `_{topicName}/` folders — adding a new topic requires no code changes

### 2.7 Naming: `topics` vs `category`

**Decision:** Use `topics` for retrieval parameter (what data types to get), `category` for entry classification within
saved items.

**Rationale:**

- `topics` = "what do I want to know about" — fits retrieval semantics (plans, features, architecture, decisions,
  lessons)
- `category` = "how is this entry classified" — fits write/classification semantics (architecture, debugging,
  configuration)
- Clear separation prevents confusion: `topics` is a tool parameter for selecting data types, `category` is a data field
  inside individual entries

### 2.8 `workspace_` prefix

**Decision:** Workspace memory tools use `workspace_` prefix (e.g., `workspace_get_context`).

**Rationale:**

- Phase 1 = workspace-scoped memory. All context comes from the local workspace filesystem — tools simply provide
  structured retrieval and aggregation on top of existing file structure
- Phase 2 will introduce centralized cross-workspace memory with separate namespace
- Prefix creates clear namespace: `workspace_*` = local workspace data, future `memory_*` = centralized
- Prevents naming conflicts when both systems coexist

### 2.9 Optional workspace context loading

**Decision:** Remove mandatory workspace context loading ceremony from the main workflow (AGENTS.md). AI agent decides
autonomously when to load context based on task requirements.

**Rationale:**

- Many tasks don't need workspace context (Docker fixes, general questions, simple code changes with file path already
  provided)
- Mandatory loading wastes tokens and time for 40%+ of conversations
- AI can determine need based on simple heuristics (path patterns, domain mentions)
- When AI does load context, `workspace_get_context` defaults provide enough orientation

**Action required:** Rewrite `AGENTS.md` / `workspace-workflow.md` to remove 6-step ceremony. Replace with lightweight
guidance on when to call `workspace_get_context`. See §4.6.

### 2.10 ~~Memory metadata index~~ — REMOVED

**Decision:** Removed. No `_index.yaml` metadata index.

**Rationale:** With decisions/lessons moved to `resources/` as individual files with front-matter (same pattern as
plans), the metadata index is unnecessary. Workspace context scanners already extract front-matter (and full body for
decisions/lessons topic requests) directly from files. The folder structure IS the index.

### 2.11 Plan status updates — direct edit

**Decision:** Plan status changes are done via direct file edit (StrReplace on front-matter), not through any MCP tool.
Same applies to all files in `resources/` — AI agents edit them directly.

**Rationale:**

- Plans live in `resources/` — all edits to `resources/` files are direct, no tool abstraction
- Status update = simple front-matter field change, no complex logic needed
- `workspace_save_memory` is focused on `user/memory/` (experiential knowledge) only — mixing in plan state management
  would conflate concerns

### 2.12 Cold memory — no separate infrastructure

**Decision:** No separate cold memory infrastructure in Phase 1. Cold memory = raw data in `resources/` and
`agent-transcripts/` that warm tools haven't surfaced.

**Rationale:**

- Warm tools return `_meta.document_path` → AI reads file directly for T2 detail
- For unsurfaced context, AI searches `resources/workspaces/{scope}/` using Grep/SemanticSearch
- Workspace file structure IS the index — no additional infrastructure needed
- `agent-transcripts/` kept as archive; search/index deferred to Phase 2

### 2.13 ~~`user/memory/` persistence model~~ — REMOVED

**Decision:** Removed. `user/memory/` directory eliminated entirely.

**Rationale:** Decisions and lessons moved to `resources/workspaces/{scope}/_decisions/` and `_lessons/` respectively.
They follow the same `_{topicName}/YYMMDD-name.md` pattern as plans and other topics. All data lives in `resources/`,
which is already git-tracked per workspace branch. No special `.gitignore` exceptions needed.

### 2.14 APM integrated into NestJS server

**Decision:** APM (Agent Provider MCP) is integrated into `@hod/aweave-server` (NestJS), not a standalone process.
Single server handles HTTP REST + SSE/MCP on one port.

**Rationale:**

- Single process = simpler ops. One `aw server start`, one port (3456), one log stream
- Session tracking for `include_defaults` optimization lives naturally in NestJS middleware — no cross-process
  communication needed
- Existing infrastructure (pino logging, SQLite config store, bearer token auth) reused directly
- Follows existing pattern: server already serves REST + WebSocket + static SPA. Adding MCP/SSE is another transport on
  the same process
- NestJS ecosystem has MCP integration options (e.g., `@rekog/mcp-nest`) if useful, but can also implement directly with
  MCP SDK

### 2.15 Multi-layer architecture for workspace memory tools

**Decision:** Workspace memory tools are built as 4 conceptual layers across 4 packages. Core business logic is a
standalone package; MCP tool definitions are a shared package consumed by both NestJS and CLI; NestJS and CLI add their
transport concerns.

**Rationale:**

- Core logic (filesystem scanning, front-matter parsing, `_index.yaml` maintenance) must be reusable across all access
  methods
- CLI needs direct filesystem access without server dependency (workspace memory is local data — no shared state
  requiring a server intermediary)
- NestJS provides REST API for web UIs, session tracking for `include_defaults`, pino logging, SQLite stats
- MCP tools (inside NestJS/APM) provide AI agent access via SSE transport
- Consistent with DevTools pattern: `debate-machine` (core) → `nestjs-debate` (NestJS) → `cli-plugin-debate` (CLI)

**Package structure:**

| Layer      | Package                               | Path                              | Imports                                               |
|------------|---------------------------------------|-----------------------------------|-------------------------------------------------------|
| **Core**   | `@hod/aweave-workspace-memory`        | `common/workspace-memory/`        | `yaml`, `fast-glob`                                   |
| **MCP**    | `@hod/aweave-mcp-workspace-memory`    | `common/mcp-workspace-memory/`    | core + `@modelcontextprotocol/sdk`                    |
| **NestJS** | `@hod/aweave-nestjs-workspace-memory` | `common/nestjs-workspace-memory/` | core + MCP + NestJS + `@hod/aweave-nestjs-core`       |
| **CLI**    | `@hod/aweave-plugin-workspace`        | `common/cli-plugin-workspace/`    | core + MCP + `@hod/aweave-cli-shared` + `@oclif/core` |

**Key differences from original plan:** MCP tool definitions are a standalone shared package (not embedded in NestJS).
Both NestJS and CLI consume the MCP package for tool schema and handlers, then add their own transport (SSE and STDIO
respectively). CLI calls core directly (not via HTTP → NestJS) — workspace memory is local filesystem, no shared state
requires a server intermediary.

### 2.16 `include_defaults` dual mechanism

**Decision:** Keep `include_defaults` as client param AND implement server-side per-session tracking. When both signals
are available, server logs divergence for data-driven optimization.

**Rationale:**

- Client param (`include_defaults`): explicit, stateless, portable across transports. AI agent controls when to skip
  defaults.
- Server session tracking: NestJS middleware detects per-session whether defaults have been sent. Leverages existing
  infra (pino for logging, SQLite for stats).
- **Divergence logging:** When agent sends `include_defaults: true` but server detects this is a repeat call in the same
  session → log warning via pino, increment `defaults_redundant_count` in SQLite.
- **Decision point:** When ratio `redundant / total` consistently >90% over time → data proves AI agents always handle
  correctly → can deprecate `include_defaults` in favor of server-only session tracking + `refresh: bool?` for explicit
  re-fetch.

## 3. Architecture

### 3.1 Memory Classification

Memory is classified along two orthogonal axes:

**Axis 1: Layer (loading strategy) — WHEN to load**

| Layer | Name        | Loading                         | Description                                                                                                    |
|-------|-------------|---------------------------------|----------------------------------------------------------------------------------------------------------------|
| L1    | Hot Memory  | Auto-loaded, always available   | Injected into every conversation via cursor rules / agent rules. Low token budget (<100 lines per file).       |
| L2    | Warm Memory | Loaded on demand via MCP tools  | Scope-aware retrieval. AI agent calls tools when it needs context about a specific workspace/domain/repo.      |
| L3    | Cold Memory | Searched when explicitly needed | Raw files in workspace. AI reads directly via file path or searches with keywords. No separate infrastructure. |

**Axis 2: Tier (context size) — HOW MUCH to load**

| Tier | Name     | Size           | Use case                                                                                                                      |
|------|----------|----------------|-------------------------------------------------------------------------------------------------------------------------------|
| T0   | Abstract | 100-200 tokens | Quick orientation. Extracted from YAML front-matter of OVERVIEW.md and plan files. No separate abstract summary files needed. |
| T1   | Overview | 1-2 pages      | Working context. Enough to make decisions.                                                                                    |
| T2   | Detail   | Full document  | Deep dive. Implementation reference.                                                                                          |

**How they combine:** Warm defaults return scoped T1 (`scope_overview_t1`) plus T0 orientation (`overviews`,
`decisions_t0`, `lessons_t0`). Topic queries return per-topic T1 (`overview_t1`); `decisions` and `lessons` entries
include full `body_t1`, while other topics stay lightweight.

### 3.2 Data Topology

```text
<PROJECT_ROOT>/
├── agent/rules/common/                    # L1 Hot Memory (source of truth)
│   ├── user-profile.md                    # Who you are, preferences, coding style
│   ├── global-conventions.md              # Cross-cutting decisions, patterns
│   ├── context-memory-rule.md             # How/when to use workspace memory tools
│   └── workspace-workflow.md              # How to work with workspaces
│
├── .cursor/rules/                         # L1 Hot Memory (symlink for Cursor)
│   ├── gitignore-tool-behavior.mdc        # Cursor-specific (stays in git)
│   └── (symlinks to agent/rules/common/)
│
├── .codex/                                # L1 Hot Memory (symlink for Codex)
│   └── (symlinks to agent/rules/common/)
│
├── resources/workspaces/{W}/{D}/{R}/      # L2 Warm Memory (workspace context)
│   ├── OVERVIEW.md                        # T0 (front-matter) + T1 (full content)
│   ├── _plans/                            # T0 (front-matter) + T2 (full doc)
│   │   └── YYMMDD-plan-name.md
│   ├── _features/                         # T1/T2 (special structure)
│   ├── _spikes/                           # T1/T2
│   ├── _architecture/                     # T1/T2
│   ├── _decisions/                        # T0 (front-matter) + T1/T2 (ADR-lite)
│   │   └── YYMMDD-decision-name.md
│   └── _lessons/                          # T0 (front-matter) + T1/T2 (gotchas, patterns)
│       └── YYMMDD-lesson-name.md
│
└── agent-transcripts/                     # L3 Cold Memory (archive)
    └── *.jsonl                            # Raw conversation logs
```

## 4. Phase 1: Workspace-scoped Memory

### 4.1 Hot Memory (Layer 1) — Auto-loaded

**What:** Critical context that every conversation needs, regardless of task.

**Implementation:**

- Source of truth: `agent/rules/common/`
- Each AI agent tool gets symlinks to the relevant files:
    - Cursor: `.cursor/rules/` (symlinks + cursor-specific files)
    - Codex: `.codex/` (symlinks)
    - Others: as needed

**Files:**

| File                     | Purpose                                              | Budget     |
|--------------------------|------------------------------------------------------|------------|
| `user-profile.md`        | Identity, preferences, coding style                  | <50 lines  |
| `global-conventions.md`  | Cross-cutting decisions, naming, patterns            | <80 lines  |
| `context-memory-rule.md` | How/when to use workspace memory tools, when to save | <80 lines  |
| `workspace-workflow.md`  | How to detect workspace, load context, execute tasks | <100 lines |

**Replaces:** The current monolithic `AGENTS.md` (160 lines, 6-step ceremony). New approach: split by concern,
auto-loaded, no manual confirmation needed for standard tasks.

**Token budget management:**

- **Total budget: ~500 lines / ~5000 tokens** across all hot memory files (including agent-specific rules like
  `gitignore-tool-behavior.mdc`)
- **Content criteria:** Only include items needed in >80% of conversations. Workspace-specific knowledge belongs in warm
  memory, not hot.
- **Promotion/demotion:** When hot memory is full and a new critical item needs to be added, review existing items and
  demote the least-universal one to warm memory (`user/memory/` or `resources/`).
- **Quarterly review:** Human reviews all hot memory files to prune stale entries and consolidate similar ones.
- **Each file declares its budget** in a comment at the top (e.g., `<!-- budget: 50 lines -->`). Approaching the limit
  signals time to review.

### 4.2 Warm Memory — Read Path (Layer 2)

#### 4.2.1 Tool Design

All warm memory retrieval is handled by a single tool: `workspace_get_context`. Available via 3 access layers (see
§2.15):

- **MCP** (AI agents): `workspace_get_context` tool via APM, integrated in `@hod/aweave-server` (§2.14)
- **CLI** (terminal): `aw workspace get-context --workspace <W> [--topics plans,features]`
- **REST** (web/services): `GET /workspace/context?workspace=<W>&topics=plans,features`

All layers delegate to core package `@hod/aweave-workspace-memory` for business logic. Each call accepts scope
parameters plus optional topics, and returns structured data with metadata.

**Common scope parameters:**

```yaml
scope:
  workspace: string       # required (e.g., "devtools", "k")
  domain: string?         # optional (e.g., "common", "stock")
  repository: string?     # optional (e.g., "metan", "workflow-engine")
```

Scope resolution: if only `workspace` is passed, tool aggregates across all domains/repos in that workspace. Adding
`domain` narrows to that domain. Adding `repository` narrows to that specific repo.

**Common response metadata:** Most returned entries include `_meta` fields that are NOT searchable but provide context
for follow-up:

```yaml
_meta:
  document_path: string    # relative path to source document
```

> **Note:** `workspace_get_context` responses use `_meta.document_path` only.

---

#### 4.2.2 Tool: `workspace_get_context`

**Purpose:** Single entry point for all workspace context retrieval — structural overview, plans, features,
architecture, decisions, lessons, and memory metadata.

**Parameters:**

```yaml
scope: { workspace, domain?, repository? }
topics: string[]?        # ["plans", "features", "architecture", "overview", "decisions", "lessons"]
include_defaults: bool?  # default: true — set false on follow-up calls to save tokens
filters:
  status: string[]?      # for plans: ["done", "in_progress"]
  tags: string[]?        # for any topic
  category: string?      # for decisions/lessons: "architecture", "debugging", etc.
```

> **No pagination/limit/sort params:** Response size optimization is handled internally by the tool implementation, not
> exposed as parameters. The tool owner controls what data is returned and how to keep it efficient. AI agents use
`scope`
> to narrow results.

**Default response (no topics, `include_defaults: true`):**

Always returned to give AI structural orientation without needing to decide what to ask for:

1. **Scope Overview (T1)** full markdown body of `OVERVIEW.md` at the requested base scope
2. **Folder structure** of `resources/workspaces/{scope}/` as directory-only tree (no files listed)
3. **Overviews (T0)** (front-matter: name, description, plus newly added topic fields like folder_structure,
   status_values, etc.) of all OVERVIEW.md files within scope, returned as `defaults.overviews`
4. **Learning summaries (T0)** for `defaults.decisions_t0` and `defaults.lessons_t0`, aggregated by scope ladder:
    - workspace scope query → workspace level only
    - domain scope query → workspace + domain levels
    - repository scope query → workspace + domain + repository levels
5. **Loaded skills** from `.aweave/loaded-skills.yaml` — name, description, skill_path for each active skill. AI agents
   use this to decide which skills to load for the current task without needing a separate file read.

> **Design note (subject to change):** Defaults currently include scope overview + directory tree + overviews + learning
> T0 + loaded skills. If we find that AI consistently needs additional default data (e.g., recent plans), we may add
> more
> to defaults later.

**`include_defaults` dual mechanism:** Both client param AND server-side session tracking are active (see §2.16). Client
controls explicitly; server logs divergence (e.g., agent sends `true` but server knows defaults were already sent this
session). Data collected via pino + SQLite informs whether to simplify to server-only tracking later.

**Topic-specific data (when topics are specified):**

| Topic            | Source                                          | Returns (`{ overview_t1, entries }`)                                         |
|------------------|-------------------------------------------------|------------------------------------------------------------------------------|
| `"overview"`     | `resources/workspaces/{scope}/OVERVIEW.md`      | T1 full content of OVERVIEW at current scope level (no entries)              |
| `"plans"`        | `resources/workspaces/{scope}/*/_plans/`        | `overview_t1` + Array of T0 front-matter of all plans                        |
| `"features"`     | `resources/workspaces/{scope}/*/_features/`     | `overview_t1` + Array of T0 listing of features                              |
| `"architecture"` | `resources/workspaces/{scope}/*/_architecture/` | `overview_t1` + Array of T0/T1 listing of architecture docs                  |
| `"decisions"`    | `resources/workspaces/{scope}/**/_decisions/`   | `overview_t1` + Array of entries with front-matter + full `body_t1` per file |
| `"lessons"`      | `resources/workspaces/{scope}/**/_lessons/`     | `overview_t1` + Array of entries with front-matter + full `body_t1` per file |
| `"{any_topic}"`  | `resources/workspaces/{scope}/**/_{topicName}/` | Generic scan returning shape with `overview_t1` plus array of entries        |

`overview_t1` for a topic is resolved deterministically from the nearest scope `_{topicName}/OVERVIEW.md`, then falls
back up the scope tree.

**`include_defaults: false`:** Skips all default payload (`scope_overview_t1`, `folder_structure`, `overviews`,
`decisions_t0`, `lessons_t0`, `loaded_skills`). Use on follow-up calls within the same conversation to save tokens.

**Response example:**

```yaml
defaults:
  scope_overview_t1: |
    # DevTools
    Shared development tools and infrastructure...

  folder_structure: |
    resources/workspaces/devtools/
    ├── common/
    │   ├── _architecture/
    │   ├── _features/
    │   ├── _plans/
    │   ├── cli-plugin-debate/
    │   └── cli-plugin-server/
    └── ...

  overviews:
    - scope: "devtools"
      name: "DevTools"
      description: "Shared development tools and infrastructure"
      tags: [ devtools, infrastructure ]
      _meta:
        document_path: "resources/workspaces/devtools/OVERVIEW.md"

    - scope: "devtools/common"
      name: "DevTools Common"
      description: "Shared tools and utilities across all domains"
      tags: [ cli, shared ]
      folder_structure: "_plans/ is flat with YYMMDD-kebab-case.md"
      status_values: [ new, in_progress, partial, done, abandoned ]
      category_values: [ ]
      tag_values: [ memory, refactor, migration ]
      _meta:
        document_path: "resources/workspaces/devtools/common/OVERVIEW.md"

  decisions_t0:
    - name: "Adopt Single Server Runtime"
      description: "Run REST and MCP in the same NestJS process."
      tags: [ server, mcp, architecture ]
      category: architecture
      created: "2026-02-14"
      path: "resources/workspaces/devtools/_decisions/260214-single-server-runtime.md"
      _meta:
        document_path: "resources/workspaces/devtools/_decisions/260214-single-server-runtime.md"

  lessons_t0:
    - name: "Avoid Topic Drift In Rules"
      description: "Keep context-memory rule wording aligned with tool contract changes."
      tags: [ rules, memory ]
      category: process
      created: "2026-02-28"
      path: "resources/workspaces/devtools/common/_lessons/260228-avoid-topic-drift-in-rules.md"
      _meta:
        document_path: "resources/workspaces/devtools/common/_lessons/260228-avoid-topic-drift-in-rules.md"

  loaded_skills:
    - name: "devtools-cli-builder"
      description: "Guide for building oclif CLI plugins and NestJS backend modules"
      skill_path: "agent/skills/common/devtools-cli-builder/SKILL.md"
    - name: "devtools-nestjs-builder"
      description: "Guide for building NestJS backend modules and serving React SPAs"
      skill_path: "agent/skills/common/devtools-nestjs-builder/SKILL.md"

plans:
  overview_t1: |
    # Plans Topic (`_plans`)
    This topic stores implementation plans...
  entries:
    - name: "Workflow Engine"
      description: "Build a workflow execution engine for sequential and parallel task graphs"
      status: done
      created: "2026-02-08"
      tags: [ workflow, engine, xstate ]
      _meta:
        document_path: "resources/workspaces/devtools/common/_plans/260208-workflow-engine.md"

    - name: "SPA Self-Serve from Feature Modules"
      description: "Eliminate per-SPA boilerplate in server package"
      status: in_progress
      created: "2026-02-23"
      tags: [ nestjs, spa, architecture ]
      _meta:
        document_path: "resources/workspaces/devtools/common/_plans/260223-spa-self-serve.md"

decisions:
  overview_t1: |
    # Decisions Topic (`_decisions`)
    This topic stores architectural and process decisions.
  entries:
    - name: "Adopt Single Server Runtime"
      description: "Run REST and MCP in the same NestJS process."
      category: architecture
      created: "2026-02-14"
      path: "resources/workspaces/devtools/_decisions/260214-single-server-runtime.md"
      body_t1: |
        ## Context
        ...
        ## Decision
        ...
      _meta:
        document_path: "resources/workspaces/devtools/_decisions/260214-single-server-runtime.md"
```

### 4.3 Warm Memory — Write Path

#### 4.3.1 Direct file write (no tool needed)

Decisions and lessons are written directly as files in `resources/`, following the same `_{topicName}/YYMMDD-name.md`
pattern as plans. AI agents use native file write tools (Write, StrReplace). No MCP write tool needed.

**File locations:**

- Decisions: `resources/workspaces/{scope}/_decisions/YYMMDD-decision-name.md`
- Lessons: `resources/workspaces/{scope}/_lessons/YYMMDD-lesson-name.md`

**File format:** Same as plans — YAML front-matter with `name`, `description`, `tags`, `category`, followed by markdown
body content. See §4.5.

#### 4.3.2 Learning cycle triggers

Rules encoded in hot memory (`context-memory-rule.md`) that instruct AI agents to detect moments worth saving:

| Trigger                  | Condition                                                  | Action                                                     |
|--------------------------|------------------------------------------------------------|------------------------------------------------------------|
| **Hard-won fix**         | AI fixes a bug after multiple failed attempts              | Create lesson file (root cause + solution)                 |
| **Non-obvious solution** | Solution required knowledge not in any existing docs       | Create lesson file                                         |
| **Conflict detection**   | AI reads existing entry that contradicts current reality   | Prompt user to update or archive the outdated entry        |
| **Decision moment**      | AI makes (or user confirms) an architectural/design choice | Create decision file with rationale                        |
| **End of session**       | Conversation is wrapping up                                | Determine what's worth saving, write files, report summary |

**Execution model (Phase 1):** Main agent writes files directly. This retains full conversation context. A sub-agent
approach (delegating via Task tool) would lose conversation history — reconsider in Phase 2 when orchestrator
architecture is in place.

### 4.4 Cold Memory (Layer 3)

Cold memory is raw data within the workspace that warm tools haven't surfaced. In Phase 1, there is no separate cold
memory infrastructure.

**What it includes:**

- Full document content in `resources/` (T2 detail beyond what warm tools summarize)
- Raw conversation transcripts in `agent-transcripts/` (JSONL files)

**Access pattern:**

- When warm tools return `_meta.document_path` → AI reads file directly using Read tool for T2 detail
- When AI needs context not returned by warm tools → AI searches `resources/workspaces/{scope}/` using
  Grep/SemanticSearch with relevant keywords
- The workspace file structure serves as the index — no additional infrastructure needed

**Rule guidance:** The `context-memory-rule.md` (hot memory) instructs AI agents on when and how to search cold memory
effectively. See §4.6.

**Future (Phase 2):** Transcript summarization, indexing, and semantic search for cross-workspace knowledge extraction.

### 4.5 Data Format Specifications

#### OVERVIEW.md front-matter standard

All `OVERVIEW.md` files MUST include:

```yaml
---
name: string                # Scope name (e.g., "DevTools Common")
description: string         # 1-2 sentence abstract — this IS the T0 summary
tags: string[]              # For filtering (optional)
updated: YYYY-MM-DD        # Last meaningful update (optional)

# For Topic Overviews (_{topicName}/OVERVIEW.md) ONLY:
folder_structure: string    # Required for topics (description of file/folder layout)
status_values: string[]     # Optional for topics (enum of valid statuses)
category_values: string[]   # Optional for topics (enum of valid categories)
tag_values: string[]        # Optional for topics (enum of common tags)
---
```

The `description` field replaces the need for a separate abstract summary file. MCP tools extract this field for T0
responses.

#### Plan front-matter standard

All plan files (`_plans/YYMMDD-plan-name.md`) MUST include:

```yaml
---
name: string                # Human-readable plan name
description: string         # 1-2 sentence summary
status: new | in_progress | partial | done | abandoned
created: YYYY-MM-DD        # When the plan was created
updated: YYYY-MM-DD        # When status last changed (optional)
tags: string[]              # For filtering (optional)
---
```

**Status values:**

| Status        | Meaning                                   |
|---------------|-------------------------------------------|
| `new`         | Plan created, work not yet started        |
| `in_progress` | Actively being worked on                  |
| `partial`     | Some parts done, some remaining           |
| `done`        | Fully implemented                         |
| `abandoned`   | Decided not to proceed (kept for context) |

#### Decision file format

Each decision is a separate file in `_decisions/YYMMDD-decision-name.md`:

```yaml
---
name: string                # Decision title
description: string         # 1-2 sentence summary
category: string?           # architecture | tooling | convention | dependency | ...
tags: string[]?             # For filtering
created: YYYY-MM-DD
---
```

Body: Decision description with rationale. Can be as detailed as needed (T1/T2).

#### Lesson file format

Each lesson is a separate file in `_lessons/YYMMDD-lesson-name.md`:

```yaml
---
name: string                # Lesson title
description: string         # 1-2 sentence summary
category: string?           # debugging | performance | configuration | integration | ...
tags: string[]?             # For filtering
created: YYYY-MM-DD
---
```

Body: What happened, root cause, and what to do differently. Can be as detailed as needed (T1/T2).

### 4.6 Context Memory Rule (Hot Memory)

A hot memory rule file (`agent/rules/common/context-memory-rule.md`) that guides AI agents on when and how to use
workspace memory tools.

**Why hot memory (not warm):** This rule guides TOOL USAGE decisions — the AI needs it before it can decide whether to
call any tool. Must be available from conversation start.

**Contents:**

1. **When to load workspace context** — heuristics for determining if a task needs workspace context:
    - Task involves workspace-specific code (path contains `workspaces/` or `resources/workspaces/`)
    - Task mentions workspace/domain/repo names
    - Task requires understanding of project structure, conventions, or history
    - NOT needed: general questions, simple file edits with sufficient inline context, infra fixes unrelated to
      workspace logic

2. **How to use `workspace_get_context` effectively:**
    - First call: use defaults (scope overview + directory structure + overviews + decisions_t0/lessons_t0 + skills) —
      get orientation
    - Based on defaults, decide which topics to request
    - Follow-up calls: use `include_defaults: false` to save tokens
    - Topics are auto-discovered from `_{topicName}/` folders — no hardcoded list

3. **When to save decisions/lessons** — learning cycle triggers (references §4.3.2):
    - AI should proactively detect saveable moments during work
    - Write files directly to `_decisions/` or `_lessons/` folders (same pattern as plans)
    - At end of session, auto-determine what's worth saving

4. **How to access cold memory:**
    - Use `document_path` from warm tool responses for direct file reads
    - Search `resources/workspaces/{scope}/` with meaningful keywords for additional context
    - File structure is the index — no special tooling needed

**Does NOT contain:**

- Hardcoded lists of tags, categories, or topics — these are discovered from topic overviews and entry front-matter
- Workspace-specific knowledge — that belongs in warm memory (`resources/`)

**Token budget:** < 80 lines. Part of the overall hot memory budget (~300 lines).

## 5. Phase 2: Cross-workspace & Orchestrator (Future)

> Phase 2 is scoped but not designed in detail. Directional notes only.

### 5.1 Centralized long-term memory platform

When an orchestrator needs to work across workspaces, file-based scope queries are insufficient. A custom-built
centralized memory platform will be needed — tailored to fit the workspace structure rather than adapting to a generic
tool.

**Likely requirements:**

- Semantic search across all workspaces
- Entity/relationship tracking
- Integration with `CAS` (Centralized Agent Server) and `APM` (Agent Provider MCP)

### 5.2 Sub-agent communication

Orchestrator and workers need to communicate, sync context, and report status:

- **Orchestrator knows:** user requests, active tasks, worker count, progress, outcomes, error handling strategies
- **Workers know:** their assigned task, relevant context, how to report back
- **Shared state:** task graph, completion status, errors, retry decisions

### 5.3 Semantic search layer

When learnings volume makes full-file reading impractical, introduce semantic search:

- Lightweight local embeddings (no external API dependency)
- Indexed over `user/memory/` and `resources/` documentation
- Query returns relevant snippets with `_meta` for follow-up

## 6. Resolved Questions

| #  | Question                                     | Resolution                                                                                                         |
|----|----------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| 1  | No separate abstract summary file            | T0 data lives in OVERVIEW.md front-matter. abstract summary files are eliminated. See §2.4.                        |
| 2  | Plan front-matter migration                  | Will scan and migrate existing plans to add `status` and `tags`. See §7.                                           |
| 3  | Micro-tasks without plans                    | Skipped for now. Not every task needs a plan file — revisit if gap becomes a problem.                              |
| 4  | Learnings granularity                        | Per-domain level. Human reviews to maintain when files grow. May need review/reflect process later.                |
| 5  | Hot memory token budget                      | ~300 lines / ~3000 tokens total. >80% relevance rule. Quarterly human review. See §4.1.                            |
| 6  | save_memory UX                               | No save tool needed. AI writes decision/lesson files directly to `resources/`. Same pattern as plans.              |
| 7  | Tool consolidation                           | Three retrieval tools consolidated into one `workspace_get_context` with `topics` parameter. See §2.6.             |
| 8  | Workspace loading mandatory vs optional      | Made optional — AI decides autonomously based on task signals. See §2.9.                                           |
| 9  | Cold memory approach                         | No separate infrastructure. Raw files + AI searches with keywords. See §2.12.                                      |
| 10 | Tool naming prefix                           | `workspace_` prefix for all tools. Future centralized memory uses different namespace. See §2.8.                   |
| 11 | `topics` vs `category` naming                | `topics` for retrieval params, `category` for entry classification. See §2.7.                                      |
| 12 | Plan status via tool vs direct edit          | Direct file edit. All `resources/` file edits are direct, not via tools. See §2.11.                                |
| 13 | Learnings bundling                           | Decisions and lessons are separate topics in `workspace_get_context`. Each maps to its own `_{topicName}/` folder. |
| 14 | Write path boundary                          | All data in `resources/` — direct file edit for everything. No `user/memory/`, no save tool. See §2.3.             |
| 15 | `user/memory/` persistence                   | Removed. All data in `resources/` which is already git-tracked.                                                    |
| 16 | `_index.yaml`                                | Removed. Front-matter in individual files replaces centralized metadata index.                                     |
| 17 | `workspace_get_context` no pagination params | No `limit`/`sort_by`/`structure_depth` exposed. Tool owner optimizes internally. AI uses `scope` to narrow.        |
| 18 | Hot memory budget                            | Increased to ~500 lines / ~5000 tokens. Allows adequate guidance without being too restrictive.                    |
| 19 | APM location                                 | Integrated into `@hod/aweave-server` (NestJS). Single server, single port. See §2.14.                              |
| 20 | Multi-layer architecture                     | Core + NestJS + CLI + MCP. Core is standalone package; CLI calls core directly (no server roundtrip). See §2.15.   |
| 21 | `include_defaults` dual mechanism            | Client param + server session tracking + divergence logging. Data-driven path to simplification. See §2.16.        |

## 7. Open Questions

- [x] **Relationship to APM:** `workspace_*` tools are part of APM, integrated into `@hod/aweave-server` (NestJS). Not a
  standalone MCP process.
- [x] **Workspace memory packages (task):** 4 packages created: `workspace-memory` (core), `mcp-workspace-memory` (MCP
  shared), `nestjs-workspace-memory` (NestJS), `cli-plugin-workspace` (CLI). See §8 for details.
- [ ] **Plan front-matter migration (task):** Scan existing plans in `resources/*/_plans/` and add missing `status`,
  `tags`, `created` fields. Similarly, add front-matter to OVERVIEW.md files that lack it.
- [ ] **OVERVIEW.md front-matter migration (task):** Scan existing OVERVIEW.md files and add `name`, `description`,
  `tags` front-matter. Migrate any standalone abstract summary file content into the corresponding OVERVIEW.md
  front-matter.
- [x] **AGENTS.md workflow migration (task):** `AGENTS.md` is now auto-generated by `aw workspace build-rules` from 4
  modular rule files in `agent/rules/common/`. Uses optional workspace loading flow. See §8.6.
- [x] **`rule.md` rename (task):** Replaced by 4 modular rule files (`user-profile.md`, `global-conventions.md`,
  `context-memory-rule.md`, `workspace-workflow.md`). `AGENTS.md` is generated from them. See §8.6.
- [ ] **Default data tuning:** Monitor if structure + overviews + metadata is sufficient as defaults, or if additional
  default data (e.g., recent plans) should be added. See §4.2.2 design note.
- [ ] **`create-overview.md` update (task):** Rewrite `agent/commands/common/create-overview.md` to differentiate
  workspace/domain/repo overview guidelines. Workspace overview MUST NOT list individual packages (T0 defaults already
  include all OVERVIEW front-matters → listing causes duplication). Remove Phase 4 (abstract summary file generation per
  §2.4). Add OVERVIEW.md front-matter requirement.
- [ ] **abstract summary file → OVERVIEW.md front-matter migration (phased cutover):**
    1. Introduce dual-read support in rules/tooling: accept both `abstract summary file` and `OVERVIEW.md` front-matter
       as T0 source
    2. Update generators (`create-overview.md`) to write front-matter format (configurable or both temporarily)
    3. Migrate existing docs: copy abstract summary file content into corresponding OVERVIEW.md front-matter
       `description` field
    4. Validate coverage: ensure all scopes that had abstract summary file now have OVERVIEW.md with front-matter
    5. Update rule files that hardcode abstract summary file paths (`rule.md`, `devtools.md`, `business-workspace.md`,
       `project-structure.md`) to use OVERVIEW.md front-matter
    6. Flip defaults: new docs use front-matter only, stop generating abstract summary file
    7. Remove abstract summary file hard requirement after compatibility checks pass
    8. Clean up: remove orphaned abstract summary files

## 8. Implementation Status

Phase 1 implementation is largely complete. This section documents all components as built.

### 8.1 Package Inventory

All packages live under `workspaces/devtools/common/`. Each is at version `0.1.0`.

| # | Package | npm Name                              | Path                              | Role                                                                                            |
|---|---------|---------------------------------------|-----------------------------------|-------------------------------------------------------------------------------------------------|
| 1 | Core    | `@hod/aweave-workspace-memory`        | `common/workspace-memory/`        | Business logic — filesystem scanning, front-matter parsing, scope resolution, topic dispatching |
| 2 | MCP     | `@hod/aweave-mcp-workspace-memory`    | `common/mcp-workspace-memory/`    | Shared MCP tool definitions — `workspace_get_context` schema, handlers, server factory          |
| 3 | NestJS  | `@hod/aweave-nestjs-workspace-memory` | `common/nestjs-workspace-memory/` | REST API + MCP SSE transport — `WorkspaceMemoryModule` integrated in `@hod/aweave-server`       |
| 4 | CLI     | `@hod/aweave-plugin-workspace`        | `common/cli-plugin-workspace/`    | Terminal commands — `aw workspace get-context`, `aw workspace build-rules`, `aw workspace mcp`  |

### 8.2 Core Package (`@hod/aweave-workspace-memory`)

Framework-free business logic. All other layers delegate here.

**Key modules:**

| Module         | Path               | Responsibility                                                                                               |
|----------------|--------------------|--------------------------------------------------------------------------------------------------------------|
| `get-context/` | `src/get-context/` | `getContext()` entry point + per-topic handlers (plans, features, architecture, decisions, lessons, generic) |
| `parsers/`     | `src/parsers/`     | YAML front-matter parser (`parseFrontMatter`), folder structure generator (`generateFolderStructure`)        |
| `shared/`      | `src/shared/`      | Scope resolution (`resolveScope`), resource directory validation (`validateResourcesDir`)                    |

**Dependencies:** `yaml`, `fast-glob` (no framework deps).

### 8.3 MCP Package (`@hod/aweave-mcp-workspace-memory`)

Standalone MCP tool definitions and server factory. Shared by both NestJS (SSE transport) and CLI (STDIO transport).

**Key files:**

| File              | Purpose                                                                                                                                                                |
|-------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `src/tools.ts`    | `workspace_get_context` tool schema — parameters: `workspace`, `domain`, `repository`, `topics`, `include_defaults`, `filter_status`, `filter_tags`, `filter_category` |
| `src/handlers.ts` | Tool handler — delegates to core `getContext()`                                                                                                                        |
| `src/server.ts`   | `createWorkspaceMemoryServer()` — MCP server factory                                                                                                                   |
| `src/stdio.ts`    | STDIO transport entry point — also published as `aw-mcp-memory` binary                                                                                                 |

### 8.4 NestJS Package (`@hod/aweave-nestjs-workspace-memory`)

NestJS module providing REST and MCP SSE transports. Imported in `server/src/app.module.ts` as `WorkspaceMemoryModule`.

**Key files:**

| File                             | Purpose                                                                |
|----------------------------------|------------------------------------------------------------------------|
| `workspace-memory.module.ts`     | NestJS module definition                                               |
| `workspace-memory.service.ts`    | Wraps core `getContext()`, resolves project root                       |
| `workspace-memory.controller.ts` | `GET /workspace/context` REST endpoint                                 |
| `mcp-tools.service.ts`           | MCP SSE transport via `createWorkspaceMemoryServer()` from MCP package |
| `mcp.controller.ts`              | SSE endpoints for MCP clients                                          |
| `dto/`                           | Request/response DTOs with Swagger decorators                          |

### 8.5 CLI Package (`@hod/aweave-plugin-workspace`)

Oclif plugin with three commands:

| Command                    | Purpose                                                                  | Mechanism                          |
|----------------------------|--------------------------------------------------------------------------|------------------------------------|
| `aw workspace get-context` | Retrieve workspace context from terminal                                 | Calls core `getContext()` directly |
| `aw workspace build-rules` | Generate `AGENTS.md` + `.agents/rules/` symlinks from hot memory sources | Local filesystem operations        |
| `aw workspace mcp`         | Start MCP server over STDIO for AI agent tools                           | STDIO transport via MCP package    |

### 8.6 Agent Rules (Hot Memory L1)

Four modular rule files in `agent/rules/common/`:

| File                     | Purpose                                                                                                                  |
|--------------------------|--------------------------------------------------------------------------------------------------------------------------|
| `user-profile.md`        | User identity, preferences, coding style                                                                                 |
| `global-conventions.md`  | Cross-cutting conventions, source code location, `resources/` document requirements, output constraints                  |
| `context-memory-rule.md` | Memory layers (L1/L2/L3), data tiers (T0/T1/T2), when/how to use `workspace_get_context`, when to save decisions/lessons |
| `workspace-workflow.md`  | Scope resolution (path → logical scope), `workspace_get_context` parameters, task detection                              |

**Distribution channels:**

| Target                     | Mechanism                                      | Notes                                                                                       |
|----------------------------|------------------------------------------------|---------------------------------------------------------------------------------------------|
| `AGENTS.md` (project root) | Auto-generated by `aw workspace build-rules`   | Concatenates all 4 rule files. Used by Cursor (`always_applied_workspace_rules`) and Codex. |
| `.agents/rules/`           | Symlinks created by `aw workspace build-rules` | Points to individual rule files. For agents that read per-file rules.                       |
| `.cursor/rules/`           | `gitignore-tool-behavior.mdc` only             | Cursor-specific rule; not generated, maintained separately.                                 |

### 8.7 MCP Integration

`.cursor/mcp.json` registers the workspace memory MCP server for Cursor sessions:

```json
{
  "mcpServers": {
    "workspace-memory": {
      "command": "aw",
      "args": [
        "workspace",
        "mcp"
      ]
    }
  }
}
```

This makes `workspace_get_context` available as an MCP tool to AI agents in Cursor.

### 8.8 Removed from Scope

Items intentionally dropped during implementation (per key decisions §2.3, §2.10, §2.13):

| Item                                            | Reason                                                              |
|-------------------------------------------------|---------------------------------------------------------------------|
| `workspace_save_memory` tool                    | Decisions/lessons written directly to `resources/` files (§2.3)     |
| `user/memory/` directory                        | All data lives in `resources/`, already git-tracked (§2.13)         |
| `_index.yaml` metadata index                    | Front-matter in individual files replaces centralized index (§2.10) |
| `.codex/` symlinks                              | Codex reads `AGENTS.md` directly; per-file symlinks unnecessary     |
| `include_defaults` server-side session tracking | Deferred — client param is sufficient for Phase 1 (§2.16)           |

### 8.9 Related Plans

| Plan                                                        | Status      | Key Contribution                                                                                          |
|-------------------------------------------------------------|-------------|-----------------------------------------------------------------------------------------------------------|
| `260225-long-term-memory-phase1.md`                         | done        | Phase 1 full implementation — 4-layer architecture, all packages, agent rules, `aw workspace build-rules` |
| `260228-workspace-context-lessons-decisions-defaults-t1.md` | done        | Defaults include lessons/decisions T0 by scope ladder; topic queries return full T1 body                  |
| `260227-workspace-context-t1-overview-contract.md`          | in_progress | T1 overview at scope/topic level (partially superseded by 260228 for decisions/lessons)                   |
| `260227-configure-local-mcp-entrypoints.md`                 | proposed    | Configure MCP entry points for Cursor/Codex without cwd issues                                            |
| `260227-build-rules-symlinks.md`                            | pending     | `.agents/rules/` symlinks — functionality implemented in CLI, plan status not yet updated                 |
