import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'

import {
  mapLiveCampaign,
  mapLiveJobAttempt,
} from '../src/features/campaigns/api/mappers.ts'
import { resolveArtifactFetchUrl } from '../src/features/campaigns/campaign-artifacts.ts'
import { createDetailRefreshController } from '../src/features/campaigns/campaign-detail-polling.ts'
import {
  canEditActionTagInterval,
  decomposeIntervalMinutes,
} from '../src/features/campaigns/campaign-interval-edit.ts'
import {
  formatResourceRecheckLabel,
  formatVariantPreferenceLabel,
  resolveSuccessfulAttemptVariantLabel,
} from '../src/features/campaigns/campaign-rules-view.ts'
import {
  canEditCampaignV2,
  validatePausedStep2Plan,
} from '../src/features/campaigns/multi-tag-plan.ts'
import { executionModeLabel } from '../src/features/campaigns/status-labels.ts'

describe('Campaign Rules & Learned VI/EN Variant on Detail Page', () => {
  it('1 & 2. Displays both Execution Mode labels and formats Resource Recheck', () => {
    assert.equal(executionModeLabel('one_account_one_job'), '1 Account : 1 Job')
    assert.equal(executionModeLabel('one_account_many_jobs'), '1 Account : N Job')

    assert.equal(formatResourceRecheckLabel(45), '45 giây')
    assert.equal(formatResourceRecheckLabel(300), '5 phút')
    assert.equal(formatResourceRecheckLabel(3600), '1 giờ')
    assert.equal(formatResourceRecheckLabel(90), '1 phút 30 giây')
    assert.equal(formatResourceRecheckLabel(null), '—')
    assert.equal(formatResourceRecheckLabel(0), '—')

    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, /aria-label="Campaign Rules"/)
    assert.match(screenSrc, /executionModeLabel\(campaign\.execution_mode\)/)
    assert.match(
      screenSrc,
      /formatResourceRecheckLabel\(\s*campaign\.schedule\.resource_recheck_seconds/,
    )
  })

  it('3, 4, 5, 6, 7 & 8. Maps VI, EN, unlearned, multiple Account-scoped preferences, null fields, and source metadata', () => {
    assert.deepEqual(
      formatVariantPreferenceLabel({
        preferred_language_label: 'VI',
        preferred_variant_id: 1,
      }),
      { label: 'VI preferred', variant: 'primary' },
    )
    assert.deepEqual(
      formatVariantPreferenceLabel({
        preferred_language_label: 'EN',
        preferred_variant_id: 2,
      }),
      { label: 'EN preferred', variant: 'primary' },
    )
    assert.deepEqual(
      formatVariantPreferenceLabel({
        preferred_language_label: null,
        preferred_variant_id: null,
      }),
      { label: 'Not learned', variant: 'neutral' },
    )

    const mapped = mapLiveCampaign({
      id: 'camp-rules-1',
      plan_version: 2,
      name: 'Multi Account Learning',
      status: 'running',
      execution_mode: 'one_account_many_jobs',
      schedule: { type: 'immediate', resource_recheck_seconds: 300 },
      action_tags: [
        {
          action_tag_key: 'mayhopphat.create_post',
          site_key: 'mayhopphat',
          script_package_key: 'mayhopphat.create_post',
          script_version: '1.0.0',
          interval_minutes: 60,
          variant_preferences: [
            {
              account_id: 'acc-1',
              account_name: 'Account Alpha',
              preferred_variant_id: 11,
              preferred_language_label: 'VI',
              preferred_release_id: 201,
              preference_source_job_uuid: 'job-uuid-vi-1',
              preference_updated_at: '2026-11-24T12:00:00Z',
            },
            {
              account_id: 'acc-2',
              account_name: 'Account Beta',
              preferred_variant_id: 12,
              preferred_language_label: 'EN',
              preferred_release_id: 202,
              preference_source_job_uuid: 'job-uuid-en-2',
              preference_updated_at: '2026-11-24T12:05:00Z',
            },
            {
              account_id: null,
              account_name: null,
              preferred_variant_id: null,
              preferred_language_label: null,
              preferred_release_id: null,
              preference_source_job_uuid: null,
              preference_updated_at: null,
            },
          ],
        },
      ],
    })

    const prefs = mapped.action_tags?.[0]?.variant_preferences ?? []
    assert.equal(prefs.length, 3)
    assert.equal(prefs[0]?.account_name, 'Account Alpha')
    assert.equal(prefs[0]?.preferred_language_label, 'VI')
    assert.equal(prefs[0]?.preferred_release_id, 201)
    assert.equal(prefs[0]?.preference_source_job_uuid, 'job-uuid-vi-1')
    assert.equal(prefs[1]?.account_name, 'Account Beta')
    assert.equal(prefs[1]?.preferred_language_label, 'EN')
    assert.equal(prefs[2]?.preferred_language_label, null)

    // Missing variant_preferences fails safely
    const minimal = mapLiveCampaign({
      id: 'camp-min',
      plan_version: 2,
      action_tags: [
        {
          action_tag_key: 'sitea.create_post',
          site_key: 'sitea',
          script_package_key: 'sitea.create_post',
          script_version: '1.0.0',
        },
      ],
    })
    assert.equal(minimal.action_tags?.[0]?.variant_preferences, undefined)
  })

  it('9 & 10. Successful Attempt shows actual Variant from metadata; never infers from screenshots or failed/unknown attempts', () => {
    const successWithMeta = mapLiveJobAttempt({
      id: 'att-1',
      status: 'success',
      executed_language_label: 'EN',
      executed_variant_id: 22,
      artifacts: [
        {
          artifact_uuid: 'art-1',
          kind: 'screenshot',
          label: 'shot.png',
          language_label: 'VI', // screenshot metadata alone must not override attempt metadata
        },
      ],
    })
    assert.equal(resolveSuccessfulAttemptVariantLabel(successWithMeta), 'EN')

    // Missing attempt variant metadata -> null even when screenshot exists
    const successNoMeta = mapLiveJobAttempt({
      id: 'att-2',
      status: 'success',
      artifacts: [
        {
          artifact_uuid: 'art-2',
          kind: 'screenshot',
          label: 'shot.png',
          language_label: 'VI',
        },
      ],
    })
    assert.equal(resolveSuccessfulAttemptVariantLabel(successNoMeta), null)

    // Failed/Unknown attempts never show successful variant badge
    const failedAttempt = mapLiveJobAttempt({
      id: 'att-3',
      status: 'failed_locked',
      executed_language_label: 'VI',
    })
    assert.equal(resolveSuccessfulAttemptVariantLabel(failedAttempt), null)

    const unknownAttempt = mapLiveJobAttempt({
      id: 'att-4',
      status: 'unknown',
      executed_language_label: 'EN',
    })
    assert.equal(resolveSuccessfulAttemptVariantLabel(unknownAttempt), null)
  })

  it('11, 12, 13, 14 & 15. Polling updates preference, History/screenshots/Paused Edit/interval editor remain intact', async () => {
    let campaign = mapLiveCampaign({
      id: 'camp-poll',
      plan_version: 2,
      status: 'running',
      action_tags: [
        {
          action_tag_key: 'mayhopphat.create_post',
          site_key: 'mayhopphat',
          script_package_key: 'mayhopphat.create_post',
          script_version: '1.0.0',
          variant_preferences: [],
        },
      ],
    })

    const controller = createDetailRefreshController({
      loadDetail: async () => {
        campaign = mapLiveCampaign({
          id: 'camp-poll',
          plan_version: 2,
          status: 'running',
          action_tags: [
            {
              action_tag_key: 'mayhopphat.create_post',
              site_key: 'mayhopphat',
              script_package_key: 'mayhopphat.create_post',
              script_version: '1.0.0',
              variant_preferences: [
                {
                  account_id: 'acc-1',
                  account_name: 'Account Alpha',
                  preferred_language_label: 'VI',
                  preferred_release_id: 201,
                  preference_source_job_uuid: 'job-1',
                  preference_updated_at: '2026-11-24T12:10:00Z',
                },
              ],
            },
          ],
        })
      },
      loadContents: async () => {},
    })

    await controller.refresh('camp-poll')
    assert.equal(
      campaign.action_tags?.[0]?.variant_preferences?.[0]?.preferred_language_label,
      'VI',
    )

    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignDetailScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, /expandedHistoryIds/)
    assert.match(screenSrc, /AttemptScreenshot/)
    assert.match(screenSrc, /ScreenshotPreviewModal/)
    assert.equal(
      resolveArtifactFetchUrl({
        artifact_uuid: 'art-1',
        has_binary: true,
        download_url: null,
        url: null,
      }),
      '/social-automation/api/campaigns/artifacts/art-1',
    )
    assert.equal(
      canEditCampaignV2({
        status: 'paused',
        plan_version: 2,
        action_tags: [],
      }),
      true,
    )
    assert.equal(
      validatePausedStep2Plan({ executionMode: 'one_account_many_jobs' }).ok,
      true,
    )
    assert.equal(canEditActionTagInterval({ status: 'running' }, true), true)
    assert.deepEqual(decomposeIntervalMinutes(240), {
      value: '4',
      unit: 'hours',
    })
  })
})
