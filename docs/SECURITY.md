# Security Documentation
## QuickFix — On-Demand Home Services Marketplace

| Field | Detail |
|---|---|
| Document Type | Security Architecture and Reference Document |
| Basis | Direct inspection of all attached source files (`landing.html`, `auth.html`, `index.html`, `worker-dashboard.html`, `worker-profile.html`, `admin.html`, and every `js/*` file), cross-referenced against `docs/PRD.md`, `docs/SRS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md`, `docs/DEPLOYMENT.md`, and `docs/ROADMAP.md` |
| Critical Constraint | This document describes the security posture **as implemented**. It does not assert that any control exists unless it was directly observed in the client source or independently confirmed by a prior audited document. Where a control's existence cannot be verified from client-side code alone (most notably Row Level Security), this document states that explicitly as an open/unverifiable item rather than assuming it is either present or absent. |

---

## 1. Security Overview

### 1.1 Philosophy

QuickFix has no security-design document, threat model, or stated security philosophy anywhere in `PRD.md`, `SRS.md`, or the inspected source. The closest thing to a stated philosophy is `PRD.md` §22A.2's own admission: current booking validation, worker-assignment logic, and QuickCoins crediting run **client-side**, and this "should not be treated as a production-security posture." This document treats that statement as authoritative and does not attempt to characterize the current state as more secure than the project itself claims.

### 1.2 Current Implementation Summary

QuickFix is a client-heavy, backend-as-a-service application (`ARCHITECTURE.md` §2, §4). It has no custom application server, no custom REST/GraphQL API, and no server-side validation layer of its own (`API.md` §1.2, `DATABASE.md` §1). Every security-relevant mechanism that exists today is one of:

- **Supabase Auth** — identity, session issuance, and password management.
- **Supabase Postgres Row Level Security** — table-level access control, whose configuration is external to the inspected client code and therefore unverifiable from this codebase alone.
- **Client-side authorization checks** — role gates and session guards written in `auth.js`, `index.js`, `dashboard.js`, `profile.js`, and `admin.js`.
- **Client-side input validation** — form-level checks before writes are attempted.

There is no Web Application Firewall, no rate limiting, no CSRF token mechanism, no Content Security Policy, and no server-side logging/monitoring layer anywhere in the inspected source, because none of these has an application server to sit in front of.

### 1.3 Scope

This document covers authentication, authorization, database security, API/key security, data protection, tracking privacy, browser storage security, and input validation, strictly as observed in the six-page application (`landing.html`, `auth.html`, `index.html`, `worker-dashboard.html`, `worker-profile.html`, `admin.html`) and its shared `js/common/*` modules. It does not cover Supabase's own platform-level security (encryption at rest for the underlying Postgres instance, Supabase's infrastructure security, etc.), since that is outside the inspected project and not something this project configures beyond what is described in Section 4.

---

## 2. Authentication

### 2.1 Supabase Authentication

All authentication is handled by **Supabase Auth** through the single shared client instance `window.sb`, declared once in `js/common/supabase.js` (Phase 5.3.2 consolidation, per `CHANGELOG.md`). No custom authentication logic, password hashing, or token issuance exists in the project — these are entirely delegated to Supabase.

| Operation | Mechanism | Notes |
|---|---|---|
| Login | `sb.auth.signInWithPassword({ email, password })` | On success, reads `user_metadata.role`, fetches the matching `workers`/`users` row, and redirects by role. On failure, shows a form-level error banner (`API.md` §2). |
| Customer Signup | `sb.auth.signUp({ email, password, options: { data: { role: 'user' } } })` | Role is passed via Supabase Auth metadata, not a separate authorization table. Minimum password length is 6 characters (client-enforced). |
| Worker Signup | `sb.auth.signUp(...)` | Additionally uploads government ID and profile photo to Storage before the `workers` row insert. If the `workers` insert fails, the just-created Auth account is deleted (`sb.auth.signOut()`) to avoid an orphaned account with no profile (`API.md` §2). |
| Logout | `sb.auth.signOut()` | Also clears the app's own `sessionStorage` cache keys. |
| Password Reset | `sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/auth.html' })` | Delegates entirely to Supabase's built-in reset-token flow; no custom token handling exists in the client. |

