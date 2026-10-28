import { RouteSkeleton } from '@/components/shared/RouteSkeleton'

export function ScriptsPage() {
  return (
    <RouteSkeleton
      title="Script Registry"
      description="Visual script catalog with 16:9 demo thumbnails. Card grid — not a CRUD table."
      layoutHint="Planned composition for the next checkpoint (mock only):"
      plannedSections={[
        'Responsive card grid — 3 / 2 / 1 columns',
        'Card — 16:9 media, Action Tag / name, version, status',
        'Detail drawer + video modal + remove confirmation',
      ]}
    />
  )
}
