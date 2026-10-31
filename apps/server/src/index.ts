import { RPCHandler } from '@orpc/server/fetch'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuth } from './auth'
import { createRpcContext } from './context'
import { router } from './router'

const app = new Hono<{ Bindings: Env }>()
const rpcHandler = new RPCHandler(router)

app.use(
  '*',
  async (c, next) =>
    await cors({
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
      origin: c.env.WEB_ORIGIN,
    })(c, next),
)

app.get('/health', (c) => c.json({ status: 'ok' }))
app.all('/api/auth/*', async (c) => await createAuth(c.env).handler(c.req.raw))
app.all('/rpc/*', async (c) => {
  const { matched, response } = await rpcHandler.handle(c.req.raw, {
    context: await createRpcContext(c.env, c.req.raw.headers),
    prefix: '/rpc',
  })
  return matched ? c.newResponse(response.body, response) : await c.notFound()
})

app.onError((_error, c) => {
  console.error(JSON.stringify({ event: 'request_failed', path: c.req.path }))
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
