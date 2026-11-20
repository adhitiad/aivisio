import { createFileRoute } from '@tanstack/react-router'

const base = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

const routes: Array<{ path: string; priority: number; changeFrequency: string }> = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/tos', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/policy', priority: 0.3, changeFrequency: 'yearly' },
]

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => {
        const now = new Date().toISOString()
        const body = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...routes.map(
            (r) =>
              `  <url><loc>${base}${r.path}</loc><lastmod>${now}</lastmod><changefreq>${r.changeFrequency}</changefreq><priority>${r.priority}</priority></url>`,
          ),
          '</urlset>',
        ].join('\n')
        return new Response(body, {
          headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        })
      },
    },
  },
})
