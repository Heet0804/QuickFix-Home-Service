-- =====================================================
-- QuickFix Database — Row Level Security Policies
-- Generated from DATABASE.md (source of truth)
-- Target: PostgreSQL / Supabase
-- =====================================================

-- =====================================================
-- ADMINS
-- =====================================================

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read their own row"
ON admins
FOR SELECT
TO authenticated
USING (email = auth.email());

-- =====================================================
-- AREAS
-- =====================================================

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read areas"
ON areas
FOR SELECT
TO public
USING (true);

-- =====================================================
-- BOOKINGS
-- =====================================================

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "worker update own booking location"
ON bookings
FOR UPDATE
TO public
USING (auth.uid()::text = worker_id::text);

CREATE POLICY bookings_worker_read
ON bookings
FOR SELECT
TO public
USING (auth.uid() = worker_id);

CREATE POLICY bookings_user_insert
ON bookings
FOR INSERT
TO public
WITH CHECK (auth.uid() = user_id);

CREATE POLICY bookings_update
ON bookings
FOR UPDATE
TO public
USING (auth.uid() = user_id OR auth.uid() = worker_id);

CREATE POLICY bookings_user_read
ON bookings
FOR SELECT
TO public
USING (auth.uid() = user_id);

-- =====================================================
-- CAMPAIGNS
-- =====================================================

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- TODO: "Active admins can delete campaigns" (DELETE, authenticated)
-- DATABASE.md documents this predicate only in prose: "admin exists in
-- `admins` and `is_active = true`". No literal SQL expression is given,
-- so the exact EXISTS(...) subquery is not fabricated here.
-- CREATE POLICY "Active admins can delete campaigns"
-- ON campaigns
-- FOR DELETE
-- TO authenticated
-- USING ( -- exact predicate to be confirmed against live DB );

CREATE POLICY "Admins can insert campaigns"
ON campaigns
FOR INSERT
TO authenticated
WITH CHECK (true);

-- TODO: "Active admins can insert campaigns" (INSERT, authenticated)
-- DATABASE.md documents this predicate only in prose: "admin exists in
-- `admins` and `is_active = true`". No literal SQL expression is given,
-- so the exact EXISTS(...) subquery is not fabricated here.
-- CREATE POLICY "Active admins can insert campaigns"
-- ON campaigns
-- FOR INSERT
-- TO authenticated
-- WITH CHECK ( -- exact predicate to be confirmed against live DB );

-- TODO: "Active admins can view campaigns" (SELECT, authenticated)
-- DATABASE.md documents this predicate only in prose: "admin exists in
-- `admins` and `is_active = true`". No literal SQL expression is given,
-- so the exact EXISTS(...) subquery is not fabricated here.
-- CREATE POLICY "Active admins can view campaigns"
-- ON campaigns
-- FOR SELECT
-- TO authenticated
-- USING ( -- exact predicate to be confirmed against live DB );

-- TODO: "Active admins can update campaigns" (UPDATE, authenticated,
-- documented as using + check) — DATABASE.md documents this predicate
-- only in prose: "admin exists in `admins` and `is_active = true`". No
-- literal SQL expression is given, so the exact EXISTS(...) subquery is
-- not fabricated here.
-- CREATE POLICY "Active admins can update campaigns"
-- ON campaigns
-- FOR UPDATE
-- TO authenticated
-- USING ( -- exact predicate to be confirmed against live DB )
-- WITH CHECK ( -- exact predicate to be confirmed against live DB );

CREATE POLICY "Anyone can read active campaigns"
ON campaigns
FOR SELECT
TO public
USING (true);

