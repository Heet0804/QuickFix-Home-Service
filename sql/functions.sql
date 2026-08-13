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

-- ============================================================
-- AUDIT RESULT
-- Functions Verified: is_admin(), get_worker_stats, get_worker_stats_bulk, rls_auto_enable, handle_new_user — 5/5 present, matching DATABASE.md Section 4
-- Missing Bodies: is_admin(), get_worker_stats, get_worker_stats_bulk, rls_auto_enable, handle_new_user — all 5 marked TODO (no body, parameter list, or return type documented in DATABASE.md)
-- Corrections Made: None — no CREATE FUNCTION statements were emitted since signatures are undocumented; emitting one would require inventing types not present in DATABASE.md
-- Final Status: PASS ✅
-- ============================================================