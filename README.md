# aweave

> *AI + Weave — Weaving engineering context with intelligence*

A platform for working with AI Agents at maximum efficiency — from code, documentation, to operations. **aweave** provides the structure, context, and tools so that AI agents can understand your codebase deeply and collaborate effectively.

## Overview

### Challenges in AI-Assisted Development

AI coding agents are powerful, but their effectiveness depends entirely on the quality of context they receive. In real-world multi-project environments, developers face persistent friction:

- **Fragmented Context** — Source code lives in cloned repos, documentation is scattered across wikis and READMEs, architecture decisions exist only in Microsoft Teams. Agents have no unified place to find what they need.
- **Context Window Exhaustion** — Stuffing entire OVERVIEWs, plans, and codebases into a single prompt is expensive, noisy, and often exceeds model limits. Most of that context is irrelevant to the current task.
- **No Workspace Awareness** — Agents treat every request the same regardless of which project, domain, or repository you're working in. They can't automatically load the right architecture docs or coding conventions.
- **Agent Capabilities Stop at Code** — IDE-based agents can read and write files, but they can't authenticate to internal services, orchestrate multi-agent debates, trace production logs, or manage local infrastructure.
- **Lost Institutional Knowledge** — Context painstakingly built in one session — decisions made, patterns learned, preferences expressed — vanishes when the session ends.
- **No Structure for Agent Behavior** — Agent instructions are ad-hoc prompts rather than versioned, composable rules. There's no systematic way to define how agents should plan, review, or implement across different projects.

### The aweave Solution

**aweave** is a workspace platform designed specifically for AI Agent collaboration. It provides structure, context, and tooling so agents operate with deep understanding of your codebase — not shallow pattern matching.

The core idea: **treat the agent's working environment like a well-organized brain** — with clear separation between knowledge (resources), behavior (agent rules), capabilities (devtools), and memory (user data).

- **Filesystem-Based Context Management** — Unified organization of source code, documentation, agent rules, and user data under one root. No vector databases, no external services — just files and directories that both humans and agents can navigate naturally.

- **Tiered Context Loading** — Context is loaded in layers: L0 (front-matter summaries from `OVERVIEW.md`), L1 (`OVERVIEW.md` full content when needed), and L2 (detailed docs like `_plans/`, `_architecture/`, `_decisions/`, `_lessons/`). Agents start with lightweight summaries and only dive deeper when required.

- **Workspace-Aware Routing** — Agents detect which workspace, domain, and repository you're working in from your input path, then automatically load the relevant architecture docs, coding standards, and conventions. No manual context stuffing required.

- **Composable Agent Brain** — Rules, commands, skills, and templates are versioned files organized by scope (common vs. workspace-specific). Agents load behavior definitions dynamically — coding standards when writing code, plan templates when planning, debate protocols when reviewing.

- **Agent-Native DevTools** — A unified CLI (`aw`) and backend server that extend agent capabilities beyond the IDE. Agents can autonomously authenticate to internal services, orchestrate multi-agent debates for plan review, trace production logs, manage local infrastructure, and more — all through structured CLI commands designed for machine consumption.

- **Branch-Based Workspace Isolation** — Each workspace lives on its own git branch. The `master` branch is the template with shared infrastructure. Workspace branches merge master and add workspace-specific docs, rules, and tools. Clean separation without repo sprawl.

- **Persistent User Context** — Dedicated `user/` directory for profile, preferences, snippets, and personal context. Project decisions and lessons are documented in workspace resources (`_decisions/`, `_lessons/`) so agents can retrieve them consistently across sessions.

## Directory Structure

```
<PROJECT_ROOT>/
├── agent/                         # AI Agent brain
│   ├── commands/                  # Custom agent commands
│   ├── templates/                 # Document templates
│   ├── rules/                     # Working protocols & guidelines
│   └── skills/                    # Domain-specific agent skills
│
├── resources/                     # Documentation & context
│   ├── workspaces/                # Workspace-specific docs
│   │   ├── devtools/              # DevTools documentation
│   │   │   ├── OVERVIEW.md        # L0 front-matter + L1 full overview
│   │   │   └── common/<PACKAGE>/  # Per-package docs
│   │   └── <WORKSPACE>/           # Business workspace docs
│   │       ├── OVERVIEW.md        # L0 front-matter + L1 workspace overview
│   │       └── <DOMAIN>/<REPO>/
│   │           ├── OVERVIEW.md    # L0 front-matter + L1 repo overview
│   │           ├── _plans/        # L2 detailed docs
│   │           ├── _decisions/    # Architectural and technical decisions
│   │           └── _lessons/      # Lessons learned and troubleshooting notes
│   └── misc/                      # Cross-cutting documentation
│
├── workspaces/                    # Source code
│   ├── devtools/                  # Platform tooling (tracked in git)
│   │   ├── common/                # Shared tools across domains
│   │   └── <DOMAIN>/              # Domain-specific devtools
│   └── <WORKSPACE>/               # Business workspaces (gitignored)
│       └── <DOMAIN>/<REPO>/       # Individual repository
│
├── user/                          # User-specific data
│   ├── profile.md                 # User identity & preferences
│   ├── preferences.yaml           # Agent behavior config
│   ├── bookmarks.md               # Quick links
│   ├── snippets/                  # Reusable code templates
│   └── context/                   # Long-term context files
│
├── AGENTS.md                      # AI Agent entry point
└── README.md                      # This file
```

