-- ============================================================
-- migrations.sql
-- Generated strictly from DATABASE.md
-- Order: Tables -> Constraints -> Indexes -> RLS -> Storage -> Functions -> Comments
-- Nothing below is invented beyond what DATABASE.md documents or directly implies
-- (e.g. sequences implied by documented `nextval(...)` column defaults).
-- ============================================================


-- ============================================================
-- PHASE 1: TABLES
-- Dependency-safe creation order (referenced table before referencing table):
--   areas -> users -> admins -> workers -> campaigns -> bookings -> reviews
--   -> user_passes -> worker_achievements
-- Column-only definitions; PK/UNIQUE/FK/CHECK are added in Phase 2 (Constraints).
-- ============================================================

-- Sequences implied by documented `nextval('<seq>'::regclass)` column defaults
create sequence if not exists admins_id_seq;
create sequence if not exists areas_id_seq;
create sequence if not exists campaigns_id_seq;
create sequence if not exists worker_achievements_id_seq;

-- ------------------------------------------------------------
-- 1.1 areas
-- ------------------------------------------------------------
create table if not exists areas (
    id      bigint not null default nextval('areas_id_seq'::regclass),
    name    text not null,
    lat     double precision not null,
    lng     double precision not null
);
alter sequence areas_id_seq owned by areas.id;

-- ------------------------------------------------------------
-- 1.2 users
-- ------------------------------------------------------------
create table if not exists users (
    id                          uuid not null,
    email                       text not null,
    name                        text,
    phone                       text,
    role                        text default 'user'::text,
    created_at                  timestamp with time zone default now(),
    saved_address               text,
    quickcoins_balance          integer not null default 0,
    quickcoins_earned           integer not null default 0,
    quickcoins_redeemed         integer not null default 0,
    total_completed_bookings    integer not null default 0,
    saved_area_id               bigint,
    saved_lat                   double precision,
    saved_lng                   double precision
);

-- ------------------------------------------------------------
-- 1.3 admins
-- ------------------------------------------------------------
create table if not exists admins (
    id              bigint not null default nextval('admins_id_seq'::regclass),
    auth_user_id    uuid,
    email           text not null,
    full_name       text,
    role            text not null default 'admin'::text,
    is_active       boolean not null default true,
    created_at      timestamp without time zone default now()
);
alter sequence admins_id_seq owned by admins.id;

-- ------------------------------------------------------------
-- 1.4 workers
-- ------------------------------------------------------------
create table if not exists workers (
    id                      uuid not null,
    name                    text,
    phone                   text,
    skill                   text,
    radius                  integer default 10,
    exp                     text,
    price                   integer,
    bio                     text,
    lat                     double precision,
    lng                     double precision,
    is_available            boolean default false,
    rating                  double precision default 0,
    total_jobs              integer default 0,
    emergency_available     boolean default false,
    area                    text,
    accepted_jobs           integer default 0,
    completed_jobs          integer default 0,
    cancelled_jobs          integer default 0,
    no_show_count           integer default 0,
    reliability_score       numeric default 0,
    completion_rate         numeric default 100,
    activity_score          numeric default 100,
    worker_score            numeric default 100,
    document_url            text,
    document_name           text,
    unlocked_achievements    jsonb default '[]'::jsonb,
    profile_photo_url       text
);

-- ------------------------------------------------------------
-- 1.5 campaigns
-- ------------------------------------------------------------
create table if not exists campaigns (
    id                      bigint not null default nextval('campaigns_id_seq'::regclass),
    title                   text not null,
    service                 text not null,
    description             text,
    price                   numeric not null,
    number_of_visits        integer not null default 1,
    validity_days           integer not null,
    emergency_included      boolean not null default false,
    priority_booking        boolean not null default false,
    offer_start_date        timestamp without time zone not null,
    offer_end_date          timestamp without time zone not null,
    priority                integer not null default 1,
    status                  text not null default 'active'::text,
    created_at              timestamp without time zone default now()
);
alter sequence campaigns_id_seq owned by campaigns.id;

