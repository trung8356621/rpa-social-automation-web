import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SessionIdentityBadge } from '@/features/session-identity/components/SessionIdentityBadge'
import { useSessionIdentity } from '@/features/session-identity/use-session-identity'
import { getRpaApiMode } from '@/lib/api/config'
import { LIVE_BANNER, MOCK_BANNER } from '@/mocks/labels'

import { SidebarNav } from './SidebarNav'

function BrandBlock() {
  return (
    <div className="px-3 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
        SEO-OPS
      </div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">
        Social Automation
      </div>
    </div>
  )
}

export function AppShell() {
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const isLive = getRpaApiMode() === 'live'
  const modeBadge = isLive ? 'DEV / LIVE' : 'DEV / MOCK'
  const modeBanner = isLive ? LIVE_BANNER : MOCK_BANNER

  const identity = useSessionIdentity()
  const isStaffShell = identity.roleResolved && identity.isStaff
  const showAdminNav = identity.roleResolved
    ? identity.isOwnerOrAdmin
    : false

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileNavOpen])

  useEffect(() => {
    if (!showAdminNav) setMobileNavOpen(false)
  }, [showAdminNav])

  return (
    <div className="flex h-full min-h-full w-full max-w-[100vw] bg-background text-foreground">
      {/* Desktop sidebar — Owner/Admin only; Staff has no admin menus */}
      {showAdminNav ? (
        <aside className="hidden h-full w-56 shrink-0 flex-col border-r border-border bg-surface md:flex max-md:hidden">
          <BrandBlock />
          <Separator />
          <SidebarNav />
          <div className="mt-auto border-t border-border px-3 py-3">
            <Badge variant="warning">{modeBadge}</Badge>
          </div>
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
          {showAdminNav ? (
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
          ) : null}
          <div className="min-w-0 flex-1 md:hidden">
            <div className="truncate text-sm font-semibold text-foreground">
              Social Automation
              {isStaffShell ? (
                <span className="ml-2 text-xs font-normal text-muted">
                  Client Connection
                </span>
              ) : null}
            </div>
          </div>
          <div className="hidden min-w-0 flex-1 md:block">
            {isStaffShell ? (
              <div className="truncate text-sm font-semibold text-foreground">
                Social Automation
                <span className="ml-2 text-xs font-normal text-muted">
                  Client Connection
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SessionIdentityBadge identity={identity} />
            <Badge variant="warning" className="hidden sm:inline-flex">
              {modeBadge}
            </Badge>
          </div>
        </div>

        <div
          role="status"
          className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs break-words text-foreground"
        >
          {modeBanner}
        </div>
        <main className="min-w-0 flex-1 overflow-x-auto px-3 py-4 sm:px-4 md:px-6">
          <Outlet />
        </main>
      </div>

      {mobileNavOpen && showAdminNav ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Primary navigation"
            className="relative z-10 flex h-full w-[min(18rem,85vw)] flex-col border-r border-border bg-surface"
          >
            <div className="flex items-start justify-between gap-2">
              <BrandBlock />
              <Button
                variant="ghost"
                size="icon"
                className="mt-2 mr-2"
                aria-label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <Separator />
            <SidebarNav />
            <div className="mt-auto border-t border-border px-3 py-3">
              <Badge variant="warning">{modeBadge}</Badge>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
