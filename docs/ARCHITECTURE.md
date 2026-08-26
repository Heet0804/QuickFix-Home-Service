# Architecture Document
## QuickFix — On-Demand Home Services Marketplace

| Field | Detail |
|---|---|
| Document Type | Software Architecture Document |
| Basis | Direct inspection of all attached source files (`landing.html`, `auth.html`, `index.html`, `worker-dashboard.html`, `worker-profile.html`, `admin.html`, and every `js/*` file: `landing.js`, `auth.js`, `index.js`, `dashboard.js`, `profile.js`, `admin.js`, `supabase.js`, `config.js`, `utils.js`, `toast.js`, `maps.js`, `nav.js`), cross-referenced against `docs/PRD.md` (v1.2) and `docs/SRS.md` |
| Convention | Every architectural claim is derived from a specific file, script-tag ordering, or function named in parentheses. No target-state or planned architecture is presented as current unless explicitly marked as a Future Enhancement (see SRS §9 / PRD §21, §24). |

---

## 1. Introduction

### 1.1 Purpose
This document describes the architecture of QuickFix strictly as implemented in the attached source files. It exists to give engineering and architecture stakeholders a structural view of the system — how pages, scripts, and external services are wired together — complementing `PRD.md` (product intent) and `SRS.md` (functional/behavioral specification). Where the codebase's own comments describe an architectural decision (for example, the Phase 5.3.x consolidation comments in `js/common/*.js`), this document treats those comments as authoritative evidence of intent, not as unverified narrative.

### 1.2 Scope
This document covers: the overall system shape, the frontend module structure, the backend access pattern (Supabase-only, no application server), every external service dependency, the on-disk folder structure as evidenced by `<script src>` / `<link href>` paths, the shared-module load order and the reasoning behind it, and dedicated architectural walkthroughs for the customer, worker, admin, tracking, booking, and QuickCoins subsystems, followed by security, scalability, and design-decision analysis.

This document does **not** cover: database schema internals (RPC bodies for `get_worker_stats`/`get_worker_stats_bulk` are not part of the inspected client code — see SRS §2.6 Assumptions), CSS/visual design, or any Phase 5/6/7 roadmap architecture, which is out of scope per SRS §9 and PRD §21/§24.

---

## 2. High-Level Architecture

