import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from './schema'

// Own the WebSocket pool for one Worker request and close it when the caller is done.
export const createTransactionDatabase = (databaseUrl: string) => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }
  const pool = new Pool({ connectionString: databaseUrl, max: 1 })
  return {
    close: async () => {
      await pool.end()
    },
    db: drizzle({ client: pool, schema }),
  }
}
