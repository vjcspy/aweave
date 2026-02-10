# 📋 260210: 2026-02-10 - Centralized Config Management

## References

- `README.md`
- `devdocs/misc/devtools/common/cli/OVERVIEW.md`
- `devdocs/misc/devtools/common/debate-web/OVERVIEW.md`
- `devdocs/misc/devtools/common/server/OVERVIEW.md`

## User Requirements

- Trong các domain và trong các package của các domain thì các file cấu hình nằm rải rác giữa các package. Không có 1 nơi nào để centralize config.
- Viết 1 package trong `devdocs/misc/devtools/common` có nhiệm vụ quản lý các config, dùng được ở cả NestJS, Next.js và CLI.
- Các file config ban đầu nằm trong source, nằm trong 1 package ở mỗi domain. Ví dụ domain `devtools/common` có folder riêng để lưu config, `devtools/nab` cũng vậy.
- Khi run script setup thì move các file đó vào `HOME_USER/.aweave/config/` để user có thể sửa.
- Toàn bộ CLI khi chạy sẽ đọc config từ folder trên.
- Format config: tùy chọn format thuận tiện parse và user sử dụng.
- Next.js: chạy local, gom public/private vào 1 file.

## 🎯 Objective
Thiết kế và chuẩn hóa hệ thống config tập trung để CLI, NestJS, Next.js dùng chung, với default config trong source theo domain và user override tại thư mục home, đồng thời có flow setup để copy default config vào thư mục user.

### ⚠️ Key Considerations

- Tránh trùng tên giữa package quản lý config và folder config mặc định của domain `common` → tách tên package quản lý (vd: `config-core`).
- Config loader phải **Node-only**; Next.js chỉ đọc config trong server layer rồi truyền xuống client.
- Hành vi copy mặc định: **không overwrite** config user nếu đã tồn tại (có flag `--force` khi cần).
- Chọn format dễ đọc (đề xuất YAML) và có cơ chế báo lỗi parse rõ ràng.
- **Sensitive values** (tokens, keys, secrets) PHẢI dùng environment variables — KHÔNG lưu trong config files. Config files chỉ chứa non-sensitive values (URLs, ports, feature flags, timeouts, etc.).
- **Config precedence** (deterministic): `env vars > user config (~/.aweave/config/) > defaults (in-source)`.
- **Next.js projection contract**: Config file chia rõ `server` và `clientPublic` sections. Chỉ `clientPublic` keys được truyền xuống client — enforce bằng projection function + test.
- **CI/non-interactive environments**: Nếu user config không tồn tại, fallback về defaults + env vars. KHÔNG lỗi khi thiếu user config directory.

## 🔄 Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Analyze detailed requirements
  - **Outcome**: Chuẩn hóa mục tiêu: config loader dùng chung cho CLI/Nest/Next, default theo domain, user override ở home.
- [x] Define scope and edge cases
  - **Outcome**: Edge cases: file config thiếu, parse lỗi, merge partial, chạy từ CLI global (cwd bất kỳ), setup chạy nhiều lần.
- [ ] Evaluate existing test structures and define integration test cases
  - **Outcome**: Xác định test runner đang dùng trong `devtools/` (nếu chưa có → dùng `node:test` hoặc manual test checklist cho config-core).

### Phase 2: Implementation (File/Code/Test Structure)
>
> Dự kiến cấu trúc file (trạng thái ban đầu là 🚧 TODO):

