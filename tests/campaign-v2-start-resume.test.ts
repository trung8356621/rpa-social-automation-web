import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { mapLiveCampaign } from '../src/features/campaigns/api/mappers.ts'
import {
  mockCampaignAdapter,
  resetMockCampaignStore,
} from '../src/features/campaigns/api/mock-adapter.ts'
import { CAMPAIGN_PATHS } from '../src/features/campaigns/api/paths.ts'
import type { Campaign, CampaignContent } from '../src/features/campaigns/types.ts'
import {
  canStartCampaign,
  isCampaignV2,
} from '../src/features/campaigns/validation.ts'
import { ApiError, toSafeApiMessage } from '../src/lib/api/errors.ts'

function makeV2DraftCampaign(overrides?: Partial<Campaign>): Campaign {
  return {
    id: 'camp_v2_start_1',
    plan_version: 2,
    name: 'V2 WordPress Draft',
    site_key: 'mayhopphat',
    script_package_key: 'mayhopphat.create_post',
    script_version: '1.0.0',
    execution_mode: 'one_account_one_job',
    run_mode: 'live',
    account_id: null,
    status: 'draft',
    schedule: {
      type: 'immediate',
      timezone: 'Asia/Ho_Chi_Minh',
      start_at: null,
      daily_window: null,
      min_interval_seconds: null,
      resource_recheck_seconds: 3600,
    },
    summary: {
      total: 1,
      pending: 1,
      waiting_resources: 0,
      running: 0,
      success: 0,
      failed_locked: 0,
      unknown: 0,
      skipped: 0,
    },
    created_at: '2026-11-22T10:00:00Z',
    updated_at: '2026-11-22T10:00:00Z',
    allowed_actions: ['edit', 'start', 'cancel'],
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
        shortcode_mapping: {
          entries: [{ shortcode: 'title', variable: 'title' }],
        },
      },
    ],
    ...overrides,
  }
}

function makeV2Content(
  campaignId: string,
  status: CampaignContent['status'] = 'pending',
): CampaignContent {
  return {
    id: 'cnt_v2_1',
    campaign_id: campaignId,
    external_ref: 'mock-1-abc',
    status,
    source_format: 'shortcode',
    raw_source: '[title]Hello V2[/title]',
    title: 'Hello V2',
    body: null,
    variables: null,
    mapping_version: 1,
    legacy_content_notice: null,
    assigned_account_id: null,
    current_job_id: null,
    last_error_code: null,
    last_error_message: null,
    assignments: [
      {
        id: 'asgn_1',
        action_tag_id: 1,
        action_tag_key: 'mayhopphat.create_post',
        script_package_key: 'mayhopphat.create_post',
        script_version: '1.0.0',
        release_id: 101,
        status,
      },
    ],
    updated_at: '2026-11-22T10:00:00Z',
  }
}

test('zero-Client Start UI behavior: valid V2 Draft with no account_id and zero online Clients can Start', () => {
  const campaign = makeV2DraftCampaign({ account_id: null })
  const contents = [makeV2Content(campaign.id, 'pending')]

  assert.equal(isCampaignV2(campaign), true)
  const gate = canStartCampaign(campaign, contents, null)
  assert.deepEqual(gate, { ok: true, reasons: [] })
})

test('V2 Draft Start fails gate when zero Content or missing pinned release', () => {
  const emptyCampaign = makeV2DraftCampaign({
    summary: {
      total: 0,
      pending: 0,
      waiting_resources: 0,
      running: 0,
      success: 0,
      failed_locked: 0,
      unknown: 0,
      skipped: 0,
    },
  })
  const zeroGate = canStartCampaign(emptyCampaign, [], null)
  assert.equal(zeroGate.ok, false)
  assert.match(zeroGate.reasons[0] ?? '', /zero Content/i)

  const missingRelease = makeV2DraftCampaign({
    action_tags: [
      {
        ...makeV2DraftCampaign().action_tags![0]!,
        release_id: null,
        resolution_source: 'missing',
      },
    ],
  })
  const releaseGate = canStartCampaign(
    missingRelease,
    [makeV2Content(missingRelease.id)],
    null,
  )
  assert.equal(releaseGate.ok, false)
  assert.match(releaseGate.reasons[0] ?? '', /missing a pinned Published Script Release/i)
})

