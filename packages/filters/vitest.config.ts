import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'filters',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})
