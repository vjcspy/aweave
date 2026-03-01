---
name: Next
description: Planing for the next things
---

# Next

- [x] Create a new mechanism for adding static controller but don't change any code in `workspaces/devtools/common/server/src/main.ts`

---

## workflow-optimization

- [ ] check if cursor cli support agent mode

- [ ] build agent provider **MCP**, code: `APM`

  > This is a local MCP server connecting to -> `CAP` -> `CAS`
  >
  > 1. Fetch agent resources via mcp, so the AI agent doesn't need to scan any specific folder. But how to make it feel like it's fetching from a folder, for example: aweave://agent/skills/DOMAIN/SKILL_NAME, aweave://agent/skills/SKILL_NAME/references/*

  - [ ] skill provider
  - [ ] rule provider
  - [ ] prompt provider

- [ ] build centralize agent server (detail: `resources/workspaces/k/flora/_features/core/centralized-agent-server-CAS.md`)

  - [ ] use vercel proxy -> support communication: plain/encrypt data in both directions (code: `CAP`)

  - [ ] centralize agent server, name it AweaveServer (code: `CAS`)

    > - `CAS` is where we store everything related to agents and centralize it in one place
    > - The most important aspect of `CAS` is to provide long-term memory for AI agents. (detail: `resources/workspaces/k/flora/_features/core/long-term-memory.md`)
    > - Each client machine with `APM` will query `CAS` to fetch data, with a local data caching mechanism to optimize performance.
    >   - This needs more thought. If there's a caching mechanism, there must be a mechanism to validate cache, sync...
    >   - `APM` will handle encryption/decryption and fetch data from itself (of course, we will build a multi-layered API, write a separate layer to communicate with `CAS`, then expose the API for the upper layers to use (the goal is to be able to host `CAS` locally for other use cases in the future))

- [ ] Build long-term memory for AI Agent (detail: `resources/workspaces/k/flora/_features/core/long-term-memory.md`)
