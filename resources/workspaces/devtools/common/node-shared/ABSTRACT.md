# Node Shared

Neutral Node.js utility library for shared runtime helpers used across DevTools packages (CLI plugins and NestJS modules). It currently provides DevTools root discovery via marker-based ancestor traversal with a unified fallback order: environment override, optional `cwd`, then optional module directory.