```
devtools/common/config-core/                 # ✅ DONE - shared config loader
├── package.json                             # @aweave/config-core
├── tsconfig.json
├── src/
│   ├── index.ts                             # Public API: loadConfig, syncDefaults
│   ├── paths.ts                             # Resolve homedir + config root
│   ├── loader.ts                            # Read/parse YAML + merge (deep-merge)
│   ├── sync.ts                              # Copy defaults → user config dir
│   ├── migrate.ts                           # Legacy config migration (non-destructive)
│   ├── schema.ts                            # Schema validation + configVersion
│   ├── projection.ts                        # Next.js client projection (clientPublic only)
│   └── types.ts                             # Shared types + error types
└── README.md                                # Usage notes

devtools/common/config/                      # 🚧 TODO - default configs for common domain
├── package.json                             # @aweave/config-common
├── tsconfig.json
├── defaults/
│   ├── server.yaml                          # Default config for server
│   ├── debate-web.yaml                      # Default config for debate-web
│   └── cli.yaml                             # Default config for CLI plugins
└── src/
    └── index.ts                             # Export DEFAULT_CONFIG_DIR + file list

devtools/nab/config/                         # 🚧 TODO - default configs for nab domain
├── package.json                             # @aweave/config-nab
├── tsconfig.json
├── defaults/
│   ├── opensearch.yaml                      # Default config for NAB tools
│   └── tracing.yaml
└── src/
    └── index.ts                             # Export DEFAULT_CONFIG_DIR + file list

devtools/common/cli-plugin-config/           # ✅ DONE - oclif plugin for aw config *
├── package.json                             # @aweave/cli-plugin-config
├── tsconfig.json
└── src/
    └── commands/
        └── config/
            ├── sync.ts                      # aw config sync [--domain] [--force]
            └── migrate.ts                   # aw config migrate [--domain]

devdocs/misc/devtools/common/config-core/
└── OVERVIEW.md                              # 🚧 TODO - documentation
```

#### Monorepo Wiring Tasks

- [x] Register new packages in `devtools/pnpm-workspace.yaml`:
  - `devtools/common/config-core`
  - `devtools/common/config`
  - `devtools/nab/config`
  - `devtools/common/cli-plugin-config`
- [x] Add `@aweave/config-core` as dependency in consuming packages (`cli-plugin-config`, `server`, `debate-web`)
- [ ] Add `@aweave/config-common` / `@aweave/config-nab` as dependency where needed
- [x] Add `@aweave/cli-plugin-config` as dependency in `devtools/common/cli/package.json` + register in `oclif.plugins`
- [ ] Ensure `defaults/*.yaml` files are included in `package.json` `"files"` field for publish/build
- [ ] Define runtime-safe path resolution from compiled `dist/` to `defaults/` directory (use `__dirname` or `import.meta.url` relative resolution)

### Phase 3: Detailed Implementation Steps

1. **Format & path strategy**
   - Chọn YAML (`.yaml/.yml`) làm format mặc định; cho phép JSON nếu cần (tùy scope).
   - Define config root: `os.homedir()` + `.aweave/config` (theo yêu cầu).
   - Quy ước file: `defaults/<name>.yaml` → user config tại `<home-config>/<domain>/<name>.yaml`.
   - **Config precedence** (deterministic, từ cao đến thấp):
     1. Environment variables (highest priority)
     2. User config files (`~/.aweave/config/<domain>/<name>.yaml`)
     3. Default config files (in-source `defaults/<name>.yaml`)
   - **Deep-merge rules**:
     - Objects: deep merge (user keys override default keys recursively)
     - Arrays: **replace** (user array replaces entire default array, không merge phần tử)
     - Scalar: override
   - **Config file structure** (mỗi YAML file):
     ```yaml
     configVersion: 1          # Schema version for migration
     server:                    # Server-only values
       port: 3000
       internalEndpoint: "..."
     clientPublic:              # Safe to expose to browser (Next.js)
       apiBaseUrl: "..."
       featureFlags: { ... }
     ```

2. **Tạo package `@aweave/config-core`**
   - API đề xuất:
     - `getConfigRoot()` → trả về path config user.
     - `loadConfig<T>({ domain, name, defaultsDir })` → merge defaults + user override + env vars.
     - `syncDefaultConfigs({ domain, defaultsDir, force? })` → copy default vào home.
     - `migrateFromLegacy({ domain })` → migrate legacy config files (non-destructive, copy to new location).
     - `validateConfig<T>(config, schema)` → validate parsed config against schema, return clear errors.
     - `projectClientConfig<T>(config)` → return only `clientPublic` keys (Next.js projection).
   - Tách phần parse + merge: read defaults trước, rồi override user, rồi env vars.
   - **Error handling rõ ràng:**
     - File parse lỗi → throw `ConfigParseError` with file path + line/column info
     - Schema validation fail → throw `ConfigValidationError` with list of issues
     - File không tồn tại (user config) → fallback về defaults (KHÔNG throw)
     - File không tồn tại (defaults) → throw `ConfigDefaultsMissingError`
   - **Schema validation**: mỗi config file có schema definition, validate sau khi parse + merge.
   - **configVersion**: hỗ trợ migration hooks khi schema thay đổi giữa versions.

