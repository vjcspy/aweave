# aweave

> *AI + Weave — Weaving engineering context with intelligence*

A platform for working with AI Agents at maximum efficiency — from code, documentation, to operations. **aweave** provides the structure, context, and tools so that AI agents can understand your codebase deeply and collaborate effectively.

## Overview

**aweave** consolidates workspaces, documentation, and developer tools under a single root:

- **Structured Context for AI** — Documentation, rules, and commands organized so AI agents load exactly the context they need
- **Multi-Workspace Platform** — Manage multiple independent workspaces with consistent conventions
- **DevTools Ecosystem** — CLI tools and applications that extend AI agent capabilities beyond code editing
- **Tiered Context Loading** — ABSTRACT.md (L0) + OVERVIEW.md (L1) + detailed docs (L2) minimize token consumption

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
│   │   │   ├── ABSTRACT.md        # L0 summary
│   │   │   ├── OVERVIEW.md        # L1 full overview
│   │   │   └── common/<PACKAGE>/  # Per-package docs
│   │   └── <WORKSPACE>/           # Business workspace docs
│   │       ├── ABSTRACT.md        # L0 summary
│   │       ├── OVERVIEW.md        # L1 workspace overview
│   │       └── <DOMAIN>/<REPO>/
│   │           ├── ABSTRACT.md    # L0 summary
│   │           ├── OVERVIEW.md    # L1 repo overview
│   │           └── _plans/        # L2 detailed docs
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
│   ├── memory/                    # AI agent memory across sessions
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
| **L0 (Abstract)** | `ABSTRACT.md` | 100-200 tokens | Quick identification — agent reads to decide if this entity is relevant |
| **L1 (Overview)** | `OVERVIEW.md` | 1-2 pages | Core information — architecture, key paths, usage for planning |
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
    → ABSTRACT.md (L0 — quick identification)
      → OVERVIEW.md (L1 — core context)
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
