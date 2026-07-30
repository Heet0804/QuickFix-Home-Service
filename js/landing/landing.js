const SUPABASE_URL='https://oycurbgzzgfzilpflwks.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95Y3VyYmd6emdmemlscGZsd2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjkwMDMsImV4cCI6MjA5MzIwNTAwM30.B9KujxSHzhzpKM_IhVvpTqImVPjF4Yrv3RKn6mgtqxg';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

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
    timer=setTimeout(()=>{count=0;timer=null;},2000);
    if(count===3){
      count=0;
      clearTimeout(timer);
      timer=null;
      window.location.href="admin.html";
    }
  });
})();