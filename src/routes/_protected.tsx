import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { DashboardBreadcrumb } from '@/components/layout/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { getSessionFn } from '@/lib/auth.functions'

export const Route = createFileRoute('/_protected')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) {
      throw redirect({ to: '/login', search: { error: 'required' } })
    }
    return { user: session.user }
  },
  component: ProtectedLayout,
})

function ProtectedLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
          <SidebarTrigger aria-label="Toggle sidebar" />
          <Separator orientation="vertical" className="h-5" />
          <DashboardBreadcrumb />
        </div>
        <div className="flex-1 p-4 sm:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
