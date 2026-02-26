---
name: DevTools Dashboard
description: Create a Web Dashboard UI to visually manage centralized configuration files and toggle agent skills.
status: done
created: 2026-02-22
tags: []
---

# 260222-DevTools-Dashboard - DevTools Dashboard & Skill Management

## References

- `resources/workspaces/devtools/OVERVIEW.md`
- `resources/workspaces/devtools/common/server/OVERVIEW.md`
- `agent/skills/common/devtools-cli-builder/SKILL.md`

## User Requirements

- Làm một dashboard UI để trước tiên quản lý 2 tính năng này trước.

1. Cho user thấy các file configs và có thể sửa trực tiếp trên giao diện
2. Quét hết tất cả các skills và cho user toggle on/off sẽ load skill nào

- backend: server -> viết thêm `nestjs-dashboard` để có thể import vào server. Nó làm nhiệm vụ đọc các file yaml config cũng như scan các folder skills (`agent/skills` và `~/.aweave/skills`). skills phải tuân theo <https://agentskills.io/what-are-skills> (cần name và description).
- web: `dashboard-web` -> tạo thêm 1 react web package (dùng rsbuild) để làm giao diện cho user chỉnh sửa (dùng tweakcn với themes mono).
- Mở rộng logic lấy skills: Trigger sau khi user save thì build 1 file markdown và yêu cầu AI agent load mỗi khi bắt đầu conversation.
- Xác định project root: Dùng `process.cwd()`. Bỏ qua nếu không tồn tại.
- Lưu trạng thái kích hoạt skills: `~/.aweave/active-skills.json`.
- URL Dashboard: route từ `/dashboard` trong `aweave-server` (cổng 3456).

## Objective

Build a centralized web dashboard to view and edit configuration files and manage the activation status of AI Agent Skills. When skills are toggled on or off, the backend will dynamically generate a static markdown file containing the activated skills. This file will serve as an auto-loaded context source for the AI agents, integrated directly into the `AGENTS.md` workflow.

### Key Considerations

- Ensure non-blocking data operations when the backend scans `process.cwd()/agent/skills/` and `~/.aweave/skills/` using `gray-matter` for markdown parsing.
- Handle missing `agent/skills/` directories gracefully if the server is started from a non-root project path.
- Assure that the new Rsbuild setup integrates seamlessly into the NestJS server for static serving at `/dashboard`.

### Integration Contract for Active Skills Context

1. **Agent Target:** The target is primarily Cursor's integrated chat/composer agents, plus the overarching aweave agent scaffolding configured by `AGENTS.md`.
2. **Include Mechanism:** We will update `agent/rules/common/rule.md` (which `AGENTS.md` symlinks to) to instruct the agent to explicitly load `~/.aweave/loaded-skills.md` if the file exists.
3. **Execution Scope:** Add a discrete step in the `AGENTS.md` context setup workflow (e.g. "Step x: Load Active Skills") referencing the `~/.aweave/loaded-skills.md` path. If the file is missing, the agent will gracefully proceed without failure.
4. **Verification:** Add an E2E smoke flow that validates the file content generated corresponds correctly to active skills, and verify an AI local session automatically recognizes the skill.

## Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Analyze detailed requirements
  - **Outcome**: The web application will reside in `workspaces/devtools/common/dashboard-web` and communicate with a new backend module `workspaces/devtools/common/nestjs-dashboard`. Context distribution for active skills will rely on static file generation integrated natively into `AGENTS.md`.
- [ ] Define scope and edge cases
  - **Outcome**: Edge cases to handle include unparseable markdowns, unresolvable paths for non-global usages, concurrent writes to the generated skills markdown, and validation errors from config payloads.
- [ ] Evaluate existing test structures and define test cases
  - **Outcome**: A robust test matrix including:
    - Backend integration tests: directory scanning, parsing errors, YAML save conflicts.
    - Server route tests: `/dashboard` nested paths formatting and proper static asset mapping.
    - E2E smoke flow: Toggle skill → persist in JSON → verify output generated in markdown.

### Phase 2: Implementation Structure

```
workspaces/devtools/common/
├── nestjs-dashboard/     # 🚧 TODO - New NestJS module for configs & skills API + Static Markdown Generation
├── dashboard-web/        # 🚧 TODO - New React SPA with Rsbuild, Tailwind, Shadcn, tweakcn
```

### Phase 3: Detailed Implementation Steps

- [ ] Workspace & Build Wiring
  - [ ] Add `common/nestjs-dashboard` and `common/dashboard-web` to `workspaces/devtools/pnpm-workspace.yaml`.
  - [ ] Add the two new packages to `workspaces/devtools/common/server/package.json` dependencies.
  - [ ] Ensure OpenAPI types generation workflow covers `@hod/aweave-nestjs-dashboard` for the web client.
- [ ] Scaffold `@hod/aweave-nestjs-dashboard`
  - [ ] Initialize NestJS module in `workspaces/devtools/common/nestjs-dashboard`
  - [ ] Setup Configs Service to use `@hod/aweave-config-core` pattern (Domain API, effective vs raw separation, validation)
  - [ ] Setup Skills Service (Scan directories, parse frontmatter, read/write `~/.aweave/active-skills.json`)
  - [ ] Write logic to generate a static skills `.md` file upon save
  - [ ] Export module and import into `@hod/aweave-server` (`app.module.ts`)
  - [ ] Configure `app.useStaticAssets` for the web package and add a `DashboardSpaController` fallback route (`/dashboard/*`) inside `aweave-server`.
- [ ] Scaffold `@hod/aweave-dashboard-web`
  - [ ] Initialize Rsbuild + React app
  - [ ] Setup TailwindCSS and Shadcn CLI. Apply the Mono theme
  - [ ] Configure `rsbuild.config.ts` to set `assetPrefix: '/dashboard/'`
  - [ ] Build Configs List & Editor UI (Preview effective, edit override user config)
  - [ ] Build Skills Manager UI (table view with toggles)
  - [ ] Generate API client types from the NestJS OpenAPI spec
- [ ] Update Workflows/Rules
  - [ ] Modify `agent/rules/common/rule.md` (the source of `AGENTS.md`) to append an explicit integration contract step: instructing agents to gracefully load `~/.aweave/loaded-skills.md`.

## Summary of Results

### Completed Achievements

- [List major accomplishments]

## Outstanding Issues & Follow-up

### Issues/Clarifications

- [ ] [Issue 1 – Describe and note impact]
- [ ] [Issue 2 – Describe and note impact]
