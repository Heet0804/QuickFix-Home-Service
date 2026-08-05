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
-- NO SECONDARY INDEXES DOCUMENTED
-- (only PK / UNIQUE indexes exist — not recreated here)
-- =====================================================
-- admins
-- areas
-- campaigns
-- reviews
-- user_passes
-- users
-- workers