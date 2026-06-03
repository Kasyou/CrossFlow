import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['electron', 'better-sqlite3', 'electron-store', 'node-cron', 'xlsx', 'fs', 'path', 'os', 'crypto', 'uuid', 'openai'],
            },
          },
        },
      },
      { entry: 'electron/preload.ts', onstart(args) { args.reload(); } },
    ]),
    renderer(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
