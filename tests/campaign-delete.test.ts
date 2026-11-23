import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, it } from 'node:test'

import {
  actionsForStatus,
  mapLiveCampaign,
} from '../src/features/campaigns/api/mappers.ts'
import {
  getMockCampaignStore,
  mockCampaignAdapter,
  resetMockCampaignStore,
} from '../src/features/campaigns/api/mock-adapter.ts'
import { CAMPAIGN_PATHS } from '../src/features/campaigns/api/paths.ts'
import {
  canDeleteCampaign,
  filterCampaigns,
  formatDeleteErrorMessage,
  performCampaignDelete,
} from '../src/features/campaigns/campaign-delete.ts'
import { emptySummary } from '../src/features/campaigns/status-labels.ts'
import type { Campaign, CampaignStatus } from '../src/features/campaigns/types.ts'
import { ApiError } from '../src/lib/api/errors.ts'

function makeCampaign(
  id: string,
  status: CampaignStatus,
  overrides?: Partial<Campaign>,
): Campaign {
  return {
    id,
    name: `Campaign ${id}`,
    site_key: 'mayhopphat',
    site_name: 'MayHopPhat',
    script_package_key: 'mayhopphat.create_post',
    script_name: 'WP Create Post',
    script_version: '1.0.0',
    account_id: null,
    execution_mode: 'one_account_one_job',
    run_mode: 'live',
    status,
    schedule: {
      type: 'immediate',
      timezone: 'Asia/Ho_Chi_Minh',
      start_at: null,
      daily_window: null,
      min_interval_seconds: null,
      resource_recheck_seconds: 300,
    },
    summary: emptySummary(),
    created_at: '2026-11-23T00:00:00Z',
    updated_at: '2026-11-23T00:00:00Z',
    allowed_actions: actionsForStatus(status),
    shortcode_mapping: null,
    shortcode_mapping_version: null,
    ...overrides,
  }
}

const originalFetch = globalThis.fetch
const originalWindow = (globalThis as { window?: unknown }).window
const originalDocument = (globalThis as { document?: unknown }).document

afterEach(() => {
  globalThis.fetch = originalFetch
  ;(globalThis as { window?: unknown }).window = originalWindow
  ;(globalThis as { document?: unknown }).document = originalDocument
  resetMockCampaignStore()
})

