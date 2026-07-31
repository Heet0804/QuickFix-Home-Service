/* ===== QuickFix Worker Profile Script — extracted from worker-profile.html (Phase 5.2) ===== */

/* Responsive-only addition: mobile nav drawer, identical mechanism to
   worker-dashboard.html and index.html. */
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
/* sb now comes from js/common/supabase.js, loaded before this file. */

let W=null;
let completedBookings=[];
let Stats=null;               /* get_worker_stats RPC result — same as dashboard, never computed here */
/* Phase 5.3.3: RELIABILITY_MIN_ACCEPTED_JOBS now comes from
   js/common/config.js (CONFIG.RELIABILITY_MIN_ACCEPTED_JOBS), loaded
   before this file. Previously duplicated identically in
   worker-dashboard.html. */
let UnlockedAchievements=[];  /* worker_achievements rows — profile never decides, only reads */

/* ════════════════════════════════════════════════════════════
   BOOT — same dual-signal auth as worker-dashboard.html
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

  /* Refetch live workers row — same pattern as dashboard */
  const {data:wp,error:we}=await sb.from('workers').select('*').eq('id',cached.id).single();
  if(we||!wp){
    showToast('⚠️ Could not load profile. Please sign in again.');
    setTimeout(()=>{ window.location.href='auth.html?role=worker'; },1500);
    return;
  }
  W={...cached,...wp};
  sessionStorage.setItem('qf_user',JSON.stringify(W));

  /* Load completed bookings — used ONLY for the "recent jobs" list in
     renderEarnings(). Every stat (accepted/completed/cancelled/no-show/
     rating/completion/reliability/activity/worker score/earnings) comes
     from the RPC below, not from this array. */
  const {data:bks}=await sb.from('bookings')
    .select('id,status,worker_earning,service,created_at,scheduled_date,scheduled_time,review_rating')
    .eq('worker_id',W.id)
    .eq('status','Completed')
    .order('created_at',{ascending:false})
    .limit(100);
  completedBookings=bks||[];

  await loadStats();
  await loadAchievements();

  document.getElementById('loadingState').style.display='none';
  document.getElementById('profileContent').style.display='block';

  renderAll();
})();

/* ════════════════════════════════════════════════════════════
   Same RPC index.html and worker-dashboard.html call. This page
   computes nothing — it only displays what the RPC returns.
   ════════════════════════════════════════════════════════════ */
async function loadStats(){
  const {data,error}=await sb.rpc('get_worker_stats',{p_worker_id:W.id});
  if(error){ console.error('get_worker_stats:',error.message); return; }
  Stats=Array.isArray(data)?data[0]:data;
}

/* Profile NEVER evaluates achievements — this only reads what the
   dashboard's achievement engine has already permanently unlocked. */
async function loadAchievements(){
  const {data,error}=await sb.from('worker_achievements').select('*').eq('worker_id',W.id);
  if(error){ console.error('worker_achievements fetch:',error.message); UnlockedAchievements=[]; return; }
  UnlockedAchievements=data||[];
}

/* ════════════════════════════════════════════════════════════
   RENDER ALL
   ════════════════════════════════════════════════════════════ */
function renderAll(){
  renderHero();
  renderPerf();
  renderDetails();
  renderBadges();
  renderEarnings();
}

