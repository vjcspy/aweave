---
name: confluence-sync
description: Confluence two-way sync workflow for technical markdown docs that need a filtered, audience-specific subset in Confluence. Use when user asks to sync local markdown to Confluence or sync Confluence back to local, with section-level scope controlled by YAML frontmatter.
---

# Confluence Sync

Use this skill to sync documentation between local markdown files and Confluence with strict scope control.

## Confluence MCP Usage

Use the Confluence MCP tools directly:

- `confluence_get_page`: Fetch current page content before any sync.
- `confluence_search`: Find page when page ID is missing.
- `confluence_create_page`: Create page on first up-sync when configured page does not exist.
- `confluence_update_page`: Write merged content back to Confluence.
- `confluence_get_labels`: Check approval labels before down-sync.

Use these defaults:

- Read remote with `convert_to_markdown=true` for analysis and `convert_to_markdown=false` when storage-level merge is needed.
- Include metadata (`include_metadata=true`) to compare version and timestamps.
- Keep unmanaged content unchanged unless user explicitly asks to rewrite the entire page.

## Required YAML Frontmatter

Every sync-managed local markdown file must contain a `confluence_sync` frontmatter block.
If it does not exist and user asks to sync, create it before syncing.

```yaml
---
confluence_sync:
  page:
    id: "4563369987"
    url: "https://tinybots.atlassian.net/wiki/spaces/.../pages/4563369987/..."
    space_key: "~712020e960f9fdcdbd471a860cb5e759b69588"
    title: "Incident Analysis - useClientAddress Null Answer Crash"

  sync:
    direction_default: "both" # up | down | both
    include_only_listed_sections: true
    preserve_unmanaged_remote_content: true

  approval:
    require_for_down: true
    source: "confluence_labels" # confluence_labels | manual
    any_of_labels: ["approved", "po-approved", "qe-approved"]

  sections:
    - key: "end_to_end_flow"
      local_heading: "## 4. End-to-End Flow Context"
      remote_heading: "## End-to-End Flow Context"
      direction: "both" # up | down | both
      status: "approved" # draft | approved
      transform: "po_qe_readable" # none | po_qe_readable
      last_sync:
        page_version: 0
        synced_at: ""
        local_hash: ""
        remote_hash: ""

    - key: "fix_plan_option_a"
      local_heading: "## Option A - Immediate robustness hotfix (recommended)"
      remote_heading: "## Fix Plan (Option A)"
      direction: "up"
      status: "approved"
      transform: "po_qe_readable"
      last_sync:
        page_version: 0
        synced_at: ""
        local_hash: ""
        remote_hash: ""

  context_files:
    - "devdocs/projects/tinybots/backend/wonkers-nedap/Nedap-retrieve-concepts-flow.md"
---
```

## First-Time Setup Rules

When a file is new and frontmatter is missing:

1. Parse user intent (`sync lên Confluence` or `sync xuống local`).
2. Collect minimal config to build `confluence_sync`:
   - Page target (`id` or `url`, plus `title` if available).
   - Section scope to sync.
   - Direction per section.
   - Approval policy for down-sync.
3. Write frontmatter into the local file.
4. Continue sync flow in the same run.

Do not sync sections that are not listed in `confluence_sync.sections`.

## Sync Up: Local -> Confluence

Run all steps in order:

1. Fetch current remote page content (`confluence_get_page`).
2. Read and understand all user-provided context files and `context_files` in frontmatter.
3. Read local markdown and frontmatter.
4. Extract only configured local sections (`sections[*].local_heading`) where direction allows up (`up|both`).
5. Transform content for Confluence audience when `transform=po_qe_readable`:
   - Keep business/flow/fix decisions.
   - Remove deep internal-only details unless user requested to keep them.
6. Merge into remote page by `remote_heading`:
   - Replace managed sections.
   - Keep unmanaged sections unchanged.
7. Update page via `confluence_update_page`.
8. Verify with `confluence_get_page` after update.
9. Update local frontmatter `last_sync` for updated sections (`page_version`, `synced_at`, hashes).

## Sync Down: Confluence -> Local

Run all steps in order:

1. Fetch remote page content and metadata (`confluence_get_page`).
2. Read local markdown and frontmatter.
3. Check approval before pulling when `approval.require_for_down=true`:
   - If `source=confluence_labels`, call `confluence_get_labels` and require at least one `any_of_labels` match.
   - If no approval match, stop and report "not approved for down-sync".
4. Compare freshness per section (remote vs local):
   - Prefer remote section only when newer than `last_sync` or hash differs.
   - Never overwrite a local section marked `status=draft` unless user explicitly confirms.
5. Extract only configured remote sections (`sections[*].remote_heading`) where direction allows down (`down|both`).
6. Merge into corresponding local sections (`local_heading`).
7. Update `last_sync` metadata for synced sections.

## Section Matching Rules

Use deterministic section matching:

- Match headings exactly as configured.
- Section range is from matched heading to the next heading of equal or higher level.
- If target heading does not exist:
  - Up-sync: append the section under configured `remote_heading`.
  - Down-sync: append under configured `local_heading` and mark in summary.

## Conflict Policy

When both sides changed since last sync:

1. If section direction is one-way (`up` or `down`), follow configured direction.
2. If section direction is `both`:
   - Prefer side with approval if only one side is approved.
   - Otherwise prefer the newer side by timestamp/hash.
   - If still ambiguous, stop and ask user before overwrite.

## Output Requirements

After each sync, report:

- Direction (`up` or `down`).
- Target page ID/title.
- Sections synced and sections skipped (with reason).
- Approval check result (for down-sync).
- New remote page version (if updated).
- Frontmatter fields changed locally.

## Minimal Safety Checklist

Before write operations:

- Confirm page target is correct.
- Confirm section scope comes from frontmatter.
- Confirm approval policy for down-sync.
- Keep unmanaged content unchanged.
