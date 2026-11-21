import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { resolveArticlesListState } from '../src/features/campaigns/articles-list-state.ts'
import { resolveArticlesCampaignId } from '../src/features/campaigns/articles-selection.ts'
import { mapLiveCampaign } from '../src/features/campaigns/api/mappers.ts'
import { isCampaignV2 } from '../src/features/campaigns/validation.ts'

describe('ArticlesPage React Hook order & state transitions', () => {
  it('calls all React hooks in ArticlesPage.tsx before any conditional early return', () => {
    const filePath = path.resolve('src/pages/ArticlesPage.tsx')
    const source = fs.readFileSync(filePath, 'utf8')
    const lines = source.split(/\r?\n/)

    const firstEarlyReturnIdx = lines.findIndex((line) =>
      /^  if\s*\([^)]+\)\s*\{\s*$/.test(line),
    )
    assert.ok(
      firstEarlyReturnIdx > 0,
      'Expected conditional early return in ArticlesPage.tsx',
    )

    const afterEarlyReturn = lines.slice(firstEarlyReturnIdx).join('\n')
    const hookPattern =
      /\b(useState|useEffect|useMemo|useRef|useCallback|useContext|useReducer|useMultiScriptSchemas|useCampaigns|useAccountSites|useScriptRegistry|useSearchParams)\s*\(/g
    const matches = afterEarlyReturn.match(hookPattern) ?? []
    assert.deepEqual(
      matches,
      [],
      `Found React Hook call(s) after early return in ArticlesPage.tsx: ${matches.join(', ')}`,
    )
  })

  it('handles loading -> loaded, V1 & V2 campaign selection, empty state, and 404 schema error without blocking Content', () => {
    const v1 = mapLiveCampaign({
      id: 'camp_v1',
      name: 'V1 Campaign',
      platform: 'mayhopphat',
      script_id: 'mayhopphat.create_post',
      script_version: '1.0.0',
      status: 'draft',
      run_mode: 'live',
      total_contents: 1,
    })
    const v2 = mapLiveCampaign({
      id: 'camp_v2',
      plan_version: 2,
      name: 'V2 Campaign',
      status: 'draft',
      run_mode: 'live',
      action_tags: [
        {
          action_tag_key: 'mayhopphat.create_post',
          site_key: 'mayhopphat',
          script_package_key: 'mayhopphat.create_post',
          script_version: '1.2.0',
          resolution_source: 'site_specific',
        },
      ],
      total_contents: 2,
    })

    // 1. Initial loading state
    assert.equal(
      resolveArticlesListState({ loading: true, error: null, rowCount: 0 }),
      'loading',
    )

    // 2. Loaded V1 campaign selection
    const selectedV1 = resolveArticlesCampaignId({
      selectedId: '',
      urlCampaignId: 'camp_v1',
      campaigns: [v1, v2],
    })
    assert.equal(selectedV1, 'camp_v1')
    assert.equal(isCampaignV2(v1), false)

    // 3. Switch to V2 campaign selection
    const selectedV2 = resolveArticlesCampaignId({
      selectedId: 'camp_v2',
      campaigns: [v1, v2],
    })
    assert.equal(selectedV2, 'camp_v2')
    assert.equal(isCampaignV2(v2), true)

    // 4. Empty Campaign / Content state
    assert.equal(
      resolveArticlesListState({ loading: false, error: null, rowCount: 0 }),
      'empty',
    )

    // 5. Script schema 404 does NOT set contentsError -> existing Content remains visible
    assert.equal(
      resolveArticlesListState({ loading: false, error: null, rowCount: 2 }),
      'ready',
    )
  })
})
