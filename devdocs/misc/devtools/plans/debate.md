# Debate

Ý tưởng của tôi là xây dựng 1 ecosytem để cung cấp các rules, tools, applications và environment để cho các AI agents có thể tranh luận xung quanh các topic.
Dưới đây là mô tả về nghiệp vụ cũng như hệ thống

## 1. Các bên tham gia

- `Proposer` (AI Agent) – Bên Đề Xuất
Đóng vai trò là thực thể khởi xướng và duy trì định hướng của cuộc tranh luận.

Khởi tạo (MOTION): Có quyền đưa ra chủ đề hoặc vấn đề cần thảo luận ban đầu.

Tiếp nhận & Điều chỉnh (REVISE): Có quyền chấp nhận các CLAIM từ Opponent để cập nhật, chỉnh sửa (revise) lại nội dung đề xuất ban đầu cho phù hợp hơn.

Thỉnh cầu (APPEAL): Khi xảy ra xung đột không thể tự giải quyết với Opponent, Proposer có quyền gửi một bản thỉnh cầu (APPEAL) tới Arbitrator để yêu cầu một quyết định định hướng.

- `Opponent` (AI Agent) – Bên Phản Biện
Đóng vai trò là thực thể kiểm định và đưa ra góc nhìn đối lập.

Phản biện (CLAIM): Có quyền đưa ra các lập luận, bằng chứng hoặc lý lẽ để phản bác, đóng góp ý kiến vào vấn đề mà Proposer đưa ra.

Mục tiêu: Tìm ra các lỗ hổng hoặc điểm chưa tối ưu trong MOTION hoặc các bản REVISE của Proposer.

- `Arbitrator` (User hoặc AI Agent) – Trọng Tài/Người Phân Xử
Đóng vai trò là thực thể có quyền quyết định cao nhất, đảm bảo cuộc tranh luận không bị bế tắc.

Tiếp nhận xung đột: Chỉ tham gia xử lý khi có một record APPEAL được khởi tạo bởi Proposer.

Ra phán quyết (RULING): Có nhiệm vụ xem xét các CLAIM hiện tại của cả hai bên và đưa ra một bản phán quyết (RULING). Record này sẽ đóng vai trò là "kim chỉ nam" bắt buộc để các bên phải tuân thủ và tiếp tục tranh luận theo hướng đó.

### 1.1 Mô tả quy trình debate

**1.1.1** Step1 `Proposer`:
Sử dụng `Proposer Command` để hiểu được cách làm việc, xác định kiểu `debateType` rồi sau đó xác định xem trạng thái hiện tai của debate.
Lúc này sẽ có 2 trường hợp:

- Tham gia lại vào debate đã open trước đó
- Tạo mới một debate conversation

**Trường hợp user gửi một `debate_id` đã tồn tại:**
Sẽ gọi command `aw debate get-context` để lấy thông tin debate cũ đọc và hiểu context, phân tích vả có thể cần thực hiện thêm các addition steps như scan folder, read source code, nói chung là làm toàn bộ nhưng thứ mà cho là cần thiết để lấy được lại context cũ, cuối cùng xem role của argument cuối cùng là gì?
Nếu role là của `Proposer` chính là role của mình thì sẽ gọi `aw debate wait` để chờ kết quả
Nếu role khác `Proposer` tức là đã có phản hồi thì xem phản hồi đó là gì để đánh giá xem có chuẩn không, hoặc nếu là của `Arbitrator` thì follow theo option mà `Arbitrator` đưa ra. Sau đó thực hiện tiếp các công việc cần thiết rồi gọi `aw debate submit` lấy được `argument_id` rồi gọi `aw debate wait` trên `argument_id` để chờ phản hồi

**Trường hợp user yêu cầu create new debate:**
Nếu user yêu cầu tạo debate mới, sử dụng `aw debate generate-id` và `aw debate create`.

Sau khi `aw debate create` trả về response thành công sẽ có `debate_id`, `argument_id`, thì sẽ gọi `aw debate wait` dùng 2 tham số đó và chờ response

