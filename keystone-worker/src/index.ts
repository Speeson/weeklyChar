import { Hono } from 'hono'
import { corsMiddleware } from './http'
import type { Env } from './types'
import { authRoutes } from './routes/auth'
import { healthRoutes } from './routes/health'
import { keystoneRoutes } from './routes/keystones'
import { meRoutes } from './routes/me'

const app = new Hono<{ Bindings: Env }>()

app.use('*', corsMiddleware)
app.route('/', authRoutes)
app.route('/', healthRoutes)
app.route('/', keystoneRoutes)
app.route('/', meRoutes)

export default app
