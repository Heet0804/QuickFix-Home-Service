-- ============================================================
-- rollback.sql
-- Generated strictly from DATABASE.md / migrations.sql.
-- Reverse dependency order: Policies -> Functions -> Indexes -> FKs
--                           -> Tables -> Storage
-- Only objects documented in DATABASE.md (and therefore created in
-- migrations.sql) are dropped. IF EXISTS used throughout.
-- ============================================================


-- ============================================================
-- STEP 1: DROP POLICIES
-- (storage.objects policies first, then table RLS policies, in reverse
-- of the order they were created; tables listed in reverse creation order)
-- ============================================================

-- storage.objects policies
drop policy if exists "admins_can_select_worker_documents" on storage.objects;
drop policy if exists "allow_worker_photos_upload 15rstgp_1" on storage.objects;
drop policy if exists "allow_worker_photos_upload 15rstgp_0" on storage.objects;
drop policy if exists "public_upload_worker_docs" on storage.objects;
drop policy if exists "allow_worker_photos_upload v5d3u8_0" on storage.objects;
drop policy if exists "allow_worker_photos_upload v5d3u8_2" on storage.objects;
drop policy if exists "allow_worker_photos_upload v5d3u8_1" on storage.objects;

-- worker_achievements
drop policy if exists "worker_achievements_select" on worker_achievements;
drop policy if exists "worker_achievements_insert" on worker_achievements;

-- worker_bonuses (Phase 8)
drop policy if exists "workers_can_select_own_bonuses" on worker_bonuses;
drop policy if exists "admins_can_select_worker_bonuses" on worker_bonuses;

-- worker_bans (Phase 8)
drop policy if exists "admins_can_insert_worker_bans" on worker_bans;
drop policy if exists "admins_can_select_worker_bans" on worker_bans;

-- workers
drop policy if exists "admins_can_update_worker_verification" on workers;
drop policy if exists "admins_can_update_any_worker" on workers;
drop policy if exists "workers_read_all" on workers;
drop policy if exists "workers_own_insert" on workers;
drop policy if exists "workers_update" on workers;

-- users
drop policy if exists "admins_can_select_all_users" on users;
drop policy if exists "Admins read all users" on users;
drop policy if exists "Users can read own row" on users;
drop policy if exists "users_own" on users;
drop policy if exists "Active admins can view all users" on users;

-- user_passes
drop policy if exists "Users can update their own passes" on user_passes;
drop policy if exists "Active admins can view all user passes" on user_passes;
drop policy if exists "Users can view their own passes" on user_passes;
drop policy if exists "Admins read all passes" on user_passes;
drop policy if exists "Users can insert their own passes" on user_passes;

-- reviews
drop policy if exists "reviews_read" on reviews;
drop policy if exists "reviews_insert" on reviews;

-- campaigns
drop policy if exists "Admins manage campaigns" on campaigns;
drop policy if exists "Anyone can read active campaigns" on campaigns;
drop policy if exists "Active admins can update campaigns" on campaigns;
drop policy if exists "Active admins can view campaigns" on campaigns;
drop policy if exists "Active admins can insert campaigns" on campaigns;
drop policy if exists "Admins can insert campaigns" on campaigns;
drop policy if exists "Active admins can delete campaigns" on campaigns;

-- bookings
drop policy if exists "bookings_user_read" on bookings;
drop policy if exists "bookings_update" on bookings;
drop policy if exists "bookings_user_insert" on bookings;
drop policy if exists "bookings_worker_read" on bookings;
drop policy if exists "worker update own booking location" on bookings;

-- areas
drop policy if exists "Allow public read areas" on areas;

-- admins
drop policy if exists "Admins can read their own row" on admins;


-- ============================================================
-- STEP 2: DROP FUNCTIONS
-- DATABASE.md documents these functions by name only (no signature).
-- DROP FUNCTION IF EXISTS is used without an argument list, which succeeds
-- only if the name is unambiguous (no overloads) in the target database.
-- If overloaded, this statement will need the specific signature added.
-- ============================================================

-- Phase 8
drop trigger if exists trg_review_streak on reviews;
drop function if exists handle_review_streak();

drop trigger if exists trg_prevent_past_scheduled_date on bookings;
drop function if exists prevent_past_scheduled_date();
drop trigger if exists trg_prevent_role_self_escalation on users;
drop function if exists prevent_role_self_escalation();
drop function if exists is_admin();
drop function if exists get_worker_stats;
drop function if exists get_worker_stats_bulk;
drop function if exists rls_auto_enable;
drop function if exists handle_new_user;


-- ============================================================
-- STEP 3: DROP INDEXES
-- Only the secondary indexes documented in DATABASE.md Section 5.
-- (PK/UNIQUE-backed indexes are dropped implicitly with their constraints
-- in Step 4, and fully removed when their tables are dropped in Step 5.)
-- ============================================================

-- Phase 8
drop index if exists idx_worker_bonuses_worker;
drop index if exists idx_worker_bans_worker;
drop index if exists idx_workers_banned_until;

drop index if exists idx_worker_achievements_worker;
drop index if exists idx_bookings_status;
drop index if exists idx_bookings_worker;


-- ============================================================
-- STEP 4: DROP FOREIGN KEYS (and other constraints)
-- Reverse of the order constraints were added in migrations.sql.
-- ============================================================

