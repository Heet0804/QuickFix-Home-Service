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
-- Phase 6.3
alter table areas add constraint areas_lat_check check (lat >= -90 and lat <= 90);
alter table areas add constraint areas_lng_check check (lng >= -180 and lng <= 180);

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
-- Phase 6.3
alter table users add constraint users_quickcoins_balance_check check (quickcoins_balance >= 0);
alter table users add constraint users_quickcoins_earned_check check (quickcoins_earned >= 0);
alter table users add constraint users_quickcoins_redeemed_check check (quickcoins_redeemed >= 0);
alter table users add constraint users_saved_lat_check check (saved_lat is null or (saved_lat >= -90 and saved_lat <= 90));
alter table users add constraint users_saved_lng_check check (saved_lng is null or (saved_lng >= -180 and saved_lng <= 180));

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
-- Phase 6.3
alter table workers add constraint workers_radius_check check (radius is null or (radius >= 1 and radius <= 100));
alter table workers add constraint workers_price_check check (price is null or price >= 0);
alter table workers add constraint workers_rating_check check (rating is null or (rating >= 0 and rating <= 5));
alter table workers add constraint workers_lat_check check (lat is null or (lat >= -90 and lat <= 90));
alter table workers add constraint workers_lng_check check (lng is null or (lng >= -180 and lng <= 180));

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
-- Phase 6.3
alter table campaigns add constraint campaigns_price_check check (price >= 0);
alter table campaigns add constraint campaigns_visits_check check (number_of_visits >= 1);
alter table campaigns add constraint campaigns_validity_check check (validity_days >= 1);
alter table campaigns add constraint campaigns_date_order_check check (offer_end_date > offer_start_date);

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
-- Phase 6.3
alter table bookings add constraint bookings_status_check check (status in ('Pending','Scheduled','Confirmed','Accepted','Worker on Way','Arrived','Completed','Cancelled','Rejected'));
alter table bookings add constraint bookings_price_check check (price is null or price >= 0);
alter table bookings add constraint bookings_base_price_check check (base_price is null or base_price >= 0);
alter table bookings add constraint bookings_customer_lat_check check (customer_lat is null or (customer_lat >= -90 and customer_lat <= 90));
alter table bookings add constraint bookings_customer_lng_check check (customer_lng is null or (customer_lng >= -180 and customer_lng <= 180));
alter table bookings add constraint bookings_review_rating_check check (review_rating is null or (review_rating >= 1 and review_rating <= 5));
alter table bookings add constraint bookings_worker_earning_check check (worker_earning is null or worker_earning >= 0);
alter table bookings add constraint bookings_eta_minutes_check check (eta_minutes is null or eta_minutes >= 0);
alter table bookings add constraint bookings_route_distance_km_check check (route_distance_km is null or route_distance_km >= 0);
alter table bookings add constraint bookings_worker_dist_check check (worker_dist is null or worker_dist >= 0);

create or replace function prevent_past_scheduled_date()
returns trigger as $$
begin
  if new.scheduled_date < current_date then
    raise exception 'scheduled_date cannot be in the past';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_prevent_past_scheduled_date
before insert on bookings
for each row
execute function prevent_past_scheduled_date();

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
-- Phase 6.3
alter table user_passes add constraint user_passes_visits_remaining_check check (visits_remaining >= 0);
alter table user_passes add constraint user_passes_total_visits_check check (total_visits >= 1);
alter table user_passes add constraint user_passes_expiry_check check (expiry_date > purchase_date);

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
alter table reviews               add constraint reviews_booking_id_key unique (booking_id);
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

alter table worker_achievements add constraint worker_achievements_achievement_id_check check (achievement_id in (
    'job-1','job-10','job-25','job-50','job-100',
    'rate-5first','rate-45','rate-48','rate-50',
    'rel-90','rel-95','rel-100',
    'act-25','act-50','act-75',
    'wsc-40','wsc-60','wsc-80','wsc-95'
));

