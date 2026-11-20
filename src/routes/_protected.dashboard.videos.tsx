import { createFileRoute } from '@tanstack/react-router'
import { getVideoRowsFn } from '@/lib/dashboard.functions'
import { VideosTable } from '@/components/dashboard/videos-table'

export const Route = createFileRoute('/_protected/dashboard/videos')({
  loader: () => getVideoRowsFn(),
  head: () => ({ meta: [{ title: 'Video · AIVISO' }] }),
  component: () => <VideosTable items={Route.useLoaderData()} />,
})
