# 📋 [TSConfig: 2026-02-12] - Path Alias `@/` cho devtools/common

## References

- `devdocs/misc/devtools/OVERVIEW.md`
- `devtools/pnpm-workspace.yaml`
- `devtools/common/debate-web/tsconfig.json`
- `devtools/common/debate-web/rsbuild.config.ts`
- `devtools/common/server/tsconfig.json`
- `devtools/common/server/tsconfig.build.json`
- `devtools/common/server/package.json`
- `devtools/common/nestjs-debate/tsconfig.json`
- `devtools/common/cli/tsconfig.json`

## User Requirements

1. Các package trong `devtools/common` có 3 loại:
   1) cli package/common/shared package
   2) nestjs package
   3) react with rsbuild
2. Cấu hình path trong tsconfig để import dùng `@...` thay vì relative path

## 🎯 Objective

Chuẩn hoá cấu hình TypeScript cho toàn bộ packages trong `devtools/common` bằng cách:

- Chuẩn hoá import nội bộ trong từng package bằng alias `@/…` (không dùng relative path), đồng thời đảm bảo build/runtime vẫn chạy đúng cho Node/NestJS và bundler (Rsbuild).

### ⚠️ Key Considerations

1. **TS `paths` chỉ ảnh hưởng type-checker, không tự đổi runtime import**: Với Node/NestJS/CLI, nếu source dùng `@/…` thì output JS sẽ giữ nguyên `@/…` và `node` sẽ fail khi chạy `dist/`. Cần thêm bước rewrite sau build (vd: `tsc-alias`) hoặc dùng runtime loader (vd: `tsconfig-paths/register`) nhưng loader chỉ phù hợp cho `ts-node`/dev/test, không phù hợp cho `node dist/*.js` production.

2. **Có nhiều “flavor” TS config đang coexist**:
   - CJS libraries (đa số CLI/shared): `module: commonjs`, `tsc` emit vào `dist/`.
   - NestJS packages: `nest build` (tsc) + decorators metadata.
   - React SPA: `noEmit` + `moduleResolution: bundler` + Rsbuild alias.
   - Một số CLI/Ink packages là **ESM** (`"type": "module"`, `module: Node16`) và có convention import với `.js` suffix trong source.

3. **Không nên thay đổi module/moduleResolution/target hàng loạt trong Phase 1** vì dễ tạo breaking change. Nên giữ nguyên “flavor” của từng package.

## 🔄 Implementation Plan

### Phase 1: Analysis & Preparation

- [ ] Xác nhận convention alias và phạm vi áp dụng
  - **Outcome**:
    - Convention đề xuất:
      - `@/…` = nội bộ trong package (map tới `src/…`)
      - `@aweave/<pkg>` = import cross-package (đang dùng sẵn, runtime OK qua workspace deps)
    - Ghi chú ESM packages: để runtime Node ESM chạy được, nếu dùng alias thì nên viết dạng `@/lib/foo.js` (không bắt buộc bằng rule, nhưng cần để output hợp lệ).

- [ ] Xác định tool rewrite path sau build cho Node/NestJS
  - **Outcome**:
    - Chọn `tsc-alias` (đơn giản, hoạt động sau `tsc` / `nest build`, rewrite cả `.js` và `.d.ts` trong `dist/` dựa trên `compilerOptions.paths`)
    - Quy ước: mọi package Node/NestJS muốn dùng `@/…` đều phải chạy `tsc-alias` trong `build` pipeline.

### Phase 2: Standalone tsconfig + alias per-package

**Mục tiêu:** Mỗi package tự khai báo đầy đủ `tsconfig.json`, nhưng thống nhất alias `@/…` trỏ về `src/…`.

- [ ] Cập nhật tsconfig cho 3 nhóm package
  - **Outcome**:
    - CLI/shared (CJS): giữ `module: "commonjs"`, thêm `baseUrl` + `paths`.
    - NestJS packages: giữ decorators options; thêm `baseUrl` + `paths`; giữ `nest build` flow.
    - React + Rsbuild: giữ `noEmit: true`, `moduleResolution: "bundler"`, `lib` DOM, `jsx`, …; thêm `baseUrl` + `paths` và đồng bộ với `rsbuild.config.ts` alias (`@/`).

### Phase 3: Make `@/…` work end-to-end (build + runtime)

- [ ] Thêm `tsc-alias` vào workspace và build pipeline
  - **Outcome**:
    - Add `tsc-alias` vào `devtools/package.json` devDependencies (ưu tiên dùng pnpm catalog nếu muốn).
    - Update scripts:
      - Với packages dùng `tsc`: `"build": "tsc && tsc-alias -p tsconfig.json"`
      - Với packages dùng `nest build`: `"build": "nest build && tsc-alias -p tsconfig.build.json"` (hoặc `-p tsconfig.json` tuỳ file nào chứa `paths`)
    - Ensure `turbo build` vẫn nhận output `dist/**`.

- [ ] Giữ `tsconfig-paths/register` cho dev/test scripts đang dùng `ts-node`
  - **Outcome**:
    - Server hiện đã dùng `ts-node -r tsconfig-paths/register` cho `generate:openapi` và jest debug.
    - Không thay đổi hành vi hiện tại; `tsc-alias` chủ yếu đảm bảo `node dist/*` hoạt động khi source dùng alias.

### Phase 4: Rollout import refactor (từ relative → `@/…`)

- [ ] Refactor imports theo từng package (incremental)
  - **Outcome**:
    - Chọn 1–2 package đại diện mỗi nhóm để làm trước (vd: `cli-shared`, `server`, `debate-web`) để validate flow.
    - Refactor:
      - `../../lib/foo` → `@/lib/foo`
      - Với ESM packages đang dùng `.js` suffix: `../../lib/foo.js` → `@/lib/foo.js`
    - Sau mỗi package: chạy build + chạy command/runtime smoke test.

- [ ] (Optional) Enforce convention qua lint rule
  - **Outcome**:
    - Nếu muốn “bắt buộc” không dùng relative imports (trừ `./` cùng folder), có thể thêm ESLint rule/cấu hình cho từng package.
    - Mục tiêu: giảm regression, nhưng nên làm sau khi đã migrate phần lớn code.

## 🚧 Outstanding Issues & Follow-up

### ✅ Decisions

- `@/…` chỉ dùng cho internal trong từng package.
- Không enforce `.js` suffix bằng rule; riêng ESM packages nếu dùng alias thì nên dùng `@/…​.js` để Node runtime chạy được.
- Publish npm bắt buộc chạy runtime được; vì vậy build phải rewrite `@/…` trong `dist/` (vd: `tsc-alias`).