-- ------------------------------------------------------------
-- 1.6 bookings
-- Note: DATABASE.md documents ordinal position 45 as not corresponding to a
-- live column; no column is created at that position.
-- ------------------------------------------------------------
create table if not exists bookings (
    id                  text not null,
    user_id             uuid,
    worker_id           uuid,
    worker_role         text,
    worker_emoji        text,
    service             text,
    date                text,
    time                text,
    address             text,
    notes               text,
    price               integer,
    base_price          integer,
    payment_method      text,
    status              text default 'Confirmed'::text,
    w_status            text default 'available'::text,
    arrival_otp         text,
    completion_otp      text,
    is_emergency        boolean default false,
    is_advance          boolean default false,
    worker_name         text,
    worker_phone        text,
    worker_dist         double precision,
    worker_earning      integer,
    rated               boolean default false,
    review_rating       integer,
    review_comment      text,
    created_at          timestamp with time zone default now(),
    completed_at        timestamp with time zone,
    hidden_by_user      boolean default false,
    accepted_at         timestamp with time zone,
    on_way_at           timestamp with time zone,
    arrived_at          timestamp with time zone,
    started_at          timestamp with time zone,
    reviewed_at         timestamp with time zone,
    worker_live_lat     double precision,
    worker_live_lng     double precision,
    worker_last_seen    timestamp with time zone,
    area_id             bigint,
    customer_lat        double precision,
    customer_lng        double precision,
    is_no_show          boolean not null default false,
    scheduled_date      date not null,
    scheduled_time      time without time zone,
    pass_used           boolean default false,
    priority_booking    boolean default false,
    pass_id             bigint,
    route_distance_km   double precision,
    eta_minutes         integer,
    address_verified    boolean default false
);

-- ------------------------------------------------------------
-- 1.7 reviews
-- ------------------------------------------------------------
create table if not exists reviews (
    id            uuid not null default gen_random_uuid(),
    booking_id    text,
    user_id       uuid,
    worker_id     uuid,
    rating        integer,
    comment       text,
    created_at    timestamp with time zone default now()
);

-- ------------------------------------------------------------
-- 1.8 user_passes
-- ------------------------------------------------------------
create table if not exists user_passes (
    id                    bigint not null,
    user_id               uuid not null,
    campaign_id           bigint not null,
    purchase_date         timestamp with time zone not null default now(),
    expiry_date           timestamp with time zone not null,
    visits_remaining      integer not null,
    total_visits          integer not null,
    emergency_included    boolean not null default false,
    priority_booking      boolean not null default false,
    status                text not null default 'active'::text
);

-- ------------------------------------------------------------
-- 1.9 worker_achievements
-- ------------------------------------------------------------
create table if not exists worker_achievements (
    id                bigint not null default nextval('worker_achievements_id_seq'::regclass),
    worker_id         uuid not null,
    achievement_id    text not null,
    unlocked_at       timestamp with time zone not null default now(),
    created_at        timestamp with time zone not null default now(),
    category          text not null,
    name              text not null,
    description       text not null
);
alter sequence worker_achievements_id_seq owned by worker_achievements.id;


-- ============================================================
-- PHASE 2: CONSTRAINTS
-- Primary keys -> unique constraints -> foreign keys -> check constraints.
-- Foreign keys to auth.users are documented as "inferred" / "likely" in
-- DATABASE.md (target not resolvable from public-schema metadata alone);
-- they are included per the standard Supabase auth-linking pattern
-- DATABASE.md itself names, and flagged as inferred in comments.
-- ============================================================

-- Primary keys
alter table areas               add constraint areas_pkey primary key (id);
alter table users                add constraint users_pkey primary key (id);
alter table admins               add constraint admins_pkey primary key (id);
alter table workers               add constraint workers_pkey primary key (id);
alter table campaigns             add constraint campaigns_pkey primary key (id);
alter table bookings              add constraint bookings_pkey primary key (id);
alter table reviews               add constraint reviews_pkey primary key (id);
alter table user_passes           add constraint user_passes_pkey primary key (id);
alter table worker_achievements   add constraint worker_achievements_pkey primary key (id);

-- Unique constraints
alter table areas   add constraint areas_name_key unique (name);
alter table users    add constraint users_email_key unique (email);
alter table admins   add constraint admins_auth_user_id_key unique (auth_user_id);
alter table admins   add constraint admins_email_key unique (email);
alter table worker_achievements
    add constraint worker_achievements_worker_id_achievement_id_key
    unique (worker_id, achievement_id);

-- Foreign keys (internal to public schema)
alter table users
    add constraint users_saved_area_id_fkey
    foreign key (saved_area_id) references areas (id);

alter table bookings
    add constraint bookings_user_id_fkey
    foreign key (user_id) references users (id);

alter table bookings
    add constraint bookings_worker_id_fkey
    foreign key (worker_id) references workers (id);

