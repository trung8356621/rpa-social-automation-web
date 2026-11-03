import { getRpaApiMode } from '../../../lib/api/config'

import { liveCampaignAdapter } from './live-adapter'
import { mockCampaignAdapter } from './mock-adapter'

export type CampaignAdapter =
  | typeof mockCampaignAdapter
  | typeof liveCampaignAdapter

export function getCampaignAdapter(): CampaignAdapter {
  return getRpaApiMode() === 'live' ? liveCampaignAdapter : mockCampaignAdapter
}

/** Mock adapter must never issue production network calls. */
export function mockAdapterIsLocalOnly(): boolean {
  return mockCampaignAdapter.mode === 'mock'
}
