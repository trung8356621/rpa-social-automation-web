RPA SOCIAL AUTOMATION — WEB UI ROUTES & DESIGN LANGUAGE
Cursor handoff • v1.0 • 28/10/2026
STATUS: DESIGN SPECIFICATION — NOT API/RUNTIME VERIFICATION

0. SOURCE OF TRUTH & CONFLICT RULES
1. Business rules and deployment: 01_API_WEB_REALTIME.md, 02_ADDON_BACKEND.md, 03_APP_CLIENT_ELECTRON.md in parent Drive folder.
2. UI tokens and Browser-first rules: RPA_UI_THEME_MANIFEST.md in parent Drive folder. It overrides illustrative colors/layouts in generated mockup images.
3. Existing behavior to preserve: GitHub trung8356621/seo-ops-addons-rpa, notably resources/js/action-tags/{App,ActionTagsScreen,SitesPathsScreen}.tsx, resources/views/filament/pages/scripts.blade.php, agents.blade.php and partials/device-group.blade.php.
4. OpenAPI contract: https://seo-ops.duckdns.org/api/v1/social-automation/openapi.json (auth protected). Repo openapi/openapi.yaml is source evidence, not proof of deploy.
5. Images are VISUAL CONCEPTS, not permission to invent API, fields, menus or user actions. When image disagrees with this specification, follow the text and latest approved business docs.
6. No production mutation based only on UI mockup.

1. APP BOUNDARY
Source: rpa-social-automation-web, React + TypeScript + Vite, CSR.
Use shadcn/ui, Tailwind, Lucide. React source stays separate from Laravel. Production may serve only static build artifacts from SEO-OPS, with Laravel session/auth/CSRF and per-operation authorization. Separate Node WebSocket Gateway relays authorized events but does not own business data.
Do not add standalone user/login/JWT system; Electron Client uses API Key, web UI uses SEO-OPS staff session. Never place Client API Key secret inside browser application state or bundles.
Default UI in development may run with local mocks; live API requires legitimate authorization.

2. DESIGN TOKENS (MUST MATCH MANIFEST)
Light: background #F8FAFC, surface #FFFFFF, surface-muted #F1F5F9, text #0F172A, text-muted #64748B, border #E2E8F0, primary #2563EB, success #16A34A, warning #D97706, danger #DC2626.
Dark: background #0B1220, surface #111B2E, surface-muted #172338, text #E8EEF8, text-muted #94A3B8, border #29364B, primary #3B82F6, success #22C55E, warning #F59E0B, danger #EF4444.
Inter font (system-ui fallback); technical IDs monospace. Spacing 4/8/12/16/24 px; controls radius 6px, cards 10px, padding 12–16px. Compact desktop control center, data-first, no gradients, glass, heavy shadows or nested ornamental cards.
Use one prominent primary action per region. Secondary outline/ghost. Status labels always include text, not color alone. Do not generate charts or metrics without source data. Loading, empty, stale, error, syncing and permission-denied states are distinct.

3. NAVIGATION — APPROVED SCOPE
Five menu entries only for current build: Action Tags, Script Registry, Accounts, Clients, Client API Keys.
No Task, Workflow, Campaign, Scheduler, Jobs, Settings or Dashboard menu by default. Some appear in historical source or concept images; scope NOT approved here.
Proposed client-side route slugs (NOT confirmed Laravel production endpoints):
  /social-automation/action-tags
  /social-automation/scripts
  /social-automation/accounts
  /social-automation/clients
  /social-automation/client-api-keys
Treat them as UI route naming proposal. Confirm mount base, SPA fallback, authorization and actual API path mapping before code/production merge.
Each route owns its page-specific URL query filters, selection and pagination; browser back/forward restores state.

4. ACTION TAGS ROUTE
Goal: preserve existing React mini-app, modernize shell without rewriting its workflows.
Source anchors:
 resources/js/action-tags/App.tsx
 resources/js/action-tags/ActionTagsScreen.tsx
 resources/js/action-tags/SitesPathsScreen.tsx
 resources/js/action-tags/types.ts
 src/Http/Controllers/ActionRegistry/ActionRegistryController.php
