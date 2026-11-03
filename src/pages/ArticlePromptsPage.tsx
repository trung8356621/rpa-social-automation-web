import { ArticlePromptsScreen } from '@/features/campaigns/components/ArticlePromptsScreen'
import { useActionRegistry } from '@/features/action-tags/use-action-registry'

export function ArticlePromptsPage() {
  const registry = useActionRegistry()

  return (
    <ArticlePromptsScreen
      tags={registry.data.tags}
      tagsLoading={registry.loading}
      aiGenerationAvailable={false}
    />
  )
}
