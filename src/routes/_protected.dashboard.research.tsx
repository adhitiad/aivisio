import { createFileRoute } from '@tanstack/react-router'
import { YoutubeMarketResearch } from '@/components/dashboard/youtube-market-research'

export const Route = createFileRoute('/_protected/dashboard/research')({
  head: () => ({ meta: [{ title: 'Riset Pasar YouTube · AIVISO' }] }),
  component: YoutubeMarketResearch,
})
