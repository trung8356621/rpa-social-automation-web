import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'

import { mapLiveJobAttempt } from '../src/features/campaigns/api/mappers.ts'
import { CAMPAIGN_PATHS } from '../src/features/campaigns/api/paths.ts'
import {
  isScreenshotArtifact,
  resolveArtifactFetchUrl,
  resolveScreenshotOutcome,
  resolveScreenshotVariant,
} from '../src/features/campaigns/campaign-artifacts.ts'
import {
  RUNNING_POLL_INTERVAL_MS,
  createDetailRefreshController,
  getCampaignDetailPollIntervalMs,
  isTerminalCampaignStatus,
} from '../src/features/campaigns/campaign-detail-polling.ts'
import { canDeleteCampaign } from '../src/features/campaigns/campaign-delete.ts'
import { contentStatusBadge } from '../src/features/campaigns/status-labels.ts'

describe('Campaign Detail Auto-Refresh & Screenshot Evidence', () => {
  it('1. Success status appears without F5 via background detail + contents + attempts refresh', async () => {
    let detailCalls = 0
    let contentCalls = 0
    let currentStatus = 'running'

    const controller = createDetailRefreshController({
      loadDetail: async () => {
        detailCalls += 1
        currentStatus = 'completed'
      },
      loadContents: async () => {
        contentCalls += 1
      },
    })

    const ok = await controller.refresh('camp-1')
    assert.equal(ok, true)
    assert.equal(detailCalls, 1)
    assert.equal(contentCalls, 1)
    assert.equal(currentStatus, 'completed')

    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(
      screenSrc,
      /\[campaign\.id,\s*campaign\.status,\s*campaign\.updated_at,\s*contents,\s*loadAttempts\]/,
    )

    assert.deepEqual(contentStatusBadge('success'), {
      label: 'Success',
      variant: 'success',
    })
    assert.deepEqual(contentStatusBadge('completed'), {
      label: 'Completed',
      variant: 'success',
    })
    assert.deepEqual(contentStatusBadge('failed'), {
      label: 'Failed',
      variant: 'danger',
    })
    assert.deepEqual(contentStatusBadge('failed_locked'), {
      label: 'Failed Locked',
      variant: 'danger',
    })
    assert.deepEqual(contentStatusBadge('unknown'), {
      label: 'Unknown',
      variant: 'warning',
    })
    assert.deepEqual(contentStatusBadge('waiting_resources'), {
      label: 'Waiting Resources',
      variant: 'warning',
    })
  })

  it('2. Polling does not overlap and stops cleanly on dispose', async () => {
    let releaseDetail!: () => void
    const detailGate = new Promise<void>((r) => {
      releaseDetail = r
    })
    let detailCalls = 0
    let contentCalls = 0

    const controller = createDetailRefreshController({
      loadDetail: async () => {
        detailCalls += 1
        await detailGate
      },
      loadContents: async () => {
        contentCalls += 1
      },
    })

    const first = controller.refresh('camp-1')
    assert.equal(controller.isInFlight(), true)

    // Overlapping tick while first is in flight is skipped
    const overlapping = await controller.refresh('camp-1')
    assert.equal(overlapping, false)
    assert.equal(detailCalls, 1)

    releaseDetail()
    assert.equal(await first, true)
    assert.equal(contentCalls, 1)
    assert.equal(controller.isInFlight(), false)

    // Disposed controller refuses further refreshes
    controller.dispose()
    assert.equal(controller.isDisposed(), true)
    assert.equal(await controller.refresh('camp-1'), false)
    assert.equal(detailCalls, 1)
  })

  it('3 & 4. Expanded History, scroll position, and existing data preserved on polling & transient errors', async () => {
    const pageSrc = readFileSync(
      resolve('src/pages/CampaignDetailPage.tsx'),
      'utf8',
    )
    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )

    // Polling effect in CampaignDetailPage never sets detailLoading=true or unmounts CampaignDetailScreen
    const pollBlock = pageSrc.slice(
      pageSrc.indexOf('createDetailRefreshController('),
    )
    assert.doesNotMatch(pollBlock, /setDetailLoading\s*\(\s*true\s*\)/)

    // CampaignDetailScreen preserves expandedHistoryIds and does not wipe attempts on transient error
    assert.match(screenSrc, /expandedHistoryIds/)
    assert.doesNotMatch(screenSrc, /setAttempts\(\[\]\)/)

    let transientSeen = false
    const controller = createDetailRefreshController({
      loadDetail: async () => {
        throw new Error('Temporary network error')
      },
      loadContents: async () => {},
      onTransientError: () => {
        transientSeen = true
      },
    })
    const ok = await controller.refresh('camp-1')
    assert.equal(ok, false)
    assert.equal(transientSeen, true)
  })

  it('5. Success screenshot metadata maps and resolves authenticated Staff URL', () => {
    const attempt = mapLiveJobAttempt({
      id: 'att-1',
      attempt_uuid: 'att-uuid-1',
      content_id: 'cnt-1',
      campaign_id: 'camp-1',
      attempt: 1,
      status: 'success',
      artifacts: [
        {
          artifact_uuid: 'art-uuid-success',
          kind: 'screenshot',
          label: 'post_published.png',
          has_binary: true,
          outcome: 'success',
          language_label: 'VI',
          mime_type: 'image/png',
        },
      ],
    })

    assert.equal(attempt.artifacts.length, 1)
    const art = attempt.artifacts[0]
    assert.equal(isScreenshotArtifact(art), true)
    assert.equal(
      resolveArtifactFetchUrl(art),
      CAMPAIGN_PATHS.artifact('art-uuid-success'),
    )
    assert.equal(
      CAMPAIGN_PATHS.artifact('art-uuid-success'),
      '/social-automation/api/campaigns/artifacts/art-uuid-success',
    )
    assert.deepEqual(resolveScreenshotOutcome(art), {
      label: 'Success',
      variant: 'success',
    })
    assert.equal(resolveScreenshotVariant(art), 'VI')

    const screenshotCompSrc = readFileSync(
      resolve('src/features/campaigns/components/AttemptScreenshot.tsx'),
      'utf8',
    )
    assert.match(screenshotCompSrc, /URL\.createObjectURL\(blob\)/)
    assert.match(screenshotCompSrc, /URL\.revokeObjectURL\(activeUrl\)/)
  })

  it('6. Failure screenshot metadata maps with Failure label and language variant', () => {
    const attempt = mapLiveJobAttempt({
      id: 'att-2',
      content_id: 'cnt-1',
      campaign_id: 'camp-1',
      attempt: 2,
      status: 'failed',
      artifacts: [
        {
          artifact_uuid: 'art-uuid-fail',
          kind: 'screenshot',
          label: 'login_error.png',
          has_binary: true,
          role: 'failure_screenshot',
          variant: 'EN',
        },
      ],
    })

    const art = attempt.artifacts[0]
    assert.equal(isScreenshotArtifact(art), true)
    assert.equal(
      resolveArtifactFetchUrl(art),
      '/social-automation/api/campaigns/artifacts/art-uuid-fail',
    )
    assert.deepEqual(resolveScreenshotOutcome(art), {
      label: 'Failure',
      variant: 'danger',
    })
    assert.equal(resolveScreenshotVariant(art), 'EN')
  })

  it('7. Missing binary, local client paths, and neutral screenshots handled safely without inferring success', () => {
    // Metadata-only artifact (has_binary: false)
    assert.equal(
      resolveArtifactFetchUrl({
        artifact_uuid: 'art-uuid-missing',
        has_binary: false,
        download_url: '/social-automation/api/campaigns/artifacts/art-uuid-missing',
        url: null,
      }),
      null,
    )

    // Never fabricate URL from local Client filesystem path
    assert.equal(
      resolveArtifactFetchUrl({
        artifact_uuid: null,
        has_binary: true,
        download_url: null,
        url: 'C:\\Users\\client\\AppData\\shot.png',
      }),
      null,
    )

    // Never infer success merely because a screenshot exists without outcome/role
    assert.equal(
      resolveScreenshotOutcome({
        outcome: null,
        role: null,
      }),
      null,
    )
  })

  it('8. Unauthorized screenshot retrieval uses Staff session and maps 401/403 cleanly', () => {
    const clientSrc = readFileSync(
      resolve('src/features/campaigns/api/artifact-client.ts'),
      'utf8',
    )
    assert.match(clientSrc, /credentials:\s*'include'/)
    assert.doesNotMatch(clientSrc, /X-Client-Api-Key|Authorization:\s*`Bearer/i)
    assert.match(clientSrc, /response\.status === 401/)
    assert.match(clientSrc, /Unauthorized to load screenshot\./)
    assert.match(clientSrc, /response\.status === 403/)
    assert.match(clientSrc, /Permission denied to load screenshot\./)
  })

  it('9. Terminal Campaign polling stopped and running polling runs at 5s in LIVE mode', () => {
    assert.equal(RUNNING_POLL_INTERVAL_MS, 5000)
    assert.equal(getCampaignDetailPollIntervalMs('running', 'live'), 5000)
    assert.equal(getCampaignDetailPollIntervalMs('completed', 'live'), null)
    assert.equal(getCampaignDetailPollIntervalMs('cancelled', 'live'), null)
    assert.equal(getCampaignDetailPollIntervalMs('paused', 'live'), null)
    assert.equal(getCampaignDetailPollIntervalMs('draft', 'live'), null)
    assert.equal(getCampaignDetailPollIntervalMs('running', 'mock'), null)

    assert.equal(isTerminalCampaignStatus('completed'), true)
    assert.equal(isTerminalCampaignStatus('cancelled'), true)
    assert.equal(isTerminalCampaignStatus('running'), false)
  })

  it('10. Pause, Resume, Cancel, and Delete actions remain intact', () => {
    const hookSrc = readFileSync(
      resolve('src/features/campaigns/use-campaigns.ts'),
      'utf8',
    )
    assert.match(hookSrc, /const pauseCampaign = useCallback/)
    assert.match(hookSrc, /const resumeCampaign = useCallback/)
    assert.match(hookSrc, /const cancelCampaign = useCallback/)
    assert.match(hookSrc, /const deleteCampaign = useCallback/)
    assert.equal(canDeleteCampaign({ status: 'cancelled' }), true)
    assert.equal(canDeleteCampaign({ status: 'running' }), false)
  })
})
