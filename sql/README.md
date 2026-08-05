# QuickFix SQL Package

## Purpose

This folder contains the complete production database implementation for QuickFix, derived entirely from `DATABASE.md` (the single source of truth for the schema). It provides the standalone SQL files needed to create, secure, seed, and — if necessary — tear down the QuickFix Supabase/PostgreSQL database: 9 tables (`admins`, `areas`, `bookings`, `campaigns`, `reviews`, `user_passes`, `users`, `worker_achievements`, `workers`), their constraints and indexes, Row Level Security (RLS) policies, two storage buckets with their object policies, the documented (but partially unspecified) SQL functions, development seed data, and a full rollback path.

---

## Folder Structure

### schema.sql
- **Purpose:** Creates the 9 `public` schema tables and their columns exactly as documented in DATABASE.md Section 2, plus the primary key, unique, foreign key, and (where documented) check constraints for each table.
- **When it is executed:** First, before any other file in this package.
- **Dependencies:** None. This is the foundation every other file builds on.

### indexes.sql
- **Purpose:** Creates the secondary (non-PK, non-unique-constraint) indexes documented in DATABASE.md Section 5: `idx_bookings_worker`, `idx_bookings_status`, and `idx_worker_achievements_worker`.
- **When it is executed:** After `schema.sql`, since indexes are created on columns of already-existing tables.
- **Dependencies:** `schema.sql` (the `bookings` and `worker_achievements` tables must exist first).

### policies.sql
- **Purpose:** Enables Row Level Security and creates every RLS policy documented per table in DATABASE.md Section 2 (e.g. `Admins can read their own row` on `admins`, `bookings_user_read` on `bookings`, `users_own` on `users`, `workers_update` on `workers`, etc.).
- **When it is executed:** After `schema.sql`, since policies attach to existing tables and reference existing columns.
- **Dependencies:** `schema.sql`. Some policies (e.g. on `campaigns` and `user_passes`) reference the `admins` and `users` tables in subqueries, and the `users` table's `Admins read all users` policy calls `is_admin()`, so this file is also logically tied to the functions described in `functions.sql`.

### storage.sql
- **Purpose:** Creates the two documented Supabase Storage buckets (`worker-photos` — public, `worker-documents` — private) and the storage.objects policies documented in DATABASE.md Section 3 (`allow_worker_photos_upload v5d3u8_0/1/2`, `public_upload_worker_docs`, `allow_worker_photos_upload 15rstgp_0/1`).
- **When it is executed:** Independent of the table schema; can run any time after the Supabase project's `storage` schema exists (i.e. any standard Supabase project).
- **Dependencies:** None on `public` schema tables. Conceptually parallel to `policies.sql`.

### functions.sql
- **Purpose:** Records the SQL functions DATABASE.md Section 4 confirms exist (`is_admin()`, `get_worker_stats`, `get_worker_stats_bulk`, `rls_auto_enable`, `handle_new_user`). None of their parameter signatures, return types, or bodies are documented in DATABASE.md, so each is represented as a `TODO` placeholder rather than an invented `CREATE FUNCTION` statement.
- **When it is executed:** After `schema.sql`, since some presumed function bodies (once supplied) would reference table data; also referenced by `policies.sql` (`is_admin()`).
- **Dependencies:** `schema.sql`. Must be completed with real definitions before `policies.sql`'s `is_admin()`-dependent policy can function correctly at runtime.

### migrations.sql
- **Purpose:** The single, ordered, end-to-end migration that assembles everything above in one file: Tables → Constraints → Indexes → RLS → Storage → Functions → Comments. It is the canonical, dependency-safe combination of `schema.sql`, `indexes.sql`, `policies.sql`, `storage.sql`, and `functions.sql`, plus documented architecture-observation comments (`COMMENT ON ...`) drawn from DATABASE.md Sections 2.8, 3, 5, and 8.
- **When it is executed:** Run as a single script against a fresh database instead of running the individual files separately, or used as the reference for the correct ordering when running them individually.
- **Dependencies:** None external — it is self-contained and internally ordered to satisfy every foreign key and reference.

### seed.sql
- **Purpose:** Populates safe, non-production development data limited to exactly three tables: `areas` (5 Mumbai neighborhoods), `campaigns` (3 development service-plan rows), and a single demo `admins` row. No `users`, `workers`, `bookings`, or `reviews` rows are seeded.
- **When it is executed:** Last, only after the schema, constraints, indexes, policies, storage, and functions are in place.
- **Dependencies:** `schema.sql` (tables must exist). The demo admin's `auth_user_id` is left `NULL` to avoid violating `admins_auth_user_id_fkey` without a real `auth.users` row.

### rollback.sql
- **Purpose:** Fully reverses the installation in strict reverse-dependency order: Policies → Functions → Indexes → FKs → Tables → Storage. Drops only objects documented in DATABASE.md / created by the files above, using `IF EXISTS` throughout.
- **When it is executed:** On demand, to tear down a development/test database or to undo a failed migration.
- **Dependencies:** Assumes the objects created by `schema.sql`, `indexes.sql`, `policies.sql`, `storage.sql`, and `functions.sql` (or their `migrations.sql` equivalent) are present; every statement is defensive (`IF EXISTS`) so it is also safe to run against a partially-installed database.

---

## Installation Order

