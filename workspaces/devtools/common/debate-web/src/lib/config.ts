/**
 * Runtime configuration for debate-web.
 *
 * Production (served by NestJS): uses window.location.origin (same origin).
 * Dev mode: Rsbuild proxy handles /debates and /ws → relative URLs work.
 */
export const config = {
  /** Base URL for REST API — code appends path like `/debates` */
  apiBaseUrl: window.location.origin,

  /** Base URL for WebSocket — code appends `/ws?debate_id=...` */
  wsBaseUrl: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`,
};
