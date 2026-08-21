window.CONSTANTS = {
  AUTH_REDIRECT_DELAY_MS: 800,
  WORKER_PROFILE_LOAD_FAIL_REDIRECT_MS: 1500,
  MAX_UPLOAD_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  MIN_PASSWORD_LENGTH: 6,
  STORAGE_UPLOAD_CACHE_CONTROL: '3600',
  CLOCK_TICK_INTERVAL_MS: 1000,
  MAP_INVALIDATE_DELAY_MS: 50,
  TRACKING_MAP_BUILD_DELAY_MS: 420,
  PULSE_LAYER_REMOVE_DELAY_MS: 2600,
  ARRIVAL_TIMEOUT_SECONDS: 900,
  WORKER_ACCEPT_TIMEOUT_SECONDS: 120,
  QR_PAYMENT_EXPIRY_SECONDS: 300,
  ARRIVAL_EXTENDED_TIMEOUT_SECONDS: 300,
  ADVANCE_BOOKING_REVEAL_WINDOW_MS: 600000,

  /* Phase 5.9 hotfix: platform-wide hard cap (km) on worker-to-customer
     assignment distance. index.js's getEligibleWorkersForArea() has always
     referenced CONSTANTS.MAX_ASSIGN_KM, but no value was ever added here —
     it evaluated to undefined, so `km <= undefined` was always false and
     EVERY worker failed eligibility regardless of their own radius. This
     is a separate, additional cap on top of each worker's own `radius`
     column (which defaults to 10 in schema.sql) — set equal to it here so
     the platform-wide cap doesn't unexpectedly override a worker's own
     radius setting. */
  MAX_ASSIGN_KM: 10,

  /* ── Phase 5.6.1: previously-hardcoded literals, consolidated
     from admin.js, index.js, landing.js, toast.js, and dashboard.js.
     Values are unchanged from their original inline numbers — this
     is a naming/consolidation pass only, not a behavior change. */
  ADMIN_ACCESS_DENIED_RETRY_MS: 10000,
  CAMPAIGN_POPUP_DELAY_MS: 500,
  CAMPAIGN_MODAL_CLOSE_ANIM_MS: 200,
  COUNTDOWN_TICK_MS: 1000,
  DEMO_PAYMENT_PROVIDER_DELAY_MS: 10000,
  PASS_ACTIVATION_DELAY_MS: 1000,
  PASS_PAYMENT_MODAL_CLOSE_DELAY_MS: 1200,
  PASS_PAYMENT_COUNTDOWN_SECONDS: 120,
  CUSTOMER_BOOKING_POLL_INTERVAL_MS: 2000,
  /* Phase 6.5: was 5000. Worker dashboard already has a realtime
     channel as its primary sync mechanism — this poll is only a
     fallback for missed postgres_changes events (TRUNCATE, bulk
     resets, dropped connections). A fallback firing every 5s ran an
     unconditional SELECT * on bookings that often, regardless of
     whether realtime was working. 30s keeps the safety net without
     hammering the DB continuously. */
  WORKER_BOOKING_POLL_INTERVAL_MS: 30000,
  /* Phase 6.5: was 4000. admin.js has no realtime channel at all —
     this interval is the ONLY sync mechanism and ran 2 full SELECT *
     queries every 4 seconds indefinitely, for the entire time
     admin.html stayed open, regardless of which tab was active. 15s
     is a reasonable refresh rate for an admin dashboard that isn't
     time-critical the way live job tracking is. */
  ADMIN_DASHBOARD_POLL_INTERVAL_MS: 15000,
  GPAY_CONFIRM_REDIRECT_DELAY_MS: 1400,
  LOGO_EASTER_EGG_WINDOW_MS: 2000,
  TOAST_DURATION_MS: 3500,
  MS_PER_DAY: 86400000,
  MS_PER_HOUR: 3600000,
  MS_PER_MINUTE: 60000,
  MS_PER_SECOND: 1000,

  BOOKING_STATUS: {
    PENDING:       'Pending',
    SCHEDULED:     'Scheduled',
    CONFIRMED:     'Confirmed',
    ACCEPTED:      'Accepted',
    WORKER_ON_WAY: 'Worker on Way',
    ARRIVED:       'Arrived',
    COMPLETED:     'Completed',
    CANCELLED:     'Cancelled',
    REJECTED:      'Rejected'
  }
};