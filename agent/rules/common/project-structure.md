# Project Structure Convention

Standard directory structure for the entire workspace:

```text
<PROJECT_ROOT>/
├── agent/                      # AI Agent brain
│   ├── commands/               # Custom agent commands
│   ├── rules/                  # Working protocols & guidelines
│   │   └── common/             # Shared rules (hot memory sources + workspace rules)
│   └── skills/                 # Domain-specific agent skills
│
├── resources/                  # Documentation & context
│   ├── workspaces/             # Workspace-specific docs (mirrors workspaces/)
│   │   ├── devtools/           # DevTools documentation
│   │   │   ├── OVERVIEW.md     # Global devtools overview (front-matter = T0)
│   │   │   └── <DOMAIN>/       # Per-domain/package docs
│   │   └── <WORKSPACE>/
│   │       ├── OVERVIEW.md     # Global workspace overview (front-matter = T0)
│   │       └── <DOMAIN>/
│   │           └── <REPO_NAME>/
│   │               ├── OVERVIEW.md      # Repository overview (front-matter = T0)
│   │               ├── _features/       # Business feature documentation
│   │               ├── _plans/          # Implementation plans
│   │               ├── _spikes/         # Technical investigations
│   │               ├── _architecture/   # Architecture docs & ADRs
│   │               ├── _decisions/      # Architectural/design decisions
│   │               ├── _lessons/        # Lessons learned & gotchas
│   │               ├── _guides/         # Developer guides
│   │               └── _releases/       # Release documentation
│   └── misc/                   # Cross-cutting documentation
│
├── workspaces/                 # Source code
│   ├── devtools/               # Platform tooling (tracked in git)
│   │   ├── common/             # Shared tools across domains
│   │   ├── <DOMAIN>/           # Domain-specific devtools
│   │   └── pnpm-workspace.yaml # Monorepo config
│   └── <WORKSPACE>/            # Business workspaces (gitignored)
│       └── <DOMAIN>/
│           └── <REPO_NAME>/    # Individual repository
│
├── user/                       # User-specific data
│   ├── profile.md
│   ├── preferences.yaml
│   ├── bookmarks.md
│   ├── snippets/
│   └── context/
│
└── AGENTS.md
```
