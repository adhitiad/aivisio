import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-DNS-Prefetch-Control': 'on',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Content-Security-Policy': csp,
}

function securityHeadersPlugin() {
  const apply = (res: { setHeader: (k: string, v: string) => void }) => {
    for (const [key, value] of Object.entries(securityHeaders)) res.setHeader(key, value)
  }
  return {
    name: 'aiviso-security-headers',
    configureServer(server: {
      middlewares: { use: (fn: (req: unknown, res: any, next: () => void) => void) => void }
    }) {
      server.middlewares.use((_req, res, next) => {
        apply(res)
        next()
      })
    },
    configurePreviewServer(server: {
      middlewares: { use: (fn: (req: unknown, res: any, next: () => void) => void) => void }
    }) {
      server.middlewares.use((_req, res, next) => {
        apply(res)
        next()
      })
    },
  }
}

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    securityHeadersPlugin(),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
    nitro(),
    tsconfigPaths(),
  ],
})
