# Long-term memory

## Objective

Phải luôn suy nghĩ bài toán rộng

Trí nhớ dài hạn cho agent(không chỉ 1 agent mà là cho mỗi agent)

- Đối với mỗi sub-agent:

  - Biết được đang làm gì
  - biết được đã làm gì

- Đối với agent trên phạm vi workspace:

  - đã làm những gì?
  - những sai sót trong quá khứ
  - có những decision quan trọng nào đã được make mà cần respect?
  - kinh nghiệm -> `CAS`/`APM` sẽ phải cung cấp cách để Agent tạo và tự lưu được skill (kinh nghiệm) mới (skill thì tổ chức theo: workspace)

## Ideas

> Vì đang còn rất nhiều mảnh ghép nên dưới đây là những idea vụn vặt chưa phân loại, sẽ tổ chức lại khi mường tượng được một bức tranh cụ thể

### Phân loại memory

Memory được chia thành nhiều layer(là nói đến cách load)

- Layer 1: Hot Memory (auto-loaded, always available)
Phần này sẽ để trong `agent/rules/common/hot-memory` và dùng symlink để tạo cho cursor, codex, antigravity...

- Layer 2: Warm Memory (loaded on demand)

- Layer 3: Cold Memory (transcripts, searchable khi cần)

Memory được chia thành nhiều tier(là nói đến context size)

- Tier 0: Abstract (100-200 tokens)
- Tier 1: Overview (1-2 pages)
- Tier 2: Details (Full docs)

## Key architecture

- Mỗi bài toán cần tìm cách giải đơn giản nhất nhưng phải đảm bảo có khả năng mở rộng
- nếu có những rule cố định ví dụ khi làm việc trong 1 workspace/domain thì cần có những context gì -> không nên chỉ bằng lời để AI agent tự load mà nên build tool -> tool sẽ đi tổng hợp Tier-0 memory(từ front-matter) cho AI agent
-

## Usecase and solution

- Build 1 new MCP: coding_memory

### Workspace workflow

>Là Layer 1 hot memory, luôn được load khi agent start new conversation

- Không tổ chức chỉ 1 file `AGENTS.md` như bây giờ nữa, mà sẽ tạo ra các file riêng cho từng mục đích cụ thể rồi dùng symlink để tạo cho cursor, codex, antigravity... Ví dụ:

```text
# tạo symlink dến các folder cho các AI agent cụ thể ví dụ như .cursor, .codex, .antigravity...
.agent/rules/common/
├── user-profile.md                 # who you are, preferences, coding style
├── global-conventions.md           # cross-cutting decisions, patterns
└── coding-workspace-workflow.md 

.cursor/rules/
├── gitignore-tool-behavior.md      # bắt buộc phải có cho cursor thì để luôn vào git
```

### Cần biết đã làm những gì?

>Là L2 warm memory, chỉ load khi liên quan đến coding và load đúng theo scope(workspace/domain/repository)

- AI agent will call tool `get_warm_memory_journal` and pass in workspace/domain/repository. Tùy vào param mà tool will aggregate information from the correct scope. For example, if only workspace is passed, the tool will aggregate from workspace, if workspace and domain are passed, the tool will aggregate from workspace and domain...
- Tool will scan folder `_plans` chỉ lấy front-matter and build thành 1 yalm format trả về cho AI agent

### Cần biết overview của workspace

>Là L2 warm memory, chỉ load khi liên quan đến coding và load đúng theo scope(workspace/domain/repository)

- AI agent will call tool `get_warm_memory_overview` and pass in workspace/domain/repository. Depending on the param, the tool will aggregate information from the correct scope. For example, if only workspace is passed, the tool will aggregate from workspace, if workspace and domain are passed, the tool will aggregate from workspace and domain...
- Tool will scan all `OVERVIEW.md` files in workspace/domain/repository and build into 1 yalm format and return to AI agent. Note that the global OVERVIEW.md will always be returned full, while domain/repository will be returned Tier-0 memory

### Decision / Lesson learned

>Là L2 cold memory, chỉ load khi liên quan đến coding và load đúng theo scope(workspace/domain/repository)

- Tổ chức theo structure như sau

```text
user/memory/
├── workspaces/
│   ├── k/stock/metan/
│   │   ├── decisions.md     # ADR-lite, key choices made
│   │   └── lessons.md       # mistakes, gotchas, what worked
│   └── devtools/
│       ├── journal.md
│       ├── decisions.md
│       └── lessons.md
```

- AI agent will call tool `get_warm_memory_user_preference` and pass in workspace/domain/repository. Depending on the param, the tool will aggregate information from the correct scope. For example, if only workspace is passed, the tool will aggregate from workspace, if workspace and domain are passed, the tool will aggregate from workspace and domain...
- Tool will scan all folder in `user/memory/workspaces/**` and build into 1 yalm format and return to AI agent. Because the data in here is already optimized context(usually short and concise) so it will return full content

### Search index(vector store/graph database)
>
> Đến thời điểm hiện tại chưa có usecase cụ thể nên chưa cần build

## API/Achitecture
