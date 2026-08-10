-- =====================================================
-- QuickFix Database Schema
-- Generated from DATABASE.md (source of truth)
-- Target: PostgreSQL / Supabase
-- =====================================================

-- =====================================================
-- SEQUENCES
-- Implied by documented `nextval('<seq>'::regclass)` column defaults
-- in DATABASE.md Section 2. Created explicitly here (rather than via
-- GENERATED ... AS IDENTITY) so the column DEFAULT reproduces the exact
-- expression documented in DATABASE.md.
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS areas_id_seq;
CREATE SEQUENCE IF NOT EXISTS campaigns_id_seq;
CREATE SEQUENCE IF NOT EXISTS admins_id_seq;
CREATE SEQUENCE IF NOT EXISTS worker_achievements_id_seq;

-- =====================================================
-- AREAS
-- =====================================================

CREATE TABLE areas (
    id  BIGINT NOT NULL DEFAULT nextval('areas_id_seq'::regclass),
    name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,

    CONSTRAINT areas_pkey PRIMARY KEY (id),
    CONSTRAINT areas_name_key UNIQUE (name),
    CONSTRAINT areas_lat_check CHECK (lat >= -90 AND lat <= 90),
    CONSTRAINT areas_lng_check CHECK (lng >= -180 AND lng <= 180)
);

ALTER SEQUENCE areas_id_seq OWNED BY areas.id;

-- =====================================================
-- USERS
-- =====================================================

-- NOTE: users_id_fkey (id -> auth.users.id) — DATABASE.md documents this
-- constraint by name but states its target is "not resolvable from public
-- schema constraint metadata"; implemented against auth.users(id) as the
-- standard Supabase auth-linking pattern DATABASE.md itself names, and
-- flagged as inferred below. Not fabricated beyond that documented hedge.

CREATE TABLE users (
    id                        UUID NOT NULL,
    email                     TEXT NOT NULL,
    name                      TEXT,
    phone                     TEXT,
    role                      TEXT DEFAULT 'user'::text,
    created_at                TIMESTAMP WITH TIME ZONE DEFAULT now(),
    saved_address             TEXT,
    quickcoins_balance        INTEGER NOT NULL DEFAULT 0,
    quickcoins_earned         INTEGER NOT NULL DEFAULT 0,
    quickcoins_redeemed       INTEGER NOT NULL DEFAULT 0,
    total_completed_bookings  INTEGER NOT NULL DEFAULT 0,
    saved_area_id             BIGINT,
    saved_lat                 DOUBLE PRECISION,
    saved_lng                 DOUBLE PRECISION,

    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_saved_lat_check CHECK (saved_lat IS NULL OR (saved_lat >= -90 AND saved_lat <= 90)),
    CONSTRAINT users_saved_lng_check CHECK (saved_lng IS NULL OR (saved_lng >= -180 AND saved_lng <= 180)),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_saved_area_id_fkey FOREIGN KEY (saved_area_id)
        REFERENCES areas (id),
    -- INFERRED per DATABASE.md: id -> likely auth.users.id
    CONSTRAINT users_id_fkey FOREIGN KEY (id)
        REFERENCES auth.users (id),
    -- users_role_check already exists live (confirmed via pg_constraint
    -- during Phase 6.3 audit): CHECK (role IN ('user','worker','admin'))
    -- Not recreated here to avoid a duplicate-constraint error.
    -- Phase 6.3 — floors only. Does NOT stop a user writing an arbitrary
    -- absolute balance (e.g. 999999) via users_own RLS, since the app
    -- computes and writes a new total client-side rather than a
    -- server-verified delta. That is a Phase 6.4 concern (same class as
    -- the Finding 1 role-escalation fix: needs a SECURITY DEFINER path,
    -- not a value-range check), not resolved by this constraint.
    CONSTRAINT users_quickcoins_balance_check CHECK (quickcoins_balance >= 0),
    CONSTRAINT users_quickcoins_earned_check CHECK (quickcoins_earned >= 0),
    CONSTRAINT users_quickcoins_redeemed_check CHECK (quickcoins_redeemed >= 0)
);

-- =====================================================
-- WORKERS
-- =====================================================

-- NOTE: workers_id_fkey (id -> auth.users.id) — DATABASE.md documents this
-- constraint by name but states its target is "not resolvable from public
-- schema constraint metadata"; implemented against auth.users(id) as the
-- standard Supabase auth-linking pattern DATABASE.md itself names, and
-- flagged as inferred below. Not fabricated beyond that documented hedge.

