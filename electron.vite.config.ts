import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: 'electron/main.ts',
        formats: ['cjs'],
      },
      outDir: 'dist-electron',
      emptyOutDir: false,
      rollupOptions: {
        external: [
          'electron',
          'better-sqlite3',
          'electron-store',
          'node-cron',
          'xlsx',
          'uuid',
          'openai',
          'path',
          'fs',
          'crypto',
        ],
      },
    },
  },
  preload: {
    build: {
      lib: {
        entry: 'electron/preload.ts',
        formats: ['cjs'],
      },
      outDir: 'dist-electron',
      emptyOutDir: false,
      rollupOptions: {
        external: ['electron'],
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: 'src/index.html',
      },
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    plugins: [react()],
  },
});
