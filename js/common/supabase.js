    /* ===== QuickFix — Shared Supabase Client (Phase 5.3.2) =====
   Single source of truth for SUPABASE_URL, SUPABASE_KEY, and the
   Supabase client instance. This is a plain classic script (no
   type="module", no import/export) — it must be loaded via a
   <script> tag BEFORE each page's own JS file. It exposes the
   client as window.sb, which every existing page script can keep
   referring to as the bare identifier `sb`, unchanged.
   Canonical config (standardized across all pages in Phase 5.3.2):
   persistSession:true, autoRefreshToken:true, detectSessionInUrl:false. */
const SUPABASE_URL='https://oycurbgzzgfzilpflwks.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95Y3VyYmd6emdmemlscGZsd2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjkwMDMsImV4cCI6MjA5MzIwNTAwM30.B9KujxSHzhzpKM_IhVvpTqImVPjF4Yrv3RKn6mgtqxg';
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});