CREATE TABLE workers (
    id                     UUID NOT NULL,
    name                   TEXT,
    phone                  TEXT,
    skill                  TEXT,
    radius                 INTEGER DEFAULT 10,
    exp                    TEXT,
    price                  INTEGER,
    bio                    TEXT,
    lat                    DOUBLE PRECISION,
    lng                    DOUBLE PRECISION,
    is_available           BOOLEAN DEFAULT false,
    rating                 DOUBLE PRECISION DEFAULT 0,
    total_jobs             INTEGER DEFAULT 0,
    emergency_available    BOOLEAN DEFAULT false,
    area                   TEXT,
    accepted_jobs          INTEGER DEFAULT 0,
    completed_jobs         INTEGER DEFAULT 0,
    cancelled_jobs         INTEGER DEFAULT 0,
    no_show_count          INTEGER DEFAULT 0,
    reliability_score      NUMERIC DEFAULT 0,
    completion_rate        NUMERIC DEFAULT 100,
    activity_score         NUMERIC DEFAULT 100,
    worker_score           NUMERIC DEFAULT 100,
    document_url           TEXT,
    document_name          TEXT,
    unlocked_achievements  JSONB DEFAULT '[]'::jsonb,
    profile_photo_url      TEXT,

    CONSTRAINT workers_pkey PRIMARY KEY (id),
    CONSTRAINT workers_lat_check CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
    CONSTRAINT workers_lng_check CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),
    -- INFERRED per DATABASE.md: id -> likely auth.users.id
    CONSTRAINT workers_id_fkey FOREIGN KEY (id)
        REFERENCES auth.users (id),
    -- Phase 6.3 — matches profile.js's own client-side bound (radius<1
    -- or >100 is rejected there); DB previously had no matching floor/ceiling.
    CONSTRAINT workers_radius_check CHECK (radius IS NULL OR (radius >= 1 AND radius <= 100)),
    CONSTRAINT workers_price_check CHECK (price IS NULL OR price >= 0),
    CONSTRAINT workers_rating_check CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5))
);

-- =====================================================
-- CAMPAIGNS
-- =====================================================

CREATE TABLE campaigns (
    id                  BIGINT NOT NULL DEFAULT nextval('campaigns_id_seq'::regclass),
    title               TEXT NOT NULL,
    service             TEXT NOT NULL,
    description         TEXT,
    price               NUMERIC NOT NULL,
    number_of_visits    INTEGER NOT NULL DEFAULT 1,
    validity_days       INTEGER NOT NULL,
    emergency_included  BOOLEAN NOT NULL DEFAULT false,
    priority_booking    BOOLEAN NOT NULL DEFAULT false,
    offer_start_date    TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    offer_end_date      TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    priority            INTEGER NOT NULL DEFAULT 1,
    status              TEXT NOT NULL DEFAULT 'active'::text,
    created_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),

    CONSTRAINT campaigns_pkey PRIMARY KEY (id),
    -- campaigns_status_check already exists live (confirmed via
    -- pg_constraint during Phase 6.3 audit): CHECK (status IN ('active','inactive'))
    -- Not recreated here to avoid a duplicate-constraint error; documented
    -- for completeness only.
    -- Phase 6.3 — admin.js validates these client-side only; no DB floor existed.
    CONSTRAINT campaigns_price_check CHECK (price >= 0),
    CONSTRAINT campaigns_visits_check CHECK (number_of_visits >= 1),
    CONSTRAINT campaigns_validity_check CHECK (validity_days >= 1),
    CONSTRAINT campaigns_date_order_check CHECK (offer_end_date > offer_start_date)
);

ALTER SEQUENCE campaigns_id_seq OWNED BY campaigns.id;

-- =====================================================
-- BOOKINGS
-- =====================================================

