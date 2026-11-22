import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  buildBulkMockArticleDrafts,
  runBulkMockCreate,
} from '../src/features/articles/bulk-mock.ts'
import {
  extractArticlePreview,
  mapLiveCampaignArticleAssignment,
  mapLiveLibraryArticle,
} from '../src/features/articles/api/mappers.ts'
import {
  mockArticleAdapter,
  resetMockArticleStore,
} from '../src/features/articles/api/mock-adapter.ts'
import {
  ARTICLE_PATHS,
  CAMPAIGN_ARTICLE_PATHS,
} from '../src/features/articles/api/paths.ts'
import {
  canEditCampaignAssignments,
  filterSelectableArticlesForCampaign,
  isArticleCompatibleWithCampaign,
  validateSaveLibraryArticle,
} from '../src/features/articles/validation.ts'
import {
  mockCampaignAdapter,
  resetMockCampaignStore,
} from '../src/features/campaigns/api/mock-adapter.ts'
import type { ScriptInputSchema } from '../src/features/campaigns/types.ts'
import { ApiError, toSafeApiMessage } from '../src/lib/api/errors.ts'

const WP_SCHEMA: ScriptInputSchema = {
  fields: [
    { key: 'wp_title', type: 'string', required: true, label: 'WP Title' },
    { key: 'wp_body', type: 'text', required: true, label: 'WP Body' },
  ],
  test_mode_compatible: true,
  title_required: false,
  body_required: false,
  schema_available: true,
  title_supported: false,
  body_supported: false,
  unavailable_reason: null,
}

test('Article Library endpoints match finalized seo-ops-addons-rpa routes', () => {
  assert.equal(ARTICLE_PATHS.list, '/social-automation/api/articles')
  assert.equal(
    ARTICLE_PATHS.compatible,
    '/social-automation/api/articles/compatible',
  )
  assert.equal(
    ARTICLE_PATHS.detail('uuid-1'),
    '/social-automation/api/articles/uuid-1',
  )
  assert.equal(
    CAMPAIGN_ARTICLE_PATHS.list('camp-1'),
    '/social-automation/api/campaigns/camp-1/articles',
  )
  assert.equal(
    CAMPAIGN_ARTICLE_PATHS.assign('camp-1'),
    '/social-automation/api/campaigns/camp-1/articles',
  )
  assert.equal(
    CAMPAIGN_ARTICLE_PATHS.remove('camp-1', 'art-1'),
    '/social-automation/api/campaigns/camp-1/articles/art-1',
  )
})

test('Article validation rejects campaign_id, multiple action_tags, and missing required Script variables', () => {
  const withCampaign = validateSaveLibraryArticle(
    {
      title: 'Bad Article',
      campaign_id: 'camp_123',
      action_tag_key: 'mayhopphat.create_post',
      status: 'ready',
      source_format: 'legacy_input',
      input: { wp_title: 'T', wp_body: 'B' },
    },
    WP_SCHEMA,
  )
  assert.equal(withCampaign.ok, false)

  const multiTag = validateSaveLibraryArticle(
    {
      title: 'Multi Tag',
      action_tags: ['a.post', 'b.post'],
      action_tag_key: 'a.post',
      status: 'ready',
      source_format: 'legacy_input',
      input: { wp_title: 'T', wp_body: 'B' },
    },
    WP_SCHEMA,
  )
  assert.equal(multiTag.ok, false)

  const missingVar = validateSaveLibraryArticle(
    {
      title: 'Missing Body',
      action_tag_key: 'mayhopphat.create_post',
      status: 'ready',
      source_format: 'legacy_input',
      input: { wp_title: 'Only Title' },
    },
    WP_SCHEMA,
  )
  assert.equal(missingVar.ok, false)
  if (!missingVar.ok) {
    assert.match(missingVar.message, /WP Body/)
  }

  const valid = validateSaveLibraryArticle(
    {
      title: 'Independent Post',
      action_tag_id: 1,
      action_tag_key: 'mayhopphat.create_post',
      status: 'ready',
      source_format: 'legacy_input',
      input: { wp_title: 'Hello', wp_body: 'World' },
    },
    WP_SCHEMA,
  )
  assert.equal(valid.ok, true)
})