### 2.2 Session Handling

The Supabase client is configured identically across every page (standardized in Phase 5.3.2, per `CHANGELOG.md`):

```
persistSession: true
autoRefreshToken: true
detectSessionInUrl: false
```

On top of the Supabase Auth session, the app layers its own **non-authoritative** cache in `sessionStorage` (`qf_user`, `qf_role`), read on page boot to avoid an extra round trip. This cache is explicitly not treated as a security boundary anywhere it is used: every protected page re-validates against `sb.auth.getSession()` and/or a live re-fetch of the corresponding `users`/`workers` row before granting access (`API.md` §1.4).

### 2.3 Password Management

- Minimum password length is enforced client-side only, at 6 characters (`auth.js`), for both customer and worker signup.
- No password-strength meter, complexity requirement, or breach-list check exists in the client.
- Password hashing, storage, and reset-token generation are entirely delegated to Supabase Auth; no such logic exists in the inspected project code.
- No account lockout, rate limiting, or brute-force protection on login attempts exists in the client. Whether Supabase enforces any such protection server-side cannot be confirmed from the client code.

### 2.4 Unimplemented Authentication Paths

- **Social sign-in (Google) and Phone-OTP authentication.** Buttons for both exist in `auth.html`, but each only displays a "coming soon" toast; there is no backing API integration (`API.md` §11, `SRS.md` §9). This document does not describe these as implemented.
- **Worker identity verification.** Worker "verification" is described in product copy as a manual 24-hour process, but there is no corresponding `is_verified`-style column check anywhere in the client before allowing a worker to sign in or reach the dashboard (`API.md` §2, `SRS.md` §7.2). A worker account is fully functional immediately after signup, regardless of whether any manual verification has actually occurred.

---

## 3. Authorization

QuickFix has three roles — customer, worker, admin — each gated by a different, independently implemented mechanism. There is no unified role/claims system; each page's gate was built separately (`ARCHITECTURE.md` §8–10).

### 3.1 Customer (`index.html`)

A boot-sequence IIFE checks `sb.auth.getSession()`; absence of a session redirects to `auth.html`. This is a single-signal check — no additional row re-fetch or role re-verification beyond the session's existence is performed before the customer app renders (`ARCHITECTURE.md` §8).

### 3.2 Worker (`worker-dashboard.html`, `worker-profile.html`)

A **dual-signal** check: `sessionStorage.qf_user` combined with `qf_role==='worker'`, plus a live re-fetch of the worker's own `workers` row. Failure of either signal redirects to `auth.html?role=worker` (`ARCHITECTURE.md` §9). This is stronger than the customer-side check in that it does not rely solely on the non-authoritative `sessionStorage` cache.

### 3.3 Admin (`admin.html`)

Gated by `checkAdminRole(email)`, which queries `admins.is_active` for the signed-in email — an **email allow-list table**, not a role claim on the Supabase Auth identity itself. Any falsy result immediately signs the session out (`sb.auth.signOut()`) and displays "Access Denied" for 10 seconds before the login form reappears; the user is never redirected elsewhere, which the code's own comment states is deliberate, to avoid surprising a logged-in user by bouncing them into another role's app (`ARCHITECTURE.md` §10, `API.md` §5). `PRD.md` §10 (NFR 8) additionally requires that the admin entry point not be linked from customer/worker navigation and not auto-redirect a non-admin into another role's app — both of which match the observed implementation.

### 3.4 Permission Boundaries — Verified Gap

**All of the above are client-side gates only.** None of them is backed by a confirmed database-level policy:

- The admin check queries `admins.is_active` from the browser. If Row Level Security is not independently enforcing the same restriction at the Postgres layer, a client capable of forging or replaying requests directly against the Supabase REST endpoint (bypassing `admin.js` entirely) could potentially read or write tables the admin UI gates, without ever passing the `is_active` check (`DATABASE.md` §9).
- The same caveat applies symmetrically to the worker dual-signal check and the customer session check: they gate which **page renders**, not which **database rows can be read or written**. Whether RLS independently enforces per-role restrictions on `workers`, `users`, `bookings`, `admins`, or any other table cannot be confirmed from the inspected client code, because no RLS policy definition or migration file was supplied with the project (`DATABASE.md` §9, `PRD.md` §22A.2).
- **Correction:** booking creation, OTP verification, pass activation, and QuickCoins crediting now go through server-side RPCs, not direct client writes (`ARCHITECTURE.md` §4, §12, corrected). Worker-assignment eligibility remains client-computed. RPC bodies are not part of the inspected client code, so their actual server-side enforcement can't be independently verified — this narrows, but does not close, the gap.

