import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  mapLiveCampaign,
  mapLiveJobAttempt,
} from '../src/features/campaigns/api/mappers.ts'
import {
  deriveArticleCounts,
  deriveCampaignStatusMessage,
  formatSchedulerTimestamp,
  groupErrorsBySite,
} from '../src/features/campaigns/campaign-detail-view.ts'
import type { Campaign, CampaignContent } from '../src/features/campaigns/types.ts'
import { emptySummary } from '../src/features/campaigns/status-labels.ts'

function makeBaseCampaign(overrides?: Partial<Campaign>): Campaign {
  return {
    id: 'camp_detail_1',
    plan_version: 2,
    name: 'Detail Simplification Test',
    site_key: 'mayhopphat',
    site_name: 'MayHopPhat',
    script_package_key: 'mayhopphat.create_post',
    script_name: 'WP Create Post',
    script_version: '1.0.0',
    account_id: null,
    execution_mode: 'one_account_one_job',
    run_mode: 'live',
    status: 'running',
    schedule: {
      type: 'immediate',
      timezone: 'Asia/Ho_Chi_Minh',
      start_at: null,
      daily_window: null,
      min_interval_seconds: null,
      resource_recheck_seconds: 300,
    },
    summary: {
      ...emptySummary(),
      total: 4,
      waiting_resources: 4,
    },
    created_at: '2026-11-22T10:00:00Z',
    updated_at: '2026-11-22T10:05:00Z',
    allowed_actions: ['pause', 'cancel'],
    last_recheck_at: null,
    next_recheck_at: null,
    eligible_clients_count: null,
    ...overrides,
  }
}

function makeContent(
  id: string,
  actionTagKey: string,
  errCode: string | null,
  errMsg: string | null,
): CampaignContent {
  return {
    id,
    campaign_id: 'camp_detail_1',
    external_ref: `art-${id}`,
    source: 'manual',
    status: 'waiting_resources',
    input: { title: 'Test', body: null, variables: {} },
    source_format: 'shortcode',
    raw_source: '[title]Test[/title]',
    mapping_version: 1,
    editor_doc: null,
    assigned_account_id: null,
    assigned_account_label: null,
    current_job_id: null,
    last_result: errCode ? `${errCode}: ${errMsg ?? ''}` : null,
    last_error_code: errCode,
    last_error_message: errMsg,
    created_at: '2026-11-22T10:00:00Z',
    updated_at: '2026-11-22T10:05:00Z',
    assignments: [
      {
        id: `asgn_${id}`,
        action_tag_id: 1,
        action_tag_key: actionTagKey,
        script_package_key: actionTagKey,
        script_version: '1.0.0',
        release_id: 101,
        status: 'waiting_resources',
        raw_source: '[title]Test[/title]',
        shortcode_mapping: null,
      },
    ],
  }
}

test('zero eligible Clients: maps 0 count, preserves actual next_recheck_at, never fabricates last check', () => {
  const mapped = mapLiveCampaign({
    id: 'camp_zero',
    name: 'Zero Eligible Clients',
    status: 'running',
    eligible_clients_count: 0,
    last_recheck_at: null,
    next_recheck_at: '2026-11-22T11:00:00Z',
    summary: {
      total: 3,
      pending: 0,
      waiting_resources: 3,
      running: 0,
      success: 0,
      failed_locked: 0,
      unknown: 0,
    },
    resource_diagnostics: {
      evaluation_source: 'scheduler_tick',
      eligible_clients_count: 0,
      eligibility_errors: [
        {
          site_key: 'mayhopphat',
          site_name: 'MayHopPhat',
          code: 'no_eligible_client',
          message: 'No online Client with an authenticated browser.',
        },
      ],
    },
  })

  assert.equal(mapped.eligible_clients_count, 0)
  assert.equal(mapped.last_recheck_at, null)
  assert.equal(mapped.next_recheck_at, '2026-11-22T11:00:00Z')
  assert.equal(mapped.resource_diagnostics?.eligibility_errors.length, 1)
  assert.equal(mapped.resource_diagnostics?.evaluation_source, 'scheduler_tick')

  // Must not fabricate Last Check using current time
  assert.equal(formatSchedulerTimestamp(mapped.last_recheck_at, 'Not checked yet'), 'Not checked yet')
  assert.notEqual(formatSchedulerTimestamp(mapped.next_recheck_at, 'Not scheduled'), 'Not scheduled')

  const counts = deriveArticleCounts(mapped.summary)
  assert.deepEqual(counts, { waiting: 3, running: 0, successful: 0, failed: 0 })
  assert.equal(
    deriveCampaignStatusMessage(mapped, counts),
    'Waiting for an eligible Client to become available.',
  )
})

test('with eligible Clients: derives article counts, status message, and preserves scheduler timestamps', () => {
  const mapped = mapLiveCampaign({
    id: 'camp_eligible',
    name: 'With Eligible Clients',
    status: 'running',
    eligible_clients_count: 2,
    last_recheck_at: '2026-11-22T10:55:00Z',
    next_recheck_at: '2026-11-22T11:00:00Z',
    summary: {
      total: 7,
      pending: 1,
      waiting_resources: 1,
      running: 1,
      success: 3,
      failed_locked: 1,
      unknown: 0,
    },
  })

  assert.equal(mapped.eligible_clients_count, 2)
  assert.equal(mapped.last_recheck_at, '2026-11-22T10:55:00Z')
  assert.equal(mapped.next_recheck_at, '2026-11-22T11:00:00Z')

  const counts = deriveArticleCounts(mapped.summary)
  assert.deepEqual(counts, { waiting: 2, running: 1, successful: 3, failed: 1 })
  assert.equal(
    deriveCampaignStatusMessage(mapped, counts),
    'Campaign is actively running articles on eligible clients.',
  )
})

