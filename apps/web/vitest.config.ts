import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  // tsconfig keeps `jsx: preserve` for Next; tests that render a component need it compiled.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    name: 'web',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
