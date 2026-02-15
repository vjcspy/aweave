# Project Structure Convention

Standard directory structure for the entire workspace:

```text
<PROJECT_ROOT>/
├── devdocs/                    # AI Agent context & documentation
│   ├── agent/                  # Agent-specific configurations
│   │   ├── commands/           # Custom agent commands
│   │   ├── templates/          # Document templates (plans, releases, etc.)
│   │   ├── rules/              # Working protocols & guidelines
│   │   └── skills/             # Domain-specific agent skills
│   ├── misc/                   # Cross-domain documentation
│   │   └── devtools/           # DevTools documentation
│   │       ├── OVERVIEW.md     # Global devtools overview
│   │       └── <DOMAIN>/       # Per-domain/package docs
│   └── projects/               # Project-specific documentation (mirrors projects/)
│       └── <PROJECT_NAME>/
│           ├── OVERVIEW.md     # Global project overview
│           └── <DOMAIN>/
│               └── <REPO_NAME>/
│                   ├── OVERVIEW.md      # Repository overview
│                   ├── _features/       # Business feature documentation
│                   ├── _plans/          # Implementation plans
│                   ├── _spikes/         # Technical investigations
│                   ├── _architecture/   # Architecture docs & ADRs
│                   ├── _guides/         # Developer guides
│                   └── _releases/       # Release documentation
│
├── devtools/                   # Development tools & utilities
│   ├── common/                 # Shared tools across domains
│   ├── <DOMAIN>/               # Domain-specific devtools
│   ├── scripts/                # Shared scripts
│   └── pnpm-workspace.yaml    # Monorepo config
│
└── projects/                   # Source code (gitignored — not tracked)
    └── <PROJECT_NAME>/
        └── <DOMAIN>/
            └── <REPO_NAME>/    # Individual repository
```

> For detailed path variables, scope detection, and context loading rules, see the workspace-specific rule files at `devdocs/agent/rules/common/workspaces/`.