3. **Tạo package config per-domain**
   - `@aweave/config-common` tại `devtools/common/config/`
   - `@aweave/config-nab` tại `devtools/nab/config/`
   - Export:
     - `DEFAULT_CONFIG_DIR` (path tới folder `defaults/`)
     - `DEFAULT_CONFIG_FILES` (danh sách file để sync)
     - `CONFIG_SCHEMAS` (schema definitions cho validation)

4. **Setup flow & CLI command ownership**

   #### 4.1 CLI Plugin: `@aweave/cli-plugin-config`

   **Package:** `devtools/common/cli-plugin-config/`

   ```
   devtools/common/cli-plugin-config/          # 🚧 TODO - new oclif plugin
   ├── package.json                            # @aweave/cli-plugin-config
   ├── tsconfig.json
   └── src/
       └── commands/
           └── config/
               ├── sync.ts                     # aw config sync [--domain] [--force]
               └── migrate.ts                  # aw config migrate [--domain]
   ```

   **Dependencies:**
   - `@aweave/cli-shared` (shared oclif utilities)
   - `@aweave/config-core` (config loader, sync, migration logic)

   #### 4.2 Registration steps (monorepo wiring)

   - [x] Add `devtools/common/cli-plugin-config` to `devtools/pnpm-workspace.yaml`
   - [x] Add dependency in `devtools/common/cli/package.json`:
     ```json
     "@aweave/cli-plugin-config": "workspace:*"
     ```
   - [x] Register in oclif plugins (`devtools/common/cli/package.json` → `oclif.plugins`):
     ```json
     "@aweave/cli-plugin-config"
     ```
   - [x] `pnpm install && pnpm build`

   #### 4.3 Commands

   - **`aw config sync [--domain <domain>] [--force]`**
     - Không có `--domain`: sync tất cả domains
     - `--force`: overwrite user config nếu đã tồn tại
     - Default (không `--force`): KHÔNG overwrite existing user files
     - Internally calls `syncDefaultConfigs()` from `@aweave/config-core`
   - **`aw config migrate [--domain <domain>]`**
     - Tự động detect legacy files (vd: `~/.aweave/relay.json`, env-based configs)
     - Copy vào new config structure (non-destructive, KHÔNG xóa legacy files)
     - Print deprecation warning khi detect legacy files
     - Internally calls `migrateFromLegacy()` from `@aweave/config-core`

   #### 4.4 Integration with setup

   - Tạo sync/migration logic trong `@aweave/config-core` (reusable).
   - CLI plugin chỉ là thin wrapper gọi `config-core` API.
   - Update setup scripts hiện có để gọi `aw config sync` sau install.

5. **Integration: CLI/NestJS/Next.js**
   - **CLI**: load config ở runtime từ home; dùng defaults nếu thiếu. Precedence: env > user config > defaults.
   - **NestJS**: load config lúc bootstrap module. Precedence tương tự.
   - **Next.js** (projection contract):
     - Chỉ đọc config ở server layer (`server.ts` hoặc route handler).
     - Dùng `projectClientConfig()` để extract chỉ `clientPublic` keys.
     - Truyền kết quả xuống client qua server component props hoặc API response.
     - **KHÔNG BAO GIỜ** truyền full config object xuống client.
   - **CI/non-interactive**: Nếu `~/.aweave/config/` không tồn tại → dùng defaults + env vars. KHÔNG throw error.

6. **Docs**
   - Viết `devdocs/misc/devtools/common/config-core/OVERVIEW.md` (API, examples, layout config, precedence rules, projection contract).
   - Cập nhật các OVERVIEW liên quan (CLI / server / debate-web) để trỏ tới config-core.

