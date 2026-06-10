import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    exclude: ['tests/e2e/**', 'node_modules/**'],
    setupFiles: ['./tests/setup-global.ts'],
    css: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
