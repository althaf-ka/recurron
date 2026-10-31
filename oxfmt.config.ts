import { defineConfig } from 'oxfmt'
import ultracite from 'ultracite/oxfmt'

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    '**/worker-configuration.d.ts',
    '**/.tanstack/**',
    '**/.wrangler/**',
    'packages/db/drizzle/**',
    '**/.env*',
    '**/.dev.vars*',
  ],
  // Preserve the source style and import evaluation order used before migration.
  overrides: [{ files: ['**/*.jsonc'], options: { trailingComma: 'none' } }],
  semi: false,
  singleQuote: true,
  sortImports: false,
  sortTailwindcss: false,
  trailingComma: 'all',
})
