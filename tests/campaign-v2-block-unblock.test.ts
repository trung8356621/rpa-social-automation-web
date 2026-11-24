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
import { CAMPAIGN_CONTENT_PATHS } from '../src/features/campaigns/api/paths.ts'
import { resolveArtifactFetchUrl } from '../src/features/campaigns/campaign-artifacts.ts'
import { groupAttemptsByContent } from '../src/features/campaigns/campaign-detail-view.ts'
import {
  canBlockContent,
  canRetryContent,
  canUnblockContent,
  resolveContentQueueFeedback,
  resolveEffectiveContentStatus,
} from '../src/features/campaigns/campaign-queue-status.ts'
import { contentStatusBadge } from '../src/features/campaigns/status-labels.ts'
import type { CampaignJobAttempt } from '../src/features/campaigns/types.ts'
import { ApiError, toSafeApiMessage } from '../src/lib/api/errors.ts'

describe('Campaign V2 Block / Unblock / Retry Content Actions', () => {
  it('1 & 2. Pending and Waiting Resources -> Block available, Unblock hidden', () => {
    const pending = mapLiveContent({
      id: 'cnt-pending',
      campaign_id: 'camp-v2',
      status: 'pending',
      can_block: true,
      can_unblock: false,
    })
    assert.equal(resolveEffectiveContentStatus(pending), 'pending')
    assert.equal(canBlockContent(pending), true)
    assert.equal(canUnblockContent(pending), false)

    const waiting = mapLiveContent({
      id: 'cnt-waiting',
      campaign_id: 'camp-v2',
      status: 'pending',
      queue_state: 'waiting_resources',
      can_block: true,
    })
    assert.equal(resolveEffectiveContentStatus(waiting), 'waiting_resources')
    assert.equal(canBlockContent(waiting), true)
    assert.equal(canUnblockContent(waiting), false)

    // Backend explicit can_block=false overrides
    const ineligible = mapLiveContent({
      id: 'cnt-no-block',
      campaign_id: 'camp-v2',
      status: 'pending',
      can_block: false,
    })
    assert.equal(canBlockContent(ineligible), false)
  })

  it('3 & 4. User Blocked -> Unblock available with distinct label/description; later contents remain eligible', async () => {
    const blocked = mapLiveContent({
      id: 'cnt-user-blocked',
      campaign_id: 'camp-v2',
      status: 'blocked',
      user_blocked: true,
      can_block: false,
      can_unblock: true,
    })
    assert.equal(resolveEffectiveContentStatus(blocked), 'user_blocked')
    assert.deepEqual(contentStatusBadge('user_blocked'), {
      label: 'Blocked',
      variant: 'neutral',
    })
    const feedback = resolveContentQueueFeedback(blocked)
    assert.equal(feedback.kind, 'info')
    if (feedback.kind === 'info') {
      assert.equal(
        feedback.message,
        'Tạm ngưng bài này. Các bài tiếp theo vẫn chạy.',
      )
    }
    assert.equal(canBlockContent(blocked), false)
    assert.equal(canUnblockContent(blocked), true)
    assert.equal(canRetryContent(blocked), false)

    // Blocking one content in mock store keeps later contents eligible
    resetMockCampaignStore()
    const store = getMockCampaignStore()
    const first = store.contents[0]
    assert.ok(first)
    const targetCampId = first.campaign_id
    first.status = 'pending'
    first.queue_state = null
    first.can_block = true
    const later = mapLiveContent({
      id: 'cnt-later',
      campaign_id: targetCampId,
      status: 'pending',
      can_block: true,
    })
    const blockedRes = await mockCampaignAdapter.blockContent(first.id)
    assert.equal(blockedRes.status, 'user_blocked')
    assert.equal(canUnblockContent(blockedRes), true)
    assert.equal(canBlockContent(later), true)
    const unblockedRes = await mockCampaignAdapter.unblockContent(first.id)
    assert.equal(unblockedRes.status, 'pending')
    assert.equal(canBlockContent(unblockedRes), true)
  })

  it('5 & 6. Blocked by Failure does not show Unblock; Retry is preserved for eligible items', () => {
    const failureHead = mapLiveContent({
      id: '83',
      campaign_id: 'camp-9',
      status: 'pending',
      queue_state: 'blocked_by_failure',
      blocked_reason: 'Blocked by Job 32',
      can_retry: true,
      can_unblock: true, // Even if misreported, system failure gate must never offer Unblock
      is_queue_head: true,
    })
    assert.equal(resolveEffectiveContentStatus(failureHead), 'blocked_by_failure')
    assert.equal(contentStatusBadge('blocked_by_failure').label, 'Blocked by Failure')
    assert.equal(canUnblockContent(failureHead), false)
    assert.equal(canBlockContent(failureHead), false)
    assert.equal(canRetryContent(failureHead), true)

    const failedLocked = mapLiveContent({
      id: 'cnt-fl',
      campaign_id: 'camp-9',
      status: 'failed_locked',
    })
    assert.equal(canRetryContent(failedLocked), true)
    assert.equal(canBlockContent(failedLocked), false)
    assert.equal(canUnblockContent(failedLocked), false)

    const unknown = mapLiveContent({
      id: 'cnt-unk',
      campaign_id: 'camp-9',
      status: 'unknown',
    })
    assert.equal(canRetryContent(unknown), true)
    assert.equal(canBlockContent(unknown), false)
    assert.equal(canUnblockContent(unknown), false)
  })

  it('7 & 8. Running and Success Contents cannot be blocked or unblocked', () => {
    const running = mapLiveContent({
      id: 'cnt-run',
      campaign_id: 'camp-v2',
      status: 'running',
      current_job_id: '99',
    })
    assert.equal(canBlockContent(running), false)
    assert.equal(canUnblockContent(running), false)
    assert.equal(canRetryContent(running), false)

    const success = mapLiveContent({
      id: 'cnt-ok',
      campaign_id: 'camp-v2',
      status: 'success',
    })
    assert.equal(canBlockContent(success), false)
    assert.equal(canUnblockContent(success), false)
    assert.equal(canRetryContent(success), false)
  })

  it('9 & 10. Duplicate click protection, no Unblock confirm, and API error handling', () => {
    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, /runInFlightRef\.current/)
    assert.match(screenSrc, /blockingContentId === c\.id \? 'Blocking…' : 'Block'/)
    assert.match(screenSrc, /unblockingContentId === c\.id[\s\S]*?'Unblocking…'[\s\S]*?'Unblock'/)

    // Unblock must not use window.confirm
    const unblockSection = screenSrc.slice(
      screenSrc.indexOf('canUnblockContent(c)'),
      screenSrc.indexOf('canRetryContent(c)'),
    )
    assert.doesNotMatch(unblockSection, /window\.confirm/)

    // Error handling
    const apiErr = new ApiError('Cannot block running content.', {
      kind: 'validation',
      status: 422,
    })
    assert.equal(toSafeApiMessage(apiErr), 'Cannot block running content.')
    assert.match(screenSrc, /setActionError\(toSafeApiMessage\(err\)\)/)
    assert.match(screenSrc, /role="alert"[\s\S]*?\{actionError\}/)
  })

  it('11, 12 & 13. API paths, Campaign Detail refresh, Pause/Resume/Cancel Campaign unchanged, V2 hides Skip/Cancel', () => {
    assert.equal(
      CAMPAIGN_CONTENT_PATHS.block('cnt-1'),
      '/social-automation/api/campaign-contents/cnt-1/block',
    )
    assert.equal(
      CAMPAIGN_CONTENT_PATHS.unblock('cnt-1'),
      '/social-automation/api/campaign-contents/cnt-1/unblock',
    )

    const useCampaignsSrc = readFileSync(
      resolve('src/features/campaigns/use-campaigns.ts'),
      'utf8',
    )
    assert.match(useCampaignsSrc, /const blockContent = useCallback/)
    assert.match(useCampaignsSrc, /const unblockContent = useCallback/)
    assert.match(useCampaignsSrc, /refreshCampaignDetailAfterContentAction/)

    // blockContent and unblockContent must not auto-start, resume, or retry
    const blockSection = useCampaignsSrc.slice(
      useCampaignsSrc.indexOf('const blockContent = useCallback'),
      useCampaignsSrc.indexOf('const skipContent = useCallback'),
    )
    assert.doesNotMatch(
      blockSection,
      /resumeCampaign|startCampaign|pauseCampaign|retryContent/,
    )

    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    // Campaign-level Pause / Resume / Cancel remain intact
    assert.match(screenSrc, /campaign\.allowed_actions\.includes\('pause'\)/)
    assert.match(screenSrc, /campaign\.allowed_actions\.includes\('resume'\)/)
    assert.match(screenSrc, /campaign\.allowed_actions\.includes\('cancel'\)/)
    // V2 Content rows hide Skip/Cancel (only shown when !isV2)
    assert.match(screenSrc, /\{!isV2 &&/)
  })

  it('14 & 15. Legacy history, expanded state, and screenshot/Attempt History remain unaffected', () => {
    const content = mapLiveContent({
      id: 'cnt-hist',
      campaign_id: 'camp-1',
      status: 'success',
    })
    const attempt: CampaignJobAttempt = {
      id: 'att-1',
      attempt_uuid: 'att-uuid-1',
      content_id: 'cnt-hist',
      campaign_id: 'camp-1',
      attempt: 1,
      status: 'success',
      agent_label: 'agent-1',
      browser_label: 'browser-1',
      started_at: '2026-11-24T10:00:00Z',
      ended_at: '2026-11-24T10:01:00Z',
      error: null,
      artifacts: [],
    }
    const grouped = groupAttemptsByContent([content], [attempt])
    assert.equal(grouped.get('cnt-hist')?.length, 1)

    assert.equal(
      resolveArtifactFetchUrl({
        artifact_uuid: 'art-99',
        has_binary: true,
        download_url: null,
        url: null,
      }),
      '/social-automation/api/campaigns/artifacts/art-99',
    )

    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, /expandedHistoryIds/)
    assert.match(screenSrc, /Execution History \(\$\{contentAttempts\.length\}\)/)
  })
})
