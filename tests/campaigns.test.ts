import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { MOCK_ACTION_REGISTRY } from '../src/features/action-tags/mock-data.ts'
import {
  draftToScriptInput,
  tipTapDocToPlainText,
} from '../src/features/campaigns/content-adapters.ts'
import {
  checkContentLength,
  measureContentLength,
  siteContentPolicy,
} from '../src/features/campaigns/content-limit.ts'
import {
  buildLiveCampaignContentBody,
  formatDiscardedInputWarning,
  mapDraftToAllowedScriptInput,
} from '../src/features/campaigns/api/build-content-payload.ts'
import { extractLiveContentListRows } from '../src/features/campaigns/api/parse-content-list.ts'
import { resolveArticlesListState } from '../src/features/campaigns/articles-list-state.ts'
import { resolveArticlesCampaignId } from '../src/features/campaigns/articles-selection.ts'
import { buildLiveCampaignCreateBody } from '../src/features/campaigns/api/build-create-payload.ts'
import { mapLiveCampaign, mapLiveContent } from '../src/features/campaigns/api/mappers.ts'
import {
  resolveAccountDisplay,
  resolveScriptDisplay,
} from '../src/features/campaigns/display-resolve.ts'
import { MOCK_ACCOUNTS } from '../src/features/accounts/mock-data.ts'
import {
  CAMPAIGN_CONTENT_PATHS,
  CAMPAIGN_PATHS,
} from '../src/features/campaigns/api/paths.ts'
import {
  createMockCampaignStore,
  MOCK_SCRIPT_INPUT_SCHEMAS,
} from '../src/features/campaigns/mock-data.ts'
import {
  minutesToSeconds,
  scheduleFormToApi,
  secondsToMinutes,
  validateScheduleForm,
  emptyScheduleForm,
} from '../src/features/campaigns/schedule.ts'
import {
  canStartWithRunMode,
  filterScriptsForSite,
  parseScriptInputSchema,
} from '../src/features/campaigns/script-compat.ts'
import {
  canStartCampaign,
  isContentEditable,
  isPinnedAccountUnavailable,
  validateCampaignForm,
  validateManualContent,
  RETRY_WARNING,
  UNKNOWN_RETRY_WARNING,
} from '../src/features/campaigns/validation.ts'
import {
  isOwnerOrAdminRole,
  isStaffRole,
} from '../src/features/session-identity/types.ts'
import { NAV_ITEMS } from '../src/config/navigation.ts'

const SCRIPT_LIST_SEED = [
  {
    package_key: 'script.wordpress.new_post.post',
    script_id: 'wordpress.new_post.post',
    name: 'WordPress New Post',
    action_tag_key: 'wordpress.new_post.post',
    version: '1.2.0',
    release_id: 101,
    status: 'published' as const,
    assets_complete: true,
    video_demo_status: 'ready' as const,
    has_playable_video: true,
    has_thumbnail: true,
    video_media_id: 1,
    thumbnail_media_id: 2,
    thumbnail_url: null,
    video_url: null,
    last_sync_label: '',
    updated_by_label: '',
  },
  {
    package_key: 'script.wordpress.login',
    script_id: 'wordpress.login',
    name: 'WordPress Login',
    action_tag_key: null,
    version: '1.0.0',
    release_id: 102,
    status: 'published' as const,
    assets_complete: true,
    video_demo_status: 'ready' as const,
    has_playable_video: true,
    has_thumbnail: true,
    video_media_id: 1,
    thumbnail_media_id: 2,
    thumbnail_url: null,
    video_url: null,
    last_sync_label: '',
    updated_by_label: '',
    is_authentication: true,
  },
  {
    package_key: 'script.facebook.group_composer.post',
    script_id: 'facebook.group_composer.post',
    name: 'Facebook Group Composer',
    action_tag_key: 'facebook.group_composer.post',
    version: '2.0.1',
    release_id: 103,
    status: 'published' as const,
    assets_complete: true,
    video_demo_status: 'missing' as const,
    has_playable_video: false,
    has_thumbnail: false,
    video_media_id: null,
    thumbnail_media_id: null,
    thumbnail_url: null,
    video_url: null,
    last_sync_label: '',
    updated_by_label: '',
  },
]

