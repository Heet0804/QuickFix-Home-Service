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
WITH CHECK (auth.uid() = user_id AND status = 'Pending');

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

-- Phase 6.2, Finding 7 — was WITH CHECK (true): any authenticated user
-- (not just admins) could create arbitrary "active" campaigns. Confirmed
-- exploitable live, then fixed. Predicate matches admin.js's own
-- checkAdminRole logic (admins.email = auth.email() AND is_active = true).
CREATE POLICY "Admins can insert campaigns"
ON campaigns
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = auth.email() AND a.is_active = true)
);

-- Phase 6.2, Finding 7 — previously missing entirely (RLS default-deny),
-- meaning even legitimate admins could not update or delete campaigns.
CREATE POLICY "Admins can update campaigns"
ON campaigns
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = auth.email() AND a.is_active = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = auth.email() AND a.is_active = true)
);

CREATE POLICY "Admins can delete campaigns"
ON campaigns
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = auth.email() AND a.is_active = true)
);

CREATE POLICY "Anyone can read active campaigns"
ON campaigns
FOR SELECT
TO public
USING (true);

-- =====================================================
-- REVIEWS
-- =====================================================

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY reviews_insert
ON reviews
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = reviews.booking_id
      AND b.user_id = auth.uid()
      AND b.status = 'Completed'
  )
);

CREATE POLICY reviews_read
ON reviewsz
FOR SELECT
TO public
USING (true);

-- =====================================================
-- USER_PASSES
-- =====================================================

ALTER TABLE user_passes ENABLE ROW LEVEL SECURITY;

-- Phase 6.4 — changed from TO authenticated to TO public. A SECURITY
-- DEFINER function (activate_pass) executes as the function owner's
-- role, not literally as "authenticated", so a TO authenticated-scoped
-- policy silently didn't apply inside that context, causing every
-- legitimate pass activation to fail with a false RLS violation. TO
-- public matches the pattern already used successfully by users_own
-- and every other policy touched by our Phase 6.4 functions.
CREATE POLICY "Users can insert their own passes"
ON user_passes
FOR INSERT
TO public
WITH CHECK (auth.uid() = user_id);

-- Phase 6.2 — resolved using the same admins-table predicate confirmed
-- correct for campaigns (matches admin.js's own checkAdminRole logic:
-- admins.email = auth.email() AND admins.is_active = true).
CREATE POLICY "Admins read all passes"
ON user_passes
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = auth.email() AND a.is_active = true)
);

CREATE POLICY "Users can view their own passes"
ON user_passes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Confirmed already live during Phase 6.2 audit (SELECT * FROM
-- pg_policies) — not a TODO, was already correctly enforced pre-audit.
CREATE POLICY "Active admins can view all user passes"
ON user_passes
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = (auth.jwt() ->> 'email') AND a.is_active = true)
);

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

-- Confirmed already live during Phase 6.2 audit (SELECT * FROM
-- pg_policies) — not a TODO, was already correctly enforced pre-audit.
CREATE POLICY "Active admins can view all users"
ON users
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = (auth.jwt() ->> 'email') AND a.is_active = true)
);

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