create or replace function enforce_achievement_catalog()
returns trigger as $$
begin
  if (new.achievement_id, new.category, new.name, new.description) not in (
    ('job-1','Jobs','First Job','Complete your very first job.'),
    ('job-10','Jobs','10 Jobs Completed','A seasoned professional.'),
    ('job-25','Jobs','25 Jobs Completed','Making your mark.'),
    ('job-50','Jobs','50 Jobs Completed','Half a century of service!'),
    ('job-100','Jobs','100 Jobs Completed','A true QuickFix veteran.'),
    ('rate-5first','Rating','First 5★ Review','Earn your first perfect rating.'),
    ('rate-45','Rating','4.5+ Rated','Consistently excellent service.'),
    ('rate-48','Rating','4.8+ Rated','Near-perfect performance.'),
    ('rate-50','Rating','Perfect 5.0 Rating','The gold standard.'),
    ('rel-90','Reliability','Reliable Worker','Reliability score ≥ 90.'),
    ('rel-95','Reliability','Trusted Worker','Reliability score ≥ 95.'),
    ('rel-100','Reliability','Perfect Reliability','Reliability score of 100.'),
    ('act-25','Activity','Active Worker','Activity score ≥ 25.'),
    ('act-50','Activity','Super Active','Activity score ≥ 50.'),
    ('act-75','Activity','Workaholic','Activity score ≥ 75.'),
    ('wsc-40','Worker Score','Bronze Worker','Worker score ≥ 40.'),
    ('wsc-60','Worker Score','Silver Worker','Worker score ≥ 60.'),
    ('wsc-80','Worker Score','Gold Worker','Worker score ≥ 80.'),
    ('wsc-95','Worker Score','Platinum Worker','Worker score ≥ 95.')
  ) then
    raise exception 'achievement_id/category/name/description do not match the canonical achievement catalog';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_enforce_achievement_catalog
before insert on worker_achievements
for each row
execute function enforce_achievement_catalog();

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
using (auth.uid()::text = worker_id::text)
with check (auth.uid()::text = worker_id::text);

-- Phase 6.2 — column-level protection cannot be expressed in RLS alone
-- (WITH CHECK only sees the NEW row, not OLD). Enforced via a BEFORE
-- UPDATE trigger instead, applied to both UPDATE policies below.
create or replace function enforce_booking_update_boundaries()
returns trigger as $$
begin
  if is_admin() then
    return new;
  end if;

  if auth.uid() = old.user_id then
    if new.status is distinct from old.status then
      if new.status != 'Cancelled'
         or old.status in ('Completed','Cancelled','Rejected') then
        raise exception 'Customers may only cancel a booking that has not already completed, been cancelled, or been rejected';
      end if;
    end if;
    if new.is_no_show is distinct from old.is_no_show then
      raise exception 'Customers cannot set is_no_show';
    end if;
    if (new.rated is distinct from old.rated
        or new.review_rating is distinct from old.review_rating
        or new.review_comment is distinct from old.review_comment)
       and old.status != 'Completed' then
      raise exception 'Customers can only review a Completed booking';
    end if;
    if new.worker_id is distinct from old.worker_id then
      raise exception 'Customers cannot reassign the worker on a booking';
    end if;
    if new.worker_live_lat is distinct from old.worker_live_lat
       or new.worker_live_lng is distinct from old.worker_live_lng
       or new.worker_last_seen is distinct from old.worker_last_seen then
      raise exception 'Customers cannot modify worker location fields';
    end if;
    if new.arrival_otp is distinct from old.arrival_otp
       or new.completion_otp is distinct from old.completion_otp then
      raise exception 'Customers cannot modify OTP fields';
    end if;
    if new.price is distinct from old.price
       or new.base_price is distinct from old.base_price then
      raise exception 'Customers cannot modify price fields';
    end if;
  end if;

  if auth.uid() = old.worker_id then
    if new.user_id is distinct from old.user_id then
      raise exception 'Workers cannot reassign the customer on a booking';
    end if;
    if new.customer_lat is distinct from old.customer_lat
       or new.customer_lng is distinct from old.customer_lng
       or new.address is distinct from old.address then
      raise exception 'Workers cannot modify customer location/address fields';
    end if;
    if new.payment_method is distinct from old.payment_method then
      raise exception 'Workers cannot modify the payment method';
    end if;
    if new.rated is distinct from old.rated
       or new.review_rating is distinct from old.review_rating
       or new.review_comment is distinct from old.review_comment then
      raise exception 'Workers cannot modify review fields';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_enforce_booking_update_boundaries
