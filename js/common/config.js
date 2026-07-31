/* ===== QuickFix — Shared Application Configuration (Phase 5.3.3) =====
   Plain classic script (no type="module", no import/export), same
   global-variable architecture as js/common/supabase.js. Load order
   relative to supabase.js does not matter — this file only declares
   plain values, it makes no Supabase calls.
   Only values that were genuinely duplicated (identical value + same
   purpose) across two or more files are centralized here. Everything
   else was intentionally left page-specific — see the Phase 5.3.3
   audit notes for the full reasoning on each constant considered. */
window.CONFIG = {
  /* Geoapify API key — reverse geocoding + routing.
     Previously duplicated identically as GEOAPIFY_API_KEY in both
     index.js and dashboard.js. */
  GEOAPIFY_API_KEY: "a89cdf24c2ae454585c82225c630f28c",

  /* Minimum accepted-jobs count before reliability_score / worker_score
     are treated as earned rather than an unqualified default.
     Previously duplicated identically as RELIABILITY_MIN_ACCEPTED_JOBS
     in both dashboard.js and profile.js. */
  RELIABILITY_MIN_ACCEPTED_JOBS: 1,

  /* Leaflet zoom level used when centering a live-tracking map.
     Previously declared twice with the same value (15) and the same
     purpose under two different names: TRACKING_ZOOM in index.js
     (customer tracking the worker) and TRACK_CUSTOMER_ZOOM in
     dashboard.js (worker tracking the customer). */
  TRACKING_ZOOM: 15
};