/* ── HERO / NAV ── */
function renderHero(){
  const name=W.name||'—';
  document.getElementById('navName').textContent=name;
  document.getElementById('pcName').textContent=name;

  /* Avatar initials (first letter of first and last name) */
  const parts=(name||'').trim().split(/\s+/);
  const initials=(parts[0]?.[0]||'')+(parts[1]?.[0]||'');
  document.getElementById('pcInitials').textContent=initials||'?';

  /* Skill */
  const skill=W.skill||'—';
  document.getElementById('pcSkill').textContent=skill;

  /* Phone */
  if(W.phone){
    document.getElementById('pcPhone').style.display='inline-flex';
    document.getElementById('pcPhoneVal').textContent=W.phone;
  } else {
    document.getElementById('pcPhone').style.display='none';
  }

  /* Area */
  if(W.area){
    document.getElementById('pcAreaWrap').style.display='inline-flex';
    document.getElementById('pcArea').textContent=W.area;
  } else {
    document.getElementById('pcAreaWrap').style.display='none';
  }

  /* Radius */
  if(W.radius!=null){
    document.getElementById('pcRadiusWrap').style.display='inline-flex';
    document.getElementById('pcRadius').textContent=W.radius;
  } else {
    document.getElementById('pcRadiusWrap').style.display='none';
  }

  /* Online status */
  const st=document.getElementById('pcStatus');
  if(W.is_available){
    st.textContent='🟢 Online';
    st.className='pc-status online';
  } else {
    st.textContent='⚪ Offline';
    st.className='pc-status offline';
  }

  /* Key stats — all from Stats (get_worker_stats RPC), same as dashboard */
  document.getElementById('statRating').textContent=Stats?.rating!=null?Number(Stats.rating).toFixed(1):'—';
  document.getElementById('statTotalJobs').textContent=Stats?.accepted_jobs??0;
  document.getElementById('statCompleted').textContent=Stats?.completed_jobs??0;

  document.getElementById('statEarnings').textContent='₹'+Number(Stats?.total_earnings??0).toLocaleString('en-IN');
}

/* ── PERFORMANCE GRID ── */
function renderPerf(){
  document.getElementById('pAccepted').textContent=Stats?.accepted_jobs??0;
  document.getElementById('pCompleted').textContent=Stats?.completed_jobs??0;
  document.getElementById('pCancelled').textContent=Stats?.cancelled_jobs??0;
  document.getElementById('pNoShow').textContent=Stats?.no_show_count??0;

  const rel=Stats?.reliability_score??null;
  const comp=Stats?.completion_rate!=null?Math.round(Stats.completion_rate*100):null;
  const act=Stats?.activity_score??null;
  const wsc=Stats?.worker_score??null;

  const qualified=(Stats?.accepted_jobs??0)>=CONFIG.RELIABILITY_MIN_ACCEPTED_JOBS;
  const relShown=rel==null?null:(qualified?rel:0);
  const wscShown=wsc==null?null:(qualified?wsc:0);

  document.getElementById('pReliability').textContent=relShown==null?'—':Number(relShown).toFixed(0)+'%';
  document.getElementById('pCompletion').textContent=comp!=null?comp+'%':'—';
  document.getElementById('pActivity').textContent=act!=null?Number(act).toFixed(0):'—';
  document.getElementById('pWorkerScore').textContent=wscShown==null?'—':Number(wscShown).toFixed(0);

  tagCard('pReliabilityCard',relShown);
  tagCard('pCompletionCard',comp);
  tagCard('pActivityCard',act);
  tagCard('pWorkerScoreCard',wscShown);
}

function tagCard(id,val){
  const el=document.getElementById(id);
  el.classList.remove('good','warn','bad');
  if(val==null)return;
  if(val>=75)el.classList.add('good');
  else if(val>=50)el.classList.add('warn');
  else el.classList.add('bad');
}

/* ── PROFILE DETAIL VIEW ── */
function renderDetails(){
  document.getElementById('vName').textContent=W.name||'—';
  document.getElementById('vPhone').textContent=W.phone||'—';
  document.getElementById('vSkill').textContent=W.skill||'—';
  document.getElementById('vExperience').textContent=W.experience||'—';
  document.getElementById('vArea').textContent=W.area||'—';
  document.getElementById('vRadius').textContent=W.radius!=null?`${W.radius} km`:'—';
}