test('Article Library CRUD works independently of Campaigns and supports preview', async () => {
  resetMockArticleStore()
  const created = await mockArticleAdapter.createArticle({
    title: 'Standalone Article',
    external_ref: 'standalone-1',
    action_tag_id: 1,
    action_tag_key: 'mayhopphat.create_post',
    status: 'ready',
    source_format: 'legacy_input',
    input: { wp_title: 'Standalone Title', wp_body: 'Standalone Body' },
  })
  assert.equal(created.title, 'Standalone Article')
  assert.equal(created.action_tag_key, 'mayhopphat.create_post')
  assert.equal(extractArticlePreview(created), 'Standalone Body')

  const updated = await mockArticleAdapter.updateArticle(created.id, {
    title: 'Standalone Article Edited',
    action_tag_id: 1,
    action_tag_key: 'mayhopphat.create_post',
    status: 'ready',
    source_format: 'legacy_input',
    input: { wp_title: 'Edited Title', wp_body: 'Edited Body' },
  })
  assert.equal(updated.title, 'Standalone Article Edited')
  assert.equal(extractArticlePreview(updated), 'Edited Body')

  const filtered = await mockArticleAdapter.listArticles({
    site_key: 'mayhopphat',
    action_tag_key: 'mayhopphat.create_post',
    status: 'ready',
  })
  assert.equal(filtered.some((a) => a.id === created.id), true)
})

test('Campaign Draft multi-selection, duplicate prevention, order preservation, compatibility, and removal', async () => {
  resetMockCampaignStore()
  resetMockArticleStore()

  const draft = await mockCampaignAdapter.createCampaignV2({
    name: 'Draft For Assignment',
    run_mode: 'live',
    execution_mode: 'one_account_one_job',
    action_tags: [
      {
        action_tag_id: 1,
        action_tag_key: 'mayhopphat.create_post',
        site_key: 'mayhopphat',
        site_name: 'MayHopPhat',
        cms_type: 'wordpress',
        script_package_key: 'mayhopphat.create_post',
        script_name: 'WP Create Post',
        script_version: '1.0.0',
        release_id: 101,
        resolution_source: 'site_specific',
        shortcode_mapping: { entries: [{ shortcode: 'title', variable: 'title' }] },
      },
    ],
    contents: [],
  })
  assert.equal(draft.status, 'draft')
  assert.equal(canEditCampaignAssignments(draft), true)

  const art1 = await mockArticleAdapter.createArticle({
    title: 'Compatible 1',
    action_tag_id: 1,
    action_tag_key: 'mayhopphat.create_post',
    status: 'ready',
    source_format: 'legacy_input',
    input: { title: 'C1' },
  })
  const art2 = await mockArticleAdapter.createArticle({
    title: 'Compatible 2',
    action_tag_id: 1,
    action_tag_key: 'mayhopphat.create_post',
    status: 'ready',
    source_format: 'legacy_input',
    input: { title: 'C2' },
  })
  const incompatible = await mockArticleAdapter.createArticle({
    title: 'Other Site',
    action_tag_id: 99,
    action_tag_key: 'other_site.create_post',
    status: 'ready',
    source_format: 'legacy_input',
    input: { title: 'Other' },
  })

  assert.equal(isArticleCompatibleWithCampaign(art1, draft), true)
  assert.equal(isArticleCompatibleWithCampaign(incompatible, draft), false)

  // Multi-select assign preserving order
  const assigned = await mockArticleAdapter.assignCampaignArticles(draft.id, [
    { article_id: art1.id, sort_order: 1 },
    { article_id: art2.id, sort_order: 2 },
  ])
  assert.equal(assigned.length, 2)
  assert.equal(assigned[0]?.sort_order, 1)
  assert.equal(assigned[1]?.sort_order, 2)

  // Duplicate prevention in selector and adapter
  const selectable = filterSelectableArticlesForCampaign(
    [art1, art2, incompatible],
    draft,
    new Set([art1.id, art2.id]),
  )
  assert.equal(selectable.length, 0)

  await assert.rejects(
    () =>
      mockArticleAdapter.assignCampaignArticles(draft.id, [
        { article_id: art1.id },
      ]),
    /already assigned/i,
  )

  // Remove one while Draft
  await mockArticleAdapter.removeCampaignArticle(draft.id, art1.id)
  const remaining = await mockArticleAdapter.listCampaignArticles(draft.id)
  assert.equal(remaining.length, 1)
  assert.equal(remaining[0]?.article_id, art2.id)
})

