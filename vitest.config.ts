import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const srcAlias = path.resolve(rootDir, './src')

export default defineConfig({
  resolve: {
    alias: {
      '@': srcAlias,
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '@': srcAlias,
          },
        },
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.repository.test.ts', 'src/**/*.browser.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: {
          alias: {
            '@': srcAlias,
          },
        },
        test: {
          name: 'repository',
          include: ['src/**/*.repository.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        resolve: {
          alias: {
            '@': srcAlias,
          },
        },
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