## How AI Context Works

The key to effective AI collaboration is **structured context loading**. Instead of dumping everything into the AI's context window, aweave loads context lazily based on what you're working on.

### Tiered Context Loading

Every documented entity has up to three tiers of context:

| Tier | File | Size | Purpose |
|------|------|------|---------|
| **L0 (Summary)** | `OVERVIEW.md` front-matter (`name`, `description`, `tags`) | 1-3 lines | Quick orientation — returned in `defaults.overviews` |
| **L1 (Overview)** | `OVERVIEW.md` body | 1-2 pages | Core information — architecture, key paths, usage for planning |
| **L2 (Details)** | `_plans/`, `_architecture/`, etc. | Full docs | Deep reading — only when agent needs implementation details |

### Entry Point: `AGENTS.md`

`AGENTS.md` is the entry point for all AI agents. It defines:

1. **Core Principles** — Language agnostic, context-aware, safety-first conventions
2. **Workspace Detection** — AI automatically detects what you're working on from your input path and loads the appropriate context
3. **Task Detection** — Identifies whether you're planning, implementing, refactoring, or asking questions
4. **Dynamic Rules** — Additional rules (coding standards, task-specific protocols) are loaded only when needed

### Workspace-Aware Routing

AI agents detect workspace type from your input and load relevant context automatically:

| Your Input Contains | Workspace Type | What Gets Loaded |
|---------------------|----------------|------------------|
| `workspaces/<ws>/...` | Business Workspace | Workspace & repo OVERVIEW files |
| `workspaces/devtools/...` | DevTools | DevTools OVERVIEW files |
| General question | None | No extra context |

### Context Layers

```
AGENTS.md (always loaded)
  → Workspace rules (loaded per workspace type)
    → workspace_get_context defaults (folder_structure + overviews + loaded_skills)
      → OVERVIEW.md / topic docs (L1/L2 when needed)
        → Task rules (coding standards, plan templates, etc.)
          → Agent commands (debate, docs, etc.)
```

Each layer is loaded **only when needed**, keeping the context window efficient.

### Path Conventions

| Path Pattern | Description | Example |
|--------------|-------------|---------|
| `workspaces/<WS>/<DOMAIN>/<REPO>/` | Source code | `workspaces/k/stock/metan/` |
| `resources/workspaces/<WS>/<DOMAIN>/<REPO>/` | Documentation | `resources/workspaces/k/stock/metan/` |
| `workspaces/devtools/<DOMAIN>/` | DevTools source | `workspaces/devtools/common/cli/` |

> **Tip:** Always specify a path when asking AI to work on code. This triggers the correct workspace detection and context loading.

## DevTools

### Workspace Memory

Use workspace memory tooling to load context on-demand and keep the agent entry point in sync.

```bash
# Get default workspace context (folder_structure, overviews, loaded_skills)
aw workspace get-context --workspace devtools

# Get targeted context without defaults to save tokens
aw workspace get-context --workspace devtools --topics plans,architecture --no-defaults

# Rebuild AGENTS.md from hot-memory source files
aw workspace build-rules
```

### Auth

Browser-based SSO authentication for NAB internal services.

```bash
# Login to OpenSearch (opens browser for SSO)
aw auth login -s opensearch -e sit

# Check credential status
aw auth status

# Clear browser session data (SSO cookies, cached profiles)
aw auth clear-session
```

First login requires full SSO (email + password + MFA). Subsequent logins reuse the browser session — auto-select account or skip password entirely.

### Debate

Let two AI agents debate a topic (e.g. review an implementation plan) while you monitor and arbitrate via a web dashboard.

#### How to Use

**Session 1 — Proposer** (creates the debate):

Ask the AI agent to read `agent/commands/common/debate-proposer.md`, then provide the document/topic you want debated. The agent will create the debate and wait for the opponent.

**Session 2 — Opponent** (joins the debate):

In a separate AI agent session, ask it to read `agent/commands/common/debate-opponent.md`, then provide the `debate_id` from session 1. The agent will review and challenge the proposal.

**Monitor** — Open the debate-web dashboard at [http://localhost:3457](http://localhost:3457) to watch the conversation in real-time, intervene, or submit rulings as Arbitrator.

Both agents handle the entire flow automatically — creating arguments, waiting for responses, revising documents, and closing the debate when consensus is reached.

## Documentation

- **AI Agent Entry Point**: `AGENTS.md`
- **Agent Rules**: `agent/rules/`
- **Agent Commands**: `agent/commands/`
- **Workspace Overviews**: `resources/workspaces/<WS>/OVERVIEW.md`
- **DevTools Docs**: `resources/workspaces/devtools/`

## License

Private repository. All rights reserved.
