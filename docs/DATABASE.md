# QuickFix Database Schema Documentation

This document describes the production Supabase database for QuickFix: tables, columns, keys, constraints, indexes, RLS policies, storage buckets, and functions.

---

## 1. Tables Overview

The database has 9 tables in the `public` schema. No views exist.

| Table | Columns |
|---|---|
| admins | 7 |
| areas | 4 |
| bookings | 49 |
| campaigns | 14 |
| reviews | 7 |
| user_passes | 10 |
| users | 14 |
| worker_achievements | 8 |
| workers | 27 |

---

## 2. Table Definitions

### 2.1 `admins`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | bigint | NO | `nextval('admins_id_seq'::regclass)` |
| 2 | auth_user_id | uuid | YES | null |
| 3 | email | text | NO | null |
| 4 | full_name | text | YES | null |
| 5 | role | text | NO | `'admin'::text` |
| 6 | is_active | boolean | NO | `true` |
| 7 | created_at | timestamp without time zone | YES | `now()` |

**Constraints:** PK `admins_pkey` (id); UNIQUE `admins_auth_user_id_key` (auth_user_id), `admins_email_key` (email); FK `admins_auth_user_id_fkey` (auth_user_id → likely `auth.users.id`; target table not resolvable from `public` schema constraint metadata).

**Indexes:** `admins_pkey` (unique, id), `admins_auth_user_id_key` (unique, auth_user_id), `admins_email_key` (unique, email).

**RLS Policies**
| Policy | Cmd | Roles | Using / Check |
|---|---|---|---|
| Admins can read their own row | SELECT | authenticated | `email = auth.email()` |

---

### 2.2 `areas`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | bigint | NO | `nextval('areas_id_seq'::regclass)` |
| 2 | name | text | NO | null |
| 3 | lat | double precision | NO | null |
| 4 | lng | double precision | NO | null |

**Constraints:** PK `areas_pkey` (id); UNIQUE `areas_name_key` (name).

**Indexes:** `areas_pkey` (unique, id), `areas_name_key` (unique, name).

**RLS Policies**
| Policy | Cmd | Roles | Using / Check |
|---|---|---|---|
| Allow public read areas | SELECT | public | `true` |

---

### 2.3 `bookings`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | text | NO | null |
| 2 | user_id | uuid | YES | null |
| 3 | worker_id | uuid | YES | null |
| 4 | worker_role | text | YES | null |
| 5 | worker_emoji | text | YES | null |
| 6 | service | text | YES | null |
| 7 | date | text | YES | null |
| 8 | time | text | YES | null |
| 9 | address | text | YES | null |
| 10 | notes | text | YES | null |
| 11 | price | integer | YES | null |
| 12 | base_price | integer | YES | null |
| 13 | payment_method | text | YES | null |
| 14 | status | text | YES | `'Confirmed'::text` |
| 15 | w_status | text | YES | `'available'::text` |
| 16 | arrival_otp | text | YES | null |
| 17 | completion_otp | text | YES | null |
| 18 | is_emergency | boolean | YES | `false` |
| 19 | is_advance | boolean | YES | `false` |
| 20 | worker_name | text | YES | null |
| 21 | worker_phone | text | YES | null |
| 22 | worker_dist | double precision | YES | null |
| 23 | worker_earning | integer | YES | null |
| 24 | rated | boolean | YES | `false` |
| 25 | review_rating | integer | YES | null |
| 26 | review_comment | text | YES | null |
| 27 | created_at | timestamp with time zone | YES | `now()` |
| 28 | completed_at | timestamp with time zone | YES | null |
| 29 | hidden_by_user | boolean | YES | `false` |
| 30 | accepted_at | timestamp with time zone | YES | null |
| 31 | on_way_at | timestamp with time zone | YES | null |
| 32 | arrived_at | timestamp with time zone | YES | null |
| 33 | started_at | timestamp with time zone | YES | null |
| 34 | reviewed_at | timestamp with time zone | YES | null |
| 35 | worker_live_lat | double precision | YES | null |
| 36 | worker_live_lng | double precision | YES | null |
| 37 | worker_last_seen | timestamp with time zone | YES | null |
| 38 | area_id | bigint | YES | null |
| 39 | customer_lat | double precision | YES | null |
| 40 | customer_lng | double precision | YES | null |
| 41 | is_no_show | boolean | NO | `false` |
| 42 | scheduled_date | date | NO | null |
| 43 | scheduled_time | time without time zone | YES | null |
| 44 | pass_used | boolean | YES | `false` |
| 46 | priority_booking | boolean | YES | `false` |
| 47 | pass_id | bigint | YES | null |
| 48 | route_distance_km | double precision | YES | null |
| 49 | eta_minutes | integer | YES | null |
| 50 | address_verified | boolean | YES | `false` |

