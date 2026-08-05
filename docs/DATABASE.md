# Database Documentation
## QuickFix — On-Demand Home Services Marketplace

| Field | Detail |
|---|---|
| Document Type | Database Architecture and Reference Document |
| Basis | Direct inspection of all attached source files (`landing.html`, `auth.html`, `index.html`, `worker-dashboard.html`, `worker-profile.html`, `admin.html`, and every `js/*` file), cross-referenced against `docs/PRD.md`, `docs/SRS.md`, and `docs/ARCHITECTURE.md` |
| Critical Constraint | **No SQL schema file, migration file, or `CREATE TABLE` statement was supplied with the project.** Every table, column, primary key, foreign key, and constraint described in this document is inferred from client-side `sb.from('<table>').select/insert/update/delete/upsert()` calls, `.eq()`/`.in()` filter clauses, and RPC invocations found in the JavaScript source. Where a constraint (primary key, foreign key, uniqueness, nullability) cannot be directly observed from a client-side write or filter, this document states that explicitly rather than asserting it as fact. |
| Convention | Every table and column listed here was verified against at least one `sb.from(...)` call in the source. No table, column, or relationship appears in this document unless it was found in the code. |

---

## 1. Database Overview

QuickFix has no application-level database layer of its own. It uses **Supabase** as a complete backend-as-a-service: PostgreSQL for relational storage, Supabase Auth for identity, Supabase Storage for file uploads, Supabase RPC for two read-only server-side functions, and Supabase Realtime for one push-sync channel. There is no ORM, no custom API server, and no server-side validation layer between the browser and Postgres beyond what Supabase itself provides (Row Level Security, if configured — see Section 9).

All database access happens through a single, page-wide Supabase client instance, `window.sb`, instantiated once in `js/common/supabase.js` and reused as a bare global identifier (`sb`) by every page-specific script (`auth.js`, `index.js`, `dashboard.js`, `profile.js`, `admin.js`).

**Purpose of the database**, as evidenced by the tables actually read and written by the client:
- Persist user identity and role separation (customer vs. worker vs. admin) alongside the Supabase Auth account.
- Persist the full booking lifecycle, including price, assignment, OTPs, timestamps, and GPS tracking fields, on a single `bookings` table.
- Persist worker professional data (skill, radius, availability, location) used for the client-side assignment algorithm.
- Persist a fixed catalog of service areas used for both address validation and worker eligibility.
- Persist post-completion reviews, a QuickCoins loyalty balance on the `users` row, purchasable Service Pass campaigns and the passes customers buy against them, and a worker achievement/badge history.
- Gate the admin portal through a dedicated `admins` table rather than a role flag on the primary user identity.

No schema definition file was supplied; every table below is documented strictly from client-observed reads and writes.

---

## 2. Database Design Philosophy

The following observations describe the design **as implemented**, not a target-state philosophy — no design-principles document was supplied for this project.

| Principle | Observed implementation |
|---|---|
| Normalization | Partial. `areas` is a normalized lookup table referenced by `id` from `bookings.area_id` and `users.saved_area_id`. However, `workers.area` stores the area's **name as a plain text string** (`selectedArea.name`, from `auth.js`), not a foreign key to `areas.id` — a genuine denormalization inconsistency between how workers and how bookings/users relate to areas (see Section 5). `bookings` also denormalizes worker identity directly onto the row (`worker_name`, `worker_phone`, `worker_role`, `worker_emoji`) rather than requiring a join to `workers` at render time. |
| Scalability | Client-side aggregation (admin analytics, worker earnings/acceptance-rate calculations) reads full row sets into the browser rather than delegating to server-side aggregate queries, with the two `get_worker_stats`/`get_worker_stats_bulk` RPCs being the sole exception — see `ARCHITECTURE.md` §15. |
| Security | Table access control (Row Level Security policies) is not part of the inspected client code — RLS policy definitions live in Supabase's dashboard/migrations, which were not supplied. The client code's own comments and the PRD (§22A.2) both state that authorization for sensitive writes (booking price, worker assignment, QuickCoins crediting) currently relies on the browser doing the right thing, not on a verified RLS policy. This is stated as an open constraint, not resolved by this document. |
| Performance | The only client-driven performance optimization at the data-access layer is GPS write batching (`dashboard.js: _startGPS`, a single `.in('id', activeIds)` update per position fix instead of one write per active booking). No other indexing or query-optimization evidence exists in the client code, since indexes are a schema-level concern outside the inspected files. |

---

## 3. Entity Overview

The following entities are referenced by table name in the client code. Each is elaborated in Section 4.