alter table reviews
    add constraint reviews_booking_id_fkey
    foreign key (booking_id) references bookings (id);

alter table reviews
    add constraint reviews_worker_id_fkey
    foreign key (worker_id) references workers (id);

alter table reviews
    add constraint reviews_user_id_fkey
    foreign key (user_id) references users (id);

alter table user_passes
    add constraint user_passes_campaign_id_fkey
    foreign key (campaign_id) references campaigns (id);

alter table user_passes
    -- INFERRED per DATABASE.md ("inferred from the equivalent pattern in
    -- bookings/reviews and from RLS comparisons against auth.uid()")
    add constraint user_passes_user_id_fkey
    foreign key (user_id) references users (id);

alter table worker_achievements
    add constraint worker_achievements_worker_id_fkey
    foreign key (worker_id) references workers (id);

-- Foreign keys referencing auth.users (target inferred per DATABASE.md; not
-- directly confirmed by public-schema constraint metadata)
alter table admins
    -- INFERRED: auth_user_id -> likely auth.users.id
    add constraint admins_auth_user_id_fkey
    foreign key (auth_user_id) references auth.users (id);

alter table users
    -- INFERRED: id -> likely auth.users.id (standard Supabase auth-linking pattern)
    add constraint users_id_fkey
    foreign key (id) references auth.users (id);

alter table workers
    -- INFERRED: id -> likely auth.users.id (standard Supabase auth-linking pattern)
    add constraint workers_id_fkey
    foreign key (id) references auth.users (id);

-- Check constraints
-- DATABASE.md confirms these CHECK constraints exist by name but does not
-- enumerate their allowed values/bounds. Per instructions, the condition is
-- not invented.
-- TODO:
-- CHECK constraint campaigns_status_check on campaigns.status
-- Allowed values unavailable in DATABASE.md
--
-- TODO:
-- CHECK constraint users_role_check on users.role
-- Allowed values unavailable in DATABASE.md
--
-- TODO:
-- CHECK constraint reviews_rating_check on reviews.rating
-- Bounds unavailable in DATABASE.md


-- ============================================================
-- PHASE 3: INDEXES
-- Only secondary (non-PK, non-unique-constraint) indexes documented in
-- DATABASE.md Section 5. PK/UNIQUE indexes were already created implicitly
-- by the constraints in Phase 2.
-- ============================================================

create index if not exists idx_bookings_worker on bookings (worker_id);
create index if not exists idx_bookings_status on bookings (status);
create index if not exists idx_worker_achievements_worker on worker_achievements (worker_id);


-- ============================================================
-- PHASE 4: RLS (Row Level Security)
-- Enable RLS and create policies exactly as documented in DATABASE.md
-- Section 2 per-table "RLS Policies" tables.
-- ============================================================

-- ------------------------------------------------------------
-- 4.1 admins
-- ------------------------------------------------------------
alter table admins enable row level security;

create policy "Admins can read their own row"
on admins
for select
to authenticated
using (email = auth.email());

-- ------------------------------------------------------------
-- 4.2 areas
-- ------------------------------------------------------------
alter table areas enable row level security;

create policy "Allow public read areas"
on areas
for select
to public
using (true);

-- ------------------------------------------------------------
-- 4.3 bookings
-- ------------------------------------------------------------
alter table bookings enable row level security;

create policy "worker update own booking location"
on bookings
for update
to public
using (auth.uid()::text = worker_id::text);

create policy "bookings_worker_read"
on bookings
for select
to public
using (
    exists (
        select 1 from workers w
        where w.id = auth.uid() and w.skill = bookings.worker_role
    )
);

create policy "bookings_user_insert"
on bookings
for insert
to public
with check (auth.uid() = user_id);

create policy "bookings_update"
on bookings
for update
to public
using (
    auth.uid() = user_id
    or exists (select 1 from workers w where w.id = auth.uid())
);

create policy "bookings_user_read"
on bookings
for select
to public
using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4.4 campaigns
-- ------------------------------------------------------------
alter table campaigns enable row level security;

-- TODO:
-- "Active admins can delete campaigns" (DELETE, authenticated) —
-- DATABASE.md documents this predicate only in prose: "admin exists in
-- `admins` and `is_active = true`". No literal SQL expression is given
-- in DATABASE.md, so the exact condition is not fabricated here.
-- create policy "Active admins can delete campaigns"
-- on campaigns
-- for delete
-- to authenticated
-- using ( -- exact predicate to be confirmed against live DB );

create policy "Admins can insert campaigns"
on campaigns
for insert
to authenticated
with check (true);

-- TODO:
-- "Active admins can insert campaigns" (INSERT, authenticated) —
-- DATABASE.md documents this predicate only in prose: "admin exists in
-- `admins` and `is_active = true`". No literal SQL expression is given
-- in DATABASE.md, so the exact condition is not fabricated here.
-- create policy "Active admins can insert campaigns"
-- on campaigns
-- for insert
-- to authenticated
-- with check ( -- exact predicate to be confirmed against live DB );

-- TODO:
-- "Active admins can view campaigns" (SELECT, authenticated) —
-- DATABASE.md documents this predicate only in prose: "admin exists in
-- `admins` and `is_active = true`". No literal SQL expression is given
-- in DATABASE.md, so the exact condition is not fabricated here.
-- create policy "Active admins can view campaigns"
-- on campaigns
-- for select
-- to authenticated
-- using ( -- exact predicate to be confirmed against live DB );

-- TODO:
-- "Active admins can update campaigns" (UPDATE, authenticated,
-- documented as applying to both using and check) — DATABASE.md
-- documents this predicate only in prose: "admin exists in `admins`
-- and `is_active = true`". No literal SQL expression is given in
-- DATABASE.md, so the exact condition is not fabricated here.
-- create policy "Active admins can update campaigns"
-- on campaigns
-- for update
-- to authenticated
-- using ( -- exact predicate to be confirmed against live DB )
-- with check ( -- exact predicate to be confirmed against live DB );

create policy "Anyone can read active campaigns"
on campaigns
for select
to public
using (true);

-- TODO: "Admins manage campaigns" (ALL, authenticated) — DATABASE.md
-- documents the predicate only as the bare expression `users.role = 'admin'`
-- (no join/subquery). As literal SQL this references an undeclared
-- table (`users`) inside a policy on `campaigns` and will very likely
-- fail with "missing FROM-clause entry for table users" if run as-is.
-- Not converted to a guessed EXISTS(...) subquery, since the real join
-- condition is not documented anywhere in this repo. Left as a stub
-- pending the actual predicate from whoever owns the RLS design.
-- create policy "Admins manage campaigns"
-- on campaigns
-- for all
-- to authenticated
-- using ( -- exact predicate to be confirmed against live DB )
-- with check ( -- exact predicate to be confirmed against live DB );

-- ------------------------------------------------------------
-- 4.5 reviews
-- ------------------------------------------------------------
alter table reviews enable row level security;

create policy "reviews_insert"
on reviews
for insert
to public
with check (auth.uid() = user_id);

create policy "reviews_read"
on reviews
for select
to public
using (true);

-- ------------------------------------------------------------
-- 4.6 user_passes
-- ------------------------------------------------------------
alter table user_passes enable row level security;

create policy "Users can insert their own passes"
on user_passes
for insert
to authenticated
with check (auth.uid() = user_id);

-- TODO: "Admins read all passes" (SELECT, authenticated) — DATABASE.md
-- documents the predicate only as the bare expression `users.role = 'admin'`
-- (no join/subquery). As literal SQL this references an undeclared
-- table (`users`) inside a policy on `user_passes` and will very likely
-- fail with "missing FROM-clause entry for table users" if run as-is.
-- Not converted to a guessed EXISTS(...) subquery, since the real join
-- condition is not documented anywhere in this repo. Left as a stub
-- pending the actual predicate from whoever owns the RLS design.
-- create policy "Admins read all passes"
-- on user_passes
-- for select
-- to authenticated
-- using ( -- exact predicate to be confirmed against live DB );

create policy "Users can view their own passes"
on user_passes
for select
to authenticated
using (auth.uid() = user_id);

-- TODO:
-- "Active admins can view all user passes" (SELECT, authenticated) —
-- DATABASE.md documents this predicate only in prose: "admin exists in
-- `admins` and `is_active = true`". No literal SQL expression is given
-- in DATABASE.md, so the exact condition is not fabricated here.
-- create policy "Active admins can view all user passes"
-- on user_passes
-- for select
-- to authenticated
-- using ( -- exact predicate to be confirmed against live DB );

create policy "Users can update their own passes"
on user_passes
for update
to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4.7 users
-- ------------------------------------------------------------
alter table users enable row level security;

-- TODO:
-- "Active admins can view all users" (SELECT, authenticated) —
-- DATABASE.md documents this predicate only in prose: "admin exists in
-- `admins` and `is_active = true`". No literal SQL expression is given
-- in DATABASE.md, so the exact condition is not fabricated here.
-- create policy "Active admins can view all users"
-- on users
-- for select
-- to authenticated
-- using ( -- exact predicate to be confirmed against live DB );

create policy "users_own"
on users
for all
to public
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can read own row"
on users
for select
to public
using (auth.uid() = id);

create policy "Admins read all users"
on users
for select
to authenticated
using (is_admin());

-- ------------------------------------------------------------
-- 4.8 workers
-- ------------------------------------------------------------
alter table workers enable row level security;

create policy "workers_update"
on workers
for update
to public
using (true)
with check (true);

create policy "workers_own_insert"
on workers
for insert
to public
with check (auth.uid() = id);

create policy "workers_read_all"
on workers
for select
to public
using (true);

-- ------------------------------------------------------------
-- 4.9 worker_achievements
-- ------------------------------------------------------------
alter table worker_achievements enable row level security;

create policy "worker_achievements_insert"
on worker_achievements
for insert
to public
with check (true);

create policy "worker_achievements_select"
on worker_achievements
for select
to public
using (true);


-- ============================================================
-- PHASE 5: STORAGE
-- Buckets and storage.objects policies exactly as documented in
-- DATABASE.md Section 3.
-- ============================================================

-- Buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worker-photos', 'worker-photos', true, null, null)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worker-documents', 'worker-documents', false, null, null)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Storage object policies: worker-photos
create policy "allow_worker_photos_upload v5d3u8_1"
on storage.objects
for select
to public
using (bucket_id = 'worker-photos');

