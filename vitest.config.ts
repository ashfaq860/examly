import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Minimal config — only the checker's pure-function OMR modules
// (src/lib/checker/omr/*) have tests today. No DOM/React testing here,
// just plain Node.js unit tests, so no jsdom environment is configured.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
  },
});
