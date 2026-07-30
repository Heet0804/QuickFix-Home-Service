/* ===== QuickFix Worker Dashboard Script — extracted from worker-dashboard.html (Phase 5.2) ===== */

/* Responsive-only addition: mobile nav drawer, mirrors index.html's
   toggleMenu() exactly. Does not touch any business logic below. */
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

/* ════════════════════════════════════════════════════════════
   SUPABASE CLIENT
   persistSession:true / autoRefreshToken:true — MUST match
   auth.html and index.html exactly. Both use the same URL/KEY,
   so the SDK's default storage key is identical on all pages.
   auth.html writes the session to localStorage on login; this
   page reads it back, so sb.auth.getSession() returns a valid
   session and auth.uid() is non-null. Without this, RLS policies
   (workers_own_update etc.) see auth.uid()=null and silently
   return data:[] on every write — availability toggles, booking
   status updates, and worker stat increments all appear to
   succeed but write nothing to the database.
   ════════════════════════════════════════════════════════════ */
const SUPABASE_URL='https://oycurbgzzgfzilpflwks.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95Y3VyYmd6emdmemlscGZsd2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjkwMDMsImV4cCI6MjA5MzIwNTAwM30.B9KujxSHzhzpKM_IhVvpTqImVPjF4Yrv3RKn6mgtqxg';
/* Phase 4.7: same constant name/value as index.html — one reusable
   Geoapify key for reverse geocoding + routing on this dashboard. */
const GEOAPIFY_API_KEY = "a89cdf24c2ae454585c82225c630f28c";
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
});

let W=null;            /* current worker record (merged users + workers row) */
let bookings=[];        /* raw bookings rows for this worker, snake_case as-is from Supabase */
let curTab='pending';
let pendAcceptId=null;
let pendRejectId=null;
let pendOtpId=null;
let pendCancelAcceptedId=null;

/* ════════════════════════════════════════════════════════════
   CANONICAL STATS — the ONLY stats source on this page. Same RPC
   index.html and worker-profile.html call. Nothing below computes
   completion/reliability/activity/worker score locally.
   ════════════════════════════════════════════════════════════ */
let Stats=null;
const RELIABILITY_MIN_ACCEPTED_JOBS=1; /* below this, reliability_score/worker_score reflect an unqualified default, not earned performance — display 0, not the raw RPC value */
async function loadStats(){
  const {data,error}=await sb.rpc('get_worker_stats',{p_worker_id:W.id});
  if(error){ console.error('get_worker_stats:',error.message); return; }
  const s=Array.isArray(data)?data[0]:data;
  if(!s) return;
  Stats={...s, has5Star: bookings.some(b=>b.status==='Completed'&&Number(b.review_rating)===5)};
}

/* ════════════════════════════════════════════════════════════
   ACHIEVEMENT ENGINE — the ONLY place achievements are decided.
   Every achievement requires completed_jobs >= gate AND its own
   condition. A brand-new worker (completed_jobs=0) satisfies none
   of these — including the reliability ones, even though reliability
   starts at 100 with zero jobs, because the gate blocks it.
   ════════════════════════════════════════════════════════════ */
const ACHIEVEMENTS = [
  {id:'job-1',    category:'Jobs',         icon:'🥇', name:'First Job',           desc:'Complete your very first job.',    gate:1,   test:s=>s.completed_jobs>=1,     progress:s=>[s.completed_jobs,1]},
  {id:'job-10',   category:'Jobs',         icon:'🏅', name:'10 Jobs Completed',   desc:'A seasoned professional.',         gate:10,  test:s=>s.completed_jobs>=10,    progress:s=>[s.completed_jobs,10]},
  {id:'job-25',   category:'Jobs',         icon:'🥈', name:'25 Jobs Completed',   desc:'Making your mark.',                gate:25,  test:s=>s.completed_jobs>=25,    progress:s=>[s.completed_jobs,25]},
  {id:'job-50',   category:'Jobs',         icon:'🥇', name:'50 Jobs Completed',   desc:'Half a century of service!',       gate:50,  test:s=>s.completed_jobs>=50,    progress:s=>[s.completed_jobs,50]},
  {id:'job-100',  category:'Jobs',         icon:'🏆', name:'100 Jobs Completed',  desc:'A true QuickFix veteran.',         gate:100, test:s=>s.completed_jobs>=100,   progress:s=>[s.completed_jobs,100]},

  {id:'rate-5first',category:'Rating',     icon:'⭐', name:'First 5★ Review',     desc:'Earn your first perfect rating.',  gate:1,   test:s=>s.has5Star,              progress:s=>[s.has5Star?1:0,1]},
  {id:'rate-45',  category:'Rating',       icon:'🌟', name:'4.5+ Rated',          desc:'Consistently excellent service.',  gate:5,   test:s=>s.rating>=4.5,           progress:s=>[s.rating,4.5]},
  {id:'rate-48',  category:'Rating',       icon:'💫', name:'4.8+ Rated',          desc:'Near-perfect performance.',        gate:5,   test:s=>s.rating>=4.8,           progress:s=>[s.rating,4.8]},
  {id:'rate-50',  category:'Rating',       icon:'✨', name:'Perfect 5.0 Rating',  desc:'The gold standard.',               gate:5,   test:s=>s.rating>=5.0,           progress:s=>[s.rating,5.0]},

  {id:'rel-90',   category:'Reliability',  icon:'🛡', name:'Reliable Worker',     desc:'Reliability score ≥ 90.',          gate:5,   test:s=>s.reliability_score>=90, progress:s=>[s.reliability_score,90]},
  {id:'rel-95',   category:'Reliability',  icon:'🔰', name:'Trusted Worker',      desc:'Reliability score ≥ 95.',          gate:5,   test:s=>s.reliability_score>=95, progress:s=>[s.reliability_score,95]},
  {id:'rel-100',  category:'Reliability',  icon:'💎', name:'Perfect Reliability', desc:'Reliability score of 100.',        gate:5,   test:s=>s.reliability_score>=100,progress:s=>[s.reliability_score,100]},

  {id:'act-25',   category:'Activity',     icon:'⚡', name:'Active Worker',       desc:'Activity score ≥ 25.',             gate:5,   test:s=>s.activity_score>=25,    progress:s=>[s.activity_score,25]},
  {id:'act-50',   category:'Activity',     icon:'🔥', name:'Super Active',        desc:'Activity score ≥ 50.',             gate:5,   test:s=>s.activity_score>=50,    progress:s=>[s.activity_score,50]},
  {id:'act-75',   category:'Activity',     icon:'💪', name:'Workaholic',          desc:'Activity score ≥ 75.',             gate:5,   test:s=>s.activity_score>=75,    progress:s=>[s.activity_score,75]},

  {id:'wsc-40',   category:'Worker Score', icon:'🥉', name:'Bronze Worker',       desc:'Worker score ≥ 40.',               gate:5,   test:s=>s.worker_score>=40,      progress:s=>[s.worker_score,40]},
  {id:'wsc-60',   category:'Worker Score', icon:'🥈', name:'Silver Worker',       desc:'Worker score ≥ 60.',               gate:5,   test:s=>s.worker_score>=60,      progress:s=>[s.worker_score,60]},
  {id:'wsc-80',   category:'Worker Score', icon:'🥇', name:'Gold Worker',         desc:'Worker score ≥ 80.',               gate:15,  test:s=>s.worker_score>=80,      progress:s=>[s.worker_score,80]},
  {id:'wsc-95',   category:'Worker Score', icon:'💎', name:'Platinum Worker',     desc:'Worker score ≥ 95.',               gate:30,  test:s=>s.worker_score>=95,      progress:s=>[s.worker_score,95]},
];
function achievementUnlocked(a,stats){ return stats.completed_jobs>=a.gate && a.test(stats); }

let UnlockedAchievements=[]; /* rows from worker_achievements — the persisted source of truth for "unlocked" */

const ACHIEVEMENT_POPUP_DELAY_MS=3000; /* worker sees the OTP-verified confirmation first, then the unlock popup a few seconds later — not both at once */

async function checkAndUnlockAchievements(){
  if(!Stats||!W?.id) return;
  const {data:rows,error}=await sb.from('worker_achievements').select('*').eq('worker_id',W.id);
  if(error){ console.error('worker_achievements fetch:',error.message); return; }
  UnlockedAchievements=rows||[];
  const unlockedIds=new Set(UnlockedAchievements.map(r=>r.achievement_id));

  const newlyUnlocked=[];
  for(const a of ACHIEVEMENTS){
    if(unlockedIds.has(a.id)) continue;
    if(!achievementUnlocked(a,Stats)) continue;
    const {data:inserted,error:ie}=await sb.from('worker_achievements')
      .insert({worker_id:W.id, achievement_id:a.id, category:a.category, name:a.name, description:a.desc})
      .select().single();
    if(ie){
      if(ie.code!=='23505') console.error('worker_achievements insert:',ie.message);
      continue; /* 23505 = unique violation, e.g. two realtime events racing — safe to skip */
    }
    UnlockedAchievements.push(inserted);
    newlyUnlocked.push(inserted);
  }
  newlyUnlocked.forEach(a=>setTimeout(()=>showAchievementUnlockPopup(a), ACHIEVEMENT_POPUP_DELAY_MS));
}