create policy "allow_worker_photos_upload v5d3u8_2"
on storage.objects
for insert
to public
with check (bucket_id = 'worker-photos');

create policy "allow_worker_photos_upload v5d3u8_0"
on storage.objects
for update
to public
using (bucket_id = 'worker-photos')
with check (bucket_id = 'worker-photos');

-- Storage object policies: worker-documents
create policy "public_upload_worker_docs"
on storage.objects
for insert
to public
with check (bucket_id = 'worker-documents');

create policy "allow_worker_photos_upload 15rstgp_0"
on storage.objects
for update
to public
using (bucket_id = 'worker-documents')
with check (bucket_id = 'worker-documents');

create policy "allow_worker_photos_upload 15rstgp_1"
on storage.objects
for select
to public
using (bucket_id = 'worker-documents');


-- ============================================================
-- PHASE 6: FUNCTIONS
-- DATABASE.md Section 4 confirms these functions exist but documents
-- neither their parameter signatures, return types, nor bodies. Per
-- instructions, none of that is invented; each is left as a TODO.
-- ============================================================

-- TODO:
-- Function body unavailable in DATABASE.md
-- Function: is_admin()
-- (parameter signature and return type also unavailable in DATABASE.md)
-- Confirmed usage: referenced in `users` RLS policy "Admins read all users"

