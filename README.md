# aweave

> *AI + Weave — Weaving engineering context with intelligence*

An AI-first engineering platform that weaves together code, documentation, operations, and context into a unified workspace.

## Overview

**aweave** consolidates multiple projects and tools under a single root, enabling:

- **AI-First Development** — Optimized for AI coding assistants with structured context
- **Context Weaving** — Pull context from Confluence, logs, incidents into actionable insights
- **Requirements Management** — Extract, sync, and track requirements across sources
- **Centralized DevTools** — Shared infrastructure for local dev, testing, and operations
- **Multi-Project Support** — Manage multiple independent projects in one workspace

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
│   │   └── cli/                # Shared CLI tools (dt)
│   └── <PROJECT_NAME>/         # Project-specific devtools
│       └── local/              # Local dev infrastructure
│           ├── docker-compose.yaml
│           ├── Justfile        # Just commands
│           └── prisma/         # Database schemas
│
├── projects/                   # Source code root
│   └── <PROJECT_NAME>/         # Project container
│       └── <DOMAIN>/           # Domain grouping
│           └── <REPO>/         # Individual repository
│
├── AGENTS.md                   # AI Agent instructions (symlink)
└── README.md                   # This file
```

## Path Conventions

| Path Pattern | Description | Example |
|--------------|-------------|---------|
| `projects/<PROJECT>/<DOMAIN>/<REPO>/` | Source code | `projects/tinybots/backend/wonkers-api/` |
| `devdocs/projects/<PROJECT>/<DOMAIN>/<REPO>/` | Documentation | `devdocs/projects/tinybots/backend/wonkers-api/` |
| `devtools/<PROJECT>/local/` | Local dev tools | `devtools/tinybots/local/` |

## Working with AI Agents

This workspace is optimized for AI coding assistants. The `AGENTS.md` file contains detailed instructions for AI agents.

### Workspace-Aware Routing

AI agents automatically detect workspace type from your input:

| Your Input Contains | Workspace Type | Context Loaded |
|---------------------|----------------|----------------|
| `projects/<project>/...` | Business Project | Project & Repo OVERVIEW |
| `devtools/...` | DevTools | DevTools OVERVIEW |
| `devdocs/misc/devtools/...` | DevTools | DevTools OVERVIEW |
| General question | None | No extra context |

### Key Rules for AI Agents

1. **Specify the path** when working with code:
   - Business projects: `projects/<PROJECT>/<DOMAIN>/<REPO>/`
   - DevTools: `devtools/<domain>/<package>/`

2. **Context is loaded automatically** based on detected workspace

3. **Use DevTools** for local development:
   ```bash
   just -f devtools/<PROJECT>/local/Justfile <command>
   ```

## Current Projects

| Project | Description | DevTools |
|---------|-------------|----------|
| `tinybots` | Backend services for telemetry & automation | `devtools/tinybots/local/` |
| `vocalmeet` | WordPress-based assessment platform | `devtools/vocalmeet/local/` |

## Quick Start

### Prerequisites

- [Just](https://github.com/casey/just) — Command runner
- [Docker](https://www.docker.com/) — Container runtime
- [uv](https://github.com/astral-sh/uv) — Python package manager (for CLI tools)
- [pnpm](https://pnpm.io/) — Node.js package manager

### DevTools CLI

```bash
# Install the dt CLI tool
cd devtools && ./scripts/install-all.sh

# Use dt commands
dt <command>
```

### Project-Specific Commands

```bash
# TinyBots example
just -f devtools/tinybots/local/Justfile start-wonkers-api
just -f devtools/tinybots/local/Justfile test-wonkers-api

# Vocalmeet example
just -f devtools/vocalmeet/local/Justfile up
just -f devtools/vocalmeet/local/Justfile logs
```

## Documentation

- **AI Agent Rules**: See `AGENTS.md` for AI assistant guidelines
- **DevTools Guide**: See `devtools/README.md` for development tools
- **Project Overviews**: See `devdocs/projects/<PROJECT>/OVERVIEW.md` for each project

## License

Private repository. All rights reserved.
