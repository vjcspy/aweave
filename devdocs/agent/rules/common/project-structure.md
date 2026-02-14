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
│                   ├── OVERVIEW.md      # Repository overview (MANDATORY)
│                   ├── _features/       # Business feature documentation
│                   ├── _plans/          # Implementation plans
│                   ├── _spikes/         # Technical investigations
│                   ├── _architecture/   # Architecture docs & ADRs
│                   ├── _guides/         # Developer guides
│                   └── _releases/       # Release documentation
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
| `<PROJECT_NAME>`   | Project name - folder directly under `projects/`                            | `nab`, `myapp`                     |
| `<DOMAIN>`         | Business domain name                                                        | `core`, `frontend`, `backend`     |
| `<REPO_NAME>`      | Repository name within a domain                                             | `ho-omh-customer-loan-mods-web`, `ho-omh-loanmodifications-api` |

## Important Notes

> **Source Code Path:** Source code repositories are located at `projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/`.
>
> **CRITICAL - Multiple Projects:** The `projects/` folder may contain multiple independent projects. Never assume which project/repo the user is referring to. Always require explicit path like `projects/nab/hod/ho-omh-customer-loan-mods-web` before proceeding with any source code operation.

---

## Repo-Level Documentation Structure

Each repository's documentation at `devdocs/projects/<PROJECT_NAME>/<DOMAIN>/<REPO_NAME>/` follows a standard internal structure with **underscore-prefixed category folders**:

```text
<REPO_NAME>/
├── OVERVIEW.md                       # [MANDATORY] Repository overview
│
├── _features/                        # Business features / epics
│   └── <feature-name>/
│       ├── OVERVIEW.md              # [MANDATORY] Feature overview
│       ├── confluence/              # Source of Truth (Confluence)
│       ├── notes/                   # Extracted/analyzed notes
│       └── _plans/                  # Feature-specific plans
│
├── _plans/                           # Repo-level implementation plans
│   └── YYMMDD-<Name>.md
│
├── _spikes/                          # Technical spikes / investigations
│   └── YYMMDD-<Name>.md
│
├── _architecture/                    # Architecture docs & ADRs
│   └── <topic>.md
│
├── _guides/                          # Developer guides & onboarding
│   └── <topic>.md
│
└── _releases/                        # Release documentation
    └── YYMMDD-<version>.md
```

### Category Folder Reference

| Folder | Purpose | Naming | Example |
|--------|---------|--------|---------|
| `_features/` | Business feature/epic docs | `<feature-name>/` | `_features/new-MHL/` |
| `_plans/` | Cross-cutting implementation plans | `YYMMDD-<Name>.md` | `_plans/260209-Add-Trace-Decorator.md` |
| `_spikes/` | Technical investigations, POCs | `YYMMDD-<Name>.md` | `_spikes/260215-DDR-Investigation.md` |
| `_architecture/` | Architecture decisions & docs | `<topic>.md` | `_architecture/logging.md` |
| `_guides/` | Developer how-tos & onboarding | `<topic>.md` | `_guides/local-setup.md` |
| `_releases/` | Release notes & changelog | `YYMMDD-<version>.md` | `_releases/260301-v2.5.0.md` |

> **Create on demand:** Only create category folders when you have content for them. The convention defines WHERE things go, not that all folders must exist.

### Feature Internal Structure

Each feature under `_features/<feature-name>/` contains:

| Folder | Purpose | File Naming |
|--------|---------|-------------|
| `confluence/` | Documents fetched from Confluence (source of truth) | `<confluence_id>-<description>.md` |
| `notes/` | Extracted/analyzed documents (human + AI) | `<topic>.md` (sub-folders allowed) |
| `_plans/` | Feature-scoped implementation plans | `YYMMDD-<Name>.md` |

### Repo-level `_plans/` vs Feature-level `_plans/`

| Scope | Path | Use When |
|-------|------|----------|
| **Repo-level** | `<REPO>/_plans/` | Plan affects the whole repo (cross-cutting) |
| **Feature-level** | `<REPO>/_features/<name>/_plans/` | Plan is scoped to a single feature |

---

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