QuickFix is a **client-heavy, backend-as-a-service** architecture. There is no custom application server or API layer written for this project — every page is a static HTML file loading plain (non-module) `<script>` tags, and the sole backend is Supabase, accessed directly from the browser via `@supabase/supabase-js@2` (loaded from a CDN in every page's `<head>`).

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser (Client)                      │
│                                                                │
│  landing.html   auth.html   index.html   worker-dashboard.html│
│  worker-profile.html          admin.html                      │
│         │             │            │              │           │
│         └─────────────┴────────────┴──────────────┘           │
│                    js/common/*.js (shared)                    │
│                                                                │
└───────────────────────────┬────────────────────────────────────┘
                             │  @supabase/supabase-js@2 (CDN)
                             ▼
                 ┌───────────────────────────┐
                 │  Supabase (BaaS)          │
                 │  - Auth                   │
                 │  - Postgres (CRUD + RLS)  │
                 │  - Storage (2 buckets)    │
                 │  - RPC (12+ functions)    │
                 │  - Realtime (postgres_changes) │
                 └───────────────────────────┘
                             │
         ┌───────────────────┼──────────────────────┐
         ▼                   ▼                      ▼
  Geoapify Routing /   Nominatim (OSM)        Leaflet.js + OSM tiles
  Reverse Geocoding    (forward geocoding)    (map rendering, CDN)
  (client_location: maps.js)  (index.js)
```

There is no bundler, transpiler, or build step. Every shared and page-specific script is a plain classic script (no `type="module"`, no `import`/`export`); cross-file communication happens exclusively through shared global-scope identifiers (`window.sb`, `window.CONFIG`, top-level `function` declarations such as `showToast`, `markErr`, `_fetchRoadRoute`).

---

## 3. Frontend Architecture

QuickFix has **six independent HTML entry points**, each a self-contained page rather than a client-side-routed single-page application:

| Page | File | Role |
|---|---|---|
| Landing | `landing.html` | Public marketing/entry page, role-aware CTA |
| Authentication | `auth.html` | Unified login/signup for customer and worker roles |
| Customer App | `index.html` | Booking, tracking, wallet, offers, reviews |
| Worker Dashboard | `worker-dashboard.html` | Job management, tracking, earnings, achievements |
| Worker Profile | `worker-profile.html` | Profile editing, stats mirror, badges |
| Admin Portal | `admin.html` | Campaign CRUD, pass oversight, analytics |

Navigation between pages is a full browser page load (`window.location.href = '...'`), not client-side routing — confirmed by every redirect call inspected (e.g. `landing.js`'s `dash.href=role==='worker'?'worker-dashboard.html':'index.html'`; `admin.html`'s inline `onclick="window.location.href='landing.html'"`).

Each page composes its behavior from two script tiers:
1. **Shared (`js/common/*.js`)** — cross-page infrastructure: Supabase client, shared constants, generic utilities, toast notifications, map/routing helpers, mobile-nav toggle.
2. **Page-specific (`js/<role>/<page>.js`)** — the business logic for that single page only.

No page includes the full set of shared modules; each includes only the subset it needs (see Section 6, Folder Structure, and Section 7, Module Dependency Flow, for the exact per-page inclusion lists, verified from each HTML file's closing `<script>` tags).

---

## 4. Backend Architecture

There is no custom backend service in this codebase. All persistence, authentication, and file storage go through **Supabase**, instantiated once in `js/common/supabase.js`:

```js
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});
```

Every other script accesses this single client via the bare global identifier `sb`.

Backend responsibilities, as actually exercised by the client:

| Responsibility | Mechanism | Evidence |
|---|---|---|
| Authentication | `sb.auth.signUp`, `sb.auth.signInWithPassword`, `sb.auth.getSession`, `sb.auth.resetPasswordForEmail` | `auth.js` |
| Data persistence (CRUD) | `sb.from('<table>').select/insert/update/delete/upsert` | `index.js`, `dashboard.js`, `profile.js`, `admin.js`, `auth.js` |
| File storage | Supabase Storage, buckets `worker-documents` and `worker-photos` | `auth.js` (worker signup only) |
| Read-only aggregation | Two Postgres RPCs: `get_worker_stats(p_worker_id)`, `get_worker_stats_bulk(p_worker_ids)` | `dashboard.js`, `profile.js`, `index.js` |
| Server-authoritative writes | At least 8 further RPCs — `create_booking`, `accept_booking`, `get_available_jobs`, `verify_arrival_otp`/`verify_arrival_otp_customer`, `verify_completion_otp`/`verify_completion_otp_customer`, `activate_pass`, `award_quickcoins`, `consume_pass_visit` — each call site carries its own "Phase 6.4" code comment | `index.js`, `dashboard.js` |
| Push-style sync | Supabase Realtime `postgres_changes` channel | `dashboard.js` only (see Section 11) |

**Correction: no longer accurate.** Booking creation, acceptance, both OTP verifications, Service Pass activation, QuickCoins crediting, and pass-visit consumption now go through the server-authoritative RPCs above — e.g. `activatePass()`'s own comment states "the client no longer decides visit counts, validity, or perks... `campaign.id` is the only client-supplied value trusted," and `awardQuickCoins()` passes only `p_booking_id`, no client-computed coin amount. Only **worker-assignment eligibility** and the **pre-submission price display** remain purely client-computed; `create_booking`'s own comment states price is re-validated server-side. RPC bodies are not part of the inspected source and remain out of scope, consistent with SRS §2.6.

---

## 5. External Services

| Service | Purpose | Client Location | Notes |
|---|---|---|---|
| Supabase (`@supabase/supabase-js@2`, CDN) | Auth, Postgres CRUD, Storage, RPC, Realtime | `supabase.js`, used throughout | Single client instance, `window.sb` |
| Geoapify Routing API | Road-following route between worker and customer | `maps.js: _fetchRoadRoute` | Key embedded as a plaintext client-side constant (`config.js: CONFIG.GEOAPIFY_API_KEY`) |
| Geoapify Reverse Geocoding API | Pinned coordinate → building/society name | `maps.js: _geoapifyReverseGeocode` | Same API key |
| Nominatim (OpenStreetMap) | Forward geocoding + locality extraction for address validation | `index.js: geocodeAddress` | No API key required |
| Leaflet.js 1.9.4 + OpenStreetMap tiles (CDN) | All map rendering (pin picker, tracking maps) | `index.js`, `dashboard.js` | CSS + JS both loaded from `unpkg.com` |
| `qrcodejs` 1.0.0 (CDN, lazy-loaded) | UPI QR code rendering | `index.js: drawQR`, `drawPassQR` | Loaded on first QR render only, falls back to a clickable link if load fails |
| Browser Geolocation API (`navigator.geolocation`) | `watchPosition` (worker, continuous), `getCurrentPosition` (customer, one-shot) | `dashboard.js`, `index.js` | No server-side/SMS location fallback |
| Google Fonts (CDN) | `Sora`, `DM Sans` typefaces | All pages' `<head>` | Presentation only |

**Note on real-time sync.** PRD.md §22 and §22A.1 attribute "Notifications / Real-time Sync" to Firebase Realtime Database. No reference to Firebase exists anywhere in the inspected codebase. The verified mechanism is a Supabase Realtime `postgres_changes` channel subscription, present only in `dashboard.js` (see Section 11). This PRD/code discrepancy is documented in `SRS.md` §2.5 and §6 and is repeated here for architectural completeness; it is not resolved by this document.

No other external service (payment gateway, SMS provider, push-notification service, CI/CD, CDN for custom assets) is present in the inspected codebase.

---

## 6. Folder Structure

The folder structure below is reconstructed entirely from `<script src>` and `<link href>` paths observed in each HTML file's source. No repository directory listing was supplied; this is the structure implied by the paths actually referenced.

```
/
├── landing.html
├── auth.html
├── index.html
├── worker-dashboard.html
├── worker-profile.html
├── admin.html
│
├── css/
│   ├── landing/landing.css
│   ├── auth/auth.css
│   ├── customer/index.css
│   ├── worker/dashboard.css
│   └── admin/admin.css
│
└── js/
    ├── common/
    │   ├── supabase.js
    │   ├── config.js
    │   ├── utils.js
    │   ├── toast.js
    │   ├── maps.js
    │   └── nav.js
    ├── landing/
    │   └── landing.js
    ├── auth/
    │   └── auth.js
    ├── customer/
    │   └── index.js
    ├── worker/
    │   ├── dashboard.js
    │   └── profile.js
    └── admin/
        └── admin.js
```

**Verified exception.** `worker-profile.html` has no corresponding `css/worker/profile.css` reference; its styling is embedded as an inline `<style>` block directly in the page's `<head>`, unlike every other page, which links an external stylesheet under `css/<role>/<page>.css`. This is a genuine structural inconsistency in the current codebase, not an omission in this document.

Each page's actual shared-module inclusion (verified from each file's closing `<script>` tags) is narrower than the full `js/common/` set:

| Page | Shared modules included (in this order) | Page script |
|---|---|---|
| `landing.html` | `supabase.js` | `landing.js` |
| `auth.html` | `supabase.js`, `utils.js`, `toast.js` | `auth.js` |
| `index.html` | `supabase.js`, `config.js`, `utils.js`, `toast.js`, `maps.js` | `customer/index.js` |
| `worker-dashboard.html` | `supabase.js`, `config.js`, `utils.js`, `toast.js`, `maps.js`, `nav.js` | `worker/dashboard.js` |
| `worker-profile.html` | `supabase.js`, `config.js`, `utils.js`, `toast.js`, `nav.js` | `worker/profile.js` |
| `admin.html` | `supabase.js`, `utils.js` | `admin/admin.js` |

`index.html` never includes `nav.js` — its own script defines an independent `toggleMenu()` operating on different DOM ids (`#navLinks`), a fact `nav.js`'s own header comment states explicitly. `worker-profile.html` never includes `maps.js`, since the profile page performs no tracking or routing.

---

## 7. Module Dependency Flow

Across every page that includes the full common-module set (`worker-dashboard.html` is the only page that does), the load order is:

```
supabase.js
   ↓
config.js
   ↓
utils.js
   ↓
toast.js
   ↓
maps.js
   ↓
nav.js
   ↓
page script (e.g. dashboard.js)
```

Pages that need only a subset of shared modules (see the table in Section 6) still load them in this same relative order — no page reorders two shared modules relative to each other; a page simply omits the modules it does not need.

**Why this order exists, verified against each file's own header comments and actual runtime dependencies:**

1. **`supabase.js` first.** It declares `window.sb`, the single Supabase client instance. Every later script — shared or page-specific — refers to `sb` as a bare global identifier with no existence check, so it must be defined before anything else runs. `supabase.js`'s own header comment states it "must be loaded via a `<script>` tag BEFORE each page's own JS file."

2. **`config.js` second.** It declares `window.CONFIG` (`GEOAPIFY_API_KEY`, `RELIABILITY_MIN_ACCEPTED_JOBS`, `TRACKING_ZOOM`) as plain values with no Supabase calls, so its position relative to `supabase.js` is not load-bearing — but `maps.js` (loaded later) reads `CONFIG.GEOAPIFY_API_KEY` at call time, and `dashboard.js`/`profile.js` read `CONFIG.RELIABILITY_MIN_ACCEPTED_JOBS`, so `config.js` must precede both `maps.js` and the page scripts. `config.js`'s own comment confirms: "Load order relative to supabase.js does not matter — this file only declares plain values."

3. **`utils.js` third.** It declares generic, page-agnostic helpers (`markErr`, `closeModal`, `getIST`, `_fmtDate`, `escHtml`) with no dependency on `CONFIG` or `sb`. It is positioned before `toast.js` and the page scripts because `auth.js` and other page scripts call `markErr()` directly, and `utils.js`'s own header states it is "Loaded BEFORE any page-specific script."

4. **`toast.js` fourth.** It declares `showToast()`, which was moved out of `utils.js` in a later phase (per its own header: "Phase 5.3.5... previously lived in js/common/utils.js"). It must load before any page script or shared module that calls `showToast()` — which includes `auth.js`, `index.js`, `dashboard.js`, and `profile.js` per its own comment ("Not required by admin.js or landing.js — neither uses a toast").

5. **`maps.js` fifth.** It declares the Geoapify/Leaflet helper functions and depends on `CONFIG.GEOAPIFY_API_KEY` (from `config.js`, already loaded) at call time; its own header states: "Requires CONFIG (js/common/config.js) to be loaded first." It must precede the page script, since `dashboard.js` calls its "`W`-suffixed" aliases (`_fetchRoadRouteW`, etc.) directly.

6. **`nav.js` sixth.** It both declares `toggleMenu()` and immediately executes a `document.querySelectorAll('#navRight a, #navRight button').forEach(...)` at parse time — meaning the `#navRight`/`#navOverlay` DOM elements must already exist in the page body above this script tag (which they do, since scripts are placed at the end of `<body>`) but the function itself has no dependency on `CONFIG`, `sb`, or any other shared module. It is positioned last among shared modules, immediately before the page script, because the page script (`dashboard.js`) is the first script to actually invoke `toggleMenu()` from an `onclick` handler defined earlier in the same HTML file.

7. **Page script last.** Each page's own script (`landing.js`, `auth.js`, `index.js`, `dashboard.js`, `profile.js`, `admin.js`) is loaded last because it is the only script that both depends on every shared identifier it uses and performs the page's actual boot sequence (session checks, initial data fetches, event wiring) — none of the shared modules read anything the page script defines, so the dependency direction is strictly one-way, shared → page-specific, never the reverse.

---

## 8. Customer Architecture

`index.html` + `js/customer/index.js`, with shared modules `supabase.js`, `config.js`, `utils.js`, `toast.js`, `maps.js`.

- **Boot sequence.** An IIFE checks `sb.auth.getSession()`; absence of a session redirects to `auth.html`.
- **Service discovery.** A fixed, hardcoded category/sub-category catalog (`CATS`, `HH_SECTIONS`, `MW_SECTIONS`, `CAT_SECTIONS`) drives the home page and services grid; emergency-hours logic (`isEmerg()`) filters this catalog down to `EROLES = ['Electrician','Plumber']` during the 20:30–08:30 IST window.
- **Booking pipeline.** `initiateBooking()` → `getEligibleWorkersForArea()` (Haversine distance from the selected area's coordinates, not the customer's exact pin) → `cleanAddressForGeocoding()` → `geocodeAddress()` (Nominatim) → `addressMatchesArea()` → `_resolveCustomerPin()` (Leaflet draggable-marker picker or saved-pin reuse) → price calculation → `_continueAfterPin()` (payment modal or direct-to-broadcast for pass-covered bookings).
- **Own local-storage fallback.** `DB.save`/`DB.bookings`/`DB.update` branch to a `localStorage`-backed store (`qf_bookings`) only when no Supabase session exists — a path the page's own boot IIFE makes unreachable in normal operation, since an unauthenticated visitor is redirected away before this code can run.
- **Own mobile nav.** `index.js` implements its own `toggleMenu()`-equivalent logic operating on `#navLinks`, independent of `nav.js`.
- **Sync strategy.** No Supabase Realtime channel subscription exists in `index.js` (verified: no `channel(`/`postgres_changes` occurrence). Booking-list freshness relies on interval-based polling, mirrored by the "FALLBACK SYNC" comment inside `dashboard.js` referencing `index.html`'s polling behavior.

---

## 9. Worker Architecture

`worker-dashboard.html` + `js/worker/dashboard.js` (job management), and `worker-profile.html` + `js/worker/profile.js` (profile view/edit), sharing `supabase.js`, `config.js`, `utils.js`, `toast.js`, `nav.js` (both pages), plus `maps.js` (dashboard only).

- **Session guard.** A dual-signal check: `sessionStorage.qf_user` + `qf_role==='worker'`, plus a live re-fetch of the worker's `workers` row; failure on either redirects to `auth.html?role=worker`.
- **Job lifecycle.** Pending → Accepted → Arrived → Completed/Cancelled tabs. `confirmAccept()` re-reads the booking's live `status` immediately before writing and guards the update itself with `.in('status', [...])` to prevent a two-worker race; accepting a job auto-sets `is_available:false` via `setWorkerAvailability(false)`; completing a job auto-sets it back to `true`.
- **Realtime sync.** A Supabase Realtime channel, `sb.channel('worker-bookings-'+W.id).on('postgres_changes', {event:'*', schema:'public', table:'bookings', filter:'worker_id=eq.'+W.id}, async()=>{await loadBookings();}).subscribe()`, drives live updates to the worker's own bookings, backed by a 5-second polling fallback on the same page (the code's own comment: "`postgres_changes` only fires on row-level INSERT/UPDATE/DELETE... during dev testing the realtime event can simply never arrive").
- **Analytics.** Earnings (today/week/month), acceptance rate, rank badge (Unranked/Bronze/Silver/Gold on `worker_score`), reliability pill, and cancellation-warning banner are all computed client-side from the live `bookings` array plus the `Stats` object returned by `get_worker_stats`.
- **Achievement engine.** `checkAndUnlockAchievements()` runs on every `loadBookings()` cycle, tests `stats.completed_jobs >= gate AND a.test(stats)` against the `ACHIEVEMENTS` catalog, and inserts unlock rows into `worker_achievements`, silently ignoring 23505 unique-violation errors from concurrent realtime triggers.
- **Profile page separation.** `profile.js` never evaluates achievements itself; it only displays what `dashboard.js` has already persisted, and does not include `maps.js` at all, consistent with having no tracking responsibility.

---

## 10. Admin Architecture

`admin.html` + `js/admin/admin.js`, with only `supabase.js` and `utils.js` shared (no `config.js`, `toast.js`, `maps.js`, or `nav.js`).

- **Auth gate.** `checkAdminRole(email)` queries `admins.is_active` for the signed-in email. Any falsy result signs the session out (`sb.auth.signOut()`) and shows "Access Denied" for 10 seconds before the login form reappears — the user is never redirected elsewhere, a deliberate choice per the page's own inline comment ("avoids surprising a logged-in user by bouncing them elsewhere").
- **Campaign CRUD.** `publishCampaign()` validates title/service/price≥0/visits≥1/validity≥1/start<end before insert or update into `campaigns`.
- **Analytics.** `renderAnalytics()` computes total campaigns, total passes sold, active/expired counts, and per-campaign revenue **entirely client-side** from already-loaded `_allCampaigns`/`_allPasses` arrays — there is no dedicated analytics RPC or server-side aggregation.
- **Own nav toggle.** `admin.js: toggleAdminNav()` is a fourth, independent mobile-nav implementation, distinct from `nav.js`, `index.js`'s own toggle, and `landing.js`'s own toggle.
- **No toast/maps dependency.** Consistent with `toast.js`'s own comment that neither `admin.js` nor `landing.js` uses the shared toast system; `admin.js` uses `alert()`/`confirm()` for its own error/delete-confirmation flows instead.

---

## 11. Tracking Architecture

Implemented in parallel on the customer side (`index.js`) and worker side (`dashboard.js`), sharing routing/formatting logic through `maps.js` via a same-object aliasing pattern rather than duplicated code:

- **Aliasing.** Six functions (`_geoapifyReverseGeocode`, `_fetchRoadRoute`, `_fmtDistance`, `_fmtDuration`, `_metersBetween`, `_animateMarkerTo`) are defined once under their canonical names; six more constants (`_geoapifyReverseGeocodeW`, etc.) are declared as direct references to the same function objects, so `dashboard.js` can call the "W"-suffixed names it was already written against without any renaming and without duplicating logic. `maps.js`'s own header explains this was the only way to satisfy "do not rename existing call sites" while still sharing one implementation.
- **GPS publishing.** `dashboard.js: _startGPS`/`syncGPS` runs a single `watchPosition` handle, active only while the worker has a booking in `['Accepted','Worker on Way','Arrived']`; permission denial stops the watcher and shows a toast; other errors retry after 5 seconds (`_scheduleGPSRetry()`). GPS writes are batched across all of a worker's active booking IDs into a single `.in('id', activeIds)` update per position fix.
- **Map lifecycle.** Each tracking map is built exactly once per booking (`_buildTrackingMap`/`_buildCustomerTrackMap`), calls `fitBounds()` exactly once at creation, and thereafter only moves the marker (`_animateMarkerTo`, eased `requestAnimationFrame`) and updates the route polyline in place — the map and route layer are never recreated mid-tracking.
- **Routing throttling.** `_fetchRoadRoute` is called at most once per 8 seconds per booking, and additionally skipped if the worker has moved less than 10 meters since the last successful fetch (`_metersBetween`). A failed fetch returns `null`, and the caller explicitly keeps the previous polyline — no straight-line or dashed fallback is ever drawn.
- **Destination resolution.** Prefers the booking's own `customer_lat`/`customer_lng` (captured at booking time), falling back to the selected area's centroid.
- **Advance-booking lock.** For non-emergency bookings more than 10 minutes out, the tracking map and worker identity are locked behind a placeholder until 10 minutes before the scheduled time (`shouldReveal()`).

---

## 12. Booking Architecture

- **Lifecycle states.** `Pending` → `Accepted` → `Arrived` → `Completed`, with `Rejected` and `Cancelled` as terminal side-branches. Both a customer-facing `status` and a worker-facing `w_status` column exist on `bookings` and can diverge (e.g. `status='Pending'` with no `w_status` yet).
- **Assignment.** `getEligibleWorkersForArea()` filters the already `is_available=true`, skill-matched worker pool by Haversine distance from the **selected area's coordinates** (not the customer's exact pin) to each worker's stored `lat/lng`, requiring `distance <= worker.radius AND distance <= MAX_ASSIGN_KM (10 km)`, sorted nearest-first with a >0.5 km "clearly nearer wins" tie-break, falling back to `worker_score`.
- **Race protection — correction.** Race guarding for acceptance and both OTP verifications now runs inside the server-side RPCs (`accept_booking`, `verify_arrival_otp`/`_customer`, `verify_completion_otp`/`_customer`), which take only `p_booking_id`/`p_entered_otp` — no client-issued status guard. `confirmCancelAccepted()` (worker) and `cancelBk()` (customer) remain direct, `.eq()`-guarded client writes. `confirmReject()` is not a database write at all — see the booking-architecture note below.
- **Dual OTP paths.** Two independently coded verification implementations exist for the same lifecycle transitions: `index.js` (`triggerOtp`/`verifyOtp`, customer-invoked) and `dashboard.js` (`submitArrivalOtp`/`submitCompletionOtp`, worker-invoked). They differ in side effects — only the worker-dashboard path nulls the verified OTP field and toggles `is_available`.
- **Payment.** Two methods for a booking (`selectPay('gpay'|'cash')`); GPay is a simulated flow (`checkPayStatus()` auto-succeeds after 3 polling ticks); Cash proceeds straight to broadcast, with work withheld until Arrival OTP success.
- **Client-only enforcement — correction.** No longer accurate for booking creation or OTP transitions: `create_booking` and the four OTP-verification RPCs are the actual write path. Worker-assignment eligibility and the pre-submission price display remain client-computed.

---

## 13. QuickCoins Architecture

- **Trigger.** Client-observed, one-shot crediting the moment a booking transitions from `Arrived` to `Completed` while the customer app is open (`checkQuickCoinsRewards`, driven by `renderBookings()` polling — not a push event).
- **Baseline pattern.** Two in-memory, per-page-load-only structures — `qcLastStatus` (last observed status per booking) and `qcRewardedIds` (already-rewarded ids this session) — ensure the **first** time a booking is seen in a session, its status is recorded as a baseline only and never rewarded, even if already `Completed`. A reward fires only on an observed `Arrived → Completed` transition.
- **Calculation — correction.** `awardQuickCoins()` no longer computes the coin figure client-side; it calls `sb.rpc('award_quickcoins', { p_booking_id })`, passing only the booking id. The 5%-of-base-price formula appears to now live inside the RPC (body not part of the inspected client code), not in `index.js`.
- **Double-credit prevention.** `qcRewardedIds` is marked **before** the awaiting database call completes, specifically to prevent an overlapping poll tick from double-crediting the same booking.
- **Wallet.** A read-only modal (`openQuickWallet`) displays `quickcoins_balance`, `quickcoins_earned`, `quickcoins_redeemed`, `total_completed_bookings`, fetched fresh on every open. `quickcoins_redeemed` is read but never written anywhere in the client code — there is no redemption code path implemented (matches PRD §21.3/§24.3 — redemption is an explicit Phase 7 item).
- **Open product decision.** The 5%-of-base-price rate is a concrete implementation value; PRD §10A.1 records the QuickCoins earning rate as an explicit open Product decision, and this discrepancy is not reconciled anywhere in the client code.

---

## 14. Security Architecture

| Concern | Implementation | Gap (as observed) |
|---|---|---|
| Admin gating | Database-driven `admins.is_active` lookup; session signed out on failure | No multi-role admin hierarchy (PRD §4A.3 assumption) |
| Auth session | Supabase Auth with `persistSession:true, autoRefreshToken:true, detectSessionInUrl:false` | — |
| Worker document handling | Uploaded to Storage buckets `worker-documents`/`worker-photos` with randomized filenames | No retention, encryption-at-rest, or deletion policy defined anywhere in the inspected source (PRD §22A.5, open compliance item) |
| API key handling | `CONFIG.GEOAPIFY_API_KEY` is a plaintext client-side constant in `config.js` | No server-side proxy or key rotation mechanism exists |
| Business-rule enforcement | Booking creation, acceptance, OTP verification, pass activation, and QuickCoins crediting go through server-side RPCs (Section 4); worker-assignment eligibility and pre-submission price display remain client-computed | RPC bodies aren't part of the inspected client code, so the actual enforcement inside them can't be verified — narrower gap than previously stated, not eliminated |
| Signup failure handling | If a worker's `workers` row insert fails, the just-created worker row is deleted and the auth session is signed back out, preventing an orphaned auth account | — |
| Error surfacing | Toast/inline-banner convention throughout; the sole exception is upload failures during worker signup, surfaced via a blocking `alert()` in addition to `console.error()` | Inconsistent error-surfacing convention in this one path |

This architecture reflects PRD §22A.2's own characterization: client-side business logic is "a known constraint being addressed in Phase 6" and "should not be treated as a production-security posture."

---

## 15. Scalability

- **GPS write batching.** `_startGPS` batches all of a worker's currently active booking IDs into a single `.in('id', activeIds)` Supabase update per position fix, rather than one write per booking — the only scalability-oriented optimization identified in the codebase.
- **Client-side aggregation cost.** Admin analytics (`admin.js: renderAnalytics()`) and worker performance stats (partially — the two RPCs are the exception) are computed by iterating already-loaded arrays in the browser; as `campaigns`/`user_passes`/`bookings` volume grows, this cost scales with data fetched into the browser, not with a server-side query plan.
- **Realtime channel scope.** Each connected worker opens one dedicated channel (`worker-bookings-<id>`), scoped by `filter: worker_id=eq.<id>`, rather than a single global channel — this limits each client's realtime payload to its own rows, but a channel-per-worker approach means the number of open Supabase Realtime connections scales linearly with concurrently active workers.
- **No caching layer.** No client-side cache, service worker, or CDN-fronted asset pipeline was found for the app's own JS/CSS; every page load re-fetches all page-specific and common scripts directly.
- **No load-testing or capacity evidence.** No performance budget, load test, or concurrency target is present in the inspected source; PRD §21.2 (Phase 6) explicitly defers "optimize database queries and overall performance" and "support multiple concurrent users at production scale" to a future phase.

---

## 16. Design Decisions

| Decision | Rationale (as evidenced in code comments) | Trade-off |
|---|---|---|
| Plain global-scope scripts, no bundler/module system | Every shared file's header states this explicitly (e.g. `supabase.js`, `utils.js`), preserving a single fixed script-tag load order per page rather than introducing build tooling | No dead-code elimination, no dependency-graph enforcement beyond manual script-tag ordering |
| Function aliasing in `maps.js` instead of renaming call sites | Stated directly in `maps.js`'s header: satisfies "do not rename functions" while still sharing one implementation instead of two copies | Two names for one function increases surface area for future confusion |
| Toast system split out of `utils.js` into its own file (`toast.js`) | Phase 5.3.5, per `toast.js`'s own header, to isolate toast-only code from generic utilities | Slightly more files to keep in the fixed load order |
| Dual, independently coded OTP verification paths | Historically evolved separately in `index.js` and `dashboard.js`; the SRS documents this as a genuine duplication, not a deliberate architectural choice | Different side effects on the same `bookings` row (only the worker-dashboard path nulls the OTP field and toggles availability) — flagged in SRS §9 as a future "Unified OTP verification path" item |
| Client-computed business logic (price, assignment, QuickCoins, achievements) | No server function layer exists yet; this is the current-phase architecture, not a target one, per PRD §4A.5 and §22A.2 | No server-side enforcement; described throughout Section 14 |
| Realtime channel scoped per worker, with polling fallback | `dashboard.js`'s own comment: `postgres_changes` "does not fire on TRUNCATE or certain bulk/dashboard resets," so polling is retained as a safety net rather than replacing the channel | Two sync mechanisms running concurrently on one page increases complexity for a marginal reliability gain |
| Four independent mobile-nav toggle implementations (`index.js`, `nav.js`, `landing.js`, `admin.js`) | Each operates on different DOM ids per page, as `nav.js`'s own header states | No shared, single navigation component; a fourth-time duplicated pattern rather than a shared one |