---
name: Workspace Context Defaults + Lessons/Decisions T1 Contract Update
description: Update workspace_get_context defaults and topic behavior so folder structure is directory-only, defaults include lessons/decisions T0 by scope level, and lessons/decisions topics return full T1 file content.
status: new
created: 2026-02-28
tags: [memory, workspace-context, defaults, lessons, decisions, contract]
---

# 260228 — Workspace Context Defaults + Lessons/Decisions T1 Contract Update

## References

- `resources/misc/workflow-optimization/_features/core/long-term-memory.md`
- `resources/misc/workflow-optimization/_plans/260227-workspace-context-t1-overview-contract.md`
- `workspaces/devtools/common/workspace-memory/src/get-context/get-context.ts`
- `workspaces/devtools/common/workspace-memory/src/get-context/defaults.ts`
- `workspaces/devtools/common/workspace-memory/src/get-context/types.ts`
- `workspaces/devtools/common/workspace-memory/src/get-context/topics/resource.ts`
- `workspaces/devtools/common/workspace-memory/src/parsers/folder-structure.ts`
- `workspaces/devtools/common/mcp-workspace-memory/src/tools.ts`
- `workspaces/devtools/common/nestjs-workspace-memory/src/dto/get-context.dto.ts`
- `agent/rules/common/context-memory-rule.md`
- `AGENTS.md`

## Confirmed Requirements

1. `defaults.folder_structure` must show only directory hierarchy up to repository level and topic folders (`_{topic}`); do not list files at any level, including `OVERVIEW.md`.
2. Defaults must include T0 summaries of all files under `_lessons` and `_decisions` with scope-level aggregation:
   - workspace scope query: workspace level only
   - domain scope query: workspace + domain levels
   - repository scope query: workspace + domain + repository levels
3. Topic query behavior:
   - `topics=lessons` returns only lessons data
   - `topics=decisions` returns only decisions data
   - lessons/decisions entries return full T1 body content for all matched files (full, no truncation)
4. Typo correction: canonical topic/folder is `decisions` / `_decisions`.

## Objective

Align specification and implementation so `workspace_get_context` provides high-signal defaults and deeper learning context for decisions/lessons without requiring extra calls, while preserving deterministic scope behavior and topic isolation.

## Contract Changes

### Defaults

- Keep existing defaults keys (`scope_overview_t1`, `folder_structure`, `overviews`, `loaded_skills`).
- Add two new default collections:
  - `defaults.decisions_t0`
  - `defaults.lessons_t0`
- Both collections are scope-ladder aggregated based on requested scope depth.

**Defaults entry shape (exact contract):**

```yaml
defaults:
  decisions_t0:
    - name: string
      description: string
      tags: string[]?
      category: string?
      created: string?
      status: string?
      path: string
      _meta:
        document_path: string
  lessons_t0:
    - name: string
      description: string
      tags: string[]?
      category: string?
      created: string?
      status: string?
      path: string
      _meta:
        document_path: string
```

### Topic Payloads

- Keep generic topic response shape `{ overview_t1, entries }`.
- For topics `decisions` and `lessons`, `entries` contain:
  - front-matter fields (T0)
  - full markdown body content as T1 (for each file)
  - `_meta.document_path`
- For all other topics, keep current lightweight behavior.

## Implementation Plan

### Phase 1: Update Source-of-Truth Specification

- [ ] Update `resources/misc/workflow-optimization/_features/core/long-term-memory.md`
  - Define new defaults fields `decisions_t0` and `lessons_t0`
  - Define exact entry schema for both fields (same contract as above)
  - Define scope-ladder aggregation rules for defaults by workspace/domain/repository
  - Update folder structure contract to directory-only output
  - Define lessons/decisions topic entries as T1-full per file
- [ ] Update `resources/misc/workflow-optimization/_plans/260227-workspace-context-t1-overview-contract.md`
  - Add follow-up delta section or resolution note to avoid spec drift
  - Mark superseded parts that still say decisions/lessons topic entries are T0-only

### Phase 2: Core Library Contract + Types (`@hod/aweave-workspace-memory`)

- [ ] Add scope-ladder resolver strategy (chosen approach: Option B)
  - Implement helper in core to build ladder dirs from `scope` in `get-context.ts`
  - `getContext()` computes ordered `ladderDirs` and passes into `getDefaults(...)`
  - `getDefaults()` no longer infers hierarchy from one `resourcesDir`; it consumes explicit ladder input
- [ ] Update `src/get-context/types.ts`
  - Extend `DefaultsResponse` with `decisions_t0` and `lessons_t0`
  - Add explicit types for lesson/decision entries with T1 body field
- [ ] Update `src/parsers/folder-structure.ts`
  - Implement directory-only tree output
  - Keep `maxDepth=4` (workspace/domain/repository/topic granularity is sufficient)
  - Enforce stop conditions at repository + topic folder granularity
- [ ] Update `src/get-context/defaults.ts`
  - Scan `_decisions` and `_lessons` for T0 entries across allowed levels only
  - Dedup by `_meta.document_path` as safety guard
  - Apply global ordering after merge: newest first by `created`, then name
- [ ] Update `src/get-context/get-context.ts`
  - Route `decisions` and `lessons` through specialized scanners returning T1-full entries
  - Preserve topic isolation (`topics=lessons` does not include decisions)
- [ ] Add/adjust scanners under `src/get-context/topics/`
  - Keep generic scanner for non-learning topics
  - Introduce specialized scanner for lessons/decisions with full body extraction

### Phase 3: Propagate Through Access Layers

- [ ] Update MCP tool description in `workspaces/devtools/common/mcp-workspace-memory/src/tools.ts`
  - Reflect new defaults fields and lessons/decisions full T1 semantics
- [ ] Update REST DTO docs in `workspaces/devtools/common/nestjs-workspace-memory/src/dto/get-context.dto.ts`
  - Reflect defaults additions and topic semantic changes
- [ ] Update any CLI-facing help text if contract docs are surfaced there

### Phase 4: Update Rules and Related Documents

- [ ] Update `agent/rules/common/context-memory-rule.md`
  - Document new defaults behavior and lessons/decisions deep retrieval semantics
- [ ] Update `AGENTS.md` sections that describe `workspace_get_context` defaults/topics (if present and not generated-only blocks)
- [ ] Review related OVERVIEW/rule docs under `resources/` that restate old T0-only behavior for lessons/decisions and align wording

### Phase 5: Validation (No Test Authoring)

- [ ] Build impacted packages:
  - `@hod/aweave-workspace-memory`
  - `@hod/aweave-mcp-workspace-memory`
  - `@hod/aweave-nestjs-workspace-memory`
- [ ] Manual contract verification:
  - workspace/domain/repository scope calls return expected ladder aggregation in `defaults.decisions_t0` and `defaults.lessons_t0`
  - folder structure contains directories only
  - `topics=lessons` returns only lessons with full T1 per file
  - `topics=decisions` returns only decisions with full T1 per file
  - `include_defaults=false` still omits all defaults payloads

## Risks and Mitigations

- Payload growth from full T1 lessons/decisions topic entries.
  - Mitigation: keep behavior limited to explicit topic requests; defaults remain T0-only for these two sets.
- Spec drift across rules/tool docs.
  - Mitigation: treat document update phase as mandatory completion criteria before closing task.