/* ── RECENT EARNINGS ── */
function renderEarnings(){
  const totalEarned=Stats?.total_earnings??0;
  document.getElementById('earnTotalLabel').textContent=
    completedBookings.length?'Total: ₹'+Number(totalEarned).toLocaleString('en-IN'):'';

  const c=document.getElementById('earnList');
  if(!completedBookings.length){
    c.innerHTML=`<div class="mt-empty">No completed jobs yet. Earnings will appear here once you complete jobs.</div>`;
    return;
  }

  const rows=completedBookings.slice(0,10).map(b=>{
    const amt=Number(b.worker_earning)||0;
    const dateStr=b.scheduled_date?fmtDate(b.scheduled_date):(b.created_at?fmtDate(b.created_at.slice(0,10)):'—');
    return `<div class="earn-item">
      <div class="ei-left">
        <span class="ei-ico">🔧</span>
        <div>
          <div class="ei-svc">${escHtml(b.service||'Job')}</div>
          <div class="ei-date">${dateStr}</div>
        </div>
      </div>
      <div class="ei-amt">₹${amt.toLocaleString('en-IN')}</div>
    </div>`;
  }).join('');

  c.innerHTML=`<div class="earn-list">${rows}</div>
    ${completedBookings.length>10?`<div class="mt-empty">Showing last 10 completed jobs</div>`:''}`;
}

/* ════════════════════════════════════════════════════════════
   BADGES SYSTEM — compute earned badges from worker metrics
   Uses same values displayed in performance metrics
   ════════════════════════════════════════════════════════════ */
/* Icons aren't stored in worker_achievements (only id/category/name/
   description/unlocked_at) — this lookup mirrors the icons in the
   dashboard's ACHIEVEMENTS catalog, purely for display. Not a second
   achievement engine: no thresholds, no conditions, no decisions. */
const ACHIEVEMENT_ICONS={
  'job-1':'🥇','job-10':'🏅','job-25':'🥈','job-50':'🥇','job-100':'🏆',
  'rate-5first':'⭐','rate-45':'🌟','rate-48':'💫','rate-50':'✨',
  'rel-90':'🛡','rel-95':'🔰','rel-100':'💎',
  'act-25':'⚡','act-50':'🔥','act-75':'💪',
  'wsc-40':'🥉','wsc-60':'🥈','wsc-80':'🥇','wsc-95':'💎'
};
function achievementIcon(id){ return ACHIEVEMENT_ICONS[id]||'🏅'; }

function renderBadges(){
  const section=document.getElementById('badgesSection');
  const container=document.getElementById('badgesContainer');

  if(!UnlockedAchievements.length){
    section.style.display='none';
    return;
  }
  section.style.display='block';

  /* One highest badge per category, max 5 (PART 10). "Highest" = most
     recently unlocked in that category — every achievement in a
     category is a strictly higher bar than the previous one, so the
     latest unlock is always the highest tier reached. */
  const byCategory={};
  UnlockedAchievements.forEach(a=>{
    if(!byCategory[a.category] || new Date(a.unlocked_at)>new Date(byCategory[a.category].unlocked_at)){
      byCategory[a.category]=a;
    }
  });
  const topBadges=Object.values(byCategory).slice(0,5);

  const html=`<div class="badges-grid">
    ${topBadges.map(b=>`
      <div class="badge-card earned">
        <span class="badge-ico">${achievementIcon(b.achievement_id)}</span>
        <span class="badge-name">${b.name}</span>
        <span class="badge-meta">${b.category}</span>
      </div>
    `).join('')}
  </div>
  ${UnlockedAchievements.length>topBadges.length?`<div class="badges-footer"><button class="badges-more-btn" onclick="openBadgesModal()">+${UnlockedAchievements.length-topBadges.length} More</button></div>`:''}`;

  container.innerHTML=html;
}

function openBadgesModal(){
  /* PART 10: All Badges, sorted by unlock date (newest first). */
  const sorted=[...UnlockedAchievements].sort((a,b)=>new Date(b.unlocked_at)-new Date(a.unlocked_at));

  const html=sorted.map(b=>`
    <div class="badge-modal-item">
      <div class="badge-modal-ico">${achievementIcon(b.achievement_id)}</div>
      <div class="badge-modal-body">
        <div class="badge-modal-name">${b.name}</div>
        <div class="badge-modal-desc">${b.description}</div>
        <div class="badge-modal-unlock">Unlocked on: ${fmtDate(b.unlocked_at)}</div>
      </div>
    </div>
  `).join('');

  document.getElementById('badgesModalBody').innerHTML=html||'<p style="text-align:center;color:var(--text3);padding:2rem">No earned badges yet</p>';
  document.getElementById('badgesModal').classList.add('on');
}