**1.1.2** Step2 `Opponent`:
Sử dụng `Opponent Command` để hiểu được cách làm việc, user sẽ cung cấp `debate_id`. Gọi command `aw debate get-context` để lấy thông tin debate cũ đọc và hiểu context, phân tích và có thể cần thực hiện thêm các addition steps như scan folder, read source code, nói chung là làm toàn bộ nhưng thứ mà cho là cần thiết để lấy được lại context cũ, cuối cùng xem role của argument cuối cùng là gì?
Nếu role là `Proposer` thì do chưa có `argument_id` tại thời điểm này nên sẽ xem `type` của `argument` nếu nó là `MOTION` tức là 1 vấn đề mới thì follow theo các rules đã được nạp trước đó để tiền hành đánh giá và sau khi có kết quả thì gọi `aw debate submit`. Response sẽ trả về là `argument_id` tức là thành công và đó chính là `argument` cần được truyền vào command `aw debate wait` cùng với `debate_id` để chờ phản hồi.

**1.1.3** Step3 Lặp lại quá trình debate:
2 bên `Proposer` và `Opponent` sẽ tương tác với nhau. Trong quá trình này sẽ follow theo `rules` đã được nạp từ trước. Các bên có thể sử dụng các công cụ cho phép để yêu cầu thêm thông tin ví dụ như Opponent yêu cầu Proposer submit các document cần thiết và gửi cho Opponent id của document để verify. Nếu `Proposer` thấy các CLAIM của `Opponent` là hợp lý thì sẽ chỉnh sửa, nếu thấy không hợp lý thì phản hồi lại, trong trường hợp KHÔNG thể thống nhất thì `Proposer` có quyền raise `APPEAL` cho `Arbitrator` phán quyết.
`Proposer` sẽ gọi command `aw debate appeal` với tham số `--debate-id`, `--target-id` là `argument_id` trước đó mà cần phán quyết. Cần lưu ý cách đặt câu hỏi chỗ này. Phải nói đủ context, đưa ra các option (luôn phải có 1 option cuối cùng là user sẽ chọn phương án khác). Response từ CLI sẽ trả về new `argument_id` cho bản ghi argument đã được tạo. `Proposer` sau đó sẽ lại call `aw debate wait`.
`Opponent` trước đó đã called `aw debate wait` và nhận được phản hồi tuy nhiên argument có type là `APPEAL` thì sẽ chỉ thông báo cho user là phía `Proposer` đang yêu cầu phán xử, và sẽ call tiếp `aw debate wait` với new `argument_id` chờ `Arbitrator` phán quyết.

**1.1.4** Step4 `Arbitrator` phán quyết:
`Arbitrator` sẽ sử dụng debate-web application (sẽ được build để monitoring conversation) để submit RULING, cái này sẽ call xuống debate-server để tạo bản ghi mới trong database.
Khi có bản ghi mới thì `Proposer` và `Opponent` đều sẽ nhận được response. Tuy nhiên lúc đó mỗi bên sẽ hành động khác nhau.
`Proposer` hành động để align theo phán quyết. Sau đó gọi `aw debate submit` rồi gọi `aw debate wait`.
`Opponent` chỉ đơn giản là đọc hiểu ngữ cảnh, lấy được `argument_id` của phán quyết này rồi gọi luôn `aw debate wait` để chờ `Proposer` align theo phán quyết.

**1.1.5** Step5 2 bên đều nhất trí hết các điểm:
Lúc đó `Proposer` sẽ gọi `aw debate request-completion` để tạo bản ghi `RESOLUTION`. **Server sẽ tự động tạo bản ghi `RULING` với close=true** (auto-ruling), chuyển state của debate sang `CLOSED`. Cả 2 `Proposer` và `Opponent` sẽ nhận `action: "debate_closed"` khi poll và dừng lại.

> **Note:** Trong giai đoạn hiện tại, server auto-approve RESOLUTION — không cần Arbitrator can thiệp thủ công.
> Khi Proposer submit RESOLUTION, server sẽ tự động tạo một bản ghi RULING (close=true) ngay lập tức.
> Điều này giúp debate kết thúc nhanh gọn nếu Proposer đã hài lòng.

**1.1.6** Lưu ý về INTERVENTION:

Vào bất cứ thời điểm nào `Arbitrator` cũng có thể can thiệp bằng cách submit 1 bản ghi `INTERVENTION`.

**QUAN TRỌNG - INTERVENTION Semantics:**
- INTERVENTION **không hủy** argument mà AI agent đang soạn
- INTERVENTION được xử lý như một argument mới "đứng trước" vòng tiếp theo
- Nếu 1 AI agent đang soạn argument, agent đó vẫn submit được, nhưng sau khi submit xong sẽ nhận được response yêu cầu `aw debate wait` trên `argument_id` của bản ghi `INTERVENTION`

**Flow:**
1. `debate-web` submit `INTERVENTION` → state chuyển sang `INTERVENTION_PENDING`
2. Cả 2 AI agents nhận response với `action: "wait_for_ruling"`
3. `Arbitrator` submit tiếp bản ghi `RULING` → quay về Step4

### 1.2 Document Sharing Mechanism (Cơ chế chia sẻ tài liệu)

**QUAN TRỌNG:** Argument content chỉ chứa **summary ngắn + references (doc_id)**, không paste nội dung dài. Sử dụng CLI tool `aw docs` để chia sẻ tài liệu đầy đủ.

**Nguyên tắc:**

1. **Tài liệu dài phải qua docs CLI tool**: Sử dụng `aw docs` để submit và get document
2. **Argument chỉ chứa summary + doc_id**: Có thể kèm snippet cực ngắn nếu cần, nhưng không paste toàn bộ nội dung
3. **Giới hạn content size**: Server enforce max content length (ví dụ: 10KB) để tránh abuse
4. **Mỗi bên duy trì file ở local**: Proposer/Opponent làm việc trực tiếp trên file local của mình, khi cần bên kia review thì submit lên để có version tracking
5. **Lấy tài liệu qua ID**: Bất kỳ bên nào (Proposer/Opponent) có thể get document qua ID ở bất kỳ thời điểm nào

**Các trường hợp sử dụng:**

| Trường hợp | Hành động |
|------------|-----------|
| Proposer tạo debate với tài liệu | Tạo file qua `aw docs create`, gửi `doc_id` kèm trong MOTION content |
| Opponent cần thêm context | Gửi CLAIM yêu cầu Proposer submit tài liệu bổ sung và cung cấp `doc_id` |
| Update tài liệu sau khi chỉnh sửa | Submit version mới qua `aw docs submit <doc_id>`, gửi `doc_id` cho bên kia |

> **Note:** `aw docs create` = tạo document mới (version 1), `aw docs submit` = tạo version mới cho document đã tồn tại.

**Cấu hình Tools cho Debate:**

Cần có cơ chế cấu hình để AI agents biết các CLI tools được phép sử dụng trong debate. Các tools này sẽ được mô tả trong Command/Skill của từng role (Proposer/Opponent) theo `debateType`.

## 2. Hệ thống cần xây dựng

### 2.0 Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ARCHITECTURE OVERVIEW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐         HTTP/REST         ┌──────────────────────┐       │
│   │  OCLIF CLI   │ ◄───────────────────────► │   Unified Server     │       │
│   │(@aweave/cli) │                           │     (NestJS)         │       │
│   └──────────────┘                           │                      │       │
│         ▲                                    │  ┌────────────────┐  │       │
│         │                                    │  │     Prisma     │  │       │
│   AI Agents call                             │  │sqlite-datasource│  │      │
│   CLI commands                               │  └────────────────┘  │       │
│                                              │         │            │       │
│                                              │  ┌──────▼─────────┐  │       │
│   ┌──────────────┐      WebSocket            │  │  ~/.aweave/    │  │       │
│   │  debate-web  │ ◄───────────────────────► │  │  db/debate.db  │  │       │
│   │  (Next.js)   │                           │  └────────────────┘  │       │
│   └──────────────┘                           └──────────────────────┘       │
│         ▲                                                                   │
│         │                                                                   │
│   Human (Arbitrator)                                                        │
│   monitors & submits                                                        │
│   RULING/INTERVENTION                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Quyết định kỹ thuật:**

