# Testing Documentation
## QuickFix — On-Demand Home Services Marketplace

| Field | Detail |
|---|---|
| Document Type | Testing Strategy and Manual Test Reference Document |
| Basis | Direct inspection of all attached source files (`landing.html`, `auth.html`, `index.html`, `worker-dashboard.html`, `worker-profile.html`, `admin.html`, and every `js/*` file), cross-referenced against `docs/PRD.md`, `docs/SRS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md`, and `docs/SECURITY.md` |
| Critical Constraint | **No test file, test framework, test runner configuration, or CI pipeline exists anywhere in the inspected project** (confirmed: no `*.test.js`, no `*.spec.js`, no Jest/Mocha/Playwright/Cypress config, no `package.json`). Every test case in this document is a **manual verification procedure** against the actual implementation, not a description of an automated suite that does not exist. Where this document proposes future automated coverage, it is explicitly labeled as not yet implemented under Section 9. |

---

## 1. Testing Overview

### 1.1 Purpose

This document gives QA engineers and developers a complete, implementation-grounded reference for verifying QuickFix's functionality, covering the customer, worker, and admin applications end to end. It exists to make manual verification repeatable and traceable to specific functions and files, since no automated test suite currently exists to serve that purpose.

### 1.2 Testing Philosophy

QuickFix has no stated testing philosophy, test plan, or QA process document anywhere in `PRD.md`, `SRS.md`, or the inspected source. This document does not invent one. It instead derives test cases directly from the behavior actually implemented — including the client-side-only validation, the two independently coded OTP paths, the simulated payment flows, and the documented error-handling conventions — rather than testing against an idealized or intended behavior not present in the code.

### 1.3 Current Testing Approach

**There is no automated testing in this project today.** `CHANGELOG.md`'s "Next Planned Release" section and `PRD.md` §21 both list "introducing an automated test suite and a CI pipeline" as future work, confirming neither exists yet. The only testing that has occurred, as far as the inspected source shows, is informal manual verification during development — evidenced indirectly by developer-authored inline comments describing known edge cases (e.g. the `dashboard.js` comment on `postgres_changes` not firing on `TRUNCATE`, or the `index.js` comment on the deliberately-unguarded `fmtDate(d)` implementation, per `CHANGELOG.md` Phase 5.3.4). This document formalizes that manual verification into a repeatable procedure; it does not claim any of it has been run as a scripted regression pass.

---

## 2. Test Environment

### 2.1 Browser

Testing must be performed in a modern evergreen browser supporting `fetch`, `IntersectionObserver`, `MutationObserver`, ES2017+ syntax (`async`/`await`, arrow functions, template literals, optional chaining), CSS custom properties, and the Geolocation API (`DEPLOYMENT.md` §2). No polyfill or transpilation target exists in the source, so legacy browsers (e.g. Internet Explorer 11) are explicitly out of scope for testing — there is no code path intended to support them.

The deployed or locally-served site must be served over **HTTPS** (or `localhost`, which most browsers treat as a secure context) for the Geolocation API to function; GPS-dependent test cases (Section 3.4, 4.4) will fail outright over plain HTTP on a non-localhost origin.

### 2.2 Supabase

A live, correctly provisioned Supabase project is a hard prerequisite for nearly every test case in this document. `supabase.js` hardcodes `SUPABASE_URL`/`SUPABASE_KEY` (`DEPLOYMENT.md` §3); testing against a project other than the one currently configured requires editing and redeploying `supabase.js` directly, since no environment-variable override exists. Before any test pass, confirm:

- The `admins`, `areas`, `bookings`, `campaigns`, `reviews`, `users`, `user_passes`, `workers`, `worker_achievements` tables exist and are reachable.
- The `worker-documents` and `worker-photos` Storage buckets exist and accept uploads.
- The `get_worker_stats`/`get_worker_stats_bulk` RPCs are deployed and callable.
- At least one `admins` row with `is_active:true` exists, to test the admin flow at all.
- At least one `areas` row with valid centroid coordinates exists, to test booking/eligibility flows at all.

### 2.3 Geoapify

