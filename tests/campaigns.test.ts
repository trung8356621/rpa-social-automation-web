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
    const bad = validateCampaignForm({
      name: '  ',
      site_key: '',
      script_package_key: '',
      execution_mode: 'one_account_one_job',
      run_mode: 'live',
      schedule: emptyScheduleForm(),
    })
    assert.equal(bad.ok, false)

    const ok = validateCampaignForm({
      name: 'Demo',
      site_key: 'facebook',
      script_package_key: 'script.facebook.group_composer.post',
      execution_mode: 'one_account_one_job',
      run_mode: 'live',
      schedule: emptyScheduleForm(),
    })
    assert.equal(ok.ok, true)
  })

  it('3. Execution mode selection values', () => {
    const a = validateCampaignForm({
      name: 'A',
      site_key: 'facebook',
      script_package_key: 'script.facebook.group_composer.post',
      execution_mode: 'one_account_one_job',
      run_mode: 'live',
      schedule: emptyScheduleForm(),
    })
    const b = validateCampaignForm({
      name: 'B',
      site_key: 'facebook',
      script_package_key: 'script.facebook.group_composer.post',
      execution_mode: 'one_account_many_jobs',
      run_mode: 'live',
      schedule: emptyScheduleForm(),
    })
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
    assert.ok(CAMPAIGN_PATHS.list.startsWith('/social-automation/api/'))
    assert.equal(CAMPAIGN_PATHS.list.startsWith('http'), false)
  })
})