| Component | Technology | Lý do |
|-----------|------------|-------|
| Database | SQLite (Prisma v7) | Lightweight, file-based, type-safe query builder |
| Server Framework | NestJS | Modular architecture, easy WebSocket integration, widely used in monorepo |
| CLI Framework | OCLIF (Node.js) | Standard plugin system, TypeScript-first, easy to extend |
| State Machine | XState v5 | Shared logic between CLI and Server, visualized states |
| Web | Next.js + shadcn | Modern, fast development, shared component library |

**Data Flow:**
- CLI **KHÔNG** access database trực tiếp.
- Mọi data access đều qua NestJS server (HTTP REST API).
- State machine được định nghĩa trong `@aweave/debate-machine` (xstate v5) — shared package.
- CLI import machine để tính `available_actions` (pre-validation/hinting).
- Server import machine để validate strict rules trước khi persist vào DB.
- Server là single source of truth cho locking và data persistence.

### 2.1 State Machine

Sử dụng package `@aweave/debate-machine` để quản lý trạng thái.

#### 2.1.1 States

| State | Mô tả | Ai đang chờ? |
|-------|-------|--------------|
| `AWAITING_OPPONENT` | Chờ Opponent phản hồi | Proposer waiting |
| `AWAITING_PROPOSER` | Chờ Proposer phản hồi | Opponent waiting |
| `AWAITING_ARBITRATOR` | Chờ Arbitrator phán xử (APPEAL/RESOLUTION) | **Cả 2 waiting** |
| `INTERVENTION_PENDING` | Arbitrator đã INTERVENTION, chờ RULING | **Cả 2 waiting** |
| `CLOSED` | Debate kết thúc | Không ai chờ |

#### 2.1.2 Transitions

Logic chuyển đổi trạng thái được định nghĩa chặt chẽ trong XState machine.

| From State | Action | By | To State |
|------------|--------|-----|----------|
| - | `createDebate(MOTION)` | Proposer | `AWAITING_OPPONENT` |
| `AWAITING_OPPONENT` | `submitArgument(CLAIM)` | Opponent | `AWAITING_PROPOSER` |
| `AWAITING_OPPONENT` | `submitIntervention()` | Arbitrator | `INTERVENTION_PENDING` |
| `AWAITING_PROPOSER` | `submitArgument(CLAIM)` | Proposer | `AWAITING_OPPONENT` |
| `AWAITING_PROPOSER` | `submitAppeal()` | Proposer | `AWAITING_ARBITRATOR` |
| `AWAITING_PROPOSER` | `requestCompletion()` | Proposer | `AWAITING_ARBITRATOR` |
| `AWAITING_PROPOSER` | `submitIntervention()` | Arbitrator | `INTERVENTION_PENDING` |
| `AWAITING_ARBITRATOR` | `submitRuling()` | Arbitrator | `AWAITING_PROPOSER` |
| `AWAITING_ARBITRATOR` | `submitRuling(close=true)` | Arbitrator | `CLOSED` |
| `INTERVENTION_PENDING` | `submitRuling()` | Arbitrator | `AWAITING_PROPOSER` |
| `INTERVENTION_PENDING` | `submitRuling(close=true)` | Arbitrator | `CLOSED` |

#### 2.1.3 Argument Types

| Type | Ai tạo | Mô tả |
|------|--------|-------|
| `MOTION` | Proposer | Khởi tạo vấn đề ban đầu |
| `CLAIM` | Proposer/Opponent | Lập luận, phản biện qua lại |
| `APPEAL` | Proposer | Yêu cầu Arbitrator phán xử |
| `RULING` | Arbitrator | Phán quyết |
| `INTERVENTION` | Arbitrator | Can thiệp giữa chừng |
| `RESOLUTION` | Proposer | Yêu cầu kết thúc debate |

### 2.2 Communication Pattern

#### 2.2.1 Interval Polling cho `aw debate wait`

Khác với kiến trúc cũ (Long Polling), hệ thống mới sử dụng **Interval Polling** để đơn giản hóa server và tránh giữ connection lâu.

- **Endpoint**: `GET /debates/:id/poll`
- **Behavior**: Server trả về kết quả ngay lập tức (Immediate Response).
- **Client Logic**: CLI gọi endpoint này mỗi `POLL_INTERVAL` giây (mặc định 2s) cho đến khi có dữ liệu mới hoặc timeout.

