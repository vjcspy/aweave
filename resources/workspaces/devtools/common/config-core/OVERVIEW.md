# Config Core (@hod/aweave-config-core)

A node-only shared configuration loader library acting as the heart of the centralized configuration management across the `devtools` workspaces.

## Key Features

1. **Format & Path Context**
   - Parses YAML configuration files.
   - Centralizes user configs by default at `os.homedir() + /.aweave/config`.
   - Domain-specific folders inside the root config path (e.g., `~/.aweave/config/<domain>/<name>.yaml`).

2. **Config Precedence & Merging**
   Follows a strict, deterministic precedence:
   1. `Environment Variables` (Highest priority)
   2. `User config files` (`~/.aweave/config/<domain>/<name>.yaml`)
   3. `Default configs` (in-source `defaults/<name>.yaml`)

   *Deep-Merge Rules:* Objects merge recursively, arrays replace the default entirely, and scalar values override.

3. **Public API Contracts**
   - `getConfigRoot()`: Get root configuration path.
   - `loadConfig<T>({ domain, name, defaultsDir })`: Merge defaults + user + env vars.
   - `syncDefaultConfigs({ domain, defaultsDir, force? })`: Copy domain defaults into user's config directory.
   - `migrateFromLegacy({ domain })`: Transition from legacy configuration formats safely.
   - `validateConfig<T>(config, schema)`: Safely validate against a schema.
   - `projectClientConfig<T>(config)`: Isolate and expose *only* `clientPublic` keys per Next.js component contracts.

4. **Robust Error Handling**
   Clear parsing error objects (`ConfigParseError`) citing line and column numbers. Missing defaults throw `ConfigDefaultsMissingError`, but missing user configs gracefully fall back to defaults without error.
