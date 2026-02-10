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

## 🔄 Implementation Plan

### Phase 1: Analysis & Preparation

- [ ] Analyze detailed requirements
  - **Outcome**: Chuẩn hóa mục tiêu: config loader dùng chung cho CLI/Nest/Next, default theo domain, user override ở home.
- [ ] Define scope and edge cases
  - **Outcome**: Edge cases: file config thiếu, parse lỗi, merge partial, chạy từ CLI global (cwd bất kỳ), setup chạy nhiều lần.
- [ ] Evaluate existing test structures and define integration test cases
  - **Outcome**: Xác định test runner đang dùng trong `devtools/` (nếu chưa có → dùng `node:test` hoặc manual test checklist cho config-core).

### Phase 2: Implementation (File/Code/Test Structure)
>
> Dự kiến cấu trúc file (trạng thái ban đầu là 🚧 TODO):

```
devtools/common/config-core/                 # 🚧 TODO - shared config loader
├── package.json                             # @aweave/config-core
├── tsconfig.json
├── src/
│   ├── index.ts                             # Public API: loadConfig, syncDefaults
│   ├── paths.ts                             # Resolve homedir + config root
│   ├── loader.ts                            # Read/parse YAML + merge
│   ├── sync.ts                              # Copy defaults → user config dir
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

devdocs/misc/devtools/common/config-core/
└── OVERVIEW.md                              # 🚧 TODO - documentation
```

### Phase 3: Detailed Implementation Steps

1. **Format & path strategy**
   - Chọn YAML (`.yaml/.yml`) làm format mặc định; cho phép JSON nếu cần (tùy scope).
   - Define config root: `os.homedir()` + `.aweave/config` (theo yêu cầu).
   - Quy ước file: `defaults/<name>.yaml` → user config tại `<home-config>/<domain>/<name>.yaml`.

2. **Tạo package `@aweave/config-core`**
   - API đề xuất:
     - `getConfigRoot()` → trả về path config user.
     - `loadConfig<T>({ domain, name, defaultsDir })` → merge defaults + user override.
     - `syncDefaultConfigs({ domain, defaultsDir, force? })` → copy default vào home.
   - Tách phần parse + merge: read defaults trước, rồi override user.
   - Return error rõ ràng nếu file parse lỗi hoặc file không tồn tại.

3. **Tạo package config per-domain**
   - `@aweave/config-common` tại `devtools/common/config/`
   - `@aweave/config-nab` tại `devtools/nab/config/`
   - Export:
     - `DEFAULT_CONFIG_DIR` (path tới folder `defaults/`)
     - `DEFAULT_CONFIG_FILES` (danh sách file để sync)

4. **Setup flow**
   - Tạo script (Node) trong `@aweave/config-core` để sync defaults → home.
   - Update setup scripts hiện có để gọi sync theo domain tương ứng (không overwrite nếu user đã chỉnh).

5. **Integration: CLI/NestJS/Next.js**
   - **CLI**: load config ở runtime từ home; dùng defaults nếu thiếu.
   - **NestJS**: load config lúc bootstrap module.
   - **Next.js**: chỉ đọc config ở server layer, inject vào client (server component hoặc route handler).

6. **Docs**
   - Viết `devdocs/misc/devtools/common/config-core/OVERVIEW.md` (API, examples, layout config).
   - Cập nhật các OVERVIEW liên quan (CLI / server / debate-web) để trỏ tới config-core.

7. **Testing & verification**
   - Unit test tối thiểu cho `loadConfig` & `syncDefaultConfigs`.
   - Manual verification checklist:
     - Setup sync tạo file đúng vị trí.
     - CLI đọc config user.
     - Server boot lấy config đúng.
     - Next.js client nhận config từ server.

## 📊 Summary of Results
>
> TBD after implementation is complete and requested.

## 🚧 Outstanding Issues & Follow-up
>
> If you have any outstanding issues or any question needs to clarify, list them here. Otherwise, you can omit this section.
>
### ⚠️ Issues/Clarifications (Optional)

- [ ] Xác nhận danh sách config files cần migrate ban đầu cho từng domain.