| Entity | Client Table Name | Primary Role |
|---|---|---|
| Customer/User Account | `users` | Customer profile, saved address/pin, QuickCoins wallet balance |
| Worker Account | `workers` | Worker professional profile, availability, location, rating |
| Booking | `bookings` | The full booking lifecycle record — the central table of the system |
| Service Area | `areas` | Fixed lookup list of service areas with centroid coordinates |
| Campaign (Service Pass offer) | `campaigns` | Admin-authored promotional offer definitions |
| User Pass | `user_passes` | A customer's purchased instance of a campaign |
| Worker Achievement | `worker_achievements` | Persisted unlocked-badge records for a worker |
| Admin | `admins` | Email allow-list gating the admin portal |
| Review | `reviews` | Post-completion rating/comment records |
| In-App Worker Registration | `profiles` | A partial, currently-incomplete alternate worker-registration path (see Section 4.9) |
| Storage: Worker Documents | `worker-documents` (bucket) | Government ID files uploaded at worker signup |
| Storage: Worker Photos | `worker-photos` (bucket) | Worker profile photos uploaded at worker signup |

No other table, bucket, or entity is referenced anywhere in the inspected source. Wallet and QuickCoins are **not** separate tables — both are columns on the existing `users` row (see Section 4.1); this document does not invent a dedicated `wallet` or `quickcoins` table, since none exists in the code.

---

## 4. Table Documentation

### 4.1 `users`

**Purpose.** Stores the customer-facing account profile, saved address/pin for booking reuse, and the QuickCoins wallet balance. Written by `auth.js` (creation) and `index.js` (updates).

**Primary Key.** `id` — inferred as the Supabase Auth user id, since `auth.js`'s signup flow inserts this row keyed to the just-created auth account and all later reads filter `.eq('id', user.id)`. No explicit `PRIMARY KEY` constraint was observed (no schema file supplied).

**Foreign Keys.** `saved_area_id` → `areas.id` (inferred: `index.js` writes this column with an area's `id` value and `auth.js`/`index.js` resolve the area by matching this id against the loaded `areas` list).

**Important Columns.**

| Column | Purpose |
|---|---|
| `email`, `name`, `phone` | Basic identity fields collected at signup |
| `role` | Distinguishes customer accounts (worker accounts use the separate `workers` table instead) |
| `saved_address`, `saved_area_id`, `saved_lat`, `saved_lng` | The customer's reusable pinned location, written on first successful booking to a new address (`index.js: _resolveCustomerPin`) |
| `quickcoins_balance`, `quickcoins_earned`, `quickcoins_redeemed` | QuickCoins wallet fields, displayed read-only in `openQuickWallet`; `quickcoins_redeemed` is read but never written anywhere in the client code — no redemption path exists |
| `total_completed_bookings` | Incremented alongside QuickCoins crediting on an observed `Arrived → Completed` transition |

**Validation Rules (client-side).** Signup requires email, phone, and a minimum 6-character password (`auth.js: doSignup('user')`); no other field-level constraint on this table was observed in the client code.

**Relationships.** One-to-many with `bookings` (`bookings.user_id`), one-to-many with `user_passes` (`user_passes.user_id`), one-to-many with `reviews` (`reviews.user_id`), many-to-one with `areas` via `saved_area_id`.

**Indexes (recommended, not confirmed present).** `id` (primary key access pattern), `saved_area_id` (joined against `areas`). No index definitions were found in the client code, since indexes are a schema-level concern outside the inspected files.

---

### 4.2 `workers`

**Purpose.** Stores the worker's professional profile, availability state, live/base location, and performance summary fields. Written by `auth.js` (creation), `dashboard.js` (availability/emergency toggles, GPS publishing), and `profile.js` (profile edits).

**Primary Key.** `id` — inferred as the Supabase Auth user id, by the same pattern as `users.id` (verified: `auth.js` inserts this row immediately after `sb.auth.signUp` for the worker role, and deletes it again if the insert itself fails, keying the delete back to the just-created row).

**Foreign Keys.** None confirmed. Notably, `area` stores the **area's name as a plain text string** (`selectedArea.name`, written directly in `auth.js`'s worker-signup insert), not an `area_id` foreign key to `areas.id`. This is a verified inconsistency relative to `bookings.area_id` and `users.saved_area_id`, both of which store the area's numeric/id value. No corrective assumption is made here — the inconsistency is reported as observed.

**Important Columns.**

