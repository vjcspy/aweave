# TinyBots Test Execution Rules

> **CRITICAL:** All TinyBots repositories can ONLY run tests inside Docker containers. Do NOT attempt to run tests directly on your local machine—they will fail due to missing infrastructure dependencies.

## Test Execution Command

Tests must be executed using the centralized DevTools infrastructure via `just` commands:

```bash
just -f workspaces/devtools/tinybots/local/Justfile test-<repo>
```

## Available Repositories

| Repository | Command |
|------------|---------|
| atlas | `just -f workspaces/devtools/tinybots/local/Justfile test-atlas` |
| m-o-triggers | `just -f workspaces/devtools/tinybots/local/Justfile test-m-o-triggers` |
| megazord-events | `just -f workspaces/devtools/tinybots/local/Justfile test-megazord-events` |
| micro-manager | `just -f workspaces/devtools/tinybots/local/Justfile test-micro-manager` |
| sensara-adaptor | `just -f workspaces/devtools/tinybots/local/Justfile test-sensara-adaptor` |
| wonkers-ecd | `just -f workspaces/devtools/tinybots/local/Justfile test-wonkers-ecd` |
| wonkers-graphql | `just -f workspaces/devtools/tinybots/local/Justfile test-wonkers-graphql` |

## Important Notes

- **Execution time:** Tests take 1-2 minutes due to Docker container startup, migrations, and service initialization.
- **Do not interrupt:** Let the test command finish completely to get accurate results.
- **Prerequisites:** Ensure Docker is running and you have ECR access (see `resources/workspaces/devtools/tinybots/OVERVIEW.md` for setup).
- **Working directory:** Run commands from the **project root** (the folder containing both `workspaces/devtools/` and `workspaces/` with actual source code). 
- **Verify source exists:** Before running tests, use `ls -la workspaces/tinybots/backend/<repo>/` to confirm source code is present. If folder is empty or only contains `.gitkeep`, source code is missing.

## Troubleshooting Test Failures

```bash
# View logs for a specific repository's services
just -f workspaces/devtools/tinybots/local/Justfile log-<repo>

# Check Docker container status
cd workspaces/devtools/tinybots/local && docker compose ps

# Restart from clean state
cd workspaces/devtools/tinybots/local && docker compose down
just -f workspaces/devtools/tinybots/local/Justfile start-db
just -f workspaces/devtools/tinybots/local/Justfile test-<repo>
```

## Writing Tests

When writing new tests, follow the testing guidelines:

- See skill: `agent/skills/tinybots/testing-guidelines/SKILL.md`
- Use `deep.include` for assertions
- Follow Arrange-Act-Assert pattern
