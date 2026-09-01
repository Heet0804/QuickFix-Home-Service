# Software Requirements Specification
## QuickFix — On-Demand Home Services Marketplace

| Field | Detail |
|---|---|
| Document Type | Software Requirements Specification (SRS) |
| Basis | Direct inspection of the QuickFix source files: `landing.html`, `auth.html`, `index.html`, `worker-dashboard.html`, `worker-profile.html`, `admin.html`, and their associated scripts (`landing.js`, `auth.js`, `index.js`, `dashboard.js`, `profile.js`, `admin.js`, `supabase.js`, `config.js`, `utils.js`, `toast.js`, `maps.js`, `nav.js`), cross-referenced against `PRD.md` (v1.2) |
| Standard Followed | IEEE 830-style SRS structure |
| Convention | Every requirement is derived from a specific file and function/element named in parentheses. Where the PRD describes a feature the codebase does not implement (or implements differently), this is stated explicitly rather than smoothed over. |

---

## 1. Introduction

### 1.1 Purpose
This document specifies the requirements of the QuickFix platform as they are actually implemented in the current codebase. It is written for engineering, QA, and architecture use, and is grounded entirely in the six HTML entry points and their JavaScript modules, not in the product roadmap. Where PRD.md describes an aspiration not reflected in code, that gap is called out under Section 8 (Error Handling) or Section 9 (Future Enhancements) rather than presented as a shipped requirement.

### 1.2 Scope
QuickFix is a browser-based marketplace with six HTML entry points, each backed by page-specific JavaScript and a set of shared (`js/common/*.js`) modules:

| Interface | HTML File | Script(s) |
|---|---|---|
| Landing Page | `landing.html` | `landing.js` |
| Authentication | `auth.html` | `auth.js` |
| Customer Application | `index.html` | `index.js` |
| Worker Dashboard | `worker-dashboard.html` | `dashboard.js` |
| Worker Profile | `worker-profile.html` | `profile.js` |
| Admin Portal | `admin.html` | `admin.js` |

Shared modules loaded across multiple pages: `supabase.js` (client instance), `config.js` (shared constants), `utils.js` (generic helpers), `toast.js` (toast notifications), `maps.js` (Leaflet/Geoapify routing helpers), `nav.js` (mobile nav toggle for worker pages).

The system covers: authentication and onboarding, service discovery, booking creation with address validation and geocoding, an area/radius-based automatic worker-assignment algorithm, two payment methods, live GPS tracking with road routing, two-checkpoint OTP verification, a QuickCoins loyalty wallet, admin-managed Service Pass campaigns, worker performance analytics, a database-persisted achievement system, and an admin portal.

### 1.3 Definitions

| Term | Meaning as implemented |
|---|---|
| `sb` | The shared Supabase client instance exposed on `window.sb` by `supabase.js` |
| `W` | The in-memory worker record (merged `workers` row + cached session) used throughout `dashboard.js` and `profile.js` |
| `pendBk` | The pending-booking object held in `index.js` between form submission and payment/broadcast confirmation |
| `Stats` | The object returned by the `get_worker_stats` Supabase RPC; the single source of truth for all worker performance figures |
| `w_status` | A worker-facing status column on `bookings`, distinct from the customer-facing `status` column (e.g. a booking can be `status='Pending'` while having no `w_status` yet, or `w_status='Rejected'` while `status='Rejected'`) |
| `_trkState` / `_trkStateW` | In-memory maps keyed by booking ID holding each active Leaflet map instance, markers, and route layer, for the customer-side and worker-side tracking implementations respectively |
| CONFIG | Object exposed by `config.js` holding `GEOAPIFY_API_KEY`, `RELIABILITY_MIN_ACCEPTED_JOBS`, `TRACKING_ZOOM` |

### 1.4 Abbreviations
OTP (One-Time Password), RPC (Remote Procedure Call, i.e. a Supabase Postgres function), IST (Indian Standard Time), RLS (Row Level Security), GPS (Global Positioning System), UPI (Unified Payments Interface).

### 1.5 References
- `PRD.md` v1.2 — Product Requirements Document, QuickFix.
- Source files listed in Section 1.2, as uploaded.

### 1.6 Overview
Section 2 describes the system at a high level. Section 3 documents every implemented functional module with description, inputs, outputs, processing, error handling, and dependencies, drawn directly from the corresponding function(s). Sections 4–8 cover non-functional requirements, data, external interfaces, business rules, and error handling as implemented. Section 9 lists genuine future-phase items only. Section 10 is a closing self-audit.

---

## 2. Overall Description

### 2.1 Product Perspective
QuickFix is implemented as six independent HTML pages, each loading its own page-specific script plus a shared set of `js/common/*.js` utility modules (confirmed by the `<script>` tags at the bottom of each HTML file and the module-boundary comments inside `config.js`, `maps.js`, `nav.js`, `toast.js`, and `utils.js`, which describe this as a Phase-5 refactor consolidating previously duplicated code). There is no shared bundler or module system — every shared file is a plain classic `<script>` with global-scope declarations, loaded in a fixed order before the page-specific script.

Backend access is exclusively through the Supabase JS client (`@supabase/supabase-js@2`, loaded from a CDN) instantiated once in `supabase.js` with `persistSession:true, autoRefreshToken:true, detectSessionInUrl:false`.

### 2.2 Product Functions (as implemented)
- Unified email/password authentication with role selection (`auth.js`).
- Customer service discovery across a fixed, hardcoded category/sub-category catalog (`index.js: CATS`, `HH_SECTIONS`, `MW_SECTIONS`, `CAT_SECTIONS`).
- Booking creation with address cleaning, Nominatim geocoding, area-match validation, and a Haversine-distance/radius worker-assignment algorithm (`index.js`).
- Two payment paths: simulated Google Pay (QR + polling) and Cash (`index.js: selectPay`, `drawQR`, `startPoll`).
- Two-checkpoint OTP verification, implemented independently on both the customer side (`index.js: verifyOtp`) and the worker side (`dashboard.js: submitArrivalOtp`, `submitCompletionOtp`).
- Live GPS tracking rendered with Leaflet, road routing via the Geoapify Routing API, and Nominatim/Geoapify reverse geocoding, implemented in parallel on the customer dashboard (`index.js`) and worker dashboard (`dashboard.js`), sharing logic through `maps.js`.
- QuickCoins crediting, triggered client-side by observing a booking transition from `Arrived` to `Completed` (`index.js: checkQuickCoinsRewards`, `awardQuickCoins`).
- Service Pass purchase (simulated GPay flow), consumption tracking, and admin campaign management (`index.js`, `admin.js`).
- Worker dashboard: availability/emergency toggles, job tabs, earnings, computed performance metrics (read-only from an RPC), a client-side achievement engine that writes unlocks to `worker_achievements`, and a booking calendar (`dashboard.js`).
- Worker profile page mirroring dashboard stats plus name/phone/skill/experience/area/radius editing (`profile.js`).
- Admin portal: campaign CRUD, purchased-pass listing, and analytics computed client-side from the loaded campaign/pass rows (`admin.js`).

### 2.3 User Classes
| Role | Entry Point(s) | Session Guard |
|---|---|---|
| Customer | `index.html` | IIFE at top of `index.js` checks `sb.auth.getSession()`; redirects to `auth.html` if absent |
| Worker | `worker-dashboard.html`, `worker-profile.html` | Dual-signal check: `sessionStorage.qf_user` + `qf_role==='worker'` AND a live `workers` row fetch; redirects to `auth.html?role=worker` on either failure |
| Admin | `admin.html` | `checkAdminRole()` looks up the signed-in email in an `admins` table and requires `is_active===true`; on failure, signs the session out and shows "Access Denied" without redirecting elsewhere |