| Column | Purpose |
|---|---|
| `name`, `phone`, `skill`, `radius`, `exp`/`experience`, `bio`, `price` | Professional profile fields collected at signup and editable via `profile.js: saveProfile()` |
| `is_available` | Toggled by the worker (`toggleAvailability()`) and automatically by the system on job accept/complete (`setWorkerAvailability()`) |
| `emergency_available` | Set once at signup (Electrician/Plumber only) and independently toggleable from the dashboard (`dashboard.js: toggleEmergency()`) |
| `rating`, `total_jobs` | Initialized at signup (`rating:0, total_jobs:0`); no client-side write path to these two specific columns beyond initialization was found — worker performance is otherwise surfaced through the `get_worker_stats` RPC, not through direct updates to these columns |
| `area`, `lat`, `lng` | The worker's registered service area (by name, see above) and base coordinates, used by the customer-side Haversine assignment algorithm |
| `document_url`, `document_name`, `profile_photo_url` | Public URLs/metadata for the two Supabase Storage uploads performed at signup |

**Validation Rules (client-side).** Signup requires full name, phone, email, skill, radius > 0, area, years of experience, both file uploads (ID document and profile photo, type/size checked before upload), and a minimum 6-character password (`auth.js: doSignup('worker')`). Profile edits (`profile.js: saveProfile()`) require non-empty name/phone/skill and, if radius is provided, a value between 1 and 100.

**Relationships.** One-to-many with `bookings` (`bookings.worker_id`), one-to-many with `worker_achievements` (`worker_achievements.worker_id`), one-to-many with `reviews` (`reviews.worker_id`).

**Indexes (recommended, not confirmed present).** `id` (primary key access pattern); `area` and `skill` together (used to pre-filter the worker pool before the Haversine distance check in `index.js: getEligibleWorkersForArea`); `is_available` (filtered on every assignment attempt).

---

### 4.3 `bookings`

**Purpose.** The central table of the system — the full lifecycle record for a single service booking, from creation through payment, assignment, GPS tracking, OTP verification, completion, and review. Written by `index.js` (customer side) and `dashboard.js` (worker side).

**Primary Key.** `id` — inferred from every `.eq('id', ...)` update/select call across `index.js` and `dashboard.js`.

**Foreign Keys.** `user_id` → `users.id`; `worker_id` → `workers.id`; `area_id` → `areas.id`; `pass_id` → `user_passes.id` (only populated when `pass_used` is true).

**Important Columns.**

| Column | Purpose |
|---|---|
| `status` | Customer-facing lifecycle state: `Pending`, `Accepted`, `Arrived`, `Completed`, `Rejected`, `Cancelled` |
| `w_status` | A separate worker-facing status column that can diverge from `status` (e.g. `status='Pending'` with no `w_status` yet) |
| `worker_name`, `worker_phone`, `worker_role`, `worker_emoji`, `worker_dist` | Worker identity fields denormalized directly onto the booking row at assignment time, rather than requiring a join to `workers` for display |
| `service`, `date`, `time`, `scheduled_date`, `scheduled_time` | Booked service and slot; the worker dashboard calendar and timeline group by `date`, not by a separate scheduling table |
| `address`, `area_id`, `customer_lat`, `customer_lng` | Address and resolved geocoded/pinned coordinates used both for assignment-area validation and as the tracking-map destination |
| `notes` | Optional customer notes |
| `price`, `base_price` | `price` may be discounted to `0` for a Service-Pass-covered booking; `base_price` always holds the true, undiscounted service value and is what QuickCoins are calculated against |
| `payment_method` | `gpay` or `cash` |
| `pass_used`, `pass_id` | Whether a Service Pass covered this booking, and which `user_passes` row |
| `worker_earning` | `round(price * 0.80)`, set on acceptance |
| `arrival_otp`, `completion_otp` | Six-digit OTP values; `arrival_otp` is generated at booking creation, `completion_otp` is generated only on Arrival OTP success (worker-side path) |
| `is_emergency`, `is_advance` | Emergency-hours flag and advance-booking flag (drives the tracking-lock placeholder) |
| `rated`, `review_rating`, `review_comment` | Review state mirrored onto the booking row in addition to the dedicated `reviews` table insert |
| `hidden_by_user` | Set by `clrModal`/`DB.clearAll()` to soft-hide a booking from the customer's history without deleting the row |
| `created_at`, `accepted_at`, `on_way_at`, `arrived_at`, `started_at`, `completed_at` | Lifecycle timestamps; the customer timeline (`buildTimeline`) uses these directly, noting there is no separate "Service Started" status — `arrived_at` doubles for that step |
| `worker_live_lat`, `worker_live_lng`, `worker_last_seen` | Written continuously by the worker's GPS watcher during active tracking |
| `is_no_show` | Set by the customer-side `autoCancel()` on an arrival-window timeout |

