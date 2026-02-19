# 260215 - Agent Workflow Optimization v1

## Context

First round of systematic improvements to the AI agent workflow in this workspace. Focused on making the agent more consistent, reducing redundancy, and adding debug visibility.

## Baseline State (Before)

### Files Structure

```
AGENTS.md (symlink → agent/rules/common/rule.md)
agent/rules/common/
├── rule.md                          # Entry point (identical to AGENTS.md)
├── project-structure.md             # 146 lines — mostly duplicated content
├── coding/
│   └── coding-standard-and-quality.md
├── tasks/
│   ├── create-plan.md               # Thin — 16 lines
│   └── implementation.md            # Thin — 24 lines
└── workspaces/
    ├── business-project.md          # No scope detection, no search scope
    └── devtools.md                  # No scope detection, no search scope

agent/templates/common/
└── create-plan.md                   # Mixed runtime instructions + template
```

### Issues Identified

| # | Issue | Impact | Priority |
|---|-------|--------|----------|
| A | Context loading cost — 6-8 file reads before any work | Slow start, wasted tokens | High |
| B | Task Detection had no structured patterns — agent guesses task type | Inconsistent behavior across sessions | High |
| C | `rule.md` duplication with AGENTS.md undocumented | Maintenance confusion | Low |
| D | `business-project.md` missing Skill Loading section | Skills never triggered for business projects | Medium |
| E | Plan template contained runtime instructions mixed with structure | Agent might copy instructions into output | Medium |
| F | `implementation.md` too thin (24 lines) — no execution strategy | Agent lacks guidance for multi-file changes, error recovery | Medium |
| G | No "warm context" between sessions | Agent reloads everything every session | Low |
| H | Commands/Skills sync is manual | Developer friction | Low |

### Key Observations

1. **Reading order matters for LLMs** — "lost in the middle" effect means general context should be loaded before specific context (OVERVIEW chain → referenced files → task rules)
2. **Scope detection was missing** — agent knew HOW to load OVERVIEW chain but didn't know WHICH level to stop at (project vs repo vs feature)
3. **Search scope was undefined** — for Question tasks, agent didn't know WHERE to search for answers
4. **project-structure.md was ~80% redundant** — most content already existed in workspace rules and rule.md

## Changes Made

### Round 1: Core Improvements

#### 1. Task Detection — Structured Patterns (`rule.md`)

**Before:** Simple table listing 5 task types with descriptions only.

**After:** Three sub-sections:
- **Detection Rules** — keyword signals → task type → rule file mapping
- **Detection Examples** — 5 concrete examples with reasoning
- **Ambiguity Resolution** — 3 rules for overlapping signals

"Dynamic Rules" section renamed to **Contextual Rules** — only contains rules not tied to specific task types.

#### 2. YAML Frontmatter (`rule.md`)

Added frontmatter to document that `rule.md` is the source of truth for the `AGENTS.md` symlink. Hidden in markdown preview.

#### 3. Plan Template — Separated Runtime Instructions

**Template** (`agent/templates/common/create-plan.md`):
- Removed all blockquote agent instructions
- Replaced with HTML comments (`<!-- ... -->`) describing section purpose
- Template is now pure structure

**Task rule** (`agent/rules/common/tasks/create-plan.md`):
- Added **Generation Rules** section with behavioral instructions moved from template
- Explicit rule to remove HTML comments from generated output

#### 4. Implementation Rule — Expanded (`implementation.md`)

From 24 lines → 57 lines. Added:
- **Change Strategy** — single-file, multi-file (dependency order, interface first), large tasks (decompose, checkpoint)
- **Validation Checkpoints** — 4-step verify after each change
- **Error Recovery** — identify scope → fix forward → rollback → report

### Round 2: Scope Detection + Context Resolution

#### 5. Scope Detection (`business-project.md`)

Added `<FEATURE_NAME>` to Path Variables. New **Scope Detection** section:

| Path Contains | Scope |
|---|---|
| `_features/<FEATURE>/` | feature |
| `<PROJECT>/<DOMAIN>/<REPO>/` | repo |
| `<PROJECT>/` only | project |

