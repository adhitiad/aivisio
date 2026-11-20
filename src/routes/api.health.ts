import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/lib/db'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        const start = Date.now()
        let dbOk = false
        try {
          await db.$queryRaw`SELECT 1`
          dbOk = true
        } catch {
          dbOk = false
        }

        return Response.json(
          {
            status: dbOk ? 'ok' : 'degraded',
            db: dbOk ? 'up' : 'down',
            latencyMs: Date.now() - start,
            uptimeSec: Math.round(process.uptime()),
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version ?? '1.0.0',
          },
          {
            status: dbOk ? 200 : 503,
            headers: { 'Cache-Control': 'no-store' },
          },
        )
      },
    },
  },
})