-- TODO: "Admins manage campaigns" (ALL, authenticated) — DATABASE.md
-- documents the predicate only as the bare expression `users.role = 'admin'`
-- (no join/subquery). As literal SQL this references an undeclared
-- table (`users`) inside a policy on `campaigns` and will very likely
-- fail with "missing FROM-clause entry for table users" if run as-is.
-- Not converted to a guessed EXISTS(...) subquery, since the real
-- join condition is not documented anywhere in this repo — that would
-- be fabricating access-control logic. Left as a stub pending the
-- actual predicate from whoever owns the RLS design.
-- CREATE POLICY "Admins manage campaigns"
-- ON campaigns
-- FOR ALL
-- TO authenticated
-- USING ( -- exact predicate to be confirmed against live DB )
-- WITH CHECK ( -- exact predicate to be confirmed against live DB );

-- =====================================================
-- REVIEWS
-- =====================================================

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY reviews_insert
ON reviews
FOR INSERT
TO public
WITH CHECK (auth.uid() = user_id);

CREATE POLICY reviews_read
ON reviews
FOR SELECT
TO public
USING (true);

-- =====================================================
-- USER_PASSES
-- =====================================================

ALTER TABLE user_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own passes"
ON user_passes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- TODO: "Admins read all passes" (SELECT, authenticated) — DATABASE.md
-- documents the predicate only as the bare expression `users.role = 'admin'`
-- (no join/subquery). As literal SQL this references an undeclared
-- table (`users`) inside a policy on `user_passes` and will very likely
-- fail with "missing FROM-clause entry for table users" if run as-is.
-- Not converted to a guessed EXISTS(...) subquery, since the real
-- join condition is not documented anywhere in this repo — that would
-- be fabricating access-control logic. Left as a stub pending the
-- actual predicate from whoever owns the RLS design.
-- CREATE POLICY "Admins read all passes"
-- ON user_passes
-- FOR SELECT
-- TO authenticated
-- USING ( -- exact predicate to be confirmed against live DB );

CREATE POLICY "Users can view their own passes"
ON user_passes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- TODO: "Active admins can view all user passes" (SELECT, authenticated)
-- DATABASE.md documents this predicate only in prose: "admin exists in
-- `admins` and `is_active = true`". No literal SQL expression is given,
-- so the exact EXISTS(...) subquery is not fabricated here.
-- CREATE POLICY "Active admins can view all user passes"
-- ON user_passes
-- FOR SELECT
-- TO authenticated
-- USING ( -- exact predicate to be confirmed against live DB );

CREATE POLICY "Users can update their own passes"
ON user_passes
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- USERS
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- TODO: "Active admins can view all users" (SELECT, authenticated)
-- DATABASE.md documents this predicate only in prose: "admin exists in
-- `admins` and `is_active = true`". No literal SQL expression is given,
-- so the exact EXISTS(...) subquery is not fabricated here.
-- CREATE POLICY "Active admins can view all users"
-- ON users
-- FOR SELECT
-- TO authenticated
-- USING ( -- exact predicate to be confirmed against live DB );

CREATE POLICY users_own
ON users
FOR ALL
TO public
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
-- NOTE: Phase 6.2 — role-change protection is NOT enforced by this
-- policy. A WITH CHECK subquery back into `users` was tried and
-- caused infinite recursion (error 42P17). Protection is instead
-- enforced by the trg_prevent_role_self_escalation trigger (see
-- functions.sql), which runs independently of RLS and cannot recurse.

CREATE POLICY "Users can read own row"
ON users
FOR SELECT
TO public
USING (auth.uid() = id);

CREATE POLICY "Admins read all users"
ON users
FOR SELECT
TO authenticated
USING (is_admin());

-- =====================================================
-- WORKERS
-- =====================================================

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY workers_update
ON workers
FOR UPDATE
TO public
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY workers_own_insert
ON workers
FOR INSERT
TO public
WITH CHECK (auth.uid() = id);

CREATE POLICY workers_read_all
ON workers
FOR SELECT
TO public
USING (true);

-- =====================================================
-- WORKER_ACHIEVEMENTS
-- =====================================================

ALTER TABLE worker_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY worker_achievements_insert
ON worker_achievements
FOR INSERT
TO public
WITH CHECK (auth.uid() = worker_id);

CREATE POLICY worker_achievements_select
ON worker_achievements
FOR SELECT
TO public
USING (true);