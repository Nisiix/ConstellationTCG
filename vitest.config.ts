import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'packages/*/vitest.config.ts',
      'adapters/*/vitest.config.ts',
      'workers/*/vitest.config.ts',
      'apps/*/vitest.config.ts',
    ],
    passWithNoTests: true,
  },
})
