/* ════════════════════════════════════════════════════════════
   js/common/toast.js — Phase 5.3.5: Shared Toast System

   ONLY toast-related code lives here. showToast() + its backing
   _tt timer handle previously lived in js/common/utils.js (moved
   there in Phase 5.3.4); they've now been relocated to this
   dedicated module, per this phase's objective. No other utility
   (markErr, closeModal, getIST, _fmtDate, escHtml) moves — those
   stay in common/utils.js untouched.

   Same non-module, shared-global-scope architecture as every other
   common/*.js file: no import/export. Must be loaded via a plain
   <script> tag before any page-specific script that calls
   showToast() — i.e. before auth.js, index.js, dashboard.js, and
   profile.js. Not required by admin.js or landing.js (neither uses
   a toast — see audit above). */
let _tt;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.add('on');
  clearTimeout(_tt);
  _tt=setTimeout(()=>t.classList.remove('on'),3500);
}