A valid `GEOAPIFY_API_KEY` (hardcoded in `config.js`) with sufficient quota is required for routing and reverse-geocoding test cases (Section 4.2). Since routing/reverse-geocoding failures degrade gracefully rather than crash (`_fetchRoadRoute`'s try/catch, per `SRS.md` §3.4), testing should include **both** a valid-key pass and a deliberately invalid-key or rate-limited pass to confirm the graceful-degradation path (Section 6.5).

### 2.4 Internet

The application has no offline mode, service worker, or cached-asset fallback (`DEPLOYMENT.md` §2). Live connectivity is required at test time to reach: Supabase, Geoapify, Nominatim, the Leaflet/OpenStreetMap tile CDN, the `@supabase/supabase-js@2` CDN bundle, the `qrcodejs` CDN bundle, and Google Fonts. A network-outage test pass should specifically simulate the loss of each of these independently (Section 6.1) rather than assuming an all-or-nothing internet connection.

### 2.5 Development Setup

There is no build tool, package manifest, or dev-server requirement in the project (`DEPLOYMENT.md` §2). The six HTML entry points (`landing.html`, `auth.html`, `index.html`, `worker-dashboard.html`, `worker-profile.html`, `admin.html`) can be served directly by any static file server — Node's `npx serve` is usable as a convenience but is not a project dependency. Testing multiple roles simultaneously (e.g. a worker accepting a booking while a customer tracks it) requires either separate browser profiles/incognito windows or separate physical devices, since each role's session lives in that browser's own `sessionStorage`/Supabase Auth session.

---

## 3. Functional Testing

### 3.1 Authentication (`auth.js`, `auth.html`)

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Customer signup — valid | Fill first name, email, phone, password (≥6 chars); submit | `sb.auth.signUp` succeeds; `users` row inserted; `sessionStorage` cache written; redirect to `index.html` | `SRS.md` §3.1 |
| Customer signup — password too short | Enter a 5-character password | Client-side validation blocks submission before any Auth call | `auth.js` |
| Worker signup — valid | Fill all required fields, radius > 0, upload valid ID doc (≤5MB, `.jpg/.jpeg/.png/.pdf`) and profile photo (≤5MB, `.jpg/.jpeg/.png`); submit | Both files uploaded to their respective Storage buckets with randomized filenames; `workers` row inserted with `is_available:false`, `rating:0`, `total_jobs:0`; redirect | `SRS.md` §3.1 |
| Worker signup — `workers` insert fails after files uploaded | Force an insert failure (e.g. duplicate constraint) after successful file upload | The just-created `workers` row is deleted and `sb.auth.signOut()` is called, leaving no orphaned Auth account | `API.md` §2, `SECURITY.md` §2.1 |
| Worker signup — oversized/wrong-type file | Attempt upload of a 6MB file or a `.docx` file | Rejected client-side before any upload attempt; input cleared; `showErr()` message shown | `SRS.md` §8 |
| Worker signup — emergency checkbox visibility | Select Electrician or Plumber as skill vs. any other skill | Checkbox shown only for Electrician/Plumber (`toggleEmergencyField()`) | `SRS.md` §3.1 |
| Login — valid credentials | Enter correct email/password | Redirect to the correct role's page (`admin.html`/`worker-dashboard.html`/`index.html`) based on `user_metadata.role` | `API.md` §2 |
| Login — invalid credentials | Enter wrong password | Form-level banner: "Invalid login credentials" | `API.md` §10 |
| Login — unconfirmed email | Attempt login on an unconfirmed account | Form-level banner: "Email not confirmed" | `API.md` §10 |
| Password reset | Submit forgot-password with a valid email | `sb.auth.resetPasswordForEmail` triggers Supabase's built-in email flow, redirect target `auth.html` | `API.md` §2 |
| Logout | Trigger logout from any protected page | `sb.auth.signOut()` called; relevant `sessionStorage` keys cleared; `qf_campaign_shown` also cleared | `SRS.md` §3.11 |
| Social sign-in / Phone-OTP buttons | Tap Google sign-in or Phone-OTP button on `auth.html` | "Coming soon" toast only — no Auth call is made | `API.md` §11 |
| Worker verification gate | Sign up as a worker and immediately attempt login | No `is_verified`-style check exists — the account is fully functional immediately, regardless of manual verification status | `SECURITY.md` §2.4 |

### 3.2 Customer Booking Flow

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Category/time-slot selection | Select a service category and a time slot from the 8:30 AM–8:30 PM, 15-minute grid | Slot list built by `buildSlots()` renders correctly | `SRS.md` §3.2 |
| Address geocode success | Enter a valid, geocodable address within a served area | `geocodeAddress()` resolves via Nominatim; area match passes | `SRS.md` §3.2 |
| Address geocode failure | Enter an unrecognizable address string | Inline warning "Unable to locate this address…"; booking blocked, no `alert()` | `SRS.md` §8 |
| Address/area mismatch | Enter a real address that geocodes outside the selected service area | Inline warning "This address does not belong to the selected area…"; booking blocked | `SRS.md` §8 |
| No eligible worker | Book a service/area combination with no available, in-radius worker | Toast naming the role, radius cap, and area; booking blocked before payment | `API.md` §10 |
| Pin reuse | Book to an address that exactly (case-sensitive) matches a previously saved address | `_showReusePinDialog()` offers reuse of the saved pin instead of the picker | `SRS.md` §3.2 |
| Manual pin picker | Book to a new address | Draggable-marker Leaflet picker (`_openPinPicker()`) opens, seeded at the geocoded point | `SRS.md` §3.2 |
| Price calculation — standard | Book a non-emergency service | `total = base + clamp(round(base*0.10), 20, 50)` | `SRS.md` §3.2 |
| Price calculation — emergency | Book during the 20:30–08:30 IST window | `base` multiplied by 1.5×, then the same fee formula applied | `SRS.md` §3.9 |
| Service Pass override | Book a category covered by an active, unexpired, visits-remaining pass | Price overridden to ₹0; `passUsed`/`passId` set; flow skips straight to broadcast | `SRS.md` §3.2 |
| Booking cancellation | Cancel a booking from the customer's list before the tracking-reveal point | `status:'Cancelled'` written; permitted per `canCancel` logic | `API.md` §3 |
| Clear booking history | Trigger "Clear History" with at least one booking present | Confirmation modal (`clrModal`) required; on confirm, all of the user's bookings get `hidden_by_user:true` (soft-hide, not delete) | `SRS.md` §8 |

### 3.3 Worker Job Management (`dashboard.js`)

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Accept a pending job | Tap Accept on a `Pending` job card, confirm | `worker_earning = round(price*0.80)`; `accepted_at`, `status='Accepted'`, `w_status='Accepted'` set; `setWorkerAvailability(false)` called | `SRS.md` §3.3 |
| Double-accept race | Two workers attempt to accept the same job near-simultaneously | The second write fails the `.in('status', [...])` guard; toast shown for "already accepted by another worker" | `SRS.md` §3.3 |
| Reject a job | Tap Reject, confirm | `status='Rejected'`, `w_status='Rejected'` | `SRS.md` §3.3 |
| Cancel an accepted job | Tap Cancel on an `Accepted` job, confirm | `status='Cancelled'`, `w_status='Cancelled'`, guarded by `.eq('status','Accepted')`; open "Track Customer" map torn down | `SRS.md` §3.3 |
| Mark arrived | Tap "Mark Arrived" | Opens the Arrival OTP modal only — no status transition occurs until OTP success | `SRS.md` §3.3 |
| Auto-return online after completion | Complete a job via Completion OTP | `setWorkerAvailability(true)` called automatically | `SRS.md` §3.3 |
| Emergency toggle | Toggle "Available During Emergency Hours" on the dashboard | `workers.emergency_available` updated directly; failure reverts the checkbox and shows a toast | `SRS.md` §3.9 |

### 3.4 Admin Workflow (`admin.js`)

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Admin login — active admin | Sign in with an email present in `admins` with `is_active:true` | Access granted to `admin.html` | `SRS.md` §3.10 |
| Admin login — inactive/non-admin | Sign in with an email absent from `admins` or with `is_active:false` | Session signed out; "Access Denied" shown for 10 seconds, then the login form reappears; user is never redirected elsewhere | `API.md` §5, `SECURITY.md` §3.3 |
| Admin portal not linked from other roles | Inspect customer/worker navigation for a link to `admin.html` | No such link exists (`PRD.md` §10, NFR 8) | `PRD.md` §10 |
| Campaign creation — valid | Fill title, service, price ≥0, visits ≥1, validity ≥1, start < end; submit | Row inserted into `campaigns` | `SRS.md` §3.10 |
| Campaign creation — invalid date order | Set start date after end date | Inline `cfErr` validation blocks submission | `SRS.md` §3.10 |
| Campaign delete | Delete an existing campaign | Browser `confirm()` dialog shown before deletion proceeds | `SRS.md` §3.10 |
| Analytics accuracy | Compare `renderAnalytics()`'s displayed totals (campaigns, passes sold, active/expired counts, per-campaign revenue) against the raw `campaigns`/`user_passes` data | Figures match, since they are computed entirely client-side from already-loaded arrays, not a server-side aggregate | `SRS.md` §3.10 |

### 3.5 Booking Lifecycle (End-to-End)

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Full happy-path lifecycle | Customer books → worker accepts → tracking activates → Arrival OTP verified → service performed → Completion OTP verified → QuickCoins credited → review prompted | Each transition matches `PRD.md` §14 exactly, in order, with no skipped state | `PRD.md` §14 |
| No worker accepts in time | Broadcast a booking to an area with no available worker willing to accept within the window | `noAcceptModal` shown with "Try Again," re-invoking `initiateBooking()` | `SRS.md` §8 |
| Arrival window elapses | Let 15 minutes pass after broadcast without Arrival OTP verification | `notArrivedModal` offers Extend-5-min or Cancel; Cancel path calls `autoCancel`, which also sets `is_no_show:true` | `SRS.md` §8 |

### 3.6 Tracking

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Tracking map activation | Accept a booking | Both "Track Worker" (customer) and "Track Customer" (worker) maps activate | `PRD.md` §15 |
| Marker movement without map recreation | Let the worker's GPS update several times during an active tracking session | Marker animates via `_animateMarkerTo` (eased `requestAnimationFrame`); route updates via `.setLatLngs()`; map/marker/route layer are never recreated | `SRS.md` §3.4 |
| Route/ETA fallback | Simulate a Geoapify routing failure mid-tracking | Previous route/ETA is retained on screen; no straight-line or dashed placeholder is drawn | `SRS.md` §3.4 |
| Advance-booking reveal lock | Track a booking scheduled more than 10 minutes in the future | Worker identity/map locked behind a placeholder (`_showTrackingLockPlaceholder`) until the 10-minute mark | `SRS.md` §3.4 |
| Map teardown | Verify Arrival OTP, or cancel/complete a booking | `_destroyTrackingMap`/`_destroyCustomerTrackMap` called; in-flight marker animation frame cancelled | `SRS.md` §3.4 |
| Building-name resolution | Complete a booking's pin selection | Reverse-geocoded name shown identically on both customer and worker dashboards, resolved once and never re-queried | `PRD.md` §15 |

### 3.7 Wallet and QuickCoins

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Automatic crediting | Complete a booking (Completion OTP success) while the customer app is open and polling | `checkQuickCoinsRewards()` observes `Arrived → Completed`; `coins = round(basePrice*0.05)` credited; reward modal with count-up/confetti shown | `SRS.md` §3.7 |
| No double-credit on refresh | Complete a booking, then refresh the customer app | The completed booking is only recorded as a session baseline on first sighting post-refresh; no re-reward fires | `SRS.md` §3.7 |
| No double-credit on overlapping poll | Force two overlapping polling ticks around a completion event | `qcRewardedIds` is marked before the DB call resolves, preventing a duplicate credit | `SRS.md` §3.7 |
| Pass-covered booking still earns coins | Complete a ₹0, pass-covered booking | Coins computed from `base_price`, not the discounted `price` | `SRS.md` §3.7 |
| Wallet display | Open the Quick Wallet modal | `quickcoins_balance`, `quickcoins_earned`, `quickcoins_redeemed`, `total_completed_bookings` fetched fresh, no caching | `SRS.md` §3.8 |
| Redemption unavailable | Attempt to redeem QuickCoins from the wallet UI | No redemption action exists; static note that no offers are active | `PRD.md` §17 |

### 3.8 Reviews

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Review prompt gating | Check for a "Rate" button on bookings in various states | Shown only when `status==='Completed' && !b.rated` | `SRS.md` §3.6 |
| Submit without rating | Attempt to submit a review with no star selected | Blocked with a "Please select a star rating" toast before any write | `SRS.md` §3.6 |
| Submit valid review | Select a star rating, optionally add a comment, submit | `bookings.rated/review_rating/review_comment` updated; a `reviews` row inserted | `SRS.md` §3.6 |
| Booking disappears mid-review | Open the review modal, then have the underlying booking removed from the current `DB.bookings()` snapshot before submit | "Booking not found" toast guard | `SRS.md` §3.6 |

---

## 4. Integration Testing

### 4.1 Supabase

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Shared client instantiation | Load any page and inspect `window.sb` | A single canonical instance exists, declared once in `supabase.js`, used identically by every page | `CHANGELOG.md` Phase 5.3.2 |
| Session persistence across reload | Log in, reload the page | Session persists (`persistSession:true`); the user remains authenticated without re-entering credentials | `API.md` §1.4 |
| Auto token refresh | Remain logged in past the Auth token's expiry window | `autoRefreshToken:true` renews the session transparently | `API.md` §1.4 |
| Storage bucket write | Complete worker signup with valid files | Files land in `worker-documents`/`worker-photos` with randomized filenames; public URLs are retrievable without authentication | `SECURITY.md` §6.2 |

### 4.2 Geoapify

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Reverse geocoding — field preference | Reverse-geocode a coordinate with multiple available name fields | Resolution order `building → amenity → name → housename → street → suburb → locality` is respected | `CHANGELOG.md` Phase 4.7 |
| Reverse geocoding — no match | Reverse-geocode a coordinate with none of the above fields present | Returns `null`; UI handles the absence without error | `API.md` §7 |
| Routing throttle | Trigger multiple routing calls for the same booking within 8 seconds | Only the first call fires; subsequent calls within the window are skipped | `SRS.md` §3.4 |
| Routing distance skip | Move the simulated worker location less than 10 meters between ticks | Routing call is skipped even if the 8-second throttle window has elapsed | `SRS.md` §3.4 |
| Routing failure | Force a Geoapify routing failure (invalid key or network block) | Returns `null`; caller keeps the previous route on screen | `SRS.md` §3.4 |

### 4.3 Realtime

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Worker booking-list live sync | While a worker dashboard is open, insert/update/delete a row on `bookings` with that worker's `worker_id` from another session | `worker-bookings-<worker_id>` channel fires; `loadBookings()` re-runs | `DATABASE.md` §8 |
| Polling fallback | Simulate a scenario where `postgres_changes` does not fire (e.g. a bulk reset/TRUNCATE) | The 5-second polling fallback on the same page still picks up the change | `CHANGELOG.md`, `DATABASE.md` §8 |
| Customer app has no Realtime channel | Inspect `index.js` for any `channel(`/`postgres_changes` call while a booking updates | None exists; the customer app relies entirely on interval-based polling | `DATABASE.md` §8, `ARCHITECTURE.md` §8 |

### 4.4 GPS

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Continuous worker publishing | Move a worker's simulated location while a booking is `Accepted`/`Worker on Way`/`Arrived` | `navigator.geolocation.watchPosition` fires; `worker_live_lat/lng/last_seen` updated | `SRS.md` §3.4 |
| Batched writes | Have a worker with two or more simultaneously active bookings | A single position fix produces one `.in('id', activeIds)` write covering all active bookings, not one write per booking | `DATABASE.md` §2, §10 |
| Permission denial | Deny location permission on the worker's device | Watcher stops; toast shown ("Enable location permission"); no server-side/SMS fallback occurs | `SRS.md` §8 |
| Transient GPS error | Simulate a non-permission GPS error (e.g. timeout) | Automatic retry after 5 seconds via `_scheduleGPSRetry()` | `SRS.md` §8 |
| One-shot customer capture | Trigger customer pin resolution with location permission granted | `navigator.geolocation.getCurrentPosition` fires once, feeding `_resolveCustomerPin()`; no continuous watcher is started | `API.md` §8 |

---

## 5. UI Testing

### 5.1 Responsive Layout

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Cross-device rendering | Render `landing.html`, `auth.html`, `index.html`, `worker-dashboard.html`, `worker-profile.html`, `admin.html` at 4K, desktop, laptop, tablet, foldable, large-phone, and small-phone widths, portrait and landscape | Fluid CSS Grid/Flexbox layouts adapt correctly; no fixed-width breakage; desktop layout/color/typography/business logic unchanged | `PRD.md` §10, NFR 1 |
| Admin table horizontal scroll | View an admin data table wider than the viewport on a small screen | The table scrolls horizontally within its own container with headers remaining visible; the page itself never scrolls sideways | `PRD.md` §10, NFR 3 |

### 5.2 Forms

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Required-field highlighting | Submit any form (signup, booking, campaign, profile edit) with required fields empty | `markErr()` highlights each empty field | `SRS.md` §8 |
| Touch target sizing | Interact with buttons/tabs/inputs on a mobile-width viewport | Elements are sized appropriately for touch (`PRD.md` §10, NFR 4) | `PRD.md` §10 |

### 5.3 Navigation

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| Mobile nav drawer — shared implementation | Open the hamburger menu on `worker-dashboard.html` and `worker-profile.html` at a mobile breakpoint | Both use the shared `toggleMenu()` from `nav.js` (Phase 5.3.7.1 consolidation); opens on tap, closes on outside click or item selection | `CHANGELOG.md` Phase 5.3.7.1 |
| Mobile nav drawer — independent implementations | Repeat on `index.html`, `landing.html`, and `admin.html` | Each operates its own independent nav-toggle implementation against different DOM ids; behavior should still match the shared pattern even though the code is not shared | `CHANGELOG.md` Phase 5.3.7.1 |
| Emergency-hours category filtering | Load the customer home page inside vs. outside the 20:30–08:30 IST window | Inside the window, only Electrician/Plumber categories are shown; outside, the full catalog is shown | `SRS.md` §3.9 |

### 5.4 Validation

| Test Case | Steps | Expected Result | Reference |
|---|---|---|---|
| HTML escaping of user content | Submit a review comment or campaign field containing `<script>`/HTML tags | Content is escaped via `escHtml()` before rendering, not executed as markup | `CHANGELOG.md` Phase 5.3.4 |
| Worker radius bounds | Edit a worker profile's radius to 0 or 150 | Rejected client-side (valid range is 1–100 on profile edit; > 0 required at signup) | `SRS.md` §3.15, §3.1 |

---

## 6. Error Handling Tests

All entries below are traced to `API.md` §10 and `SRS.md` §8, which independently document the same set of observed behaviors.

### 6.1 Network Failures

| Scenario | Expected Behavior |
|---|---|
| Nominatim unreachable during address geocoding | Inline warning "Unable to locate this address…"; booking blocked, no `alert()` |
| Geoapify unreachable during tracking | Route/reverse-geocode call caught per-call; tracking continues with the previous route/placeholder ETA rather than failing the page |
| Leaflet/OpenStreetMap tile CDN unreachable | Map tiles fail to render, but no code path in the client is designed to catch or notify this specific failure — treat as an unhandled gap, not a tested behavior |
| Supabase temporarily unreachable | Generic `console.error(error.message)` plus a toast/inline banner in most write paths |

### 6.2 Authentication Failures

| Scenario | Expected Behavior |
|---|---|
| Invalid login credentials | Form-level banner: "Invalid login credentials" |
| Unconfirmed email | Form-level banner: "Email not confirmed" |
| Already-registered email at signup | Form-level banner reflecting the Supabase Auth error message |
| Non-admin/inactive-admin sign-in attempt on `admin.html` | Session signed out; "Access Denied" for 10 seconds; login form reappears; no redirect elsewhere |

### 6.3 Database Failures

| Scenario | Expected Behavior |
|---|---|
| `workers` row insert fails after signup uploads succeed | Just-created worker row deleted; auth session signed back out; no orphaned account |
| Storage upload failure during worker signup | Caught, logged via `console.error`, **and** surfaced via a blocking `alert()` — the sole documented deviation from the toast/banner convention |
| Review `reviews` insert failure | Not checked by the client — the insert's result/error is silently ignored (a documented gap, not a handled case) |
| Achievement insert unique-violation (23505) under concurrent Realtime triggers | Silently ignored/tolerated; other insert errors are logged but do not block rendering |

### 6.4 GPS Failures

| Scenario | Expected Behavior |
|---|---|
| Permission denied (`err.code===1`) | Watcher stopped; toast shown ("Enable location permission"); no server-side/SMS fallback |
| Transient GPS error (not permission) | Automatic retry after 5 seconds via `_scheduleGPSRetry()` |

### 6.5 API Failures

| Scenario | Expected Behavior |
|---|---|
| GPay QR countdown (5 min) expires | "Payment Session Expired" message shown in place of the QR; no automatic retry |
| Pass-purchase countdown (2 min) expires | `_onPaymentExpired()`: "Payment Session Expired — Please try again."; countdown row hidden |
| Payment polling exceeds `POLL_MAX` (60 × 3s) | "Payment timeout. Try again or choose Cash." toast; polling stopped; pending booking state is **not** auto-cancelled |
| No worker accepts within the broadcast window | `noAcceptModal` with "Try Again," re-invoking `initiateBooking()` |
| Incorrect Arrival/Completion OTP (either path) | Toast rejection; unlimited re-entry, no attempt counter or lockout |
| Arrival window (15 min) elapses with no Arrival OTP success | `notArrivedModal` offers Extend-5-min or Cancel; Cancel triggers `autoCancel` and sets `is_no_show:true` |
| Service Pass activation fails after simulated payment success | "Could not activate pass — please contact support" toast |

---

## 7. Manual Test Cases

The following are step-by-step end-to-end procedures for the four major workflows. Each should be executed against a live Supabase/Geoapify environment (Section 2).

### 7.1 Customer: Book a Standard Service, End to End

1. Sign up or log in as a customer.
2. From the home page, select a non-emergency service category and sub-service.
3. Select a valid date and time slot.
4. Enter a real, geocodable address within a configured service area; confirm no area-mismatch warning appears.
5. Confirm or place the map pin.
6. Review the displayed price; confirm it equals `base + clamp(round(base*0.10), 20, 50)`.
7. Choose Cash payment; confirm the flow proceeds directly to broadcast with a note that work begins only after Arrival OTP.
8. As a worker (separate session), accept the booking; confirm `worker_earning = round(price*0.80)` and the worker is set unavailable.
9. As the customer, confirm the "Track Worker" map appears showing a live route and ETA.
10. As the worker, arrive and enter the Arrival OTP shown to the customer; confirm the tracking map collapses and a Completion OTP is generated.
11. As the worker, enter the Completion OTP; confirm the worker is automatically set available again.
12. As the customer, confirm QuickCoins are credited (`round(base_price*0.05)`) with the reward modal shown, and the review prompt appears.
13. Submit a star rating and comment; confirm the `reviews` row and `bookings.rated` update both occur.

### 7.2 Worker: Signup Through First Completed Job

1. Complete worker signup with a valid ID document and profile photo; confirm both Storage uploads succeed and the `workers` row is created with `is_available:false`.
2. Log in; confirm no verification gate blocks dashboard access despite no manual verification having occurred.
3. Toggle availability on.
4. Wait for or trigger a compatible customer booking; confirm the job appears in the Pending tab.
5. Accept the job; confirm the race guard behavior if a second simulated worker attempts to accept the same job concurrently.
6. Progress through Arrival OTP and Completion OTP entry as in Section 7.1, steps 10–11.
7. Confirm the worker's earnings, acceptance rate, and rank badge update on the dashboard after completion.
8. Confirm any newly qualifying achievement unlocks and displays the popup after the configured 3-second delay.

### 7.3 Admin: Campaign Lifecycle

1. Log in with an `admins.is_active:true` account; confirm access.
2. Attempt login with a non-admin or inactive-admin account in a separate session; confirm "Access Denied" behavior and that the customer/worker apps carry no link to `admin.html`.
3. Create a new campaign with valid title/service/price/visits/validity/date range; confirm it saves and appears in the campaign list.
4. As a customer, confirm the new campaign surfaces via the once-per-login popup (if highest priority) and on the Offers page.
5. Purchase a pass as a customer; confirm the simulated 10-second payment auto-succeeds and the pass appears on "My Passes."
6. Complete a booking eligible for the purchased pass; confirm price shows ₹0 and `visits_remaining` decrements by one afterward.
7. Return to the admin analytics view; confirm totals reflect the new pass sale.
8. Delete the campaign; confirm the browser `confirm()` dialog appears before deletion proceeds.

### 7.4 Emergency Booking

1. Set the test environment's clock (or wait) to fall within 20:30–08:30 IST.
2. Load the customer home page; confirm only Electrician and Plumber categories are shown.
3. Confirm the booking time field is hidden and forced to "now."
4. Initiate a booking; confirm only workers with `emergency_available===true` are eligible and the price reflects the 1.5× multiplier.
5. As a worker, confirm the emergency toggle on the dashboard independently controls `emergency_available` regardless of the sign-up-time preference.

---

## 8. Regression Testing

The following workflows are critical-path and should be re-verified after any change touching their dependencies, since none is covered by an automated suite:

| Workflow | Why It's Critical | Re-test Trigger |
|---|---|---|
| Login/signup/logout for all three roles | Every other workflow depends on a working session | Any change to `auth.js` or `supabase.js` |
| Full booking lifecycle (Section 7.1) | The core product transaction | Any change to `index.js` or `dashboard.js` |
| Dual OTP verification paths (customer-side and worker-side) | Two independently coded implementations with different side effects; a fix in one does not imply a fix in the other | Any change to OTP logic in either `index.js` or `dashboard.js` |
| Status-transition race guards (`.eq()`/`.in()` conditions) | Prevents double-accept, double-complete, and other concurrency bugs | Any change to a `bookings.status`/`w_status` write |
| GPS write batching and tracking teardown | Prevents excessive writes and memory leaks from orphaned map instances | Any change to `maps.js` or `_startGPS` |
| QuickCoins/Service-Pass "first-sighting baseline" pattern | Prevents double-crediting/double-consumption on refresh or overlapping polls | Any change to `checkQuickCoinsRewards` or `checkServicePassConsumption` |
| Admin gate (`checkAdminRole`) | The only barrier protecting the admin portal | Any change to `admin.js` or the `admins` table structure |
| Shared common modules (`supabase.js`, `config.js`, `utils.js`, `toast.js`, `maps.js`, `nav.js`) | Consolidated in Phases 5.3.2–5.3.7.1; a regression here affects every page that imports the module | Any change to `js/common/*` |

---

## 9. Future Testing

Only items already named as planned in `PRD.md` (§21), `CHANGELOG.md`'s "Next Planned Release," or implied directly by the absence documented elsewhere in this project's docs are listed here; no speculative testing program is invented.

- **Automated test suite and CI pipeline.** No test framework, test file, or CI configuration exists anywhere in the project (`CHANGELOG.md`, `DEPLOYMENT.md` §9). This is listed as explicit future work in `CHANGELOG.md`'s "Next Planned Release."
- **Security testing.** Penetration testing and RLS-policy verification are needed to resolve the unverifiable Row Level Security status documented throughout `SECURITY.md` (Sections 4.1, 10). No such testing has occurred against this codebase as far as the inspected source shows.
- **Load/concurrency testing.** `PRD.md` §21.2 lists "support for concurrent users at production scale" as Phase 6 work; no load-testing procedure or tooling exists today, and client-side aggregation (admin analytics, worker stats) has not been tested against production-scale data volumes (`DATABASE.md` §10).
- **Performance testing.** No performance benchmark, Lighthouse baseline, or load-time budget is defined anywhere in the inspected source.
- **Unified OTP path testing.** Once the two OTP verification paths are consolidated (`SRS.md` §9, `CHANGELOG.md` Next Planned Release), the dual-path regression case in Section 8 should be retired and replaced with a single-path test.
- **Backend-hardening regression suite (Phase 6, `PRD.md` §21.2).** Once booking-price, worker-assignment, and QuickCoins-crediting logic move server-side, this document's Section 3.2/3.7 test cases will need to be re-authored against the new server-side behavior rather than the current client-side implementation.

---

## Document Status

This document was produced by direct inspection of the project's own source files and cross-referenced against `PRD.md`, `SRS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `DEPLOYMENT.md`, `ROADMAP.md`, `CHANGELOG.md`, and `SECURITY.md`. No test case describes behavior that was not directly observed in the source or independently confirmed by one of these prior audited documents. No automated test suite is claimed to exist; every test case in Sections 3–7 is a manual verification procedure.