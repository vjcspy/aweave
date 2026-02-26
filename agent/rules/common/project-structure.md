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
│   ├── memory/                 # Decisions & lessons (per-workspace)
│   │   └── workspaces/
│   │       └── <WORKSPACE>/
│   │           ├── _index.yaml # Memory metadata index
│   │           ├── decisions.md
│   │           └── lessons.md
│   ├── profile.md
│   ├── preferences.yaml
│   ├── bookmarks.md
│   ├── snippets/
│   └── context/
│
├── .aweave/
│   └── loaded-skills.yaml      # Active agent skills configuration
│
└── AGENTS.md                   # AI Agent entry point (symlink → agent/rules/common/agent-entry-point.md)
```

> For detailed path variables, scope detection, and context loading rules, see the workspace-specific rule files at `agent/rules/common/workspaces/`.
