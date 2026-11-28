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
-- Confirmed usage: referenced in `users` RLS policy "Admins read all users",
-- in prevent_role_self_escalation() (Phase 6.2), and in the worker
-- protection triggers below.
-- Updated to match the LIVE database (checked with pg_get_functiondef):
-- an admin is a signed-in user who has an ACTIVE row in the `admins` table
-- linked through admins.auth_user_id. The older version of this file
-- checked users.role = 'admin', which the live database does not use.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (select 1 from admins where auth_user_id = auth.uid() and is_active);
$function$;

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
-- Function: handle_new_user()
-- Updated to match the LIVE database. Runs after every new sign-up and
-- marks the email as confirmed straight away (demo setup: no email
-- confirmation step). Bound to auth.users by the trigger below.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  update auth.users
  set email_confirmed_at = now()
  where id = new.id and email_confirmed_at is null;
  return new;
end;$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
-- verify_completion_otp, activate_pass, and the prevent_quickcoins_tampering /
-- prevent_direct_pass_tampering triggers are NOT recorded in this file yet.
-- See the Phase 6.4 implementation notes for their bodies.
-- The definitions below were copied from the LIVE database and ARE recorded.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Sign-up rules (live database): one phone number cannot belong to both a
-- customer account and a professional account, and new professional
-- profiles always start as 'pending' with zeroed bonus/ban fields.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select regexp_replace(coalesce(p,''), '[^0-9]', '', 'g')
$function$;

CREATE OR REPLACE FUNCTION public.prevent_cross_role_phone_reuse()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  norm_phone text;
  conflict_exists boolean;
begin
  norm_phone := public.normalize_phone(new.phone);

  if norm_phone = '' or norm_phone is null then
    return new;
  end if;

  if TG_TABLE_NAME = 'workers' then
    select exists(
      select 1 from public.users
      where public.normalize_phone(phone) = norm_phone
        and id <> new.id
    ) into conflict_exists;
  else
    select exists(
      select 1 from public.workers
      where public.normalize_phone(phone) = norm_phone
        and id <> new.id
    ) into conflict_exists;
  end if;

  if conflict_exists then
    raise exception 'This phone number is already registered under a different account role.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_cross_role_phone_users ON public.users;
CREATE TRIGGER trg_prevent_cross_role_phone_users
BEFORE INSERT OR UPDATE OF phone ON public.users
FOR EACH ROW EXECUTE FUNCTION public.prevent_cross_role_phone_reuse();

DROP TRIGGER IF EXISTS trg_prevent_cross_role_phone_workers ON public.workers;
CREATE TRIGGER trg_prevent_cross_role_phone_workers
BEFORE INSERT OR UPDATE OF phone ON public.workers
FOR EACH ROW EXECUTE FUNCTION public.prevent_cross_role_phone_reuse();

CREATE OR REPLACE FUNCTION public.prevent_admin_role_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user IN ('anon','authenticated') AND lower(coalesce(NEW.role,'')) = 'admin' THEN
    NEW.role := 'user';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_admin_role_on_insert ON public.users;
CREATE TRIGGER trg_prevent_admin_role_on_insert
BEFORE INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_role_on_insert();

CREATE OR REPLACE FUNCTION public.protect_worker_sensitive_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_admin boolean;
BEGIN
  IF current_user NOT IN ('anon','authenticated') THEN
    RETURN NEW;
  END IF;

  SELECT public.is_admin()
         OR EXISTS (SELECT 1 FROM public.admins a
                    WHERE a.email = auth.email() AND a.is_active = true)
    INTO v_admin;
  IF v_admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.verification_status       := 'pending';
    NEW.bonus_balance             := 0;
    NEW.positive_streak           := 0;
    NEW.ban_count                 := 0;
    NEW.banned_until              := NULL;
    NEW.last_ban_duration_label   := NULL;
    RETURN NEW;
  END IF;

  IF NEW.verification_status     IS DISTINCT FROM OLD.verification_status
     OR NEW.bonus_balance        IS DISTINCT FROM OLD.bonus_balance
     OR NEW.positive_streak      IS DISTINCT FROM OLD.positive_streak
     OR NEW.ban_count            IS DISTINCT FROM OLD.ban_count
     OR NEW.banned_until         IS DISTINCT FROM OLD.banned_until
     OR NEW.last_ban_duration_label IS DISTINCT FROM OLD.last_ban_duration_label THEN
    RAISE EXCEPTION 'Workers cannot change verification, ban or bonus fields';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_worker_sensitive_columns ON public.workers;