Ordinal position 45 does not correspond to a live column.

**Constraints:** PK `bookings_pkey` (id); FK `bookings_user_id_fkey` (user_id → users.id), `bookings_worker_id_fkey` (worker_id → workers.id). `area_id` and `pass_id` have no enforced FK.

**Indexes:** `bookings_pkey` (unique, id), `idx_bookings_worker` (worker_id), `idx_bookings_status` (status).

**RLS Policies**
| Policy | Cmd | Roles | Using / Check |
|---|---|---|---|
| worker update own booking location | UPDATE | public | `auth.uid()::text = worker_id::text` |
| bookings_worker_read | SELECT | public | `EXISTS (SELECT 1 FROM workers w WHERE w.id = auth.uid() AND w.skill = bookings.worker_role)` |
| bookings_user_insert | INSERT | public | check: `auth.uid() = user_id` |
| bookings_update | UPDATE | public | `auth.uid() = user_id OR EXISTS (SELECT 1 FROM workers w WHERE w.id = auth.uid())` |
| bookings_user_read | SELECT | public | `auth.uid() = user_id` |

---

### 2.4 `campaigns`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | bigint | NO | `nextval('campaigns_id_seq'::regclass)` |
| 2 | title | text | NO | null |
| 3 | service | text | NO | null |
| 4 | description | text | YES | null |
| 5 | price | numeric | NO | null |
| 6 | number_of_visits | integer | NO | `1` |
| 7 | validity_days | integer | NO | null |
| 8 | emergency_included | boolean | NO | `false` |
| 9 | priority_booking | boolean | NO | `false` |
| 10 | offer_start_date | timestamp without time zone | NO | null |
| 11 | offer_end_date | timestamp without time zone | NO | null |
| 12 | priority | integer | NO | `1` |
| 13 | status | text | NO | `'active'::text` |
| 14 | created_at | timestamp without time zone | YES | `now()` |

**Constraints:** PK `campaigns_pkey` (id); CHECK `campaigns_status_check` on `status` (allowed values not enumerated in schema metadata).

**Indexes:** `campaigns_pkey` (unique, id) — no secondary indexes.

**RLS Policies**
| Policy | Cmd | Roles | Using / Check |
|---|---|---|---|
| Active admins can delete campaigns | DELETE | authenticated | admin exists in `admins` and `is_active = true` |
| Admins can insert campaigns | INSERT | authenticated | check: `true` |
| Active admins can insert campaigns | INSERT | authenticated | check: admin exists in `admins` and `is_active = true` |
| Active admins can view campaigns | SELECT | authenticated | admin exists in `admins` and `is_active = true` |
| Active admins can update campaigns | UPDATE | authenticated | admin exists in `admins` and `is_active = true` (using + check) |
| Anyone can read active campaigns | SELECT | public | `true` |
| Admins manage campaigns | ALL | authenticated | `users.role = 'admin'` (using + check) |

---

### 2.5 `reviews`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | `gen_random_uuid()` |
| 2 | booking_id | text | YES | null |
| 3 | user_id | uuid | YES | null |
| 4 | worker_id | uuid | YES | null |
| 5 | rating | integer | YES | null |
| 6 | comment | text | YES | null |
| 7 | created_at | timestamp with time zone | YES | `now()` |
| 8 | tags | text[] | YES | null |