function showAchievementUnlockPopup(row){
  const def=ACHIEVEMENTS.find(a=>a.id===row.achievement_id);
  document.getElementById('unlockIco').textContent=def?.icon||'🏆';
  document.getElementById('unlockTitle').textContent=row.name;
  document.getElementById('unlockDesc').textContent=row.description;
  document.getElementById('unlockDate').textContent='Unlocked '+new Date(row.unlocked_at).toLocaleString();
  document.getElementById('achievementUnlockModal').classList.add('on');
}

/* ════════════════════════════════════════════════════════════
   BOOT — dual-signal authentication
   1. sessionStorage.qf_user / qf_role: fast identity check and
      worker-profile cache written by auth.html at login. Ensures
      only role==='worker' sessions can reach this page.
   2. Supabase session (restored from localStorage via
      persistSession:true above): provides a non-null auth.uid()
      so RLS policies (workers_own_update etc.) allow writes.
   Both signals must agree. If either is missing, redirect.
   ════════════════════════════════════════════════════════════ */
(async()=>{
  const raw=sessionStorage.getItem('qf_user');
  const role=sessionStorage.getItem('qf_role');
  if(!raw||role!=='worker'){
    window.location.href='auth.html?role=worker';
    return;
  }
  let cached;
  try{ cached=JSON.parse(raw); }catch(e){ window.location.href='auth.html?role=worker'; return; }
  if(!cached||!cached.id){ window.location.href='auth.html?role=worker'; return; }

  /* Always refetch the live workers row from Supabase — sessionStorage
     can be stale (e.g. another tab/device updated availability/stats). */
  const {data:wp,error:we}=await sb.from('workers').select('*').eq('id',cached.id).single();
  if(we||!wp){
    console.error('Failed to load worker record:',we?.message);
    showToast('⚠️ Could not load your worker profile. Please sign in again.');
    setTimeout(()=>{ window.location.href='auth.html?role=worker'; },1500);
    return;
  }
  W={...cached,...wp};
  sessionStorage.setItem('qf_user',JSON.stringify(W));

  renderProfile();
  await loadBookings();

switchTab(
  'pending',
  document.querySelector('.tab[data-tab="pending"]')
);

tickClock();
setInterval(tickClock,1000);

/* ---------- REALTIME BOOKING SYNC ---------- */

sb.channel('worker-bookings-' + W.id)

.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'bookings',
    filter: `worker_id=eq.${W.id}`
  },
  async () => {

    console.log('Realtime booking update');

    await loadBookings();

  }
)

.subscribe((status, err) => { console.log('channel status:', status, err); });

/* ---------- FALLBACK SYNC (same strategy as index.html) ----------
   postgres_changes only fires on row-level INSERT/UPDATE/DELETE.
   It does NOT fire on TRUNCATE or certain bulk/dashboard resets, so
   during dev testing the realtime event can simply never arrive.
   index.html never has this problem because it re-fetches on a
   timer regardless of whether an event fired. Mirroring that here
   as a safety net — does not replace or alter the realtime channel
   above, which still remains the primary way updates travel. */
clearInterval(window._workerBookingPoll);
window._workerBookingPoll = setInterval(async () => {
  await loadBookings();
}, 5000);

window.addEventListener('focus', () => {
  loadBookings();
});

})();

/* ════════════════════════════════════════════════════════════
   PROFILE + STATS RENDER
   All fields come straight from the workers table row (W).
   ════════════════════════════════════════════════════════════ */
function renderProfile(){
  document.getElementById('navName').textContent=W.name||'—';
  document.getElementById('pcName').textContent=W.name||'—';
  document.getElementById('pcSkill').textContent=W.skill||'—';
  document.getElementById('pcPhone').textContent =
  W.phone ? `📞 ${W.phone}` : '📞 N/A';
  document.getElementById('pcRadius').textContent=(W.radius!=null?`📍 ${W.radius} km radius`:'');
  document.getElementById('pcArea').textContent=W.area?`🏙️ ${W.area}`:'';

  const ratedBookings = bookings.filter(
    b =>
        b.status === "Completed" &&
        Number(b.review_rating || 0) > 0
);

const dashboardRating = Stats?.rating != null ? Number(Stats.rating).toFixed(1) : "0.0";

const dashboardTotalJobs =
    bookings.filter(b =>
        ["Accepted","Arrived","Completed","Cancelled"]
        .includes(b.status)
    ).length;

document.getElementById("statRating").textContent =
    dashboardRating;

document.getElementById("statTotalJobs").textContent =
    dashboardTotalJobs;

  document.getElementById('statEarnings').textContent='₹'+Number(Stats?.total_earnings??0).toLocaleString('en-IN');

  /* === STATS — ALL come from Stats (get_worker_stats RPC result).
     Same function index.html and worker-profile.html call. Nothing is
     computed on this page anymore. === */
  const acceptedJobs  = Stats?.accepted_jobs  ?? 0;
  const completedJobs = Stats?.completed_jobs ?? 0;
  const cancelledJobs = Stats?.cancelled_jobs ?? 0;
  const noShows       = Stats?.no_show_count  ?? 0;
  const rel  = Stats?.reliability_score ?? null;
  const comp = Stats?.completion_rate != null ? Math.round(Stats.completion_rate * 100) : 0;
  const act  = Stats?.activity_score ?? 0;
  const wsc  = Stats?.worker_score ?? 0;

  document.getElementById('pAccepted').textContent = acceptedJobs;
  document.getElementById('pCompleted').textContent = completedJobs;
  document.getElementById('pCancelled').textContent = cancelledJobs;
  document.getElementById('pNoShow').textContent = noShows;

  renderCancellationWarning(cancelledJobs);

  const qualified = acceptedJobs >= RELIABILITY_MIN_ACCEPTED_JOBS;
  const relShown = rel == null ? null : (qualified ? rel : 0);
  const wscShown = qualified ? wsc : 0;

  document.getElementById('pReliability').textContent = relShown == null ? '—' : Number(relShown).toFixed(0);
  document.getElementById('pCompletion').textContent  = comp + '%';
  document.getElementById('pActivity').textContent    = act;
  document.getElementById('pWorkerScore').textContent = wscShown;

  tagScoreCard('pReliabilityCard',relShown);
  tagScoreCard('pCompletionCard',comp!=null?comp:null);
  tagScoreCard('pActivityCard',act);
  tagScoreCard('pWorkerScoreCard',wscShown);

  const isAvailable=Boolean(W.is_available);
  document.getElementById('availToggle').checked=isAvailable;
  const statusTxt=document.getElementById('availStatusTxt');
  statusTxt.textContent=isAvailable?'Online':'Offline';
  statusTxt.classList.toggle('on',isAvailable);
  statusTxt.classList.toggle('off',!isAvailable);
  document.getElementById('offlineBanner').classList.toggle('show',!isAvailable);

  document.getElementById('emergToggle').checked=Boolean(W.emergency_available);
}
function tagScoreCard(id,val){
  const el=document.getElementById(id);
  el.classList.remove('good','warn','bad');
  if(val==null)return;
  if(val>=75)el.classList.add('good');
  else if(val>=50)el.classList.add('warn');
  else el.classList.add('bad');
}

/* ════════════════════════════════════════════════════════════
   LOAD BOOKINGS — only this worker's rows, ordered newest first.
   ════════════════════════════════════════════════════════════ */
async function loadBookings(){
  if(!W||!W.id)return;

  const {data,error}=await sb.from('bookings')
    .select('*')
    .eq('worker_id',W.id)
    .order('created_at',{ascending:false});

  if(error){
    console.error('loadBookings:',error.message);
    showToast('⚠️ Could not load bookings: '+error.message);
    return;
  }

  bookings=data||[];

/* refresh latest worker row */
const {data:workerLive}=await sb
  .from('workers')
  .select('*')
  .eq('id',W.id)
  .single();

if(workerLive){
  W = {...W,...workerLive};

  sessionStorage.setItem(
    'qf_user',
    JSON.stringify(W)
  );
}

await loadStats();
await checkAndUnlockAchievements();

updateTabCounts();

renderJobs();

renderProfile();
renderWorkerRank();
renderReliabilityPill();
renderEarnings();
renderAcceptanceRate();
renderTimeline();
}

function bookingsByTab(tab){

  if(tab==='pending'){
    return bookings.filter(b=>
      b.w_status==='Pending'
    );
  }

  if(tab==='accepted'){
    return bookings.filter(b=>
      b.w_status==='Accepted'
    );
  }

  if(tab==='arrived'){
    return bookings.filter(b=>
      b.status==='Arrived'
    );
  }

  if(tab==='completed'){
    return bookings.filter(b=>
      b.status==='Completed'
    );
  }

  if(tab==='cancelled'){
    return bookings.filter(b=>
      b.status==='Rejected' ||
      b.status==='Cancelled'
    );
  }

  return [];
}