**Validation Rules (client-side).** Required-field checks before booking creation (`markErr` + toast); address must geocode and must match the selected area before submission is allowed; every status-transition write (`Accepted`, `Rejected`, `Cancelled`, both OTP transitions) is guarded by a `.eq()`/`.in()` condition on the row's current status at write time, preventing a stale-UI double-write.

**Relationships.** Many-to-one with `users`, many-to-one with `workers`, many-to-one with `areas`, many-to-one (optional) with `user_passes`, one-to-one (optional) with a `reviews` row.

**Indexes (recommended, not confirmed present).** `user_id`, `worker_id` (both heavily filtered — the worker Realtime channel itself filters `worker_id=eq.<id>`), `status`/`w_status` (filtered on every tab render), `date` (used by the worker calendar), `area_id`.

---

### 4.4 `areas`

**Purpose.** A fixed, admin/back-office-maintained lookup table of service areas with centroid coordinates, used for address-area validation, worker-eligibility distance calculation, and the area dropdown at worker signup. Read-only from the client (`auth.js`, `index.js`, `dashboard.js`); no client-side insert/update/delete path was found.

**Primary Key.** `id`.

**Foreign Keys.** None — this is a lookup table referenced by other tables, not one that references others.

**Important Columns.** `id`, `name`, `lat`, `lng` — confirmed directly from `auth.js`'s query: `sb.from('areas').select('id,name,lat,lng').order('name',{ascending:true})`.

**Validation Rules.** None client-side; this table is read-only from every inspected script. An area with no coordinates is explicitly rejected by the booking flow ("cannot validate assignment") rather than silently allowed through.

**Relationships.** One-to-many with `users` (via `saved_area_id`), one-to-many with `bookings` (via `area_id`). **Not** referenced by `workers` via foreign key — see the `workers.area` inconsistency noted in Section 4.2 and Section 5.

**Indexes (recommended, not confirmed present).** `id` (primary lookup key), `name` (used for the ordering in the signup dropdown and for the substring match in `addressMatchesArea()`).

---

### 4.5 `campaigns`

**Purpose.** Admin-authored Service Pass campaign definitions — the promotional offers customers can purchase. Written by `admin.js` (CRUD); read by `index.js` for the offers page and once-per-login popup.

**Primary Key.** `id`.

**Foreign Keys.** None — this table is not observed referencing another table.

**Important Columns.**

| Column | Purpose |
|---|---|
| `title`, `service`, `description` | Campaign display fields |
| `price`, `number_of_visits`, `validity_days` | Pricing and consumption terms; `validity_days` is added to the purchase date to compute `user_passes.expiry_date` |
| `priority` | Lower value shown first; drives which single active campaign appears in the once-per-login popup |
| `offer_start_date`, `offer_end_date` | Active window; `fetchActiveCampaigns()` filters `status='active' AND offer_start_date<=now<offer_end_date` |
| `emergency_included`, `priority_booking` | Boolean flags carried forward onto the resulting `user_passes` row when purchased |
| `status` | `active`/`inactive`, validated on the admin form before publish |
| `created_at` | Row creation timestamp |

**Validation Rules (client-side).** `admin.js: publishCampaign()` validates title/service/price≥0/visits≥1/validity≥1/start<end before insert or update.

**Relationships.** One-to-many with `user_passes` (`user_passes.campaign_id`).

**Indexes (recommended, not confirmed present).** `id`, `status` (filtered by every active-campaign query), `priority` (used for ordering).

---

### 4.6 `user_passes`

**Purpose.** A customer's purchased instance of a `campaigns` row, tracking remaining visits and expiry. Written by `index.js` (`activatePass()`, `consumeServicePassVisit()`); read by `admin.js` for the User Passes tab.

**Primary Key.** `id`.

**Foreign Keys.** `user_id` → `users.id`; `campaign_id` → `campaigns.id` (both confirmed directly from the insert in `index.js: activatePass()`).

**Important Columns.** `purchase_date`, `expiry_date` (`purchase_date + campaign.validityDays` days), `visits_remaining`, `total_visits` (both initialized to the campaign's visit count), `emergency_included`, `priority_booking` (copied from the source campaign at purchase time), `status` (`active`, flipped to `expired` once `visits_remaining` reaches 0 by `consumeServicePassVisit()` — this flip does not check the pass's own `expiry_date`).