This gap is not resolved anywhere in the current codebase; it is explicitly named as Phase 6 work (Section 11).

---

## 4. Database Security

### 4.1 Row Level Security

**Unverifiable from the inspected client code.** RLS policy definitions live in Supabase's dashboard/migrations, which were not supplied with this project. This document cannot state whether RLS is enabled, partially enabled, or absent for any table — for `users`, `workers`, `bookings`, `admins`, `areas`, `campaigns`, `user_passes`, `worker_achievements`, `reviews`, or `profiles` (`DATABASE.md` §2, §9).

`PRD.md` §22A.2 independently confirms this same constraint at the product-requirements level: current client-side business logic "should not be treated as a production-security posture," and hardening RLS is listed as Phase 6 work.

### 4.2 Protected Tables

No table in the schema has a confirmed, verified access-control policy from this document's perspective. The tables holding the most security-sensitive data are:

| Table / Bucket | Sensitive Content | Access Path Observed |
|---|---|---|
| `admins` | Email allow-list gating the entire admin portal | Read from the browser via `sb.from('admins').select('is_active').eq('email', ...)` |
| `workers` | `document_url`, `document_name` (government ID references), live GPS fields | Read/written directly from `auth.js`, `dashboard.js`, `profile.js` |
| `bookings` | `arrival_otp`, `completion_otp` (plaintext), customer and worker GPS coordinates | Read/written directly from `index.js` and `dashboard.js` |
| `worker-documents` (Storage) | Government ID (Aadhaar/PAN) files | Public-URL retrieval (Section 6.2) |
| `worker-photos` (Storage) | Worker profile photos | Public-URL retrieval |

### 4.3 Sensitive Columns

- `bookings.arrival_otp`, `bookings.completion_otp` — six-digit OTP values stored as **plaintext columns**, with no attempt limit or lockout on either verification path (`DATABASE.md` §9, `API.md` §10). **Update:** verification itself has moved server-side (`verify_arrival_otp`/`_customer`, `verify_completion_otp`/`_customer` RPCs) — the client no longer reads or compares the plaintext value directly, which reduces (but given the still-unverified RLS/SELECT posture, does not confirm elimination of) client-side exposure of the correct OTP.
- `workers.document_url`, `workers.document_name` — reference government ID document uploads; no encryption-at-rest, retention, or deletion policy is defined anywhere in the inspected source (`PRD.md` §22A.5, an explicitly open compliance item).
- `users.quickcoins_balance`, `quickcoins_earned`, `quickcoins_redeemed` — wallet balance fields, writable via the same client-side crediting path described in Section 3.4.

### 4.4 Policies

No column-level `NOT NULL`, `CHECK`, or `UNIQUE` constraint can be confirmed from client code alone. The only indirect evidence that any database-level uniqueness constraint exists at all is `dashboard.js`'s handling of Postgres error code `23505` (unique-violation) when inserting `worker_achievements` rows under concurrent Realtime triggers (`DATABASE.md` §7). No other server-side policy — RLS, check constraint, or trigger — is observable from the client.

---

## 5. API Security

### 5.1 API Keys in Use

| Key | Location | Exposure |
|---|---|---|
| Supabase URL + anon key | Hardcoded constants in `js/common/supabase.js` | Sent from the browser on every Supabase call. Anon keys are designed by Supabase's own security model to be public-facing, protected by RLS rather than secrecy — but since this project's RLS configuration cannot be verified (Section 4.1), the practical protection this key currently receives is unconfirmed (`DEPLOYMENT.md` §3). |
| Geoapify API key | Hardcoded plaintext constant, `CONFIG.GEOAPIFY_API_KEY` in `js/common/config.js` | Sent as a plaintext URL query parameter on every Geoapify reverse-geocoding and routing call, made directly from the browser via `js/common/maps.js`. Unlike a Supabase anon key, Geoapify does not design this key to be safely public — it is billed and rate-limited per key, and is fully visible in browser network traffic (`API.md` §7, `DEPLOYMENT.md` §3). |

