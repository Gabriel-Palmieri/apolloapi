import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { typescriptDecorators } from './test/typescript.plugin.js';

export default defineConfig({
  plugins: [typescriptDecorators(), tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
