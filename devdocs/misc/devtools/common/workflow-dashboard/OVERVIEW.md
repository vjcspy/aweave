# Workflow Dashboard (`@aweave/workflow-dashboard`)

> **Source:** `devtools/common/workflow-dashboard/`
> **Last Updated:** 2026-02-09

Ink v6 + React 19 terminal dashboard cho workflow engine. Reusable component — bất kỳ workflow plugin nào cũng import `WorkflowDashboard` và truyền xstate actor vào. Dashboard subscribe context qua `@xstate/react` hooks và render real-time.

## Purpose

- **Real-time workflow UI** — Stage/task tree sidebar + main panel (logs, detail, streaming, human input)
- **Keyboard navigation** — ↑↓ Enter Esc 1-9 a q — Ink không support mouse
- **Reusable** — Workflow plugins chỉ cần `render(<WorkflowDashboard actor={actor} />)`
- **All custom components** — Không dùng community Ink packages (peer dep conflicts với Ink v6)

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  @aweave/workflow-dashboard                    │
│                     (ESM oclif-ready)                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  WorkflowDashboard.tsx                                       │
│  ├── useSelector(actor, selectContext)   ← @xstate/react     │
│  ├── useState(selectedTask)             ← React (not xstate) │
│  ├── useNavigation() hook               ← keyboard handling  │
│  ├── <StageTree />                      ← left sidebar       │
│  ├── <MainPanel />                      ← right panel        │
│  ├── <ElapsedTime />                    ← header timer       │
│  └── Footer with keybindings                                │
│                                                              │
│  StageTree.tsx              MainPanel.tsx                     │
│  ├── buildNavItems()        ├── Mode: live (rolling logs)    │
│  ├── StageStatusIcon        ├── Mode: task-detail (full)     │
│  └── <TaskRow /> per task   ├── Mode: human-input (prompt)   │
│                             └── Mode: summary (completed)    │
│  TaskRow.tsx                                                 │
│  ├── Strategy icon (→ ∥ ⚡)  HumanInputPanel.tsx             │
│  ├── Status icon             ├── OptionSelect (↑↓ Enter)     │
│  ├── Task name               └── FreeTextInput (type + Enter)│
│  └── Duration                                                │
│                                                              │
│  Spinner.tsx                 ElapsedTime.tsx                  │
│  └── ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ (80ms)     └── MM:SS / HH:MM:SS (1s)      │
│                                                              │
│  hooks/useNavigation.ts                                      │
│  └── useInput() → cursorIndex, ↑↓ Enter Esc 1-9 a q         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Visual Layout

Dashboard uses full terminal width:

```
┌─ Demo Pipeline ──────────────── RUNNING ─── 00:01:23 ──────────┐
│                                                                  │
│  Stages                    │  Live                               │
│  ✅ Validate Environment   │  17:28:01 [INFO] Checking Node...   │
│   ∥ ✅ Check Node.js       │  17:28:01 [INFO] Node.js v22.20.0  │
│   ∥ ✅ Check Git           │  17:28:01 [INFO] Branch: feature/.. │
│   ∥ ✅ Check Disk          │  17:28:02 [INFO] Running unit tests │
│  ⠹ Run Tests (Race)       │                                     │
│   ⚡ ⠹ Unit Tests          │  ── Unit Tests ──                   │
│   ⚡ ⠹ Integration Tests   │    PASS src/utils/math.test.ts      │
│   ⚡ ⠹ E2E Tests           │    PASS src/utils/string.test.ts    │
│  ⬜ Code Analysis          │                                     │
│  ⬜ Review & Approve       │                                     │
│                            │                                     │
│ [↑↓] navigate [Enter] select [Esc] back [1-9] jump [a] abort [q]│
└──────────────────────────────────────────────────────────────────┘
```

### Status icons

| Icon | Status | Color |
|------|--------|-------|
| ⬜ | pending | dimmed |
| ⠹ | running | cyan (animated) |
| ✅ | success | green |
| ❌ | failed/error | red |
| ⊘ | cancelled | dimmed |
| ⏭ | skipped | dimmed |

### Strategy icons (before tasks)

| Icon | Strategy |
|------|----------|
| → | sequential |
| ∥ | parallel |
| ⚡ | race |

### Main panel modes

| Mode | When | Content |
|------|------|---------|
| `live` | Default, no task selected | Rolling logs + streaming from active task |
| `task-detail` | User pressed Enter on a task | Status, error, output.detail, streamBuffer, task logs |
| `human-input` | Task called `waitForInput()` | Prompt + option list or text input |
| `summary` | Workflow completed | Stage list with status and duration |

