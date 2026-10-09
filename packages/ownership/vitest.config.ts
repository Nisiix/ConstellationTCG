import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'ownership',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
