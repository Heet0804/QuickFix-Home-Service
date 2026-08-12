# API Documentation
## QuickFix — On-Demand Home Services Marketplace

| Field | Detail |
|---|---|
| Document Type | API Reference Document |
| Basis | Direct inspection of all attached source files, cross-referenced against `docs/PRD.md`, `docs/SRS.md`, `docs/ARCHITECTURE.md`, and `docs/DATABASE.md` |
| Critical Constraint | **QuickFix has no custom-built REST or GraphQL API of its own.** There is no application server, no `/api/*` route, and no request handler written for this project. Every interaction documented below is either (a) a direct call from browser JavaScript to the Supabase JS SDK (which itself talks to Supabase's hosted REST/Realtime/Storage endpoints), (b) a direct `fetch()` call from browser JavaScript to a third-party HTTP API (Geoapify, Nominatim), or (c) a call to a native Browser API. This document treats each of these client-side function boundaries as the project's "API surface" because that is the only API surface that exists in the inspected code. No endpoint, request body, or response shape is invented beyond what is directly observable in the source. |

---

## 1. API Overview

### 1.1 Purpose
This document catalogs every external call boundary in the QuickFix client: every Supabase table/RPC/Storage/Auth/Realtime interaction, every third-party HTTP call (Geoapify, Nominatim), and every native Browser API used. Its purpose is to give backend/integration engineers a complete, verified map of what the client currently talks to, in preparation for the Phase 6 migration of this logic into hardened server-side functions (`PRD.md` §21.2).

### 1.2 Architecture
As established in `ARCHITECTURE.md` §2 and §4, QuickFix is a client-heavy, backend-as-a-service architecture. There is no intermediate API layer between the browser and Supabase — every "endpoint" in this document is a Supabase SDK method call or a direct third-party `fetch()`, made straight from `auth.js`, `index.js`, `dashboard.js`, `profile.js`, or `admin.js`.

### 1.3 API Philosophy
There is no documented or observable API design philosophy (REST maturity level, versioning scheme, response envelope convention) in the codebase, because no custom API was built. The closest thing to a philosophy is the Supabase JS SDK's own query-builder convention (`sb.from('<table>').select/insert/update/delete/upsert()`), used consistently across all page scripts, and a shared error-surfacing convention (toast notifications / inline banners, with `alert()` as a rare, explicitly-noted exception — see Section 10).

### 1.4 Authentication Mechanism
Authentication is handled entirely by **Supabase Auth**, via the single client instance `window.sb` declared in `supabase.js`. The client is configured with `persistSession:true, autoRefreshToken:true, detectSessionInUrl:false`. On top of the Supabase Auth session, the application layers its own lightweight session cache in `sessionStorage` (`qf_user`, `qf_role`), read on every page's boot sequence to avoid an extra round trip for role/profile data; this cache is not itself a security boundary — every protected page still re-validates against `sb.auth.getSession()` and/or a live re-fetch of the corresponding `users`/`workers` row.

---

## 2. Authentication APIs

All calls below are Supabase Auth SDK methods, invoked from `auth.js` unless otherwise noted.

| Operation | Call | Request Input | Behavior |
|---|---|---|---|
| Login | `sb.auth.signInWithPassword({ email, password })` | Email, password | On success, reads `user_metadata.role`, fetches the matching `workers` or `users` row, writes the `sessionStorage` cache (`qf_user`, `qf_role`), and redirects via `redirect(role)` to `admin.html`/`worker-dashboard.html`/`index.html`. On failure, shows a form-level error banner with specific messages for "Invalid login credentials," "Email not confirmed," etc. |
| Customer Signup | `sb.auth.signUp({ email, password, options: { data: { role: 'user' } } })` (role passed via Auth metadata) | First name, last name (optional), email, phone, password (≥6 chars) | On success, inserts a row into `users`; writes the `sessionStorage` cache; redirects to `index.html`. |
| Worker Signup | `sb.auth.signUp(...)` | Full name, phone, email, skill, radius, area, years of experience, emergency checkbox (Electrician/Plumber only), ID document file, profile photo file, password (≥6 chars) | Uploads ID document to Storage bucket `worker-documents` and photo to `worker-photos` (both with randomized filenames) **before** the Auth call resolves data insertion, then inserts a full row into `workers` (`is_available:false`, `rating:0`, `total_jobs:0`). If the `workers` insert itself fails, the just-inserted worker row is deleted and `sb.auth.signOut()` is called to avoid an orphaned auth account with no profile. |
| Session Check | `sb.auth.getSession()` | None | Called on boot by every protected page (`index.js`, `dashboard.js`, `profile.js`, `admin.js`'s gate, `landing.js`) to determine whether to show a logged-in state or redirect to `auth.html`. |
| Logout | `sb.auth.signOut()` | None | Called from `index.js: signOut()`, `dashboard.js` (nav "Logout" button), and `admin.js` (on gate failure or explicit sign-out); also clears the relevant `sessionStorage` keys. |
| Password Reset | `sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/auth.html' })` | Email | Triggers Supabase's built-in password-reset email flow; no custom reset-token handling exists in the client beyond the redirect target. |
| User Verification | Not implemented as a distinct API call. Worker "verification" is a manual, stated 24-hour process (`auth.js`/`index.html` confirmation-screen copy) with **no corresponding client-side check** of any `is_verified`-style column before allowing sign-in or dashboard access (confirmed in `SRS.md` §7.2). This document does not invent a verification endpoint that does not exist. |

---

## 3. Customer APIs

All calls below are made from `index.js`. As with Section 2, these are Supabase SDK calls and internal function boundaries, not custom HTTP routes.

| Operation | Call | Table(s) | Behavior |
|---|---|---|---|
| Booking Creation | `initiateBooking()` → `DB.save()` → `sb.from('bookings').insert({...})` | `bookings` | Inserts a new row with `status:'Pending'`, `w_status:'Pending'` (or the `DB.save` upsert default), computed `price`/`base_price`, `arrival_otp` (pre-generated), `customer_lat`/`customer_lng`, `area_id`, and denormalized worker-identity placeholder fields. |
| Booking Retrieval | `DB.bookings()` → `sb.from('bookings').select('*').eq('user_id', user.id)` | `bookings` | Returns all bookings for the signed-in customer, rendered into tab-filtered lists (`bookingsByTab`/`renderBookings`); when no Supabase session exists, falls back to a `localStorage`-backed store (`qf_bookings`) — a path made unreachable in normal operation by the page's own auth-guard IIFE. |
| Booking Update (cancel) | `cancelBk()` → `sb.from('bookings').update({ status:'Cancelled', ... })` | `bookings` | Customer-initiated cancellation, permitted per `canCancel` logic up to the tracking-reveal point. |
| Booking Update (clear history) | `DB.clearAll()` → `sb.from('bookings').update({ hidden_by_user:true }).eq('user_id', user.id)` | `bookings` | Soft-hides all of the customer's bookings from the visible list without deleting rows; gated behind a confirmation modal (`clrModal`). |
| Review Submission | `submitReview()` → `sb.from('bookings').update({ rated, review_rating, review_comment })` then `sb.from('reviews').insert({...})` | `bookings`, `reviews` | Only offered for `status==='Completed' && !b.rated` bookings; blocked client-side if no star rating is selected; the `reviews` insert's result/error is not checked. |
| Wallet | `openQuickWallet()` → `sb.from('users').select('quickcoins_balance,quickcoins_earned,quickcoins_redeemed,total_completed_bookings').eq('id', user.id)` | `users` | Read-only; fetched fresh on every modal open, no client-side caching. |
| QuickCoins Crediting | `checkQuickCoinsRewards()` → `awardQuickCoins()` → `sb.from('users').update({ quickcoins_balance, quickcoins_earned, total_completed_bookings })` | `users` | Not a user-triggered call — fires automatically when `renderBookings()`'s polling observes an `Arrived → Completed` transition for a booking not yet rewarded this session (see `DATABASE.md` §6.5). |
| Timeline | `buildTimeline()` (rendering only, no separate fetch — reads from the already-loaded `bookings` row's timestamp columns) | `bookings` | Maps `status`/`w_status` and the four timestamp columns to one of eight fixed customer-facing steps; rendered lazily on first expand (`toggleTimeline`). |
| Tracking | `_buildTrackingMap()` → reads `bookings.worker_live_lat/worker_live_lng/worker_last_seen/customer_lat/customer_lng` on a poll/observer cycle, plus Geoapify calls (Section 7) | `bookings` | No dedicated fetch function — tracking state is derived from the same `bookings` row already loaded for the booking list. |
| Campaigns / Offers | `fetchActiveCampaigns()` → `sb.from('campaigns').select('*').eq('status','active')` (filtered further client-side by date window) | `campaigns` | Powers both the once-per-login popup and the dedicated Offers page. |
| Pass Purchase | `campaignBuyPass()` → `openPaymentModal()` → `_simulatePaymentProvider()` → `activatePass()` → `sb.from('user_passes').insert({...})` | `user_passes` | Payment is simulated (fixed 10-second auto-success, no real gateway callback); see Section 10 for failure behavior. |
| In-App Worker Registration | `submitReg()` → `DB.saveReg()` → `sb.from('profiles').upsert({ id, name, phone, role:'worker' })` | `profiles` | A documented, incomplete alternate path — professional/verification fields collected by the form are not persisted (see `DATABASE.md` §4.10). |

---

## 4. Worker APIs

All calls below are made from `dashboard.js` unless otherwise noted; profile-specific calls are from `profile.js`.

| Operation | Call | Table(s) | Behavior |
|---|---|---|---|
| Dashboard Data Load | `loadBookings()` → `sb.from('bookings').select('*').eq('worker_id', W.id)` | `bookings` | Re-runs on every Realtime event (Section 9) and every 5-second polling tick; also drives `checkAndUnlockAchievements()`. |
| Booking Acceptance | `confirmAccept()` → `sb.from('bookings').update({ status:'Accepted', w_status:'Accepted', accepted_at, worker_earning }).eq('id', bookingId).in('status', ['Pending','Scheduled','Confirmed'])` | `bookings` | The `.in('status', [...])` clause on the write itself guards against a two-worker accept race; also calls `setWorkerAvailability(false)`. |
| Booking Rejection | `confirmReject()` → `sb.from('bookings').update({ status:'Rejected', w_status:'Rejected' })` | `bookings` | — |
| Cancel Accepted Booking | `confirmCancelAccepted()` → `sb.from('bookings').update({ status:'Cancelled', w_status:'Cancelled' }).eq('status','Accepted')` | `bookings` | Guarded to only affect a still-`Accepted` row; also tears down any open "Track Customer" map for that booking. |
| Arrival OTP Verification | `submitArrivalOtp()` → compares entered value to `bookings.arrival_otp`; on match, `sb.from('bookings').update({ arrival_otp:null, completion_otp:<new 6-digit>, status:'Arrived', w_status:'Arrived', arrived_at, started_at })` | `bookings` | Generates the fresh Completion OTP at this point, not at booking creation; tears down the worker's own tracking map. |
| Completion OTP Verification | `submitCompletionOtp()` → compares entered value to `bookings.completion_otp`; on match, `sb.from('bookings').update({ completion_otp:null, status:'Completed', w_status:'Completed', completed_at })` | `bookings` | Also calls `setWorkerAvailability(true)`, bringing the worker back online automatically. |
| GPS Updates | `_startGPS()`/`syncGPS()` → `sb.from('bookings').update({ worker_live_lat, worker_live_lng, worker_last_seen }).in('id', activeIds)` | `bookings` | Batched across all of the worker's currently active booking IDs in a single write per `navigator.geolocation.watchPosition` fix. |
| Availability Toggle | `toggleAvailability()` → `sb.from('workers').update({ is_available })` | `workers` | Reverts the UI toggle and shows a toast on write failure. |
| Emergency Toggle | `toggleEmergency()` → `sb.from('workers').update({ emergency_available })` | `workers` | Independent of the signup-time emergency preference. |
| Profile Updates | `profile.js: saveProfile()` → `sb.from('workers').update({ name, phone, skill, experience, area, radius })` | `workers` | Only changed/non-empty fields are written; validates name/phone/skill non-empty and radius 1–100 if provided. |
| Achievements | `checkAndUnlockAchievements()` → `sb.from('worker_achievements').select(...)` then `.insert({ worker_id, achievement_id, category, name, description })` | `worker_achievements` | Runs on every `loadBookings()` cycle; a 23505 unique-violation insert error is silently ignored (tolerates concurrent Realtime-triggered re-evaluation). |
| Worker Stats (read-only) | `sb.rpc('get_worker_stats', { p_worker_id })` | RPC | Returns the `Stats` object (`accepted_jobs`, `completed_jobs`, `cancelled_jobs`, `no_show_count`, `reliability_score`, `completion_rate`, `activity_score`, `worker_score`, `rating`); its internal SQL is not part of the inspected client code. |

---

## 5. Admin APIs

All calls below are made from `admin.js`, which was not present in the container filesystem at the time of this document's generation (the file system resets between tool-use sessions per this environment's own constraints). The operations below are carried forward from this conversation's earlier, directly-verified reading of `admin.js` (as recorded in `SRS.md` §3.10 and `ARCHITECTURE.md` §10) rather than re-invented; no new claim about `admin.js` is introduced beyond what was already confirmed in those documents.

| Operation | Call | Table(s) | Behavior |
|---|---|---|---|
| Admin Authentication | `checkAdminRole(email)` → `sb.from('admins').select('is_active').eq('email', email)` | `admins` | On any falsy `is_active` result, `sb.auth.signOut()` is called and "Access Denied" is shown for 10 seconds before the login form reappears; the user is never redirected elsewhere. |
| Campaign Creation/Update | `publishCampaign()` → `sb.from('campaigns').insert({...})` or `.update({...}).eq('id', cfId)` | `campaigns` | Validates title/service/price≥0/visits≥1/validity≥1/start<end before the write. |
| Campaign Status Toggle / Delete | (Table action buttons) → `sb.from('campaigns').update({ status })` / `.delete().eq('id', ...)` | `campaigns` | Delete is gated by a browser `confirm()` dialog; failures surface via `alert()`. |
| Purchased-Pass Listing | `sb.from('user_passes').select('*')`, joined client-side against loaded `users`/`campaigns` arrays | `user_passes` | Read-only. |
| Analytics | `renderAnalytics()` — no dedicated fetch; computed entirely client-side from the already-loaded `_allCampaigns`/`_allPasses` arrays | `campaigns`, `user_passes` | Total campaigns, total passes sold, active/expired counts, and per-campaign revenue are all aggregated in the browser; there is no analytics RPC. |
| Dashboard Data Load | Initial page-load fetch of `campaigns` and `user_passes` on `admin.html` boot | `campaigns`, `user_passes` | Feeds both the Campaigns tab and the Analytics tab from the same loaded arrays. |

---

## 6. Supabase APIs

This section consolidates every distinct database interaction found across all page scripts, in one table, per the requested format (Purpose / Method / Table / Operation / Expected Behavior).

| Purpose | Method | Table | Operation | Expected Behavior |
|---|---|---|---|---|
| Customer account creation | `sb.from('users').insert()` | `users` | INSERT | Runs immediately after a successful `sb.auth.signUp` for role `user` |
| Worker account creation | `sb.from('workers').insert()` | `workers` | INSERT | Runs after both Storage uploads succeed and `sb.auth.signUp` resolves for role `worker` |
| Worker account rollback | `sb.from('workers').delete()` | `workers` | DELETE | Only on a failed `workers` insert immediately after auth signup, to avoid an orphaned auth account |
| Booking creation | `sb.from('bookings').insert()` / `.upsert()` (via `DB.save`) | `bookings` | INSERT/UPSERT | Creates the `Pending` booking row described in Section 3 |
| Booking status transitions | `sb.from('bookings').update()` | `bookings` | UPDATE, guarded by `.eq()`/`.in()` on current status | Accept/Reject/Cancel/Arrival-OTP/Completion-OTP writes, per Sections 3–4 |
| Booking read (customer) | `sb.from('bookings').select().eq('user_id', ...)` | `bookings` | SELECT | Powers the customer's booking list/tabs |
| Booking read (worker) | `sb.from('bookings').select().eq('worker_id', ...)` | `bookings` | SELECT | Powers the worker dashboard job tabs and calendar |
| Saved address update | `sb.from('users').update({ saved_address, saved_area_id, saved_lat, saved_lng })` | `users` | UPDATE | On first booking to a new address, via `_resolveCustomerPin()` |
| QuickCoins crediting | `sb.from('users').update({ quickcoins_balance, quickcoins_earned, total_completed_bookings })` | `users` | UPDATE | Per Section 3, on an observed `Arrived → Completed` transition |
| Review write | `sb.from('bookings').update()` then `sb.from('reviews').insert()` | `bookings`, `reviews` | UPDATE, INSERT | Per Section 3 |
| Area lookup | `sb.from('areas').select('id,name,lat,lng').order('name')` | `areas` | SELECT | Read-only; used at worker signup and for booking-area validation |
| Campaign CRUD | `sb.from('campaigns').insert()/update()/delete()` | `campaigns` | INSERT/UPDATE/DELETE | Admin-only, per Section 5 |
| Campaign read | `sb.from('campaigns').select().eq('status','active')` | `campaigns` | SELECT | Per Section 3 |
| Pass purchase | `sb.from('user_passes').insert()` | `user_passes` | INSERT | Per Section 3 |
| Pass consumption | `sb.from('user_passes').update({ visits_remaining, status })` | `user_passes` | UPDATE | On an observed `Arrived → Completed` transition for a pass-covered booking |
| Achievement unlock | `sb.from('worker_achievements').select()` then `.insert()` | `worker_achievements` | SELECT, INSERT | Per Section 4 |
| Admin role check | `sb.from('admins').select('is_active').eq('email', ...)` | `admins` | SELECT | Per Section 5 |
| In-app worker registration | `sb.from('profiles').upsert()` | `profiles` | UPSERT | Per Section 3 |
| Worker stats (RPC) | `sb.rpc('get_worker_stats', { p_worker_id })` | RPC | Function call | Read-only; used by `dashboard.js`, `profile.js` |
| Bulk worker stats (RPC) | `sb.rpc('get_worker_stats_bulk', { p_worker_ids })` | RPC | Function call | Read-only; used by `index.js` (e.g. to display multiple eligible workers' scores during assignment) |
| ID document upload | `sb.storage.from('worker-documents').upload(filename, file)` | Storage | UPLOAD | Randomized filename, worker signup only |
| Profile photo upload | `sb.storage.from('worker-photos').upload(filename, file)` | Storage | UPLOAD | Randomized filename, worker signup only |

---

## 7. Geoapify APIs

Both endpoints are called through the `geoapify-proxy` Supabase Edge Function from `js/common/maps.js`, authenticated with the caller's Supabase session token — no Geoapify API key is present in client code.

| API | Endpoint (verified) | Caller | Purpose | Behavior |
|---|---|---|---|---|
| Reverse Geocoding | `GET {SUPABASE_URL}/functions/v1/geoapify-proxy?type=reverse&lat={lat}&lon={lng}` (Authorization: Bearer {session token}) | `maps.js: _geoapifyReverseGeocode()` | Resolves a pinned/tracking-destination coordinate to a human-readable building/society name | Field preference order: `building`, then `amenity`, `name`, `housename`, `street`, `suburb`, `locality`; returns `null` if none present. Called once per booking's fixed destination point, never re-queried. |
| Routing | `GET {SUPABASE_URL}/functions/v1/geoapify-proxy?type=routing&from={fromLat},{fromLng}&to={toLat},{toLng}&mode=drive` (Authorization: Bearer {session token}) | `maps.js: _fetchRoadRoute()` | Road-following route between the worker's live location and the customer destination | Returns an array of `[lat,lng]` pairs with non-enumerable `distance`/`duration` properties attached, or `null` on any failure. Throttled to at most once per 8 seconds per booking, and additionally skipped if the worker has moved less than 10 meters since the last successful fetch. |

**Forward Geocoding.** Geoapify is **not** used for forward geocoding (address → coordinates) anywhere in the codebase. That responsibility belongs to Nominatim (Section 7's own separate entry, and `DATABASE.md`/`SRS.md` both document this same split). This document does not invent a Geoapify forward-geocoding call that does not exist.

**Distance.** There is no dedicated Geoapify "Distance" API call. Straight-line distance (used for worker-assignment eligibility and the "moved ≥10m" routing-throttle check) is computed locally in the browser via a Haversine formula (`_metersBetween()` in `maps.js`; a separate inline Haversine implementation in `index.js: getEligibleWorkersForArea()`), not via any external distance API.

**Nominatim (related, non-Geoapify forward geocoding).**

| API | Endpoint (verified) | Caller | Purpose | Behavior |
|---|---|---|---|---|
| Forward Geocoding | `GET https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&addressdetails=1&q={query}` | `index.js: geocodeAddress()` | Converts the customer's entered address into coordinates + locality, for area-match validation | Retries once per zero-result response with the leading (most specific) comma-segment of the address dropped, until a match or segments are exhausted; on any network/parse/HTTP failure, returns `null` and the booking flow shows an inline "Unable to locate this address" warning rather than blocking silently. |

---

## 8. Browser APIs

| API | Used For | Caller | Verified Behavior |
|---|---|---|---|
| Geolocation (`navigator.geolocation.watchPosition`) | Continuous worker GPS publishing while a booking is `Accepted`/`Worker on Way`/`Arrived` | `dashboard.js: _startGPS` | Permission denial (`err.code===1`) stops the watcher and shows a toast; other errors retry after 5 seconds via `_scheduleGPSRetry()` |
| Geolocation (`navigator.geolocation.getCurrentPosition`) | One-shot customer GPS capture at booking time (as an input to pin resolution) | `index.js` | Used only as one input into `_resolveCustomerPin()`, not a continuous watcher |
| `sessionStorage` | Session-scoped app state: `qf_user`, `qf_role`, `qf_campaign_shown`, and `qf_bookings_cache` (referenced only as a removal key across `index.js`/`dashboard.js`/`profile.js`, never observed being set) | `auth.js`, `index.js`, `dashboard.js`, `profile.js`, `landing.js` | Cleared/rewritten on login, role selection, and logout; not itself a security boundary (see Section 1.4) |
| `localStorage` | A fallback, unauthenticated-only local booking store (`qf_bookings`) | `index.js: getLocalBookings()`/`setLocalBookings()` | Used only in the branch of `DB.save`/`DB.bookings`/`DB.update` where no Supabase session exists; in normal operation this path is unreachable because `index.js`'s own boot IIFE redirects an unauthenticated visitor to `auth.html` before this code can run |
| Clipboard API | Not implemented. No `navigator.clipboard` call was found anywhere in the inspected source. | — | Not present |
| Notifications API | Not implemented. No `Notification` constructor or `Notification.requestPermission()` call was found anywhere in the inspected source; all in-app alerts use the custom `showToast()` system (`toast.js`), not the browser's native Notification API. | — | Not present |
| `IntersectionObserver` | Scroll-reveal animation for landing-page sections | `landing.js` | Adds an `.on` class to `.reveal` elements at a `0.15` threshold; presentation only, not a data API |
| `MutationObserver` | Detects when the QuickCoins reward modal gains the `.on` class, to trigger the count-up/confetti animation | `index.js` | Presentation-triggering only |
| `requestAnimationFrame` | Eased marker-glide animation between GPS fixes on tracking maps | `maps.js: _animateMarkerTo` | Cancels any in-flight animation on the same marker before starting a new one |

---

## 9. Realtime APIs

Exactly one Supabase Realtime subscription exists in the entire codebase (also documented in `DATABASE.md` §8 and `ARCHITECTURE.md` §11):

| Subscription | Location | Channel Name | Table / Filter | Events | Callback Behavior |
|---|---|---|---|---|---|
| Worker booking-list sync | `dashboard.js` | `worker-bookings-<worker_id>` | `bookings`, `filter: worker_id=eq.<worker_id>` | `*` (INSERT/UPDATE/DELETE via `postgres_changes`) | Re-runs `loadBookings()` on any matching change; backed by a 5-second polling fallback on the same page, since `postgres_changes` does not fire on TRUNCATE or certain bulk resets (per the code's own comment) |

**Booking updates.** Covered entirely by the subscription above, scoped to the signed-in worker's own bookings.

**Tracking updates.** Tracking data (`worker_live_lat`/`worker_live_lng`/`worker_last_seen`) is **not** pushed via a dedicated Realtime channel on either the customer or worker side; both tracking implementations re-read the relevant `bookings` row on their own polling/observer cadence rather than subscribing to row-level changes for that specific purpose.

**Worker updates.** No Realtime subscription exists on the `workers` table itself (e.g. for live availability broadcast to customers); worker eligibility for a new booking is computed by the customer's browser against a fresh `select()` at booking-initiation time, not a subscribed live feed.

**Customer-side (`index.js`) Realtime.** No `channel(`/`postgres_changes` call exists in `index.js`; the customer app relies entirely on interval-based polling for booking-list freshness (per the "FALLBACK SYNC" comment inside `dashboard.js`, which references this same behavior in `index.html`).

**PRD discrepancy note.** `PRD.md` §22/§22A.1 attribute real-time/notification sync to Firebase Realtime Database. No Firebase reference exists anywhere in the codebase. This discrepancy is already flagged in `SRS.md` and `ARCHITECTURE.md` and is repeated here: the only verified realtime mechanism, at the API layer, is the single Supabase channel above.

---

## 10. Error Responses

There is no custom API, so there is no custom error-response envelope (no standardized `{ code, message }` JSON shape). Error handling is entirely a client-side convention layered over whatever Supabase/Geoapify/Nominatim/browser API returns. Documented, actually-observed behaviors:

| Scenario | Observed Behavior |
|---|---|
| Supabase Auth failure (login) | Specific banner messages for "Invalid login," "not confirmed," "already registered," sourced from the Supabase Auth error message text |
| Supabase insert/update failure (general) | `console.error(error.message)` plus a toast/inline banner in most paths |
| Worker signup Storage upload failure | The one documented exception: surfaced via a blocking `alert()` **in addition to** `console.error()`, rather than the toast/banner convention used everywhere else |
| Missing required booking fields | `markErr()` on each empty field plus a single "Please fill in all required fields" toast |
| Address fails geocoding (Nominatim) | Inline warning: "Unable to locate this address…"; booking blocked, no `alert()` |
| Geocoded address doesn't match selected area | Inline warning: "This address does not belong to the selected area…"; booking blocked |
| No eligible worker in range | Toast naming the role, radius cap, and area; booking blocked before payment |
| GPay QR countdown (5 min) expires | "Payment Session Expired" message shown in place of the QR; no automatic retry |
| Pass-purchase countdown (2 min) expires | `_onPaymentExpired()`: "Payment Session Expired — Please try again."; countdown row hidden |
| Payment polling exceeds `POLL_MAX` (60 × 3s) | "Payment timeout. Try again or choose Cash." toast; polling stopped |
| No worker accepts within the broadcast window | `noAcceptModal` with a "Try Again" button re-invoking `initiateBooking()` |
| Incorrect Arrival/Completion OTP (either path) | Toast rejection; unlimited re-entry, no attempt counter or lockout |
| Non-admin sign-in on `admin.html` | Session signed out; "Access Denied" for 10 seconds, then the login form reappears |
| Geoapify routing/reverse-geocode failure | Caught per-call; tracking degrades to the previous route/placeholder ETA rather than throwing |
| GPS permission denied | Watcher stopped; toast shown ("Enable location permission"); no server-side/SMS fallback |
| GPS transient error | Retried automatically after 5 seconds |

No HTTP status code, retry-after header, or rate-limit response from Supabase, Geoapify, or Nominatim is inspected or handled distinctly by status code anywhere in the client code beyond a generic `if(!res.ok)` check (Nominatim) — this document does not invent a status-code-specific handling matrix that isn't present in the source.

---

## 11. Security

| Concern | Observed Implementation | Verified Gap |
|---|---|---|
| Authentication | Supabase Auth session, `persistSession:true`/`autoRefreshToken:true` | — |
| Authorization | Client-side role/session checks per page (dual-signal for workers, `admins.is_active` lookup for admin); no server-side authorization layer confirmed beyond whatever Supabase RLS may or may not enforce (unverifiable from client code, per `DATABASE.md` §9) | Cannot confirm RLS is actually enforcing these same restrictions at the database layer |
| API key usage | No Geoapify API key exists in client code; both Geoapify calls are routed through the `geoapify-proxy` Supabase Edge Function, authenticated with the caller's Supabase session token | Key is held server-side only (Edge Function secret), not visible in browser network traffic |
| Sensitive data | Government ID documents/photos (Storage, public-URL retrieval per `SRS.md` §2.6); OTPs stored in plaintext `bookings` columns with no attempt limit | No encryption-at-rest/retention/deletion policy for ID documents (`PRD.md` §22A.5, open item); no OTP lockout |
| Validation | Entirely client-side (field checks, status-guarded writes); no server-side validation function or Postgres check constraint confirmed | Business-rule enforcement (price, eligibility, QuickCoins) is not verified to be re-checked server-side |

---

## 12. Future APIs

Only items explicitly named as planned in `PRD.md` (§21, §24) or `SRS.md` (§9) are listed; no speculative endpoint is invented.

- **Phase 6 backend hardening (`PRD.md` §21.2).** Move booking validation, worker-assignment logic, and QuickCoins crediting into RLS-protected server-side functions; secure API key handling (implying a future server-side Geoapify proxy).
- **Phase 7 QuickCoins ecosystem (`PRD.md` §21.3).** A coin-redemption write path (`users.quickcoins_redeemed` is currently read-only) and expanded campaign/offer APIs.
- **Real payment gateway integration (`SRS.md` §9).** Replacing the simulated GPay QR/polling flow (`checkPayStatus()`, `_simulatePaymentProvider()`) with an actual UPI/payment provider callback API.
- **Functional social sign-in (`SRS.md` §9).** Google and Phone-OTP auth buttons exist in `auth.html` but only show a "coming soon" toast; no backing API integration exists yet.
- **Unified OTP verification API (`SRS.md` §9).** Consolidating the two independent OTP-writing paths (`index.js`, `dashboard.js`) into one authoritative function.
- **In-app worker registration persistence (`SRS.md` §9).** Fully wiring `submitReg()`'s collected fields into a persisted worker profile.

No other future API (e.g. a dedicated analytics endpoint, a push-notification service, a server-side geocoding proxy beyond what Phase 6 implies) is named anywhere in `PRD.md` or `SRS.md`; this document does not invent one.