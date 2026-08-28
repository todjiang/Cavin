import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Packages resolve to TS source (exports → ./src), so tests run from
    // source with no build step. dist/ holds the emitted build artifacts
    // (including compiled copies of the test files) — never run those.
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
