---
name: Workspace Context T1 Overview Contract Update
description: Update workspace memory specification and implementation so warm context returns T1 overview at scope/topic level, while keeping topic entries at T0.
status: in_progress
created: 2026-02-27
tags: [memory, workspace-context, overview, contract]
---

# 260227 — Workspace Context T1 Overview Contract Update

## References

- `resources/misc/workflow-optimization/_features/core/long-term-memory.md`
- `resources/misc/workflow-optimization/_plans/260225-long-term-memory-phase1.md`
- `agent/commands/common/create-overview.md`
- `agent/rules/common/context-memory-rule.md`
- `workspaces/devtools/common/workspace-memory/src/get-context/get-context.ts`
- `workspaces/devtools/common/workspace-memory/src/get-context/defaults.ts`
- `workspaces/devtools/common/workspace-memory/src/get-context/types.ts`
- `workspaces/devtools/common/workspace-memory/src/get-context/topics/resource.ts`
- `workspaces/devtools/common/workspace-memory/src/get-context/topics/features.ts`
- `workspaces/devtools/common/nestjs-workspace-memory/src/dto/get-context.dto.ts`
- `workspaces/devtools/common/nestjs-workspace-memory/src/workspace-memory.controller.ts`
- `workspaces/devtools/common/cli-plugin-workspace/src/commands/workspace/get-context.ts`
- `workspaces/devtools/common/mcp-workspace-memory/src/tools.ts`
- `workspaces/devtools/common/mcp-workspace-memory/src/handlers.ts`

## User Requirements

```
1. include_defaults=false -> cái nào đã trả về rồi thì ko trả về nữa, trong trường hợp này là T1 của scope đã trả về -> ko trả nữa
2. Response shape bạn muốn -> đổi mỗi topic từ T0[] sang object { overview_t1, entries }
-> không cần quan tâm breaking change, cái này dùng local, duy trì 1 version, 1 flow duy nhất thôi
3. Khi query nhiều topics (topics=plans,features) có trả T1 cho mọi topic đã request không? -> tất nhiên có
4.  Hiện tại description đang là một field kiểu string. Nếu ta gộp chung cả mô tả, folder structure và list các filters vào description thì nó sẽ là một chuỗi multi-line khá dài -> tạo thêm các field mới thuần tuý trong schema front-matter (vd: folder_structure: string và available_filters: string[] / status_values: string[]) để rõ ràng rành mạch hơn
```

## Objective

Align the long-term memory design and `workspace_get_context` contract with a scoped T1-first model:

- Defaults always include T1 `OVERVIEW.md` for the requested scope (workspace/domain/repository).
- Topic queries always include T1 `OVERVIEW.md` per requested topic and T0 entries for that topic.
- Topic overview front-matter exposes folder structure and filter metadata in dedicated schema fields instead of overloading `description`.
- **Top-level topic overview fallback:** If a topic has multiple `OVERVIEW.md` files due to nesting, `overview_t1` specifically resolves the nearest scope's topic overview, falling back up the tree, yielding one deterministic string content.

### Key Considerations

- **Single flow, breaking changes allowed:** This is a local system with one maintained version; contract changes can be direct and atomic.
- **No repeated default payload:** `include_defaults=false` must skip already-returned default data, including scope T1 overview.
- **Topic response must be structured:** Replace topic array payload with `{ overview_t1, entries }` for all topics. Resolution of `overview_t1` handles nested topics by picking the "nearest scope only" deterministically.
- **Multi-topic consistency:** For `topics=plans,features,...`, each requested topic must include its own T1 overview.
- **Front-matter clarity:** Keep `description` concise and add explicit fields (e.g., `folder_structure`, `status_values`, `category_values`, `tag_values`) for machine-readable filters.
- **Spec and implementation must move together:** Update feature spec, command guidance, rule text, and tool descriptions in the same change set.

## Implementation Plan

### Phase 1: Update Source-of-Truth Spec

- [x] Revise `resources/misc/workflow-optimization/_features/core/long-term-memory.md`
  - **Outcome**: Warm memory definition updated from "T0 only" to "T0 + scoped/topic T1".
- [x] Update `workspace_get_context` default behavior section
  - **Outcome**: Defaults explicitly include `scope_overview_t1` (full content of current scope `OVERVIEW.md`) + T0 overviews list.
- [x] Update topic retrieval contract section
  - **Outcome**: Topic payload documented as `{ overview_t1, entries }` where `entries` are T0 summaries.
- [x] Update examples and pseudo-response blocks
  - **Outcome**: JSON examples match the new response shape and `include_defaults` behavior.

### Phase 2: Update Overview Authoring Standard

