import { createDatabase } from '@recurron/db'
import * as schema from '@recurron/db/schema'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { readAuthEnvironment } from './env'

export function createAuth(bindings: Env) {
  const env = readAuthEnvironment(bindings)
  return betterAuth({
    appName: 'Recurron',
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: drizzleAdapter(createDatabase(env.DATABASE_URL), {
      provider: 'pg',
      schema,
      // Neon HTTP does not support interactive transactions.
      transaction: false,
    }),
    emailAndPassword: { enabled: true },
  })
}
