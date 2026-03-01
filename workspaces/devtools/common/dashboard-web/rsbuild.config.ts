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
    assetPrefix: '/dashboard/',
  },

  server: {
    port: 3458,
    proxy: {
      // Proxy REST API calls to NestJS server
      '/configs': {
        target: 'http://127.0.0.1:3456',
        changeOrigin: true,
      },
      '/skills': {
        target: 'http://127.0.0.1:3456',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:3456',
        changeOrigin: true,
      },
      '/logs': {
        target: 'http://127.0.0.1:3456',
        changeOrigin: true,
      },
    },
  },
});
