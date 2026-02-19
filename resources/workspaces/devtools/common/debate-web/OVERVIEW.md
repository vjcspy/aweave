# Debate Web

React SPA for Arbitrator to monitor debates and submit RULING/INTERVENTION.

## Purpose

Web interface cho Arbitrator (human) để:
- Monitor debates real-time qua WebSocket
- Submit INTERVENTION để pause debate
- Submit RULING để phán xử APPEAL/RESOLUTION

## Tech Stack

| Component | Technology |
|-----------|------------|
| Bundler | Rsbuild (Rspack-based) |
| Framework | React 19 (pure SPA, no SSR) |
| Styling | Tailwind CSS v4 + shadcn/ui (new-york) |
| Routing | react-router v7 |
| API Client | openapi-fetch (typed from OpenAPI spec) |
| Type Generation | openapi-typescript (from server's openapi.json) |
| WebSocket | Native WebSocket API |
| State | React hooks (useReducer) |
| Icons | Lucide React |
| Theme | Custom hook (dark class on html, localStorage) |
| Fonts | @fontsource/geist-sans + @fontsource/geist-mono |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         debate-web                           │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│   SIDEBAR    │              CONTENT AREA                    │
│   (240px)    │                                              │
│              │  ┌────────────────────────────────────────┐  │
│   Search     │  │  Header (title + state + connection)   │  │
│   ──────     │  ├────────────────────────────────────────┤  │
│   Debate 1   │  │  Argument List (scroll)                │  │
│   Debate 2   │  │  - ArgumentCard                        │  │
│   ...        │  │  - ArgumentCard                        │  │
│              │  │  - ...                                 │  │
│              │  ├────────────────────────────────────────┤  │
│              │  │  Action Area                           │  │
│              │  │  (INTERVENTION / RULING UI)            │  │
│              │  └────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────┘
```

**Production deployment:** Served as static files by NestJS `@nestjs/serve-static` under `/debate` prefix. Same origin as API (port 3456).

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PUBLIC_API_URL` | `window.location.origin` | REST API base URL (Rsbuild `PUBLIC_` prefix) |
| `PUBLIC_WS_URL` | auto-detect from location | WebSocket base URL |

**Production:** No env vars needed — uses `window.location.origin` (same origin).
**Dev mode:** Rsbuild proxy forwards `/debates` and `/ws` to `http://127.0.0.1:3456`.

## Project Structure

```
debate-web/
├── rsbuild.config.ts        # Rsbuild config (React, alias, proxy, assetPrefix)
├── postcss.config.cjs       # PostCSS with @tailwindcss/postcss
├── components.json          # shadcn/ui config
├── package.json             # @hod/aweave-debate-web
├── tsconfig.json
└── src/
    ├── index.html           # HTML template (theme flash prevention script)
    ├── main.tsx             # React root mount + BrowserRouter (basename=/debate)
    ├── globals.css          # Tailwind CSS v4 + oklch theme tokens
    ├── env.d.ts             # Rsbuild env type declarations
    ├── routes/              # Route components
    │   ├── root-layout.tsx  # App wrapper with <Outlet />
    │   ├── debates-layout.tsx # Sidebar + <Outlet />
    │   ├── debates-index.tsx  # Empty state (no debate selected)
    │   └── debate-detail.tsx  # Debate view (header, arguments, action area)
    ├── components/
    │   ├── ui/              # shadcn components (badge, button, card, etc.)
    │   ├── debate/          # Debate-specific components
    │   │   ├── debate-list.tsx    # Filterable debate list
    │   │   ├── debate-item.tsx    # Single debate link
    │   │   ├── argument-list.tsx  # Scrollable argument list
    │   │   ├── argument-card.tsx  # Argument display (Markdown)
    │   │   └── action-area.tsx    # INTERVENTION/RULING UI
    │   ├── layout/
    │   │   ├── sidebar.tsx        # Sidebar with logo + theme toggle
    │   │   └── theme-toggle.tsx   # Light/Dark/System dropdown
    │   └── providers/
    │       └── theme-provider.tsx # Custom theme context (replaces next-themes)
    ├── hooks/
    │   ├── use-debate.ts          # WebSocket + debate state (useReducer)
    │   ├── use-debates-list.ts    # Debates list polling
    │   └── use-theme.ts           # Theme persistence + system detection
    └── lib/
        ├── api-types.ts           # Generated from openapi.json (do not edit)
        ├── api.ts                 # openapi-fetch client + wrappers
        ├── config.ts              # Runtime config (API/WS URLs)
        ├── types.ts               # WS event types + entity type unions
        └── utils.ts               # cn() helper (clsx + twMerge)
```

## Routes

| URL | Component | Description |
|-----|-----------|-------------|
| `/debate` | → redirect to `/debate/debates` | Root redirect |
| `/debate/debates` | `DebatesIndex` | Empty state |
| `/debate/debates/:id` | `DebateDetail` | Debate view |

> **Note:** All routes are prefixed with `/debate` (react-router basename). Server API routes (`/debates`, `/ws`) are at root — no conflict.

## Action Area Logic

| State | UI | Action |
|-------|----|--------|
| `AWAITING_OPPONENT` | Stop Button | INTERVENTION |
| `AWAITING_PROPOSER` | Stop Button | INTERVENTION |
| `AWAITING_ARBITRATOR` | Chat box | RULING |
| `INTERVENTION_PENDING` | Chat box | RULING |
| `CLOSED` | Read-only | - |

## WebSocket Integration

### Connection

```typescript
// URL: ws://<host>/ws?debate_id=<id>
// Auto-reconnect with exponential backoff (1s to 30s)
```

### Events

| Direction | Event | Data |
|-----------|-------|------|
| Server → Client | `initial_state` | `{ debate, arguments[] }` |
| Server → Client | `new_argument` | `{ debate, argument }` |
| Client → Server | `submit_intervention` | `{ debate_id, content? }` |
| Client → Server | `submit_ruling` | `{ debate_id, content, close? }` |

## OpenAPI Types Generation

```bash
pnpm generate:types  # Generates src/lib/api-types.ts from ../server/openapi.json
```

Type flow:
```
server/openapi.json → openapi-typescript → src/lib/api-types.ts → src/lib/api.ts → src/lib/types.ts → components
```

## Development

```bash
# Install dependencies (from workspace root)
cd workspaces/devtools && pnpm install

# Regenerate types (if server API changed)
cd common/debate-web && pnpm generate:types

# Run dev server (HMR, proxy to NestJS)
pnpm dev

# Build for production (auto-runs generate:types via prebuild)
pnpm build
```

**Prerequisites:** NestJS server running on port 3456.

## Related

- **Server:** `workspaces/devtools/common/server/`
- **Server Overview:** `resources/workspaces/devtools/common/server/OVERVIEW.md`
- **NestJS Debate Module:** `workspaces/devtools/common/nestjs-debate/`
- **CLI Plugin:** `workspaces/devtools/common/cli-plugin-debate/`