**Phase 8 addition (column 8).** `tags` stores the customer's selected pill-tag ids from a fixed client-side catalog (`REVIEW_TAGS` in `index.js`: 8 positive, 6 negative, 1 "Other"); no CHECK constraint confirmed to restrict values to that catalog, so the column accepts any text array from a client bypassing the UI.

**Constraints:** PK `reviews_pkey` (id); FK `reviews_booking_id_fkey` (booking_id → bookings.id), `reviews_worker_id_fkey` (worker_id → workers.id), `reviews_user_id_fkey` (user_id → users.id); CHECK `reviews_rating_check` on `rating` (bounds not enumerated in schema metadata).

**Indexes:** `reviews_pkey` (unique, id) — no secondary indexes.

**RLS Policies**
| Policy | Cmd | Roles | Using / Check |
|---|---|---|---|
| reviews_insert | INSERT | public | check: `auth.uid() = user_id` |
| reviews_read | SELECT | public | `true` |

**Architecture observation (Phase 8):** `reviews_read` grants unrestricted public SELECT (`true`) on the entire table, including `comment` and `tags` — this is broader than the product's stated intent that full review detail (rating, tags, comment) be admin-only, with workers restricted to aggregated positive-tag counts via a separate `get_worker_positive_tags()` RPC. The RPC-only access pattern for workers is a client-side convention (the worker dashboard never queries `reviews` directly); it is not backed by a corresponding RLS restriction on this table that would prevent a worker (or any authenticated client) from reading `reviews` directly, including another worker's negative feedback and comments, via a direct REST call.

---

### 2.6 `user_passes`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | bigint | NO | null |
| 2 | user_id | uuid | NO | null |
| 3 | campaign_id | bigint | NO | null |
| 4 | purchase_date | timestamp with time zone | NO | `now()` |
| 5 | expiry_date | timestamp with time zone | NO | null |
| 6 | visits_remaining | integer | NO | null |
| 7 | total_visits | integer | NO | null |
| 8 | emergency_included | boolean | NO | `false` |
| 9 | priority_booking | boolean | NO | `false` |
| 10 | status | text | NO | `'active'::text` |

**Constraints:** PK `user_passes_pkey` (id); FK `user_passes_campaign_id_fkey` (campaign_id → campaigns.id); FK `user_passes_user_id_fkey` (user_id → users.id, inferred from the equivalent pattern in `bookings`/`reviews` and from RLS comparisons against `auth.uid()`).

**Indexes:** `user_passes_pkey` (unique, id) — no secondary indexes.

**RLS Policies**
| Policy | Cmd | Roles | Using / Check |
|---|---|---|---|
| Users can insert their own passes | INSERT | authenticated | check: `auth.uid() = user_id` |
| Admins read all passes | SELECT | authenticated | `users.role = 'admin'` |
| Users can view their own passes | SELECT | authenticated | `auth.uid() = user_id` |
| Active admins can view all user passes | SELECT | authenticated | admin exists in `admins` and `is_active = true` |
| Users can update their own passes | UPDATE | public | `auth.uid() = user_id` (using + check) |

---

### 2.7 `users`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | null |
| 2 | email | text | NO | null |
| 3 | name | text | YES | null |
| 4 | phone | text | YES | null |
| 5 | role | text | YES | `'user'::text` |
| 6 | created_at | timestamp with time zone | YES | `now()` |
| 7 | saved_address | text | YES | null |
| 8 | quickcoins_balance | integer | NO | `0` |
| 9 | quickcoins_earned | integer | NO | `0` |
| 10 | quickcoins_redeemed | integer | NO | `0` |
| 11 | total_completed_bookings | integer | NO | `0` |
| 12 | saved_area_id | bigint | YES | null |
| 13 | saved_lat | double precision | YES | null |
| 14 | saved_lng | double precision | YES | null |

**Constraints:** PK `users_pkey` (id); UNIQUE `users_email_key` (email); FK `users_id_fkey` (id → likely `auth.users.id`, standard Supabase auth-linking pattern; target table not resolvable from `public` schema constraint metadata); FK `users_saved_area_id_fkey` (saved_area_id → areas.id); CHECK `users_role_check` on `role` (allowed values not enumerated in schema metadata).