**Validation Rules (client-side).** A pass is only activated after a simulated payment success (`_simulatePaymentProvider`, fixed 10-second auto-success — no real payment gateway); visit consumption only fires once per booking, on an observed `Arrived → Completed` transition for a booking with `pass_used && pass_id` set.

**Relationships.** Many-to-one with `users`, many-to-one with `campaigns`, one-to-many (optional) with `bookings` (via `bookings.pass_id`).

**Indexes (recommended, not confirmed present).** `user_id` (filtered for "My Passes"), `campaign_id`, `status`.

---

### 4.7 `worker_achievements`

**Purpose.** Persisted record of achievement/badge unlocks for a worker, evaluated client-side and written once per unlock. Written by `dashboard.js: checkAndUnlockAchievements()`; read by `profile.js` for the badges display.

**Primary Key.** Not explicitly confirmed. A 23505 (Postgres unique-violation) error code is silently ignored on insert in `dashboard.js`, which implies **some** uniqueness constraint exists on this table (most consistent with a composite constraint over `worker_id` + `achievement_id`, since the same achievement should not unlock twice for the same worker) — but the exact constrained column set is not directly observable from client code and is therefore stated here as an inference, not a confirmed fact.

**Foreign Keys.** `worker_id` → `workers.id`.

**Important Columns.** `achievement_id` (catalog key from the client-side `ACHIEVEMENTS` array in `dashboard.js`), `category` (Jobs/Rating/Reliability/Activity/Worker Score), `name`, `description`, `unlocked_at`.

**Validation Rules (client-side).** An achievement is only inserted when `stats.completed_jobs >= gate AND a.test(stats)` evaluates true against the worker's current `Stats` object (from `get_worker_stats`); insert errors other than 23505 are logged but do not block rendering.

**Relationships.** Many-to-one with `workers`.

**Indexes (recommended, not confirmed present).** `worker_id` (queried on every `loadBookings()` cycle in `dashboard.js` and on load in `profile.js`).

---

### 4.8 `admins`

**Purpose.** An email allow-list gating access to `admin.html`, entirely independent of the `users`/`workers` role system. Read-only from the client.

**Primary Key.** Not confirmed — the client filters by `email` (`sb.from('admins')... .eq('email', ...)` per `admin.js: checkAdminRole()`), which may or may not be the table's declared primary key; no schema file confirms this.

**Foreign Keys.** None observed. `admins.email` is not confirmed to be a formal foreign key to any Supabase Auth or `users` identity column — it is matched against the signed-in session's email at runtime, not against a user id.

**Important Columns.** `email`, `is_active` — the only two columns confirmed read by `admin.js: checkAdminRole()`. Any additional columns (e.g. an internal id, name, or audit fields) are not verifiable from the client code and are not asserted here.

**Validation Rules.** None client-side beyond the `is_active===true` check; on any falsy result the client signs the session out.

**Relationships.** None confirmed to other tables.

**Indexes (recommended, not confirmed present).** `email` (the sole filter column).

---

### 4.9 `reviews`

**Purpose.** A dedicated post-completion review record, in addition to the `rated`/`review_rating`/`review_comment` columns mirrored directly onto the `bookings` row. Written by `index.js: submitReview()`.

**Primary Key.** Not explicitly confirmed — no `id` selection/filter was observed for this table in the client code; only inserts were found.

**Foreign Keys.** `booking_id` → `bookings.id`; `user_id` → `users.id`; `worker_id` → `workers.id` (all three confirmed directly from the insert call).

**Important Columns.** `rating` (1–5, mandatory), `comment` (optional), `created_at`.

**Validation Rules (client-side).** `submitReview()` blocks on `!revRat` (no star selected) before any write is attempted; the review is only offerable once per booking, gated by `!b.rated` on the `bookings` row rather than by any read of this table itself — meaning the one-review-per-booking rule is enforced through the `bookings.rated` flag, not through a uniqueness constraint confirmed on `reviews` itself. The insert's own result/error is not checked by the client code (per `SRS.md` §3.6), so an insert failure into `reviews` would not currently be surfaced to the user even though the `bookings` row update would already have succeeded.

**Relationships.** Many-to-one with `bookings`, `users`, and `workers`.

**Indexes (recommended, not confirmed present).** `booking_id`, `worker_id` (if worker-side review aggregation is ever added).

---

### 4.10 `profiles`

