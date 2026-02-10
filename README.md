# aweave

> *AI + Weave — Weaving engineering context with intelligence*

A platform for working with AI Agents at maximum efficiency — from code, documentation, to operations. **aweave** provides the structure, context, and tools so that AI agents can understand your codebase deeply and collaborate effectively.

## Overview

**aweave** consolidates projects, documentation, and developer tools under a single root:

- **Structured Context for AI** — Documentation, rules, and commands organized so AI agents load exactly the context they need
- **Multi-Project Workspace** — Manage multiple independent projects with consistent conventions
- **DevTools Ecosystem** — CLI tools and applications that extend AI agent capabilities beyond code editing

## Directory Structure

```
<PROJECT_ROOT>/
├── devdocs/                    # Documentation & AI Agent context
│   ├── agent/                  # Agent configurations
│   │   ├── commands/           # Custom agent commands
│   │   ├── templates/          # Document templates
│   │   └── rules/              # Working protocols & guidelines
│   ├── misc/                   # Cross-domain documentation
│   │   └── devtools/           # DevTools documentation per domain
│   └── projects/               # Project-specific documentation
│       └── <PROJECT_NAME>/     # Mirrors projects/ structure
│           ├── OVERVIEW.md     # Global project overview
│           └── <DOMAIN>/<REPO>/
│               ├── OVERVIEW.md # Repository overview
│               └── plans/      # Implementation plans
│
├── devtools/                   # Development tools & utilities
│   ├── common/                 # Shared tools across all projects
│   └── <PROJECT_NAME>/         # Project-specific devtools
│
├── projects/                   # Source code (gitignored)
│   └── <PROJECT_NAME>/         # Project container
│       └── <DOMAIN>/           # Domain grouping
│           └── <REPO>/         # Individual repository
│
├── AGENTS.md                   # AI Agent entry point
└── README.md                   # This file
```

## How AI Context Works

The key to effective AI collaboration is **structured context loading**. Instead of dumping everything into the AI's context window, aweave loads context lazily based on what you're working on.

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
| `projects/<project>/...` | Business Project | Project & repo OVERVIEW files |
| `devtools/...` | DevTools | DevTools OVERVIEW files |
| General question | None | No extra context |

### Context Layers

```
AGENTS.md (always loaded)
  → Workspace rules (loaded per workspace type)
    → OVERVIEW.md files (project/repo context)
      → Task rules (coding standards, plan templates, etc.)
        → Agent commands (debate, docs, etc.)
```

Each layer is loaded **only when needed**, keeping the context window efficient.

### Path Conventions

| Path Pattern | Description | Example |
|--------------|-------------|---------|
| `projects/<PROJECT>/<DOMAIN>/<REPO>/` | Source code | `projects/tinybots/backend/wonkers-api/` |
| `devdocs/projects/<PROJECT>/<DOMAIN>/<REPO>/` | Documentation | `devdocs/projects/tinybots/backend/wonkers-api/` |
| `devtools/<PROJECT>/local/` | Local dev tools | `devtools/tinybots/local/` |

> **Tip:** Always specify a path when asking AI to work on code. This triggers the correct workspace detection and context loading.

## DevTools

### Debate

Let two AI agents debate a topic (e.g. review an implementation plan) while you monitor and arbitrate via a web dashboard.

#### How to Use

**Session 1 — Proposer** (creates the debate):

Ask the AI agent to read `devdocs/agent/commands/common/debate-proposer.md`, then provide the document/topic you want debated. The agent will create the debate and wait for the opponent.

**Session 2 — Opponent** (joins the debate):

In a separate AI agent session, ask it to read `devdocs/agent/commands/common/debate-opponent.md`, then provide the `debate_id` from session 1. The agent will review and challenge the proposal.

**Monitor** — Open the debate-web dashboard at [http://localhost:3457](http://localhost:3457) to watch the conversation in real-time, intervene, or submit rulings as Arbitrator.

Both agents handle the entire flow automatically — creating arguments, waiting for responses, revising documents, and closing the debate when consensus is reached.

## Documentation

- **AI Agent Entry Point**: `AGENTS.md`
- **Agent Rules**: `devdocs/agent/rules/`
- **Agent Commands**: `devdocs/agent/commands/`
- **Project Overviews**: `devdocs/projects/<PROJECT>/OVERVIEW.md`
- **DevTools Docs**: `devdocs/misc/devtools/`

## License

Private repository. All rights reserved.
