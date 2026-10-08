import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'adapter-pokemon',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