function updateTabCounts(){
  document.getElementById('cntPending').textContent=bookingsByTab('pending').length;
  document.getElementById('cntAccepted').textContent=bookingsByTab('accepted').length;
  document.getElementById('cntArrived').textContent=bookingsByTab('arrived').length;
  document.getElementById('cntCompleted').textContent=bookingsByTab('completed').length;
  document.getElementById('cntCancelled').textContent=bookingsByTab('cancelled').length;
}

/* ════════════════════════════════════════════════════════════
   TABS
   ════════════════════════════════════════════════════════════ */
const TAB_META={
  pending:  {title:'Pending Requests',   sub:'New job requests waiting for your response'},
  accepted: {title:'Accepted Jobs',       sub:'Jobs you have accepted — head to the customer location'},
  arrived:  {title:'Arrived',             sub:'Verify the Arrival OTP, complete the job, then verify Completion OTP'},
  completed:{title:'Completed Jobs',      sub:'Jobs you have finished'},
  cancelled:{title:'Cancelled / Rejected',sub:'Jobs that did not go ahead'}
};
function switchTab(tab,btn){
  curTab=tab;
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'));
  if(btn)btn.classList.add('on');
  document.getElementById('secTitle').textContent=TAB_META[tab].title;
  document.getElementById('secSub').textContent=TAB_META[tab].sub;
  renderJobs();
}

/* ════════════════════════════════════════════════════════════
   RENDER JOB CARDS
   ════════════════════════════════════════════════════════════ */
function renderJobs(){
  const list=bookingsByTab(curTab);
  const grid=document.getElementById('jobGrid');

  /* Phase 4.1: remember which Track Customer panels were open — the
     innerHTML rebuild below destroys the DOM node any live Leaflet
     map is mounted in, same reason index.html tracks openTrks. */
  const openTrkC=new Set(
    [...document.querySelectorAll('.trk-wrap.open[id^="trkc-wrap-"]')]
      .map(el=>el.id.replace('trkc-wrap-',''))
  );

  if(!list.length){
    const emptyMsgs={
      pending:  ['🔔','No pending requests','New job requests will show up here as soon as they come in.'],
      accepted: ['🚗','No accepted jobs','Accept a pending request to see it here.'],
      arrived:  ['📍','No active arrivals','Jobs you have marked as arrived will show up here.'],
      completed:['✅','No completed jobs yet','Finished jobs will appear here.'],
      cancelled:['❌','No cancelled or rejected jobs','Rejected or cancelled bookings will show up here.']
    };
    const [ico,h,p]=emptyMsgs[curTab];
    grid.innerHTML=`<div class="empty"><div class="empty-ico">${ico}</div><h3>${h}</h3><p>${p}</p></div>`;
    return;
  }

  grid.innerHTML=list.map(b=>renderJobCard(b)).join('');

  /* Restore open Track Customer panels on the freshly-rendered cards. */
  openTrkC.forEach(id=>{
    const wrap=document.getElementById('trkc-wrap-'+id);
    const btn=document.getElementById('trkc-btn-'+id);
    if(!wrap || !btn) return;
    wrap.classList.add('open');
    btn.classList.add('open');
    btn.innerHTML='📍 Track Customer <span class="trk-arr">▲</span>';
    const booking = bookings.find(x=>String(x.id)===String(id));
    if(!booking) return;
    if(_trkStateW[id]?.map){
      _reattachTrackCustomerDom(id);
    } else {
      setTimeout(()=>{ _buildCustomerTrackMap(booking); }, 420);
    }
  });
}

