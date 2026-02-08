# debate-web

Next.js web application for Arbitrator to monitor AI agent debates and submit RULING/INTERVENTION.

## Purpose

Đây là web interface cho **Arbitrator** (human) trong hệ thống debate:

- **Monitor debates** real-time qua WebSocket
- **Submit INTERVENTION** để pause debate khi cần can thiệp
- **Submit RULING** để phán xử APPEAL hoặc RESOLUTION từ AI agents

Xem spec đầy đủ tại: `devdocs/misc/devtools/debate.md`

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js (App Router) | 16.x |
| Styling | Tailwind CSS | v4 |
| UI Components | shadcn/ui | latest |
| Icons | Lucide React | latest |
| Theme | next-themes | latest |
| WebSocket | Native WebSocket API | - |

## Project Structure

```
debate-web/
├── app/                           # Next.js App Router
│   ├── layout.tsx                 # Root layout + ThemeProvider
│   ├── page.tsx                   # Redirect to /debates
│   ├── globals.css                # Tailwind v4 + CSS variables (shadcn)
│   └── debates/
│       ├── layout.tsx             # Debates layout với Sidebar
│       ├── page.tsx               # Empty state (no debate selected)
│       └── [id]/
│           └── page.tsx           # Debate detail view (main UI)
│
├── components/
│   ├── ui/                        # shadcn/ui components (auto-generated)
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── input.tsx
│   │   ├── scroll-area.tsx
│   │   ├── separator.tsx
│   │   └── textarea.tsx
│   │
│   ├── layout/
│   │   ├── sidebar.tsx            # Left sidebar với debate list
│   │   └── theme-toggle.tsx       # Dark/Light mode dropdown
│   │
│   ├── debate/
│   │   ├── debate-list.tsx        # Filterable list of debates
│   │   ├── debate-item.tsx        # Single debate item in sidebar
│   │   ├── argument-list.tsx      # Scrollable list of arguments
│   │   ├── argument-card.tsx      # Single argument display
│   │   └── action-area.tsx        # INTERVENTION/RULING UI
│   │
│   └── providers/
│       └── theme-provider.tsx     # next-themes wrapper
│
├── hooks/
│   ├── use-debate.ts              # WebSocket connection + debate state
│   └── use-debates-list.ts        # Polling debate list từ REST API
│
├── lib/
│   ├── types.ts                   # Types copied từ debate-server
│   ├── api.ts                     # REST API client (fetchDebates, etc.)
│   └── utils.ts                   # cn() helper từ shadcn
│
├── .env.local                     # Environment variables
├── components.json                # shadcn/ui config
├── next.config.ts                 # Next.js config
├── tailwind.config.ts             # (không có - Tailwind v4 dùng CSS)
└── tsconfig.json                  # TypeScript config
```

## Key Components

### `app/debates/[id]/page.tsx`

Main debate view page. Responsibilities:
- Kết nối WebSocket qua `useDebate` hook
- Hiển thị header (title, state, connection status)
- Render `ArgumentList` và `ActionArea`

### `components/debate/action-area.tsx`

UI cho Arbitrator actions, thay đổi theo debate state:

| State | UI | User Action |
|-------|----|-------------|
| `AWAITING_OPPONENT` | Stop Button | Hold 1s → INTERVENTION |
| `AWAITING_PROPOSER` | Stop Button | Hold 1s → INTERVENTION |
| `AWAITING_ARBITRATOR` | Chat box | Submit RULING |
| `INTERVENTION_PENDING` | Chat box | Submit RULING |
| `CLOSED` | Read-only | None |

**Stop Button UX:**
- Yêu cầu hold 1 giây để confirm (tránh accidental clicks)
- Progress bar hiển thị trong khi hold
- Gửi `submit_intervention` qua WebSocket

### `components/debate/argument-card.tsx`

Hiển thị một argument với:
- **Role badge**: Proposer (blue), Opponent (orange), Arbitrator (purple)
- **Type badge**: MOTION, CLAIM, APPEAL, RULING, INTERVENTION, RESOLUTION
- **Content**: Plain text (whitespace preserved)
- **Timestamp**: Relative time (e.g., "2m ago")

### `components/layout/sidebar.tsx`

Left sidebar chứa:
- App title + Theme toggle
- Search input (filter by title/type)
- Debate list (polling từ server)

## Hooks

### `useDebate(debateId: string)`

WebSocket connection và state management cho một debate.