- [x] Revise `agent/commands/common/create-overview.md` for topic scope
  - **Outcome**: Topic overview front-matter requires dedicated fields for folder/filter metadata.
- [x] Add topic front-matter schema requirements
  - **Outcome**: Topic scope requires fields such as:
    - `folder_structure` (string)
    - `status_values` (string[], optional)
    - `category_values` (string[], optional)
    - `tag_values` (string[], optional)
- [x] Adjust `description` guidance for topic scope
  - **Outcome**: `description` stays concise (topic purpose), while operational details move to dedicated fields.

### Phase 3: Implement Core Contract Changes (`@hod/aweave-workspace-memory`)

- [x] Update T0 Overview type and parser logic
  - **Outcome**: `defaults.overviews` parser logic and return type includes new front-matter fields (`folder_structure`, `status_values`, etc.) so AI agents get query details on initial default load.
- [x] Extend response types in `src/get-context/types.ts`
  - **Outcome**: Add typed fields for `scope_overview_t1` and topic object shape `{ overview_t1, entries }`.
- [x] Add scope overview loader in `src/get-context/defaults.ts`
  - **Outcome**: Resolve exact current-scope `OVERVIEW.md` and return full T1 content when `includeDefaults=true`.
- [x] Refactor `src/get-context/get-context.ts`
  - **Outcome**: For each requested topic, return object payload with topic T1 overview + T0 entries. Resolve exact nearest-scope `OVERVIEW.md` for `overview_t1` if nested.
- [x] Keep entries scanners focused on T0 listing
  - **Outcome**: `scanResourceTopic` and `scanFeatures` continue producing lightweight entry lists.
- [x] Handle missing overview files explicitly
  - **Outcome**: Stable behavior for absent scope/topic overview (defined null/empty policy in type and implementation).

### Phase 4: Propagate Contract to Access Layers

- [x] Update MCP tool docs in `mcp-workspace-memory/src/tools.ts`
  - **Outcome**: Tool description reflects T1 scope/topic overview behavior.
- [x] Update MCP handler output expectations in `mcp-workspace-memory/src/handlers.ts`
  - **Outcome**: No shape mismatch between core return and tool output.
- [x] Update NestJS DTO/controller descriptions and boolean parsing
  - **Outcome**: API docs mention scope T1 default and topic object payload. **Fix boolean parsing for `include_defaults`** in REST controller to explicitly transform query string ("false" -> false) using ParseBoolPipe.
- [x] Update CLI command help text
  - **Outcome**: `aw workspace get-context` documentation reflects new semantics.

### Phase 5: Align Existing Topic Overviews & Rules

- [x] Migrate existing topic overviews under `resources/workspaces/devtools/common/_*/OVERVIEW.md`
  - **Outcome**: Front-matter includes new topic schema fields for folder/filter metadata.
- [x] Update `agent/rules/common/context-memory-rule.md`
  - **Outcome**: Replace outdated line "Warm returns T0" with updated T0+T1 guidance.

### Phase 6: Validation

- [x] Build and type-check core + integration layers
  - **Outcome**: `pnpm --filter @hod/aweave-workspace-memory build` and dependent packages pass.
- [x] Manual CLI contract verification
  - **Outcome**:
    - Equivalent local core smoke test confirms `includeDefaults=false` omits defaults and topic payload shape is `{ overview_t1, entries }`.
- [ ] Manual REST endpoint verification
  - **Outcome**:
    - GET `/workspace/context?include_defaults=false` correctly parses boolean and omits default payloads.
- [x] Manual MCP handler verification
  - **Outcome**: Local handler invocation confirms `include_defaults: "false"` is parsed correctly and returns topic payload shape `{ overview_t1, entries }`.

## Summary of Results

### Completed Achievements

- Updated `workspace_get_context` core contract to return `defaults.scope_overview_t1` and per-topic `{ overview_t1, entries }`.
- Implemented deterministic nearest-scope topic overview fallback with upward scope traversal.
- Extended overview T0 schema parsing to include `folder_structure`, `status_values`, `category_values`, and `tag_values`.
- Fixed boolean parsing for `include_defaults` in REST (`ParseBoolPipe`) and MCP handler string/number coercion.
- Updated tool/docs/rules guidance and migrated topic overview front-matter in `resources/workspaces/devtools/common/_*/OVERVIEW.md`.
- Verified builds for `@hod/aweave-workspace-memory`, `@hod/aweave-mcp-workspace-memory`, `@hod/aweave-nestjs-workspace-memory`, and `@hod/aweave-plugin-workspace`.

## Outstanding Issues & Follow-up

### Issues/Clarifications

- [x] Canonical filter fields standardized as `status_values`, `category_values`, and `tag_values` for topic `OVERVIEW.md` front-matter in this flow.
