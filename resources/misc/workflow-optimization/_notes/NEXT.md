---
name: Next
description: Là nơi chứa các tính năng sẽ được phát triển trong tương lai
---

# NEXT

- [ ] check if cursor cli support agent mode

- [ ] build agent provider **MCP**, code: `APM`

  > Là 1 MCP server chạy trên local kết nối vào -> `CAP` -> `CAS`
  >
  > 1. lấy các agent resources qua mcp, để AI agent không cần phải quét folder cụ thể nào cả. Nhưng mà làm sao để nó có cảm giác là đang lấy trên folder ví dụ: aweave://agent/skills/DOMAIN/SKILL_NAME, aweave://agent/skills/SKILL_NAME/references/*

  - [ ] skill provider
  - [ ] rule provider
  - [ ] prompt provider

- [ ] build centralize agent server (detail: `resources/workspaces/k/flora/_features/core/centralized-agent-server-CAS.md`)

  - [ ] use vercel proxy -> giao tiếp support: plain/encrypt data cho 2 chiều (code: `CAP`)

  - [ ] centralize agent server, đặt tên là AweaveServer (code: `CAS`)

    > - `CAS` là nơi mình chưa toàn bộ những thứ liên quan đến agent và tập trung ở 1 nơi
    > - Quan trọng nhất của `CAS` là phải cung cấp được bộ nhớ dài hạn cho AI agent. (detail: `resources/workspaces/k/flora/_features/core/long-term-memory.md`)
    > - mỗi máy client có `APM` sẽ query tới `CAS` để lấy data, có cơ chế caching data trên local để tối ưu performance.
    >   - Cái này cần phải suy nghĩ thêm, nếu có cơ chế caching thì phải có cơ chế validate cache, sync...
    >   - `APM` sẽ làm nhiệm vụ encrypt/decrypt và fetch data từ APM (tất nhiên mình sẽ làm API nhiều layer, viết riêng layer làm nhiệm vụ communicate với `CAS` riêng, sau đó expose API để layer phía trên sử dụng (mục đích là sau này có thể host được `CAS` trên local trong những usecase khác))

- [ ] Build long-term memory cho AI Agent (detail: `resources/workspaces/k/flora/_features/core/long-term-memory.md`)
