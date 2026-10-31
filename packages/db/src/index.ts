import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// Construct within the Worker request that owns database I/O.
export function createDatabase(databaseUrl: string) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required')
  return drizzle(neon(databaseUrl), { schema })
}