test('V2 Start & Resume routes and live-adapter contract invoke POST /start and /resume with no direct Job dispatch', () => {
  assert.equal(
    CAMPAIGN_PATHS.start('camp_v2_start_1'),
    '/social-automation/api/campaigns/camp_v2_start_1/start',
  )
  assert.equal(
    CAMPAIGN_PATHS.resume('camp_v2_start_1'),
    '/social-automation/api/campaigns/camp_v2_start_1/resume',
  )

  const liveAdapterSrc = readFileSync(
    resolve(process.cwd(), 'src/features/campaigns/api/live-adapter.ts'),
    'utf8',
  )
  assert.equal(liveAdapterSrc.includes('CAMPAIGN_PATHS.start(id)'), true)
  assert.equal(liveAdapterSrc.includes('CAMPAIGN_PATHS.resume(id)'), true)
  assert.equal(liveAdapterSrc.includes('/claim'), false)

  const started = mapLiveCampaign({
    id: 'camp_v2_start_1',
    plan_version: 2,
    name: 'V2 WordPress Draft',
    status: 'running',
    run_mode: 'live',
    account_id: null,
    allowed_actions: ['pause', 'cancel'],
    summary: {
      total: 1,
      pending: 0,
      waiting_resources: 1,
      running: 0,
      success: 0,
      failed_locked: 0,
      unknown: 0,
      skipped: 0,
    },
    action_tags: makeV2DraftCampaign().action_tags,
    contents: [
      {
        id: 'cnt_v2_1',
        external_ref: 'mock-1-abc',
        status: 'waiting_resources',
        source_format: 'shortcode',
        raw_source: '[title]Hello V2[/title]',
      },
    ],
  })
  assert.equal(started.status, 'running')
  assert.equal(started.summary.waiting_resources, 1)
  assert.equal(started.contents?.[0]?.status, 'waiting_resources')

  const resumed = mapLiveCampaign({
    id: 'camp_v2_start_1',
    plan_version: 2,
    name: 'V2 WordPress Draft',
    status: 'running',
    run_mode: 'live',
    account_id: null,
    allowed_actions: ['pause', 'cancel'],
  })
  assert.equal(resumed.status, 'running')
})

test('surfaces Backend feature gate disabled / validation errors via toSafeApiMessage', () => {
  const gateDisabled = new ApiError(
    'SA_CAMPAIGN_V2_EXECUTION_ENABLED is disabled on this environment.',
    {
      kind: 'forbidden',
      status: 403,
      code: 'v2_execution_disabled',
    },
  )
  assert.match(
    toSafeApiMessage(gateDisabled),
    /SA_CAMPAIGN_V2_EXECUTION_ENABLED is disabled/i,
  )

  const validationErr = new ApiError(
    'Campaign must have at least one valid Content item before Start.',
    {
      kind: 'validation',
      status: 422,
      code: 'campaign_empty',
    },
  )
  assert.match(
    toSafeApiMessage(validationErr),
    /at least one valid Content/i,
  )
})

test('V1 compatibility and Mock V2 Start/Resume lifecycle work without regression', async () => {
  // V1 test-mode gate remains unchanged
  const v1Campaign = makeV2DraftCampaign({
    plan_version: 1,
    action_tags: undefined,
    run_mode: 'test',
    account_id: 'acc_1',
  })
  const v1NullGate = canStartCampaign(
    v1Campaign,
    [makeV2Content(v1Campaign.id)],
    null,
  )
  assert.equal(v1NullGate.ok, false)

  // Mock V2 Start -> Pause -> Resume
  resetMockCampaignStore()
  const created = await mockCampaignAdapter.createCampaignV2({
    name: 'Mock V2 Execution Flow',
    run_mode: 'live',
    execution_mode: 'one_account_one_job',
    action_tags: [
      {
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
        external_ref: 'mock-1',
        source_format: 'shortcode',
        raw_source: '[title]Test[/title]',
        assignments: [
          {
            action_tag_key: 'mayhopphat.create_post',
            raw_source: '[title]Test[/title]',
          },
        ],
      },
    ],
  })

  assert.equal(created.allowed_actions.includes('start'), true)
  const started = await mockCampaignAdapter.startCampaign(created.id)
  assert.equal(started.status, 'running')
  const paused = await mockCampaignAdapter.pauseCampaign(created.id)
  assert.equal(paused.status, 'paused')
  assert.equal(paused.allowed_actions.includes('resume'), true)
  const resumed = await mockCampaignAdapter.resumeCampaign(created.id)
  assert.equal(resumed.status, 'running')
})

test('CampaignDetailScreen shows loading state, error banner, reloads on Start/Resume, and removes obsolete V2 disabled copy', () => {
  const screenSrc = readFileSync(
    resolve(
      process.cwd(),
      'src/features/campaigns/components/CampaignDetailScreen.tsx',
    ),
    'utf8',
  )
  assert.equal(screenSrc.includes('V2 Campaign execution is not implemented yet'), false)
  assert.equal(screenSrc.includes("busyAction === 'start' ? 'Starting…' : 'Start'"), true)
  assert.equal(screenSrc.includes("busyAction === 'resume' ? 'Resuming…' : 'Resume'"), true)
  assert.equal(screenSrc.includes('role="alert"'), true)

  const hookSrc = readFileSync(
    resolve(process.cwd(), 'src/features/campaigns/use-campaigns.ts'),
    'utf8',
  )
  assert.equal(hookSrc.includes('applyAndReloadCampaign'), true)
  assert.equal(hookSrc.includes('adapter.getCampaign(id)'), true)
  assert.equal(hookSrc.includes('adapter.listContents(id)'), true)
})