function closeBadgesModal(){
  document.getElementById('badgesModal').classList.remove('on');
}

/* ════════════════════════════════════════════════════════════
   EDIT PROFILE
   Only updates columns that already exist: name, phone, skill,
   experience, area, radius — as confirmed by the dashboard's
   renderProfile() usage and bumpWorkerCounter() schema.
   ════════════════════════════════════════════════════════════ */
function startEdit(){
  /* Pre-fill form from current W */
  document.getElementById('eName').value=W.name||'';
  document.getElementById('ePhone').value=W.phone||'';
  document.getElementById('eSkill').value=W.skill||'';
  document.getElementById('eExperience').value=W.experience||'';
  document.getElementById('eArea').value=W.area||'';
  document.getElementById('eRadius').value=W.radius!=null?W.radius:'';

  document.getElementById('viewMode').classList.add('hide');
  document.getElementById('editMode').classList.add('on');
  document.getElementById('editBtn').style.display='none';
  document.getElementById('saveBtn').style.display='inline-flex';
  document.getElementById('cancelBtn').style.display='inline-flex';
}

function cancelEdit(){
  document.getElementById('editMode').classList.remove('on');
  document.getElementById('viewMode').classList.remove('hide');
  document.getElementById('editBtn').style.display='inline-flex';
  document.getElementById('saveBtn').style.display='none';
  document.getElementById('cancelBtn').style.display='none';
  /* Clear errors */
  ['eName','ePhone','eSkill','eRadius'].forEach(id=>
    document.getElementById(id).classList.remove('err'));
}

async function saveProfile(){
  const name=document.getElementById('eName').value.trim();
  const phone=document.getElementById('ePhone').value.trim();
  const skill=document.getElementById('eSkill').value;
  const experience=document.getElementById('eExperience').value.trim();
  const area=document.getElementById('eArea').value.trim();
  const radiusRaw=document.getElementById('eRadius').value.trim();
  const radius=radiusRaw?Number(radiusRaw):null;

  /* Validation */
  let valid=true;
  if(!name){ document.getElementById('eName').classList.add('err'); valid=false; }
  if(!phone){ document.getElementById('ePhone').classList.add('err'); valid=false; }
  if(!skill){ document.getElementById('eSkill').classList.add('err'); valid=false; }
  if(radiusRaw&&(isNaN(radius)||radius<1||radius>100)){
    document.getElementById('eRadius').classList.add('err'); valid=false;
  }
  if(!valid){ showToast('⚠️ Please fix the highlighted fields'); return; }

  const updates={name,phone,skill};
  if(experience) updates.experience=experience;
  if(area) updates.area=area;
  if(radius!=null) updates.radius=radius;

  const {error}=await sb.from('workers').update(updates).eq('id',W.id);
  if(error){
    console.error('saveProfile:',error.message);
    showToast('⚠️ Could not save profile: '+error.message);
    return;
  }

  /* Merge into W and persist to sessionStorage */
  W={...W,...updates};
  sessionStorage.setItem('qf_user',JSON.stringify(W));

  cancelEdit();
  renderAll();
  showToast('✅ Profile updated successfully');
}

/* ════════════════════════════════════════════════════════════
   MISC HELPERS
   ════════════════════════════════════════════════════════════ */
/* Thin wrapper kept so every existing fmtDate(...) call site in this
   file needs no changes, while the actual logic now lives once in
   js/common/utils.js as _fmtDate — same guarded behavior, byte for
   byte. escHtml now comes directly from js/common/utils.js. */
function fmtDate(d){ return _fmtDate(d); }

async function logout(){
  await sb.auth.signOut();
  sessionStorage.removeItem('qf_user');
  sessionStorage.removeItem('qf_role');
  sessionStorage.removeItem('qf_bookings_cache');
  window.location.href='auth.html';
}

/* showToast now comes from js/common/utils.js, loaded before this file. */

/* Remove err on focus */
['eName','ePhone','eSkill','eRadius'].forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.addEventListener('focus',()=>el.classList.remove('err'));
});