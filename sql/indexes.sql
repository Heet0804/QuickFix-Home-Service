-- =====================================================
-- QuickFix Database — Secondary Indexes
-- Generated from DATABASE.md (source of truth)
-- Target: PostgreSQL / Supabase
-- NOTE: PRIMARY KEY and UNIQUE constraint indexes are NOT
-- recreated here — they are created automatically by
-- schema.sql via the PK/UNIQUE constraints themselves.
-- =====================================================

-- =====================================================
-- BOOKINGS
-- =====================================================

CREATE INDEX idx_bookings_worker
    ON bookings (worker_id);

CREATE INDEX idx_bookings_status
    ON bookings (status);

-- =====================================================
-- WORKER_ACHIEVEMENTS
-- =====================================================

CREATE INDEX idx_worker_achievements_worker
    ON worker_achievements (worker_id);

-- =====================================================
-- WORKERS (Phase 8)
-- banned_until is read on every worker login attempt (auth.js) and
-- filtered on by the worker-selfrow realtime channel (dashboard.js);
-- previously had no supporting index.
-- =====================================================

CREATE INDEX idx_workers_banned_until
    ON workers (banned_until);

-- =====================================================
-- WORKER_BANS (Phase 8)
-- =====================================================

CREATE INDEX idx_worker_bans_worker
    ON worker_bans (worker_id);

-- =====================================================
-- WORKER_BONUSES (Phase 8)
-- =====================================================

CREATE INDEX idx_worker_bonuses_worker
    ON worker_bonuses (worker_id);

-- =====================================================
-- NO SECONDARY INDEXES DOCUMENTED
-- (only PK / UNIQUE indexes exist — not recreated here)
-- =====================================================
-- admins
-- areas
-- campaigns
-- reviews
-- user_passes
-- users