7. **Testing & verification**
   - **Acceptance test matrix:**

   | Test case | Expected behavior |
   |-----------|-------------------|
   | First sync (no user config) | Copy defaults → `~/.aweave/config/<domain>/`, files created |
   | Re-sync without `--force` | Existing user files NOT overwritten, new defaults added |
   | Re-sync with `--force` | All files overwritten with defaults |
   | Malformed YAML user config | `ConfigParseError` with file path + line info |
   | Missing defaults directory | `ConfigDefaultsMissingError` |
   | Permission denied on home dir | Clear error message, graceful failure |
   | Precedence: env > user > defaults | Env var overrides user config, user config overrides defaults |
   | Deep-merge: nested objects | User keys merged into defaults recursively |
   | Deep-merge: arrays | User array replaces default array entirely |
   | Next.js projection | Only `clientPublic` keys in output, no `server` keys |
   | Legacy migration | Legacy files copied to new structure, originals untouched |
   | CI/no home config | Fallback to defaults + env, no error |

   - Fail test nếu `server` keys xuất hiện trong client projection output.

## 📊 Summary of Results
>
> TBD after implementation is complete and requested.

## 🚧 Outstanding Issues & Follow-up
>
> If you have any outstanding issues or any question needs to clarify, list them here. Otherwise, you can omit this section.
>
### ⚠️ Issues/Clarifications (Optional)

- [ ] Xác nhận danh sách config files cần migrate ban đầu cho từng domain.
- [ ] Xác nhận danh sách legacy files cần migration (vd: `~/.aweave/relay.json`, env vars `DEBATE_*`, `AUTH_TOKEN`, etc.).

## Implementation Notes / As Implemented

### Packages Created (2026-02-10)

#### 1. `@aweave/config-core` — `devtools/common/config-core/`

Shared config loader library (Node-only, zero oclif dependency). YAML-based with `yaml` npm package.

**Public API:**

| Export | Description |
|--------|-------------|
| `getConfigRoot()` | Returns `~/.aweave/config/` (respects `AWEAVE_CONFIG_ROOT` env var) |
| `getDomainConfigDir(domain)` | Returns `~/.aweave/config/<domain>/` |
| `getUserConfigPath(domain, name)` | Returns `~/.aweave/config/<domain>/<name>.yaml` |
| `loadConfig<T>(options)` | Merge defaults → user config → env vars |
| `deepMerge(target, source)` | Deep-merge with array-replace semantics |
| `syncDefaultConfigs(options)` | Copy defaults to user config dir (skip existing unless `force`) |
| `listDefaultConfigs(defaultsDir)` | List available YAML files in a defaults directory |
| `migrateFromLegacy(options)` | Non-destructive legacy file migration (JSON → YAML conversion) |
| `validateConfig(config, schema, filePath)` | Schema validation with clear error reporting |
| `projectClientConfig(config)` | Extract only `clientPublic` keys (Next.js projection) |

**Error classes:** `ConfigParseError` (with line/column), `ConfigValidationError` (with issues list), `ConfigDefaultsMissingError`

**Deep-merge rules:** Objects merge recursively, arrays replace entirely, scalars override.

**Env var coercion:** `"true"`/`"false"` → boolean, numeric strings → number.

#### 2. `@aweave/cli-plugin-config` — `devtools/common/cli-plugin-config/`

Thin oclif plugin wrapping `config-core` API.

**Commands:**
- `aw config sync [--domain] [--force] [--format]` — Sync default configs to `~/.aweave/config/`. Auto-discovers domains with `<domain>/config/defaults/` directories.
- `aw config migrate [--domain] [--format]` — Migrate legacy config files (registry in `src/lib/legacy.ts`, currently empty — populate when legacy files are identified).

**Domain discovery:** The sync command automatically scans `devtools/*/config/defaults/` directories — no hardcoded domain list needed. When domain config packages (e.g. `@aweave/config-common`) are created with a `defaults/` folder, they will be auto-discovered.

### Not Implemented (Deferred)

- `@aweave/config-common` (`devtools/common/config/`) — domain config package with default YAML files
- `@aweave/config-nab` (`devtools/nab/config/`) — domain config package for nab
- `devdocs/misc/devtools/common/config-core/OVERVIEW.md` — documentation
- Integration with `server`, `debate-web`, and existing CLI plugins
- Actual legacy migration entries (empty registry in `LEGACY_CONFIG_MAP`)
