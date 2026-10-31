import { RPCHandler } from '@orpc/server/fetch'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuth } from './auth'
import { router } from './router'

const app = new Hono<{ Bindings: Env }>()
const rpcHandler = new RPCHandler(router)

app.use('*', async (c, next) => {
  return cors({
    origin: c.env.WEB_ORIGIN,
    credentials: true,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })(c, next)
})

app.get('/health', (c) => c.json({ status: 'ok' }))
app.all('/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw))
app.all('/rpc/*', async (c) => {
  const { matched, response } = await rpcHandler.handle(c.req.raw, {
    prefix: '/rpc',
    context: {},
  })
  return matched ? c.newResponse(response.body, response) : c.notFound()
})

app.onError((_error, c) => {
  console.error(JSON.stringify({ event: 'request_failed', path: c.req.path }))
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
