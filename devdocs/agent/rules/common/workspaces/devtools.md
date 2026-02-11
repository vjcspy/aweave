# DevTools Workspace

Workspace for development tools, CLI applications, and backend services — all TypeScript/Node.js.

## Key Paths

| Purpose | Path |
|---------|------|
| **Source Code Root** | `devtools/` |
| **Documentation Root** | `devdocs/misc/devtools/` |
| **Global Overview** | `devdocs/misc/devtools/OVERVIEW.md` |
| **Plans** | `devdocs/misc/devtools/common/_plans/` |

## Folder Structure

```
devtools/                           # Source code (100% TypeScript)
├── common/                         # Shared tools across all domains
│   ├── cli-core/                   # @aweave/cli — root CLI + shared utilities
│   ├── cli-debate/                 # @aweave/cli-debate — aw debate commands
│   ├── cli-docs/                   # @aweave/cli-docs — aw docs commands
│   ├── server/                     # @aweave/server — unified NestJS server
│   ├── nestjs-debate/              # @aweave/nestjs-debate — debate backend module
│   └── debate-web/                 # Next.js debate monitoring UI
├── <domain>/                       # Domain-specific tools
│   ├── cli-<tool>/                 # CLI packages for this domain
│   └── local/                      # Local dev infrastructure
└── pnpm-workspace.yaml             # pnpm workspace packages

devdocs/misc/devtools/              # Documentation
├── OVERVIEW.md                     # Global devtools overview (MUST read)
├── _plans/                         # Implementation plans
│   └── [YYMMDD-name].md
├── common/                         # Package-level documentation
│   ├── server/OVERVIEW.md          # NestJS server docs
│   ├── nestjs-debate/OVERVIEW.md   # Debate module docs
│   ├── cli-<package>/OVERVIEW.md   # CLI package docs
│   └── <package>/OVERVIEW.md       # Other package docs
└── <domain>/                       # Domain-specific docs
```

## Required Context Loading

**Loading Order — MUST follow sequentially:**

1. **Global Overview** (ALWAYS read first)
   ```
   devdocs/misc/devtools/OVERVIEW.md
   ```

2. **Package Overview** (if working on specific package)

   For CLI packages:
   ```
   devdocs/misc/devtools/common/cli-<package>/OVERVIEW.md
   ```

   For NestJS modules:
   ```
   devdocs/misc/devtools/common/nestjs-<package>/OVERVIEW.md
   ```

   For server:
   ```
   devdocs/misc/devtools/common/server/OVERVIEW.md
   ```

   For domain-specific packages:
   ```
   devdocs/misc/devtools/<domain>/<package>/OVERVIEW.md
   ```

3. **Project Structure** (if need to understand folder structure)
   ```
   devdocs/agent/rules/common/project-structure.md
   ```

> **CRITICAL:** If Global Overview does not exist or is empty, **STOP** and ask user to provide context before proceeding.

## Skill Loading

Load skill when task matches trigger. Read **after** context loading above.

| Skill | Trigger | Path |
|-------|---------|------|
| `devtools-cli-builder` | Create/modify CLI plugins, oclif commands, NestJS modules, API integration | `devdocs/agent/skills/common/devtools-cli-builder/SKILL.md` |

## Path Detection Examples

| User Input | Package Type | Package Overview Path |
|------------|--------------|----------------------|
| `devtools/common/cli-core/` | CLI (core) | `devdocs/misc/devtools/common/cli-core/OVERVIEW.md` |
| `devtools/common/cli-debate/` | CLI (debate) | `devdocs/misc/devtools/common/cli-debate/OVERVIEW.md` |
| `devtools/common/server/` | NestJS Server | `devdocs/misc/devtools/common/server/OVERVIEW.md` |
| `devtools/common/nestjs-debate/` | NestJS Module | `devdocs/misc/devtools/common/nestjs-debate/OVERVIEW.md` |
| `devtools/tinybots/cli-bitbucket/` | Domain CLI | `devdocs/misc/devtools/tinybots/cli-bitbucket/OVERVIEW.md` |
| `devdocs/misc/devtools/common/_plans/260207-*.md` | Plan file | Load Global OVERVIEW + related package OVERVIEW |

## CLI Development

### CLI Architecture (Commander.js)

- Root program: `devtools/common/cli-core/src/program.ts`
- Each domain exports a Commander `Command` object
- Root composes via `.addCommand()`
- Global install: `pnpm add -g @aweave/cli` → `aw` available globally
- Run dev mode: `cd devtools/common/cli-core && node dist/bin/aw.js <cmd>`

### Adding New CLI Tools

1. Create package at `devtools/<domain>/cli-<name>/`
2. Export Commander `Command` from package
3. Add to `pnpm-workspace.yaml`
4. Register in `cli-core/src/program.ts`
5. Build: `pnpm build`

### Backend Modules (NestJS)

- Server: `devtools/common/server/` (imports all feature modules)
- Feature modules: `devtools/<domain>/nestjs-<feature>/` (separate pnpm packages)
- Pattern: `devdocs/misc/devtools/common/server/OVERVIEW.md` → "Adding a New Feature Module"

## Development Commands

| Task | Command |
|------|---------|
| Install all | `cd devtools && pnpm install` |
| Build all | `cd devtools && pnpm -r build` |
| Build specific | `cd devtools/common/<pkg> && pnpm build` |
| Run CLI (dev) | `cd devtools/common/cli-core && node dist/bin/aw.js <cmd>` |
| Run CLI (global) | `aw <cmd>` |
| Start server | `cd devtools/common/server && node dist/main.js` |

## Working with Plans

Plans are stored at: `devdocs/misc/devtools/common/_plans/`

Naming convention: `[YYMMDD-name].md`

When creating plans, use template: `devdocs/agent/templates/common/create-plan.md`