**Indexes:** `users_pkey` (unique, id), `users_email_key` (unique, email).

**RLS Policies**
| Policy | Cmd | Roles | Using / Check |
|---|---|---|---|
| Active admins can view all users | SELECT | authenticated | admin exists in `admins` and `is_active = true` |
| users_own | ALL | public | `auth.uid() = id` (using + check) |
| Users can read own row | SELECT | public | `auth.uid() = id` |
| Admins read all users | SELECT | authenticated | `is_admin()` |

---

### 2.8 `workers`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | null |
| 2 | name | text | YES | null |
| 3 | phone | text | YES | null |
| 4 | skill | text | YES | null |
| 5 | radius | integer | YES | `10` |
| 6 | exp | text | YES | null |
| 7 | price | integer | YES | null |
| 8 | bio | text | YES | null |
| 9 | lat | double precision | YES | null |
| 10 | lng | double precision | YES | null |
| 11 | is_available | boolean | YES | `false` |
| 12 | rating | double precision | YES | `0` |
| 13 | total_jobs | integer | YES | `0` |
| 14 | emergency_available | boolean | YES | `false` |
| 15 | area | text | YES | null |
| 16 | accepted_jobs | integer | YES | `0` |
| 17 | completed_jobs | integer | YES | `0` |
| 18 | cancelled_jobs | integer | YES | `0` |
| 19 | no_show_count | integer | YES | `0` |
| 20 | reliability_score | numeric | YES | `0` |
| 21 | completion_rate | numeric | YES | `100` |
| 22 | activity_score | numeric | YES | `100` |
| 23 | worker_score | numeric | YES | `100` |
| 24 | document_url | text | YES | null |
| 25 | document_name | text | YES | null |
| 26 | unlocked_achievements | jsonb | YES | `'[]'::jsonb` |
| 27 | profile_photo_url | text | YES | null |
| 28 | banned_until | timestamptz | YES | null |
| 29 | ban_count | integer | NO | `0` |
| 30 | last_ban_duration_label | text | YES | null |
| 31 | positive_streak | integer | NO | `0` |
| 32 | bonus_balance | numeric | NO | `0` |
| 33 | verification_status | text | NO | `'pending'::text` |

**Phase 8 additions (columns 28–33).** Added to support admin-imposed worker bans (`banned_until`/`ban_count`/`last_ban_duration_label`), the review-driven positive-streak reward system (`positive_streak`/`bonus_balance`), and the admin ID/photo verification workflow (`verification_status`, allowed values `pending`/`approved`/`rejected`, no CHECK constraint confirmed to enforce this set).

**Constraints:** PK `workers_pkey` (id); FK `workers_id_fkey` (id → likely `auth.users.id`, standard Supabase auth-linking pattern; target table not resolvable from `public` schema constraint metadata).

**Indexes:** `workers_pkey` (unique, id) — no secondary indexes. **No index exists on `banned_until`**, despite it being read on every worker login attempt (`auth.js`) and by the realtime self-row ban-enforcement channel filter (`dashboard.js`).

**RLS Policies**
| Policy | Cmd | Roles | Using / Check |
|---|---|---|---|
| workers_update | UPDATE | public | `true` (using + check) |
| workers_own_insert | INSERT | public | check: `auth.uid() = id` |
| workers_read_all | SELECT | public | `true` |
| admins_can_update_any_worker (Phase 8) | UPDATE | public | admin exists in `admins` and `is_active = true` (using + check) |
| admins_can_update_worker_verification (Phase 8) | UPDATE | public | admin exists in `admins` and `is_active = true` (using + check) — functionally overlapping with `admins_can_update_any_worker`; both were added independently during Phase 8 rather than consolidated into one policy |

