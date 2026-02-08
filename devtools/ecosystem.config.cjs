/**
 * pm2 ecosystem config for all devtools services.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 stop all
 *   pm2 restart aweave-server
 *   pm2 logs
 *   pm2 delete all
 */

const path = require('path');

module.exports = {
  apps: [
    {
      // NestJS server — script trỏ thẳng JS entry point để PM2 quản lý process trực tiếp.
      // Không dùng pnpm wrapper vì PM2 cần kill/restart process chính xác (tránh orphan).
      name: 'aweave-server',
      cwd: path.join(__dirname, 'common/server'),
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
        SERVER_PORT: 3456,
        SERVER_HOST: '127.0.0.1',
      },
      autorestart: true,
      max_restarts: 5,
      restart_delay: 1000,
      watch: false,
    },
    {
      // Next.js app — script đi qua pnpm symlink (node_modules/next → .pnpm store).
      // PM2 chạy trực tiếp bằng node, không qua pnpm wrapper (tránh orphan child process).
      name: 'debate-web',
      cwd: path.join(__dirname, 'common/debate-web'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3457,
        NEXT_PUBLIC_DEBATE_SERVER_URL: 'http://127.0.0.1:3456',
      },
      autorestart: true,
      max_restarts: 5,
      restart_delay: 1000,
      watch: false,
    },
  ],
};
