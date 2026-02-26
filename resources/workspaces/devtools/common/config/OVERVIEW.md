---
name: Config Common
description: Default configuration schema and YAML files for the common devtools domain
tags: []
---

# Config Common (@hod/aweave-config-common)

This package maintains the default configuration schema and YAML files for the `common` devtools domain.

## Purpose

Instead of scattering default configuration references within the distinct CLI plugins or backend server modules directly, `@hod/aweave-config-common` centralizes standard configuration specifications. It works tightly in conjunction with `@hod/aweave-config-core` to establish safe and predictable execution of the applications.

## Key Exports

- `DEFAULT_CONFIG_DIR`: Path resolution pointer to the `defaults/` folder containing standard domain YAML implementations.
- `DEFAULT_CONFIG_FILES`: The explicit list of files tracked within this domain to sync with the end-user environment.
- `CONFIG_SCHEMAS`: Schema definitions mapped per configuration artifact utilized during the `validateConfig` phase within `config-core`.

## Structure Guidelines

- **Sensitive values**: Environment tokens, keys, and secrets are purposefully excluded. Those expect standard environment variable inclusion directly within process runs.
- **Exposure Control**: `server` boundaries protect properties internally, while `clientPublic` explicitly signals keys safe for browser (e.g. Next.js applications) extrapolation.