-- Foreign keys referencing auth.users
alter table if exists workers drop constraint if exists workers_id_fkey;
alter table if exists users drop constraint if exists users_id_fkey;
alter table if exists admins drop constraint if exists admins_auth_user_id_fkey;

-- Internal foreign keys
alter table if exists worker_achievements drop constraint if exists worker_achievements_worker_id_fkey;
alter table if exists user_passes drop constraint if exists user_passes_user_id_fkey;
alter table if exists user_passes drop constraint if exists user_passes_campaign_id_fkey;
alter table if exists reviews drop constraint if exists reviews_user_id_fkey;
alter table if exists reviews drop constraint if exists reviews_worker_id_fkey;
alter table if exists reviews drop constraint if exists reviews_booking_id_fkey;
alter table if exists bookings drop constraint if exists bookings_worker_id_fkey;
alter table if exists bookings drop constraint if exists bookings_user_id_fkey;
alter table if exists users drop constraint if exists users_saved_area_id_fkey;

-- Unique constraints
alter table if exists worker_achievements drop constraint if exists worker_achievements_worker_id_achievement_id_key;
alter table if exists admins drop constraint if exists admins_email_key;
alter table if exists admins drop constraint if exists admins_auth_user_id_key;
alter table if exists users drop constraint if exists users_email_key;
alter table if exists areas drop constraint if exists areas_name_key;

-- Primary keys
alter table if exists worker_achievements drop constraint if exists worker_achievements_pkey;
alter table if exists user_passes drop constraint if exists user_passes_pkey;
alter table if exists reviews drop constraint if exists reviews_pkey;
alter table if exists bookings drop constraint if exists bookings_pkey;
alter table if exists campaigns drop constraint if exists campaigns_pkey;
alter table if exists workers drop constraint if exists workers_pkey;
alter table if exists admins drop constraint if exists admins_pkey;
alter table if exists users drop constraint if exists users_pkey;
alter table if exists areas drop constraint if exists areas_pkey;

-- Note: campaigns_status_check, users_role_check, reviews_rating_check
-- were confirmed already live during the Phase 6.3 audit and were never
-- created by this package — not dropped here, since that would remove a
-- constraint this package did not create.
-- Phase 6.3 CHECK constraints (created by this package) are dropped
-- automatically when their tables are dropped in Step 5 below — Postgres
-- drops all constraints on DROP TABLE, so no separate DROP CONSTRAINT is
-- needed. Listed here for documentation completeness only: areas_lat_check,
-- areas_lng_check, users_quickcoins_balance_check, users_quickcoins_earned_check,
-- users_quickcoins_redeemed_check, users_saved_lat_check, users_saved_lng_check,
-- workers_radius_check, workers_price_check, workers_rating_check,
-- workers_lat_check, workers_lng_check, campaigns_price_check,
-- campaigns_visits_check, campaigns_validity_check, campaigns_date_order_check,
-- bookings_status_check, bookings_price_check, bookings_base_price_check,
-- bookings_customer_lat_check, bookings_customer_lng_check,
-- user_passes_visits_remaining_check, user_passes_total_visits_check,
-- user_passes_expiry_check.


-- ============================================================
-- STEP 5: DROP TABLES
-- Reverse of creation order (dependents dropped before their dependencies).
-- CASCADE is not required since all FKs were already dropped in Step 4,
-- but IF EXISTS is used throughout for safety.
-- ============================================================

-- Phase 8
drop table if exists worker_bonuses;
drop table if exists worker_bans;

drop table if exists worker_achievements;
drop table if exists user_passes;
drop table if exists reviews;
drop table if exists bookings;
drop table if exists campaigns;
drop table if exists workers;
drop table if exists admins;
drop table if exists users;
drop table if exists areas;

-- Sequences implied by documented nextval(...) defaults (owned by their
-- respective columns; dropped here for completeness in case ownership
-- was not established or the table drop above did not cascade to them)
drop sequence if exists worker_achievements_id_seq;
drop sequence if exists campaigns_id_seq;
drop sequence if exists admins_id_seq;
drop sequence if exists areas_id_seq;


-- ============================================================
-- STEP 6: DROP STORAGE
-- Buckets documented in DATABASE.md Section 3. Objects within each bucket
-- are removed first so the bucket row itself can be deleted cleanly.
-- ============================================================

delete from storage.objects where bucket_id = 'worker-documents';
delete from storage.objects where bucket_id = 'worker-photos';

delete from storage.buckets where id = 'worker-documents';
delete from storage.buckets where id = 'worker-photos';


-- ============================================================
-- AUDIT RESULT
-- Rollback Order: Policies -> Functions -> Indexes -> FKs -> Tables -> Storage (6/6 steps present, in required reverse-dependency order)
-- Corrections Made: FK-drop step ordered so dependent tables' FKs (worker_achievements, user_passes, reviews, bookings) are dropped before the tables they reference are dropped in Step 5; storage.objects rows deleted before their parent storage.buckets rows to avoid FK-style violations; DROP FUNCTION statements use bare names (no invented signatures) per documented lack of signature detail, flagged as best-effort if overloaded
-- Final Status: PASS ✅
-- ============================================================