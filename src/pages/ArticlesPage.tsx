import { Toast } from '@/components/ui/toast'
import { useActionRegistry } from '@/features/action-tags/use-action-registry'
import { ArticleLibraryScreen } from '@/features/articles/components/ArticleLibraryScreen'
import { useArticleLibrary } from '@/features/articles/use-article-library'
import { useCampaigns } from '@/features/campaigns/use-campaigns'
import { useScriptRegistry } from '@/features/script-registry/use-script-registry'

export function ArticlesPage() {
  const library = useArticleLibrary()
  const actionRegistry = useActionRegistry()
  const scriptRegistry = useScriptRegistry()
  const campaigns = useCampaigns()

  if (library.loading && library.articles.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <p className="text-sm">Loading Article Library…</p>
      </div>
    )
  }

  return (
    <>
      <ArticleLibraryScreen
        articles={library.articles}
        loading={library.loading}
        error={library.error}
        mode={library.mode}
        sites={actionRegistry.data.sites}
        paths={actionRegistry.data.paths}
        tags={actionRegistry.data.tags}
        cmsTypes={actionRegistry.data.cms_types}
        scripts={scriptRegistry.data.scripts}
        scriptDetails={scriptRegistry.data.details}
        getMockSchema={campaigns.getScriptInputSchema}
        onCreate={library.createArticle}
        onUpdate={library.updateArticle}
        onDelete={library.deleteArticle}
        onReload={library.reload}
      />
      <Toast toast={library.toast} />
    </>
  )
}