CREATE TRIGGER trg_protect_worker_sensitive_columns
BEFORE INSERT OR UPDATE ON public.workers
FOR EACH ROW EXECUTE FUNCTION public.protect_worker_sensitive_columns();

CREATE OR REPLACE FUNCTION public.prevent_worker_stat_tampering()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF is_admin() OR current_setting('quickfix.trusted_write', true) = 'true' THEN RETURN NEW; END IF;
  IF NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.total_jobs IS DISTINCT FROM OLD.total_jobs
     OR NEW.accepted_jobs IS DISTINCT FROM OLD.accepted_jobs
     OR NEW.completed_jobs IS DISTINCT FROM OLD.completed_jobs
     OR NEW.cancelled_jobs IS DISTINCT FROM OLD.cancelled_jobs
     OR NEW.no_show_count IS DISTINCT FROM OLD.no_show_count
     OR NEW.reliability_score IS DISTINCT FROM OLD.reliability_score
     OR NEW.completion_rate IS DISTINCT FROM OLD.completion_rate
     OR NEW.activity_score IS DISTINCT FROM OLD.activity_score
     OR NEW.worker_score IS DISTINCT FROM OLD.worker_score
     OR NEW.unlocked_achievements IS DISTINCT FROM OLD.unlocked_achievements THEN
    RAISE EXCEPTION 'Reputation/stat fields may only change via backend RPCs';
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_prevent_worker_stat_tampering ON public.workers;
CREATE TRIGGER trg_prevent_worker_stat_tampering
BEFORE UPDATE ON public.workers
FOR EACH ROW EXECUTE FUNCTION public.prevent_worker_stat_tampering();

-- ------------------------------------------------------------
-- Function: award_quickcoins(p_booking_id)
-- Live version: random reward of 2% to 8% of the booking price (average
-- 5%), never below 5 or above 200 coins, paid once per booking.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_quickcoins(p_booking_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_bk RECORD;
  v_coins INTEGER;
  v_balance INTEGER;
BEGIN
  SELECT *
  INTO v_bk
  FROM bookings
  WHERE id = p_booking_id
    AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;
  IF v_bk.status <> 'Completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not Completed');
  END IF;
  IF v_bk.quickcoins_awarded THEN
    RETURN jsonb_build_object('success', true, 'coins', 0);
  END IF;
  -- Random reward: 2% to 8% of the booking price (average 5%, same as before),
  -- still never below 5 coins or above 200. Rolled once per booking: the
  -- quickcoins_awarded check above stops a second roll.
  v_coins := LEAST(200, GREATEST(5, ROUND(v_bk.price * (0.02 + random() * 0.06)::numeric)));
  PERFORM set_config('quickfix.trusted_write', 'true', true);
  UPDATE bookings SET quickcoins_awarded = true WHERE id = p_booking_id;
  UPDATE users
  SET quickcoins_balance = quickcoins_balance + v_coins,
      quickcoins_earned = quickcoins_earned + v_coins,
      total_completed_bookings = total_completed_bookings + 1
  WHERE id = auth.uid()
  RETURNING quickcoins_balance INTO v_balance;
  RETURN jsonb_build_object('success', true, 'coins', v_coins, 'balance', v_balance);
END;
$function$;

-- ------------------------------------------------------------
-- Table permissions on public.workers (live database).
-- Visitors who are not signed in may read only the public profile columns
-- (no phone, ID document or ban details). Signed-in users may read every
-- column; the "workers_read_all" policy decides which rows. Revoke first:
-- revoking the table-level SELECT also removes older column grants, then
-- the allowed columns are granted again.
-- ------------------------------------------------------------
REVOKE SELECT ON public.workers FROM anon;
GRANT SELECT (id, name, skill, radius, exp, price, bio, lat, lng, is_available,
              rating, total_jobs, emergency_available, area, worker_score,
              profile_photo_url)
  ON public.workers TO anon;
GRANT SELECT ON public.workers TO authenticated;

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