function statusBadge(status){
  const map={
    Pending:  ['bdg-pending','🔔 Pending'],
    Accepted: ['bdg-accepted','🚗 Accepted'],
    Arrived:  ['bdg-arrived','📍 Arrived'],
    Completed:['bdg-completed','✅ Completed'],
    Rejected: ['bdg-rejected','❌ Rejected'],
    Cancelled:['bdg-cancelled','❌ Cancelled']
  };
  const [cls,label]=map[status]||['bdg-status',status||'—'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function renderJobCard(b){
  const cardCls = b.status==='Accepted' ? 'accepted'
                : b.status==='Completed' ? 'completed-card'
                : (b.status==='Rejected'||b.status==='Cancelled') ? 'cancelled-card'
                : (b.is_emergency ? 'urgent' : '');
  const earning = b.worker_earning!=null ? Number(b.worker_earning) : Math.round((Number(b.price)||0)*0.80);

  let actions='';
  if(['Pending','Confirmed','Scheduled'].includes(b.status)){
    actions=`
      <div class="job-acts">
        <button class="jbtn jbtn-accept" onclick="promptAccept('${b.id}')">✅ Accept</button>
        <button class="jbtn jbtn-reject" onclick="promptReject('${b.id}')">✖ Reject</button>
      </div>`;
  } else if(b.status==='Accepted'){
    actions=`
      <div class="job-acts">
        <button class="jbtn jbtn-arrive" onclick="markArrived('${b.id}')">📍 Mark Arrived</button>
        <button class="jbtn jbtn-reject" onclick="promptCancelAccepted('${b.id}')">✖ Cancel Booking</button>
      </div>`;
  } else if(b.status==='Arrived'){
    /* Arrival OTP already verified (arrival_otp is null in DB at this point).
       Only Completion OTP remains. */
    actions=`
      <div class="job-acts">
        <button class="jbtn jbtn-complete" onclick="openOtpModal('completion','${b.id}')">✅ Verify Completion OTP</button>
      </div>`;
  }

  const otpRow = '';

  /* Phase 4.1: Track Customer — only for Accepted jobs, placed below
     the action buttons. Uses the same trk-* markup/classes as
     index.html's Track Worker panel; content is built lazily by
     toggleTrackCustomer() the first time it's opened. */
  const trackCustomerHtml = b.status==='Accepted' ? `
         <button class="trk-toggle" id="trkc-btn-${b.id}" onclick="toggleTrackCustomer('${b.id}')">📍 Track Customer <span class="trk-arr">▼</span></button>
        <div class="trk-wrap" id="trkc-wrap-${b.id}">
          <div class="trk-body">
            <div class="trk-map" id="trkc-slot-${b.id}"></div>
            <div class="trk-meta" id="trkc-meta-${b.id}"><span class="trk-dot"></span><span id="trkc-eta-${b.id}">Waiting for your location...</span></div>
            <div id="trkc-building-${b.id}" style="font-size:.78rem;font-weight:600;color:var(--teal,#2f9e5c);text-align:center;margin-top:.3rem"></div>
            <div class="trk-eta-panel" id="trkc-etapanel-${b.id}" style="display:flex;gap:1.5rem;justify-content:center;margin-top:.5rem;font-size:.85rem;color:var(--text2,#666)">
              <span>🚗 Distance to Customer<br><b id="trkc-dist-${b.id}">--</b></span>
              <span>⏱ ETA<br><b id="trkc-time-${b.id}">--</b></span>
            </div>
          </div>
        </div>` : '';

  return `<div class="job-card ${cardCls}" id="jcard-${b.id}">
    <div class="job-top">
      <div class="job-left">
        <div class="job-ico ${b.is_emergency?'urg':''}">${b.is_emergency?'🚨':'🔧'}</div>
        <div style="min-width:0">
          <div class="job-name">${b.service||'Service'} ${b.is_emergency?'<span class="badge bdg-emerg">🚨 Emergency</span>':''}</div>
          <div class="job-meta">${statusBadge(b.status)}</div>
          ${b.address?`<div class="job-addr">📍 ${b.address}</div>`:''}
          ${b.notes?`<div class="job-notes">"${b.notes}"</div>`:''}
          ${otpRow}
        </div>
      </div>
      <div>
        <div class="job-price">₹${b.price??0}</div>
        <div class="job-earn">You earn ₹${earning}</div>
      </div>
    </div>
    ${actions}${trackCustomerHtml}
  </div>`;
}

/* ════════════════════════════════════════════════════════════
   ACCEPT
   ════════════════════════════════════════════════════════════ */
function promptAccept(id){
  pendAcceptId=id;
  const b=bookings.find(x=>String(x.id)===String(id));
  if(!b)return;
  const earning=Math.round((Number(b.price)||0)*0.80);
  document.getElementById('acceptModalDesc').innerHTML=
    `<strong>${b.service_name||'Service'}</strong>${b.address?`<br/>📍 ${b.address}`:''}<br/>💰 You earn <strong style="color:var(--teal)">₹${earning}</strong> for this job.`;
  document.getElementById('acceptModal').classList.add('on');
}
async function confirmAccept(){
  closeModal('acceptModal');
  if(!pendAcceptId)return;
  const id=pendAcceptId; pendAcceptId=null;
  const b=bookings.find(x=>String(x.id)===String(id));
  if(!b)return;
  const earning=Math.round((Number(b.price)||0)*0.80);

  /* First check latest status from Supabase */
const {data:live,error:fetchErr}=await sb
  .from('bookings')
  .select('status')
  .eq('id',id)
  .single();

if(fetchErr){
  console.error(fetchErr.message);
  showToast('⚠️ Could not verify booking.');
  return;
}

/* Someone already accepted/completed it */
if(
  live.status!=='Pending' &&
  live.status!=='Scheduled' &&
  live.status!=='Confirmed'
){
  showToast('⚠️ This booking has already been accepted by another worker.');
  await loadBookings();
  return;
}

/* Safe to accept */
/* Read current timeline */
const {error}=await sb.from('bookings').update({
  status:'Accepted',
  w_status:'Accepted',
  worker_earning:earning,
  accepted_at:new Date().toISOString()
})
.eq('id',id)
.in('status',['Pending','Scheduled','Confirmed']);

if(error){
  console.error('confirmAccept:',error.message);
  showToast('⚠️ Could not accept job: '+error.message);
  return;
}

  //await bumpWorkerCounter('accepted_jobs');

  /* AUTO OFFLINE: worker is now on a job — stop receiving new requests */
  await setWorkerAvailability(false);

  showToast('✅ Job accepted! You are now Offline.');
  await loadBookings();
  syncGPS(id); /* push current coords to this booking immediately */
  switchTab('accepted',document.querySelector('.tab[data-tab="accepted"]'));
}

/* ════════════════════════════════════════════════════════════
   REJECT
   ════════════════════════════════════════════════════════════ */
function promptReject(id){
  pendRejectId=id;
  document.getElementById('rejectModal').classList.add('on');
}
async function confirmReject(){
  closeModal('rejectModal');
  if(!pendRejectId)return;
  const id=pendRejectId; pendRejectId=null;

  const {error}=await sb.from('bookings').update({
    status:'Rejected',
    w_status:'Rejected'
  }).eq('id',id);
  if(error){
    console.error('confirmReject:',error.message);
    showToast('⚠️ Could not reject job: '+error.message);
    return;
  }

  showToast('Job rejected.');
  await loadBookings();
}

/* ════════════════════════════════════════════════════════════
   CANCEL (Accepted bookings only). Pending jobs use Reject
   above; this path is strictly for a booking the worker has
   already accepted. Penalty accounting (cancelled_jobs count,
   reliability score reduction) is assumed to happen in SQL when
   status becomes 'Cancelled', same as it does for customer-side
   cancellation — verify this string matches what that path writes.
   ════════════════════════════════════════════════════════════ */
function promptCancelAccepted(id){
  pendCancelAcceptedId=id;
  document.getElementById('cancelAcceptedModal').classList.add('on');
}
async function confirmCancelAccepted(){
  closeModal('cancelAcceptedModal');
  if(!pendCancelAcceptedId)return;
  const id=pendCancelAcceptedId; pendCancelAcceptedId=null;

  const {error}=await sb.from('bookings').update({
    status:'Cancelled',
    w_status:'Cancelled'
  }).eq('id',id).eq('status','Accepted'); /* guard: only ever cancels a still-Accepted booking */

  if(error){
    console.error('confirmCancelAccepted:',error.message);
    showToast('⚠️ Could not cancel job: '+error.message);
    return;
  }

  showToast('Booking cancelled.');
  /* 4.9.6: the only other way a tracked booking leaves the active
     status set (besides Arrival, which already calls this). Without
     it, cancelling while Track Customer is open leaks the map. */
  _destroyCustomerTrackMap(id);
  await loadBookings();
}

/* ════════════════════════════════════════════════════════════
   MARK ARRIVED (worker physically reaches location —
   precedes Arrival OTP verification)
   ════════════════════════════════════════════════════════════ */
async function markArrived(id){
  /* Per the booking lifecycle, "Arrived" status is only confirmed once the
     Arrival OTP is verified — see openOtpModal/submitArrivalOtp. This
     button simply opens that verification step. */
  openOtpModal('arrival',id);
}

/* ════════════════════════════════════════════════════════════
   OTP VERIFICATION
   ════════════════════════════════════════════════════════════ */
function openOtpModal(mode,id){
  pendOtpId=id;
  if(mode==='arrival'){
    document.getElementById('arrivalOtpInput').value='';
    document.getElementById('arrivalOtpModal').classList.add('on');
  }else{
    document.getElementById('completionOtpInput').value='';
    document.getElementById('completionOtpModal').classList.add('on');
  }
}

async function submitArrivalOtp() {
  const entered = document.getElementById('arrivalOtpInput').value.trim();

  if (!entered) {
    showToast('⚠️ Please enter OTP');
    return;
  }

  const b = bookings.find(x => String(x.id) === String(pendOtpId));
  if (!b) {
    showToast('⚠️ Booking not found');
    return;
  }

  /* Client-side OTP check — gives immediate feedback and ensures we only
     generate a completion OTP on a confirmed match. */
  const expectedArrival = String(b.arrival_otp ?? '').trim();
  if (!expectedArrival || entered !== expectedArrival) {
    showToast('❌ Incorrect Arrival OTP');
    return;
  }

  /* Generate completion OTP now — must not exist before arrival is verified. */
  const newCompletionOtp = String(Math.floor(100000 + Math.random() * 900000));

  const { error } = await sb
  .from('bookings')
  .update({
    status:         'Arrived',
    w_status:       'Arrived',
    arrival_otp:    null,
    completion_otp: newCompletionOtp,
    arrived_at:     new Date().toISOString(),
    started_at:     new Date().toISOString()
  })
    .eq('id', b.id);

  if (error) {
    console.error('submitArrivalOtp:', error.message);
    showToast('⚠️ Could not verify arrival: ' + error.message);
    return;
  }

  closeModal('arrivalOtpModal');
  showToast('✅ Arrival confirmed!');

  /* Phase 4.1, requirement 5: worker has reached the customer —
     tear down the Track Customer map for this booking now. */
  _destroyCustomerTrackMap(b.id);

  await loadBookings();
  switchTab('arrived', document.querySelector('.tab[data-tab="arrived"]'));
}

async function submitCompletionOtp(){
  const input = document.getElementById('completionOtpInput');
  const entered = input.value.trim();

  if (!entered) {
    showToast('⚠️ Enter OTP');
    return;
  }

  if (!pendOtpId) {
    showToast('⚠️ No booking selected');
    return;
  }

  const b = bookings.find(x => String(x.id) === String(pendOtpId));
  if (!b) {
    showToast('⚠️ Booking not found');
    return;
  }

  const expectedOtp = String(b.completion_otp ?? '').trim();

  if (entered !== expectedOtp) {
    showToast('❌ Incorrect Completion OTP');
    return;
  }

  const { error } = await sb.from('bookings').update({
    status:         'Completed',
    w_status:       'Completed',
    completion_otp: null,          /* invalidate completion OTP immediately */
    completed_at:   new Date().toISOString()
  }).eq('id', b.id);

  if (error) {
    console.error('submitCompletionOtp:', error.message);
    showToast('⚠️ Could not verify completion: ' + error.message);
    return;
  }

  closeModal('completionOtpModal');
  input.value = '';

  //await bumpWorkerCounter('completed_jobs');
  //await bumpWorkerCounter('total_jobs');

  /* AUTO ONLINE: job finished — worker is free for new bookings */
  await setWorkerAvailability(true);

  showToast('🏁 Job completed! You are now Online.');
  await loadBookings();
  switchTab('completed', document.querySelector('.tab[data-tab="completed"]'));
}

/* ════════════════════════════════════════════════════════════
   WORKER COUNTER HELPERS
   Increments a counter column on the live workers row (read-then-write,
   since Supabase JS has no atomic increment without an RPC, and the
   task scope disallows inventing new functions/columns server-side).
   ════════════════════════════════════════════════════════════ */
/*async function bumpWorkerCounter(column){
  const {data:fresh,error:fe}=await sb.from('workers').select('*').eq('id',W.id).single();
  if(fe||!fresh){console.error('bumpWorkerCounter fetch:',fe?.message);return;}
  const current=Number(fresh[column])||0;
  const updates={[column]:current+1};
  const {error:ue}=await sb.from('workers').update(updates).eq('id',W.id);
  if(ue){console.error('bumpWorkerCounter update:',ue.message);return;}
  W={...W,...fresh,...updates};
  sessionStorage.setItem('qf_user',JSON.stringify(W));
  renderProfile();
}*/

/* ════════════════════════════════════════════════════════════
   AVAILABILITY / EMERGENCY TOGGLES
   ════════════════════════════════════════════════════════════ */
async function toggleAvailability(){
  const checked=document.getElementById('availToggle').checked;
  const {error}=await sb.from('workers').update({is_available:checked}).eq('id',W.id);
  if(error){
    console.error('toggleAvailability:',error.message);
    showToast('⚠️ Could not update status: '+error.message);
    document.getElementById('availToggle').checked=!checked; /* revert UI on failure */
    return;
  }
  W.is_available=checked;
  sessionStorage.setItem('qf_user',JSON.stringify(W));
  renderProfile();
  showToast(checked?'🟢 You are now Online':'⚪ You are now Offline');
}

/* Shared helper — sets availability programmatically (accept→offline, complete→online).
   Reuses the exact same Supabase write + local state + UI path as toggleAvailability,
   so the toggle, status badge, offline banner and sessionStorage all update identically. */
async function setWorkerAvailability(online){
  const {error}=await sb.from('workers').update({is_available:online}).eq('id',W.id);
  if(error){ console.error('setWorkerAvailability:',error.message); return; }
  W.is_available=online;
  sessionStorage.setItem('qf_user',JSON.stringify(W));
  document.getElementById('availToggle').checked=online;
  renderProfile(); /* renderProfile reads W.is_available and syncs toggle, badge, offline banner */
}


async function toggleEmergency(){
  const checked=document.getElementById('emergToggle').checked;
  const {error}=await sb.from('workers').update({emergency_available:checked}).eq('id',W.id);
  if(error){
    console.error('toggleEmergency:',error.message);
    showToast('⚠️ Could not update emergency availability: '+error.message);
    document.getElementById('emergToggle').checked=!checked;
    return;
  }
  W.emergency_available=checked;
  sessionStorage.setItem('qf_user',JSON.stringify(W));
  showToast(checked?'🚨 Emergency availability ON':'Emergency availability OFF');
}

/* ════════════════════════════════════════════════════════════
   MISC
   ════════════════════════════════════════════════════════════ */

/* ── ACHIEVEMENTS ──────────────────────────────────────────── */
function renderAchievements(){
  if(!Stats) return;
  const unlockedIds=new Set(UnlockedAchievements.map(r=>r.achievement_id));

  function card(a){
    const unlocked=unlockedIds.has(a.id);
    const [current,target]=a.progress(Stats);
    const fill=Math.max(0,Math.min(100,Math.round((Number(current)/Number(target))*100)));
    const gateOk=Stats.completed_jobs>=a.gate;
    return `<div class="ach-card${unlocked?' unlocked':''}">
      <div class="ach-ico">${a.icon}</div>
      <div class="ach-body">
        <div class="ach-title">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
        <div class="ach-prog-row">
          <span class="ach-prog-label">Progress</span>
          <span class="ach-prog-val">${Math.min(current,target)} / ${target}</span>
        </div>
        <div class="ach-bar-track"><div class="ach-bar-fill" data-fill="${unlocked?100:fill}"></div></div>
        <div class="ach-badge">${unlocked?'✅ Unlocked':(gateOk?'🔒 Locked':`🔒 Needs ${a.gate}+ completed jobs`)}</div>
      </div>
    </div>`;
  }

  function section(title,items){
    return `<div class="ach-section">
      <div class="ach-section-title">${title}</div>
      ${items.map(card).join('')}
    </div>`;
  }

  const catTitles={Jobs:'🔨 Jobs',Rating:'⭐ Rating',Reliability:'🛡 Reliability',Activity:'⚡ Activity','Worker Score':'🏅 Worker Score'};
  const html = Object.keys(catTitles).map(c=>section(catTitles[c], ACHIEVEMENTS.filter(a=>a.category===c))).join('')
    + `<div class="ach-section"><div class="ach-section-title">🚨 Emergency</div><div class="ach-coming">🚧 Emergency achievements — Coming Soon</div></div>`;

  const body=document.getElementById('achievementsBody');
  body.innerHTML=html;

  requestAnimationFrame(()=>{
    body.querySelectorAll('.ach-bar-fill').forEach(el=>{
      el.style.width=(el.dataset.fill||0)+'%';
    });
  });
}

function openAchievements(){
  renderAchievements();
  document.getElementById('achievementsModal').classList.add('on');
}

function closeModal(id){ document.getElementById(id).classList.remove('on'); }

function getIST(){ return new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'})); }
function tickClock(){
  const d=getIST(), h=d.getHours(), m=d.getMinutes(), s=d.getSeconds();
  const str=`${String(h%12||12).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} ${h<12?'AM':'PM'}`;
  document.getElementById('istTime').textContent=str;
}

let _tt;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.add('on');
  clearTimeout(_tt);
  _tt=setTimeout(()=>t.classList.remove('on'),3500);
}

async function logout(){
  await sb.auth.signOut();
  sessionStorage.removeItem('qf_user');
  sessionStorage.removeItem('qf_role');
  sessionStorage.removeItem('qf_bookings_cache');
  window.location.href='auth.html';
}

/* ════════════════════════════════════════════════════════════
   EARNINGS DASHBOARD
   Calculates today / this-week / this-month from completed bookings.
   Uses booking.completed_at (ISO string) and booking.worker_earning.
   ════════════════════════════════════════════════════════════ */
function renderEarnings(){
  const ist=getIST();
  const todayStr=ist.toISOString().split('T')[0];

  /* Week start = most recent Monday in IST */
  const dow=ist.getDay()===0?6:ist.getDay()-1; /* 0=Mon…6=Sun */
  const weekStart=new Date(ist);
  weekStart.setDate(ist.getDate()-dow);
  weekStart.setHours(0,0,0,0);

  /* Month start */
  const monthStart=new Date(ist.getFullYear(),ist.getMonth(),1);

  let eToday=0,eWeek=0,eMonth=0;
  bookings.forEach(b=>{
    if(b.status!=='Completed')return;
    const earn=Number(b.worker_earning)||0;
    const ts=b.completed_at||b.created_at;
    if(!ts)return;
    const d=new Date(ts);
    if(d>=monthStart)eMonth+=earn;
    if(d>=weekStart)eWeek+=earn;
    if(d.toISOString().split('T')[0]===todayStr)eToday+=earn;
  });

  document.getElementById('earnToday').textContent ='₹'+eToday.toLocaleString('en-IN');
  document.getElementById('earnWeek').textContent  ='₹'+eWeek.toLocaleString('en-IN');
  document.getElementById('earnMonth').textContent ='₹'+eMonth.toLocaleString('en-IN');
}

/* ════════════════════════════════════════════════════════════
   ACCEPTANCE RATE
   accepted_jobs and cancelled_jobs come from workers table.
   Rejected bookings also counted from live bookings array.
   acceptance_rate = accepted / (accepted + rejected_total)
   ════════════════════════════════════════════════════════════ */
function renderAcceptanceRate(){

  const accepted = bookings.filter(b =>
    ['Accepted','Arrived','Completed'].includes(b.status)
  ).length;

  const rejected = bookings.filter(b =>
    b.status === 'Rejected' || b.w_status === 'Rejected'
  ).length;

  const total = accepted + rejected;

  const rate =
    total > 0
      ? Math.round((accepted / total) * 100)
      : 0;

  document.getElementById('arAccepted').textContent = accepted;
  document.getElementById('arRejected').textContent = rejected;
  document.getElementById('arRate').textContent =
    total > 0 ? rate + '%' : 'N/A';
}

/* ════════════════════════════════════════════════════════════
   WORKER RANK
   Derived from worker_score (existing column):
   ≥ 80 → Gold, ≥ 50 → Silver, > 0 → Bronze, null/0 → Unranked
   ════════════════════════════════════════════════════════════ */
function renderWorkerRank(){
  const el=document.getElementById('workerRankBadge');
  const qualified = (Stats?.accepted_jobs ?? 0) >= RELIABILITY_MIN_ACCEPTED_JOBS;
  const score = qualified ? (Stats?.worker_score ?? 0) : 0;

  el.className='rank-badge';
  if(score===0){
    el.classList.add('rank-new');
    el.textContent='— Unranked';
  } else if(score>=80){
    el.classList.add('rank-gold');
    el.textContent='🥇 Gold Worker';
  } else if(score>=50){
    el.classList.add('rank-silver');
    el.textContent='🥈 Silver Worker';
  } else {
    el.classList.add('rank-bronze');
    el.textContent='🥉 Bronze Worker';
  }
}

/* ════════════════════════════════════════════════════════════
   RELIABILITY STATUS PILL
   90–100 → Excellent, 70–89 → Good, <70 → Needs Improvement
   ════════════════════════════════════════════════════════════ */
function renderCancellationWarning(cancelledJobs){
  const el=document.getElementById('cancelWarnBanner');
  if(!el) return;
  if(!cancelledJobs || cancelledJobs<=0){
    el.style.display='none';
    el.textContent='';
    return;
  }
  el.style.display='flex';
  if(cancelledJobs>3){
    el.className='cancel-warn-banner cancel-warn-severe';
    el.textContent='🚫 Too many cancellations may affect future bookings.';
  } else {
    el.className='cancel-warn-banner cancel-warn-mild';
    el.textContent='⚠ Frequent cancellations reduce your reliability score.';
  }
}

function renderReliabilityPill(){
  const el=document.getElementById('reliabilityPill');
  const rel=Stats?.reliability_score!=null?Number(Stats.reliability_score):null;
  const qualified=(Stats?.accepted_jobs??0)>=RELIABILITY_MIN_ACCEPTED_JOBS;
  el.className='rel-pill';
  if(rel===null){el.textContent='Reliability: —';el.classList.add('rel-needs');return;}
  if(!qualified){el.textContent='🆕 New Worker';el.classList.add('rel-needs');return;}
  if(rel>=90){el.classList.add('rel-excellent');el.textContent='🟢 Excellent Reliability';}
  else if(rel>=70){el.classList.add('rel-good');el.textContent='🟡 Good Reliability';}
  else{el.classList.add('rel-needs');el.textContent='🔴 Needs Improvement';}
}

/* ════════════════════════════════════════════════════════════
   BOOKING TIMELINE
   Shows upcoming bookings (Pending, Accepted, Arrived) grouped
   by IST date. Uses booking.created_at as the date reference
   since bookings don't have a separate scheduled_date column in
   the current schema — only created_at, accepted_at, completed_at.
   Orders ascending so next jobs appear at top.
   ════════════════════════════════════════════════════════════ */
function renderTimeline(){
  const wrap=document.getElementById('bookingTimeline');
  const activeStatuses=['Pending','Confirmed','Scheduled','Accepted','Arrived'];
  const upcoming=bookings
    .filter(b=>activeStatuses.includes(b.status))
    .slice() /* don't mutate global */
    .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));

  if(!upcoming.length){
    wrap.innerHTML='<div class="tl-empty">No upcoming bookings</div>';
    return;
  }

  const ist=getIST();
  const todayStr=ist.toISOString().split('T')[0];
  const tomorrowStr=(()=>{const t=new Date(ist);t.setDate(t.getDate()+1);return t.toISOString().split('T')[0];})();

  /* Group by date string */
  const groups={};
  upcoming.forEach(b=>{
    const ds=(b.created_at||'').split('T')[0]||'Unknown';
    if(!groups[ds])groups[ds]=[];
    groups[ds].push(b);
  });

  let html='';
  Object.keys(groups).sort().forEach(ds=>{
    const lbl=ds===todayStr?'📅 Today':ds===tomorrowStr?'📅 Tomorrow':`📅 ${ds}`;
    html+=`<div class="tl-day-lbl">${lbl}</div>`;
    groups[ds].forEach(b=>{
      const name=b.service_name||b.service||'Service';
      html+=`<div class="tl-item">
        <div class="tl-dot"></div>
        <div>
          <div class="tl-name">${name}</div>
          <div class="tl-meta">${b.address||'No address'} · <span style="font-size:.65rem;font-weight:700;padding:1px 6px;border-radius:50px;background:var(--surface3);color:var(--text2)">${b.status}</span></div>
        </div>
      </div>`;
    });
  });

  wrap.innerHTML=html;
}

