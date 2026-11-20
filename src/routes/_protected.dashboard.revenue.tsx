import { createFileRoute } from '@tanstack/react-router'
import { YoutubeRevenueDashboard } from '@/components/dashboard/youtube-revenue'

export const Route = createFileRoute('/_protected/dashboard/revenue')({
  head: () => ({ meta: [{ title: 'Revenue Optimization · AIVISO' }] }),
  component: YoutubeRevenueDashboard,
})