```typescript
// CLI Pseudo-code
while (elapsed < DEADLINE) {
    const response = await api.poll(debateId, lastArgumentId, role);
    if (response.has_new_argument) {
        return response; // Success, return action to Agent
    }
    await sleep(2000); // Wait 2s
}
return TIMEOUT; // Tell Agent to retry
```

**Tham số `aw debate wait`:**
- `--debate-id`: ID của debate
- `--argument-id`: ID của argument đang chờ response
- `--role`: Role của requester (`proposer` hoặc `opponent`) - để server trả response chứa `available_actions` phù hợp

#### 2.2.2 Response theo Role

| Scenario | Proposer nhận | Opponent nhận |
|----------|---------------|---------------|
| Opponent vừa CLAIM | `action: "respond"` | - (đang chờ) |
| Proposer vừa CLAIM | - (đang chờ) | `action: "respond"` |
| Arbitrator RULING | `action: "align_to_ruling"` | `action: "wait_for_proposer"` |
| Arbitrator INTERVENTION | `action: "wait_for_ruling"` | `action: "wait_for_ruling"` |
| Debate CLOSED | `action: "debate_closed"` | `action: "debate_closed"` |

#### 2.2.3 Timeout Behavior

**Wait Deadline:**
- CLI có overall deadline (ví dụ: **2 phút**).
- Nếu sau deadline vẫn chưa có response, CLI trả về `status: "timeout"`.
- AI agent được hướng dẫn (qua tool output) để retry command `aw debate wait`.

> Việc timeout là bình thường trong các debate dài hơi (ví dụ Opponent cần nhiều thời gian suy nghĩ). Agent chỉ cần chạy lại wait command.

### 2.3 Devtool CLI

Sử dụng framework OCLIF. Code nằm tại `devtools/common/cli` và `devtools/common/cli-plugin-debate`.

#### 2.3.1 Các components trong `devtools`

- **@aweave/cli**: Core CLI entry point.
- **@aweave/cli-plugin-debate**: OCLIF plugin chứa các command `aw debate ...`.
- **@aweave/debate-machine**: Shared XState machine logic.
- **@aweave/nestjs-debate**: NestJS module cho debate logic.
- **@aweave/server**: Unified NestJS server hosting các module.

#### 2.3.2 Database Schema (Prisma)

File: `devtools/common/nestjs-debate/prisma/schema.prisma`

**Debate:**
- `id`: UUID
- `title`: String
- `debateType`: String
- `state`: String (Enum-like string mapping to XState)
- `createdAt`, `updatedAt`

**Argument:**
- `id`: UUID
- `debateId`: UUID (FK Debate)
- `parentId`: UUID (Self-ref)
- `type`: String (MOTION, CLAIM, etc.)
- `role`: String (proposer, opponent, arbitrator)
- `content`: String
- `clientRequestId`: String (Idempotency Key)
- `seq`: Int (Sequence number per debate, ordered)

**Ordering:**
- Sử dụng `seq` integer tăng dần per debate để đảm bảo thứ tự arguments.
- `seq` được gán atomic trong transaction DB khi insert argument.

#### 2.3.3 CLI Commands

**`aw debate generate-id`**
Trả về UUID để AI agent sử dụng làm ID.

**`aw debate get-context`**
Lấy lại context của debate đã tồn tại (resume flow).
Trả về: `debate`, `arguments` (limit N), và `available_actions` (hint từ XState).

**`aw debate create`**
Proposer khởi tạo debate mới.
Tham số: `--debate-id`, `--title`, `--type`, `--file`/`--content`, `--client-request-id`.

**`aw debate wait`**
Chờ response từ bên đối diện (Interval Polling).
Tham số: `--debate-id`, `--argument-id`, `--role`.

**`aw debate submit`**
Submit argument mới (CLAIM).
Tham số: `--debate-id`, `--role`, `--target-id`, `--content`, `--client-request-id`.

**`aw debate appeal`**
Proposer submit APPEAL yêu cầu Arbitrator phán xử.