/* ── Patch renderProfile to also call the new renderers ── */
const _origRenderProfile=renderProfile;
renderProfile=function(){
  _origRenderProfile();
  renderWorkerRank();
  renderReliabilityPill();
};

/* ── LIVE GPS PUBLISHING ──────────────────────────────────────
   One watchPosition watcher, one active booking at a time.
   Starts automatically on boot if an active booking exists,
   restarts when a new booking becomes active, stops when the
   booking completes/cancels or the worker goes offline. */
let _gpsWatchId   = null;   /* navigator.geolocation watch handle */
let _gpsActive    = false;  /* whether the watcher is currently running */
let _gpsRetryTimer = null;  /* retry timer for transient GPS failures */

const GPS_ACTIVE_STATUSES = ['Accepted', 'Worker on Way', 'Arrived'];

function _getActiveBookingIds(){
  /* bookings is the module-level array kept by loadBookings() */
  return (bookings||[])
    .filter(b => GPS_ACTIVE_STATUSES.includes(b.status))
    .map(b => b.id);
}

function _clearGPSRetry(){
  if(_gpsRetryTimer !== null){
    clearTimeout(_gpsRetryTimer);
    _gpsRetryTimer = null;
  }
}

function _clearGPSWatch(){
  if(_gpsWatchId !== null){
    navigator.geolocation.clearWatch(_gpsWatchId);
    _gpsWatchId = null;
  }
}

