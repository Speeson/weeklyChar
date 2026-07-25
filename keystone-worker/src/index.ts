import { Hono } from 'hono'
import type { Env } from './types'
import { healthRoutes } from './routes/health'

const app = new Hono<{ Bindings: Env }>()

app.route('/', healthRoutes)

export default app
