import { Hono } from 'hono'
import type { Env } from '../types'

export const healthRoutes = new Hono<{ Bindings: Env }>()

healthRoutes.get('/api/health', c => {
  return c.json({ status: 'ok', service: 'keystone-worker' })
})
