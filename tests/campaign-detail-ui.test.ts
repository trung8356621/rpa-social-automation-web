import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  mapLiveCampaign,
  mapLiveContent,
  mapLiveJobAttempt,
} from '../src/features/campaigns/api/mappers.ts'
import {
  deriveArticleCounts,
  deriveCampaignStatusMessage,
  formatSchedulerTimestamp,
  groupAttemptsByContent,
  groupErrorsBySite,
  resolveAttemptFailureDisplay,
  resolveContentTitle,
  resolveContentUuid,
  resolveQuickAudit,
} from '../src/features/campaigns/campaign-detail-view.ts'
import type {
  Campaign,
  CampaignContent,
  CampaignJobAttempt,
} from '../src/features/campaigns/types.ts'
import {
  contentStatusBadge,
  emptySummary,
} from '../src/features/campaigns/status-labels.ts'

test('quick audit isolates the current attempt and preserves history across retries', () => {
  const content = makeContent('audit', 'site.create_post', null, null)
  const screenshot = {
    kind: 'screenshot',
    artifact_uuid: 'evidence',
    outcome: 'success',
    thumbnail_url: '/social-automation/api/campaigns/artifacts/evidence/thumbnail',
  }
  const first = mapLiveJobAttempt({
    id: '1', content_id: content.id, job_id: 'first-job', attempt_no: 1,
    status: 'succeeded', ended_at: '2026-11-27T02:00:00Z', artifacts: [screenshot],
  })
  const second = mapLiveJobAttempt({
    id: '2', content_id: content.id, job_id: 'retry-job', attempt_no: 2,
    status: 'failed', ended_at: '2026-11-27T02:01:00Z', error_message: 'Timed out',
  })
  const third = mapLiveJobAttempt({
    id: '3', attempt_uuid: 'running-3', content_id: content.id, job_id: 'retry-job',
    attempt_no: 3, status: 'running', started_at: '2026-11-27T02:02:00Z', agent_uuid: 'worker-3',
  })
  const success = resolveQuickAudit(content, 'success', [first])
  assert.equal(success.status, 'success')
  assert.equal(success.screenshot?.thumbnail_url, screenshot.thumbnail_url)
  assert.equal(resolveQuickAudit(content, 'success', [{ ...first, artifacts: [] }]).status, 'success')
  assert.equal(resolveQuickAudit(content, 'failed_locked', [first, second]).error, 'Timed out')
  assert.equal(resolveQuickAudit(content, 'failed_locked', [first, second]).screenshot, undefined)
  assert.equal(resolveQuickAudit(content, 'failed_locked', [first]).screenshot, undefined)

  const retry = { ...content, current_job_id: 'retry-job', attempts: [{ ...third, attempt_uuid: null }] }
  const attempts = groupAttemptsByContent([retry], [third, first, second]).get(content.id)!
  assert.deepEqual(attempts.map((attempt) => attempt.attempt), [1, 2, 3])
  assert.equal(resolveQuickAudit(retry, 'pending', attempts).screenshot, undefined)
  assert.equal(resolveQuickAudit(retry, 'running', [first]).screenshot, undefined)
  const running = resolveQuickAudit(retry, 'running', attempts)
  assert.equal(running.attempt?.agent_uuid, 'worker-3')
  assert.equal(running.completed?.ended_at, second.ended_at)
  assert.equal(running.screenshot, undefined)
  assert.equal(resolveQuickAudit(retry, 'pending', attempts, true).status, 'retrying')
  assert.equal(resolveQuickAudit({ ...retry, recovery_job_in_flight: true }, 'pending', attempts).status, 'retrying')
})

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