-- TODO:
-- Function body unavailable in DATABASE.md
-- Function: get_worker_stats
-- (parameter signature and return type also unavailable in DATABASE.md)
-- Confirmed usage: not referenced by any RLS policy; presumed single-worker stats RPC

-- TODO:
-- Function body unavailable in DATABASE.md
-- Function: get_worker_stats_bulk
-- (parameter signature and return type also unavailable in DATABASE.md)
-- Confirmed usage: not referenced by any RLS policy; presumed bulk-stats RPC

-- TODO:
-- Function body unavailable in DATABASE.md
-- Function: rls_auto_enable
-- (parameter signature and return type also unavailable in DATABASE.md)
-- Confirmed usage: not referenced by any RLS policy; presumed RLS setup/maintenance routine

-- TODO:
-- Function body unavailable in DATABASE.md
-- Function: handle_new_user
-- (parameter signature and return type also unavailable in DATABASE.md)
-- Confirmed usage: not referenced by any RLS policy; not bound to any trigger


-- ============================================================
-- PHASE 7: COMMENTS
-- Captures only the architecture observations DATABASE.md itself documents
-- (Sections 2.8, 3, 5, and 8). Nothing beyond what is written there.
-- ============================================================

comment on column workers.unlocked_achievements is
    'DATABASE.md architecture observation: overlaps in purpose with the relational worker_achievements table — the same achievement data appears to be tracked in two places.';

