import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],

  source: {
    entry: {
      index: './src/main.tsx',
    },
  },

  resolve: {
    alias: {
      '@/': './src/',
    },
  },

  html: {
    template: './src/index.html',
  },

  output: {
    assetPrefix: '/debate/',
  },

  server: {
    port: 3457,
    proxy: {
      // Proxy REST API calls to NestJS server
      '/debates': {
        target: 'http://127.0.0.1:3456',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:3456',
        changeOrigin: true,
      },
      // Proxy WebSocket to NestJS server
      '/ws': {
        target: 'ws://127.0.0.1:3456',
        ws: true,
      },
    },
  },
});
