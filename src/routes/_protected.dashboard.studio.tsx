import { createFileRoute } from '@tanstack/react-router'
import { CreatorStudioDashboard } from '@/components/dashboard/creator-studio'
export const Route = createFileRoute('/_protected/dashboard/studio')({
  head: () => ({ meta: [{ title: 'Creator Studio · AIVISO' }] }),
  component: CreatorStudioDashboard,
})