5 examples covering: feature path, feature-level plan, repo-level plan, source code, project-level.

#### 6. Scope Detection (`devtools.md`)

Added `<DOMAIN>`, `<PACKAGE_NAME>` to Path Variables. New **Scope Detection** section:

| Path Contains | Scope |
|---|---|
| `<DOMAIN>/<PACKAGE>/` | package |
| `devtools/` only | global |

4 examples covering: source code, package docs, global plan, CLI package.

#### 7. Context Loading Order (both workspace rules)

Rewrote **Required Context Loading** with enforced sequential order:

```
1. OVERVIEW chain (general → specific, stop at detected scope level)
2. Referenced files (user-provided: plan, spike, guide, etc.)
3. Task rule (create-plan.md or implementation.md)
```

Rationale: general context first establishes mental model, then specific context is interpreted correctly, then actionable instructions guide execution.

#### 8. Search Scope (both workspace rules)

New **Search Scope** section defining where to search per scope level:

**business-project:** feature → repo docs + source | repo → repo docs + source | project → project docs + all repo OVERVIEWs

**devtools:** package → package docs + source | global → all docs + all OVERVIEWs

#### 9. Context Resolution — DEBUG Step (`rule.md`)

Temporary step in Execution Flow. Agent must present detection results and context file list to user and **WAIT for confirmation** before loading. Purpose: validate workflow rules are working correctly.

#### 10. Execution Flow — 7 Steps (`rule.md`)

Updated from 4 steps to 7:

```
1. Read user input
2. Workspace Detection (load meta-rule)
3. Scope Detection (extract variables, determine level)
4. Task Detection (identify task type)
5. Context Resolution (DEBUG — present & confirm)
6. Context Loading (OVERVIEW chain → referenced files → task rule)
7. Execute Task
```

### Round 3: Reduce Redundancy

#### 11. Slimmed `project-structure.md`

From 146 lines → 40 lines. Kept only the top-level directory tree overview. Removed all content already covered in workspace rules and rule.md.

## Design Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| Scope Detection in workspace rules, not in rule.md | Each workspace has different scope levels (feature/repo/project vs package/global) |
| Loading order: general → specific → actionable | LLM attention bias — earlier context frames interpretation of later context |
| Context Resolution as DEBUG step | Temporary — validates workflow before trusting it to run autonomously |
| Keep project-structure.md (slimmed) | Bird's eye view of entire workspace that no single workspace rule provides |
| Referenced files loaded AFTER OVERVIEW chain | Plan/spike references are interpreted more accurately with project context established |
| Task rule loaded LAST | Execution instructions are most effective when all context is already loaded |

## Remaining Items (Not Yet Addressed)

| # | Item | Notes |
|---|------|-------|
| D | business-project.md missing Skill Loading | Skills like code-review, bitbucket not triggered |
| G | No warm context between sessions | Could use a `.last-context.md` file |
| H | Commands/Skills sync is manual | Script not documented |
| A | Context loading cost still high | Could explore merged scenario files (e.g. business-project-implementation.md) |
| - | Debate rules not referenced from main flow | `agent/rules/common/debate/` exists but only loaded by commands |
| - | Remove Context Resolution DEBUG step | When workflow is validated and stable |

## Files Modified

| File | Action |
|------|--------|
| `agent/rules/common/rule.md` | Added frontmatter, restructured Task Detection, added Context Resolution, updated Execution Flow |
| `agent/rules/common/workspaces/business-project.md` | Added FEATURE_NAME, Scope Detection, Search Scope, rewrote Context Loading order |
| `agent/rules/common/workspaces/devtools.md` | Added Path Variables, Scope Detection, Search Scope, rewrote Context Loading order |
| `agent/rules/common/tasks/create-plan.md` | Added Generation Rules section (moved from template) |
| `agent/rules/common/tasks/implementation.md` | Added Change Strategy, Validation Checkpoints, Error Recovery |
| `agent/templates/common/create-plan.md` | Cleaned — removed runtime instructions, replaced with HTML comments |
| `agent/rules/common/project-structure.md` | Slimmed from 146 → 40 lines, kept directory tree only |