```typescript
const {
  debate,           // Debate | null
  arguments,        // Argument[]
  connected,        // boolean - WebSocket connection status
  error,            // string | null
  submitIntervention,  // (content?: string) => void
  submitRuling,        // (content: string, close?: boolean) => void
  reconnect,           // () => void
} = useDebate(debateId);
```

**Features:**
- Auto-connect khi mount
- Auto-reconnect với exponential backoff (max 30s)
- Xử lý `initial_state` và `new_argument` events

### `useDebatesList(pollInterval = 5000)`

Polling danh sách debates từ REST API.

```typescript
const {
  debates,   // Debate[]
  loading,   // boolean
  error,     // string | null
  refresh,   // () => void
} = useDebatesList();
```

## WebSocket Protocol

### Connection

```
ws://127.0.0.1:3456/ws?debate_id={id}&token={token}
```

- `debate_id`: Required - ID của debate cần subscribe
- `token`: Optional - Auth token nếu server require

### Server → Client Events

| Event | Data | Trigger |
|-------|------|---------|
| `initial_state` | `{ debate, arguments[] }` | On connect |
| `new_argument` | `{ debate, argument }` | New argument added |

### Client → Server Events

| Event | Data | Description |
|-------|------|-------------|
| `submit_intervention` | `{ debate_id, content? }` | Pause debate |
| `submit_ruling` | `{ debate_id, content, close? }` | Submit ruling |

## Types

Các types được copy từ `debate-server/src/types.ts`:

```typescript
type DebateState =
  | 'AWAITING_OPPONENT'
  | 'AWAITING_PROPOSER'
  | 'AWAITING_ARBITRATOR'
  | 'INTERVENTION_PENDING'
  | 'CLOSED';

type ArgumentType =
  | 'MOTION' | 'CLAIM' | 'APPEAL'
  | 'RULING' | 'INTERVENTION' | 'RESOLUTION';

type Role = 'proposer' | 'opponent' | 'arbitrator';

type Debate = {
  id: string;
  title: string;
  debate_type: string;
  state: DebateState;
  created_at: string;
  updated_at: string;
};

type Argument = {
  id: string;
  debate_id: string;
  parent_id: string | null;
  type: ArgumentType;
  role: Role;
  content: string;
  client_request_id: string | null;
  seq: number;
  created_at: string;
};
```

## Configuration

### Environment Variables

File `.env.local`:

```bash
# debate-server URL
NEXT_PUBLIC_DEBATE_SERVER_URL=http://127.0.0.1:3456
```

### shadcn/ui

Config file `components.json` được tạo bởi `npx shadcn init`.

Thêm component mới:
```bash
npx shadcn@latest add <component-name>
```

## Development

### Prerequisites

- Node.js 20+
- debate-server running on port 3456

### Commands

```bash
# Install dependencies
npm install

# Run development server (port 3000)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint
npm run lint
```

### Adding New Features

1. **New shadcn component**: `npx shadcn@latest add <name>`
2. **New hook**: Create in `hooks/` directory
3. **New debate component**: Create in `components/debate/`
4. **Update types**: Sync với `debate-server/src/types.ts`

## Related Documentation

| Document | Path |
|----------|------|
| Debate Spec | `devdocs/misc/devtools/debate.md` |
| Server Overview | `devdocs/misc/devtools/common/debate-server/OVERVIEW.md` |
| CLI Overview | `devdocs/misc/devtools/common/cli/devtool/aweave/debate/OVERVIEW.md` |
| Web Overview | `devdocs/misc/devtools/common/debate-web/OVERVIEW.md` |

## Architecture Context

```
┌──────────────┐     HTTP/REST     ┌──────────────────┐
│  CLI Python  │ ◄───────────────► │   debate-server  │
│  (aw debate) │                   │   (Node.js)      │
└──────────────┘                   │                  │
      ▲                            │  ┌────────────┐  │
      │                            │  │   SQLite   │  │
AI Agents                          │  └────────────┘  │
                                   └────────┬─────────┘
┌──────────────┐     WebSocket              │
│  debate-web  │ ◄──────────────────────────┘
│  (Next.js)   │
└──────────────┘
      ▲
      │
Human (Arbitrator)
```

- **CLI**: AI agents (Proposer/Opponent) giao tiếp qua CLI commands
- **Server**: Single source of truth cho state machine và data
- **Web**: Human (Arbitrator) monitor và can thiệp qua web interface
