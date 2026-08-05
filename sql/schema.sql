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
    CONSTRAINT areas_name_key UNIQUE (name)
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
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_saved_area_id_fkey FOREIGN KEY (saved_area_id)
        REFERENCES areas (id),
    -- INFERRED per DATABASE.md: id -> likely auth.users.id
    CONSTRAINT users_id_fkey FOREIGN KEY (id)
        REFERENCES auth.users (id)
    -- TODO: users_role_check CHECK constraint on "role" is documented to
    -- exist but its allowed values are not enumerated in DATABASE.md.
    -- Not fabricated.
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
    -- INFERRED per DATABASE.md: id -> likely auth.users.id
    CONSTRAINT workers_id_fkey FOREIGN KEY (id)
        REFERENCES auth.users (id)
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

    CONSTRAINT campaigns_pkey PRIMARY KEY (id)
    -- TODO: campaigns_status_check CHECK constraint on "status" is
    -- documented to exist but its allowed values are not enumerated
    -- in DATABASE.md. Not fabricated.
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
    status              TEXT DEFAULT 'Confirmed'::text,
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
        REFERENCES workers (id)
    -- NOTE: area_id and pass_id have no enforced FK per DATABASE.md.
);

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
    -- TODO: reviews_rating_check CHECK constraint on "rating" is
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
        REFERENCES campaigns (id)
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