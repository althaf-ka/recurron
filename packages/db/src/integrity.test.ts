import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { sql } from 'drizzle-orm'
import { createDatabase } from './index'

await test('real PostgreSQL business constraints and snapshots, with rolled-back fixtures', async () => {
  const url = process.env.DATABASE_URL
  assert.ok(
    url !== undefined && url !== '',
    'DATABASE_URL is required for the explicit integrity test',
  )
  const db = createDatabase(url)
  await db.execute(
    sql.raw(await readFile(new URL('integrity.sql', import.meta.url), 'utf-8')),
  )
})