### 5.2 Supabase

All database, Auth, Storage, and Realtime access goes through the single `window.sb` client. There is no server-side proxy or intermediary between the browser and the Supabase project; every request originates directly from the user's browser using the credentials above.

### 5.3 Geoapify

Two Geoapify endpoints are called directly from the browser (`API.md` §7):

- **Reverse Geocoding** — resolves a pinned/tracking-destination coordinate to a human-readable name, called once per booking's fixed destination point.
- **Routing** — resolves a road-following route between worker and customer, throttled to at most once per 8 seconds per booking and skipped if the worker has moved less than 10 meters since the last successful fetch.

Both calls carry `CONFIG.GEOAPIFY_API_KEY` as a plaintext query parameter, with no server-side proxy shielding the key from exposure.

### 5.4 Client-Side Usage — Verified Gap

No server-side API layer of any kind exists in this project (`API.md` §1.2, `DATABASE.md` §1). All three keys in use (Supabase URL, Supabase anon key, Geoapify key) are committed as plaintext constants directly in version-controlled JavaScript source, not injected via environment variables, a build step, or a secrets manager (`DEPLOYMENT.md` §3). This is the single most consistently flagged gap across `PRD.md`, `DATABASE.md`, `API.md`, and `DEPLOYMENT.md`, and this document does not describe it as anything other than a current, unresolved limitation.

---

## 6. Data Protection

### 6.1 Sensitive User Information

`users` holds customer profile data, saved address/pin coordinates, and the QuickCoins wallet balance. There is no field-level encryption for any of this data; protection, if any, depends entirely on whatever RLS policy is configured server-side (unverifiable, Section 4.1).

### 6.2 Worker Information

Government ID documents (Aadhaar/PAN) and profile photos are uploaded to two Supabase Storage buckets (`worker-documents`, `worker-photos`) at worker signup, with randomized filenames (`worker_<timestamp>_<random>.<ext>`). Per `SRS.md`'s stated assumptions, these buckets accept **public-URL retrieval** — meaning anyone with a document's URL, not only an authenticated or authorized party, can retrieve it. No encryption-at-rest, retention period, or deletion policy is defined anywhere in the inspected source (`PRD.md` §22A.5, an explicitly flagged open compliance item that the PRD itself states must be resolved before production launch).

### 6.3 Reviews

Post-completion reviews (`reviews` table, plus mirrored `rated`/`review_rating`/`review_comment` fields on `bookings`) are customer-authored free text and a star rating. No profanity filter, moderation queue, or sanitization step beyond the shared `escHtml()` utility (Section 9.1) is applied before storage or display.

### 6.4 Wallet

QuickCoins balance fields on `users` are read on demand (`openQuickWallet()`) and credited automatically by client-side logic when `renderBookings()`'s polling observes an `Arrived → Completed` transition not yet rewarded this session (`API.md` §3). As with all client-side writes, the actual crediting write reaches Postgres directly from the browser, with no server-side validation of the credited amount.

### 6.5 Location Data

Worker live GPS coordinates (`worker_live_lat`, `worker_live_lng`, `worker_last_seen`) and customer booking coordinates (`customer_lat`, `customer_lng`) are stored directly on the `bookings` row and updated via batched writes during active tracking (Section 7).

---

## 7. Tracking Security

### 7.1 Worker GPS

Continuous worker location publishing uses `navigator.geolocation.watchPosition`, active only while a booking is `Accepted`/`Worker on Way`/`Arrived` (`dashboard.js: _startGPS`). Updates are batched — a single `.in('id', activeIds)` write per position fix across all of the worker's currently active bookings, rather than one write per booking (`DATABASE.md` §2, §10). Permission denial (`err.code===1`) stops the watcher and shows a toast; other errors trigger a retry after 5 seconds.

### 7.2 Customer Location

