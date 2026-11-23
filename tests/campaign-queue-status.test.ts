import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'

import { mapLiveContent } from '../src/features/campaigns/api/mappers.ts'
import { canDeleteCampaign } from '../src/features/campaigns/campaign-delete.ts'
import { createDetailRefreshController } from '../src/features/campaigns/campaign-detail-polling.ts'
import { groupAttemptsByContent } from '../src/features/campaigns/campaign-detail-view.ts'
import {
  resolveContentQueueFeedback,
  resolveEffectiveContentStatus,
} from '../src/features/campaigns/campaign-queue-status.ts'
import {
  resolveArtifactFetchUrl,
  resolveScreenshotOutcome,
} from '../src/features/campaigns/campaign-artifacts.ts'
import { contentStatusBadge } from '../src/features/campaigns/status-labels.ts'
import type { CampaignContent, CampaignJobAttempt } from '../src/features/campaigns/types.ts'

describe('Campaign Queue Status Display & Recovery Feedback', () => {
  it('1. Pending uses neutral styling and shows no error messages', () => {
    assert.deepEqual(contentStatusBadge('pending'), {
      label: 'Pending',
      variant: 'neutral',
    })

    const pendingRow = mapLiveContent({
      id: 'cnt-pending',
      campaign_id: 'camp-1',
      status: 'pending',
      last_error_code: 'stale_code',
      last_error_message: 'Should not show as red error on pending',
    })

    assert.equal(resolveEffectiveContentStatus(pendingRow), 'pending')
    assert.deepEqual(resolveContentQueueFeedback(pendingRow), { kind: 'none' })
  })

  it('2. Waiting Resources uses neutral/info styling, explains scheduler recheck, and never renders red error text', () => {
    const badge = contentStatusBadge('waiting_resources')
    assert.equal(badge.label, 'Waiting Resources')
    assert.equal(badge.variant, 'primary')

    const waitingRow = mapLiveContent({
      id: 'cnt-waiting',
      campaign_id: 'camp-1',
      status: 'waiting_resources',
      wait_reason: 'No eligible online client for site mayhopphat',
      last_error_code: 'no_eligible_client',
    })

    const feedback = resolveContentQueueFeedback(waitingRow)
    assert.equal(feedback.kind, 'info')
    if (feedback.kind === 'info') {
      assert.match(feedback.message, /No eligible online client/)
      assert.match(feedback.message, /Scheduler will automatically recheck availability/)
    }

    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, /queueFeedback\.kind === 'error'\s*\?\s*'text-xs text-danger'/)
    assert.match(screenSrc, /queueFeedback\.kind === 'warning'\s*\?\s*'text-xs text-warning'/)
    assert.match(screenSrc, /:\s*'text-xs text-primary'/)
  })

  it('3. Blocked by Failure uses warning styling and shows originating failure reason without labelling item Failed', () => {
    const badge = contentStatusBadge('blocked_by_failure')
    assert.equal(badge.label, 'Blocked by Failure')
    assert.equal(badge.variant, 'warning')

    const blockedRow = mapLiveContent({
      id: 'cnt-blocked',
      campaign_id: 'camp-1',
      status: 'pending',
      queue_state: 'blocked_by_failure',
      blocked_reason: 'Preceding job in mayhopphat.create_post queue failed (LOGIN_FAILED).',
    })

    assert.equal(resolveEffectiveContentStatus(blockedRow), 'blocked_by_failure')
    const feedback = resolveContentQueueFeedback(blockedRow)
    assert.equal(feedback.kind, 'warning')
    if (feedback.kind === 'warning') {
      assert.match(feedback.message, /Preceding job/)
    }
  })

  it('4. Historical Failed/Unknown Attempt remains unchanged in Execution History', () => {
    const content = mapLiveContent({
      id: 'cnt-1',
      campaign_id: 'camp-1',
      status: 'success',
    })
    const historicalFailed: CampaignJobAttempt = {
      id: 'att-fail-1',
      attempt_uuid: 'att-uuid-fail-1',
      content_id: 'cnt-1',
      campaign_id: 'camp-1',
      attempt: 1,
      status: 'failed_locked',
      error_code: 'SELECTOR_TIMEOUT',
      error_message: 'Element not found',
      agent_label: 'agent-1',
      browser_label: 'browser-1',
      started_at: '2026-11-23T10:00:00Z',
      ended_at: '2026-11-23T10:01:00Z',
      error: 'Element not found',
      artifacts: [],
    }
    const manualSuccess: CampaignJobAttempt = {
      id: 'att-ok-2',
      attempt_uuid: 'att-uuid-ok-2',
      content_id: 'cnt-1',
      campaign_id: 'camp-1',
      attempt: 2,
      status: 'success',
      agent_label: 'agent-1',
      browser_label: 'browser-1',
      started_at: '2026-11-23T10:05:00Z',
      ended_at: '2026-11-23T10:06:00Z',
      error: null,
      artifacts: [],
    }

    const grouped = groupAttemptsByContent([content], [historicalFailed, manualSuccess])
    const list = grouped.get('cnt-1') ?? []
    assert.equal(list.length, 2)
    assert.equal(list[0].status, 'failed_locked')
    assert.equal(list[1].status, 'success')
  })

  it('5. Manual Success recovery updates blocked badge to waiting/eligible after polling without auto Resume/Retry', async () => {
    let contents: CampaignContent[] = [
      mapLiveContent({
        id: 'cnt-queued',
        campaign_id: 'camp-1',
        status: 'blocked_by_failure',
        blocked_reason: 'Blocked by prior failure',
      }),
    ]
    assert.equal(resolveEffectiveContentStatus(contents[0]), 'blocked_by_failure')

    const controller = createDetailRefreshController({
      loadDetail: async () => {},
      loadContents: async () => {
        contents = [
          mapLiveContent({
            id: 'cnt-queued',
            campaign_id: 'camp-1',
            status: 'waiting_resources',
            wait_reason: 'Waiting for available client',
          }),
        ]
      },
    })

    await controller.refresh('camp-1')
    assert.equal(resolveEffectiveContentStatus(contents[0]), 'waiting_resources')
    assert.equal(contentStatusBadge(resolveEffectiveContentStatus(contents[0])).label, 'Waiting Resources')
    assert.equal(resolveContentQueueFeedback(contents[0]).kind, 'info')
  })

  it('6. No fabricated execution history for Pending items', () => {
    const pending = mapLiveContent({
      id: 'cnt-p',
      campaign_id: 'camp-1',
      status: 'pending',
    })
    const grouped = groupAttemptsByContent([pending], [])
    assert.deepEqual(grouped.get('cnt-p'), [])
  })

  it('7. Existing screenshot viewer helpers remain intact', () => {
    assert.equal(
      resolveArtifactFetchUrl({
        artifact_uuid: 'art-1',
        has_binary: true,
        download_url: null,
        url: null,
      }),
      '/social-automation/api/campaigns/artifacts/art-1',
    )
    assert.deepEqual(
      resolveScreenshotOutcome({ outcome: 'success', role: null }),
      { label: 'Success', variant: 'success' },
    )
  })

  it('8 & 9. Existing Pause/Resume/Cancel/Delete unaffected and expanded History preserved', () => {
    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, /expandedHistoryIds/)
    assert.match(screenSrc, /onPause\(campaign\.id\)/)
    assert.match(screenSrc, /onResume\(campaign\.id\)/)
    assert.match(screenSrc, /onCancel\(campaign\.id\)/)
    assert.equal(canDeleteCampaign({ status: 'cancelled' }), true)
  })

  it('10. Missing Backend queue fields fail safely without inferring blocked_by_failure', () => {
    const minimal = mapLiveContent({
      id: 'cnt-min',
      campaign_id: 'camp-1',
      status: 'pending',
    })
    assert.equal(minimal.queue_state, null)
    assert.equal(minimal.wait_reason, null)
    assert.equal(minimal.blocked_reason, null)
    assert.equal(resolveEffectiveContentStatus(minimal), 'pending')
    assert.deepEqual(resolveContentQueueFeedback(minimal), { kind: 'none' })
  })
})