CREATE TABLE bookings (
    id                  TEXT NOT NULL,
    user_id             UUID,
    worker_id           UUID,
    worker_role         TEXT,
    worker_emoji        TEXT,
    service             TEXT,
    date                TEXT,
    time                TEXT,
    address             TEXT,
    notes               TEXT,
    price               INTEGER,
    base_price          INTEGER,
    payment_method      TEXT,
    status              TEXT DEFAULT 'Confirmed'::text
        CHECK (status IN ('Pending','Scheduled','Confirmed','Accepted','Worker on Way','Arrived','Completed','Cancelled','Rejected')),
    w_status            TEXT DEFAULT 'available'::text,
    arrival_otp         TEXT,
    completion_otp      TEXT,
    is_emergency        BOOLEAN DEFAULT false,
    is_advance          BOOLEAN DEFAULT false,
    worker_name         TEXT,
    worker_phone        TEXT,
    worker_dist         DOUBLE PRECISION,
    worker_earning      INTEGER,
    rated               BOOLEAN DEFAULT false,
    review_rating       INTEGER,
    review_comment      TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at        TIMESTAMP WITH TIME ZONE,
    hidden_by_user      BOOLEAN DEFAULT false,
    accepted_at         TIMESTAMP WITH TIME ZONE,
    on_way_at           TIMESTAMP WITH TIME ZONE,
    arrived_at          TIMESTAMP WITH TIME ZONE,
    started_at          TIMESTAMP WITH TIME ZONE,
    reviewed_at         TIMESTAMP WITH TIME ZONE,
    worker_live_lat     DOUBLE PRECISION,
    worker_live_lng     DOUBLE PRECISION,
    worker_last_seen    TIMESTAMP WITH TIME ZONE,
    area_id             BIGINT,
    customer_lat        DOUBLE PRECISION,
    customer_lng        DOUBLE PRECISION,
    is_no_show          BOOLEAN NOT NULL DEFAULT false,
    scheduled_date      DATE NOT NULL,
    scheduled_time      TIME WITHOUT TIME ZONE,
    -- Phase 6.3 — coordinates and scheduled_date had no validation anywhere,
    -- client or DB. scheduled_date allows today or later at INSERT time;
    -- deliberately not restricted on UPDATE, since legitimate lifecycle
    -- updates (status changes etc.) must not be blocked by a stale date.
    pass_used           BOOLEAN DEFAULT false,
    priority_booking    BOOLEAN DEFAULT false,
    pass_id             BIGINT,
    route_distance_km   DOUBLE PRECISION,
    eta_minutes         INTEGER,
    address_verified    BOOLEAN DEFAULT false,

    CONSTRAINT bookings_pkey PRIMARY KEY (id),
    CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users (id),
    CONSTRAINT bookings_worker_id_fkey FOREIGN KEY (worker_id)
        REFERENCES workers (id),
    -- Phase 6.3 — bookings.price/base_price are written by client-computed
    -- JS with no DB-level floor. This CHECK stops negative prices; it does
    -- NOT validate the price is correct for the service (that requires
    -- server-side price computation, a Phase 6.4 concern, not fixed here).
    CONSTRAINT bookings_price_check CHECK (price IS NULL OR price >= 0),
    CONSTRAINT bookings_base_price_check CHECK (base_price IS NULL OR base_price >= 0),
    CONSTRAINT bookings_customer_lat_check CHECK (customer_lat IS NULL OR (customer_lat >= -90 AND customer_lat <= 90)),
    CONSTRAINT bookings_customer_lng_check CHECK (customer_lng IS NULL OR (customer_lng >= -180 AND customer_lng <= 180))
    -- NOTE: area_id and pass_id have no enforced FK per DATABASE.md.
);

-- Phase 6.3 — scheduled_date had no protection against past dates. A
-- plain CHECK would incorrectly block legitimate status-update calls on
-- older bookings, so this is enforced via an INSERT-only trigger instead.
CREATE OR REPLACE FUNCTION prevent_past_scheduled_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scheduled_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'scheduled_date cannot be in the past';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_past_scheduled_date
BEFORE INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION prevent_past_scheduled_date();

-- NOTE: secondary indexes on bookings (idx_bookings_worker,
-- idx_bookings_status) are created in indexes.sql, not here, to avoid
-- creating the same index twice when schema.sql and indexes.sql are both
-- run in the documented installation order.

-- =====================================================
-- REVIEWS
-- =====================================================

CREATE TABLE reviews (
    id          UUID NOT NULL DEFAULT gen_random_uuid(),
    booking_id  TEXT,
    user_id     UUID,
    worker_id   UUID,
    rating      INTEGER,
    comment     TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),

    CONSTRAINT reviews_pkey PRIMARY KEY (id),
    CONSTRAINT reviews_booking_id_fkey FOREIGN KEY (booking_id)
        REFERENCES bookings (id),
    CONSTRAINT reviews_worker_id_fkey FOREIGN KEY (worker_id)
        REFERENCES workers (id),
    CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users (id)
    -- reviews_rating_check already exists live (confirmed via
    -- pg_constraint, Phase 6.3 audit): CHECK (rating BETWEEN 1 AND 5).
    -- Not recreated here to avoid a duplicate-constraint error.
    -- TODO (superseded, kept for context): reviews_rating_check CHECK constraint on "rating" is
    -- documented to exist but its bounds are not enumerated in
    -- DATABASE.md. Not fabricated.
);