Existing behavior: two screens (Tags and Sites/Paths), search, Site/Path/Action filters, Add Tag drawer, Manage Sites & Paths navigation, create/delete Tag, edit/create Site and Path, toast, copy Tag Key, Script Request automatically created when Tag created.
Composition: one header, filter toolbar, compact Tag table with Site | Path | Action | Tag Key | actions. Keep Sites & Paths management within route/subview. Do NOT force a permanent tree sidebar from early V1 image.
API family observed: /social-automation/api/action-registry/data, /sites, /paths, /tags and /tags/{id}/requests. Verify methods/auth/validation in OpenAPI/source.
States: no Sites; Sites but no Tags; no filter results; request error; loading/creating. Preserve site_base_url, url_pattern and path_inputs semantics.

5. SCRIPT REGISTRY ROUTE
Goal: visual Script catalog, NOT CRUD table.
Source: resources/views/filament/pages/scripts.blade.php; src/Filament/Pages/SocialAutomationScriptsPage.php; Script Registry/Package Registry services.
Primary layout: responsive 3-column grid on wide desktop; 2 columns laptop; 1 mobile. Each card has 16:9 video demo thumbnail/placeholder, play affordance, script name or Action Tag, ID/key, active release version/status and selective actions. Grid card uses metadata; no imaginary engagement stats.
Card selection opens detail side panel/drawer with description, releases, publish dates, versions, video player (modal), release notes/variables/steps/assets where contract permits. Missing demo, processing/thumbnail-unavailable, play error and permissions are explicit states. Preserve remove confirmation.
Publish/Sync must map to authorized existing operations; do not infer that every card is publishable. Script identity/version is independent from Task/Workflow.
API family: /api/v1/social-automation/rpa-admin/scripts, active-scripts, scripts/publish, scripts/sync/plan, scripts/video-demo, scripts/asset. Verify exact methods and auth.

6. ACCOUNTS ROUTE
Goal: Account inventory; business identity is Account ID, not display name/username.
Compact searchable/filterable table: Account ID, Account Name, Username, Platform/Site, Browser association (if available), last interaction, explicit status. Primary action only if backend supports it.
A user selects Account from inventory to bind to Browser; Browser gets platform/site from Account. Do not require manual platform/tag selection when creating Browser. Do not display stored password; sensitive fields need secure operation-specific permission.
States: empty inventory, no matching filter, disconnected/stale relationship, auth denied, API error.
Source: resources/views/filament/pages/accounts.blade.php; SocialAutomationAccountManagementController; SaAccount.

7. CLIENT API KEYS ROUTE
Goal: issuance, status, revoke and association of client key identities.
Table: Key ID, label, safe masked representation, lease status, last heartbeat/connection and permitted actions. Secret never revealed again in list; create may present one-time copy if supported. Confirm revoke. User/session auth + operation authorization required.
Crucial invariant: one API Key = one logical Client identity (sa_client_api_keys.id / client_api_key_id), maximum one active lease; concurrent connection returns 409 CLIENT_KEY_IN_USE. Device UUID/hostname does not create separate logical Clients.
Source: resources/views/filament/pages/client-keys.blade.php; RpaClientApiKeyManagementController; ClientConnectionLease; migration 2026_10_28_120000...
Do not implement button 'Release Lease' just because concept image shows it; API and authorization must support it.