Customer location is captured once, via `navigator.geolocation.getCurrentPosition`, as a single input into pin resolution at booking time — not a continuous watcher (`API.md` §8).

### 7.3 Privacy Considerations — Verified Gap

- Worker GPS coordinates are written to a `bookings` row readable, at minimum, by that booking's own customer via the client-side tracking UI (`_buildTrackingMap()`). Whether any other party (another customer, an unauthenticated client hitting Supabase's REST endpoint directly) could also read these coordinates depends entirely on the unverified RLS configuration described in Section 4.1.
- There is no stated data-retention policy for GPS trail data on completed or cancelled bookings; coordinates remain on the `bookings` row indefinitely as far as the inspected code shows.
- Live tracking has no fallback if the worker's device revokes location permission mid-booking, beyond the toast/retry behavior in Section 7.1 — there is no SMS-based or server-side location fallback (`PRD.md` §22A.3).

---

## 8. Browser Security

### 8.1 Local Storage

`localStorage` is used for exactly one purpose: a fallback, unauthenticated-only local booking store (`qf_bookings`), read/written by `index.js: getLocalBookings()`/`setLocalBookings()`. This path is only reachable when `DB.save`/`DB.bookings`/`DB.update` detect no active Supabase session — a branch made unreachable in normal operation because `index.js`'s own boot IIFE redirects an unauthenticated visitor to `auth.html` before this code can run (`API.md` §3, `ARCHITECTURE.md` §8). No authentication token, session identifier, or sensitive personal data is ever written to `localStorage`.

### 8.2 Session Storage

`sessionStorage` holds the app's own lightweight, **non-authoritative** cache: `qf_user`, `qf_role`, `qf_campaign_shown`, and a referenced-but-never-set `qf_bookings_cache` key. It is cleared and rewritten on login, role selection, and logout. As established in Section 2.2, this cache is explicitly not relied upon as a security boundary anywhere in the codebase — every protected page independently re-validates via `sb.auth.getSession()` and/or a live database row re-fetch.

### 8.3 Clipboard

Not implemented. No `navigator.clipboard` call exists anywhere in the inspected source (`API.md` §8).

### 8.4 Geolocation

Used exactly as described in Section 7: `watchPosition` for continuous worker tracking, `getCurrentPosition` for one-shot customer pin capture. Both require the deployed site to be served over HTTPS for the Geolocation API to function in most modern browsers (`DEPLOYMENT.md` §8) — this is a Browser API requirement, not a project-implemented control.

---

## 9. Input Validation

### 9.1 Client-Side Validation

All observed validation in the codebase is client-side only — no server-side validation function, Postgres check constraint, or RLS-enforced write rule was found in the inspected source (`DATABASE.md` §7, consistent with `PRD.md` §22A.2 and `SRS.md` §2.5). Observed validation rules include:

| Rule | Location |
|---|---|
| Required signup fields; password length ≥ 6 | `auth.js` |
| Worker radius > 0 (signup), radius 1–100 (profile edit) | `auth.js`, `profile.js` |
| Worker document/photo file type and size (≤5MB) | `auth.js` |
| Address must geocode and match the selected service area before booking | `index.js` |
| Status-transition race guard (`.eq()`/`.in()` on current status at write time) | `index.js`, `dashboard.js` |
| Star rating required before review submission | `index.js` |
| Campaign title/service/price/visits/validity/date-order | `admin.js` |
| Achievement gate (`completed_jobs >= threshold AND test(stats)`) | `dashboard.js` |
| HTML escaping of user-rendered content | `escHtml()` in `js/common/utils.js` (Phase 5.3.4 shared utility, per `CHANGELOG.md`) |

### 9.2 Server-Side Validation

**None exists**, beyond whatever Row Level Security or Postgres constraints may or may not be configured server-side in Supabase — which, as established in Section 4.1, cannot be confirmed from the inspected client code. The status-transition race guard (`.eq()`/`.in()` on current status) is a client-issued conditional write, not a server-side enforcement mechanism; it prevents a stale-UI double-write from the same client, not a maliciously crafted request bypassing the UI entirely.

---

## 10. Known Security Limitations

The following are current, verified limitations — not speculative risks:

1. **Row Level Security cannot be confirmed.** No RLS policy definition or migration file exists in the inspected project; this document cannot state whether any table is protected at the database layer (Section 4.1).
2. **Client-side authorization only.** Admin, worker, and customer access gates all run in the browser; none is confirmed to be backed by an independent database-level policy (Section 3.4).
3. **Client-side business logic — narrowed.** Booking creation, OTP verification, pass activation, and QuickCoins crediting are now written via server-side RPCs (Section 3.4, corrected). Worker-assignment eligibility remains client-computed with no server-side re-check confirmed.
4. **Plaintext API keys.** The Supabase anon key and the Geoapify API key are both hardcoded plaintext constants in committed source files, with no environment-variable injection or server-side proxy (Section 5).
5. **Unencrypted OTPs with no lockout.** `arrival_otp` and `completion_otp` are stored as plaintext columns with unlimited re-entry attempts and no lockout mechanism (Section 4.3).
6. **Government ID documents are publicly retrievable by URL.** No authentication is required to fetch a worker's uploaded ID document or photo if the URL is known, and no retention/encryption/deletion policy exists for this data (Section 6.2, `PRD.md` §22A.5).
7. **Dual, inconsistent OTP verification paths.** `index.js` and `dashboard.js` each independently implement OTP verification for the same lifecycle transitions, with different side effects — only the worker-dashboard path nulls the OTP field and toggles worker availability (`ARCHITECTURE.md` §12, `API.md` §12).
8. **No account lockout or brute-force protection on login**, beyond whatever Supabase Auth may enforce server-side by default (unconfirmed from client code).
9. **No CI/CD, automated test suite, or security scanning pipeline** exists in the project (`CHANGELOG.md`, `DEPLOYMENT.md` §1).
10. **No backup or disaster-recovery procedure** is defined by the project; whatever protection exists is limited to Supabase's own platform-level backup tier, which is not project-configured (`DEPLOYMENT.md` §10).
11. **Worker "verification" is unenforced.** There is no `is_verified`-style gate preventing a worker from signing in and accepting jobs before any manual verification has occurred (Section 2.4).

---

## 11. Future Security Improvements

Only items already named as planned in `PRD.md` (§21.2, §24), `ROADMAP.md`, `SRS.md` (§9), or `CHANGELOG.md`'s "Next Planned Release" section are listed here; no speculative improvement is included.

- **Phase 6 — Backend Hardening (`PRD.md` §21.2).** Strengthen Supabase Row Level Security policies; relocate booking-price, worker-assignment, and QuickCoins-crediting logic server-side; secure API key handling (implying a server-side Geoapify proxy); optimize database queries for production-scale concurrency.
- **SQL schema and migration generation.** An authoritative, provisionable database script — none currently exists, since no schema file was supplied with the project (`CHANGELOG.md`, Next Planned Release).
- **Unified OTP verification path (`SRS.md` §9).** Consolidating the two independently coded OTP-writing paths (`index.js` and `dashboard.js`) into one authoritative function with consistent side effects.
- **Environment-variable / build-time configuration system (`DEPLOYMENT.md` §9).** Removing hardcoded plaintext secrets from committed source files.
- **Server-side Geoapify proxy (`DEPLOYMENT.md` §9).** Shielding the Geoapify key from browser-side exposure.
- **Government ID data-handling policy (`PRD.md` §22A.5).** A retention, encryption-at-rest, and deletion policy for the `worker-documents`/`worker-photos` Storage buckets, explicitly flagged as required before production launch.
- **Testing and CI (`CHANGELOG.md`, Next Planned Release).** Introducing an automated test suite and a CI pipeline, neither of which currently exists.
- **Backup and recovery procedure (`DEPLOYMENT.md` §10).** A defined backup/recovery procedure, currently absent.

---

## Document Status

This document was produced by direct inspection of the project's own source files and cross-referenced against `PRD.md`, `SRS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `DEPLOYMENT.md`, `ROADMAP.md`, and `CHANGELOG.md`. No security mechanism is described as implemented unless it was directly observed in the source or independently confirmed by one of these prior audited documents. Where a control's status could not be verified from the client code alone — most significantly, Row Level Security — this document states that explicitly rather than assuming either presence or absence.        