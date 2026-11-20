import { createFileRoute } from '@tanstack/react-router'
import { YoutubePublishingDashboard } from '@/components/dashboard/youtube-publishing'

export const Route = createFileRoute('/_protected/dashboard/publishing')({
  head: () => ({ meta: [{ title: 'YouTube Publishing · AIVISO' }] }),
  component: YoutubePublishingDashboard,
})
