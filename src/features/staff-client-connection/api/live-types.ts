/** Verified CP17B.1 / seo-ops-addons-rpa@48b84aa response shapes. */

export type LiveTutorialVideo = {
  available: boolean
  placeholder: boolean
  message: string
}

export type LiveStaffBootstrap = {
  raw_key: string
  key_prefix: string
  expires_at: number
  expires_at_iso: string
  installation_id: string
  purpose: string
  tutorial_video?: LiveTutorialVideo
}

export type LiveStaffConnection = {
  client_api_key_id: number
  key_prefix: string
  key_name: string
  staff_user_id: number | null
  staff_name: string | null
  machine_name: string | null
  agent_uuid: string | null
  connection_status: string
  is_active: boolean
  connected_at: string | null
  disconnected_at: string | null
  last_heartbeat_at: string | null
  installation_id: string
  /** Present on owner inventory rows. */
  connected?: boolean
}

export type LiveStaffClientConnectionResponse = {
  ok: boolean
  endpoint?: string
  connected: boolean
  status: 'connected' | 'not_connected' | string
  bootstrap: LiveStaffBootstrap | null
  connection: LiveStaffConnection | null
  localstorage_key: string
}

export type LiveStaffDisconnectResponse = {
  ok: boolean
  revoked_key_id?: number
  message?: string
  error?: string
}

export type LiveOwnerClientConnectionsResponse = {
  ok: boolean
  connections: LiveStaffConnection[]
  summary?: {
    total: number
    active: number
    disconnected: number
  }
  notes?: string
}