## Key Design Decision: `selectedTask` in React

`selectedTask` is React `useState`, NOT xstate context. Reason: xstate final states (`completed`/`failed`/`aborted`) don't process events. If `selectedTask` were in xstate, pressing Enter on a task after workflow completion would be silently ignored.

## Dependencies

| Package | Role |
|---------|------|
| `@aweave/workflow-engine` (workspace:*) | Types (`WorkflowActor`, `WorkflowState`, etc.) |
| `@xstate/react` (^4) | `useSelector` hook to subscribe to xstate actor |
| `ink` (^6.6.0) | Terminal UI rendering framework (ESM-only) |
| `react` (^19.0.0) | Component model for Ink |
| `xstate` (^5) | Peer dependency for `@xstate/react` |

**No community Ink packages.** `ink-spinner`, `ink-select-input`, `ink-text-input` have peer dep conflicts với Ink v6/React 19. All UI components custom-built from Ink primitives.

## Exports

```typescript
export { WorkflowDashboard } from './components/WorkflowDashboard.js';
export { StageTree, buildNavItems } from './components/StageTree.js';
export type { NavItem } from './components/StageTree.js';
export { MainPanel } from './components/MainPanel.js';
export { TaskRow } from './components/TaskRow.js';
export { HumanInputPanel } from './components/HumanInputPanel.js';
export { ElapsedTime } from './components/ElapsedTime.js';
export { Spinner } from './components/Spinner.js';
export { useNavigation } from './hooks/useNavigation.js';
```

## Usage in Workflow Plugin

```typescript
import { render } from 'ink';
import React from 'react';
import { createActor } from 'xstate';
import { workflowMachine } from '@aweave/workflow-engine';
import { WorkflowDashboard } from '@aweave/workflow-dashboard';

const actor = createActor(workflowMachine, {
  input: { definition: myWorkflow, workflowInput: { ...flags } },
});

actor.start();
actor.send({ type: 'START' });

const { waitUntilExit } = render(React.createElement(WorkflowDashboard, { actor }));
await waitUntilExit();
```

**TTY check required** — Ink's `useInput` needs raw mode. Check before rendering:

```typescript
const canInteractive = process.stdin.isTTY && typeof process.stdin.setRawMode === 'function';
```

## Project Structure

```
devtools/common/workflow-dashboard/
├── package.json                    # "type": "module", ink + react + @xstate/react
├── tsconfig.json                   # module: Node16, jsx: react-jsx
├── eslint.config.mjs
└── src/
    ├── index.ts                    # Barrel exports
    ├── components/
    │   ├── WorkflowDashboard.tsx   # Root: header + sidebar + main + footer
    │   ├── StageTree.tsx           # Left sidebar: stage/task tree + buildNavItems()
    │   ├── MainPanel.tsx           # Right panel: 4 modes (live/detail/input/summary)
    │   ├── TaskRow.tsx             # Single task: strategy icon + status + name + duration
    │   ├── HumanInputPanel.tsx     # Option select (↑↓) or free text input
    │   ├── ElapsedTime.tsx         # Live timer updating every 1s
    │   └── Spinner.tsx             # Braille animation (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏) every 80ms
    └── hooks/
        └── useNavigation.ts        # Keyboard handler: ↑↓ Enter Esc 1-9 a q
```

## Development

```bash
cd devtools/common/workflow-dashboard

# Build (REQUIRED — ESM plugin, no dev mode)
pnpm build

# Build order: workflow-engine → workflow-dashboard → cli-plugin-*
# Engine must be built first (dashboard imports types from it)
```

## Related

- **Engine:** `devtools/common/workflow-engine/` — `devdocs/misc/devtools/common/workflow-engine/OVERVIEW.md`
- **Demo Workflow:** `devtools/common/cli-plugin-demo-workflow/` — `devdocs/misc/devtools/common/cli-plugin-demo-workflow/OVERVIEW.md`
- **Dashboard Plugin (existing, similar):** `devdocs/misc/devtools/common/cli-plugin-dashboard/OVERVIEW.md`
- **Design Plan:** `devdocs/misc/devtools/common/plans/260208-workflow-engine.md`
- **Builder Skill:** `devdocs/agent/skills/common/workflow-builder/SKILL.md`
- **Global Overview:** `devdocs/misc/devtools/OVERVIEW.md`
