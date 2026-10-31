import { defineConfig } from 'oxlint'
import drizzle from 'ultracite/oxlint/drizzle'

import root from '../../oxlint.config.ts'

// Oxlint lints each file with its nearest config alone, so this extends the
// root config and repeats the properties that extends doesn't carry over.
export default defineConfig({
  env: root.env,
  extends: [root, drizzle],
  ignorePatterns: root.ignorePatterns,
  overrides: [
    {
      // Preserve Drizzle column order and the committed migration representation.
      files: ['src/schema.ts'],
      rules: { 'sort-keys': 'off' },
    },
  ],
})
