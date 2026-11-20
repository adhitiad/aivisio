import { createFileRoute } from '@tanstack/react-router'
import { YoutubeAnalyticsDashboard } from '@/components/dashboard/youtube-analytics'

export const Route = createFileRoute('/_protected/dashboard/analytics')({
  head: () => ({ meta: [{ title: 'YouTube Analytics · AIVISO' }] }),
  component: YoutubeAnalyticsDashboard,
})
