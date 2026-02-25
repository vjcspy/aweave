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
- What experiences/skills were gained? → `CAS`/`APM` will provide a way for agents to create and self-save new skills (organized by workspace)

## 2. Key Decisions

### 2.1 Build custom vs. external tools (OMEGA, Mem0, etc.)

**Decision:** Build custom MCP tools tailored to the workspace structure.

**Rationale:**

- External platforms provide less of what we need but more than necessary — they don't fit the specific requirements
- Custom filtering requirements: beyond category, we need tag-based filtering. Data includes `_meta` fields (document_path, document_id) that must be returned on retrieval but NOT included in search
- All data already exists in the workspace filesystem, organized by workspace/domain/repo. Only need to build retrieval tools on top of existing structure
- Data is already optimized for workspace-scoped access — when an AI agent (or human) works with a workspace, they only care about data within that workspace
- Data lives in git → scope-based query already provides sufficient context
- External memory servers are more suitable for cross-workspace / general-purpose scenarios (e.g., orchestrator assistant) — deferred to Phase 2

**When to reconsider:** If the workspace grows to a scale where file-based aggregation becomes slow, or when cross-workspace semantic search becomes a concrete need. Phase 2 may introduce a custom-built centralized memory platform for orchestrator use.

### 2.2 File-based memory vs. database

**Decision:** File-based (markdown + YAML front-matter), synced via git.

**Rationale:**

- Simplicity — no additional infrastructure (no vector DB, no graph DB)
- Human-readable and human-editable
- Git provides versioning, diff, and implicit conflict resolution
- AI agents already have tools to read/write files
- Workspace structure IS the index — no separate indexing needed

### 2.3 Write path: direct file access vs. MCP write tools

**Decision:** AI agents write directly to memory files using native file tools (Write, StrReplace). No MCP write tools for Phase 1.

**Rationale:**

- Data is local, file-based, git-tracked
- AI agents already have write capabilities
- A rule/convention is sufficient to guide format and location
- MCP read tools serve dual purpose: provide context during work AND check duplicates during save
- Simplest possible approach that works

### 2.4 No separate ABSTRACT.md files

**Decision:** Remove ABSTRACT.md as a standalone file type. T0 (abstract) data is stored in YAML front-matter of OVERVIEW.md files instead.

**Rationale:**

- MCP tools already extract T0 data from front-matter — a separate file is redundant
- Reduces file count and maintenance burden
- Single source of truth: OVERVIEW.md contains both T0 (front-matter) and T1 (body content)
- Plans already use front-matter for T0 — this makes OVERVIEW.md consistent with that pattern

### 2.5 Phase strategy

| Phase | Scope | Focus |
|-------|-------|-------|
| Phase 1 | Workspace-scoped memory | Hot memory (cursor rules), warm memory (MCP read tools), write path (rules + direct file access) |
| Phase 2 | Cross-workspace + orchestrator | Centralized memory platform, sub-agent communication, semantic search, integration with CAS/APM |

### 2.6 Tool consolidation: Single retrieval tool

**Decision:** Consolidate `retrieve_plans`, `retrieve_overview`, `retrieve_learnings` into one tool: `workspace_get_context`.

**Rationale:**

- 3 separate tools = 3 round trips minimum. AI must wait for each response before deciding next action — wasteful in latency and token cost
- From AI agent's perspective, it just needs "context to work with" — doesn't matter if data comes from `resources/` or `user/memory/`
- One tool with `topics[]` parameter gives AI flexibility to request exactly what it needs in a single call
- Default response (no topics) provides structural overview + memory metadata — AI can then make informed decisions about what else to load

### 2.7 Naming: `topics` vs `category`

**Decision:** Use `topics` for retrieval parameter (what data types to get), `category` for entry classification within saved items.

**Rationale:**

- `topics` = "what do I want to know about" — fits retrieval semantics (plans, features, architecture, decisions, lessons)
- `category` = "how is this entry classified" — fits write/classification semantics (architecture, debugging, configuration)
- Clear separation prevents confusion: `topics` is a tool parameter for selecting data types, `category` is a data field inside individual entries

### 2.8 `workspace_` prefix

**Decision:** All workspace memory tools use `workspace_` prefix (e.g., `workspace_get_context`, `workspace_save_memory`).