test('groups repeated errors by Site instead of displaying identical errors for every Article', () => {
  const campaign = makeBaseCampaign({
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
        shortcode_mapping: null,
      },
      {
        action_tag_id: 2,
        action_tag_key: 'demo_wp.create_post',
        site_key: 'demo_wp',
        site_name: 'Demo WP',
        cms_type: 'wordpress',
        script_package_key: 'demo_wp.create_post',
        script_name: 'WP Create Post',
        script_version: '1.0.0',
        release_id: 102,
        resolution_source: 'cms_global',
        shortcode_mapping: null,
      },
    ],
    resource_diagnostics: {
      last_checked_at: '2026-11-22T10:05:00Z',
      next_recheck_at: '2026-11-22T10:10:00Z',
      eligible_clients_count: 0,
      evaluation_source: 'scheduler_tick',
      summary_message: null,
      eligibility_errors: [
        {
          site_key: 'demo_wp',
          site_name: 'Demo WP',
          action_tag_key: 'demo_wp.create_post',
          code: 'no_eligible_client',
          message: 'No eligible client online',
        },
      ],
    },
  })

  const contents = [
    makeContent('1', 'mayhopphat.create_post', 'pinned_account_unavailable', 'Pinned account is offline'),
    makeContent('2', 'mayhopphat.create_post', 'pinned_account_unavailable', 'Pinned account is offline'),
    makeContent('3', 'mayhopphat.create_post', 'pinned_account_unavailable', 'Pinned account is offline'),
    makeContent('4', 'demo_wp.create_post', 'no_eligible_client', 'No eligible client online'),
    makeContent('5', 'demo_wp.create_post', 'no_eligible_client', 'No eligible client online'),
  ]

  const grouped = groupErrorsBySite(campaign, contents)
  assert.equal(grouped.length, 2)

  const demoWp = grouped.find((g) => g.site_key === 'demo_wp')
  assert.ok(demoWp)
  assert.equal(demoWp.article_count, 2)
  assert.deepEqual(demoWp.sources, ['eligibility', 'article'])

  const mayHopPhat = grouped.find((g) => g.site_key === 'mayhopphat')
  assert.ok(mayHopPhat)
  assert.equal(mayHopPhat.article_count, 3)
  assert.equal(mayHopPhat.code, 'pinned_account_unavailable')
})

test('preserves Attempt UUID, Agent UUID, and Browser UUID in mapLiveJobAttempt', () => {
  const attempt = mapLiveJobAttempt({
    id: 'att_1',
    attempt_uuid: '11111111-1111-1111-1111-111111111111',
    content_id: 'cnt_1',
    campaign_id: 'camp_1',
    attempt: 2,
    status: 'failed_locked',
    agent_uuid: '22222222-2222-2222-2222-222222222222',
    agent_label: 'Agent Alpha',
    browser_uuid: '33333333-3333-3333-3333-333333333333',
    browser_label: 'Chrome 1',
  })

  assert.equal(attempt.attempt_uuid, '11111111-1111-1111-1111-111111111111')
  assert.equal(attempt.agent_uuid, '22222222-2222-2222-2222-222222222222')
  assert.equal(attempt.browser_uuid, '33333333-3333-3333-3333-333333333333')
})

test('CampaignDetailScreen hides technical details behind collapsed Admin-only toggle and distinguishes scheduler evaluation', () => {
  const screenSrc = readFileSync(
    resolve(process.cwd(), 'src/features/campaigns/components/CampaignDetailScreen.tsx'),
    'utf8',
  )
  // Default UI simplified labels
  assert.equal(screenSrc.includes('Last Resource Check'), true)
  assert.equal(screenSrc.includes('Next Scheduled Check'), true)
  assert.equal(screenSrc.includes('Eligible Clients'), true)
  assert.equal(screenSrc.includes('Waiting Articles'), true)
  assert.equal(screenSrc.includes('Running Articles'), true)
  assert.equal(screenSrc.includes('Successful Articles'), true)
  assert.equal(screenSrc.includes('Failed Articles'), true)
  assert.equal(screenSrc.includes('Scheduler evaluation (distinct from Client heartbeat)'), true)

  // Collapsed Admin-only Technical Details
  assert.equal(screenSrc.includes('isAdmin = false'), true)
  assert.equal(screenSrc.includes('useState(false)'), true)
  assert.equal(screenSrc.includes('Technical Details (Admin)'), true)
  assert.equal(screenSrc.includes('Execution History'), true)
  assert.equal(screenSrc.includes('Agent UUID'), true)
  assert.equal(screenSrc.includes('Browser UUID'), true)
  assert.equal(screenSrc.includes('Attempt UUID'), true)
  assert.equal(screenSrc.includes('Grouped by Site'), true)

  // Page passes isAdmin from session identity
  const pageSrc = readFileSync(
    resolve(process.cwd(), 'src/pages/CampaignDetailPage.tsx'),
    'utf8',
  )
  assert.equal(pageSrc.includes('useSessionIdentity'), true)
  assert.equal(pageSrc.includes('isAdmin={identity.roleResolved && identity.isOwnerOrAdmin}'), true)
})
