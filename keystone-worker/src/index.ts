import { Hono } from 'hono'
import { corsMiddleware } from './http'
import type { Env } from './types'
import { authRoutes } from './routes/auth'
import { healthRoutes } from './routes/health'
import { keystoneRoutes } from './routes/keystones'
import { meRoutes } from './routes/me'
import { teamRoutes } from './routes/teams'
import { workersDevSmokeGuard } from './workersDevSmokeGuard'

const app = new Hono<{ Bindings: Env }>()

app.use('*', workersDevSmokeGuard)
app.use('*', corsMiddleware)
app.route('/', authRoutes)
app.route('/', healthRoutes)
app.route('/', keystoneRoutes)
app.route('/', meRoutes)
app.route('/', teamRoutes)

app.onError((error, c) => {
  console.error('Unhandled Worker error:', error)
  return c.json({ detail: error instanceof Error ? error.message : 'Internal Server Error' }, 500)
})

export default app
