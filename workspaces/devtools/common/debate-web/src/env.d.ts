/// <reference types="@rsbuild/core/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    /** Base URL for REST API (Rsbuild PUBLIC_ prefix for client-side) */
    PUBLIC_API_URL?: string;
    /** Base URL for WebSocket */
    PUBLIC_WS_URL?: string;
  }
}