test('merges Execution History under each Content: multiple attempts chronological, no history, strict UUID mapping', () => {
  const c1: CampaignContent = {
    ...makeContent('6df3c762-63a0-41eb-991f-6753716feac5', 'maytuicanvas.create_post', 'SCROLL_CONTAINER_CHANGED', 'Scroll container selector changed'),
    status: 'failed_locked',
    raw_source: '[title]TEST Mock Title #5[/title][body]Body[/body]',
    input: { title: null, body: null, variables: {} },
    current_job_id: 'job-uuid-2222',
  }
  const c2: CampaignContent = {
    ...makeContent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'maytuicanvas.create_post', null, null),
    status: 'waiting_resources',
    input: { title: 'Waiting Article', body: null, variables: {} },
    current_job_id: null,
  }
  const c3: CampaignContent = {
    ...makeContent('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'maytuicanvas.create_post', 'AGENT_DISCONNECT', 'Agent disconnected'),
    status: 'unknown',
    input: { title: 'Unknown Article', body: null, variables: {} },
    current_job_id: 'job-uuid-3333',
  }

  assert.equal(resolveContentTitle(c1), 'TEST Mock Title #5')
  assert.equal(resolveContentUuid(c1), '6df3c762-63a0-41eb-991f-6753716feac5')
  assert.equal(resolveContentTitle(c2), 'Waiting Article')

  // Intentionally supply attempts out of chronological order + one unrelated attempt
  const attempts: CampaignJobAttempt[] = [
    mapLiveJobAttempt({
      id: 'att_2',
      attempt_uuid: 'att-uuid-0002',
      job_uuid: 'job-uuid-2222',
      content_id: c1.id,
      campaign_id: 'camp_detail_1',
      attempt: 2,
      status: 'failed_locked',
      step: 1,
      error_code: 'SCROLL_CONTAINER_CHANGED',
      error_message: 'Scroll container selector changed',
      started_at: '2026-11-22T10:15:00Z',
      ended_at: '2026-11-22T10:16:00Z',
      artifacts: [
        {
          id: 'art_s2',
          kind: 'screenshot',
          label: 'step1-failure.png',
          url: 'https://cdn.example.com/artifacts/step1-failure.png',
        },
      ],
    }),
    mapLiveJobAttempt({
      id: 'att_1',
      attempt_uuid: 'att-uuid-0001',
      job_uuid: 'job-uuid-1111',
      content_id: c1.id,
      campaign_id: 'camp_detail_1',
      attempt: 1,
      status: 'failed_locked',
      step: 1,
      error_code: 'LOGIN_TIMEOUT',
      error_message: 'Login timed out',
      started_at: '2026-11-22T10:05:00Z',
      ended_at: '2026-11-22T10:06:00Z',
      artifacts: [],
    }),
    mapLiveJobAttempt({
      id: 'att_unk',
      attempt_uuid: 'att-uuid-0003',
      job_uuid: 'job-uuid-3333',
      content_id: c3.id,
      campaign_id: 'camp_detail_1',
      attempt: 1,
      status: 'unknown',
      error_code: 'AGENT_DISCONNECT',
      error_message: 'Agent disconnected',
      started_at: '2026-11-22T10:20:00Z',
      ended_at: null,
      artifacts: [],
    }),
    // Unrelated content_id (even with matching-looking prefix) must NEVER attach to c1/c2/c3
    mapLiveJobAttempt({
      id: 'att_other',
      attempt_uuid: 'att-uuid-9999',
      job_uuid: 'job-uuid-9999',
      content_id: '6df3c762-63a0-41eb-991f-000000000000',
      campaign_id: 'camp_detail_1',
      attempt: 1,
      status: 'failed_locked',
      started_at: '2026-11-22T10:00:00Z',
      artifacts: [],
    }),
  ]

  const grouped = groupAttemptsByContent([c1, c2, c3], attempts)

  // c1 has 2 attempts in chronological order (#1 then #2)
  const c1Attempts = grouped.get(c1.id) ?? []
  assert.equal(c1Attempts.length, 2)
  assert.equal(c1Attempts[0]?.attempt, 1)
  assert.equal(c1Attempts[0]?.attempt_uuid, 'att-uuid-0001')
  assert.equal(c1Attempts[0]?.job_uuid, 'job-uuid-1111')
  assert.equal(c1Attempts[1]?.attempt, 2)
  assert.equal(c1Attempts[1]?.attempt_uuid, 'att-uuid-0002')
  assert.equal(c1Attempts[1]?.job_uuid, 'job-uuid-2222')
  assert.equal(
    c1Attempts[1]?.artifacts[0]?.url,
    'https://cdn.example.com/artifacts/step1-failure.png',
  )

  const failDisplay = resolveAttemptFailureDisplay(c1Attempts[1]!)
  assert.equal(failDisplay.reason, 'Scroll container selector changed')
  assert.equal(failDisplay.stepLabel, 'Step 1')
  assert.equal(failDisplay.errorCode, 'SCROLL_CONTAINER_CHANGED')

  // c2 (waiting_resources) has 0 attempts
  assert.equal((grouped.get(c2.id) ?? []).length, 0)
  assert.equal(contentStatusBadge(c2.status).label, 'Waiting Resources')

  // c3 (unknown) has 1 attempt
  const c3Attempts = grouped.get(c3.id) ?? []
  assert.equal(c3Attempts.length, 1)
  assert.equal(contentStatusBadge(c3.status).label, 'Unknown')
  assert.equal(contentStatusBadge(c1.status).label, 'Failed Locked')
})

