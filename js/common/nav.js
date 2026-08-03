/* ===== QuickFix — Shared Mobile Nav Toggle (Phase 5.3.7.1) =====
   Plain classic script (no type="module", no import/export), same
   global-variable architecture as every other js/common/*.js file.

   Moved from js/worker/dashboard.js and js/worker/profile.js, where
   toggleMenu() and its nav-close listener were byte-identical (both
   operate on #navRight / #navOverlay). Must be loaded via a <script>
   tag before js/worker/dashboard.js and js/worker/profile.js.

   Not used by index.html — js/customer/index.js has its own
   toggleMenu() operating on #navLinks, a different implementation,
   left untouched — nor by admin.html, auth.html, or landing.html,
   none of which define this function. */
function toggleMenu(){
  document.getElementById('navRight').classList.toggle('open');
  document.getElementById('navOverlay').classList.toggle('on');
}
document.querySelectorAll('#navRight a, #navRight button').forEach(function(el){
  el.addEventListener('click', function(){
    document.getElementById('navRight').classList.remove('open');
    document.getElementById('navOverlay').classList.remove('on');
  });
});