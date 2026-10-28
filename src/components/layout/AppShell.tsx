import { Outlet } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MOCK_BANNER } from '@/mocks/labels'

import { SidebarNav } from './SidebarNav'

export function AppShell() {
  return (
    <div className="flex h-full min-h-full bg-background text-foreground">
      <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-3 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
            SEO-OPS
          </div>
          <div className="mt-0.5 text-sm font-semibold text-foreground">
            Social Automation
          </div>
        </div>
        <Separator />
        <SidebarNav />
        <div className="mt-auto border-t border-border px-3 py-3">
          <Badge variant="warning">DEV / MOCK</Badge>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          role="status"
          className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-foreground"
        >
          {MOCK_BANNER}
        </div>
        <main className="flex-1 px-4 py-4 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
