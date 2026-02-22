---
overview_path: resources/workspaces/devtools/common/nestjs-dashboard/OVERVIEW.md
---

# NestJS DevTools Dashboard — Abstract

The NestJS DevTools Dashboard (`@hod/aweave-nestjs-dashboard`) is a dedicated backend module serving the main AWeave Developer Tools server. Its essential purpose is to expose a unified REST API layer for dynamically managing workspace configuration files (`aweave.config.yaml`) using `@hod/aweave-config-core`, and actively maintaining AI agent skills by parsing contextual `SKILL.md` markdown files via `gray-matter`. Integrated into the broader developer node cluster, it interfaces heavily with local file system paths to hydrate the developer's agent context synchronously.
