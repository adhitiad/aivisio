import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Clapperboard,
  History,
  Mail,
  Plug,
  ArrowRight,
} from 'lucide-react'
import { useT } from '@/lib/i18n'
import { getDashboardStatsFn } from '@/lib/dashboard.functions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_protected/dashboard')({
  loader: () => getDashboardStatsFn(),
  head: () => ({ meta: [{ title: 'Dasbor · AIVISO' }] }),
  component: DashboardOverviewPage,
})

function DashboardOverviewPage() {
  const t = useT()
  const { generations, videos, activeProviders, newMessages, recent } =
    Route.useLoaderData()

  const stats = [
    { label: t('dashboard.stats.generations'), value: generations, icon: History, href: '/dashboard/history' as const },
    { label: t('dashboard.stats.videos'), value: videos, icon: Clapperboard, href: '/dashboard/videos' as const },
    { label: t('dashboard.stats.providers'), value: activeProviders, icon: Plug, href: '/dashboard/providers' as const },
    { label: t('dashboard.stats.messages'), value: newMessages, icon: Mail, href: '/dashboard/messages' as const },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.overview')}</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Link key={s.href} to={s.href} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {s.label}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold tabular-nums">{s.value}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('dashboard.recentGenerations')}</CardTitle>
          <Button variant="ghost" size="sm" asChild className="gap-1">
            <Link to="/dashboard/history">
              {t('common.view')}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t('common.empty')}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate">{item.title}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {item.toolId}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {item.createdAt.toISOString().slice(0, 10)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
