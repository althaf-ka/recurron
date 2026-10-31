import { createDatabase } from '@recurron/db'
import * as schema from '@recurron/db/schema'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { readAuthEnvironment } from './env'

export const createAuth = (bindings: Env) => {
  const env = readAuthEnvironment(bindings)
  return betterAuth({
    appName: 'Recurron',
    basePath: '/api/auth',
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(createDatabase(env.DATABASE_URL), {
      provider: 'pg',
      schema,
      // Neon HTTP does not support interactive transactions.
      transaction: false,
    }),
    emailAndPassword: { enabled: true },
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    user: {
      additionalFields: {
        role: {
          defaultValue: 'CUSTOMER',
          input: false,
          type: ['ADMIN', 'STAFF', 'CUSTOMER'],
        },
      },
    },
  })
}
