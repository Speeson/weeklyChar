import { Hono } from 'hono'
import { corsMiddleware } from './http'
import type { Env } from './types'
import { authRoutes } from './routes/auth'
import { healthRoutes } from './routes/health'

const app = new Hono<{ Bindings: Env }>()

app.use('*', corsMiddleware)
app.route('/', authRoutes)
app.route('/', healthRoutes)

export default app