**Architecture observations:**
- `unlocked_achievements` (jsonb, on `workers`) overlaps in purpose with the relational `worker_achievements` table — the same achievement data appears to be tracked in two places.
- No indexes exist on `skill` or `area`, both of which are used for worker-matching (see `bookings_worker_read` policy and typical booking-assignment queries).
- `workers_update` grants UPDATE with no ownership restriction (`using: true`, `check: true`) — any client can update any worker row, unlike `workers_own_insert` which is scoped to `auth.uid() = id`. **This is a genuine correction to a Phase 8 troubleshooting session's initial assumption:** despite `workers_update` appearing permissive enough to allow an admin's ban write, the actual RLS evaluation still silently blocked an admin's `UPDATE` in practice (root cause not fully explained by the policy list alone — `admins_can_update_any_worker` was added as the confirmed fix, and the ban write succeeds reliably only after that policy's addition).
- **Two independent, functionally redundant admin-UPDATE policies** (`admins_can_update_any_worker`, `admins_can_update_worker_verification`) now coexist on `workers`, mirroring the same "multiple independent admin-detection paths" pattern already observed on `campaigns` (Section 8).

---

### 2.9 `worker_achievements`

| # | Column | Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | bigint | NO | `nextval('worker_achievements_id_seq'::regclass)` |
| 2 | worker_id | uuid | NO | null |
| 3 | achievement_id | text | NO | null |
| 4 | unlocked_at | timestamp with time zone | NO | `now()` |
| 5 | created_at | timestamp with time zone | NO | `now()` |
| 6 | category | text | NO | null |
| 7 | name | text | NO | null |
| 8 | description | text | NO | null |

**Constraints:** PK `worker_achievements_pkey` (id); UNIQUE composite `worker_achievements_worker_id_achievement_id_key` (worker_id, achievement_id); FK `worker_achievements_worker_id_fkey` (worker_id → workers.id). No separate `achievements` table exists in the schema, so `achievement_id` is a free-standing text identifier rather than a foreign key.

**Indexes:** `worker_achievements_pkey` (unique, id), `worker_achievements_worker_id_achievement_id_key` (unique composite, worker_id + achievement_id), `idx_worker_achievements_worker` (worker_id).

**RLS Policies**
| Policy | Cmd | Roles | Using / Check |
|---|---|---|---|
| worker_achievements_insert | INSERT | public | check: `true` |
| worker_achievements_select | SELECT | public | `true` |

---

## 3. Storage (Supabase Storage)

| Bucket ID | Public? | File Size Limit | Allowed MIME Types | Type | Created |
|---|---|---|---|---|---|
| worker-photos | true (public) | none set | none set (unrestricted) | STANDARD | 2026-07-16 |
| worker-documents | false (private) | none set | none set (unrestricted) | STANDARD | 2026-06-22 |

**Storage Policies (on `storage.objects`)**

| Bucket | Policy | Cmd | Roles | Using / Check |
|---|---|---|---|---|
| worker-photos | allow_worker_photos_upload v5d3u8_1 | SELECT | public | `bucket_id = 'worker-photos'` |
| worker-photos | allow_worker_photos_upload v5d3u8_2 | INSERT | public | check: `bucket_id = 'worker-photos'` |
| worker-photos | allow_worker_photos_upload v5d3u8_0 | UPDATE | public | `bucket_id = 'worker-photos'` |
| worker-documents | public_upload_worker_docs | INSERT | public | check: `bucket_id = 'worker-documents'` |
| worker-documents | allow_worker_photos_upload 15rstgp_0 | UPDATE | public | `bucket_id = 'worker-documents'` |
| worker-documents | allow_worker_photos_upload 15rstgp_1 | SELECT | public | `bucket_id = 'worker-documents'` |

**Architecture observation:** `worker-documents` is private at the bucket level, but its storage policies grant public SELECT/UPDATE/INSERT scoped only by `bucket_id` — any client with public access can read and write objects in this bucket despite its private setting.

---

## 4. SQL Functions