**Rationale:**

- Phase 1 = workspace-scoped memory. All context comes from the local workspace filesystem — tools simply provide structured retrieval and aggregation on top of existing file structure
- Phase 2 will introduce centralized cross-workspace memory with separate namespace
- Prefix creates clear namespace: `workspace_*` = local workspace data, future `memory_*` = centralized
- Prevents naming conflicts when both systems coexist

### 2.9 Optional workspace context loading

**Decision:** Remove mandatory workspace context loading ceremony from the main workflow (AGENTS.md). AI agent decides autonomously when to load context based on task requirements.

**Rationale:**

- Many tasks don't need workspace context (Docker fixes, general questions, simple code changes with file path already provided)
- Mandatory loading wastes tokens and time for 40%+ of conversations
- AI can determine need based on simple heuristics (path patterns, domain mentions)
- When AI does load context, `workspace_get_context` defaults provide enough orientation

**Action required:** Rewrite `AGENTS.md` / `workspace-workflow.md` to remove 6-step ceremony. Replace with lightweight guidance on when to call `workspace_get_context`. See §4.6.

### 2.10 Memory metadata index

**Decision:** Maintain a metadata/index file per workspace (`user/memory/workspaces/{workspace}/_index.yaml`) that tracks available tags, categories, and summary statistics.

**Rationale:**

- AI agent needs to know what tags/categories exist BEFORE making queries — can't construct meaningful filters without this knowledge
- Hardcoding available tags/categories in rules = maintenance burden + stale data over time
- Auto-maintained by `workspace_save_memory` tool — always current, zero manual upkeep
- Loaded as part of defaults in `workspace_get_context` — zero extra tool calls needed

### 2.11 Plan status updates — direct edit

**Decision:** Plan status changes are done via direct file edit (StrReplace on front-matter), not through any MCP tool. Same applies to all files in `resources/` — AI agents edit them directly.

**Rationale:**

- Plans live in `resources/` — all edits to `resources/` files are direct, no tool abstraction
- Status update = simple front-matter field change, no complex logic needed
- `workspace_save_memory` is focused on `user/memory/` (experiential knowledge) only — mixing in plan state management would conflate concerns

### 2.12 Cold memory — no separate infrastructure

**Decision:** No separate cold memory infrastructure in Phase 1. Cold memory = raw data in `resources/` and `agent-transcripts/` that warm tools haven't surfaced.

**Rationale:**

- Warm tools return `_meta.document_path` → AI reads file directly for T2 detail
- For unsurfaced context, AI searches `resources/workspaces/{scope}/` using Grep/SemanticSearch
- Workspace file structure IS the index — no additional infrastructure needed
- `agent-transcripts/` kept as archive; search/index deferred to Phase 2

## 3. Architecture

### 3.1 Memory Classification

Memory is classified along two orthogonal axes:

**Axis 1: Layer (loading strategy) — WHEN to load**

| Layer | Name | Loading | Description |
|-------|------|---------|-------------|
| L1 | Hot Memory | Auto-loaded, always available | Injected into every conversation via cursor rules / agent rules. Low token budget (<100 lines per file). |
| L2 | Warm Memory | Loaded on demand via MCP tools | Scope-aware retrieval. AI agent calls tools when it needs context about a specific workspace/domain/repo. |
| L3 | Cold Memory | Searched when explicitly needed | Raw files in workspace. AI reads directly via file path or searches with keywords. No separate infrastructure. |

**Axis 2: Tier (context size) — HOW MUCH to load**

| Tier | Name | Size | Use case |
|------|------|------|----------|
| T0 | Abstract | 100-200 tokens | Quick orientation. Extracted from YAML front-matter of OVERVIEW.md and plan files. No separate ABSTRACT.md files needed. |
| T1 | Overview | 1-2 pages | Working context. Enough to make decisions. |
| T2 | Detail | Full document | Deep dive. Implementation reference. |

