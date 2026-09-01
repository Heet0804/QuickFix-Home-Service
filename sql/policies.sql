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
USING (auth.uid()::text = worker_id::text)
WITH CHECK (auth.uid()::text = worker_id::text);

-- Column-level protection cannot be expressed in RLS alone (WITH CHECK
-- only sees the NEW row, not OLD, so it can't say "this column may not
-- change"). Enforced instead via a BEFORE UPDATE trigger, added once
-- below and applied to both bookings_update and this policy.
CREATE OR REPLACE FUNCTION enforce_booking_update_boundaries()
RETURNS TRIGGER AS $$
BEGIN
  -- Admins bypass all restrictions below.
  IF is_admin() THEN
    RETURN NEW;
  END IF;

  -- Customer-owned update (auth.uid() = OLD.user_id).
  IF auth.uid() = OLD.user_id THEN
    -- Customers may only move status to 'Cancelled', and only from a
    -- state that hasn't already left their hands. They may never set
    -- 'Worker on Way' or is_no_show themselves (explicit product
    -- decision — this is a worker/backend-owned transition, not a
    -- customer one). No authoritative server-side no-show rule exists
    -- yet, so no-show cannot be granted here either.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status != 'Cancelled'
         OR OLD.status IN ('Completed','Cancelled','Rejected') THEN
        RAISE EXCEPTION 'Customers may only cancel a booking that has not already completed, been cancelled, or been rejected';
      END IF;
    END IF;
    IF NEW.is_no_show IS DISTINCT FROM OLD.is_no_show THEN
      RAISE EXCEPTION 'Customers cannot set is_no_show';
    END IF;
    -- Phase 6.3 — matches the already-established rule on the reviews
    -- table's own INSERT policy (status must be 'Completed'). Without
    -- this, a customer could write a "review" onto a booking that was
    -- never completed by updating bookings.rated/review_rating directly,
    -- bypassing the reviews table entirely.
    IF (NEW.rated IS DISTINCT FROM OLD.rated
        OR NEW.review_rating IS DISTINCT FROM OLD.review_rating
        OR NEW.review_comment IS DISTINCT FROM OLD.review_comment)
       AND OLD.status != 'Completed' THEN
      RAISE EXCEPTION 'Customers can only review a Completed booking';
    END IF;
    IF NEW.worker_id IS DISTINCT FROM OLD.worker_id THEN
      RAISE EXCEPTION 'Customers cannot reassign the worker on a booking';
    END IF;
    IF NEW.worker_live_lat IS DISTINCT FROM OLD.worker_live_lat
       OR NEW.worker_live_lng IS DISTINCT FROM OLD.worker_live_lng
       OR NEW.worker_last_seen IS DISTINCT FROM OLD.worker_last_seen THEN
      RAISE EXCEPTION 'Customers cannot modify worker location fields';
    END IF;
    IF NEW.arrival_otp IS DISTINCT FROM OLD.arrival_otp
       OR NEW.completion_otp IS DISTINCT FROM OLD.completion_otp THEN
      RAISE EXCEPTION 'Customers cannot modify OTP fields';
    END IF;
    IF NEW.price IS DISTINCT FROM OLD.price
       OR NEW.base_price IS DISTINCT FROM OLD.base_price THEN
      RAISE EXCEPTION 'Customers cannot modify price fields';
    END IF;
  END IF;

  -- Worker-owned update (auth.uid() = OLD.worker_id).
  IF auth.uid() = OLD.worker_id THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Workers cannot reassign the customer on a booking';
    END IF;
    IF NEW.customer_lat IS DISTINCT FROM OLD.customer_lat
       OR NEW.customer_lng IS DISTINCT FROM OLD.customer_lng
       OR NEW.address IS DISTINCT FROM OLD.address THEN
      RAISE EXCEPTION 'Workers cannot modify customer location/address fields';
    END IF;
    IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
      RAISE EXCEPTION 'Workers cannot modify the payment method';
    END IF;
    IF NEW.rated IS DISTINCT FROM OLD.rated
       OR NEW.review_rating IS DISTINCT FROM OLD.review_rating
       OR NEW.review_comment IS DISTINCT FROM OLD.review_comment THEN
      RAISE EXCEPTION 'Workers cannot modify review fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER trg_enforce_booking_update_boundaries
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION enforce_booking_update_boundaries();

CREATE POLICY bookings_update
ON bookings
FOR UPDATE
TO public
USING (auth.uid() = user_id OR auth.uid() = worker_id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = worker_id);

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
ON reviews
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

-- Phase 8, admin.js: loadUsers() — a second, functionally overlapping
-- admin-read policy added independently for the new Users tab; not
-- consolidated with "Active admins can view all users" above.
CREATE POLICY admins_can_select_all_users
ON users
FOR SELECT
TO public
USING (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = auth.email() AND a.is_active = true)
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

-- Phase 8, live-confirmed fix — workers_update above only ever allowed
-- a worker to update their OWN row. Prior to this policy, an admin's
-- ban write (admin.js: confirmBanWorker()) matched zero rows under RLS
-- and returned no error, so admin.js reported a false "success" while
-- the database was never actually updated. Confirmed and fixed live.
CREATE POLICY admins_can_update_any_worker
ON workers
FOR UPDATE
TO public
USING (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = auth.email() AND a.is_active = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = auth.email() AND a.is_active = true)
);

-- Phase 8 — added independently of admins_can_update_any_worker above
-- (both grant admins UPDATE on workers; not consolidated into one
-- policy — a known, documented redundancy, not a bug).
CREATE POLICY admins_can_update_worker_verification
ON workers
FOR UPDATE
TO public
USING (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = auth.email() AND a.is_active = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = auth.email() AND a.is_active = true)
);

-- =====================================================
-- WORKER_BANS (Phase 8)
-- =====================================================

ALTER TABLE worker_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY admins_can_select_worker_bans
ON worker_bans
FOR SELECT
TO public
USING (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = auth.email() AND a.is_active = true)
);

CREATE POLICY admins_can_insert_worker_bans
ON worker_bans
FOR INSERT
TO public
WITH CHECK (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = auth.email() AND a.is_active = true)
);

-- NOTE: no policy grants a worker SELECT on their own ban history.
-- Inconsistent with worker_bonuses below, which does grant self-access —
-- not reconciled, flagged as a known gap.

-- =====================================================
-- WORKER_BONUSES (Phase 8)
-- =====================================================

ALTER TABLE worker_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY admins_can_select_worker_bonuses
ON worker_bonuses
FOR SELECT
TO public
USING (
  EXISTS (SELECT 1 FROM admins a WHERE a.email = auth.email() AND a.is_active = true)
);

CREATE POLICY workers_can_select_own_bonuses
ON worker_bonuses
FOR SELECT
TO public
USING (auth.uid() = worker_id);

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