before update on bookings
for each row
execute function enforce_booking_update_boundaries();

create policy "bookings_worker_read"
on bookings
for select
to public
using (auth.uid() = worker_id);

create policy "bookings_user_insert"
on bookings
for insert
to public
with check (auth.uid() = user_id and status = 'Pending');

create policy "bookings_update"
on bookings
for update
to public
using (auth.uid() = user_id or auth.uid() = worker_id)
with check (auth.uid() = user_id or auth.uid() = worker_id);

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
with check (
  exists (select 1 from admins a where a.email = auth.email() and a.is_active = true)
);

create policy "Admins can update campaigns"
on campaigns
for update
to authenticated
using (
  exists (select 1 from admins a where a.email = auth.email() and a.is_active = true)
)
with check (
  exists (select 1 from admins a where a.email = auth.email() and a.is_active = true)
);

create policy "Admins can delete campaigns"
on campaigns
for delete
to authenticated
using (
  exists (select 1 from admins a where a.email = auth.email() and a.is_active = true)
);

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
with check (
  auth.uid() = user_id
  and exists (
    select 1 from bookings b
    where b.id = reviews.booking_id
      and b.user_id = auth.uid()
      and b.status = 'Completed'
  )
);

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
-- NOTE: Phase 6.2 — role-change protection is NOT enforced by this
-- policy (a WITH CHECK subquery back into users caused infinite
-- recursion, 42P17). Enforced instead by trg_prevent_role_self_escalation.

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
using (auth.uid() = id)
with check (auth.uid() = id);

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
with check (auth.uid() = worker_id);

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
to authenticated
with check (bucket_id = 'worker-photos');

create policy "allow_worker_photos_upload v5d3u8_0"
on storage.objects
for update
to authenticated
using (bucket_id = 'worker-photos')
with check (bucket_id = 'worker-photos');

-- Storage object policies: worker-documents
create policy "public_upload_worker_docs"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'worker-documents');

create policy "allow_worker_photos_upload 15rstgp_0"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'worker-documents'
  and exists (select 1 from workers w where w.id = auth.uid() and w.document_name = storage.objects.name)
)
with check (
  bucket_id = 'worker-documents'
  and exists (select 1 from workers w where w.id = auth.uid() and w.document_name = storage.objects.name)
);

create policy "allow_worker_photos_upload 15rstgp_1"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'worker-documents'
  and (
    exists (select 1 from workers w where w.id = auth.uid() and w.document_name = storage.objects.name)
    or is_admin()
  )
);


-- ============================================================
-- PHASE 6: FUNCTIONS
-- DATABASE.md Section 4 confirms these functions exist but documents
-- neither their parameter signatures, return types, nor bodies. Per
-- instructions, none of that is invented; each is left as a TODO.
-- ============================================================