**How they combine:** A warm memory tool might return T0 (front-matter only) for broad scope queries and T1/T2 for narrow scope queries.

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
│   ├── _features/                         # T1/T2
│   ├── _spikes/                           # T1/T2
│   └── _architecture/                     # T1/T2
│
├── user/memory/workspaces/                # L2 Warm Memory (experiential)
│   ├── {W}/                               # Per-workspace learnings
│   │   ├── _index.yaml                    # Memory metadata (tags, categories, stats)
│   │   ├── decisions.md                   # ADR-lite
│   │   └── lessons.md                     # Mistakes, gotchas, patterns
│   └── {W}/{D}/                           # Per-domain learnings (when needed)
│       ├── decisions.md
│       └── lessons.md
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

| File | Purpose | Budget |
|------|---------|--------|
| `user-profile.md` | Identity, preferences, coding style | <50 lines |
| `global-conventions.md` | Cross-cutting decisions, naming, patterns | <80 lines |
| `context-memory-rule.md` | How/when to use workspace memory tools, when to save | <80 lines |
| `workspace-workflow.md` | How to detect workspace, load context, execute tasks | <100 lines |

**Replaces:** The current monolithic `AGENTS.md` (160 lines, 6-step ceremony). New approach: split by concern, auto-loaded, no manual confirmation needed for standard tasks.

**Token budget management:**

- **Total budget: ~300 lines / ~3000 tokens** across all hot memory files (including agent-specific rules like `gitignore-tool-behavior.mdc`)
- **Content criteria:** Only include items needed in >80% of conversations. Workspace-specific knowledge belongs in warm memory, not hot.
- **Promotion/demotion:** When hot memory is full and a new critical item needs to be added, review existing items and demote the least-universal one to warm memory (`user/memory/` or `resources/`).
- **Quarterly review:** Human reviews all hot memory files to prune stale entries and consolidate similar ones.
- **Each file declares its budget** in a comment at the top (e.g., `<!-- budget: 50 lines -->`). Approaching the limit signals time to review.

### 4.2 Warm Memory — Read Path (Layer 2)

#### 4.2.1 Tool Design

All warm memory retrieval is handled by a single MCP tool: `workspace_get_context`. This tool is part of APM (Agent Provider MCP). Each call accepts scope parameters plus optional topics, and returns structured YAML with metadata.

**Common scope parameters:**

```yaml
scope:
  workspace: string       # required (e.g., "devtools", "k")
  domain: string?         # optional (e.g., "common", "stock")
  repository: string?     # optional (e.g., "metan", "workflow-engine")
```

Scope resolution: if only `workspace` is passed, tool aggregates across all domains/repos in that workspace. Adding `domain` narrows to that domain. Adding `repository` narrows to that specific repo.

**Common response metadata:** Every returned entry includes `_meta` fields that are NOT searchable but provide context for follow-up:

```yaml
_meta:
  document_path: string    # relative path to source document
  document_id: string      # unique identifier (filename or generated)
```

---

#### 4.2.2 Tool: `workspace_get_context`

**Purpose:** Single entry point for all workspace context retrieval — structural overview, plans, features, architecture, decisions, lessons, and memory metadata.

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

**Default response (no topics, `include_defaults: true`):**

Always returned to give AI structural orientation without needing to decide what to ask for:

1. **Folder structure** of `resources/workspaces/{scope}/` — shows what exists
2. **T0 summaries** (front-matter: name, description, tags) of all OVERVIEW.md files within scope
3. **Memory metadata** from `user/memory/workspaces/{workspace}/_index.yaml` — available tags, categories, summary stats

> **Design note (subject to change):** Defaults currently include only structure + T0 + memory metadata. If we find that AI consistently needs additional default data (e.g., recent plans), we may add more to defaults later.

**Topic-specific data (when topics are specified):**

| Topic | Source | Returns |
|-------|--------|---------|
| `"overview"` | `resources/workspaces/{scope}/OVERVIEW.md` | T1 full content of OVERVIEW at current scope level |
| `"plans"` | `resources/workspaces/{scope}/*/_plans/` | T0 front-matter of all plans within scope |
| `"features"` | `resources/workspaces/{scope}/*/_features/` | T0 listing of features within scope |
| `"architecture"` | `resources/workspaces/{scope}/*/_architecture/` | T0/T1 listing of architecture docs |
| `"decisions"` | `user/memory/workspaces/{scope}/decisions.md` | Full content (entries are already concise) |
| `"lessons"` | `user/memory/workspaces/{scope}/lessons.md` | Full content (entries are already concise) |

