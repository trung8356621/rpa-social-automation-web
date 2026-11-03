/** Explicit mock marker — not live API data. */
export const MOCK_BANNER =
  'MOCK DATA — local only. No live API. Demos: ?sessionRole=staff|owner|admin · ?demo=empty|error · Staff Conn ?staffConn=connected|error'

/** Shown when VITE_RPA_API_MODE=live — staff session menus (incl. Clients browsers). */
export const LIVE_BANNER =
  'LIVE MODE — Session bootstrap role + Action Tags / Scripts / Accounts / Clients / Keys / Campaigns (scaffold) / Staff Client Connection (session + CSRF). No Electron Client API Key in browser. Production Campaign mutations not activated.'
