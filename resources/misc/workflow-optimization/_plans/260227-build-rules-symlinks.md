---
name: Build Rules Symlinks for Agent Compatibility
description: Update aw workspace build-rules to create symlinks in .agents/rules/ for compatibility with AI agents that read from that directory instead of AGENTS.md.
status: pending
created: 2026-02-27
tags: [cli, agents, memory, hot-memory]
---

# 260227 — Build Rules Symlinks for Agent Compatibility

## Background & Objective

Currently, `aw workspace build-rules` reads multiple source markdown files from `agent/rules/common/` and combines them into a single `AGENTS.md` file at the root of the project. This supports agents that read solely from `AGENTS.md`.
However, some AI agents (like Cline or advanced Cursor configs) read all markdown files placed inside `.agents/rules/`. To support these agents without duplicating rule definitions, `build-rules` needs to automatically create symlinks for all defined source files inside `.agents/rules/`.

## Proposed Changes

### [MODIFY] `workspaces/devtools/common/cli-plugin-workspace/src/commands/workspace/build-rules.ts`

- **Ensure `.agents/rules/` exists:** Before looping over source files (or after), ensure the directory `.agents/rules` exists at the project root using `mkdirSync(targetDir, { recursive: true })`.
- **Create Symlinks:** For each file in `SOURCE_FILES` (e.g., `agent/rules/common/user-profile.md`), create a relative symlink from `.agents/rules/{basename}` to the source file `../../agent/rules/common/{basename}`.
  - Use `fs.existsSync` or `fs.lstatSync` to check if a file or symlink already exists at `.agents/rules/{basename}`. If it exists and isn't the correct symlink, remove it.
  - Use `fs.symlinkSync(target, path)` to create the symlink.
- **Update Dry-Run:** In `--dry-run` mode, output the symlinks that would be created without actually creating them.
- **Update Command Output:** Update the `MCPResponse` metadata at the end of the command to include information about the created symlinks (`symlinks_created: string[]`).

## Verification Plan

### Automated / Manual Execution Tests

1. **Compile the changes**:

   ```bash
   cd workspaces/devtools/common/cli-plugin-workspace
   pnpm run build
   ```

2. **Execute the command in dry-run mode**:

   ```bash
   aw workspace build-rules --dry-run
   ```

   *Verify that the output mentions the symlinks that would be created.*
3. **Execute the command**:

   ```bash
   aw workspace build-rules
   ```

4. **Verify the symlinks**:

   ```bash
   ls -la .agents/rules/
   ```

   *Expect to see symlinks pointing relative to `../../agent/rules/common/[filename]`.*
   *Verify content can be read properly, e.g. `cat .agents/rules/user-profile.md`.*
