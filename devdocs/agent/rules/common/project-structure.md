# Project Structure Convention

All projects follow this standard directory structure:

```text
<PROJECT_ROOT>/
├── devdocs/                    # AI Agent context & documentation
│   ├── agent/                  # Agent-specific configurations
│   │   ├── commands/           # Custom agent commands
│   │   ├── templates/          # Document templates (plans, releases, etc.)
│   │   └── rules/              # Working protocols & guidelines
│   ├── misc/                   # Cross-domain documentation
│   │   └── devtools/           # DevTools documentation
│   │       └── <DOMAIN>/       # Per-domain devtools docs
│   │           └── OVERVIEW.md # DevTools overview for the domain
│   └── projects/               # Project-specific documentation (mirrors projects/)
│       └── <PROJECT_NAME>/     # Project documentation container
│           ├── OVERVIEW.md     # **Global overview** for the entire project
│           └── <DOMAIN>/       # Domain-specific documentation
│               └── <REPO_NAME>/# Per-repo context & documentation
│                   ├── OVERVIEW.md # Repository-specific overview & business context
│                   └── plans/  # Implementation plans for the repo
│                       └── *.md# Plan files: [YYMMDD-Ticket-Name].md
│
├── devtools/                   # Development tools & utilities (multi-domain)
│   ├── common/                 # Shared tools across domains
│   │   └── cli/                # Shared CLI tools
│   └── <DOMAIN>/               # Domain-specific devtools
│       └── local/              # Local development infrastructure
│           ├── docker-compose.yaml
│           ├── Justfile        # Just commands for the domain
│           └── ...
│
└── projects/                   # Source code root (all projects live here)
    └── <PROJECT_NAME>/         # Project source code container
        └── <DOMAIN>/           # Domain-specific source code
            ├── <REPO_1>/       # Individual repository
            ├── <REPO_2>/       # Individual repository
            └── ...
```

## Key Path Variables

| Variable           | Description                                                                 | Example                            |
| ------------------ | --------------------------------------------------------------------------- | ---------------------------------- |
| `<PROJECT_ROOT>`   | **Current workspace root directory** (the folder where the agent operates) | `/Users/dev/my-project`            |
| `<PROJECT_NAME>`   | Project name - folder directly under `projects/`                            | `nab`, `myapp`, `tinybots`         |
| `<DOMAIN>`         | Business domain name                                                        | `core`, `frontend`, `backend`     |
| `<REPO_NAME>`      | Repository name within a domain                                             | `wonkers-api`, `user-service`      |

## Important Notes

> **Source Code Path:** Source code repositories are located at `projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/`.
>
> **CRITICAL - Multiple Projects:** The `projects/` folder may contain multiple independent projects. Never assume which project/repo the user is referring to. Always require explicit path like `projects/tinybots/backend/wonkers-api` before proceeding with any source code operation.

## Path Resolution Rules

All paths in user-agent communication are **ALWAYS relative to `<PROJECT_ROOT>`**.

| User Input | Agent Action | Example |
|------------|--------------|---------|
| Explicit relative path | **DIRECTLY use** - no search needed | User: `devtools/common` → Access `<PROJECT_ROOT>/devtools/common` |
| File/folder name only | **DIRECTLY use** if unambiguous at root level | User: `devtools` → Access `<PROJECT_ROOT>/devtools/` |
| "Find/search for X" | Perform path discovery | User: "find all Justfiles" → Search in workspace |
| Ambiguous reference | Ask user to clarify | User: "the config file" → Ask which one |

**DO:**
- Trust user-provided paths and use them directly
- Prepend `<PROJECT_ROOT>/` to any relative path for file operations
- Assume paths without leading `/` or `~` are relative to `<PROJECT_ROOT>`

**DON'T:**
- Search/scan for files when user already provided the exact path
- Second-guess or verify paths that user explicitly specified
- Convert relative paths to absolute paths in responses (keep them relative)