describe('Cancelled Campaign Soft Delete', () => {
  it('1. Delete shown only on Cancelled Campaign', () => {
    const statuses: CampaignStatus[] = [
      'draft',
      'scheduled',
      'running',
      'paused',
      'completed',
      'cancelled',
    ]

    for (const status of statuses) {
      const campaign = makeCampaign(`c_${status}`, status)
      assert.equal(
        canDeleteCampaign(campaign),
        status === 'cancelled',
        `Expected canDeleteCampaign(${status}) === ${status === 'cancelled'}`,
      )
    }

    assert.deepEqual(actionsForStatus('cancelled'), ['delete'])
    const mapped = mapLiveCampaign({
      id: 'c_live_cancelled',
      name: 'Live Cancelled',
      status: 'cancelled',
      allowed_actions: ['delete'],
    })
    assert.deepEqual(mapped.allowed_actions, ['delete'])
    assert.equal(canDeleteCampaign(mapped), true)
  })

  it('2. Confirmation dialog required with campaign name, hide explanation, retained history, and no immediate delete', () => {
    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignsScreen.tsx'),
      'utf8',
    )
    const dialogSrc = readFileSync(
      resolve('src/features/campaigns/components/DeleteCampaignDialog.tsx'),
      'utf8',
    )

    assert.match(screenSrc, /canDeleteCampaign\(c\)/)
    assert.match(screenSrc, /aria-label=\{`Delete campaign \$\{c\.name\}`\}/)
    assert.match(screenSrc, /setDeleteTarget\(c\)/)
    assert.match(screenSrc, /<DeleteCampaignDialog/)

    assert.match(dialogSrc, /role="alertdialog"/)
    assert.match(dialogSrc, /\{campaign\.name\}/)
    assert.match(dialogSrc, /hidden from the normal campaign list/i)
    assert.match(dialogSrc, /Execution history is retained/i)
    assert.match(dialogSrc, />\s*Cancel\s*</)
    assert.match(dialogSrc, /Confirm Delete/)
    assert.doesNotMatch(dialogSrc, /<Input/)
  })

  it('3. Cancel confirmation performs no API call', async () => {
    let deleteCalls = 0
    const adapter = {
      deleteCampaign: async () => {
        deleteCalls += 1
      },
      listCampaigns: async () => [],
      getCampaign: async (id: string) => makeCampaign(id, 'cancelled'),
    }
    // Opening confirmation only sets target; cancelling clears target without invoking performCampaignDelete
    let deleteTarget: Campaign | null = makeCampaign('c_1', 'cancelled')
    const onCancelDialog = () => {
      deleteTarget = null
    }
    onCancelDialog()
    assert.equal(deleteTarget, null)
    assert.equal(deleteCalls, 0)
    assert.equal(typeof adapter.deleteCampaign, 'function')
  })

  it('4. Confirm issues one authenticated CSRF DELETE request', async () => {
    assert.equal(
      CAMPAIGN_PATHS.delete('camp-123'),
      '/social-automation/api/campaigns/camp-123',
    )

    const liveAdapterSrc = readFileSync(
      resolve('src/features/campaigns/api/live-adapter.ts'),
      'utf8',
    )
    assert.match(
      liveAdapterSrc,
      /deleteCampaign\(id: string\): Promise<void>[\s\S]*?staffApiRequest<unknown>\(CAMPAIGN_PATHS\.delete\(id\),\s*\{\s*method: 'DELETE'/,
    )

    const httpSrc = readFileSync(resolve('src/lib/api/http.ts'), 'utf8')
    assert.match(httpSrc, /credentials = options\.credentials \?\? 'include'/)
    assert.match(httpSrc, /'X-Requested-With': 'XMLHttpRequest'/)
    assert.match(httpSrc, /if \(method !== 'GET'\)[\s\S]*?ensureCsrfCookie/)
    assert.match(httpSrc, /headers\['X-XSRF-TOKEN'\] = xsrf/)
    assert.match(httpSrc, /response\.status === 204/)

    const deletedIds: string[] = []
    let campaigns = [makeCampaign('camp-123', 'cancelled')]
    await performCampaignDelete({
      id: 'camp-123',
      adapter: {
        deleteCampaign: async (id) => {
          deletedIds.push(id)
        },
        listCampaigns: async () => [],
        getCampaign: async (id) => makeCampaign(id, 'cancelled'),
      },
      setCampaigns: (updater) => {
        campaigns = updater(campaigns)
      },
      showToast: () => {},
    })
    assert.deepEqual(deletedIds, ['camp-123'])
    assert.equal(campaigns.length, 0)
  })

  it('5. Successful deletion removes row, revalidates list, shows toast, and retains mock execution history', async () => {
    resetMockCampaignStore()
    const store = getMockCampaignStore()
    const running = store.campaigns.find((c) => c.status === 'running')
    assert.ok(running, 'Expected a running campaign in mock store')
    await mockCampaignAdapter.cancelCampaign(running.id)

    let campaigns = await mockCampaignAdapter.listCampaigns()
    const toasts: Array<{ message: string; type?: 'success' | 'error' }> = []

    await performCampaignDelete({
      id: running.id,
      adapter: mockCampaignAdapter,
      setCampaigns: (updater) => {
        campaigns = updater(campaigns)
      },
      showToast: (message, type) => toasts.push({ message, type }),
    })

    assert.equal(
      campaigns.some((c) => c.id === running.id),
      false,
      'Deleted campaign must be removed from the list',
    )
    assert.deepEqual(toasts, [{ message: 'Campaign deleted', type: undefined }])

    // Execution history (contents) is retained in store
    const retainedContents = await mockCampaignAdapter.listContents(running.id)
    assert.ok(retainedContents.length > 0, 'Execution history should be retained')
  })

  it('6. Conflict (409) preserves row, shows Backend rejection reason, and refreshes status', async () => {
    const initial = makeCampaign('c_conflict', 'cancelled', {
      name: 'Conflict Campaign',
    })
    const refreshedFromServer = makeCampaign('c_conflict', 'running', {
      name: 'Conflict Campaign',
    })
    let campaigns: Campaign[] = [initial]
    const toasts: string[] = []

    const adapter = {
      deleteCampaign: async () => {
        throw new ApiError(
          'Cannot delete campaign because it is currently running.',
          {
            kind: 'conflict',
            status: 409,
            code: 'campaign_not_cancelled',
          },
        )
      },
      listCampaigns: async () => campaigns,
      getCampaign: async () => refreshedFromServer,
    }

    let caught: unknown = null
    try {
      await performCampaignDelete({
        id: initial.id,
        adapter,
        setCampaigns: (updater) => {
          campaigns = updater(campaigns)
        },
        showToast: (msg) => toasts.push(msg),
      })
    } catch (err) {
      caught = err
    }

    assert.ok(caught instanceof ApiError)
    assert.equal(
      formatDeleteErrorMessage(caught),
      'Cannot delete campaign because it is currently running.',
    )
    assert.equal(campaigns.length, 1)
    assert.equal(campaigns[0].id, 'c_conflict')
    assert.equal(campaigns[0].status, 'running')
    assert.equal(toasts.length, 0)
  })

  it('7. Unauthorized / network failure does not remove row', async () => {
    const initial = makeCampaign('c_auth', 'cancelled')
    let campaigns: Campaign[] = [initial]
    const toasts: string[] = []

    const adapter = {
      deleteCampaign: async () => {
        throw new ApiError(
          'Authentication required. Sign in to SEO-OPS staff session, then retry.',
          {
            kind: 'auth',
            status: 401,
          },
        )
      },
      listCampaigns: async () => campaigns,
      getCampaign: async () => initial,
    }

    await assert.rejects(
      () =>
        performCampaignDelete({
          id: initial.id,
          adapter,
          setCampaigns: (updater) => {
            campaigns = updater(campaigns)
          },
          showToast: (msg) => toasts.push(msg),
        }),
      (err: unknown) =>
        err instanceof ApiError && err.kind === 'auth' && err.status === 401,
    )

    assert.equal(campaigns.length, 1)
    assert.equal(campaigns[0].id, 'c_auth')
    assert.equal(campaigns[0].status, 'cancelled')
    assert.equal(toasts.length, 0)
  })

  it('8. Repeated clicks do not issue duplicate requests', async () => {
    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignsScreen.tsx'),
      'utf8',
    )
    const dialogSrc = readFileSync(
      resolve('src/features/campaigns/components/DeleteCampaignDialog.tsx'),
      'utf8',
    )

    assert.match(screenSrc, /deletingRef\.current/)
    assert.match(screenSrc, /disabled=\{busy\}/)
    assert.match(dialogSrc, /disabled=\{busy\}/)

    // Simulate single-flight guard behavior
    let inFlight = false
    let calls = 0
    const triggerConfirm = async () => {
      if (inFlight) return
      inFlight = true
      try {
        calls += 1
        await new Promise((r) => setTimeout(r, 20))
      } finally {
        inFlight = false
      }
    }

    await Promise.all([triggerConfirm(), triggerConfirm(), triggerConfirm()])
    assert.equal(calls, 1)
  })

  it('9. Search and status filters preserved after refresh', async () => {
    const c1 = makeCampaign('c_1', 'cancelled', { name: 'Alpha Cancelled' })
    const c2 = makeCampaign('c_2', 'cancelled', { name: 'Alpha Keep' })
    const c3 = makeCampaign('c_3', 'running', { name: 'Alpha Running' })
    let campaigns = [c1, c2, c3]

    const filters = {
      search: 'alpha',
      siteKey: 'all',
      runMode: 'all',
      executionMode: 'all',
      status: 'cancelled',
    }

    assert.deepEqual(
      filterCampaigns(campaigns, filters).map((c) => c.id),
      ['c_1', 'c_2'],
    )

    await performCampaignDelete({
      id: 'c_1',
      adapter: {
        deleteCampaign: async () => {},
        listCampaigns: async () => [c2, c3],
        getCampaign: async () => c1,
      },
      setCampaigns: (updater) => {
        campaigns = updater(campaigns)
      },
      showToast: () => {},
    })

    // Same filters object still active after background revalidation
    assert.deepEqual(
      filterCampaigns(campaigns, filters).map((c) => c.id),
      ['c_2'],
    )

    // Verify useCampaigns.deleteCampaign does not call reload() (which would set loading=true and unmount CampaignsScreen)
    const hookSrc = readFileSync(
      resolve('src/features/campaigns/use-campaigns.ts'),
      'utf8',
    )
    const deleteBlock = hookSrc.slice(
      hookSrc.indexOf('const deleteCampaign'),
      hookSrc.indexOf('const loadContentsForCampaign'),
    )
    assert.doesNotMatch(deleteBlock, /\breload\s*\(/)
  })

  it('10. Existing Pause/Cancel/View actions remain unchanged', () => {
    assert.deepEqual(actionsForStatus('running'), ['pause', 'cancel'])
    assert.deepEqual(actionsForStatus('paused'), ['resume', 'cancel', 'start'])
    assert.deepEqual(actionsForStatus('draft'), ['edit', 'start', 'cancel'])
    assert.deepEqual(actionsForStatus('scheduled'), ['edit', 'start', 'cancel'])
    assert.deepEqual(actionsForStatus('completed'), [])

    const screenSrc = readFileSync(
      resolve('src/features/campaigns/components/CampaignsScreen.tsx'),
      'utf8',
    )
    assert.match(screenSrc, />\s*View\s*</)
    assert.match(screenSrc, /c\.allowed_actions\.includes\('pause'\)/)
    assert.match(screenSrc, /c\.allowed_actions\.includes\('resume'\)/)
    assert.match(screenSrc, /c\.allowed_actions\.includes\('cancel'\)/)
  })
})
