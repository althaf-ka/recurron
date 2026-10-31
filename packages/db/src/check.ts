import { sql } from 'drizzle-orm'
import { createDatabase } from './index'

const databaseUrl = process.env.DATABASE_URL
if (databaseUrl !== undefined && databaseUrl !== '') {
  try {
    const db = createDatabase(databaseUrl)
    await db.execute(sql`select 1 as connected`)
    console.info('Neon connection succeeded.')
    // Read-only: also confirm that the auth migration has been applied.
    await db.execute(sql`select id from "user" limit 0`)
    await db.execute(sql`select id from session limit 0`)
    await db.execute(sql`select id from account limit 0`)
    await db.execute(sql`select id from verification limit 0`)
    console.info('Better Auth tables are available.')
  } catch {
    console.error(
      'Database verification failed. Check connectivity and apply auth migrations.',
    )
    process.exitCode = 1
  }
} else {
  console.error(
    'DATABASE_URL is required. Set it in packages/db/.env or the shell.',
  )
  process.exitCode = 1
}
