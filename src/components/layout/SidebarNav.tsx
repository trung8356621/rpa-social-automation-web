import { NavLink } from 'react-router-dom'

import { NAV_ITEMS } from '@/config/navigation'
import { cn } from '@/lib/utils'

export function SidebarNav() {
  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 px-2 py-3">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted hover:bg-surface-muted hover:text-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
