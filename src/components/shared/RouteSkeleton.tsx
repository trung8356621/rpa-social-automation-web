import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'

type RouteSkeletonProps = {
  title: string
  description: string
  layoutHint: string
  plannedSections: string[]
}

export function RouteSkeleton({
  title,
  description,
  layoutHint,
  plannedSections,
}: RouteSkeletonProps) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={<Badge variant="neutral">Skeleton</Badge>}
      />

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <p className="text-sm text-muted">{layoutHint}</p>
        <ul className="mt-3 space-y-2">
          {plannedSections.map((section) => (
            <li
              key={section}
              className="rounded-[var(--radius-control)] border border-dashed border-border bg-surface-muted px-3 py-2 text-sm text-foreground"
            >
              {section}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          MOCK — detailed business UI deferred to the next approved checkpoint.
        </p>
      </div>
    </div>
  )
}