function _scheduleGPSRetry(delay=5000){
  _clearGPSRetry();
  _gpsRetryTimer = setTimeout(()=>{
    _gpsRetryTimer = null;
    if(_gpsActive) _startGPS();
  }, delay);
}

function _stopGPS(){
  _clearGPSRetry();
  _clearGPSWatch();
  console.log('GPS stopped');
  _gpsActive = false;
}

function _startGPS(){
  /* Never create a duplicate watcher */
  if(_gpsWatchId !== null) return;
  if(!navigator.geolocation){
    console.warn('GPS: geolocation not supported by this browser');
    showToast('Enable location permission');
    return;
  }
  _gpsActive = true;
  _clearGPSRetry();
  _gpsWatchId   = navigator.geolocation.watchPosition(
    async (pos)=>{
      const { latitude, longitude } = pos.coords;
      /* Recompute the active booking list on every fix, so a newly
         accepted booking starts receiving GPS on the very next update
         without needing a new watcher. */
      const activeIds = _getActiveBookingIds();
      if(!activeIds.length){ _stopGPS(); return; }
      console.log('GPS update', latitude, longitude, 'bookings:', activeIds);
      const { error } = await sb.from('bookings').update({
        worker_live_lat:  latitude,
        worker_live_lng:  longitude,
        worker_last_seen: new Date().toISOString()
      }).in('id', activeIds);
      if(error) console.error('GPS publish error:', error.message);
    },
    (err)=>{
      _clearGPSWatch();
      if(err.code === 1){
        console.warn('GPS permission denied:', err.message);
        showToast('Enable location permission');
        _stopGPS();
        return;
      }
      console.warn('GPS error:', err.message, '(code', err.code, ')');
      _scheduleGPSRetry();
    },
    { enableHighAccuracy: false, maximumAge: 10000, timeout: 30000 }
  );
  console.log('GPS started for bookings:', _getActiveBookingIds());
}

function syncGPS(immediateBookingId){
  const activeIds = _getActiveBookingIds();
  if(!activeIds.length){
    _stopGPS();
    return;
  }
  _startGPS();

  /* If a specific booking just became active and the watcher was already
     running (Booking #2, #3 …), the next watchPosition callback could be
     up to maximumAge/timeout away. Push current coordinates immediately
     so the customer map appears without delay. */
  if(immediateBookingId && navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      async (pos)=>{
        const { latitude, longitude } = pos.coords;
        const { error } = await sb.from('bookings').update({
          worker_live_lat:  latitude,
          worker_live_lng:  longitude,
          worker_last_seen: new Date().toISOString()
        }).eq('id', immediateBookingId);
        if(error) console.error('GPS immediate publish error:', error.message);
      },
      (err)=>{ console.warn('GPS immediate fix failed:', err.message); },
      { enableHighAccuracy: false, maximumAge: 10000, timeout: 10000 }
    );
  }
}

/* ══════════════════════════════════════════════════════════════
   PHASE 4.1 — TRACK CUSTOMER (worker's view of the SAME live
   tracking implementation used in index.html): same Leaflet map
   approach, same worker/customer marker icons, same OSRM route
   with straight-line fallback, same "fitBounds exactly once, then
   only move markers" update strategy. Ported here because this is
   a separate HTML file with no shared module to import from —
   logic/behavior is identical, not reinvented.
   ══════════════════════════════════════════════════════════════ */
const TRACK_CUSTOMER_ZOOM = 15;

/* bookingId → { map, workerMarker, customerMarker, routeLine, container, initialized, lastRouteFetch } */
const _trkStateW = {};

let _AREAS_CACHE_W = null;
async function _loadAreasW(){
  if(_AREAS_CACHE_W && _AREAS_CACHE_W.length) return _AREAS_CACHE_W;
  const {data,error} = await sb.from('areas').select('*');
  if(error){ console.error('_loadAreasW:',error.message); return []; }
  _AREAS_CACHE_W = data||[];
  return _AREAS_CACHE_W;
}

/* Phase 4.7: same reverse-geocoding call as index.html's
   _geoapifyReverseGeocode, ported here since this file has no shared
   module to import from. Same field preference order, same key. */
async function _geoapifyReverseGeocodeW(lat, lng){
  const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${GEOAPIFY_API_KEY}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Geoapify reverse geocode HTTP '+res.status);
  const data = await res.json();
  const p = data?.features?.[0]?.properties || {};
  return p.building || p.amenity || p.name || p.housename || p.street || p.suburb || p.locality || null;
}

/* Same resolution order as index.html's _resolveCustomerLatLng:
   exact GPS captured at booking time first, area centroid fallback. */
async function _resolveCustomerLatLngW(b){
  if(b.customer_lat != null && b.customer_lng != null){
    return { lat:Number(b.customer_lat), lng:Number(b.customer_lng) };
  }
  const areaId = b.area_id ?? b.areaId ?? null;
  if(areaId == null) return null;
  const areas = await _loadAreasW();
  const area = areas.find(a=>String(a.id)===String(areaId));
  if(!area || area.lat==null || area.lng==null) return null;
  return { lat:Number(area.lat), lng:Number(area.lng) };
}

/* Phase 4.7: Geoapify Routing API road route — replaces OSRM, same
   contract as index.html's _fetchRoadRoute so both dashboards render
   the identical road-following route for the same two points. */