Run the files in this order for a fresh install:

1. `schema.sql`
2. `indexes.sql`
3. `policies.sql`
4. `storage.sql`
5. `functions.sql`
6. `migrations.sql`
7. `seed.sql`

> **Note:** `migrations.sql` already contains the combined, correctly-ordered equivalent of steps 1–5. In practice, teams typically run **either** `schema.sql` → `indexes.sql` → `policies.sql` → `storage.sql` → `functions.sql` individually **or** `migrations.sql` alone — not both — followed by `seed.sql` for development environments. Both paths are provided so the package can be consumed file-by-file or as a single script.

---

## Rollback

`rollback.sql` reverses the installation in the exact opposite order of dependency: **Policies → Functions → Indexes → Foreign Keys → Tables → Storage**. It:
- Drops all `storage.objects` policies, then all per-table RLS policies (tables in reverse creation order).
- Drops the documented functions (`is_admin()`, `get_worker_stats`, `get_worker_stats_bulk`, `rls_auto_enable`, `handle_new_user`) using bare names, since no signatures are documented.
- Drops the three documented secondary indexes.
- Drops foreign keys, unique constraints, and primary keys in reverse creation order, so a referencing table's constraints are always dropped before the table it references.
- Drops all 9 tables in reverse creation order, plus the sequences implied by documented `nextval(...)` defaults.
- Removes `storage.objects` rows and then the `worker-photos` and `worker-documents` bucket rows.

Every statement uses `IF EXISTS`, so `rollback.sql` is safe to run against a fully installed, partially installed, or already-empty database.

---

## Requirements

- **PostgreSQL** — the underlying database engine for all files in this package.
- **Supabase** — the `storage.buckets` / `storage.objects` tables and the `auth.users` table (referenced, with inferred targets, by several foreign keys) are Supabase-managed constructs.
- **RLS (Row Level Security)** — every table in the schema has RLS enabled and relies on it for access control; policies must be installed for the application to function correctly under the documented `auth.uid()` / `auth.email()` model.
- **Storage** — the `worker-photos` and `worker-documents` buckets and their object policies require Supabase Storage to be enabled on the project.
- **UUID support** — `id` and foreign key columns on `users`, `workers`, `bookings.user_id`/`worker_id`, `reviews`, and related tables use the `uuid` type, and `reviews.id` defaults via `gen_random_uuid()`.

---

## Notes

The following implementation gaps are documented directly in `DATABASE.md` and are preserved, not resolved, throughout this SQL package:

- **Undocumented FK targets:** `admins_auth_user_id_fkey`, `users_id_fkey`, `workers_id_fkey`, and `user_passes_user_id_fkey` are inferred to reference `auth.users.id` / `users.id` respectively (standard Supabase auth-linking pattern), but DATABASE.md states their exact targets are "not resolvable from `public` schema constraint metadata" — these are marked as inferred in `schema.sql`/`migrations.sql` comments.
- **TODO placeholders:** Several RLS policies on `campaigns` and `user_passes` (e.g. `Active admins can delete/insert/view/update campaigns`, `Admins read all passes`, `Active admins can view all user passes`) have conditions documented only at a summary level ("admin exists in `admins` and `is_active = true`", "`users.role = 'admin'`"); these are implemented to that documented level and flagged with `TODO` comments where the exact original expression was not captured.
- **Missing CHECK definitions:** `campaigns_status_check`, `users_role_check`, and `reviews_rating_check` are confirmed to exist by name in DATABASE.md, but their allowed values/bounds are not enumerated. No `CHECK` condition has been invented; each is left as a documented `TODO` in `schema.sql`/`migrations.sql` and has no corresponding statement in `rollback.sql`.
- **Function body placeholders:** `is_admin()`, `get_worker_stats`, `get_worker_stats_bulk`, `rls_auto_enable`, and `handle_new_user` are confirmed to exist by name and (for `is_admin()`) by usage, but DATABASE.md documents no parameter signatures, return types, or bodies. `functions.sql` and `migrations.sql` represent each as a `TODO` stub only.
- **Additional architecture observations preserved as comments:** `workers.unlocked_achievements` duplicates data tracked in `worker_achievements`; `workers_update` grants UPDATE with no ownership restriction; `campaigns` has two independent admin-detection paths; the `worker-documents` bucket is private at the bucket level but its storage policies grant public read/write scoped only by `bucket_id`.

---

## Version

- **Current Phase:** 5.5.10 — Generate sql/README.md
- **Current Version:** 1.0.0
- **Last Updated:** 2026-08-06

---

AUDIT RESULT
Files Verified: schema.sql, indexes.sql, policies.sql, storage.sql, functions.sql, migrations.sql, seed.sql, rollback.sql — all 8 documented, each with purpose/execution timing/dependencies
Installation Order: schema.sql → indexes.sql → policies.sql → storage.sql → functions.sql → migrations.sql → seed.sql — matches dependency chain (tables before indexes/policies, schema before functions referenced by policies, everything before seed data); rollback documented separately as the reverse path
Corrections Made: added a clarifying note that migrations.sql duplicates steps 1–5 as a single combined script (to prevent readers from double-running both paths); cross-referenced functions.sql/policies.sql dependency for is_admin(); confirmed no object named in this README is absent from prior phase outputs and no object outside those files is mentioned
Final Status: PASS ✅