test('Immutable started Campaign blocks assignment/removal and UI has no Replace Script Release', async () => {
  resetMockCampaignStore()
  resetMockArticleStore()

  const draft = await mockCampaignAdapter.createCampaignV2({
    name: 'Started Campaign',
    run_mode: 'live',
    execution_mode: 'one_account_one_job',
    action_tags: [
      {
        action_tag_id: 1,
        action_tag_key: 'mayhopphat.create_post',
        site_key: 'mayhopphat',
        site_name: 'MayHopPhat',
        cms_type: 'wordpress',
        script_package_key: 'mayhopphat.create_post',
        script_name: 'WP Create Post',
        script_version: '1.0.0',
        release_id: 101,
        resolution_source: 'site_specific',
        shortcode_mapping: { entries: [{ shortcode: 'title', variable: 'title' }] },
      },
    ],
    contents: [
      {
        external_ref: 'legacy-1',
        raw_source: '[title]Legacy[/title]',
        assignments: [
          {
            action_tag_key: 'mayhopphat.create_post',
            script_package_key: 'mayhopphat.create_post',
            script_version: '1.0.0',
            raw_source: '[title]Legacy[/title]',
            shortcode_mapping: {
              entries: [{ shortcode: 'title', variable: 'title' }],
            },
          },
        ],
      },
    ],
  })

  const started = await mockCampaignAdapter.startCampaign(draft.id)
  assert.equal(started.status, 'running')
  assert.equal(canEditCampaignAssignments(started), false)

  await assert.rejects(
    () =>
      mockArticleAdapter.assignCampaignArticles(started.id, [
        { article_id: 'art_mock_wp_1' },
      ]),
    /draft status/i,
  )

  // Legacy inline content remains visible
  const assignments = await mockArticleAdapter.listCampaignArticles(started.id)
  assert.equal(assignments.length, 1)
  assert.equal(assignments[0]?.is_legacy_inline, true)

  // No Replace Script Release button in CampaignDetailScreen
  const detailSrc = readFileSync(
    resolve(
      process.cwd(),
      'src/features/campaigns/components/CampaignDetailScreen.tsx',
    ),
    'utf8',
  )
  assert.equal(/Replace Script Release/i.test(detailSrc), false)
  assert.equal(detailSrc.includes("campaign.status === 'draft'"), true)
})

test('DTO mappers and API validation error formatting', () => {
  const art = mapLiveLibraryArticle({
    id: 'art-uuid-1',
    title: 'Mapped',
    action_tag_id: 5,
    action_tag_key: 'site.post',
    site_id: 2,
    site_key: 'site',
    status: 'ready',
    source_format: 'legacy_input',
    input: { wp_title: 'Hello' },
    mapping_version: 0,
  })
  assert.equal(art.id, 'art-uuid-1')
  assert.equal(art.site_key, 'site')

  const assign = mapLiveCampaignArticleAssignment({
    content_id: 'cnt-1',
    assignment_id: 'asgn-1',
    article_id: 'art-uuid-1',
    article_title: 'Mapped',
    sort_order: 1,
    status: 'pending',
    is_legacy_inline: false,
    action_tag_key: 'site.post',
    release_id: 101,
    script_id: 'site.post',
    script_version: '1.0.0',
    snapshot_at: '2026-11-23T00:00:00Z',
  })
  assert.equal(assign.snapshot_at, '2026-11-23T00:00:00Z')

  const err = new ApiError('Articles can only be assigned when Campaign is in draft status.', {
    kind: 'validation',
    status: 422,
    code: 'campaign_not_draft',
  })
  assert.match(toSafeApiMessage(err), /draft status/i)
})

