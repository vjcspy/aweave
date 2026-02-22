# Config Core

Shared configuration loader library (Node-only, zero oclif dependency) for the devtools ecosystem. It provides YAML parsing, deep-merging, environment variable overriding, and synchronization of default configurations to the user's home directory (`~/.aweave/config`). It resolves the deterministic precedence rule: `env vars > user config > defaults`.