8. CLIENTS ROUTE — BROWSER-FIRST (HIGHEST UI PRIORITY)
This route is operational live view; visually emphasize Browser/Account, not PC as an enclosing group. The V2 mockup bottom screenshot uses a large Client detail panel as exploration, but the approved Browser-first manifest takes precedence.
Header: 'Clients' and short context; compact status strip with Client Online, Browser Running, Needs Login and last snapshot time only when API truly supplies counts. Realtime indicator, Refresh button, stale/disconnected warning.
Main content: Browser cards as dominant scan unit, potentially grouped by filter/search, NOT giant PC panels. Each Browser card title = Username. Secondary = Account Name. Small metadata = platform/site and machine/Client tag (e.g., DESKTOP-HJ2LKRD), runtime state, Session Signal (present/absent/unknown), execution confirmation and last run/screenshot. Account ID/Browser ID/partition and technical device fields live in collapsible Technical Details. Only genuinely online Browsers appear in active operations list; offline totals elsewhere.
Client connection detail remains accessible as compact side drawer/panel: logical Client key ID, connection lease state, OS/app version, last heartbeat, connection errors, connected since. Device hostname is metadata only. Do not equate Client Online, Browser Running, Session Signal or dispatch eligibility.
Allowed operational actions must follow source/authorization: Refresh; send notification (Client/Browser/Account context); review session signal; linked account details. Any toggle dispatch, require login, clear signal, force disconnect or release lease must be gated by verified contract and confirmation.
Session signal does not mean verified login, and binding does not mean successful execution. No storage or display of cookie values; if Facebook, only boolean/unknown c_user presence signal is relevant.
Notifications should show delivery/ack status when available, not assume success on click. Last execution status/screenshots are diagnostic, not proof of verified Account.
Existing UI source anchors: resources/views/filament/pages/agents.blade.php, partials/device-group.blade.php, src/Registry/AgentRegistryService.php, ClientNotificationService, OnlineStateCalculator. Treat these as logic/data references, not layout to copy.
Realtime policy: snapshot from Laravel REST is truth, Node socket presence is transient. Reconnect/resync on socket loss. Distinguish stale from offline. Never fabricate automatic disconnect/heartbeat timeout values.
Responsive: 1440 wide card grid, 1280 compact two columns, narrow screen single column and drawer. Long usernames/UUIDs wrap safely.
Important audit: latest approved 28/10 identity/lease supersedes older notes suggesting one key on many active machines.

9. REUSABLE COMPONENT VOCABULARY
AppShell; SidebarNav; PageHeader; FilterBar; StatusBadge; OnlineState; RealtimeStatus; EmptyState; ErrorState; Skeleton; ConfirmationDialog; DetailsDrawer; CopyId; VideoDemoCard; VideoPlayerModal; ScriptReleasePanel; AccountIdentity; BrowserCard; SessionSignal; ClientTag; ClientConnectionDetails; NotificationDialog.
Names express UI intent only, not new backend models/contracts. Keep components modular, route-specific data hooks separate from display primitives.

10. ACCEPTANCE / VISUAL QA
Desktop 1440, laptop 1280, narrow screen; default data, long labels, empty, loading, no sync, stale and error. Card alignment, keyboard focus, modal close, responsive, filtered table and video aspect ratio verified.
A route is NOT done because static mock looks good: compare against source + OpenAPI, test authorization/errors, and verify runtime separately. No production writes from UI design handoff.
Image concept V1: 4-screen board (Action Tags, Script table, Accounts, Keys) — historical reference; Script TABLE is explicitly rejected.
Image concept V2: 3-screen board (Action Tags, Script video grid, Clients) — approved direction, but Clients device-first hierarchy and green accents are superseded by Browser-first and blue token manifest.
No invented extra menu or functionality. Keep backend/React/Realtime/Electron boundaries.

11. IMPLEMENTATION ORDER FOR CURSOR
(1) shared shell/tokens/router skeleton with five approved routes, (2) Action Tags port/reference existing React mini-app, (3) Script grid + demo/media, (4) Accounts, (5) Client API Keys, (6) Browser-first Clients with realtime snapshot reconciliation. Before each route implement one route contract matrix: UI field -> API endpoint/response field -> auth -> error/empty/loading state -> tested status.
Do not delete legacy source/database or change production allowlist during UI build.