test('Bulk Mock generates 5 independent Articles, saves without Campaign, and handles partial failure + safe retry without duplicates', async () => {
  resetMockCampaignStore()
  resetMockArticleStore()

  const draftsResult = buildBulkMockArticleDrafts({
    tag: {
      tag_id: 1,
      tag_key: 'mayhopphat.create_post',
      tag_name: 'Create Post',
      tag_enabled: true,
      site_key: 'mayhopphat',
      site_name: 'MayHopPhat',
      cms_type: 'wordpress',
      path_key: 'create_post',
      path_name: 'Create Post',
      effective_script: {
        package_key: 'mayhopphat.create_post',
        script_id: 'mayhopphat.create_post',
        name: 'WP Create Post',
        version: '1.0.0',
        release_id: 101,
      },
      resolution_source: 'site_specific',
      is_system_auth: false,
      is_runnable: true,
      status_reason: null,
    },
    schema: WP_SCHEMA,
    count: 5,
    existingRefs: ['mock-1-old'],
  })

  assert.equal(draftsResult.ok, true)
  if (!draftsResult.ok) return
  assert.equal(draftsResult.items.length, 5)

  // Verify each generated article has 1 Action Tag, no campaign_id, required variables, and recognizable TEST Mock title
  const titles = new Set<string>()
  for (const item of draftsResult.items) {
    assert.equal('campaign_id' in item.payload, false)
    assert.equal(item.payload.action_tag_key, 'mayhopphat.create_post')
    assert.equal(item.payload.status, 'ready')
    assert.ok(item.payload.input?.wp_title)
    assert.ok(item.payload.input?.wp_body)
    assert.match(item.previewTitle, /TEST Mock/i)
    titles.add(item.previewTitle)
  }
  assert.equal(titles.size, 5)

  // Simulate partial failure on item #3 (index 2)
  let callCount = 0
  const createdRefs: string[] = []
  const firstRun = await runBulkMockCreate(draftsResult.items, async (payload) => {
    callCount++
    if (callCount === 3) {
      throw new ApiError('Temporary validation failure', {
        kind: 'validation',
        status: 422,
      })
    }
    const created = await mockArticleAdapter.createArticle(payload)
    if (created.external_ref) createdRefs.push(created.external_ref)
    return created
  })

  assert.equal(firstRun.createdCount, 4)
  assert.equal(firstRun.failedCount, 1)
  assert.equal(createdRefs.length, 4)

  // Retry failed: must ONLY call createFn for the 1 failed item (no duplicates for the 4 already created)
  let retryCalls = 0
  const retryRun = await runBulkMockCreate(firstRun.items, async (payload) => {
    retryCalls++
    const created = await mockArticleAdapter.createArticle(payload)
    if (created.external_ref) createdRefs.push(created.external_ref)
    return created
  })

  assert.equal(retryCalls, 1)
  assert.equal(retryRun.createdCount, 5)
  assert.equal(retryRun.failedCount, 0)
  assert.equal(new Set(createdRefs).size, 5)

  // Verify all 5 persist in Article Library and can be assigned to a Campaign Draft
  const listed = await mockArticleAdapter.listArticles({
    site_key: 'mayhopphat',
    action_tag_key: 'mayhopphat.create_post',
  })
  const createdArticles = listed.filter((a) =>
    createdRefs.includes(a.external_ref ?? ''),
  )
  assert.equal(createdArticles.length, 5)

  const draftCamp = await mockCampaignAdapter.createCampaignV2({
    name: 'Draft Using Bulk Mock Articles',
    run_mode: 'live',
    execution_mode: 'one_account_one_job',
    action_tags: [
      {
        action_tag_id: 1,
        action_tag_key: 'mayhopphat.create_post',
        site_key: 'mayhopphat',
        site_name: 'MayHopPhat',
        cms_type: 'wordpress',
        script_package_key: 'mayhopphat.create_post',
        script_name: 'WP Create Post',
        script_version: '1.0.0',
        release_id: 101,
        resolution_source: 'site_specific',
        shortcode_mapping: { entries: [{ shortcode: 'wp_title', variable: 'wp_title' }] },
      },
    ],
    contents: [],
  })
  assert.equal(draftCamp.status, 'draft')

  const assigned = await mockArticleAdapter.assignCampaignArticles(
    draftCamp.id,
    createdArticles.map((a, i) => ({ article_id: a.id, sort_order: i + 1 })),
  )
  assert.equal(assigned.length, 5)

  // Verify Bulk Mock button is visible in ArticleLibraryScreen
  const screenSrc = readFileSync(
    resolve(
      process.cwd(),
      'src/features/articles/components/ArticleLibraryScreen.tsx',
    ),
    'utf8',
  )
  assert.equal(screenSrc.includes('Bulk Mock'), true)
  assert.equal(screenSrc.includes('BulkMockArticleModal'), true)
})