**`aw debate request-completion`**
Proposer yêu cầu kết thúc debate (tạo RESOLUTION).
Server sẽ tự động trigger `submitRuling(close=true)` ngay sau đó.

### 2.4 Concurrency & Locking

#### 2.4.1 Server-side Locking

Mỗi debate có một mutex lock (sử dụng library `async-mutex` hoặc tương tự trong NestJS Service).
Tại một thời điểm chỉ có 1 request write được xử lý cho một debateId để đảm bảo tính nhất quán của `seq` và `state`.

#### 2.4.2 State/Role Validation

Server sử dụng `@aweave/debate-machine` để validate mọi action trước khi ghi vào DB.
Nếu `canTransition(currentState, event)` trả về false, server ném lỗi `ActionNotAllowed` về phía CLI.

### 2.5 Error Handling & Recovery

**Idempotency:**
Mọi submit command đều yêu cầu `client_request_id`.
Server check unique constraint `(debate_id, client_request_id)`.
Nếu trùng ID, trả về thành công với data của record đã tồn tại (không tạo bản ghi duplicate).

**Retries:**
CLI tự động retry các lỗi network thoáng qua.
Với lỗi logic (như sai state), trả về lỗi rõ ràng để Agent biết cách xử lý (vd: gọi lại `get-context`).

### 2.6 Commands, Rules, Skills Structure

Tương tự kiến trúc cũ, Agent được trang bị:
1. **Commands**: Hướng dẫn sử dụng CLI (`aw debate ...`).
2. **Rules**: Quy định cách hành xử, format nội dung debate theo `debateType`.

Folder structure:
```
devdocs/agent/
├── commands/
│   └── common/
│       ├── debate-proposer.md
│       └── debate-opponent.md
│
└── rules/
    └── common/
        └── debate/
            ├── proposer/
            │   ├── coding-plan.md
            │   └── general.md
            └── opponent/
                ├── coding-plan.md
                └── general.md
```

### 2.7 debate-web

Web application (Next.js) để Arbitrator (Human) theo dõi và can thiệp.

- **Tech**: Next.js, WebSocket (`@nestjs/platform-ws`).
- **Features**:
    - Real-time updates (nghe event `new_argument` từ server).
    - Hiển thị danh sách debate, chi tiết argument.
    - Action UI: Nút Stop (Intervention), Form Ruling.

### 2.8 Unified Server (NestJS)

Node.js server unified tại `devtools/common/server`.

#### 2.8.1 Responsibilities
1. **Modules**: Load `@aweave/nestjs-debate` module.
2. **REST API**: Phục vụ CLI requests.
3. **WebSocket**: Phục vụ Web real-time updates.
4. **Persistence**: Quản lý connection tới SQLite via Prisma.

#### 2.8.2 API Endpoints (REST)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/debates` | Create debate |
| GET | `/debates/:id` | Get debate + arguments |
| GET | `/debates/:id/poll` | Poll for new arguments (New!) |
| POST | `/debates/:id/arguments` | Submit argument |
| POST | `/debates/:id/appeal` | Submit appeal |
| POST | `/debates/:id/resolution` | Request completion |
| POST | `/debates/:id/ruling` | Submit ruling (Arbitrator only) |
| POST | `/debates/:id/intervention` | Submit intervention (Arbitrator only) |

#### 2.8.3 WebSocket Events

- `new_argument`: Broadcast khi có argument mới (bao gồm cả Auto-ruling).
- `initial_state`: Gửi khi client connect.

## 3. Tóm tắt migration path

Kiến trúc hiện tại đã chuyển dịch hoàn toàn sang hệ sinh thái TypeScript/Node.js giúp đồng bộ hóa công nghệ và dễ dàng bảo trì.

| Component | Old (Python/Legacy) | New (TypeScript) |
|-----------|---------------------|------------------|
| **CLI** | Python (`typer`) | Node.js (`oclif`) |
| **Server** | Express/Standalone | NestJS Unified Server |
| **DB Access** | Raw SQLite | Prisma ORM |
| **State Logic** | Custom TS file | XState Shared Package |
| **Waiting** | Long Polling | Interval Polling |

Việc update document này phản ánh đúng thực trạng code base hiện tại (tháng 2/2026).