**`include_defaults: false`:** Skips folder structure and T0 summaries. Still includes memory metadata (AI needs it for informed filtering). Use on follow-up calls within the same conversation to save tokens.

**Response example:**

```yaml
defaults:
  folder_structure: |
    resources/workspaces/devtools/
    ├── OVERVIEW.md
    ├── common/
    │   ├── OVERVIEW.md
    │   ├── cli-plugin-debate/
    │   ├── cli-plugin-server/
    │   └── _plans/
    └── ...

  overviews_t0:
    - scope: "devtools"
      name: "DevTools"
      description: "Shared development tools and infrastructure"
      tags: [devtools, infrastructure]
      _meta:
        document_path: "resources/workspaces/devtools/OVERVIEW.md"

    - scope: "devtools/common"
      name: "DevTools Common"
      description: "Shared tools and utilities across all domains"
      tags: [cli, shared]
      _meta:
        document_path: "resources/workspaces/devtools/common/OVERVIEW.md"

  memory_metadata:
    workspace: devtools
    last_updated: "2026-02-25"
    tags:
      - { name: "nestjs", description: "NestJS framework", used_in: [decisions, lessons], count: 3 }
      - { name: "pnpm", description: "Package manager issues", used_in: [lessons], count: 2 }
    categories:
      - { name: "architecture", used_in: [decisions], count: 5 }
      - { name: "debugging", used_in: [lessons], count: 3 }
    summary:
      total_decisions: 12
      total_lessons: 8
      domains_with_memory: [common]

plans:
  - name: "Workflow Engine"
    description: "Build a workflow execution engine for sequential and parallel task graphs"
    status: done
    created: "2026-02-08"
    updated: "2026-02-09"
    tags: [workflow, engine, xstate]
    _meta:
      document_path: "resources/workspaces/devtools/common/_plans/260208-workflow-engine.md"
      document_id: "260208-workflow-engine"

  - name: "SPA Self-Serve from Feature Modules"
    description: "Eliminate per-SPA boilerplate in server package"
    status: in_progress
    created: "2026-02-23"
    tags: [nestjs, spa, architecture]
    _meta:
      document_path: "resources/workspaces/devtools/common/_plans/260223-spa-self-serve.md"
      document_id: "260223-spa-self-serve"
```

### 4.3 Warm Memory — Write Path

#### 4.3.1 Tool: `workspace_save_memory`

MCP tool for saving experiential knowledge (decisions, lessons) to `user/memory/` workspace files.

**Scope:** `user/memory/workspaces/{scope}/` only. All edits to `resources/` files (plan status updates, OVERVIEW changes, etc.) are done via direct file tools (StrReplace, Write) — not through this tool.

**Parameters:**

```yaml
scope: { workspace, domain? }
type: "decision" | "lesson"
title: string
content: string
category: string?      # "architecture", "debugging", "configuration", etc.
tags: string[]?
```

**Behavior:**

1. Format entry using the spec in §4.5 (Decision/Lesson entry format)
2. Append to the appropriate file:
   - `type: "decision"` → `user/memory/workspaces/{scope}/decisions.md`
   - `type: "lesson"` → `user/memory/workspaces/{scope}/lessons.md`
3. Update metadata index (`user/memory/workspaces/{workspace}/_index.yaml`):
   - Add new tags/categories if not already tracked
   - Increment counts
   - Update `last_updated` timestamp
4. Return confirmation + file path

**Dedup check:** Before saving, AI should call `workspace_get_context` with `topics: ["decisions"]` or `topics: ["lessons"]` to check if similar knowledge already exists. The `context-memory-rule.md` instructs this behavior.

#### 4.3.2 Learning cycle triggers

Rules encoded in hot memory (`context-memory-rule.md`) that instruct AI agents to detect moments worth saving:

| Trigger | Condition | Action |
|---------|-----------|--------|
| **Hard-won fix** | AI fixes a bug after multiple failed attempts | Auto-suggest saving as lesson (root cause + solution) |
| **Non-obvious solution** | Solution required knowledge not in any existing docs | Auto-suggest saving as lesson |
| **Conflict detection** | AI reads existing memory entry that contradicts current reality | Prompt user to update or archive the outdated entry |
| **Decision moment** | AI makes (or user confirms) an architectural/design choice | Auto-suggest saving as decision with rationale |
| **End of session** | Conversation is wrapping up | Auto-save: AI determines what's worth saving, writes entries, reports summary of what was saved |

**Execution model (Phase 1):** Main agent executes save directly. This retains full conversation context. A sub-agent approach (delegating via Task tool) would lose conversation history — reconsider in Phase 2 when orchestrator architecture is in place.

### 4.4 Cold Memory (Layer 3)

Cold memory is raw data within the workspace that warm tools haven't surfaced. In Phase 1, there is no separate cold memory infrastructure.

**What it includes:**

- Full document content in `resources/` (T2 detail beyond what warm tools summarize)
- Raw conversation transcripts in `agent-transcripts/` (JSONL files)

**Access pattern:**

- When warm tools return `_meta.document_path` → AI reads file directly using Read tool for T2 detail
- When AI needs context not returned by warm tools → AI searches `resources/workspaces/{scope}/` using Grep/SemanticSearch with relevant keywords
- The workspace file structure serves as the index — no additional infrastructure needed

**Rule guidance:** The `context-memory-rule.md` (hot memory) instructs AI agents on when and how to search cold memory effectively. See §4.6.

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
---
```

The `description` field replaces the need for a separate ABSTRACT.md file. MCP tools extract this field for T0 responses.

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

| Status | Meaning |
|--------|---------|
| `new` | Plan created, work not yet started |
| `in_progress` | Actively being worked on |
| `partial` | Some parts done, some remaining |
| `done` | Fully implemented |
| `abandoned` | Decided not to proceed (kept for context) |

#### Decision entry format

Each entry in `decisions.md`:

```markdown
### [YYYY-MM-DD] Decision title

**Category:** architecture | tooling | convention | dependency | ...
**Tags:** tag1, tag2, tag3

Decision description with rationale.

---
```

#### Lesson entry format

Each entry in `lessons.md`:

```markdown
### [YYYY-MM-DD] Lesson title

**Category:** debugging | performance | configuration | integration | ...
**Tags:** tag1, tag2, tag3

What happened, root cause, and what to do differently.

---
```

#### Memory metadata index format

`user/memory/workspaces/{workspace}/_index.yaml` — auto-maintained by `workspace_save_memory`:

```yaml
workspace: string
last_updated: YYYY-MM-DD

tags:
  - name: string
    description: string?       # Human-readable meaning of this tag
    used_in: string[]          # Which files use this tag: ["decisions", "lessons"]
    count: number

categories:
  - name: string
    used_in: string[]
    count: number

summary:
  total_decisions: number
  total_lessons: number
  domains_with_memory: string[]   # Which domains have their own memory files
