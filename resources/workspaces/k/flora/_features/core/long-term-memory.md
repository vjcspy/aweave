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

## 3. Architecture

### 3.1 Memory Classification

Memory is classified along two orthogonal axes:

**Axis 1: Layer (loading strategy) — WHEN to load**

| Layer | Name | Loading | Description |
|-------|------|---------|-------------|
| L1 | Hot Memory | Auto-loaded, always available | Injected into every conversation via cursor rules / agent rules. Low token budget (<100 lines per file). |
| L2 | Warm Memory | Loaded on demand via MCP tools | Scope-aware retrieval. AI agent calls tools when it needs context about a specific workspace/domain/repo. |
| L3 | Cold Memory | Searched when explicitly needed | Raw transcripts, full documents. Used for deep investigation only. |

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
│   │   ├── decisions.md                   # ADR-lite
│   │   └── lessons.md                     # Mistakes, gotchas, patterns
│   └── {W}/{D}/                           # Per-domain learnings (when needed)
│       ├── decisions.md
│       └── lessons.md
│
└── agent-transcripts/                     # L3 Cold Memory
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
| `workspace-workflow.md` | How to detect workspace, load context, execute tasks | <100 lines |

**Replaces:** The current monolithic `AGENTS.md` (160 lines, 6-step ceremony). New approach: split by concern, auto-loaded, no manual confirmation needed for standard tasks.

**Token budget management:**

- **Total budget: ~300 lines / ~3000 tokens** across all hot memory files (including agent-specific rules like `gitignore-tool-behavior.mdc`)
- **Content criteria:** Only include items needed in >80% of conversations. Workspace-specific knowledge belongs in warm memory, not hot.
- **Promotion/demotion:** When hot memory is full and a new critical item needs to be added, review existing items and demote the least-universal one to warm memory (`user/memory/` or `resources/`).
- **Quarterly review:** Human reviews all hot memory files to prune stale entries and consolidate similar ones.
- **Each file declares its budget** in a comment at the top (e.g., `<!-- budget: 50 lines -->`). Approaching the limit signals time to review.

### 4.2 Warm Memory — Read Path (Layer 2)

#### 4.2.1 Tools in APM (Agent Provider MCP)

The warm memory retrieval tools are part of `APM` (Agent Provider MCP) — not a standalone MCP. Each tool accepts scope parameters and returns structured YAML with metadata.

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

#### 4.2.2 Tool: `retrieve_plans`

**Purpose:** Know what has been done and what is planned. Plans are the single source of truth for work history — every task (implementation, refactoring, investigation) starts with or generates a plan.

**Behavior:**

1. Scan `resources/workspaces/{scope}/*/_plans/` folders
2. Parse YAML front-matter from each plan file
3. Apply optional filters (`status`, `tags`)
4. Return T0 summaries (front-matter only) as structured YAML

**Parameters:**

```yaml
scope: { workspace, domain?, repository? }
filters:
  status: string[]?     # e.g., ["done", "in_progress"]
  tags: string[]?       # e.g., ["workflow", "nestjs"]
```

**Response example:**

```yaml
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

---

#### 4.2.3 Tool: `retrieve_overview`

**Purpose:** Understand the context of a workspace/domain/repo.

**Behavior:**

1. Scan `resources/workspaces/{scope}/` for `OVERVIEW.md` files
2. Parse YAML front-matter for T0 data (name, description, tags)
3. Return global (workspace-level) OVERVIEW as full content (T1)
4. Return domain/repo level as T0 only (front-matter fields)
5. If requesting a specific repo, return that repo's OVERVIEW as full content (T1)

**Parameters:**

```yaml
scope: { workspace, domain?, repository? }
```

**Response example:**

```yaml
overviews:
  - scope: "devtools"
    tier: T1
    content: |
      (full workspace OVERVIEW.md content)
    _meta:
      document_path: "resources/workspaces/devtools/OVERVIEW.md"

  - scope: "devtools/common"
    tier: T0
    abstract: "Shared tools and utilities across all domains..."
    _meta:
      document_path: "resources/workspaces/devtools/common/OVERVIEW.md"