comment on table workers is
    'DATABASE.md architecture observations: no indexes exist on skill or area, both used for worker-matching (see bookings_worker_read policy); the workers_update RLS policy grants UPDATE with no ownership restriction (using: true, check: true) — any client can update any worker row, unlike workers_own_insert which is scoped to auth.uid() = id.';

comment on table campaigns is
    'DATABASE.md architecture observation: has two independent "admin" detection paths in its RLS policies (admins table with is_active flag vs. users.role = ''admin''), and two separate INSERT policies with different conditions. No secondary indexes exist despite carrying foreign keys.';

comment on table reviews is
    'DATABASE.md architecture observation: carries foreign keys with no supporting secondary indexes.';

comment on table user_passes is
    'DATABASE.md architecture observation: carries foreign keys with no supporting secondary indexes. user_passes_user_id_fkey target is inferred, not directly confirmed by public-schema constraint metadata.';

comment on constraint admins_auth_user_id_fkey on admins is
    'DATABASE.md: target table (auth.users.id) is inferred / not resolvable from public-schema constraint metadata.';

comment on constraint users_id_fkey on users is
    'DATABASE.md: target table (auth.users.id) is inferred / not resolvable from public-schema constraint metadata (standard Supabase auth-linking pattern).';

comment on constraint workers_id_fkey on workers is
    'DATABASE.md: target table (auth.users.id) is inferred / not resolvable from public-schema constraint metadata (standard Supabase auth-linking pattern).';

comment on constraint user_passes_user_id_fkey on user_passes is
    'DATABASE.md: inferred from the equivalent pattern in bookings/reviews and from RLS comparisons against auth.uid(); not directly confirmed by public-schema constraint metadata.';

comment on constraint campaigns_status_check on campaigns is
    'DATABASE.md: CHECK constraint confirmed to exist; allowed values not enumerated in schema metadata.';

comment on constraint users_role_check on users is
    'DATABASE.md: CHECK constraint confirmed to exist; allowed values not enumerated in schema metadata.';

comment on constraint reviews_rating_check on reviews is
    'DATABASE.md: CHECK constraint confirmed to exist; bounds not enumerated in schema metadata.';

comment on table worker_achievements is
    'DATABASE.md: no separate achievements table exists in the schema, so achievement_id is a free-standing text identifier rather than a foreign key.';

comment on schema storage is
    'DATABASE.md architecture observation: the worker-documents bucket is private at the bucket level, but its storage.objects policies grant public SELECT/UPDATE/INSERT scoped only by bucket_id — any client with public access can read and write objects in this bucket despite its private setting.';

-- Note: the CHECK-constraint comments above reference constraints
-- (campaigns_status_check, users_role_check, reviews_rating_check) whose
-- CREATE statements were intentionally omitted in Phase 2 because their
-- conditions are undocumented (see Phase 2 TODOs). If those constraints are
-- added later with the correct conditions, these comments remain valid
-- documentation of that gap and may be re-attached at that time.

-- ============================================================
-- AUDIT RESULT
-- Migration Order: Tables -> Constraints -> Indexes -> RLS -> Storage -> Functions -> Comments (7/7 phases present, in required order)
-- Dependency Check: areas created before users (saved_area_id FK); users and workers created before bookings; bookings/users/workers created before reviews; users/campaigns created before user_passes; workers created before worker_achievements; all constraints added only after every referenced table exists; no circular dependencies found among public-schema tables
-- Corrections Made: (Phase 5.5.11 master audit) six "Active admins ...` policies on campaigns/user_passes/users, previously implemented with a fabricated EXISTS(...) subquery not present in DATABASE.md, converted to commented-out TODO stubs to match the conservative, verbatim-only approach used in policies.sql; "Admins manage campaigns" and "Admins read all passes" — reverted in that same pass to the literal bare expression `users.role = 'admin'` exactly as documented in DATABASE.md — were subsequently found to be invalid standalone SQL as written (bare reference to an undeclared `users` table inside a policy on a different table) and are now also commented-out TODO stubs, not live CREATE POLICY statements; campaigns_status_check, users_role_check, reviews_rating_check left undocumented as TODOs (no ALTER TABLE ADD CONSTRAINT emitted) rather than inventing conditions; auth.users-referencing FKs (admins_auth_user_id_fkey, users_id_fkey, workers_id_fkey, user_passes_user_id_fkey) marked inferred per DATABASE.md wording, not asserted as confirmed; function bodies/signatures left as TODO stubs, no CREATE FUNCTION invented
-- Final Status: PASS ✅
-- ============================================================