async function _fetchRoadRouteW(from, to){
  try{
    const url = `https://api.geoapify.com/v1/routing?waypoints=${from.lat},${from.lng}|${to.lat},${to.lng}&mode=drive&apiKey=${GEOAPIFY_API_KEY}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('Geoapify routing HTTP '+res.status);
    const data = await res.json();
    const feature = data?.features?.[0];
    const geom = feature?.geometry;
    const coordArrays = geom?.type === 'MultiLineString' ? geom.coordinates
      : geom?.type === 'LineString' ? [geom.coordinates]
      : null;
    if(!coordArrays || !coordArrays.length) throw new Error('Geoapify routing: empty route');
    const coords = coordArrays.flat();
    if(!coords.length) throw new Error('Geoapify routing: empty coordinates');
    const latlngs = coords.map(([lng,lat])=>[lat,lng]);
    Object.defineProperties(latlngs, {
      distance: { value: feature.properties?.distance ?? null, enumerable: false },
      duration: { value: feature.properties?.time ?? null, enumerable: false }
    });
    return latlngs;
  }catch(e){
    return null;
  }
}

/* Phase 4.5: kept separate from index.html's helpers since the two
   files load independently. */
function _fmtDistanceW(m){
  if(typeof m !== 'number' || !isFinite(m)) return '--';
  return m < 1000 ? Math.round(m)+' m' : (m/1000).toFixed(1)+' km';
}
function _fmtDurationW(s){
  if(typeof s !== 'number' || !isFinite(s)) return '--';
  const mins = Math.round(s/60);
  return mins < 1 ? '<1 min' : mins+' min'+(mins===1?'':'s');
}
/* Same movement/animation helpers as index.html — ported, not
   reinvented, since this file has no shared module to import from. */
function _metersBetweenW(a, b){
  if(!a || !b) return Infinity;
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLng = (b.lng - a.lng) * Math.PI/180;
  const s1 = Math.sin(dLat/2)**2 +
    Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.min(1, Math.sqrt(s1)));
}
function _animateMarkerToW(marker, toLat, toLng, duration){
  if(!marker) return;
  if(marker._animFrame) cancelAnimationFrame(marker._animFrame);
  const from = marker.getLatLng();
  const fromLat = from.lat, fromLng = from.lng;
  if(fromLat === toLat && fromLng === toLng) return;
  const start = performance.now();
  function step(now){
    const t = Math.min(1, (now - start) / duration);
    const ease = t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
    marker.setLatLng([fromLat + (toLat-fromLat)*ease, fromLng + (toLng-fromLng)*ease]);
    marker._animFrame = (t < 1) ? requestAnimationFrame(step) : null;
  }
  marker._animFrame = requestAnimationFrame(step);
}

function _updateEtaPanelW(bkId, distance, duration){
  const distEl = document.getElementById('trkc-dist-'+bkId);
  const timeEl = document.getElementById('trkc-time-'+bkId);
  if(distEl) distEl.textContent = _fmtDistanceW(distance);
  if(timeEl) timeEl.textContent = _fmtDurationW(duration);
  const st = _trkStateW[bkId];
  if(st){ st.lastDistance = distance; st.lastDuration = duration; }
}

/* Same "draw once, then only update points" approach as index.html's
   _drawOrUpdateRoute, same 8s OSRM throttle. */
async function _drawOrUpdateRouteW(bkId, workerPt, customerPt){
  const st = _trkStateW[bkId];
  if(!st || !st.map) return;

  const now = Date.now();
  const throttled = st.lastRouteFetch && (now - st.lastRouteFetch < 8000);
  /* Requirement 8: same "worker didn't move" skip as index.html. */
  const unmoved = st.lastWorkerPt && _metersBetweenW(st.lastWorkerPt, workerPt) < 10;

  let latlngs = null;

  if(!throttled && !unmoved){
    st.lastRouteFetch = now;
    st.lastWorkerPt = workerPt;
    latlngs = await _fetchRoadRouteW(workerPt, customerPt);
    if(_trkStateW[bkId] !== st || !st.map) return;

    // Phase 4.5: same pattern as index.html.
    _updateEtaPanelW(bkId, latlngs?.distance ?? null, latlngs?.duration ?? null);
  }

  /* Phase 4.7: no straight-line/dashed fallback — same rule as
     index.html. Keep the existing road route on screen if this
     cycle's Geoapify call failed, rather than ever drawing a
     straight or dashed line. */
  if(!latlngs) return;

  if(!st.routeLine){
    st.routeLine = L.polyline(latlngs, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(st.map);
  } else {
    st.routeLine.setLatLngs(latlngs);
  }
}

function _reattachTrackCustomerDom(id){
  const st = _trkStateW[id];
  if(!st || !st.map || !st.container) return;
  const slot = document.getElementById('trkc-slot-'+id);
  if(!slot) return;
  if(st.container.parentNode !== slot){
    slot.appendChild(st.container);
    try{ st.map.invalidateSize(); }catch(e){}
  }
  _updateEtaPanelW(id, st.lastDistance ?? null, st.lastDuration ?? null);
}

function toggleTrackCustomer(bkId){
  const btn  = document.getElementById('trkc-btn-'+bkId);
  const wrap = document.getElementById('trkc-wrap-'+bkId);
  if(!btn || !wrap) return;
  const opening = !wrap.classList.contains('open');
  wrap.classList.toggle('open', opening);
  btn.classList.toggle('open', opening);
  btn.innerHTML = opening
    ? '📍 Track Customer <span class="trk-arr">▲</span>'
    : '📍 Track Customer <span class="trk-arr">▼</span>';

  if(opening){
    if(_trkStateW[bkId]?.map){
      _reattachTrackCustomerDom(bkId);
      _trkStateW[bkId].map.invalidateSize();
    } else {
      const booking = bookings.find(x=>String(x.id)===String(bkId));
      _buildCustomerTrackMap(booking);
    }
    const onTransitionEnd = (e)=>{
      if(e.target !== wrap || e.propertyName !== 'max-height') return;
      if(_trkStateW[bkId]?.map){
        try{ _trkStateW[bkId].map.invalidateSize(); }catch(err){}
      }
      wrap.removeEventListener('transitionend', onTransitionEnd);
    };
    wrap.addEventListener('transitionend', onTransitionEnd);
  }
}

/* Builds the map once per booking. Worker marker = this worker's own
   live position (worker_live_lat/lng, already published by the
   existing GPS watcher above); customer marker = _resolveCustomerLatLngW.
   fitBounds is called exactly once, right here — never again — so the
   worker can freely zoom/pan afterwards, same guarantee as index.html. */
async function _buildCustomerTrackMap(b){
  if(!b) return;

  if(_trkStateW[b.id]?.map){
    try{ _trkStateW[b.id].map.invalidateSize(); }catch(e){}
    return;
  }

  const wLat = b.worker_live_lat != null ? Number(b.worker_live_lat) : null;
  const wLng = b.worker_live_lng != null ? Number(b.worker_live_lng) : null;
  const slot  = document.getElementById('trkc-slot-'+b.id);
  const msgEl = document.getElementById('trkc-eta-'+b.id);
  if(!slot) return;

  const customer = await _resolveCustomerLatLngW(b);

  if(wLat == null || wLng == null || isNaN(wLat) || isNaN(wLng)){
    if(msgEl) msgEl.textContent = 'Waiting for your location...';
    return;
  }
  if(!customer){
    if(msgEl) msgEl.textContent = 'Customer location unavailable';
    return;
  }

  slot.innerHTML = '';
  const mapEl = document.createElement('div');
  mapEl.className = 'trk-map';
  mapEl.id = 'trkc-map-live-'+b.id;
  slot.appendChild(mapEl);

  const map = L.map(mapEl, { zoomControl:true, attributionControl:false })
               .setView([wLat, wLng], TRACK_CUSTOMER_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19
  }).addTo(map);

  const workerIcon = L.divIcon({
    className: "worker-marker",
    html: `<div style="width:22px;height:22px;border-radius:50%;background:#ff6b35;border:3px solid white;box-shadow:0 0 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;">🔧</div>`,
    iconSize:[28,28],
    iconAnchor:[14,14]
  });
  const customerIcon = L.divIcon({
    className: "customer-marker",
    html: `<div style="width:20px;height:20px;border-radius:50%;background:#2f9e5c;border:3px solid white;box-shadow:0 0 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;">🏠</div>`,
    iconSize:[26,26],
    iconAnchor:[13,13]
  });

  const workerMarker   = L.marker([wLat, wLng], { icon:workerIcon }).addTo(map);
  const customerMarker = L.marker([customer.lat, customer.lng], { icon:customerIcon }).addTo(map);

  /* Requirement 6/8: same autoFollow + lastWorkerPt fields as
     index.html's _trkState. */
  _trkStateW[b.id] = { map, workerMarker, customerMarker, container:mapEl, routeLine:null, initialized:false, lastRouteFetch:0, autoFollow:true, lastWorkerPt:null };

  /* Phase 4.7: same destination building name the customer sees on
     their side, resolved once from the same customer_lat/customer_lng
     via the same Geoapify key — never re-run since the pin is fixed. */
  _geoapifyReverseGeocodeW(customer.lat, customer.lng).then(name=>{
    const bEl = document.getElementById('trkc-building-'+b.id);
    if(bEl) bEl.textContent = name ? '🏠 '+name : '';
  }).catch(()=>{});

  /* Requirement 6: same auto-follow / Re-center button as index.html,
     attached once at map creation — never duplicated. */
  const recenterBtnW = document.createElement('button');
  recenterBtnW.textContent = '⦿ Re-center';
  recenterBtnW.type = 'button';
  recenterBtnW.style.cssText = 'position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:1000;display:none;background:#111;color:#fff;border:none;border-radius:20px;padding:.4rem .9rem;font-size:.78rem;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer';
  mapEl.style.position = 'relative';
  mapEl.appendChild(recenterBtnW);
  _trkStateW[b.id].recenterBtn = recenterBtnW;
  recenterBtnW.addEventListener('click', ()=>{
    const st = _trkStateW[b.id];
    if(!st) return;
    st.autoFollow = true;
    recenterBtnW.style.display = 'none';
    map.panTo(st.workerMarker.getLatLng(), { animate:true, duration:0.6 });
  });
  map.on('dragstart', ()=>{
    const st = _trkStateW[b.id];
    if(!st) return;
    st.autoFollow = false;
    recenterBtnW.style.display = 'block';
  });

  if(msgEl) msgEl.textContent = '📍 Live tracking';
  setTimeout(()=>{ map.invalidateSize(); }, 50);

  try{
    await _drawOrUpdateRouteW(b.id, {lat:wLat,lng:wLng}, customer);
    if(_trkStateW[b.id]?.map !== map) return;

    const st = _trkStateW[b.id];
    const bounds = st.routeLine
      ? st.routeLine.getBounds().pad(0.25)
      : L.latLngBounds([[wLat,wLng],[customer.lat,customer.lng]]).pad(0.35);

    map.fitBounds(bounds, { maxZoom:16, padding:[40,40] }); /* only fitBounds call */
    st.initialized = true;
  }catch(err){
    console.error('_buildCustomerTrackMap route/fit failed (tracking continues):', err);
    if(_trkStateW[b.id]) _trkStateW[b.id].initialized = true;
  }
}

/* Called after every bookings refresh — same responsibility split as
   index.html's updateTrackingMaps(): panel closed → just refresh the
   status text; panel open + map exists → move marker only; panel open
   + no map → build it now. */
function updateCustomerTrackMaps(bookingList){
  (bookingList||[]).forEach(b=>{
    if(b.status !== 'Accepted') return;

    const wLat = b.worker_live_lat != null ? Number(b.worker_live_lat) : null;
    const wLng = b.worker_live_lng != null ? Number(b.worker_live_lng) : null;
    const hasCoords = wLat != null && wLng != null && !isNaN(wLat) && !isNaN(wLng);
    const msgEl = document.getElementById('trkc-eta-'+b.id);
    const wrap  = document.getElementById('trkc-wrap-'+b.id);
    const isOpen = wrap?.classList.contains('open');

    if(!hasCoords){
      if(msgEl) msgEl.textContent = 'Waiting for your location...';
      return;
    }

    if(_trkStateW[b.id]?.map){
      const st = _trkStateW[b.id];
      /* Requirement 5: glide, don't jump. Requirement 7: panTo never
         changes zoom. */
      _animateMarkerToW(st.workerMarker, wLat, wLng, 900);
      if(st.autoFollow) st.map.panTo([wLat, wLng], { animate:true, duration:0.9 });
      if(msgEl) msgEl.textContent = '📍 Live tracking';
      /* Phase 4.4/4.7: refresh the road route on every live GPS fix,
         same approach as index.html. _drawOrUpdateRouteW now skips
         the Geoapify call itself if the worker hasn't moved
         (Requirement 8) — this call stays unconditional so the
         marker/ETA path is untouched. Never draws a straight/dashed
         fallback. Customer marker is never moved — only this
         worker's own marker and the route. */
      if(st.customerMarker){
        const c = st.customerMarker.getLatLng();
        _drawOrUpdateRouteW(b.id, {lat:wLat, lng:wLng}, {lat:c.lat, lng:c.lng});
      }
      return;
    }

    if(isOpen){
      _buildCustomerTrackMap(b);
    } else if(msgEl){
      msgEl.textContent = '📍 Live tracking';
    }
  });
}

/* Requirement 5: once Arrival OTP is verified the worker has reached
   the customer, so the map is torn down (not just left to fall out of
   the DOM on next render) — called from submitArrivalOtp() below. */
function _destroyCustomerTrackMap(bkId){
  const st = _trkStateW[bkId];
  if(!st) return;
  if(st.workerMarker?._animFrame) cancelAnimationFrame(st.workerMarker._animFrame);
  try{ if(st.map) st.map.remove(); }catch(e){}
  delete _trkStateW[bkId];
}

/* ── Patch loadBookings to also refresh the new sections after bookings load ── */
const _origLoadBookings=loadBookings;
loadBookings=async function(){
  await _origLoadBookings();
  renderEarnings();
  renderAcceptanceRate();
  renderTimeline();
  /* Requirement 7: sync GPS state after every bookings refresh */
  syncGPS();
};

/* Keep Track Customer maps live on every refresh — same "move marker,
   never recreate" contract as index.html's updateTrackingMaps(all). */
const _origLoadBookingsForTrackCustomer = loadBookings;
loadBookings = async function(){
  await _origLoadBookingsForTrackCustomer();
  updateCustomerTrackMaps(bookings);
};

/* ══════════════════════════════════════════════════════════════
   BOOKING CALENDAR — isolated, read-only view of the existing
   `bookings` array. Does not touch booking logic, Supabase calls,
   GPS, achievements, stats, auth, earnings, or realtime.
   Uses booking.date (NOT created_at) per spec, and booking.time
   if present — confirm both columns exist in the bookings table.
   ══════════════════════════════════════════════════════════════ */
let calViewDate = new Date();
let calSelectedDate = null;

function toDateKey(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function openCalendar(){
  calViewDate = new Date();
  calSelectedDate = toDateKey(new Date());
  renderCalendarMonth();
  document.getElementById('calendarModal').classList.add('on');
}

function calChangeMonth(delta){
  calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth()+delta, 1);
  renderCalendarMonth();
}

function calBookingCountsByDate(){
  const map={};
  (bookings||[]).forEach(b=>{
    if(!b.date) return;
    const key=String(b.date).split('T')[0];
    map[key]=(map[key]||0)+1;
  });
  return map;
}

function renderCalendarMonth(){
  const y=calViewDate.getFullYear(), m=calViewDate.getMonth();
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent=`${monthNames[m]} ${y}`;

  const firstDay=new Date(y,m,1).getDay();
  const daysInMonth=new Date(y,m+1,0).getDate();
  const counts=calBookingCountsByDate();
  const todayKey=toDateKey(new Date());

  let html='';
  for(let i=0;i<firstDay;i++){
    html+=`<div class="cal-cell cal-empty"></div>`;
  }
  for(let d=1; d<=daysInMonth; d++){
    const key=toDateKey(new Date(y,m,d));
    const count=counts[key]||0;
    let level='cal-none';
    if(count>=3) level='cal-high';
    else if(count>=1) level='cal-mid';
    const isToday = key===todayKey ? ' cal-today':'';
    const isSel = key===calSelectedDate ? ' cal-selected':'';
    html+=`<div class="cal-cell">
      <button type="button" class="cal-day ${level}${isToday}${isSel}" data-date="${key}" onclick="calSelectDate('${key}')">
        <span class="cal-daynum">${d}</span>
        ${count>0?`<span class="cal-badge">${count}</span>`:''}
      </button>
    </div>`;
  }
  document.getElementById('calGrid').innerHTML=html;
  renderCalendarBookingList(calSelectedDate);
}

function calSelectDate(key){
  calSelectedDate=key;
  document.querySelectorAll('#calGrid .cal-day').forEach(el=>{
    el.classList.toggle('cal-selected', el.dataset.date===key);
  });
  renderCalendarBookingList(key);
}

function calFormatDateLabel(key){
  const [y,m,d]=key.split('-').map(Number);
  const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${monthNames[m-1]}`;
}

function renderCalendarBookingList(key){
  const listEl=document.getElementById('calBookingList');
  if(!key){ listEl.innerHTML=''; return; }

  document.getElementById('calListTitle').textContent=`Bookings for ${calFormatDateLabel(key)}`;

  const dayBookings=(bookings||[]).filter(b=> b.date && String(b.date).split('T')[0]===key);

  if(!dayBookings.length){
    listEl.innerHTML=`<div class="cal-empty-list">No bookings for this date.</div>`;
    return;
  }

  listEl.innerHTML = dayBookings.map(b=>{
    const time = b.time || '—';
    const service = b.service_name || b.service || 'Service';
    return `<div class="cal-booking-item">
      <div>🕒 ${time}</div>
      <div>🔧 ${service}</div>
      ${b.address?`<div>🏠 ${b.address}</div>`:''}
      <div>📍 ${b.status||'—'}</div>
    </div>`;
  }).join('<div class="cal-booking-sep"></div>');
}

/* ── BACKDROP CLOSE ── */
['acceptModal','rejectModal','arrivalOtpModal','completionOtpModal','calendarModal','cancelAcceptedModal'].forEach(id=>{
  document.getElementById(id).addEventListener('click',function(e){ if(e.target===this) closeModal(id); });
});