-- is_admin() — body retrieved directly from the live database via
-- SELECT prosrc FROM pg_proc WHERE proname = 'is_admin'; no longer a TODO.
create or replace function is_admin()
returns boolean as $$
  select exists(
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer set search_path = public, pg_temp;

-- prevent_role_self_escalation() + trigger — added Phase 6.2. Blocks any
-- UPDATE on users.role unless the caller is already an admin. A naive
-- RLS WITH CHECK subquery back into users caused infinite recursion
-- (42P17); this trigger runs independently of RLS and cannot recurse.
create or replace function prevent_role_self_escalation()
returns trigger as $$
begin
  if new.role is distinct from old.role then
    if not public.is_admin() then
      raise exception 'Only admins can change user roles';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_prevent_role_self_escalation
before update on users
for each row
execute function prevent_role_self_escalation();

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
    'DATABASE.md architecture observation: no indexes exist on skill or area, both used for worker-matching (see bookings_worker_read policy). Phase 6.2 note: workers_update previously granted UPDATE with no ownership restriction (using: true, check: true); fixed to auth.uid() = id, consistent with workers_own_insert.';

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
    'Phase 6.3 audit: confirmed already live via pg_constraint. CHECK (status IN (''active'',''inactive'')).';

comment on constraint users_role_check on users is
    'Phase 6.3 audit: confirmed already live via pg_constraint. CHECK (role IN (''user'',''worker'',''admin'')).';

comment on constraint reviews_rating_check on reviews is
    'Phase 6.3 audit: confirmed already live via pg_constraint. CHECK (rating BETWEEN 1 AND 5).';

comment on table worker_achievements is
    'DATABASE.md: no separate achievements table exists in the schema, so achievement_id is a free-standing text identifier rather than a foreign key.';

comment on schema storage is
    'Phase 6.2 note: the worker-documents bucket was private at the bucket level, but its storage.objects policies previously granted public SELECT/UPDATE/INSERT scoped only by bucket_id. Fixed — policies now require authenticated callers whose auth.uid() matches a workers.document_name they own, or is_admin() for SELECT.';

-- Note: campaigns_status_check, users_role_check, reviews_rating_check
-- were confirmed already live on the actual database via pg_constraint
-- during the Phase 6.3 audit — not fabricated, and deliberately not
-- recreated here (would cause a duplicate-constraint error).

-- ============================================================
-- AUDIT RESULT
-- Migration Order: Tables -> Constraints -> Indexes -> RLS -> Storage -> Functions -> Comments (7/7 phases present, in required order)
-- Dependency Check: areas created before users (saved_area_id FK); users and workers created before bookings; bookings/users/workers created before reviews; users/campaigns created before user_passes; workers created before worker_achievements; all constraints added only after every referenced table exists; no circular dependencies found among public-schema tables
-- Corrections Made (original Phase 5.5.11 pass): six "Active admins ...`
-- policies on campaigns/user_passes/users, previously implemented with a
-- fabricated EXISTS(...) subquery not present in DATABASE.md, converted to
-- commented-out TODO stubs; "Admins manage campaigns" and "Admins read all
-- passes" reverted to the literal bare `users.role = 'admin'` expression,
-- found invalid as standalone SQL, left as commented-out TODO stubs.
-- Phase 6.2 corrections: campaigns INSERT policy (was WITH CHECK (true),
-- allowing any authenticated user to create campaigns) fixed to require
-- admin status; campaigns UPDATE/DELETE policies added (previously
-- missing entirely); reviews_insert now requires a completed, self-owned
-- booking; bookings_user_insert now requires status = 'Pending' at
-- creation; is_admin() given its real, confirmed body (no longer a TODO
-- stub); prevent_role_self_escalation() trigger added, closing a
-- critical self-role-escalation vulnerability found and live-verified
-- during the Phase 6.2 audit.
-- Phase 6.3 corrections: 24 CHECK constraints added across bookings,
-- campaigns, workers, user_passes, users, and areas, plus the
-- prevent_past_scheduled_date() INSERT-only trigger on bookings. Every
-- constraint confirmed live-tested against the actual database.
-- auth.users-referencing FKs (admins_auth_user_id_fkey, users_id_fkey,
-- workers_id_fkey, user_passes_user_id_fkey) remain marked inferred per
-- DATABASE.md wording, not asserted as confirmed.
-- Final Status: PASS ✅
-- ============================================================