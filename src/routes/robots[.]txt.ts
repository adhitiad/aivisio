import { createFileRoute } from '@tanstack/react-router'

const base = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(
          [
            'User-agent: *',
            'Allow: /',
            'Disallow: /dashboard',
            'Disallow: /api',
            'Disallow: /login',
            '',
            'User-agent: GPTBot',
            'Disallow: /dashboard',
            'Disallow: /api',
            '',
            'User-agent: CCBot',
            'Disallow: /',
            '',
            `Sitemap: ${base}/sitemap.xml`,
          ].join('\n'),
          { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
        ),
    },
  },
})
