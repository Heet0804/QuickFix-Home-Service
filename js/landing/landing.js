/* ===== QuickFix Landing Script — extracted from landing.html (Phase 5.2) ===== */

/* sb now comes from js/common/supabase.js, loaded before this file. */

/* If already logged in, show dashboard link */
(async()=>{
  const {data:{session}}=await sb.auth.getSession();
  if(session){
    const u=JSON.parse(sessionStorage.getItem('qf_user')||'null');
    const role=u?.role||sessionStorage.getItem('qf_role');
    const dash=document.getElementById('navDash');
    if(dash){
      dash.classList.add('show');
      dash.style.display='inline-flex';
      dash.href=role==='worker'?'worker-dashboard.html':'index.html';
      dash.textContent=role==='worker'?'Worker Dashboard →':'My Dashboard →';
    }
  }
})();

const params=new URLSearchParams(location.search);
if(params.get('role'))sessionStorage.setItem('qf_role',params.get('role'));

const obs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('on')});},{threshold:.15});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));

(function(){
  const toggle=document.getElementById('navToggle');
  const panel=document.getElementById('navRight');
  const overlay=document.getElementById('navOverlay');
  if(toggle&&panel&&overlay){
    const closeMenu=()=>{panel.classList.remove('open');overlay.classList.remove('open');toggle.classList.remove('active');toggle.setAttribute('aria-expanded','false');};
    const openMenu=()=>{panel.classList.add('open');overlay.classList.add('open');toggle.classList.add('active');toggle.setAttribute('aria-expanded','true');};
    toggle.addEventListener('click',()=>{panel.classList.contains('open')?closeMenu():openMenu();});
    overlay.addEventListener('click',closeMenu);
    panel.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
    window.addEventListener('resize',()=>{if(window.innerWidth>900)closeMenu();});
  }
})();

(function(){
  const logo=document.querySelector('.logo');
  if(!logo)return;
  let count=0,timer=null;
  logo.addEventListener('click',function(e){
    if(!e.shiftKey){count=0;if(timer){clearTimeout(timer);timer=null;}return;}
    e.preventDefault();
    count++;
    if(timer)clearTimeout(timer);
    /* Phase 5.6.1: was a hardcoded 2000 — now CONSTANTS.LOGO_EASTER_EGG_WINDOW_MS */
    timer=setTimeout(()=>{count=0;timer=null;},CONSTANTS.LOGO_EASTER_EGG_WINDOW_MS);
    if(count===3){
      count=0;
      clearTimeout(timer);
      timer=null;
      window.location.href="admin.html";
    }
  });
})();