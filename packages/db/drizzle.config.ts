import { loadEnvFile } from 'node:process'
import { defineConfig } from 'drizzle-kit'

try {
  loadEnvFile('.env')
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
    throw error
  }
}

export default defineConfig({
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  dialect: 'postgresql',
  out: './drizzle',
  schema: './src/schema.ts',
  strict: true,
})
