import type {
  LiveStaffBootstrap,
  LiveStaffConnection,
} from './api/live-types'

export type StaffConnectionView =
  | {
      kind: 'not_connected'
      bootstrap: LiveStaffBootstrap
      localstorageKey: string
    }
  | {
      kind: 'connected'
      connection: LiveStaffConnection
      localstorageKey: string
    }

export type OwnerConnectionRow = LiveStaffConnection

export type StaffConnectionDemo =
  | 'default'
  | 'connected'
  | 'loading'
  | 'error'
  | 'empty'
