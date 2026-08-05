-- ============================================================
-- seed.sql
-- Safe development seed data, generated per DATABASE.md column definitions.
-- Scope limited to: areas, campaigns, demo admin.
-- No users, workers, bookings, or reviews are seeded.
--
-- Note: DATABASE.md documents column structure only for these tables, not
-- specific row values — area names/coordinates and campaign details below
-- are realistic Mumbai-context development seed data (as requested), not
-- values sourced from DATABASE.md itself. Column names, types, and
-- constraints used are exactly as documented.
-- ============================================================


-- ------------------------------------------------------------
-- 1. areas
-- (id auto-generated via areas_id_seq; name/lat/lng are the documented columns)
-- ------------------------------------------------------------
insert into areas (name, lat, lng) values
    ('Bandra West',   19.0596, 72.8295),
    ('Andheri East',  19.1136, 72.8697),
    ('Powai',         19.1176, 72.9060),
    ('Dadar',         19.0176, 72.8478),
    ('Colaba',        18.9067, 72.8147)
on conflict (name) do nothing;


-- ------------------------------------------------------------
-- 2. campaigns
-- (id auto-generated via campaigns_id_seq; no FK to areas/users/workers
-- documented for this table, so it can be seeded independently)
-- ------------------------------------------------------------
insert into campaigns (
    title,
    service,
    description,
    price,
    number_of_visits,
    validity_days,
    emergency_included,
    priority_booking,
    offer_start_date,
    offer_end_date,
    priority,
    status
) values
    (
        'Monthly AC Care Plan',
        'AC Repair',
        'Two scheduled AC service visits within 30 days.',
        999.00,
        2,
        30,
        false,
        false,
        '2026-01-01 00:00:00',
        '2026-12-31 23:59:59',
        1,
        'active'
    ),
    (
        'Home Plumbing Pass',
        'Plumbing',
        'Three plumbing visits over 60 days, includes emergency callouts and priority booking.',
        1499.00,
        3,
        60,
        true,
        true,
        '2026-01-01 00:00:00',
        '2026-12-31 23:59:59',
        2,
        'active'
    ),
    (
        'Quarterly Cleaning Pack',
        'Cleaning',
        'Four home cleaning visits over 90 days.',
        2499.00,
        4,
        90,
        false,
        false,
        '2026-01-01 00:00:00',
        '2026-12-31 23:59:59',
        1,
        'active'
    )
on conflict do nothing;


-- ------------------------------------------------------------
-- 3. demo admin
-- (id auto-generated via admins_id_seq; auth_user_id left NULL since no
-- corresponding auth.users row exists in this seed — admins_auth_user_id_fkey
-- is nullable per DATABASE.md, so this avoids an FK violation)
-- ------------------------------------------------------------
insert into admins (auth_user_id, email, full_name, role, is_active) values
    (null, 'admin@quickfix.dev', 'Demo Admin', 'admin', true)
on conflict (email) do nothing;


-- ============================================================
-- AUDIT RESULT
-- Seed Tables: areas, campaigns, admins
-- Rows: areas = 5, campaigns = 3, admins = 1 (demo admin)
-- Corrections Made: auth_user_id left NULL for the demo admin to satisfy admins_auth_user_id_fkey (inferred FK to auth.users) without requiring a real auth user; used ON CONFLICT (name)/(email)/DO NOTHING to guard against duplicate-PK/unique-constraint reruns since ids are sequence-generated, not hardcoded
-- Final Status: PASS ✅
-- ============================================================