-- =====================================================
-- WORKER_ACHIEVEMENTS
-- =====================================================

CREATE TABLE worker_achievements (
    id              BIGINT NOT NULL DEFAULT nextval('worker_achievements_id_seq'::regclass),
    worker_id       UUID NOT NULL,
    achievement_id  TEXT NOT NULL,
    unlocked_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    category        TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL,

    CONSTRAINT worker_achievements_pkey PRIMARY KEY (id),
    CONSTRAINT worker_achievements_worker_id_achievement_id_key
        UNIQUE (worker_id, achievement_id),
    CONSTRAINT worker_achievements_worker_id_fkey FOREIGN KEY (worker_id)
        REFERENCES workers (id)
);

ALTER SEQUENCE worker_achievements_id_seq OWNED BY worker_achievements.id;

-- NOTE: secondary index idx_worker_achievements_worker is created in
-- indexes.sql, not here, to avoid creating the same index twice when
-- schema.sql and indexes.sql are both run in the documented installation
-- order.

-- =====================================================
-- USER_PASSES
-- =====================================================

-- NOTE: user_passes_user_id_fkey target is documented as "inferred"
-- (users.id), consistent with the equivalent pattern used in
-- bookings/reviews and RLS comparisons against auth.uid(). Implemented
-- as FK to users(id) per DATABASE.md's explicit relationship table.

CREATE TABLE user_passes (
    id                  BIGINT NOT NULL,
    user_id             UUID NOT NULL,
    campaign_id         BIGINT NOT NULL,
    purchase_date       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expiry_date         TIMESTAMP WITH TIME ZONE NOT NULL,
    visits_remaining    INTEGER NOT NULL,
    total_visits        INTEGER NOT NULL,
    emergency_included  BOOLEAN NOT NULL DEFAULT false,
    priority_booking    BOOLEAN NOT NULL DEFAULT false,
    status              TEXT NOT NULL DEFAULT 'active'::text,

    CONSTRAINT user_passes_pkey PRIMARY KEY (id),
    CONSTRAINT user_passes_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users (id),
    CONSTRAINT user_passes_campaign_id_fkey FOREIGN KEY (campaign_id)
        REFERENCES campaigns (id),
    -- Phase 6.3 — visits_remaining/total_visits are written from a
    -- client-held campaign object (index.js activatePass()), with no
    -- server-side cross-check against the real campaigns row. This CHECK
    -- stops negative/nonsensical values; it does NOT stop a client from
    -- writing an inflated-but-still-valid visit count (that requires a
    -- server-side lookup, a Phase 6.4 concern).
    CONSTRAINT user_passes_visits_remaining_check CHECK (visits_remaining >= 0),
    CONSTRAINT user_passes_total_visits_check CHECK (total_visits >= 1),
    CONSTRAINT user_passes_expiry_check CHECK (expiry_date > purchase_date)
);
-- NOTE: DATABASE.md documents no DEFAULT (e.g. sequence/identity) for
-- user_passes.id, unlike every other bigint PK in this schema. Reproduced
-- as documented, not fabricated.

-- =====================================================
-- ADMINS
-- =====================================================

-- NOTE: admins_auth_user_id_fkey (auth_user_id -> auth.users.id) —
-- DATABASE.md documents this constraint by name but states its target is
-- "not resolvable from public schema constraint metadata"; implemented
-- against auth.users(id) as the standard Supabase auth-linking pattern
-- DATABASE.md itself names, and flagged as inferred below.

CREATE TABLE admins (
    id             BIGINT NOT NULL DEFAULT nextval('admins_id_seq'::regclass),
    auth_user_id   UUID,
    email          TEXT NOT NULL,
    full_name      TEXT,
    role           TEXT NOT NULL DEFAULT 'admin'::text,
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),

    CONSTRAINT admins_pkey PRIMARY KEY (id),
    CONSTRAINT admins_auth_user_id_key UNIQUE (auth_user_id),
    CONSTRAINT admins_email_key UNIQUE (email),
    -- INFERRED per DATABASE.md: auth_user_id -> likely auth.users.id
    CONSTRAINT admins_auth_user_id_fkey FOREIGN KEY (auth_user_id)
        REFERENCES auth.users (id)
);

ALTER SEQUENCE admins_id_seq OWNED BY admins.id;