```

This file is auto-maintained by `workspace_save_memory`. When a new entry is saved with a tag/category not yet tracked, the tool adds it. Loaded as part of defaults in `workspace_get_context` — gives AI awareness of what's queryable without extra tool calls.

### 4.6 Context Memory Rule (Hot Memory)

A hot memory rule file (`agent/rules/common/context-memory-rule.md`) that guides AI agents on when and how to use workspace memory tools.

**Why hot memory (not warm):** This rule guides TOOL USAGE decisions — the AI needs it before it can decide whether to call any tool. Must be available from conversation start.

**Contents:**

1. **When to load workspace context** — heuristics for determining if a task needs workspace context:
   - Task involves workspace-specific code (path contains `workspaces/` or `resources/workspaces/`)
   - Task mentions workspace/domain/repo names
   - Task requires understanding of project structure, conventions, or history
   - NOT needed: general questions, simple file edits with sufficient inline context, infra fixes unrelated to workspace logic

2. **How to use `workspace_get_context` effectively:**
   - First call: use defaults (structure + T0 + memory metadata) — get orientation
   - Based on defaults, decide which topics to request
   - Follow-up calls: use `include_defaults: false` to save tokens
   - Use tags/categories from memory metadata for informed filtering

3. **When to save memory** — learning cycle triggers (references §4.3.2):
   - AI should proactively detect saveable moments during work
   - At end of session, auto-determine what's worth saving
   - Use `workspace_get_context` with relevant topics to dedup before saving

4. **How to access cold memory:**
   - Use `document_path` from warm tool responses for direct file reads
   - Search `resources/workspaces/{scope}/` with meaningful keywords for additional context
   - File structure is the index — no special tooling needed

**Does NOT contain:**

- Hardcoded lists of tags, categories, or topics — these are stored in memory metadata files (`_index.yaml`) and loaded via `workspace_get_context` defaults
- Workspace-specific knowledge — that belongs in warm memory (`resources/` and `user/memory/`)

**Token budget:** < 80 lines. Part of the overall hot memory budget (~300 lines).

## 5. Phase 2: Cross-workspace & Orchestrator (Future)

> Phase 2 is scoped but not designed in detail. Directional notes only.

### 5.1 Centralized long-term memory platform

When an orchestrator needs to work across workspaces, file-based scope queries are insufficient. A custom-built centralized memory platform will be needed — tailored to fit the workspace structure rather than adapting to a generic tool.

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

| # | Question | Resolution |
|---|----------|------------|
| 1 | No separate ABSTRACT.md | T0 data lives in OVERVIEW.md front-matter. ABSTRACT.md files are eliminated. See §2.4. |
| 2 | Plan front-matter migration | Will scan and migrate existing plans to add `status` and `tags`. See §7. |
| 3 | Micro-tasks without plans | Skipped for now. Not every task needs a plan file — revisit if gap becomes a problem. |
| 4 | Learnings granularity | Per-domain level. Human reviews to maintain when files grow. May need review/reflect process later. |
| 5 | Hot memory token budget | ~300 lines / ~3000 tokens total. >80% relevance rule. Quarterly human review. See §4.1. |
| 6 | save_memory UX | AI auto-handles: determines what's worth saving, writes, reports summary. No confirmation needed. |
| 7 | Tool consolidation | Three retrieval tools consolidated into one `workspace_get_context` with `topics` parameter. See §2.6. |
| 8 | Workspace loading mandatory vs optional | Made optional — AI decides autonomously based on task signals. See §2.9. |
| 9 | Cold memory approach | No separate infrastructure. Raw files + AI searches with keywords. See §2.12. |
| 10 | Tool naming prefix | `workspace_` prefix for all tools. Future centralized memory uses different namespace. See §2.8. |
| 11 | `topics` vs `category` naming | `topics` for retrieval params, `category` for entry classification. See §2.7. |
| 12 | Plan status via tool vs direct edit | Direct file edit. All `resources/` file edits are direct, not via tools. See §2.11. |
| 13 | Learnings bundling | Decisions and lessons are separate topics in `workspace_get_context`, not grouped under "learnings". Each maps to one data source for consistency. |

## 7. Open Questions

- [x] **Relationship to APM:** `workspace_*` tools will be part of APM (Agent Provider MCP), not a standalone MCP.
- [ ] **Plan front-matter migration (task):** Scan existing plans in `resources/*/_plans/` and add missing `status`, `tags`, `created` fields. Similarly, add front-matter to OVERVIEW.md files that lack it.
- [ ] **OVERVIEW.md front-matter migration (task):** Scan existing OVERVIEW.md files and add `name`, `description`, `tags` front-matter. Migrate any standalone ABSTRACT.md content into the corresponding OVERVIEW.md front-matter.
- [ ] **Learning file review cadence:** When per-domain `decisions.md` or `lessons.md` grows beyond ~50 entries, consider splitting or archiving older entries. No automated solution yet — human reviews.
- [ ] **`context-memory-rule.md` creation (task):** Create the hot memory rule file at `agent/rules/common/context-memory-rule.md`. See §4.6 for content spec.
- [ ] **Memory metadata bootstrap (task):** Create initial `_index.yaml` files for existing workspaces with their current tags/categories.
- [ ] **AGENTS.md workflow migration (task):** Rewrite AGENTS.md to use optional workspace loading flow instead of 6-step ceremony. See §2.9.
- [ ] **Default data tuning:** Monitor if structure + T0 + metadata is sufficient as defaults, or if additional default data (e.g., recent plans) should be added. See §4.2.2 design note.
