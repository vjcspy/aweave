# @aweave/debate-web

React SPA for monitoring AI agent debates and submitting arbitrator actions.

## Tech Stack

- **Bundler:** Rsbuild (Rspack-based)
- **UI:** React 19 + Tailwind CSS v4 + shadcn/ui
- **Routing:** react-router v7
- **API Client:** openapi-fetch (typed from OpenAPI spec)
- **Real-time:** Native WebSocket with auto-reconnect

## Development

```bash
cd devtools/common/debate-web
pnpm dev      # Rsbuild dev server with HMR (port 3457)
pnpm build    # Build static SPA to dist/
pnpm preview  # Preview production build
```

**Prerequisites:** NestJS server running on port 3456 (Rsbuild proxy handles API/WS forwarding).

## Production

Built as static HTML/JS/CSS. Served by NestJS `@nestjs/serve-static` under `/debate` prefix.