test('mapLiveContent preserves content_uuid and nested attempts; CampaignDetailScreen removes standalone Execution History table', () => {
  const mapped = mapLiveContent({
    id: '6df3c762-63a0-41eb-991f-6753716feac5',
    content_uuid: '6df3c762-63a0-41eb-991f-6753716feac5',
    campaign_id: 'camp_1',
    status: 'failed_locked',
    current_job_id: 'job-uuid-1',
    attempts: [
      {
        id: 'att-1',
        attempt_uuid: 'att-uuid-1',
        job_uuid: 'job-uuid-1',
        content_id: '6df3c762-63a0-41eb-991f-6753716feac5',
        attempt: 1,
        status: 'failed_locked',
        step: 1,
        error_code: 'SCROLL_CONTAINER_CHANGED',
        error_message: 'Scroll container changed',
        artifacts: [
          {
            id: 'art-1',
            kind: 'screenshot',
            label: 'failure.png',
            url: 'https://example.com/failure.png',
          },
        ],
      },
    ],
  })

  assert.equal(mapped.content_uuid, '6df3c762-63a0-41eb-991f-6753716feac5')
  assert.equal(mapped.attempts?.length, 1)
  assert.equal(mapped.attempts?.[0]?.job_uuid, 'job-uuid-1')
  assert.equal(mapped.attempts?.[0]?.attempt_uuid, 'att-uuid-1')

  const screenSrc = readFileSync(
    resolve(process.cwd(), 'src/features/campaigns/components/CampaignDetailScreen.tsx'),
    'utf8',
  )
  // Content row required elements & preserved controls
  assert.equal(screenSrc.includes('UUID: {contentUuid}'), true)
  assert.equal(screenSrc.includes('Current Job:'), true)
  assert.equal(screenSrc.includes('Job UUID:'), true)
  assert.equal(screenSrc.includes('Attempt UUID:'), true)
  assert.equal(screenSrc.includes('AttemptScreenshot'), true)
  assert.equal(screenSrc.includes('onRetry(c.id, c.status)'), true)
  assert.equal(screenSrc.includes('onSkip(c.id)'), true)
  assert.equal(screenSrc.includes('onCancelContent(c.id)'), true)
  assert.equal(screenSrc.includes('RETRY_WARNING'), true)
  assert.equal(screenSrc.includes('UNKNOWN_RETRY_WARNING'), true)

  // Old standalone Execution History table & duplicate Content table removed
  assert.equal(screenSrc.includes('No job attempts yet.'), false)
  assert.equal(screenSrc.includes('Attempt / Attempt UUID'), false)
  assert.equal(screenSrc.includes('Content Technical Payload &amp; Admin Actions'), false)
})
