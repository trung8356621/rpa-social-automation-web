import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'

import { mapLiveContent } from '../src/features/campaigns/api/mappers.ts'
import {
  getMockCampaignStore,
  mockCampaignAdapter,
  resetMockCampaignStore,
} from '../src/features/campaigns/api/mock-adapter.ts'
import {
  canRetryContent,
  resolveEffectiveContentStatus,
} from '../src/features/campaigns/campaign-queue-status.ts'
import { contentStatusBadge } from '../src/features/campaigns/status-labels.ts'
import { ApiError, toSafeApiMessage } from '../src/lib/api/errors.ts'

describe('Campaign V2 Blocked Queue-Head Retry', () => {
  it('1. Blocked queue-head pending Content with explicit Retry eligibility -> Retry visible', () => {
    const content83 = mapLiveContent({
      id: '83',
      content_uuid: '80914820-0ae0-410a-99df-230f8ef4f45d',
      campaign_id: '7f6324cc-d8d9-41de-b4d3-65d23092d0f2',
      status: 'pending',
      queue_state: 'blocked_by_failure',
      blocked_reason: 'Action Tag maytuicanvas.create_post blocked by Job 32',
      current_job_id: null,
      can_retry: true,
      is_queue_head: true,
    })

    assert.equal(content83.status, 'pending')
    assert.equal(resolveEffectiveContentStatus(content83), 'blocked_by_failure')
    assert.equal(contentStatusBadge('blocked_by_failure').label, 'Blocked by Failure')
    assert.equal(canRetryContent(content83), true)

    // Also supports alternative backend explicit eligibility field names
    const viaRetryEligible = mapLiveContent({
      id: '83',
      campaign_id: 'camp-9',
      status: 'pending',
      queue_state: 'blocked',
      retry_eligible: true,
    })
    assert.equal(canRetryContent(viaRetryEligible), true)

    const viaAllowedActions = mapLiveContent({
      id: '83',
      campaign_id: 'camp-9',
      status: 'pending',
      queue_state: 'blocked_by_failure',
      allowed_actions: ['retry', 'skip', 'cancel'],
    })
    assert.equal(canRetryContent(viaAllowedActions), true)
  })

  it('2. Later Blocked by Failure Contents (84-86) or in-flight recovery -> Retry hidden', () => {
    const laterExplicitFalse = mapLiveContent({
      id: '84',
      campaign_id: '7f6324cc-d8d9-41de-b4d3-65d23092d0f2',
      status: 'pending',
      queue_state: 'blocked_by_failure',
      can_retry: false,
      is_queue_head: false,
    })
    assert.equal(resolveEffectiveContentStatus(laterExplicitFalse), 'blocked_by_failure')
    assert.equal(canRetryContent(laterExplicitFalse), false)

    const laterOmitted = mapLiveContent({
      id: '85',
      campaign_id: '7f6324cc-d8d9-41de-b4d3-65d23092d0f2',
      status: 'pending',
      queue_state: 'blocked_by_failure',
    })
    assert.equal(canRetryContent(laterOmitted), false)

    const inFlightByJobId = mapLiveContent({
      id: '83',
      campaign_id: '7f6324cc-d8d9-41de-b4d3-65d23092d0f2',
      status: 'pending',
      queue_state: 'blocked_by_failure',
      current_job_id: '33',
      can_retry: true,
    })
    assert.equal(canRetryContent(inFlightByJobId), false)

    const inFlightByFlag = mapLiveContent({
      id: '83',
      campaign_id: '7f6324cc-d8d9-41de-b4d3-65d23092d0f2',
      status: 'pending',
      queue_state: 'blocked_by_failure',
      recovery_job_in_flight: true,
      can_retry: true,
    })
    assert.equal(canRetryContent(inFlightByFlag), false)

    const nonBlockedPending = mapLiveContent({
      id: '86',
      campaign_id: '7f6324cc-d8d9-41de-b4d3-65d23092d0f2',
      status: 'pending',
      queue_state: 'waiting_resources',
      can_retry: true,
    })
    assert.equal(canRetryContent(nonBlockedPending), false)
  })

  it('3 & 4. Failed Locked and Unknown Contents preserve existing Retry behavior', () => {
    const failedLocked = mapLiveContent({
      id: 'cnt-fl',
      campaign_id: 'camp-1',
      status: 'failed_locked',
    })
    assert.equal(canRetryContent(failedLocked), true)

    const unknown = mapLiveContent({
      id: 'cnt-unk',
      campaign_id: 'camp-1',
      status: 'unknown',
    })
    assert.equal(canRetryContent(unknown), true)
  })

  it('5. Duplicate click prevention & pending state in CampaignDetailScreen', () => {
    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, /canRetryContent\(c\)/)
    assert.match(screenSrc, /runInFlightRef\.current/)
    assert.match(screenSrc, /disabled=\{busy\}/)
    assert.match(screenSrc, /retryingContentId === c\.id \? 'Retrying…' : 'Retry'/)
  })

  it('6. Backend 422 error surfaces clearly via toSafeApiMessage and actionError alert', () => {
    const err422 = new ApiError(
      'Only the queue-head blocked content can be retried.',
      { kind: 'validation', status: 422 },
    )
    assert.equal(
      toSafeApiMessage(err422),
      'Only the queue-head blocked content can be retried.',
    )

    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, /setActionError\(toSafeApiMessage\(err\)\)/)
    assert.match(screenSrc, /role="alert"[\s\S]*?\{actionError\}/)
  })

  it('7 & 8. Retry success refreshes Campaign Detail without auto-resuming Paused campaign', async () => {
    const useCampaignsSrc = readFileSync(
      resolve('src/features/campaigns/use-campaigns.ts'),
      'utf8',
    )
    assert.match(useCampaignsSrc, /const retryContent = useCallback/)
    assert.match(useCampaignsSrc, /await adapter\.retryContent\(id,\s*\{\s*idempotencyKey:\s*key\s*\}\)/)
    assert.match(useCampaignsSrc, /await adapter\.getCampaign\(targetCampaignId\)/)
    // retryContent must never call resume/start/pause
    const retryBlock = useCampaignsSrc.slice(
      useCampaignsSrc.indexOf('const retryContent = useCallback'),
      useCampaignsSrc.indexOf('const skipContent = useCallback'),
    )
    assert.doesNotMatch(retryBlock, /resumeCampaign|startCampaign|pauseCampaign|\.resume\(|\.start\(|\.pause\(/)

    // Verify mockAdapter supports blocked queue-head retry and keeps paused campaign paused
    resetMockCampaignStore()
    const store = getMockCampaignStore()
    const paused = store.campaigns.find((c) => c.status === 'paused')
    assert.ok(paused, 'mock store has a paused campaign')
    const target = store.contents.find((c) => c.campaign_id === paused.id)
    assert.ok(target, 'paused campaign has content')
    target.status = 'pending'
    target.queue_state = 'blocked_by_failure'
    target.can_retry = true
    assert.equal(canRetryContent(target), true)
    const retried = await mockCampaignAdapter.retryContent(target.id, {
      idempotencyKey: 'test-retry-1',
    })
    assert.equal(retried.status, 'pending')
    assert.equal(retried.can_retry, false)
    assert.equal(paused.status, 'paused')
  })

  it('9 & 10. Existing Skip/Cancel/History remain functional with no Campaign V2 Detail regressions', () => {
    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, /effectiveStatus === 'blocked_by_failure'/)
    assert.match(screenSrc, /onSkip\(c\.id\)/)
    assert.match(screenSrc, /onCancelContent\(c\.id\)/)
    assert.match(screenSrc, /toggleContentHistory\(c\.id\)/)
    assert.match(screenSrc, /Execution History \(\$\{contentAttempts\.length\}\)/)
  })
})