| Function | Type | Confirmed Usage |
|---|---|---|
| `is_admin()` | FUNCTION | Used in the `users` RLS policy "Admins read all users" |
| `get_worker_stats` | FUNCTION | Not referenced by any RLS policy; presumed single-worker stats RPC |
| `get_worker_stats_bulk` | FUNCTION | Not referenced by any RLS policy; presumed bulk-stats RPC |
| `rls_auto_enable` | FUNCTION | Not referenced by any RLS policy; presumed RLS setup/maintenance routine |
| `handle_new_user` | FUNCTION | Not referenced by any RLS policy; not bound to any trigger |
| `get_worker_positive_tags()` (Phase 8) | FUNCTION (RPC) | Called from `profile.js`; returns only aggregated positive-tag counts per worker, deliberately excluding rating, comment, and negative tags from what a worker can retrieve about their own reviews |
| `handle_review_streak()` (Phase 8) | FUNCTION (trigger) | Bound to `trg_review_streak`, `AFTER INSERT ON reviews`; increments `workers.positive_streak` when the inserted row's `tags` contains no value from a fixed negative-tag list, resets it to 0 otherwise, and on every 5th consecutive positive streak value, credits `workers.bonus_balance` and inserts a row into `worker_bonuses` |

**Correction (Phase 8): triggers now exist.** The prior statement "No triggers exist in the database" is no longer accurate — `trg_review_streak` (`AFTER INSERT ON reviews`, executing `handle_review_streak()`) is the first confirmed trigger in the schema.

---

## 5. Indexes

| Table | Index | Type | Columns |
|---|---|---|---|
| admins | admins_pkey | unique | id |
| admins | admins_auth_user_id_key | unique | auth_user_id |
| admins | admins_email_key | unique | email |
| areas | areas_pkey | unique | id |
| areas | areas_name_key | unique | name |
| bookings | bookings_pkey | unique | id |
| bookings | idx_bookings_worker | non-unique | worker_id |
| bookings | idx_bookings_status | non-unique | status |
| campaigns | campaigns_pkey | unique | id |
| reviews | reviews_pkey | unique | id |
| user_passes | user_passes_pkey | unique | id |
| users | users_email_key | unique | email |
| users | users_pkey | unique | id |
| worker_achievements | worker_achievements_pkey | unique | id |
| worker_achievements | worker_achievements_worker_id_achievement_id_key | unique (composite) | worker_id, achievement_id |
| worker_achievements | idx_worker_achievements_worker | non-unique | worker_id |
| workers | workers_pkey | unique | id |

**Architecture observation:** `campaigns`, `reviews`, `user_passes`, and `workers` have no secondary indexes despite carrying foreign keys or high-traffic filter columns.

---

## 6. Views

No views exist in this database.

---

## 7. Relationships (Foreign Keys)

| From | Column | To | Constraint |
|---|---|---|---|
| admins | auth_user_id | auth.users.id (inferred) | admins_auth_user_id_fkey |
| bookings | user_id | users.id | bookings_user_id_fkey |
| bookings | worker_id | workers.id | bookings_worker_id_fkey |
| reviews | booking_id | bookings.id | reviews_booking_id_fkey |
| reviews | worker_id | workers.id | reviews_worker_id_fkey |
| reviews | user_id | users.id | reviews_user_id_fkey |
| user_passes | user_id | users.id (inferred) | user_passes_user_id_fkey |
| user_passes | campaign_id | campaigns.id | user_passes_campaign_id_fkey |
| users | id | auth.users.id (inferred) | users_id_fkey |
| users | saved_area_id | areas.id | users_saved_area_id_fkey |
| workers | id | auth.users.id (inferred) | workers_id_fkey |
| worker_achievements | worker_id | workers.id | worker_achievements_worker_id_fkey |

Cascade rules (`ON DELETE`/`ON UPDATE` behavior) are not defined for any foreign key in this schema.

---

## 8. New Tables (Phase 8)

### 8.1 `worker_bans`

Permanent audit log of every ban ever applied — independent of `workers.banned_until`, which reflects only the current/latest ban.

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| worker_id | uuid | NO | null |
| duration_label | text | NO | null |
| banned_at | timestamptz | NO | `now()` |
| banned_until | timestamptz | NO | null |
| created_at | timestamptz | NO | `now()` |

