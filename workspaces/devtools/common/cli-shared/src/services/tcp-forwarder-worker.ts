/**
 * TCP Forwarder Worker
 *
 * Standalone Node.js TCP proxy process.
 * Spawned by forwarder-manager in detached mode.
 *
 * Usage (internal — do not call directly):
 *   FORWARDER_LISTEN_HOST=127.0.0.1
 *   FORWARDER_LISTEN_PORT=3845
 *   FORWARDER_TARGET_HOST=127.0.0.1
 *   FORWARDER_TARGET_PORT=3456
 *
 * Features:
 * - Backpressure-safe piping via `pipe()`
 * - Graceful shutdown on SIGTERM/SIGINT
 * - Non-zero exit on bind/connect failures
 */

import { createConnection, createServer, Server, Socket } from 'net';

const LISTEN_HOST = process.env['FORWARDER_LISTEN_HOST'] ?? '127.0.0.1';
const LISTEN_PORT = parseInt(
  process.env['FORWARDER_LISTEN_PORT'] ?? '3845',
  10,
);
const TARGET_HOST = process.env['FORWARDER_TARGET_HOST'] ?? '127.0.0.1';
const TARGET_PORT = parseInt(
  process.env['FORWARDER_TARGET_PORT'] ?? '3456',
  10,
);

if (isNaN(LISTEN_PORT) || isNaN(TARGET_PORT)) {
  process.stderr.write('tcp-forwarder-worker: invalid port configuration\n');
  process.exit(1);
}

let server: Server | null = null;
const activeSockets: Set<Socket> = new Set();

function shutdown(signal: string): void {
  process.stderr.write(
    `tcp-forwarder-worker: ${signal} received, shutting down\n`,
  );

  // Destroy all active connections
  for (const sock of activeSockets) {
    sock.destroy();
  }

  if (server) {
    server.close(() => {
      process.stderr.write('tcp-forwarder-worker: server closed\n');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server = createServer((clientSocket: Socket) => {
  activeSockets.add(clientSocket);

  const targetSocket = createConnection({
    host: TARGET_HOST,
    port: TARGET_PORT,
  });

  clientSocket.pipe(targetSocket);
  targetSocket.pipe(clientSocket);

  const cleanup = () => {
    clientSocket.destroy();
    targetSocket.destroy();
    activeSockets.delete(clientSocket);
  };

  clientSocket.on('error', cleanup);
  targetSocket.on('error', cleanup);
  clientSocket.on('close', cleanup);
  targetSocket.on('close', cleanup);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  process.stderr.write(`tcp-forwarder-worker: server error: ${err.message}\n`);
  process.exit(1);
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  process.stderr.write(
    `tcp-forwarder-worker: listening on ${LISTEN_HOST}:${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}\n`,
  );
});
