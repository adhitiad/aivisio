import { createFileRoute } from '@tanstack/react-router'
import { YoutubeStrategyDashboard } from '@/components/dashboard/youtube-strategy'

export const Route = createFileRoute('/_protected/dashboard/strategy')({
  head: () => ({ meta: [{ title: 'Niche Strategy · AIVISO' }] }),
  component: YoutubeStrategyDashboard,
})
