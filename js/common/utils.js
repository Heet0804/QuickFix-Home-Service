/* ════════════════════════════════════════════════════════════
   js/common/utils.js — Phase 5.3.4: Shared Utilities

   Generic, page-agnostic helper functions only. No Supabase, no
   configuration, no map/Geoapify/tracking logic, no booking/wallet
   logic, no admin-specific logic. Loaded BEFORE any page-specific
   script (index.js, dashboard.js, profile.js, auth.js, admin.js),
   same global-script architecture established in Phase 5.3.2/5.3.3
   (no import/export — plain top-level declarations in the shared
   global lexical environment).
   ════════════════════════════════════════════════════════════ */

/* showToast and _tt moved to js/common/toast.js in Phase 5.3.5 —
   loaded before this file. */

/* ── FIELD ERROR MARKING ──────────────────────────────────────
   Identical implementation previously duplicated in auth.js and
   index.js. Generic: takes any element id, flags it as errored,
   and clears the flag on the next input/change. */
function markErr(id){
  const el=document.getElementById(id);
  if(!el)return;
  el.classList.add('err');
  el.addEventListener('input', ()=>el.classList.remove('err'),{once:true});
  el.addEventListener('change',()=>el.classList.remove('err'),{once:true});
}

/* ── GENERIC MODAL CLOSE ───────────────────────────────────────
   Identical implementation previously duplicated in index.js and
   dashboard.js. Generic: takes any overlay/modal element id and
   removes its 'on' class. (Page-specific modal helpers with their
   own hardcoded ids — e.g. profile.js's closeBadgesModal(), or
   admin.js's closeCampaignForm() — are NOT this function and were
   left untouched; see explanation below.) */
function closeModal(id){ document.getElementById(id).classList.remove('on'); }

/* ── IST CLOCK ─────────────────────────────────────────────────
   Identical implementation previously duplicated in index.js and
   dashboard.js. Pure helper: returns the current Date shifted to
   Asia/Kolkata time. No DOM, no business logic. */
function getIST(){ return new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'})); }

/* ── DATE FORMATTING (guarded variant) ───────────────────────────
   Identical guarded behavior previously duplicated in admin.js
   (as _fmtDate) and profile.js (as fmtDate): returns '—' for a
   falsy input, otherwise 'DD Mon YYYY' in en-IN locale.
   NOTE: index.js also has its own top-level fmtDate(d), but that
   one has NO falsy-guard (new Date(d)... with no `d ? ... : '—'`
   check) — a genuinely different behavior on falsy input. It was
   NOT merged into this shared helper to avoid any risk of changing
   index.js's behavior; see explanation below. Kept under its
   original name, _fmtDate, so admin.js's existing call sites
   (which already say _fmtDate(...)) need no changes. */
function _fmtDate(d){ return d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'; }

/* ── HTML ESCAPING ─────────────────────────────────────────────
   Previously only in profile.js (escHtml), but explicitly listed
   in the Phase 5.3.4 spec as a canonical "shared generic utility"
   category. Pure string function, zero dependencies. */
function escHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}