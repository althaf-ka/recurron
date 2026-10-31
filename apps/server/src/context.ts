import { createAuth } from './auth'
import type { RpcContext } from './authorization'

export const createRpcContext = async (
  bindings: Env,
  headers: Headers,
): Promise<RpcContext> => {
  const auth = createAuth(bindings)
  const session = await auth.api.getSession({ headers })
  return { auth, databaseUrl: bindings.DATABASE_URL, headers, session }
}