**Constraints:** FK `worker_id → workers.id`.

**RLS Policies**
| Policy | Cmd | Roles | Using / Check |
|---|---|---|---|
| admins_can_select_worker_bans | SELECT | public | admin exists in `admins` and `is_active = true` |
| admins_can_insert_worker_bans | INSERT | public | check: admin exists in `admins` and `is_active = true` |

**Observation:** no SELECT policy grants a worker read access to their own ban history — only admins can query this table under the current policy set.

### 8.2 `worker_bonuses`

Permanent log of every positive-streak bonus credited, written exclusively by the `handle_review_streak()` trigger — no client-side INSERT path exists.

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| worker_id | uuid | NO | null |
| amount | numeric | NO | null |
| streak_at_award | integer | NO | null |
| created_at | timestamptz | NO | `now()` |

**Constraints:** FK `worker_id → workers.id`.

**RLS Policies**
| Policy | Cmd | Roles | Using / Check |
|---|---|---|---|
| admins_can_select_worker_bonuses | SELECT | public | admin exists in `admins` and `is_active = true` |
| workers_can_select_own_bonuses | SELECT | public | `auth.uid() = worker_id` |

**Observation:** unlike `worker_bans`, this table does grant a worker read access to their own bonus history — an inconsistency between the two new Phase 8 tables' access models that is not reconciled anywhere in the schema or client code.

## 9. Architecture Notes (Summary)

- `workers.unlocked_achievements` (jsonb) duplicates data already tracked relationally in `worker_achievements`.
- `workers` has no index on `skill`, `area`, or (Phase 8) `banned_until`, despite the latter being read on every worker login attempt.
- `workers_update` RLS policy allows any client to update any worker row (`using: true`, `check: true`), unlike the ownership-scoped `workers_own_insert`. Two further, functionally overlapping admin-scoped UPDATE policies (`admins_can_update_any_worker`, `admins_can_update_worker_verification`) were added in Phase 8 rather than consolidated into one.
- `worker-documents` storage bucket is private, but its RLS policies grant public read/write access scoped only by `bucket_id`. **Phase 8 clarification:** despite this permissive RLS, the bucket's own `public:false` setting independently prevents `document_url` (a public-URL string) from ever resolving — Supabase's `/object/public` endpoint only serves objects from buckets flagged public at the bucket level, regardless of `storage.objects` RLS. The admin portal now retrieves documents via a signed URL (`createSignedUrl`) instead, which does work against a private bucket provided the caller passes RLS — a new `admins_can_select_worker_documents` policy on `storage.objects` was added for this purpose in Phase 8.
- `campaigns` has two independent "admin" detection paths in its RLS policies (`admins` table with `is_active` flag vs. `users.role = 'admin'`), and two separate INSERT policies with different conditions — the same "duplicate admin-detection path" pattern now also exists on `workers` (Phase 8, above).
- `campaigns`, `reviews`, and `user_passes` carry foreign keys with no supporting indexes; `worker_bans` and `worker_bonuses` (Phase 8) carry the same gap on their own `worker_id` foreign keys.
- `reviews_read`'s unrestricted public SELECT (`true`) is broader than the product's stated intent that full review detail be admin-only (Section 2.5).
- Three CHECK constraints exist (`campaigns_status_check`, `users_role_check`, `reviews_rating_check`) whose specific allowed values are not captured in this documentation; `workers.verification_status` (Phase 8) has no CHECK constraint confirmed at all, despite the client only ever writing `'pending'`/`'approved'`/`'rejected'`.
- Four foreign keys (`admins_auth_user_id_fkey`, `user_passes_user_id_fkey`, `users_id_fkey`, `workers_id_fkey`) reference tables outside the `public` schema (most plausibly `auth.users`); their exact targets are inferred, not directly confirmed by `public`-schema constraint metadata.
- `worker_bans` and `worker_bonuses` (Phase 8) apply inconsistent self-access models: a worker can read their own bonus history but not their own ban history, under the currently defined RLS policies.