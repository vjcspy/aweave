# Project Structure Convention

Standard directory structure for the entire workspace:

```text
<PROJECT_ROOT>/
├── agent/                      # AI Agent brain
│   ├── commands/               # Custom agent commands
│   ├── templates/              # Document templates
│   ├── rules/                  # Working protocols & guidelines
│   └── skills/                 # Domain-specific agent skills
│
├── resources/                  # Documentation & context
│   ├── workspaces/             # Workspace-specific docs (mirrors workspaces/)
│   │   ├── devtools/           # DevTools documentation
│   │   │   ├── OVERVIEW.md     # Global devtools overview
│   │   │   └── <DOMAIN>/       # Per-domain/package docs
│   │   └── <WORKSPACE>/
│   │       ├── OVERVIEW.md     # Global workspace overview
│   │       └── <DOMAIN>/
│   │           └── <REPO_NAME>/
│   │               ├── ABSTRACT.md      # L0 summary (100-200 tokens)
│   │               ├── OVERVIEW.md      # Repository overview
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
│   │   ├── scripts/            # Shared scripts
│   │   └── pnpm-workspace.yaml # Monorepo config
│   └── <WORKSPACE>/            # Business workspaces (gitignored)
│       └── <DOMAIN>/
│           └── <REPO_NAME>/    # Individual repository
│
├── user/                       # User-specific data
│   ├── profile.md
│   ├── preferences.yaml
│   ├── bookmarks.md
│   ├── memory/
│   ├── snippets/
│   └── context/
│
└── AGENTS.md                   # AI Agent entry point
```

> For detailed path variables, scope detection, and context loading rules, see the workspace-specific rule files at `agent/rules/common/workspaces/`.