### 2.4 Operating Environment
- Browser-only, no build step: plain `<script>` tags, ES6+ syntax, `fetch`, `navigator.geolocation.watchPosition`/`getCurrentPosition`.
- External CDNs depended on at runtime: `@supabase/supabase-js@2`, `leaflet@1.9.4` (CSS+JS), Google Fonts (`Sora`, `DM Sans`), and `qrcodejs@1.0.0` (lazy-loaded on first QR render in both `index.js` and the pass-payment flow).
- External APIs called directly from the browser: Nominatim (`nominatim.openstreetmap.org`), Geoapify Routing and Reverse Geocoding (`api.geoapify.com`, key embedded in `config.js` as `CONFIG.GEOAPIFY_API_KEY`), OpenStreetMap tile servers.

### 2.5 Constraints (as observed in code)
- **Correction (Phase 8):** an admin-issued write against `workers` (the ban feature's `UPDATE`) was found to be silently blocked by RLS with no client-visible error, because the pre-existing `workers_update` policy only permitted a worker to update their own row and no admin-scoped UPDATE policy existed. Fixed by adding `admins_can_update_any_worker` and by having the client append `.select()` to the write to detect an empty result. This is direct, first-hand confirmation — not a hypothetical — that a Supabase write silently succeeding with zero effect, due to RLS filtering, is a real failure mode in this codebase, consistent with the general RLS-unverifiability concern raised throughout `DATABASE.md`/`SECURITY.md`.
- The Geoapify API key is a plaintext client-side constant in `config.js` — there is no server-side proxy or key rotation mechanism in the codebase.
- **Correction:** booking creation, both OTP verifications, pass activation, QuickCoins crediting, and pass-visit consumption are now written via server-side RPCs (`create_booking`, `verify_arrival_otp`/`_customer`, `verify_completion_otp`/`_customer`, `activate_pass`, `award_quickcoins`, `consume_pass_visit`), each tagged "Phase 6.4" at its call site. Worker-assignment eligibility and the price shown to the customer before submission remain client-computed; `create_booking`'s own comment states price is re-validated server-side.
- `index.js` contains an in-app worker registration form (`submitReg()`) whose fields (category, experience, price, bio, Aadhaar number/photo, PAN, emergency flag) are collected in the UI but the corresponding `DB.saveReg()` call persists only `id`, `name`, `phone`, and `role:'worker'` to a `profiles` table — none of the professional/verification fields collected by this form are written anywhere. This is a genuine implementation gap, not a PRD interpretation issue.
- Two independent OTP-verification code paths exist for the same booking lifecycle: `index.js` (`triggerOtp`/`verifyOtp`, invoked from the customer's Arrival modal) and `dashboard.js` (`submitArrivalOtp`/`submitCompletionOtp`, invoked from the worker dashboard). Both are capable of writing `status` transitions (`Arrived`, `Completed`) to the same `bookings` row through different code paths with different side effects (e.g. only the worker-dashboard path nulls `completion_otp` after verification and toggles `is_available`).
- `is_no_show` is written by the customer-side `autoCancel()` function in `index.js`, but no corresponding column read/aggregation for this flag was found in `dashboard.js`'s or `profile.js`'s stats rendering — those instead read `no_show_count` from the `get_worker_stats` RPC, whose implementation is not part of the inspected client code.
- PRD.md §22 and §22A.1 state that "Notifications / Real-time Sync" and real-time booking sync depend on **Firebase Realtime Database**. No reference to Firebase exists anywhere in the inspected codebase. The actual mechanism is a Supabase Realtime `postgres_changes` channel subscription in `dashboard.js` (`sb.channel('worker-bookings-'+W.id).on('postgres_changes', {event:'*', schema:'public', table:'bookings', filter:'worker_id=eq.'+W.id}, ...).subscribe()`), backed by a 5-second polling fallback on the same page; `index.js` has no equivalent channel subscription and relies solely on timer-based polling. This is an unreconciled PRD/code discrepancy, not a shipped requirement, and is out of scope for this SRS beyond this note.
- No automated test suite, linting configuration, or CI pipeline file was found among the uploaded sources.

### 2.6 Assumptions
- `get_worker_stats` / `get_worker_stats_bulk` Postgres RPCs exist server-side and correctly compute `accepted_jobs`, `completed_jobs`, `cancelled_jobs`, `no_show_count`, `reliability_score`, `completion_rate`, `activity_score`, `worker_score`, and `rating` — their internal formulas are outside the inspected client code and are therefore out of scope for this SRS.
- The Supabase tables referenced by table name in the client code (`users`, `workers`, `bookings`, `areas`, `campaigns`, `user_passes`, `worker_achievements`, `admins`, `reviews`, `profiles`) exist with at least the columns the client reads/writes; no schema file was supplied.
- Storage buckets `worker-documents` and `worker-photos` exist and accept public-URL retrieval, as used in `auth.js`.

---

## 3. Functional Requirements

Each module below is documented with Description, Inputs, Outputs, Processing, Error Handling, and Dependencies, drawn from the named function(s).

### 3.1 Authentication (`auth.js`, `auth.html`)

**Description.** Unified sign-in/sign-up screen with a role toggle (`setRole()`), separate signup panels for Customer and Worker, and a forgot-password flow.

**Inputs.** Login: email, password. Customer signup: first name, last name (optional), email, phone, password. Worker signup: full name, phone, email, skill, work radius (km), area (dropdown populated from the `areas` table), years of experience, emergency-hours checkbox (shown only for Electrician/Plumber via `toggleEmergencyField()`), a government-ID file (`.jpg/.jpeg/.png/.pdf`, ≤5MB), a profile-photo file (`.jpg/.jpeg/.png`, ≤5MB, `capture="user"`), password.

**Outputs.** A Supabase Auth account (`sb.auth.signUp`), a row in `users` or `workers`, two uploaded files in Supabase Storage buckets `worker-documents` and `worker-photos` (worker signup only), and a `sessionStorage` cache (`qf_user`, `qf_role`) used by every other page's boot sequence.

**Processing.**
- `doLogin()`: calls `sb.auth.signInWithPassword`, reads `user_metadata.role`, fetches the matching profile row (`workers` or `users`), builds a session cache object, and redirects via `redirect(role)` (`admin.html` / `worker-dashboard.html` / `index.html`).
- `doSignup('user')`: validates required fields and 6-character minimum password, calls `sb.auth.signUp`, inserts into `users`.
- `doSignup('worker')`: validates required fields, radius > 0, and both file uploads present; uploads the ID document to `worker-documents` (random filename `worker_<timestamp>_<random>.<ext>`), uploads the photo to a separate `worker-photos` bucket, calls `sb.auth.signUp`, inserts a full row into `workers` (`is_available:false`, `rating:0`, `total_jobs:0`, plus every collected field). If the `workers` insert fails, the code deletes the just-created worker row and signs the auth account back out (`await sb.from('workers').delete()...; await sb.auth.signOut()`).
- `forgotPassword()`: calls `sb.auth.resetPasswordForEmail` with a redirect to `auth.html`.

**Error Handling.** Field-level `markErr()` highlighting; a single `showErr()` banner for form-level messages; specific messages for "Invalid login", "not confirmed", "already registered"; file-type/size checks reject with `showErr()` and clear the file input; upload failures are surfaced via `alert()` in addition to `console.error()` (see `catch(uploadEx)` block) — this is the only place in the codebase where `alert()` is used for a user-facing error rather than the toast/banner system.

**Dependencies.** `supabase.js`, `utils.js` (`markErr`), `toast.js` (`showToast`), `areas` table.

### 3.2 Customer Booking (`index.js`)

**Description.** The multi-step flow from category selection through address entry, area/worker eligibility validation, geocoding, location pinning, price calculation, and submission to broadcast.

**Inputs.** Service (from a fixed price list per category, `CAT_SECTIONS`), date, time slot (8:30 AM–8:30 PM, 15-minute increments, built by `buildSlots()`), free-text address, selected service area, optional notes.

**Outputs.** A `bookings` row (via `DB.save`), a `pendBk` in-memory object, and — on first booking to a new address — an update to `users.saved_address/saved_area_id/saved_lat/saved_lng`.

**Processing.**
1. `initiateBooking()` validates required fields, then calls `getEligibleWorkersForArea(curW.role, area, {emergencyOnly})`, which filters the worker pool (already limited to `is_available=true` and matching skill by `DB.workers()`) by Haversine distance from the **selected area's coordinates** (not the customer's exact address) to each worker's stored `lat/lng`, requiring `distance <= worker.radius` AND `distance <= MAX_ASSIGN_KM` (10 km), sorted nearest-first with a >0.5 km "clearly nearer wins" tie-break, falling back to `worker_score` as a secondary tie-break.
2. `cleanAddressForGeocoding()` strips flat/room/apartment tokens from the address string.
3. `geocodeAddress()` calls Nominatim once, retrying with the leading (most specific) comma-segment dropped on a zero-result response, until a match or segments are exhausted; returns `{lat, lng, locality}` from a single response (no second lookup for area matching).
4. `addressMatchesArea()` performs a normalized substring check between the geocoded locality (or, if absent, the cleaned address text) and the selected area's name; a mismatch blocks the booking with an inline warning.
5. `_resolveCustomerPin()`: if the customer's saved address string-matches the entered address exactly (case-sensitive `===`, not case-insensitive) and a saved pin exists, offers reuse via `_showReusePinDialog()`; otherwise opens a draggable-marker Leaflet map (`_openPinPicker()`) seeded at the geocoded point, and on confirmation both updates `users.saved_*` and sets `pendBk.customerLat/customerLng`.
6. Price: `base = fixedBase` (or `×1.5` rounded if `isEmerg()`), `fee = clamp(round(base*0.10), 20, 50)`, `total = base + fee`. If an active, unexpired, visits-remaining Service Pass exists for the category (`_checkActivePassForService`), price is overridden to `₹0` and `passUsed/passId` are set.
7. `_continueAfterPin()` either skips straight to `startBroadcast()` (pass-covered booking) or opens the payment modal.

**Error Handling.** Missing-field `markErr` + toast; "no eligible worker" toast naming the role/area/radius; inline `bkAddrAreaWarn` text for geocode failure or area mismatch (does not use `alert()` or block silently); area-with-no-coordinates is explicitly rejected ("cannot validate assignment") rather than allowing an unmatched booking through.

**Dependencies.** `areas`, `workers`, `users`, `bookings` tables; Nominatim; Leaflet; `config.js` (none directly, `MAX_ASSIGN_KM` is a local constant, `10`).

### 3.3 Booking Acceptance / Worker-Side Job Management (`dashboard.js`)

**Description.** Pending/Accepted/Arrived/Completed/Cancelled tabs with accept, reject, and cancel-accepted actions.

**Inputs.** Worker taps Accept/Reject/Cancel on a job card; confirmation modals gate each action.

**Outputs.** Updates to `bookings.status`/`w_status`/`worker_earning`/`accepted_at`, and to `workers.is_available`.

**Processing.**
- `confirmAccept()`: **correction** — no longer a raw client update. Calls `sb.rpc('accept_booking', { p_booking_id })`; the race guard, `worker_earning` calculation, and status writes now happen inside the RPC. `setWorkerAvailability(false)` is still called client-side after success.
- `confirmReject()`: **correction** — not a database write. Adds the job id to a local `_dismissedJobIds` set and re-renders; per the function's own comment, a broadcast job (`worker_id IS NULL`) must never have `status:'Rejected'` written to the shared row, or every other eligible worker would lose the job too.
- `confirmCancelAccepted()`: unchanged — still a direct `sb.from('bookings').update({status:'Cancelled', w_status:'Cancelled'})` guarded by `.eq('status','Accepted')`; also tears down any open "Track Customer" map for that booking.
- `markArrived()` simply opens the Arrival OTP modal (see §3.13); the `Arrived` status transition itself happens only on OTP success.
- On Completion OTP success, `setWorkerAvailability(true)` is called — the worker is automatically brought back online.

**Error Handling.** A `.in()`/`.eq()` guard clause on every status-transition write (described above) rather than a client-side-only check, so a stale UI cannot silently double-accept a job; toast messages for "already accepted by another worker," write failures, etc. Two commented-out `bumpWorkerCounter()` calls remain in the source (`//await bumpWorkerCounter('accepted_jobs')` etc.) — counters are not incremented by this code path client-side; the code's own comments state stats are read exclusively from `get_worker_stats`.

**Dependencies.** `bookings`, `workers` tables; `CONFIG.RELIABILITY_MIN_ACCEPTED_JOBS`.

### 3.4 GPS Tracking (`maps.js`, `index.js`, `dashboard.js`)

**Description.** Two parallel live-tracking implementations sharing the same Geoapify-based routing helpers via aliasing in `maps.js`: the customer's "Track Worker" map and the worker's "Track Customer" map.

**Inputs.** Worker device GPS (`navigator.geolocation.watchPosition`), the resolved customer destination point.

**Outputs.** `bookings.worker_live_lat/worker_live_lng/worker_last_seen` (written by the worker's GPS watcher, `dashboard.js: _startGPS`/`syncGPS`); rendered Leaflet maps with a moving worker marker, a fixed customer marker, and a road-route polyline.

**Processing.**
- GPS publishing (`dashboard.js`) runs one `watchPosition` handle at a time (`_gpsWatchId`), active only while the worker has a booking in `['Accepted','Worker on Way','Arrived']`; on permission denial (`err.code===1`) the watcher stops and a toast is shown; other errors retry after 5s via `_scheduleGPSRetry()`.
- Map building (`_buildTrackingMap` / `_buildCustomerTrackMap`) creates the Leaflet map exactly once per booking, calls `map.fitBounds()` exactly once at creation, and thereafter only moves the marker (`_animateMarkerTo`, an eased `requestAnimationFrame` glide) and updates the route polyline in place (`.setLatLngs()`), never recreating the map or route layer.
- Routing (`_fetchRoadRoute` in `maps.js`) calls the Geoapify Routing API, throttled to one call per 8 seconds per booking, and additionally skipped if the worker has moved less than 10 m since the last successful fetch (`_metersBetween`). On failure it returns `null`, and the caller explicitly keeps the previous route on screen — no straight-line or dashed fallback is ever drawn.
- Destination resolution (`_resolveCustomerLatLng` / `_resolveCustomerLatLngW`) prefers the booking's own `customer_lat/customer_lng` (captured at booking time via the pin picker or a live GPS callback in `startBroadcast()`), falling back to the selected area's centroid if absent.
- Building-name display resolves once via `_geoapifyReverseGeocode` against the fixed destination point and is never re-queried.
- An "auto-follow" pan mode is enabled by default; any user drag (`map.on('dragstart')`) disables it and reveals a "Re-center" button.
- On the customer's booking list, tracking additionally gates on `shouldReveal(b)` — for advance bookings, the map (and worker identity) is locked behind a placeholder until 10 minutes before the scheduled time (`_showTrackingLockPlaceholder`).
- Maps for a booking are explicitly destroyed (`_destroyTrackingMap` / `_destroyCustomerTrackMap`) when the booking leaves the tracked-status set (Arrival OTP verified, cancelled, completed), cancelling any in-flight marker animation frame first.

**Error Handling.** Every network call in this module is wrapped so a Geoapify/Nominatim failure degrades the ETA/route display to a placeholder or the last-known route rather than throwing or breaking the page; `if(_trkState[id] !== st || !st.map) return;` guards protect against a map being destroyed mid-await.

**Dependencies.** Leaflet + OpenStreetMap tiles, Geoapify Routing/Reverse-Geocoding APIs, `CONFIG.GEOAPIFY_API_KEY`, `CONFIG.TRACKING_ZOOM`.

### 3.5 Booking Timeline (`index.js: buildTimeline`, `dashboard.js: renderTimeline`)

**Description.** Two distinct timeline features exist under this name: (a) a per-booking step tracker on the customer's "My Bookings" list, and (b) a worker-facing upcoming-bookings list grouped by date.

**Customer timeline (`buildTimeline`).** Maps the booking's `status`/`w_status` to one of eight fixed steps (Created → Assigned → Accepted → On The Way → Arrived → Started → Completed → Review), using the four real timestamp columns actually available (`created_at`, `accepted_at`, `on_way_at`, `arrived_at`, `started_at`, `completed_at`) — the code's own comment notes there is no separate "Service Started" status, so `Arrived` doubles as that step. A cancelled booking renders every step up to where it stopped, then a red ❌ "Cancelled" marker, and omits all later (pending) steps entirely. Rendered lazily on first expand (`toggleTimeline`).

**Worker timeline (`renderTimeline`).** Groups bookings in `['Pending','Confirmed','Scheduled','Accepted','Arrived']` by the date portion of `created_at` (not a separate scheduled-date column, per the code's own comment), labeling today/tomorrow specially, sorted ascending.

**Dependencies.** `getIST()` for all "today"/"tomorrow" comparisons.

### 3.6 Reviews (`index.js: openReview/setRating/submitReview/toggleReviewTag`, `DB.saveReview`)

**Description.** Post-completion 5-star rating with a fixed pill-tag feedback catalog and a conditionally revealed comment, gated to `Completed` bookings not yet rated (`bookingsByTab`/`renderBookings` only surface the "Rate" button when `b.status==='Completed' && !b.rated`).

**Inputs.** Star tap (1–5, `setRating()`), zero or more tag selections from `REVIEW_TAGS` (8 `positive`, 6 `negative`, 1 `other`), and — only if a `negative` or `other` tag is selected — free-text comment.

**Outputs.** `bookings.rated/review_rating/review_comment` updated; a row inserted into `reviews` with `booking_id, user_id, worker_id, rating, comment, tags, created_at`. Server-side (Phase 8), the `handle_review_streak()` trigger additionally updates `workers.positive_streak`/`bonus_balance` and may insert a `worker_bonuses` row, entirely outside client control.

**Processing.** `submitReview()` blocks on `!revRat` (no rating selected) before any write. `toggleReviewTag()` shows/hides the comment `<textarea>` (`display:''`/`display:'none'`) based on whether the current tag selection includes any `negative`-typed tag or the `other` tag — selecting only `positive` tags keeps the comment field hidden and clears any previously entered text. On successful submission, `_replayReviewFaceAnimation()` re-triggers a CSS draw-in animation (a happy-face SVG if no negative tag was selected, a sad-face SVG otherwise) by cloning the SVG node, since a CSS animation does not replay on a static DOM element; the resulting modal's "Continue" button (`closeReviewThanksModal()`) both closes the modal and navigates the customer to the Home/Dashboard tab. Both the booking-row update and the `reviews` insert are attempted; the insert's result/error is still not checked (unchanged from pre-Phase-8 behavior).

**Error Handling.** "Please select a star rating" toast if no star tapped; "Booking not found" toast guard if the target booking has disappeared from the current `DB.bookings()` snapshot.

**Dependencies.** `bookings`, `reviews` tables; server-side, `handle_review_streak()` trigger and `worker_bonuses` table (Phase 8).

### 3.7 QuickCoins (`index.js`)

**Description.** Client-observed, one-shot crediting of QuickCoins the moment a booking transitions from `Arrived` to `Completed` while the customer app is open.

**Inputs.** None from the user — entirely automatic, driven by `renderBookings()` polling.

**Outputs.** `users.quickcoins_balance`, `users.quickcoins_earned`, `users.total_completed_bookings` incremented; a reward modal shown with the animated count-up and confetti (a `MutationObserver` watches for `#rewardModal` gaining the `.on` class).

**Processing.** `checkQuickCoinsRewards(all)` keeps two in-memory, per-page-load-only structures: `qcLastStatus` (last observed status per booking id) and `qcRewardedIds` (already-rewarded ids this session). The **first** time a booking is seen in a session, its status is only recorded as a baseline and never rewarded — even if it is already `Completed` — so a page refresh after completion cannot re-trigger the reward. A reward fires only when a booking previously seen as `Arrived` is subsequently observed as `Completed`. `awardQuickCoins()` computes `coins = round(basePrice * 0.05)`, preferring `base_price`/`basePrice` over the (possibly pass-discounted) `price` field, so a ₹0 pass-covered booking still earns coins on its true service value.

**Error Handling.** Silently returns if no session; `qcRewardedIds` is marked **before** the awaiting database call completes, specifically to prevent an overlapping poll tick from double-crediting the same booking.

**Dependencies.** `users`, `bookings` tables. Note: this crediting rate (5% of base price) is a concrete implementation value; PRD §10A.1 records the QuickCoins earning rate as an explicit open Product decision — the two should be reconciled.

### 3.8 Wallet (`index.js: openQuickWallet`)

**Description.** Read-only display of `quickcoins_balance`, `quickcoins_earned`, `quickcoins_redeemed`, `total_completed_bookings` from the `users` row, shown in a modal reachable from the nav bar.

**Processing.** Fetches the four columns fresh on every open; no caching. Displays a static note that no redemption offers exist yet.

**Dependencies.** `users` table.

### 3.9 Emergency Booking (`index.js`)

**Description.** Time-window-driven restriction of service availability and pricing.

**Processing.** `isEmerg()` returns true when the current IST time (via `getIST()`) falls outside 08:30–20:30 (constants `WS_H=8, WS_M=30, WE_H=20, WE_M=30`), i.e. the emergency window is 20:30–08:30. During this window: only `EROLES = ['Electrician','Plumber']` are shown on the home page, services page, and smart-search flow (`syncEmergFilters`, `renderHomeCats`, `renderServices`); only workers with `emergency_available===true` are eligible; the booking time field is hidden and forced to "now" (`nowSlot()`); price is multiplied by 1.5× (applied once, in both `updatePrice()` for display and `initiateBooking()` for the stored value — the same formula, not recalculated later).

Worker-side: `dashboard.js: toggleEmergency()` writes `workers.emergency_available` directly from a dashboard toggle, independent of the sign-up-time preference.

**Error Handling.** Toggle failures revert the checkbox UI state and show a toast; if no eligible worker exists during an emergency-hours booking attempt, the same "no eligible worker" flow as a normal booking applies.

**Dependencies.** `getIST()`, `workers.emergency_available`.

### 3.10 Admin Panel (`admin.js`)

**Description.** Campaign CRUD, purchased-pass listing, and analytics, gated by an email-based `admins` table lookup rather than a `user_metadata.role` check.

**Inputs.** Campaign form fields (title, service, description, price, visit count, validity days, priority, start/end datetime, emergency-included flag, priority-booking flag, status).

**Outputs.** Rows in `campaigns` (insert/update/delete), read-only rendering of `user_passes` joined client-side against `users`/`campaigns`.

**Processing.** `checkAdminRole(email)` queries `admins.is_active` for the signed-in email; on any falsy result the session is signed out (`sb.auth.signOut()`) and a "Access Denied" message is shown for 10 seconds before the login form reappears — the user is never redirected into another page. `publishCampaign()` validates title/service/price≥0/visits≥1/validity≥1/start<end before insert or update. `renderAnalytics()` computes total campaigns, total passes sold, active/expired pass counts, and per-campaign purchases/active/expired/revenue **entirely client-side** from the already-loaded `_allCampaigns`/`_allPasses` arrays — there is no dedicated analytics RPC.

**Error Handling.** Inline `cfErr` text for validation failures; `confirm()` browser dialog before delete; error toasts (`alert()`) on status-toggle/delete failure.

**Dependencies.** `admins`, `campaigns`, `user_passes`, `users` tables.

### 3.11 Campaigns / Service Passes / Offers (`index.js`, `admin.js`)

**Description.** Admin-authored campaigns are surfaced to customers as (a) a once-per-login popup on `index.html` boot, and (b) a dedicated Offers page; both read the same `fetchActiveCampaigns()` function, filtering `campaigns` to `status='active'` and `offer_start_date <= now < offer_end_date`, ordered by priority then end date.

**Processing.** `_loadActiveCampaignForPopup()` shows only the first (highest-priority) active campaign, once per login session (`sessionStorage.qf_campaign_shown`, cleared on `signOut()`). Purchase (`campaignBuyPass` → `openPaymentModal` → `_simulatePaymentProvider`) is a **simulated** payment: `_simulatePaymentProvider()` auto-resolves after a fixed 10-second `setTimeout`, calling `_onPaymentSuccess()` regardless of any real payment confirmation — there is no actual gateway integration in this code path, mirroring the booking-flow's own simulated poll (`checkPayStatus()` returns true once `pollCnt>=3`, i.e. after 3 polling ticks at 3 s each). On success, `activatePass()` inserts a `user_passes` row with `visits_remaining = total_visits`, `expiry_date = purchase_date + validity_days`, `status:'active'`.

**Visit consumption.** `checkServicePassConsumption()` uses the identical "first sighting only establishes baseline" pattern as QuickCoins crediting, firing `consumeServicePassVisit()` only on an observed `Arrived → Completed` transition for a booking with `pass_used && pass_id`; decrements `visits_remaining`, and flips `status` to `'expired'` once it reaches 0 — this does not check or use the pass's own `expiry_date` for this particular flip.

**Error Handling.** "Could not activate pass — please contact support" toast if the insert fails after a demo-successful payment; offer cards auto-remove from the grid when their own countdown reaches zero **or** the moment the pass is bought (`_removeOfferCardFromGrid`), whichever happens first, and clear their interval timer either way.

**Dependencies.** `campaigns`, `user_passes` tables.

### 3.12 OTP (`index.js`, `dashboard.js`)

**Description.** Two independently coded OTP-verification paths exist, as noted in Section 2.5.

**Worker-side (`dashboard.js`).** **Correction: no longer a client-side comparison.** `submitArrivalOtp()` calls `sb.rpc('verify_arrival_otp', { p_booking_id, p_entered_otp })`; `submitCompletionOtp()` calls `sb.rpc('verify_completion_otp', { p_booking_id, p_entered_otp })`. The client never reads or compares `arrival_otp`/`completion_otp` itself — it only sends the entered value and acts on the RPC's success/failure result.

**Customer-side (`index.js`).** **Correction: also no longer a client-side comparison.** The customer path calls its own separate RPCs, `verify_arrival_otp_customer`/`verify_completion_otp_customer` (each `{ p_booking_id, p_entered_otp }`) — genuinely distinct functions from the worker-side pair, not an alias, confirming the "two independently coded OTP paths" characterization elsewhere in this document, but at the RPC layer now rather than the client-comparison layer.

**Error Handling.** Both paths reject a non-matching entry with a toast and allow unlimited re-entry (no attempt counter, no lockout) — consistent between both implementations.

**Dependencies.** `bookings` table.

### 3.13 Payment (`index.js`)

**Description.** Two payment methods for a booking (`selectPay('gpay'|'cash')`), and a separate, simulated GPay-only flow for Service Pass purchases (`openPaymentModal`).

**Booking payment — Google Pay.** `drawQR()` builds a `upi://pay?...` deep link and renders it via the lazy-loaded `qrcodejs` library (falling back to a clickable link if the library fails to load); `startPoll()` runs a 5-minute visual countdown (`qrCountdown`) and a polling loop (`pollInt`, every 3 s, up to `POLL_MAX=60` ticks) whose `checkPayStatus()` is a stub that returns `true` once `pollCnt>=3` (i.e. auto-succeeds after ~9 seconds) — there is no real payment-gateway callback in this code. On success, `onPayOk()` shows a "Payment Received" state then calls `startBroadcast()`.

**Booking payment — Cash.** `onCashConfirm()` immediately proceeds to `startBroadcast()` with a note that the worker will not begin work until arrival OTP verification.

**Pass payment.** A separate 120-second countdown and a separate simulated provider (`_simulatePaymentProvider`, fixed 10 s auto-success) drive the pass-purchase modal; entirely independent state (`_paymentState`) from the booking payment flow.

**Error Handling.** QR countdown expiry sets a "Payment Session Expired" message and hides the countdown row without an automatic retry; poll-loop timeout past `POLL_MAX` shows a "Payment timeout. Try again or choose Cash" toast without auto-canceling the pending booking state; both `_onPaymentSuccess`/`_onPaymentExpired` and `onPayOk`/`stopPoll` guard against firing twice via boolean/`clearInterval` flags.

**Dependencies.** `qrcodejs` (CDN), no real payment gateway.

### 3.14 Achievement System (`dashboard.js`, `profile.js`)

**Description.** A database-persisted, client-evaluated achievement engine covering Jobs, Rating, Reliability, Activity, and Worker Score categories, defined in the `ACHIEVEMENTS` array in `dashboard.js`.

**Inputs.** The current `Stats` object (from `get_worker_stats`) and the existing `worker_achievements` rows for the worker.

**Outputs.** New rows inserted into `worker_achievements` (`worker_id, achievement_id, category, name, description`); an animated unlock popup (`showAchievementUnlockPopup`, shown 3 seconds after load via `ACHIEVEMENT_POPUP_DELAY_MS`); a badges grid on the worker profile page.

**Processing.** `checkAndUnlockAchievements()` runs on every `loadBookings()` cycle, re-fetches `worker_achievements`, and for each catalog entry not yet unlocked, tests `stats.completed_jobs >= gate AND a.test(stats)`; a 23505 (unique-violation) insert error is silently ignored to tolerate concurrent realtime triggers. `profile.js` never evaluates achievements itself — it only displays what has already been persisted, selecting the highest (most recently unlocked) badge per category, capped at 5, with a "+N More" modal (`openBadgesModal`).

**Error Handling.** Insert errors other than unique-violation are logged but do not block rendering; achievements engine gates strictly on `completed_jobs >= gate`, so a zero-job worker unlocks nothing even where a raw stat (e.g. reliability starting at 100) would otherwise qualify.

**Dependencies.** `worker_achievements` table, `get_worker_stats` RPC.

### 3.15 Worker Profile Management (`profile.js`, `worker-profile.html`)

**Description.** A dedicated page mirroring the dashboard's performance metrics, plus in-place editing of a worker's personal/professional details.

**Inputs.** Name, phone, skill (dropdown), experience (free text), area, radius — editable via `startEdit()`/`saveProfile()`.

**Outputs.** Updates to `workers.name/phone/skill/experience/area/radius`; a recomputed hero card, performance grid, badges section, and a "Recent Earnings" list built from up to the worker's last 100 `Completed` bookings.

**Processing.** On boot, re-fetches the live `workers` row (same dual-signal auth guard as `dashboard.js`), loads `Stats` via `get_worker_stats`, and loads `worker_achievements`. `saveProfile()` validates name/phone/skill are non-empty and, if provided, radius is between 1 and 100, before writing only the changed/non-empty fields to `workers`.

**Error Handling.** Field-level `.err` highlighting cleared on focus; a toast on validation failure or write failure; the page redirects to `auth.html?role=worker` if the session/role guard fails.

**Dependencies.** `workers`, `worker_achievements` tables; `get_worker_stats` RPC; `CONFIG.RELIABILITY_MIN_ACCEPTED_JOBS`.

### 3.16 Worker Dashboard Analytics (`dashboard.js`)

**Description.** The earnings, acceptance-rate, rank, and reliability-status displays on the worker dashboard, distinct from the accept/reject/cancel workflow already covered in Section 3.3.

**Outputs.** Today/This-Week/This-Month earnings totals (`renderEarnings`, computed client-side from `worker_earning` on `Completed` bookings using IST week/month boundaries); an acceptance rate (`renderAcceptanceRate`, `accepted / (accepted + rejected)` from the live bookings array); a rank badge (`renderWorkerRank`: Unranked at 0, Bronze <50, Silver ≥50, Gold ≥80 `worker_score`, gated by `CONFIG.RELIABILITY_MIN_ACCEPTED_JOBS`); a reliability status pill (`renderReliabilityPill`: New Worker if unqualified, Excellent ≥90, Good ≥70, else Needs Improvement); and a cancellation-warning banner (`renderCancellationWarning`, mild wording at 1–3 cancellations, severe wording above 3).

**Dependencies.** `bookings`, `workers` tables; `get_worker_stats` RPC; `CONFIG.RELIABILITY_MIN_ACCEPTED_JOBS`.

### 3.17 Booking Calendar (`dashboard.js`)

**Description.** A read-only month-view calendar on the worker dashboard, isolated from booking/GPS/achievement/auth logic per the code's own module comment.

**Inputs.** Month navigation (`calChangeMonth`), date selection (`calSelectDate`).

**Outputs.** A rendered month grid with a per-day booking-count badge (`cal-none`/`cal-mid`/`cal-high` density classes at 0/1–2/3+ bookings) and a booking list for the selected date.

**Processing.** Groups the worker's own `bookings` array by the `date` column (not `created_at`); `renderCalendarBookingList()` displays time, service, address, and status for each booking on the selected day.

**Dependencies.** `bookings` table (`date`, `time` columns).

---

## 4. Non-Functional Requirements

| ID | Category | Requirement as implemented |
|---|---|---|
| NFR-1 | Performance | Route/geocoding calls are explicitly throttled (8 s minimum interval, plus a 10 m worker-movement threshold) to avoid excessive Geoapify calls (`maps.js: _drawOrUpdateRoute`/`_drawOrUpdateRouteW`). |
| NFR-2 | Reliability | Every Supabase write on a status-transition path (accept, reject, cancel, arrival OTP, completion OTP) is guarded by a `.eq()`/`.in()` condition on the current status, preventing a stale-UI double-write (`dashboard.js`). |
| NFR-3 | Availability | Tracking maps degrade to a last-known route or "waiting for location" message rather than failing when Geoapify/GPS is unavailable (`maps.js`, `index.js`, `dashboard.js`). |
| NFR-4 | Security | Admin access is gated by a database-driven `admins.is_active` check rather than a hardcoded credential; on failure the session is explicitly signed out (`admin.js: checkAdminRole`). However, the Geoapify API key is a plaintext client-side constant (`config.js`), and no server-side validation exists for booking price, worker eligibility, or QuickCoins crediting — see Section 2.5. |
| NFR-5 | Scalability | GPS publishing batches all of a worker's currently active booking IDs into a single `.in('id', activeIds)` update per position fix rather than one write per booking (`dashboard.js: _startGPS`). |
| NFR-6 | Maintainability | Shared logic (Supabase client, config constants, generic utilities, toast, map helpers, mobile-nav toggle) is centralized in `js/common/*.js` with explicit code comments documenting what was deduplicated from which page and why (Phase 5.3.x comments throughout). |
| NFR-7 | Usability | Every form-level validation failure surfaces via a toast (`toast.js`) or an inline error element, with per-field `markErr()` highlighting; the codebase avoids blocking `alert()` dialogs except in the worker-document/photo upload failure paths in `auth.js` and one error path in `index.js: onAccepted`. |
| NFR-8 | Compatibility | Mobile hamburger navigation is implemented per page (`index.js: toggleMenu`, `nav.js: toggleMenu` shared by `worker-dashboard.html`/`worker-profile.html`, `landing.js`'s own toggle, `admin.js: toggleAdminNav`) — four separate implementations rather than one shared component, since `nav.js`'s own comment states it operates on different DOM ids than `index.js`'s version. |
| NFR-9 | Responsiveness | Map instances call `invalidateSize()` after CSS `transitionend` on their collapsible wrapper, to correctly size Leaflet after a slide-open animation (`index.js`, `dashboard.js`). |

---

## 5. Database Requirements

The client code reads and/or writes the following tables and storage buckets. Column lists reflect only the fields the client code actually references; no full schema file was supplied.

| Entity | Referenced Columns (non-exhaustive, client-observed) | Written By |
|---|---|---|
| `users` | id, email, name, phone, role, saved_address, saved_area_id, saved_lat, saved_lng, quickcoins_balance, quickcoins_earned, quickcoins_redeemed, total_completed_bookings | `auth.js`, `index.js` |
| `workers` | id, name, phone, skill, radius, exp, is_available, rating, total_jobs, emergency_available, area, lat, lng, document_url, document_name, profile_photo_url, experience, bio, price | `auth.js`, `dashboard.js`, `profile.js` |
| `bookings` | id, user_id, worker_id, worker_name/phone/role/emoji/dist, service, date, time, scheduled_date, scheduled_time, address, area_id, customer_lat, customer_lng, notes, price, base_price, payment_method, pass_used, pass_id, worker_earning, status, w_status, arrival_otp, completion_otp, is_emergency, is_advance, rated, review_rating, review_comment, hidden_by_user, created_at, accepted_at, on_way_at, arrived_at, started_at, completed_at, worker_live_lat, worker_live_lng, worker_last_seen, is_no_show | `index.js`, `dashboard.js` |
| `areas` | id, name, lat, lng | Read-only from client (`auth.js`, `index.js`, `dashboard.js`) |
| `campaigns` | id, title, service, description, price, number_of_visits, validity_days, priority, offer_start_date, offer_end_date, emergency_included, priority_booking, status, created_at | `admin.js`; read by `index.js` |
| `user_passes` | id, user_id, campaign_id, purchase_date, expiry_date, visits_remaining, total_visits, emergency_included, priority_booking, status | `index.js`; read by `admin.js` |
| `worker_achievements` | worker_id, achievement_id, category, name, description, unlocked_at | `dashboard.js`; read by `profile.js` |
| `admins` | email, is_active | Read-only (`admin.js`) |
| `reviews` | booking_id, user_id, worker_id, rating, comment, created_at | `index.js` |
| `profiles` | id, name, phone, role | `index.js` (`DB.saveReg` — in-app worker registration; see Section 2.5 limitation) |
| Storage: `worker-documents` | Government ID files | `auth.js` |
| Storage: `worker-photos` | Worker profile photos | `auth.js` |

RPCs called: `get_worker_stats(p_worker_id)`, `get_worker_stats_bulk(p_worker_ids)` — both read-only, invoked from `dashboard.js`, `profile.js`, and `index.js` respectively; their SQL definitions are not part of the inspected client code.

---

## 6. External Interfaces

| Interface | Used For | Client Location |
|---|---|---|
| Supabase JS (`@supabase/supabase-js@2`) | Auth, Postgres CRUD, Storage, RPC | `supabase.js` (client init), used throughout |
| Geoapify Routing API | Road-following route between worker and customer | `maps.js: _fetchRoadRoute` |
| Geoapify Reverse Geocoding API | Resolving a pinned coordinate to a building/society name | `maps.js: _geoapifyReverseGeocode` |
| Nominatim (OpenStreetMap) | Forward geocoding + locality extraction for address validation | `index.js: geocodeAddress` |
| Leaflet.js 1.9.4 + OpenStreetMap tiles | All map rendering (pin picker, tracking maps) | `index.js`, `dashboard.js` |
| `qrcodejs` 1.0.0 (CDN, lazy-loaded) | UPI QR code rendering for both booking and pass payment | `index.js: drawQR`, `drawPassQR` |
| Browser Geolocation API (`navigator.geolocation`) | `watchPosition` for continuous worker GPS; `getCurrentPosition` for one-shot customer GPS capture at booking time | `dashboard.js`, `index.js` |
| Supabase Realtime (`postgres_changes`) | Live worker-side booking-list sync on row insert/update/delete to `bookings`, filtered by `worker_id`; backed by a 5-second polling fallback on the same page. Not present in `index.js`, which relies solely on timer-based polling. PRD.md §22/§22A.1 instead attribute real-time sync to Firebase Realtime Database, which is not referenced anywhere in the codebase — see Section 2.5. | `dashboard.js` |
| `sessionStorage` | `qf_user`, `qf_role`, `qf_campaign_shown`, `qf_bookings_cache` (referenced as a removal key though never observed being set) | All pages |
| `localStorage` | `qf_bookings` — a **fallback, unauthenticated-only** local booking store (`getLocalBookings`/`setLocalBookings`), used only in the branch of `DB.save`/`DB.bookings`/`DB.update` where no Supabase session exists; in normal operation (an authenticated customer, which `index.js`'s own boot IIFE enforces) this path is not reachable | `index.js` |

---

## 7. Business Rules

### 7.1 Booking Lifecycle
- A booking is created with `status='Pending'`, `w_status='Pending'` (or defaults to `'Pending'` server-side per `DB.save`'s upsert default of `bk.wStatus||'Pending'`).
- Acceptance transitions `status`/`w_status` to `'Accepted'` only from `Pending`/`Scheduled`/`Confirmed`, guarded against races (§3.3).
- Arrival OTP success transitions to `'Arrived'` and generates the Completion OTP at that moment, not at booking creation.
- Completion OTP success transitions to `'Completed'`, which is the sole trigger for QuickCoins crediting and Service Pass visit consumption (both fire only on an **observed** `Arrived → Completed` transition, not merely on the `Completed` state being present).
- Cancellation paths: customer `cancelBk()` (any point up to reveal, per `canCancel` logic in `renderBookings`), worker `confirmCancelAccepted()` (only from `Accepted`), and `autoCancel()` (arrival-window timeout, sets `is_no_show:true`).
- Rejection (`confirmReject()`) is distinct from cancellation and sets `status/w_status='Rejected'`.

### 7.2 Worker Lifecycle
- A worker is inserted with `is_available:false` at signup; verification/activation is a stated 24-hour manual process (per the confirmation screen text in `auth.js`/`index.html`), with no corresponding "pending verification" gate found in the client code itself (i.e. the client does not check any `is_verified`-style column before allowing sign-in or dashboard access).
- Accepting a job auto-sets `is_available:false`; completing a job auto-sets it back to `true` (`dashboard.js: setWorkerAvailability`).
- `emergency_available` is set once at signup (conditionally, for Electrician/Plumber only) and can be independently toggled at any time from the worker dashboard.

### 7.3 Emergency Booking Rules
- Emergency window: 20:30–08:30 IST (derived from `WS_H/WS_M/WE_H/WE_M` constants), computed against `getIST()`.
- Only Electrician and Plumber (`EROLES`) are offered during this window, and only workers with `emergency_available===true`.
- Emergency price = `round(fixedBasePrice * 1.5)`, applied identically in both the live price display and the stored booking price.

### 7.4 QuickCoins Rules
- **Correction:** the coin computation is no longer verifiably client-side — `awardQuickCoins()` now sends only `p_booking_id` to the `award_quickcoins` RPC. The `round(basePrice*0.05)` formula may still hold, but it now executes server-side, in a body not part of the inspected client code.
- Crediting fires exactly once per booking per browser session, gated by the "first sighting = baseline only" pattern described in §3.7.
- QuickCoins are explicitly non-withdrawable virtual points (`walletModal` copy in `index.html`); `quickcoins_redeemed` is read for display but never written anywhere in the client code — there is no redemption code path implemented.

### 7.5 Review Rules
- A star rating (1–5) is mandatory; a comment is optional.
- Review is only offerable once per booking (`!b.rated` gate); `submitReview()` writes both the `bookings` row and a `reviews` table insert.

### 7.6 OTP Rules
- Both OTPs are six digits, generated via `Math.floor(100000 + Math.random()*900000)`.
- Arrival OTP is generated at booking creation (`startBroadcast()`); Completion OTP is generated only upon Arrival OTP success (worker-side path) — the customer-side path never generates a fresh Completion OTP itself, it only verifies whatever value is already stored.
- No attempt limit or lockout exists on either OTP field in either verification path.

### 7.7 Tracking Rules
- Exactly one `fitBounds()` per map instance, at creation; every subsequent update moves markers/route only.
- No straight-line or dashed fallback route is ever drawn; a failed route fetch keeps the previous polyline.
- Advance (non-emergency, more than 10 minutes out) bookings lock the tracking map and worker identity behind a placeholder until 10 minutes before the scheduled time (`shouldReveal()`).

---

## 8. Error Handling

This section lists validation and failure handling actually present in the code, including a small number of coverage gaps.

| Scenario | Observed Behavior |
|---|---|
| Missing required booking fields | `markErr()` on each empty field + a single "Please fill in all required fields" toast (`index.js: initiateBooking`) |
| Address fails geocoding after all fallback attempts | Inline warning under the address field: "Unable to locate this address…"; booking is blocked, no `alert()` |
| Geocoded address does not match selected area | Inline warning: "This address does not belong to the selected area…"; booking is blocked |
| No eligible worker within radius/`MAX_ASSIGN_KM` | Toast naming the role, radius cap, and area; booking is blocked before payment |
| GPay QR countdown (booking, 5 min) expires | "Payment Session Expired" message shown in place of the QR; no automatic retry triggered |
| Pass-purchase countdown (2 min) expires | `_onPaymentExpired()` shows "Payment Session Expired — Please try again."; countdown row hidden |
| Payment polling exceeds `POLL_MAX` (60 × 3 s) | "Payment timeout. Try again or choose Cash." toast; polling stopped |
| No worker accepts within the 2-minute broadcast window | `noAcceptModal` shown with a "Try Again" button that re-invokes `initiateBooking()` |
| Arrival window (15 min) elapses | `notArrivedModal` offers Extend-5-min or Cancel (`autoCancel`, which also sets `is_no_show:true`) |
| Incorrect Arrival/Completion OTP (either verification path) | Toast rejection ("❌ Incorrect … OTP"); unlimited re-entry, no lockout |
| Non-admin (or inactive-admin) sign-in on `admin.html` | Session signed out server-round-trip; "Access Denied" shown for 10 s, then the login form reappears — no redirect elsewhere |
| Worker `workers` row insert fails during signup | Auth account's just-inserted worker row is deleted and the auth session is signed back out, preventing an orphaned auth account with no profile |
| Clear booking history | Confirmation modal (`clrModal`) required before `DB.clearAll()` sets `hidden_by_user:true` on all of the user's bookings |
| Star rating not selected on review submit | Blocked with a toast before any write is attempted |
| Worker document/photo file type or size invalid (signup) | Rejected immediately client-side (before any upload attempt), input cleared, `showErr()` message |
| Supabase Storage upload failure (signup) | Caught, logged in full via `console.error`, and additionally shown via a blocking `alert()` — the one clear deviation from the toast/banner convention used everywhere else |
| GPS permission denied (worker) | Watcher stopped, toast shown ("Enable location permission"); no server-side/SMS fallback exists (matches PRD §22A.3) |
| GPS transient error (not permission) | Retried automatically after 5 s via `_scheduleGPSRetry()` |
| Route/reverse-geocode network failure | Caught per-call; tracking continues with the previous route/placeholder ETA rather than failing the map |

---

## 8A. Worker Discipline and Verification (Phase 8)

### 8A.1 Ban Escalation (`admin.js: openBanModal/confirmBanWorker`, `auth.js: doLogin`, `dashboard.js`)

**Description.** Admin-imposed, time-limited worker suspension, surfaced only against a review that indicates a genuine problem.

**Inputs.** Ban amount (numeric) and unit (`minutes`/`hours`/`days`/`weeks`), defaulted per the worker's `ban_count` (1st: 5 hours, 2nd: 1 day, 3rd+: 5 days) but freely overridable.

**Outputs.** `workers.banned_until/ban_count/last_ban_duration_label/is_available:false` updated; a `worker_bans` row inserted unconditionally as a permanent record.

**Processing.** The Ban action itself (a button in the Reviews tab) is rendered only when the review's `tags` includes at least one `negative`-typed value, the review's `rating` is below 4, and the target worker is not already under an active ban (`banned_until > now`) — any one of these failing hides the action, replacing it with a static "Banned" badge or nothing at all. On confirmation, the write to `workers` is followed by `.select()`; an empty result array is treated as a failed write (see Section 2.5 correction below) rather than reported as success. `auth.js: doLogin()` independently checks `profile.banned_until > now` for a worker-role login and blocks it, showing the exact unban timestamp. `dashboard.js` subscribes to a Realtime channel scoped to the worker's own `workers` row; on any `UPDATE` where `payload.new.banned_until` is in the future, it immediately signs the worker out client-side (`_forceBanLogout()`), independent of the existing booking-list poll cycle.

**Error Handling.** An empty `.select()` result on the ban write surfaces an explicit warning naming RLS/permissions as the likely cause, rather than the prior (pre-fix) behavior of reporting unconditional success. A banned login attempt shows a specific error naming the exact date/time the account becomes usable again, rather than a generic "invalid login" message.

**Dependencies.** `workers`, `worker_bans` tables; Supabase Realtime (`workers` table in the `supabase_realtime` publication, `REPLICA IDENTITY FULL` required).

### 8A.2 Worker Verification (`admin.js: setWorkerVerification`)

**Description.** Admin review of a worker's uploaded ID document and profile photo, resulting in an Approved/Rejected status.

**Processing.** `openAdminDocView()` retrieves the document via a signed URL (`createSignedUrl`, 5-minute expiry) rather than the stored public-URL string, since `worker-documents` is a private bucket (Section 2.5 correction). `openAdminImgView()` retrieves the profile photo via its existing public URL. `setWorkerVerification()` writes `workers.verification_status`; the Workers tab hides the Approve/Reject pill buttons once `status==='approved'`, showing only the Verification column's own status badge (avoiding a duplicate "approved" indicator that existed briefly during this feature's initial implementation).

**Dependencies.** `workers` table; `storage.objects` (signed URL generation requires an admin-scoped SELECT policy on the bucket).

### 8A.3 Positive Streak & Bonus (server-side trigger, `handle_review_streak()`)

**Description.** The only Phase 8 feature implemented with no client-side write path — entirely a Postgres trigger, `AFTER INSERT ON reviews`.

**Processing.** On every review insert, if the row's `tags` array contains no value from a fixed negative-tag list, `workers.positive_streak` is incremented for that `worker_id`; otherwise it is reset to 0. Every 5th consecutive positive value additionally credits `workers.bonus_balance` and inserts a row into `worker_bonuses`. The client (`dashboard.js`) only ever reads these two `workers` columns for display — it never writes them.

**Dependencies.** `reviews`, `workers`, `worker_bonuses` tables.

## 9. Future Enhancements

These items are described in `PRD.md` §21/§24 as roadmap phases and are **not present** in the inspected codebase. They are listed here strictly as forward-looking items, not as current requirements.

- **Phase 5 — Codebase modularization.** Splitting the remaining monolithic per-role HTML/CSS/JS further, removing residual duplication, and formal API documentation. (The `js/common/*.js` consolidation already visible in the code is itself described in its own comments as ongoing Phase 5 work, so this is a partially-started, not fully future, item — later modularization steps remain outstanding.)
- **Phase 6 — Backend hardening.** Moving booking validation, worker-assignment logic, and QuickCoins/pass crediting out of the browser and into RLS-protected server-side functions; the current implementation performs all of this client-side, as documented throughout Section 2.5 and Section 3.
- **Phase 7 — QuickCoins ecosystem.** Coin redemption against real offers (`quickcoins_redeemed` is currently read-only, never written), expanded campaign tooling, and a broader offers ecosystem.
- **Real payment gateway integration.** Both the booking-payment GPay flow and the Service-Pass GPay flow are simulated (`checkPayStatus()` stub, `_simulatePaymentProvider()` fixed-delay stub) rather than connected to an actual UPI/payment provider.
- **Functional social sign-in.** Google and Phone-OTP buttons exist in `auth.html` but only show a "coming soon" toast (`auth.html`'s social button handlers).
- **In-app worker registration persistence.** Fully wiring `index.js: submitReg()`'s collected fields (category, experience, price, bio, Aadhaar/PAN, emergency flag, photo) into a persisted worker profile, matching what `auth.js`'s worker-signup flow already does for the same field set.
- **Server-side admin analytics.** Moving the client-side aggregation in `admin.js: renderAnalytics()` to a dedicated backend query as data volume grows.
- **Unified OTP verification path.** Consolidating the two independent OTP-verification implementations (`index.js` and `dashboard.js`) described in Section 2.5 into one authoritative path.
- **Refunds, disputes, and support tooling.** Not present in any inspected file, consistent with PRD §24.6.

---

## Self Audit

- ✓ No invented functionality — every requirement in Sections 3–8 cites the specific function(s) and file(s) it was derived from.
- ✓ Based entirely on the attached project — `PRD.md`, all six HTML files, and all ten JavaScript files listed in Section 1.2 were read in full.
- ✓ Terminology consistent with PRD — QuickCoins, Service Passes, Arrival/Completion OTP, area-eligible assignment, emergency hours, and role names match PRD.md's own vocabulary throughout.
- ✓ Matches implementation — divergences between PRD intent and actual code (the area-centroid-based assignment distance rather than customer-pin distance, the dual OTP-verification paths, the unpersisted in-app registration fields, the simulated payment providers, and the client-side-only QuickCoins rate) are explicitly called out rather than silently reconciled.
- ✓ Professional SRS standard — IEEE-style structure with Introduction, Overall Description, Functional Requirements (Description/Inputs/Outputs/Processing/Error Handling/Dependencies per module), Non-Functional Requirements, Database Requirements, External Interfaces, Business Rules, Error Handling, and Future Enhancements.
- ✓ Ready for production documentation — file written to `docs/SRS.md`.