```

---

#### 4.2.4 Tool: `retrieve_learnings`

**Purpose:** Retrieve decisions and lessons learned to avoid repeating mistakes and respect past choices.

**Behavior:**

1. Scan `user/memory/workspaces/{scope}/` for `decisions.md` and `lessons.md`
2. Return full content (these files are already optimized — short and concise)
3. Support filtering by `tags` and `category`

**Parameters:**

```yaml
scope: { workspace, domain?, repository? }
filters:
  tags: string[]?           # e.g., ["pnpm", "nestjs"]
  category: string?         # e.g., "architecture", "debugging"
```

**Response example:**

```yaml
decisions:
  - content: "Chose xstate v5 for workflow state management — actor model + strong TypeScript support"
    date: "2026-02-08"
    category: architecture
    tags: [workflow, state-management, xstate]
    _meta:
      document_path: "user/memory/workspaces/devtools/decisions.md"

lessons:
  - content: "pnpm strict isolation means require.resolve() must be called from the consuming package, not from a shared utility"
    date: "2026-02-23"
    category: debugging
    tags: [pnpm, nestjs, module-resolution]
    _meta:
      document_path: "user/memory/workspaces/devtools/lessons.md"
```

### 4.3 Warm Memory — Write Path

#### 4.3.1 `save_memory` command

An agent command (`agent/commands/common/save-memory.md`) that the main AI agent executes at end of conversation or when triggered.

**Trigger:** AI auto-saves at end of session based on learning cycle triggers (§4.3.2). User can also explicitly trigger with "save memory".

**Flow:**

1. AI reviews the current conversation for saveable knowledge
2. AI calls `retrieve_learnings(scope)` to check what's already saved (dedup)
3. AI classifies each piece of knowledge:
   - **Decision** → append to `user/memory/workspaces/{scope}/decisions.md`
   - **Lesson** → append to `user/memory/workspaces/{scope}/lessons.md`
   - **Plan status change** → update plan file front-matter `status` field
4. AI determines the correct scope (workspace/domain)
5. AI writes entries directly using native file tools, following format specs (§4.5)
6. AI reports what was saved

**Execution model (Phase 1):** Main agent executes the command directly. This retains full conversation context. A sub-agent approach (delegating via Task tool) would lose conversation history — reconsider in Phase 2 when orchestrator architecture is in place.

#### 4.3.2 Learning cycle triggers

Rules encoded in hot memory that instruct AI agents to detect moments worth saving:

| Trigger | Condition | Action |
|---------|-----------|--------|
| **Hard-won fix** | AI fixes a bug after multiple failed attempts | Auto-suggest saving as lesson (root cause + solution) |
| **Non-obvious solution** | Solution required knowledge not in any existing docs | Auto-suggest saving as lesson |
| **Conflict detection** | AI reads existing memory entry that contradicts current reality | Prompt user to update or archive the outdated entry |
| **Decision moment** | AI makes (or user confirms) an architectural/design choice | Auto-suggest saving as decision with rationale |
| **End of session** | Conversation is wrapping up | Auto-save: AI determines what's worth saving, writes entries, reports summary of what was saved |

### 4.4 Cold Memory (Layer 3)

Raw conversation transcripts stored in `agent-transcripts/` as JSONL files. Not processed or indexed in Phase 1.

**Future (Phase 2):** Transcript summarization and indexing for cross-workspace knowledge extraction.

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

## 7. Open Questions

- [x] **Relationship to APM:** `coding_memory` tools will be part of APM (Agent Provider MCP), not a standalone MCP.
- [ ] **Plan front-matter migration (task):** Scan existing plans in `resources/*/_plans/` and add missing `status`, `tags`, `created` fields. Similarly, add front-matter to OVERVIEW.md files that lack it.
- [ ] **OVERVIEW.md front-matter migration (task):** Scan existing OVERVIEW.md files and add `name`, `description`, `tags` front-matter. Migrate any standalone ABSTRACT.md content into the corresponding OVERVIEW.md front-matter.
- [ ] **Learning file review cadence:** When per-domain `decisions.md` or `lessons.md` grows beyond ~50 entries, consider splitting or archiving older entries. No automated solution yet — human reviews.
