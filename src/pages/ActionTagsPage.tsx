import { RouteSkeleton } from '@/components/shared/RouteSkeleton'

export function ActionTagsPage() {
  return (
    <RouteSkeleton
      title="Action Tags"
      description="Preserve existing React mini-app workflows (Tags + Sites/Paths). Compact table and filters — not a permanent tree sidebar."
      layoutHint="Planned composition for the next checkpoint (mock only):"
      plannedSections={[
        'Filter toolbar — search, Site / Path / Action',
        'Compact Tag table — Site | Path | Action | Tag Key | actions',
        'Add Tag drawer + Sites & Paths subview',
      ]}
    />
  )
}