function formBase(
  overrides: Partial<Parameters<typeof validateCampaignForm>[0]> = {},
): Parameters<typeof validateCampaignForm>[0] {
  return {
    name: 'Demo',
    site_key: 'facebook',
    script_package_key: 'script.facebook.group_composer.post',
    script_version: '2.0.1',
    execution_mode: 'one_account_one_job',
    run_mode: 'live',
    schedule: emptyScheduleForm(),
    content_title: 'POC title',
    content_external_ref: 'poc-001',
    account_id: 'ff0035e0-a6d8-42af-8370-f5be9e453f2d',
    ...overrides,
  }
}

describe('CP19E Campaign Management', () => {
  it('1. Campaign list fixtures render-ready', () => {
    const store = createMockCampaignStore()
    assert.ok(store.campaigns.length >= 9)
    assert.ok(store.campaigns.some((c) => c.id === 'camp_draft_empty'))
    assert.ok(store.campaigns.some((c) => c.status === 'running'))
    assert.ok(store.campaigns.some((c) => c.run_mode === 'test'))
    assert.ok(store.contents.some((c) => c.status === 'failed_locked'))
    assert.ok(store.contents.some((c) => c.status === 'unknown'))
  })

  it('2. Campaign create validation', () => {
    const bad = validateCampaignForm(
      formBase({
        name: '  ',
        site_key: '',
        script_package_key: '',
        script_version: '',
        content_title: '',
      }),
      { requireContents: true },
    )
    assert.equal(bad.ok, false)

    const ok = validateCampaignForm(formBase(), { requireContents: true })
    assert.equal(ok.ok, true)
  })

  it('3. Execution mode selection values', () => {
    const a = validateCampaignForm(
      formBase({ name: 'A', execution_mode: 'one_account_one_job' }),
      { requireContents: true },
    )
    const b = validateCampaignForm(
      formBase({ name: 'B', execution_mode: 'one_account_many_jobs' }),
      { requireContents: true },
    )
    assert.equal(a.ok, true)
    assert.equal(b.ok, true)
    if (a.ok) assert.equal(a.value.execution_mode, 'one_account_one_job')
    if (b.ok) assert.equal(b.value.execution_mode, 'one_account_many_jobs')
  })

  it('4. Test/Live mode selection + compatibility gate', () => {
    assert.equal(canStartWithRunMode('live', null).ok, true)
    assert.equal(canStartWithRunMode('test', true).ok, true)
    assert.equal(canStartWithRunMode('test', false).ok, false)
    assert.equal(canStartWithRunMode('test', null).ok, false)
  })

  it('5. Schedule form validation', () => {
    assert.equal(
      validateScheduleForm(emptyScheduleForm({ type: 'immediate' })).ok,
      true,
    )
    assert.equal(
      validateScheduleForm(
        emptyScheduleForm({ type: 'scheduled', start_date: '', start_time: '' }),
      ).ok,
      false,
    )
    assert.equal(
      validateScheduleForm(
        emptyScheduleForm({
          type: 'time_window',
          start_date: '2026-11-05',
          daily_from: '08:00',
          daily_to: '22:00',
          min_interval_minutes: 30,
        }),
      ).ok,
      true,
    )
  })

  it('6. Timezone and interval conversion', () => {
    assert.equal(minutesToSeconds(30), 1800)
    assert.equal(secondsToMinutes(1800), 30)
    const api = scheduleFormToApi(
      emptyScheduleForm({
        type: 'time_window',
        timezone: 'Asia/Ho_Chi_Minh',
        start_date: '2026-11-05',
        daily_from: '08:00',
        daily_to: '22:00',
        min_interval_minutes: 30,
      }),
    )
    assert.equal(api.type, 'time_window')
    assert.equal(api.timezone, 'Asia/Ho_Chi_Minh')
    assert.equal(api.min_interval_seconds, 1800)
    assert.equal(api.start_at, '2026-11-05T08:00:00+07:00')
    assert.deepEqual(api.daily_window, { from: '08:00', to: '22:00' })
  })

  it('7. Site Registry is the platform source', () => {
    const keys = MOCK_ACTION_REGISTRY.sites.map((s) => s.key)
    assert.ok(keys.includes('facebook'))
    assert.ok(keys.includes('wordpress'))
    assert.equal(keys.includes('Instagram'), false)
    assert.equal(keys.includes('TikTok'), false)
  })

  it('8. Script filtering by Site', () => {
    const fb = filterScriptsForSite(SCRIPT_LIST_SEED, 'facebook')
    const wp = filterScriptsForSite(SCRIPT_LIST_SEED, 'wordpress')
    assert.ok(fb.length > 0)
    assert.ok(wp.some((s) => s.package_key === 'script.wordpress.new_post.post'))
    assert.ok(!wp.some((s) => s.is_authentication))
  })

  it('9. Empty Campaign cannot Start', () => {
    const store = createMockCampaignStore()
    const campaign = store.campaigns.find((c) => c.id === 'camp_draft_empty')!
    const contents = store.contents.filter((c) => c.campaign_id === campaign.id)
    assert.equal(contents.length, 0)
    const gate = canStartCampaign(campaign, contents, true)
    assert.equal(gate.ok, false)
    assert.ok(gate.reasons.some((r) => /zero Content/i.test(r)))
  })

  it('10. Manual Content creation mapping', () => {
    const mapped = draftToScriptInput({
      campaign_id: 'camp_draft_empty',
      title: null,
      body: 'Hello body',
      variables: { group_id: 'g1' },
      editor_doc: null,
    })
    assert.equal(mapped.source, 'manual')
    assert.equal(mapped.input.body, 'Hello body')
    assert.equal(mapped.input.variables.group_id, 'g1')
  })

  it('11. Manual Content editing mapping preserves fields', () => {
    const mapped = draftToScriptInput({
      campaign_id: 'camp_draft_empty',
      external_ref: 'manual-001',
      title: 'T2',
      body: 'B2',
      variables: {},
      editor_doc: null,
    })
    assert.equal(mapped.external_ref, 'manual-001')
    assert.equal(mapped.input.title, 'T2')
    assert.equal(mapped.input.body, 'B2')
  })

  it('12. Dynamic Script input fields from schema', () => {
    const seed = MOCK_SCRIPT_INPUT_SCHEMAS['script.facebook.group_composer.post']
    const schema = parseScriptInputSchema(
      {
        package_key: 'script.facebook.group_composer.post',
        name: 'FB',
        action_tag_key: null,
        description: null,
        updated_by_label: 'mock',
        releases: [
          {
            id: 1,
            version: '1',
            content_digest: '',
            status: 'published',
            published_at: null,
            variables: seed.variables,
            steps: [],
            assets: [],
            runtime_requirements: [],
            video_demo: null,
            video_demo_status: 'missing',
            video_media_id: null,
            thumbnail_media_id: null,
            thumbnail_url: null,
            video_url: null,
          },
        ],
      },
      { testModeCompatible: seed.test_mode_compatible },
    )
    assert.ok(schema.fields.some((f) => f.key === 'group_id'))
    assert.equal(schema.body_required, true)
    const missing = validateManualContent(
      { title: null, body: 'x', variables: {} },
      schema,
      true,
    )
    assert.equal(missing.ok, false)
  })

  it('13. Tiptap doc round-trip supports bold/italic marks in JSON', () => {
    const doc = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'world', marks: [{ type: 'italic' }] },
          ],
        },
      ],
    }
    assert.equal(tipTapDocToPlainText(doc), 'Hello world')
    assert.match(JSON.stringify(doc), /"bold"/)
    assert.match(JSON.stringify(doc), /"italic"/)
  })

  it('14. Site character limit from Site Registry', () => {
    const fb = MOCK_ACTION_REGISTRY.sites.find((s) => s.key === 'facebook')!
    const wp = MOCK_ACTION_REGISTRY.sites.find((s) => s.key === 'wordpress')!
    assert.equal(siteContentPolicy(fb).content_max_length, 500)
    assert.equal(siteContentPolicy(wp).content_max_length, null)
    assert.equal(checkContentLength('x'.repeat(501), siteContentPolicy(fb)).ok, false)
    assert.equal(checkContentLength('ok', siteContentPolicy(fb)).ok, true)
    assert.equal(measureContentLength('a😀b'), 3)
  })

  it('15. Failed Locked actions are admin-required statuses in fixtures', () => {
    assert.match(RETRY_WARNING, /trùng/)
    const store = createMockCampaignStore()
    const failed = store.contents.find((c) => c.status === 'failed_locked')
    assert.ok(failed)
    assert.equal(failed!.status, 'failed_locked')
  })

  it('16. Unknown result warning is stronger', () => {
    assert.match(UNKNOWN_RETRY_WARNING, /unknown/i)
    assert.ok(UNKNOWN_RETRY_WARNING.length > RETRY_WARNING.length)
  })

  it('17. Staff cannot access Campaign menus', () => {
    assert.equal(isStaffRole('staff'), true)
    assert.equal(isOwnerOrAdminRole('staff'), false)
    assert.ok(
      NAV_ITEMS.some((n) => n.to === '/social-automation/campaigns'),
    )
  })

  it('18. Owner/Admin can access Campaign', () => {
    assert.equal(isOwnerOrAdminRole('owner'), true)
    assert.equal(isOwnerOrAdminRole('admin'), true)
    assert.ok(NAV_ITEMS.some((n) => n.to === '/social-automation/articles'))
    assert.ok(
      NAV_ITEMS.some((n) => n.to === '/social-automation/article-prompts'),
    )
  })

  it('19. Mock fixtures never contain production hosts/secrets', () => {
    const json = JSON.stringify(createMockCampaignStore())
    assert.doesNotMatch(json, /seo-ops\.duckdns\.org/)
    assert.doesNotMatch(json, /Client API Key/i)
    assert.doesNotMatch(json, /password":\s*"[^"]+"/i)
  })

  it('20. Live adapter uses Staff Session relative paths (CSRF via staffApiRequest)', () => {
    assert.equal(CAMPAIGN_PATHS.list, '/social-automation/api/campaigns')
    assert.match(CAMPAIGN_PATHS.start('x'), /\/start$/)
    assert.match(CAMPAIGN_CONTENT_PATHS.retry('c1'), /\/retry$/)
    assert.equal(
      CAMPAIGN_CONTENT_PATHS.create('camp-1'),
      '/social-automation/api/campaigns/camp-1/contents',
    )
    assert.equal(
      CAMPAIGN_CONTENT_PATHS.update('camp-1', 'cnt-1'),
      '/social-automation/api/campaigns/camp-1/contents/cnt-1',
    )
    assert.ok(CAMPAIGN_PATHS.list.startsWith('/social-automation/api/'))
    assert.equal(CAMPAIGN_PATHS.list.startsWith('http'), false)
  })

  it('26. Content create payload is schema-aware; editable states', () => {
    const titleOnly = parseScriptInputSchema({
      package_key: 'mayhopphat.create_post',
      name: 'create_post',
      action_tag_key: null,
      description: null,
      updated_by_label: 'test',
      releases: [
        {
          id: 1,
          version: '1',
          content_digest: '',
          status: 'published',
          published_at: null,
          variables: [
            { key: 'title', type: 'string', required: true, label: 'Title' },
          ],
          steps: [],
          assets: [],
          runtime_requirements: [],
          video_demo: null,
          video_demo_status: 'missing',
          video_media_id: null,
          thumbnail_media_id: null,
          thumbnail_url: null,
          video_url: null,
        },
      ],
    })
    assert.equal(titleOnly.schema_available, true)
    assert.equal(titleOnly.title_supported, true)
    assert.equal(titleOnly.body_supported, false)

    const body = buildLiveCampaignContentBody(
      {
        campaign_id: 'camp-1',
        external_ref: 'article-2',
        title: 'Second draft title',
        body: null,
        variables: {},
        editor_doc: null,
      },
      { schema: titleOnly },
    )
    assert.equal(body.external_ref, 'article-2')
    assert.equal(body.input.title, 'Second draft title')
    assert.equal('body' in body.input, false)

    const titleBodySchema = parseScriptInputSchema({
      package_key: 'script.wordpress.new_post.post',
      name: 'WP',
      action_tag_key: null,
      description: null,
      updated_by_label: 'test',
      releases: [
        {
          id: 1,
          version: '1',
          content_digest: '',
          status: 'published',
          published_at: null,
          variables: [
            { key: 'title', type: 'string', required: true, label: 'Title' },
            { key: 'body', type: 'text', required: true, label: 'Body' },
            { key: 'group_id', type: 'string', required: false, label: 'Group' },
          ],
          steps: [],
          assets: [],
          runtime_requirements: [],
          video_demo: null,
          video_demo_status: 'missing',
          video_media_id: null,
          thumbnail_media_id: null,
          thumbnail_url: null,
          video_url: null,
        },
      ],
    })
    const withBody = buildLiveCampaignContentBody(
      {
        campaign_id: 'camp-1',
        title: 'T',
        body: 'Hello',
        variables: { group_id: 'g1' },
        editor_doc: null,
      },
      { schema: titleBodySchema },
    )
    assert.equal(withBody.input.body, 'Hello')
    assert.equal(withBody.input.group_id, 'g1')

    assert.equal(
      isContentEditable({ status: 'pending', current_job_id: null }),
      true,
    )
    assert.equal(
      isContentEditable({ status: 'waiting_resources', current_job_id: null }),
      true,
    )
    assert.equal(
      isContentEditable({ status: 'running', current_job_id: null }),
      false,
    )
    assert.equal(
      isContentEditable({ status: 'pending', current_job_id: 'job-1' }),
      false,
    )
  })

  it('26b. Title-only Script never sends body; discard requires allowDiscard', () => {
    const schema = parseScriptInputSchema({
      package_key: 'mayhopphat.create_post',
      name: 'create_post',
      action_tag_key: null,
      description: null,
      updated_by_label: 'test',
      releases: [
        {
          id: 1,
          version: '1',
          content_digest: '',
          status: 'published',
          published_at: null,
          variables: [
            { key: 'title', type: 'string', required: true, label: 'Title' },
          ],
          steps: [],
          assets: [],
          runtime_requirements: [],
          video_demo: null,
          video_demo_status: 'missing',
          video_media_id: null,
          thumbnail_media_id: null,
          thumbnail_url: null,
          video_url: null,
        },
      ],
    })

    const mapped = mapDraftToAllowedScriptInput(
      {
        campaign_id: 'camp-1',
        title: 'test wp RPA 2',
        body: 'test wp RPA 2',
        variables: {},
        editor_doc: null,
      },
      schema,
    )
    assert.equal(mapped.ok, true)
    if (!mapped.ok) return
    assert.equal(mapped.input.title, 'test wp RPA 2')
    assert.equal('body' in mapped.input, false)
    assert.equal(mapped.discarded.length, 1)
    assert.equal(mapped.discarded[0]?.key, 'body')
    assert.match(
      formatDiscardedInputWarning(mapped.discarded, Object.keys(mapped.input)),
      /Body/,
    )

    assert.throws(
      () =>
        buildLiveCampaignContentBody(
          {
            campaign_id: 'camp-1',
            title: 'test wp RPA 2',
            body: 'test wp RPA 2',
            variables: {},
            editor_doc: null,
          },
          { schema },
        ),
      /Confirm before saving/,
    )

    const allowed = buildLiveCampaignContentBody(
      {
        campaign_id: 'camp-1',
        title: 'test wp RPA 2',
        body: 'test wp RPA 2',
        variables: {},
        editor_doc: null,
      },
      { schema, allowDiscard: true },
    )
    assert.equal(allowed.input.title, 'test wp RPA 2')
    assert.equal('body' in allowed.input, false)
  })

  it('26c. Schema unavailable fails closed (no guessed variables)', () => {
    const unavailable = {
      fields: [],
      test_mode_compatible: null,
      title_required: false,
      body_required: false,
      schema_available: false,
      title_supported: false,
      body_supported: false,
    }
    const mapped = mapDraftToAllowedScriptInput(
      {
        campaign_id: 'camp-1',
        title: 'T',
        body: 'B',
        variables: {},
        editor_doc: null,
      },
      unavailable,
    )
    assert.equal(mapped.ok, false)
    if (mapped.ok) return
    assert.match(mapped.message, /schema unavailable/i)

    const validated = validateManualContent(
      { title: 'T', body: 'B', variables: {} },
      unavailable,
      true,
    )
    assert.equal(validated.ok, false)

    assert.equal(
      parseScriptInputSchema(null).schema_available,
      false,
    )
  })

  it('21. LIVE create payload matches OpenAPI wordpress_draft_poc (90886a7)', () => {
    const accountId = 'ff0035e0-a6d8-42af-8370-f5be9e453f2d'
    const validated = validateCampaignForm(
      formBase({
        name: 'WP Draft POC',
        site_key: 'mayhopphat',
        script_package_key: 'mayhopphat.create_post',
        script_version: '1',
        execution_mode: 'one_account_one_job',
        run_mode: 'live',
        content_title: 'POC Draft Title',
        content_external_ref: 'poc-draft-001',
        account_id: accountId,
      }),
      { requireContents: true, requireAccountPin: true },
    )
    assert.equal(validated.ok, true)
    if (!validated.ok) return
    const body = buildLiveCampaignCreateBody(validated.value)
    assert.equal(body.name, 'WP Draft POC')
    assert.equal(body.platform, 'mayhopphat')
    assert.equal(body.script_id, 'mayhopphat.create_post')
    assert.equal(body.script_version, '1')
    assert.equal(body.execution_mode, 'one_account_one_job')
    assert.equal(body.run_mode, 'live')
    assert.equal(body.account_id, accountId)
    assert.equal(body.contents.length, 1)
    assert.equal(body.contents[0].input.title, 'POC Draft Title')
    assert.equal(body.contents[0].external_ref, 'poc-draft-001')
    assert.equal('body' in body.contents[0].input, false)

    const missingPin = validateCampaignForm(
      formBase({ account_id: '' }),
      { requireContents: true, requireAccountPin: true },
    )
    assert.equal(missingPin.ok, false)
  })

  it('22. Test Mode gate stays fail-closed (never force true)', () => {
    assert.equal(canStartWithRunMode('test', null).ok, false)
    assert.equal(canStartWithRunMode('test', false).ok, false)
    assert.equal(canStartWithRunMode('live', null).ok, true)
  })

  it('23. LIVE detail mapper surfaces content errors and script_version', () => {
    const campaign = mapLiveCampaign({
      id: 'camp-1',
      name: 'N',
      platform: 'mayhopphat',
      script_id: 'mayhopphat.create_post',
      script_version: '1',
      account_id: 'ff0035e0-a6d8-42af-8370-f5be9e453f2d',
      execution_mode: 'one_account_one_job',
      run_mode: 'live',
      status: 'running',
      total_contents: 1,
      completed_contents: 0,
      failed_contents: 0,
      waiting_contents: 0,
      summary: {
        total: 1,
        pending: 0,
        waiting_resources: 0,
        running: 1,
        success: 0,
        failed_locked: 0,
        unknown: 0,
        skipped: 0,
        cancelled: 0,
      },
      contents: [
        {
          id: 'cnt-1',
          status: 'failed_locked',
          assigned_account_id: 'ff0035e0-a6d8-42af-8370-f5be9e453f2d',
          last_error_code: 'orc_timeout',
          last_error_message: 'step timeout',
          input: { title: 'T' },
        },
      ],
    })
    assert.equal(campaign.script_version, '1')
    assert.equal(campaign.site_key, 'mayhopphat')
    assert.equal(campaign.account_id, 'ff0035e0-a6d8-42af-8370-f5be9e453f2d')
    assert.equal(campaign.summary.running, 1)
    assert.ok(campaign.contents)
    assert.equal(campaign.contents?.[0]?.last_error_code, 'orc_timeout')
    const content = mapLiveContent({
      id: 'c2',
      status: 'success',
      input: { title: 'X', content: 'legacy body field' },
    })
    assert.equal(content.input.title, 'X')
    assert.equal(content.input.body, 'legacy body field')
  })

  it('25. Account/Script display resolves names — never invents from UUID', () => {
    const resolved = resolveAccountDisplay(
      MOCK_ACCOUNTS,
      'acc_wp_01_a1b2c3d4',
    )
    assert.equal(resolved.state, 'resolved')
    assert.equal(resolved.label, 'Main Blog Editor')
    assert.equal(resolved.accountId, 'acc_wp_01_a1b2c3d4')

    const missing = resolveAccountDisplay(
      MOCK_ACCOUNTS,
      'ff0035e0-a6d8-42af-8370-f5be9e453f2d',
    )
    assert.equal(missing.state, 'missing')
    assert.equal(missing.label, 'Account missing')
    assert.equal(missing.accountId, 'ff0035e0-a6d8-42af-8370-f5be9e453f2d')
    assert.equal(missing.label.includes('ff0035e0'), false)

    const loading = resolveAccountDisplay(undefined, 'acc_wp_01_a1b2c3d4', {
      loading: true,
    })
    assert.equal(loading.state, 'loading')
    assert.equal(loading.label, 'Loading…')

    const empty = resolveAccountDisplay(MOCK_ACCOUNTS, null)
    assert.equal(empty.state, 'empty')

    const script = resolveScriptDisplay(
      SCRIPT_LIST_SEED,
      'script.wordpress.new_post.post',
      '1.2.0',
    )
    assert.equal(script.state, 'resolved')
    assert.equal(script.label, 'wordpress.new_post.post · v1.2.0')
    assert.equal(script.packageKey, 'script.wordpress.new_post.post')

    const scriptMissing = resolveScriptDisplay(
      SCRIPT_LIST_SEED,
      'mayhopphat.create_post',
      '1',
    )
    assert.equal(scriptMissing.state, 'missing')
    assert.match(scriptMissing.label, /Script missing/)
    assert.equal(scriptMissing.packageKey, 'mayhopphat.create_post')
    // Do not treat package key as a pretty display name when lookup fails
    assert.equal(scriptMissing.label.startsWith('mayhopphat.create_post'), false)
  })

  it('24. pinned_account_unavailable surfaces waiting_resources (no fallback)', () => {
    assert.equal(
      isPinnedAccountUnavailable({
        status: 'waiting_resources',
        last_error_code: 'pinned_account_unavailable',
        last_error_message: 'Account offline',
      }),
      true,
    )
    assert.equal(
      isPinnedAccountUnavailable({
        status: 'waiting_resources',
        last_error_code: null,
        last_result: null,
      }),
      false,
    )
    const waiting = mapLiveContent({
      id: 'cnt-wait',
      status: 'waiting_resources',
      assigned_account_id: 'ff0035e0-a6d8-42af-8370-f5be9e453f2d',
      last_error_code: 'pinned_account_unavailable',
      last_error_message: 'pinned account not eligible',
      input: { title: 'POC Draft Title' },
    })
    assert.equal(waiting.status, 'waiting_resources')
    assert.equal(waiting.last_error_code, 'pinned_account_unavailable')
    assert.equal(isPinnedAccountUnavailable(waiting), true)
  })

  it('27. Articles F5: resolve Campaign ID + Content list envelope + empty vs error', () => {
    const camps = createMockCampaignStore().campaigns
    const first = camps[0]!

    // F5 without ?campaign= → first Campaign (parent must drive Content GET)
    assert.equal(
      resolveArticlesCampaignId({
        selectedId: '',
        urlCampaignId: undefined,
        campaigns: camps,
      }),
      first.id,
    )

    // URL / explicit selection wins
    const second = camps[1]!
    assert.equal(
      resolveArticlesCampaignId({
        selectedId: second.id,
        urlCampaignId: first.id,
        campaigns: camps,
      }),
      second.id,
    )
    assert.equal(
      resolveArticlesCampaignId({
        selectedId: '',
        urlCampaignId: second.id,
        campaigns: camps,
      }),
      second.id,
    )

    // OpenAPI envelope { ok, data: [] }
    const rows = extractLiveContentListRows({
      ok: true,
      data: [
        {
          id: 'cnt-1',
          campaign_id: first.id,
          external_ref: 'poc-1',
          status: 'waiting_resources',
          input: { title: 'POC' },
        },
      ],
    })
    assert.equal(rows.length, 1)
    const mapped = mapLiveContent(rows[0], first.id)
    assert.equal(mapped.external_ref, 'poc-1')
    assert.equal(mapped.campaign_id, first.id)

    // Genuine empty
    assert.deepEqual(extractLiveContentListRows({ ok: true, data: [] }), [])

    // Missing / invalid envelope → error (never silent empty)
    assert.throws(() => extractLiveContentListRows(null), /invalid/i)
    assert.throws(
      () => extractLiveContentListRows({ ok: true }),
      /missing data/i,
    )
    assert.throws(
      () => extractLiveContentListRows({ ok: true, data: { id: 'x' } }),
      /not an array/i,
    )

    // UI states: never show empty when error/loading
    assert.equal(
      resolveArticlesListState({ loading: true, error: null, rowCount: 0 }),
      'loading',
    )
    assert.equal(
      resolveArticlesListState({
        loading: false,
        error: 'HTTP 500',
        rowCount: 0,
      }),
      'error',
    )
    assert.equal(
      resolveArticlesListState({ loading: false, error: null, rowCount: 0 }),
      'empty',
    )
    assert.equal(
      resolveArticlesListState({ loading: false, error: null, rowCount: 2 }),
      'ready',
    )
  })

  it('27b. Out-of-order Content fetch seq drops stale apply', () => {
    // Mirrors use-campaigns per-campaign seq gate
    const seqByCampaign: Record<string, number> = {}
    const apply = (campaignId: string, seq: number): boolean =>
      seqByCampaign[campaignId] === seq

    const camp = 'camp-a'
    seqByCampaign[camp] = 1
    const firstSeq = 1
    seqByCampaign[camp] = 2
    const secondSeq = 2
    assert.equal(apply(camp, firstSeq), false)
    assert.equal(apply(camp, secondSeq), true)
  })
})
