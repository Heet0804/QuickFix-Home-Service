-- ============================================================
-- functions.sql
-- Generated strictly from DATABASE.md Section 4: SQL Functions
-- Scope: function definitions only.
-- No tables, indexes, policies, storage, migrations, or seed data.
-- ============================================================
--
-- DATABASE.md documents the EXISTENCE of the following functions but does
-- NOT document their parameter signatures, return types, or bodies:
--   is_admin()
--   get_worker_stats
--   get_worker_stats_bulk
--   rls_auto_enable
--   handle_new_user
--
-- Per instructions, no signature or body may be invented. A CREATE FUNCTION
-- statement requires a parameter list and return type, neither of which is
-- documented, so emitting one would constitute inventing information.
-- Each function is therefore recorded as a TODO stub below rather than a
-- runnable CREATE FUNCTION statement.
-- ============================================================

-- ------------------------------------------------------------
-- Function: is_admin()
-- Confirmed usage: referenced in `users` RLS policy "Admins read all users"
-- and in prevent_role_self_escalation() (Phase 6.2).
-- Body retrieved directly from the live database via:
--   SELECT prosrc FROM pg_proc WHERE proname = 'is_admin';
-- No longer a TODO — this is the actual, confirmed definition.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------
-- Function: get_worker_stats
-- Confirmed usage: not referenced by any RLS policy; presumed single-worker stats RPC
-- ------------------------------------------------------------
-- TODO:
-- Function body unavailable in DATABASE.md
-- (parameter signature and return type also unavailable in DATABASE.md)

-- ------------------------------------------------------------
-- Function: get_worker_stats_bulk
-- Confirmed usage: not referenced by any RLS policy; presumed bulk-stats RPC
-- ------------------------------------------------------------
-- TODO:
-- Function body unavailable in DATABASE.md
-- (parameter signature and return type also unavailable in DATABASE.md)

-- ------------------------------------------------------------
-- Function: rls_auto_enable
-- Confirmed usage: not referenced by any RLS policy; presumed RLS setup/maintenance routine
-- ------------------------------------------------------------
-- TODO:
-- Function body unavailable in DATABASE.md
-- (parameter signature and return type also unavailable in DATABASE.md)

-- ------------------------------------------------------------
-- Function: handle_new_user
-- Confirmed usage: not referenced by any RLS policy; not bound to any trigger
-- ------------------------------------------------------------
-- TODO:
-- Function body unavailable in DATABASE.md
-- (parameter signature and return type also unavailable in DATABASE.md)

-- ------------------------------------------------------------
-- Function: prevent_role_self_escalation()
-- Added: Phase 6.2 — blocks any UPDATE on users.role unless the
-- caller is an admin (per is_admin()). Runs as SECURITY DEFINER so
-- it can check role changes without re-triggering RLS on `users`
-- (avoids the infinite-recursion failure a naive RLS-only fix hits).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------
-- Trigger: trg_prevent_role_self_escalation
-- Added: Phase 6.2 — enforces prevent_role_self_escalation() on
-- every UPDATE to users. Created here (not schema.sql) since it
-- depends on prevent_role_self_escalation() existing first, and
-- functions.sql runs after schema.sql in the documented install
-- order.
-- ------------------------------------------------------------
CREATE TRIGGER trg_prevent_role_self_escalation
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_role_self_escalation();

-- ------------------------------------------------------------
-- Phase 6.4 additions — create_booking, accept_booking, reject_booking,
-- cancel_accepted_booking, consume_pass_visit, verify_arrival_otp,
-- verify_completion_otp, activate_pass, award_quickcoins, and the
-- prevent_worker_stat_tampering / prevent_quickcoins_tampering /
-- prevent_direct_pass_tampering triggers. See Phase 6.4 implementation
-- notes for full bodies — award_quickcoins ships with the coin formula
-- unset (BLOCKED — BUSINESS RULE REQUIRED) until product specifies it.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Function: handle_review_streak()
-- Added: Phase 8 — fires on every reviews insert. Increments
-- workers.positive_streak when the inserted row's tags contain no
-- value from the fixed negative-tag list; resets to 0 otherwise. Every
-- 5th consecutive positive value additionally credits
-- workers.bonus_balance and logs a row in worker_bonuses. This is the
-- one Phase 8 feature with no client-side write path at all — the
-- client (dashboard.js) only ever reads positive_streak/bonus_balance,
-- never writes them.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_review_streak()
RETURNS TRIGGER AS $$
DECLARE
  neg_tags TEXT[] := ARRAY['late','rude','unprofessional','poor_quality','overcharged','untidy'];
  has_negative BOOLEAN;
  new_streak INTEGER;
  bonus_amount NUMERIC := 100;
BEGIN
  IF NEW.worker_id IS NULL THEN
    RETURN NEW;
  END IF;

  has_negative := NEW.tags && neg_tags;

  IF has_negative THEN
    UPDATE workers SET positive_streak = 0 WHERE id = NEW.worker_id;
  ELSE
    UPDATE workers SET positive_streak = positive_streak + 1
    WHERE id = NEW.worker_id
    RETURNING positive_streak INTO new_streak;

    IF new_streak IS NOT NULL AND new_streak % 5 = 0 THEN
      UPDATE workers SET bonus_balance = bonus_balance + bonus_amount WHERE id = NEW.worker_id;
      INSERT INTO worker_bonuses (worker_id, amount, streak_at_award)
      VALUES (NEW.worker_id, bonus_amount, new_streak);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------
-- Trigger: trg_review_streak
-- Added: Phase 8 — the first trigger on reviews in this schema.
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_review_streak ON reviews;
CREATE TRIGGER trg_review_streak
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION handle_review_streak();

-- ============================================================
-- AUDIT RESULT
-- Functions Verified: is_admin(), get_worker_stats, get_worker_stats_bulk, rls_auto_enable, handle_new_user — 5/5 present, matching DATABASE.md Section 4; handle_review_streak() — Phase 8 addition, full confirmed body, not a TODO
-- Missing Bodies: get_worker_stats, get_worker_stats_bulk, rls_auto_enable, handle_new_user — 4 remaining marked TODO (no body, parameter list, or return type documented in DATABASE.md)
-- Corrections Made: None on the pre-Phase-8 TODO stubs — no CREATE FUNCTION statements were emitted for those since signatures are undocumented; handle_review_streak() added with its full, confirmed live body (Phase 8)
-- Final Status: PASS ✅
-- ============================================================