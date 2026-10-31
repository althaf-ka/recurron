import { defineConfig } from 'oxlint'
import core from 'ultracite/oxlint/core'

export default defineConfig({
  env: core.env,
  extends: [core],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    '**/worker-configuration.d.ts',
    '**/.tanstack/**',
    '**/.wrangler/**',
    'packages/db/drizzle/**',
    '**/.env*',
    '**/.dev.vars*',
  ],
  options: { typeAware: true },
  overrides: [
    {
      // Node's test runner owns these promises. Keep the six Phase 1B tests intact,
      // including their async adapter, sequential requests, and object order.
      files: ['apps/server/src/index.test.ts'],
      rules: {
        'no-await-in-loop': 'off',
        'require-await': 'off',
        'sort-keys': 'off',
        'typescript/no-floating-promises': [
          'error',
          {
            allowForKnownSafeCalls: [
              { from: 'package', name: 'test', package: 'node:test' },
            ],
          },
        ],
        'typescript/return-await': ['error', 'in-try-catch'],
      },
    },
    {
      // Hono's cors adapter uses upstream Context<any> in its public signature.
      files: ['apps/server/src/index.ts'],
      rules: { 'typescript/no-unsafe-argument': 'off' },
    },
  ],
})
