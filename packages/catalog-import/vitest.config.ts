import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'catalog-import',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
})