**Purpose.** A partial, currently-incomplete alternate worker-registration path, written by `index.js: DB.saveReg()` from an in-app registration form (`submitReg()`). This is a documented implementation gap, not a fully-realized entity: the form collects category, experience, price, bio, Aadhaar number/photo, PAN, and an emergency flag, but the insert itself persists only `id`, `name`, `phone`, and `role:'worker'` — none of the professional/verification fields collected by the form are written anywhere (confirmed: `DB.saveReg()`'s `upsert` call contains only these four fields).

**Primary Key.** `id` — the Supabase Auth user id (`upsert({id: user.id, ...})`).

**Foreign Keys.** None observed.

**Important Columns.** `id`, `name`, `phone`, `role`.

**Validation Rules.** None beyond the calling function's own guard (`if(!user) return`).

**Relationships.** Conceptually overlaps with `workers`, but there is no foreign key or join between `profiles` and `workers` in the client code — a worker created through `submitReg()`/`profiles` would not appear as a row in `workers` and would not be assignable to bookings through the existing assignment algorithm, which reads only from `workers`.

**Indexes (recommended, not confirmed present).** `id`.

---

### 4.11 Storage Buckets

| Bucket | Purpose | Written By | Notes |
|---|---|---|---|
| `worker-documents` | Government ID (Aadhaar/PAN) files, uploaded at worker signup | `auth.js` | Randomized filename (`worker_<timestamp>_<random>.<ext>`); no retention, encryption-at-rest, or deletion policy is defined anywhere in the inspected source (an open compliance item per `PRD.md` §22A.5) |
| `worker-photos` | Worker profile photo, uploaded at worker signup | `auth.js` | Same randomized-filename pattern, separate bucket from documents |

---

## 5. Relationship Description

```
areas (id, name, lat, lng)
  │
  ├──< users.saved_area_id           (FK, by id)
  ├──< bookings.area_id              (FK, by id)
  └───  workers.area                 (NOT a FK — stores area NAME as text,
                                       a verified inconsistency vs. the two
                                       relationships above)

users (id, ...)
  ├──< bookings.user_id              (one user, many bookings)
  ├──< user_passes.user_id           (one user, many passes)
  └──< reviews.user_id               (one user, many reviews)

workers (id, ...)
  ├──< bookings.worker_id            (one worker, many bookings)
  ├──< worker_achievements.worker_id (one worker, many achievement rows)
  └──< reviews.worker_id             (one worker, many reviews)

campaigns (id, ...)
  └──< user_passes.campaign_id       (one campaign, many purchased passes)

user_passes (id, ...)
  └──< bookings.pass_id              (optional — only when pass_used=true)

bookings (id, ...)
  └───  reviews.booking_id           (one booking, at most one review in
                                       practice, enforced only via
                                       bookings.rated, not a DB constraint
                                       confirmed on reviews itself)

admins (email, is_active)            — standalone; no observed FK relationship
                                        to users, workers, or auth.users

profiles (id, name, phone, role)     — standalone; no observed FK relationship
                                        to workers, despite functional overlap
```

**Key verified inconsistency.** `workers.area` and `bookings.area_id`/`users.saved_area_id` relate to the same `areas` table through two different mechanisms — one by name (text match), the other by id (foreign key). This means a worker's eligibility for a booking is resolved by matching `workers.area` (a name string) against the area a booking was placed for, rather than by a direct foreign-key join, which is a genuine design inconsistency to flag for any future schema-hardening effort (PRD §21.2, Phase 6).

---

## 6. Data Flow

### 6.1 Authentication Flow
`auth.html` → `doLogin()`/`doSignup()` → `sb.auth.signInWithPassword`/`sb.auth.signUp` → on signup, insert into `users` (customer) or `workers` (worker, plus two Storage uploads) → session cache written to `sessionStorage` (`qf_user`, `qf_role`) → redirect to the role-appropriate page, which re-validates the session via `sb.auth.getSession()` on boot.

### 6.2 Booking Flow
`index.js: initiateBooking()` → address geocoded (Nominatim) and validated against the selected `areas` row → `getEligibleWorkersForArea()` queries `workers` filtered by `is_available`, skill, and area/radius eligibility → price computed (`base_price`, possibly overridden to 0 by an active `user_passes` row) → payment (simulated GPay or Cash) → `bookings` row inserted with `status='Pending'`.

### 6.3 Worker Assignment
Not a server-side dispatch — the customer's own browser computes `getEligibleWorkersForArea()` against the already-loaded `workers` rows using Haversine distance from the **selected area's coordinates** to each worker's `lat`/`lng`, filtered by `distance <= worker.radius AND distance <= 10km`, sorted nearest-first. The booking is then broadcast (visible to eligible workers via their own `bookings` query/Realtime channel) rather than assigned directly to one worker; the first worker to `confirmAccept()` — guarded by a `.in('status', [...])` condition on the write itself — wins the race.

### 6.4 Review Flow
On a `Completed`, not-yet-`rated` booking: `submitReview()` writes `bookings.rated/review_rating/review_comment` and inserts a corresponding row into `reviews`, in that order, with the `reviews` insert's result not checked by the client.

### 6.5 Wallet / QuickCoins Flow
`checkQuickCoinsRewards()` observes a booking transition from `Arrived` to `Completed` while the customer app is open → `awardQuickCoins()` computes `coins = round(base_price * 0.05)` → `users.quickcoins_balance`, `quickcoins_earned`, `total_completed_bookings` are incremented. The Quick Wallet view (`openQuickWallet`) subsequently re-reads these same four `users` columns fresh on every open.

### 6.6 Tracking Flow
Worker's browser (`dashboard.js: _startGPS`) writes `bookings.worker_live_lat/worker_live_lng/worker_last_seen` via a batched `.in('id', activeIds)` update on every GPS fix → both the customer's and worker's own tracking maps read these same columns, plus `bookings.customer_lat/customer_lng` (or the `areas` centroid as fallback), to render the live map and Geoapify-routed polyline.

### 6.7 Campaign Flow
Admin (`admin.js: publishCampaign()`) inserts/updates a `campaigns` row → `index.js: fetchActiveCampaigns()` reads `status='active' AND offer_start_date<=now<offer_end_date` campaigns, ordered by priority → customer purchase (`campaignBuyPass()`, simulated payment) → `activatePass()` inserts a `user_passes` row → `consumeServicePassVisit()` decrements `user_passes.visits_remaining` on each qualifying completed booking, flipping `status` to `expired` at zero.

---

## 7. Data Validation

All validation observed in the codebase is **client-side only** — no server-side validation function, Postgres check constraint, or RLS-enforced write rule was found in the inspected source (consistent with `PRD.md` §22A.2 and `SRS.md` §2.5).

| Validation | Enforced By | Table Affected |
|---|---|---|
| Required signup fields, password length ≥ 6 | `auth.js` | `users`, `workers` |
| Worker radius > 0 (signup), radius 1–100 (profile edit) | `auth.js`, `profile.js` | `workers` |
| Worker document/photo file type and size (≤5MB) | `auth.js` | Storage buckets |
| Address geocode + area-match before booking | `index.js` | `bookings` |
| Status-transition race guard (`.eq()`/`.in()` on current status) | `index.js`, `dashboard.js` | `bookings` |
| Star rating required before review submit | `index.js` | `reviews`, `bookings` |
| Campaign title/service/price/visits/validity/date-order | `admin.js` | `campaigns` |
| Achievement gate (`completed_jobs >= threshold AND test(stats)`) | `dashboard.js` | `worker_achievements` |

No column-level `NOT NULL`, `CHECK`, or `UNIQUE` constraint can be confirmed from client code alone; the 23505 unique-violation handling in `dashboard.js` (Section 4.7) is the only indirect evidence that any database-level uniqueness constraint exists at all.

---

## 8. Realtime Data

Exactly **one** Supabase Realtime subscription exists in the entire codebase, verified by a full-text search across all JavaScript files for `channel(`/`postgres_changes`:

| Feature | Location | Channel | Table / Filter | Event |
|---|---|---|---|---|
| Worker booking-list live sync | `dashboard.js` | `worker-bookings-<worker_id>` | `bookings`, `filter: worker_id=eq.<worker_id>` | `*` (insert/update/delete) — callback re-runs `loadBookings()` |

This channel is backed by a 5-second polling fallback on the same page, per the code's own comment that `postgres_changes` "does not fire on TRUNCATE or certain bulk/dashboard resets."

**No other Realtime subscription exists.** In particular:
- `index.js` (customer app) has no channel subscription; booking-list freshness relies entirely on interval-based polling.
- `admin.js` and `profile.js` have no channel subscription.
- `PRD.md` §22 and §22A.1 attribute real-time sync to Firebase Realtime Database. No reference to Firebase exists anywhere in the codebase. This discrepancy was already flagged in `SRS.md` §2.5/§6 and `ARCHITECTURE.md` §5/§11, and is repeated here for completeness: the only verified realtime mechanism, at the database layer, is the single Supabase channel described above.

---

## 9. Security

| Concern | Observed Implementation | Verified Gap |
|---|---|---|
| Row Level Security | Not part of the inspected client code — RLS policies are configured server-side in Supabase and no policy definition or migration file was supplied. This document cannot confirm whether RLS is enabled, partially enabled, or absent for any table. | Unverifiable from client code alone; flagged as an open item consistent with `PRD.md` §22A.2 |
| Authentication | Supabase Auth (`sb.auth.signUp`/`signInWithPassword`), session persisted via `persistSession:true, autoRefreshToken:true` | — |
| Authorization (admin) | Gated by a client-side query against `admins.is_active` for the signed-in email, not by a Postgres-enforced role/claim | If RLS is not independently enforcing this same restriction at the database layer, a client capable of forging requests could bypass the admin-portal-level gate entirely; this cannot be confirmed either way from the inspected code |
| Authorization (worker/customer) | Client-side dual-signal checks (`sessionStorage` + a live row re-fetch) on `worker-dashboard.html`/`worker-profile.html`; a session check on `index.html` | Same RLS caveat as above applies to every table `workers`/`users`/`bookings` writes touch |
| Sensitive fields | `workers.document_url`/`document_name` and the two Storage buckets hold government ID data (Aadhaar/PAN); `bookings.arrival_otp`/`completion_otp` hold OTP values in plaintext columns | No encryption-at-rest, retention, or deletion policy for ID documents was found anywhere in the source (`PRD.md` §22A.5, open compliance item); OTPs have no attempt limit or lockout on either verification path |
| API key exposure | `CONFIG.GEOAPIFY_API_KEY` is a plaintext constant in `config.js`, sent from the browser on every Geoapify call | No server-side proxy exists |
| Privacy | Government ID and profile photo URLs are stored as public Storage URLs (per `SRS.md`'s Assumptions §2.6: "Storage buckets... accept public-URL retrieval") | Public-URL retrieval for identity documents is a privacy exposure not mitigated anywhere in the client code |

---

## 10. Performance

- **Indexes.** No index definitions exist in the inspected source (indexes are a schema/migration concern, not a client-code concern). Section 4's per-table "Indexes (recommended)" entries are this document's own recommendations based on observed filter/query patterns (`.eq()`, `.in()`, `.order()` calls), not confirmed existing indexes.
- **Query optimization.** The only observed data-access optimization is GPS write batching (`dashboard.js: _startGPS`, one `.in('id', activeIds)` update per position fix across all of a worker's active bookings, instead of one write per booking). Admin analytics (`admin.js: renderAnalytics()`) and worker dashboard earnings/acceptance-rate figures are computed by iterating full row sets already loaded into the browser, not through server-side aggregate queries — the two `get_worker_stats`/`get_worker_stats_bulk` RPCs are the only exception, and their internal SQL is not part of the inspected client code.
- **Scalability considerations.** As `bookings`, `campaigns`, and `user_passes` volume grows, client-side aggregation cost (admin analytics, earnings totals) scales with the number of rows fetched into the browser rather than with a server-side query plan. The Realtime channel is scoped per-worker (`worker-bookings-<id>`), so the number of open Realtime connections scales linearly with concurrently active workers rather than being a single shared channel.

---

## 11. Future Database Improvements

Only items explicitly named as planned in `PRD.md` (§21, §24) or `SRS.md` (§9) are listed here; no speculative improvement is included.

- **Phase 6 — Backend hardening (`PRD.md` §21.2).** Strengthen Supabase Row Level Security policies; move booking validation, worker-assignment logic, and QuickCoins crediting out of the browser and into RLS-protected server-side functions; improve input validation and secure API key handling; optimize database queries.
- **Phase 7 — QuickCoins ecosystem (`PRD.md` §21.3).** Introduce an actual write path for `users.quickcoins_redeemed` (currently read-only), expand campaign/offer tooling.
- **Unified OTP verification path (`SRS.md` §9).** Consolidating the two independent OTP-writing code paths (`index.js` and `dashboard.js`) that currently both write to `bookings.arrival_otp`/`completion_otp`/`status`/`w_status` with different side effects.
- **In-app worker registration persistence (`SRS.md` §9).** Fully wiring `index.js: submitReg()`'s collected fields into the `workers` table (or a properly joined `profiles` table), rather than the current four-column `profiles` insert described in Section 4.10.
- **Government ID data-handling policy (`PRD.md` §22A.5).** A retention, encryption-at-rest, and deletion policy for the `worker-documents`/`worker-photos` Storage buckets is explicitly flagged as an open compliance item to be defined before production launch.

No other database-specific future improvement (e.g. new tables, new indexes, schema normalization of the `workers.area` inconsistency) is named anywhere in `PRD.md` or `SRS.md`; this document does not invent one.