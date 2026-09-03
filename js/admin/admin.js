/* ===== QuickFix Admin Script — extracted from admin.html (Phase 5.2) ===== */

/* sb now comes from js/common/supabase.js, loaded before this file. */

let _allCampaigns = [];
let _allPasses = [];
let _allReviews = [];
let _allWorkerBans = [];
let _editingId = null;

/* ── AUTH GATE ─────────────────────────────────────────────── */
/* Phase 5.9 hotfix: calling getSession() the instant this script runs
   could race the Supabase client's own session rehydration on a hard
   refresh — getSession() resolved with the persisted session from
   localStorage a moment before that session's auth header was actually
   attached to outgoing REST calls. The very next request (the `admins`
   SELECT in checkAdminRole, gated by "email = auth.email()" under RLS)
   then ran as anonymous, matched 0 rows, and got treated as "not an
   admin" — signing a valid admin out and triggering the 10s
   ADMIN_ACCESS_DENIED_RETRY_MS cooldown on every single refresh.
   onAuthStateChange's first event (INITIAL_SESSION) fires only once the
   client has fully finished rehydrating from storage, so gating
   checkAdminRole on that instead removes the race. */
sb.auth.onAuthStateChange((event, session)=>{
  if(event !== 'INITIAL_SESSION') return;
  if(!session?.user){ showLoginForm(); return; }
  checkAdminRole(session.user.email);
});

function showLoginForm(){
  document.getElementById('gate').style.display = 'grid';
  document.getElementById('gateMsg').textContent = 'Sign in with an admin account.';
  document.getElementById('gateLoginForm').style.display = 'block';
}

async function checkAdminRole(email){
  const {data:a, error} = await sb.from('admins').select('is_active').eq('email', email).maybeSingle();
  if(error || !a || a.is_active !== true){
    await sb.auth.signOut();
    denyAccess();
    return;
  }
  document.getElementById('gate').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  initAdminApp();
}
    
function denyAccess(){
  document.getElementById('gate').style.display = 'grid';
  document.getElementById('gateLoginForm').style.display = 'none';
  document.getElementById('gateErr').textContent = '';
  document.getElementById('gateMsg').textContent = '🚫 Access Denied — this account is not an authorized admin.';
  /* Phase 5.6.1: was a hardcoded 10000 — now CONSTANTS.ADMIN_ACCESS_DENIED_RETRY_MS */
  setTimeout(()=>{
    document.getElementById('gateMsg').textContent = 'Sign in with an admin account.';
    document.getElementById('gateLoginForm').style.display = 'block';
  }, CONSTANTS.ADMIN_ACCESS_DENIED_RETRY_MS);
}

async function adminLogin(){
  const email = document.getElementById('gateEmail').value.trim();
  const pw = document.getElementById('gatePw').value;
  const errEl = document.getElementById('gateErr');
  errEl.textContent = '';
  if(!email || !pw){ errEl.textContent = 'Enter email and password.'; return; }

  const {data, error} = await sb.auth.signInWithPassword({email, password:pw});
  if(error || !data?.user){ denyAccess(); return; }
  await checkAdminRole(data.user.email);
}

async function adminLogout(){
  await sb.auth.signOut();
  window.location.reload();
}

/* ── APP INIT ──────────────────────────────────────────────── */
async function initAdminApp(){
  await Promise.all([loadCampaigns(), loadPasses(), loadReviews(), loadBannedWorkers(), loadUsers(), loadWorkersFull(), loadDisputes()]);
  renderCampaignsTable();
  renderPassesTable();
  renderReviewsTable();
  renderBannedWorkersTable();
  renderUsersTable();
  renderWorkersTable();
  renderDisputesTable();
  renderAnalytics();

  setInterval(async ()=>{
    await Promise.all([loadCampaigns(), loadPasses(), loadReviews(), loadBannedWorkers(), loadUsers(), loadWorkersFull()]);
    renderCampaignsTable();
    renderPassesTable();
    renderReviewsTable();
    renderBannedWorkersTable();
    renderUsersTable();
    renderWorkersTable();
    renderAnalytics();
  }, CONSTANTS.ADMIN_DASHBOARD_POLL_INTERVAL_MS);

  /* Realtime: a new review should appear on the admin panel the moment
     it's submitted, not on the next 15s poll tick. INSERT is the only
     event that matters here — reviews are never edited/deleted by a
     customer after submission. */
  sb.channel('admin-reviews')
    .on(
      'postgres_changes',
      { event:'INSERT', schema:'public', table:'reviews' },
      async ()=>{
        await loadReviews();
        renderReviewsTable();
      }
    )
    .subscribe();

  /* Realtime: users/workers tables can change from anywhere — a
     customer signing up, a worker completing a job (streak/bonus/
     stats), or a direct SQL reset/truncate done outside the app
     entirely. '*' (all events: INSERT/UPDATE/DELETE) keeps the Users
     and Workers tabs, and everything derived from workers.banned_until
     (Reviews tab's ban column, Banned Workers tab), in sync without
     needing a manual refresh. */
  sb.channel('admin-users')
    .on(
      'postgres_changes',
      { event:'*', schema:'public', table:'users' },
      async ()=>{
        await loadUsers();
        renderUsersTable();
      }
    )
    .subscribe();

  sb.channel('admin-workers')
    .on(
      'postgres_changes',
      { event:'*', schema:'public', table:'workers' },
      async ()=>{
        await loadWorkersFull();
        renderWorkersTable();
        await loadReviews();
        renderReviewsTable();
        await loadBannedWorkers();
        renderBannedWorkersTable();
      }
    )
    .subscribe();

  sb.channel('admin-disputes')
    .on(
      'postgres_changes',
      { event:'INSERT', schema:'public', table:'disputes' },
      async (payload)=>{
        console.log('DEBUG admin-disputes INSERT received:', payload);
        await loadDisputes();
        renderDisputesTable();
      }
    )
    .subscribe((status)=>{
      console.log('DEBUG admin-disputes channel status:', status);
    });
}

/* ── DISPUTES ─────────────────────────────────────────────── */
let _allDisputes = [];
const DISPUTE_REASON_LABELS = {
  poor_quality:'Poor quality of work', incomplete:'Job left incomplete',
  damage:'Property damage', overcharge:'Overcharged',
  behavior:'Worker behavior', other:'Other'
};

async function loadDisputes(){
  const {data, error} = await sb.from('disputes').select('*').order('created_at',{ascending:false});
  if(error){ console.error('loadDisputes:', error.message); _allDisputes = []; return; }
  _allDisputes = data || [];
}

async function renderDisputesTable(){
  const body = document.getElementById('disputesBody');
  const empty = document.getElementById('disputesEmpty');
  if(!_allDisputes.length){ body.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display = 'none';

  const userIds = [...new Set(_allDisputes.map(d=>d.user_id).filter(Boolean))];
  const workerIds = [...new Set(_allDisputes.map(d=>d.worker_id).filter(Boolean))];
  const [{data:userRows}, {data:workerRows}] = await Promise.all([
    sb.from('users').select('id,name').in('id', userIds.length?userIds:['00000000-0000-0000-0000-000000000000']),
    sb.from('workers').select('id,name').in('id', workerIds.length?workerIds:['00000000-0000-0000-0000-000000000000'])
  ]);
  const userById={}; (userRows||[]).forEach(u=>{ userById[u.id]=u.name; });
  const workerById={}; (workerRows||[]).forEach(w=>{ workerById[w.id]=w.name; });

  body.innerHTML = _allDisputes.map(d=>{
    const statusBadgeCls = d.status==='open' ? 'badge-inactive' : d.status==='resolved' ? 'badge-active' : 'badge-rejected';
    const actions = d.status==='open'
      ? `<div class="actionrow">
           <button class="btn bt bs" onclick="resolveDispute('${d.id}','resolved')">✅ Resolve</button>
           <button class="btn bd bs" onclick="resolveDispute('${d.id}','dismissed')">✖ Dismiss</button>
         </div>`
      : `<span class="badge ${statusBadgeCls}">${d.status.toUpperCase()}</span>`;
    return `
    <tr>
      <td>${userById[d.user_id] || '—'}</td>
      <td>${workerById[d.worker_id] || '—'}</td>
      <td>${DISPUTE_REASON_LABELS[d.reason] || d.reason}</td>
      <td style="max-width:260px;white-space:normal">${d.description || '—'}</td>
      <td><span class="badge ${statusBadgeCls}">${d.status.toUpperCase()}</span></td>
      <td>${_fmtDate(d.created_at)}</td>
      <td>${actions}</td>
    </tr>`;
  }).join('');
}

async function resolveDispute(disputeId, newStatus){
  const {error} = await sb.from('disputes').update({
    status: newStatus,
    resolved_at: new Date().toISOString()
  }).eq('id', disputeId);
  if(error){ alert('Failed to update dispute: '+error.message); return; }

  const isResolve = newStatus === 'resolved';
  _renderVerifyResultIcon(isResolve);
  document.getElementById('verifyResultTitle').textContent = isResolve ? 'Dispute Resolved' : 'Dispute Dismissed';
  document.getElementById('verifyResultMsg').textContent = isResolve
    ? 'This dispute has been marked as resolved.'
    : 'This dispute has been dismissed.';
  document.getElementById('workerVerifyResultModal').classList.add('on');

  await loadDisputes();
  renderDisputesTable();
}

/* ── USERS TAB ─────────────────────────────────────────────── */
let _allUsers = [];
async function loadUsers(){
  const {data, error} = await sb.from('users').select('*').order('created_at', {ascending:false});
  if(error){ console.error('loadUsers:', error.message); _allUsers = []; return; }
  _allUsers = data || [];
}
function renderUsersTable(){
  const body = document.getElementById('usersBody');
  const empty = document.getElementById('usersEmpty');
  if(!_allUsers.length){ body.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display = 'none';
  body.innerHTML = _allUsers.map(u=>`
    <tr>
      <td>${u.name || '—'}</td>
      <td>${u.email || '—'}</td>
      <td>${u.phone || '—'}</td>
      <td style="max-width:220px;white-space:normal">${u.saved_address || '—'}</td>
      <td>${u.quickcoins_balance ?? 0} 🪙</td>
      <td>${u.total_completed_bookings ?? 0}</td>
      <td>${_fmtDate(u.created_at)}</td>
    </tr>`).join('');
}

/* ── WORKERS TAB ───────────────────────────────────────────── */
let _allWorkersFull = [];
async function loadWorkersFull(){
  /* workers table has no created_at column — order by name instead */
  const {data, error} = await sb.from('workers').select('*').order('name', {ascending:true});
  if(error){ console.error('loadWorkersFull:', error.message); _allWorkersFull = []; return; }
  _allWorkersFull = data || [];
}
/* Profile photos live in a public bucket (worker-photos) — the stored
   public URL just works. */
function openAdminImgView(url){
  if(!url){ alert('No image uploaded.'); return; }
  document.getElementById('adminImgViewSrc').src = url;
  document.getElementById('adminImgViewModal').classList.add('on');
}

/* Government ID documents live in a PRIVATE bucket (worker-documents —
   see auth.js's Phase 6.6 comment on storage RLS). A stored public URL
   for a private bucket doesn't actually resolve, which is why it shows
   as a broken image. Generate a short-lived signed URL on demand
   instead, using the stored filename. */
async function openAdminDocView(documentName){
  if(!documentName){ alert('No document uploaded.'); return; }
  const {data, error} = await sb.storage.from('worker-documents').createSignedUrl(documentName, 300); /* 5 min */
  if(error || !data?.signedUrl){
    alert('Could not load document: '+(error?.message||'unknown error'));
    return;
  }
  document.getElementById('adminImgViewSrc').src = data.signedUrl;
  document.getElementById('adminImgViewModal').classList.add('on');
}
function renderWorkersTable(){
  const body = document.getElementById('workersBody');
  const empty = document.getElementById('workersEmpty');
  if(!_allWorkersFull.length){ body.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display = 'none';

  const statusBadge = {
    pending:  'badge-inactive',
    approved: 'badge-active',
    rejected: 'badge-rejected'
  };

  body.innerHTML = _allWorkersFull.map(w=>{
    const status = w.verification_status || 'pending';
    const docBtn = w.document_name
      ? `<button class="btn bo bs" onclick="openAdminDocView('${w.document_name}')">📄 View</button>`
      : '—';
    const photoBtn = w.profile_photo_url
      ? `<button class="btn bo bs" onclick="openAdminImgView('${w.profile_photo_url}')">🙂 View</button>`
      : '—';
    return `
    <tr>
      <td>${w.name || '—'}</td>
      <td>${w.skill || '—'}</td>
      <td>${w.phone || '—'}</td>
      <td>${w.area || '—'}</td>
      <td>${w.radius!=null ? w.radius+' km' : '—'}</td>
      <td>${Number(w.rating||0).toFixed(1)}★</td>
      <td>🔥 ${w.positive_streak ?? 0}</td>
      <td>₹${Number(w.bonus_balance ?? 0).toLocaleString('en-IN')}</td>
      <td>${docBtn}</td>
      <td>${photoBtn}</td>
      <td><span class="badge ${statusBadge[status]||'badge-inactive'}">${status.toUpperCase()}</span></td>
      <td>
        ${status === 'approved'
          ? '—'
          : `<div class="verify-actions-row">
               <button class="verify-pill verify-pill-approve" onclick="setWorkerVerification('${w.id}','approved')">✅ Approve</button>
               <button class="verify-pill verify-pill-reject" onclick="setWorkerVerification('${w.id}','rejected')">❌ Reject</button>
             </div>`}
      </td>
    </tr>`;
  }).join('');
}

/* Renders the tick (approve) or cross (reject) SVG fresh into the
   result modal each time, so the draw animation replays — same
   principle as the ban tick/cross, but built inline here since the
   icon shape differs per action rather than being fixed per modal. */
function _renderVerifyResultIcon(isApprove){
  const wrap = document.querySelector('#workerVerifyResultModal .verify-result-wrap');
  if(!wrap) return;
  wrap.innerHTML = isApprove
    ? `<svg class="verify-result-svg verify-result-approve" viewBox="0 0 52 52">
         <circle class="verify-result-circle" cx="26" cy="26" r="24" fill="none"/>
         <path class="verify-result-mark" d="M14 27l7 7 16-16"/>
       </svg>`
    : `<svg class="verify-result-svg verify-result-reject" viewBox="0 0 52 52">
         <circle class="verify-result-circle" cx="26" cy="26" r="24" fill="none"/>
         <path class="verify-result-mark verify-result-mark-1" d="M17 17l18 18"/>
         <path class="verify-result-mark verify-result-mark-2" d="M35 17l-18 18"/>
       </svg>`;
}

async function setWorkerVerification(workerId, status){
  const {error} = await sb.from('workers').update({verification_status: status}).eq('id', workerId);
  if(error){ alert('Failed to update verification: '+error.message); return; }

  const isApprove = status === 'approved';
  _renderVerifyResultIcon(isApprove);
  document.getElementById('verifyResultTitle').textContent = isApprove ? 'Worker Approved' : 'Worker Rejected';
  document.getElementById('verifyResultMsg').textContent = isApprove
    ? 'This worker has been verified and approved.'
    : 'This worker has been marked as rejected.';
  document.getElementById('workerVerifyResultModal').classList.add('on');

  await loadWorkersFull();
  renderWorkersTable();
}

function switchAdminTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on', t.dataset.tab===name));
  document.querySelectorAll('.tabpane').forEach(p=>p.classList.toggle('on', p.id==='tab-'+name));
}

/* ── PART 3: LOAD + DISPLAY CAMPAIGNS ─────────────────────────
   Reads every campaign, active or not — the customer-facing pages
   already filter to active/in-window ones themselves; the admin
   needs to see everything to manage it. */
async function loadCampaigns(){
  const {data, error} = await sb.from('campaigns').select('*').order('created_at', {ascending:false});
  if(error){ console.error('loadCampaigns:', error.message); _allCampaigns = []; return; }
  _allCampaigns = data || [];

  const svcSel = document.getElementById('fService');
  const services = [...new Set(_allCampaigns.map(c=>c.service).filter(Boolean))];
  svcSel.innerHTML = '<option value="">All Services</option>' + services.map(s=>`<option value="${s}">${s}</option>`).join('');

  const prSel = document.getElementById('fPriority');
  const priorities = [...new Set(_allCampaigns.map(c=>c.priority))].sort((a,b)=>a-b);
  prSel.innerHTML = '<option value="">All Priorities</option>' + priorities.map(p=>`<option value="${p}">${p}</option>`).join('');
}

/* _fmtDate now comes from js/common/utils.js, loaded before this file. */
function _fmtDateTime(d){ return d ? new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'; }

function renderCampaignsTable(){
  const search = document.getElementById('fSearch').value.trim().toLowerCase();
  const svc = document.getElementById('fService').value;
  const status = document.getElementById('fStatus').value;
  const pr = document.getElementById('fPriority').value;

  const rows = _allCampaigns.filter(c=>{
    if(search && !String(c.title||'').toLowerCase().includes(search)) return false;
    if(svc && c.service !== svc) return false;
    if(status && c.status !== status) return false;
    if(pr && String(c.priority) !== pr) return false;
    return true;
  });

  const body = document.getElementById('campaignsBody');
  const empty = document.getElementById('campaignsEmpty');

  if(!rows.length){ body.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display = 'none';

  const methodLabel = { gpay:'📱 GPay', coins:'🪙 Coins' };
  body.innerHTML = rows.map(c => `
    <tr>
      <td><strong>${c.title||''}</strong></td>
      <td>${c.service||''}</td>
      <td>${methodLabel[c.purchase_method]||'📱 GPay'}</td>
      <td>${c.purchase_method==='coins' ? `${c.coin_price} 🪙` : `₹${c.price ?? 0}`}</td>
      <td>${c.number_of_visits ?? 1}</td>
      <td>${c.validity_days ?? '—'} days</td>
      <td>${_fmtDateTime(c.offer_start_date)}</td>
      <td>${_fmtDateTime(c.offer_end_date)}</td>
      <td>${c.priority ?? 1}</td>
      <td><span class="badge badge-${c.status==='active'?'active':'inactive'}">${(c.status||'').toUpperCase()}</span></td>
      <td>${_fmtDate(c.created_at)}</td>
      <td>
        <div class="actionrow">
          <button class="btn bo bs" onclick="openCampaignForm('${c.id}')">Edit</button>
          <button class="btn ${c.status==='active'?'bd':'bt'} bs" onclick="toggleCampaignStatus('${c.id}','${c.status}')">${c.status==='active'?'Deactivate':'Activate'}</button>
          <button class="btn bd bs" onclick="deleteCampaign('${c.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ── PART 4/5/6: CREATE + EDIT MODAL ─────────────────────────
   Same popup for both — pre-filled when editing, blank when creating,
   matching the spec exactly. */
function openCampaignForm(id){
  document.getElementById('cfErr').textContent = '';
  _editingId = id || null;

  if(id){
    const c = _allCampaigns.find(x => String(x.id) === String(id));
    if(!c) return;
    document.getElementById('campaignModalTitle').textContent = 'Edit Campaign';
    document.getElementById('cfId').value = c.id;
    document.getElementById('cfTitle').value = c.title || '';
    document.getElementById('cfService').value = c.service || 'Electrician';
    document.getElementById('cfDescription').value = c.description || '';
    document.getElementById('cfPrice').value = c.price ?? '';
    document.getElementById('cfVisits').value = c.number_of_visits ?? 1;
    document.getElementById('cfPurchaseMethod').value = c.purchase_method || 'gpay';
    document.getElementById('cfCoinPrice').value = c.coin_price ?? '';
    toggleCoinPriceField();
    document.getElementById('cfValidity').value = c.validity_days ?? 30;
    document.getElementById('cfPriority').value = c.priority ?? 1;
    document.getElementById('cfStart').value = c.offer_start_date ? c.offer_start_date.slice(0,16) : '';
    document.getElementById('cfEnd').value = c.offer_end_date ? c.offer_end_date.slice(0,16) : '';
    document.getElementById('cfEmergency').checked = !!c.emergency_included;
    document.getElementById('cfPriorityBooking').checked = !!c.priority_booking;
    document.getElementById('cfStatus').value = c.status || 'active';
  } else {
    document.getElementById('campaignModalTitle').textContent = 'Create Campaign';
    document.getElementById('cfId').value = '';
    ['cfTitle','cfDescription'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('cfService').value = 'Electrician';
    document.getElementById('cfPrice').value = '';
    document.getElementById('cfVisits').value = 1;
    document.getElementById('cfPurchaseMethod').value = 'gpay';
    document.getElementById('cfCoinPrice').value = '';
    toggleCoinPriceField();
    document.getElementById('cfValidity').value = 30;
    document.getElementById('cfPriority').value = 1;
    document.getElementById('cfStart').value = '';
    document.getElementById('cfEnd').value = '';
    document.getElementById('cfEmergency').checked = false;
    document.getElementById('cfPriorityBooking').checked = false;
    document.getElementById('cfStatus').value = 'active';
  }
  document.getElementById('campaignModal').classList.add('on');
}

function closeCampaignForm(){
  document.getElementById('campaignModal').classList.remove('on');
  _editingId = null;
}

function toggleCoinPriceField(){
  const method = document.getElementById('cfPurchaseMethod').value;
  const isCoins = method === 'coins';
  document.getElementById('cfCoinPriceGrp').style.display = isCoins ? '' : 'none';
  /* Coins-only campaigns have no ₹ price at all — hide the field
     entirely rather than leaving a meaningless number sitting there. */
  document.getElementById('cfPrice').closest('.fg').style.display = isCoins ? 'none' : '';
}

/* ── PART 5/6: PUBLISH (insert) or SAVE (update) ─────────────
   NOTE: Campaign duration (offer_start_date/offer_end_date) only
   controls customer-facing VISIBILITY, per the business rule in the
   spec. It is never written to user_passes, and never touches an
   already-purchased pass's own expiry_date — editing or deactivating
   a campaign here cannot invalidate a pass someone already bought,
   because this form never writes to user_passes at all. */
async function publishCampaign(){
  const errEl = document.getElementById('cfErr');
  errEl.textContent = '';

  const title = document.getElementById('cfTitle').value.trim();
  const service = document.getElementById('cfService').value;
  const price = Number(document.getElementById('cfPrice').value);
  const visits = parseInt(document.getElementById('cfVisits').value);
  const validity = parseInt(document.getElementById('cfValidity').value);
  const priority = parseInt(document.getElementById('cfPriority').value) || 1;
  const start = document.getElementById('cfStart').value;
  const end = document.getElementById('cfEnd').value;
  const purchaseMethod = document.getElementById('cfPurchaseMethod').value;
  const coinPrice = parseInt(document.getElementById('cfCoinPrice').value) || 0;

  if(!title){ errEl.textContent = 'Campaign title is required.'; return; }
  if(!service){ errEl.textContent = 'Service is required.'; return; }
  if(purchaseMethod === 'gpay' && (isNaN(price) || price < 0)){ errEl.textContent = 'Enter a valid price.'; return; }
  if(!visits || visits < 1){ errEl.textContent = 'Number of visits must be at least 1.'; return; }
  if(!validity || validity < 1){ errEl.textContent = 'Pass validity must be at least 1 day.'; return; }
  if(!start || !end){ errEl.textContent = 'Campaign start and end dates are required.'; return; }
  if(new Date(end) <= new Date(start)){ errEl.textContent = 'Campaign end must be after campaign start.'; return; }
  if(purchaseMethod === 'coins' && coinPrice < 1){ errEl.textContent = 'Enter a valid QuickCoins price.'; return; }

  const payload = {
    title, service,
    description: document.getElementById('cfDescription').value.trim() || null,
    price: purchaseMethod === 'coins' ? 0 : price,
    number_of_visits: visits, validity_days: validity,
    emergency_included: document.getElementById('cfEmergency').checked,
    priority_booking: document.getElementById('cfPriorityBooking').checked,
    offer_start_date: new Date(start).toISOString(),
    offer_end_date: new Date(end).toISOString(),
    priority,
    status: document.getElementById('cfStatus').value,
    purchase_method: purchaseMethod,
    coin_price: purchaseMethod === 'coins' ? coinPrice : 0
  };

  const btn = document.getElementById('cfPublishBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  let error;
  if(_editingId){
    ({error} = await sb.from('campaigns').update(payload).eq('id', _editingId));
  } else {
    ({error} = await sb.from('campaigns').insert(payload));
  }

  btn.disabled = false; btn.textContent = 'Publish Campaign';

  if(error){ errEl.textContent = 'Save failed: ' + error.message; return; }

  closeCampaignForm();
  await loadCampaigns();
  renderCampaignsTable();
  renderAnalytics();
}

/* ── PART 7: ACTIVATE / DEACTIVATE ────────────────────────── */
async function toggleCampaignStatus(id, currentStatus){
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  const {error} = await sb.from('campaigns').update({status:newStatus}).eq('id', id);
  if(error){ alert('Failed to update status: ' + error.message); return; }
  await loadCampaigns();
  renderCampaignsTable();
  renderAnalytics();
}

/* ── PART 8: DELETE ───────────────────────────────────────── */
async function deleteCampaign(id){
  const c = _allCampaigns.find(x => String(x.id) === String(id));
  if(!confirm(`Permanently delete "${c?.title || 'this campaign'}"? This cannot be undone.`)) return;

  const {error} = await sb.from('campaigns').delete().eq('id', id);
  if(error){ alert('Delete failed: ' + error.message); return; }
  await loadCampaigns();
  renderCampaignsTable();
  renderAnalytics();
}

/* ── PART 9: USER PASSES ──────────────────────────────────────
   Joins user_passes -> users (name, best-effort email) and
   user_passes -> campaigns (title) client-side, since we can't
   assume a Postgres FK-embed relationship exists. */
async function loadPasses(){
  const {data, error} = await sb.from('user_passes').select('*').order('purchase_date', {ascending:false});
  if(error){ console.error('loadPasses:', error.message); _allPasses = []; return; }
  _allPasses = data || [];
}

async function renderPassesTable(){
  const body = document.getElementById('passesBody');
  const empty = document.getElementById('passesEmpty');

  if(!_allPasses.length){ body.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display = 'none';

  const userIds = [...new Set(_allPasses.map(p=>p.user_id))];
  const campaignIds = [...new Set(_allPasses.map(p=>p.campaign_id))];

  const [{data:userRows}, {data:campaignRows}] = await Promise.all([
    sb.from('users').select('id,name,email').in('id', userIds),
    sb.from('campaigns').select('id,title').in('id', campaignIds)
  ]);

  const userById = {};
  (userRows||[]).forEach(u=>{ userById[u.id] = u; });
  const titleById = {};
  (campaignRows||[]).forEach(c=>{ titleById[c.id] = c.title; });

  const now = Date.now();
  body.innerHTML = _allPasses.map(p=>{
    const u = userById[p.user_id] || {};
    const expired = p.status === 'active' && new Date(p.expiry_date).getTime() < now;
    const statusClass = expired ? 'expired' : (p.status==='active' ? 'active' : 'inactive');
    const statusLabel = expired ? 'EXPIRED' : String(p.status||'').toUpperCase();
    return `
    <tr>
      <td>${u.name || '—'}</td>
      <td>${u.email || '—'}</td>
      <td>${titleById[p.campaign_id] || '—'}</td>
      <td>${_fmtDate(p.purchase_date)}</td>
      <td>${_fmtDate(p.expiry_date)}</td>
      <td>${p.visits_remaining} / ${p.total_visits}</td>
      <td><span class="badge badge-${statusClass}">${statusLabel}</span></td>
    </tr>`;
  }).join('');
}

/* ── PART 11: REVIEWS ─────────────────────────────────────────
   Admin-only visibility, enforced at the database level (reviews
   RLS only grants SELECT to the reviewing customer or an admin —
   workers have no table access and only ever see aggregated
   positive-tag counts via get_worker_positive_tags()). Full rating,
   all tags, and the free-text comment are shown here regardless of
   tag type — nothing is filtered client-side. */
const REVIEW_TAG_LABELS = {
  well_mannered:'Well-mannered', punctual:'Punctual', professional:'Professional',
  well_spoken:'Well-spoken', skilled:'Skilled work', clean_work:'Clean & tidy',
  good_value:'Good value', friendly:'Friendly',
  late:'Late', rude:'Rude', unprofessional:'Unprofessional',
  poor_quality:'Poor quality work', overcharged:'Overcharged', untidy:'Left a mess',
  other:'Other'
};

async function loadReviews(){
  const {data, error} = await sb.from('reviews').select('*').order('created_at', {ascending:false});
  if(error){ console.error('loadReviews:', error.message); _allReviews = []; return; }
  _allReviews = data || [];
}

/* Full ban history — every ban ever applied, not just the current one.
   Powers the Banned Workers tab (worker, total ban count, every past
   duration + window) independent of what's currently active. */
async function loadBannedWorkers(){
  const {data, error} = await sb.from('worker_bans').select('*').order('banned_at', {ascending:false});
  if(error){ console.error('loadBannedWorkers:', error.message); _allWorkerBans = []; return; }
  _allWorkerBans = data || [];
}

async function renderBannedWorkersTable(){
  const body = document.getElementById('bannedWorkersBody');
  const empty = document.getElementById('bannedWorkersEmpty');

  if(!_allWorkerBans.length){ body.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display = 'none';

  const workerIds = [...new Set(_allWorkerBans.map(b=>b.worker_id))];
  const {data:workerRows} = await sb.from('workers').select('id,name,banned_until').in('id', workerIds.length?workerIds:['00000000-0000-0000-0000-000000000000']);
  const workerById = {};
  (workerRows||[]).forEach(w=>{ workerById[w.id]=w; });

  const grouped = {};
  _allWorkerBans.forEach(b=>{
    if(!grouped[b.worker_id]) grouped[b.worker_id] = [];
    grouped[b.worker_id].push(b);
  });

  const now = Date.now();
  body.innerHTML = Object.keys(grouped).map(workerId=>{
    const w = workerById[workerId] || {};
    const bans = grouped[workerId];
    const isBanned = w.banned_until && new Date(w.banned_until).getTime() > now;
    const historyHtml = bans.map(b=>
      `<div style="font-size:.76rem;margin-bottom:3px">${b.duration_label} — banned ${_fmtDateTime(b.banned_at)}, until ${_fmtDateTime(b.banned_until)}</div>`
    ).join('');
    return `
    <tr>
      <td>${w.name || '—'}</td>
      <td>${bans.length}</td>
      <td style="max-width:340px">${historyHtml}</td>
      <td>${isBanned ? `<span class="badge badge-inactive">🚫 Banned until ${_fmtDateTime(w.banned_until)}</span>` : `<span class="badge badge-active">Active</span>`}</td>
    </tr>`;
  }).join('');
}

/* Resolves each review's booking -> service name, keyed by booking_id,
   so renderReviewsTable() can show what the worker was actually hired
   for (e.g. "Fan", "CCTV") alongside their general skill/role. */
async function _getServiceNamesByBookingId(bookingIds){
  if(!bookingIds.length) return {};
  const {data, error} = await sb.from('bookings').select('id,service').in('id', bookingIds);
  if(error){ console.error('_getServiceNamesByBookingId:', error.message); return {}; }
  const map = {};
  (data||[]).forEach(b=>{ map[b.id] = b.service; });
  return map;
}

async function renderReviewsTable(){
  const body = document.getElementById('reviewsBody');
  const empty = document.getElementById('reviewsEmpty');
  const thead = document.querySelector('#tab-reviews table thead tr');

  if(!_allReviews.length){ body.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display = 'none';

  const userIds = [...new Set(_allReviews.map(r=>r.user_id).filter(Boolean))];
  const workerIds = [...new Set(_allReviews.map(r=>r.worker_id).filter(Boolean))];
  const bookingIds = [...new Set(_allReviews.map(r=>r.booking_id).filter(Boolean))];

  const [{data:userRows}, {data:workerRows}, serviceByBookingId] = await Promise.all([
    sb.from('users').select('id,name,email').in('id', userIds.length?userIds:['00000000-0000-0000-0000-000000000000']),
    sb.from('workers').select('id,name,skill,banned_until,last_ban_duration_label').in('id', workerIds.length?workerIds:['00000000-0000-0000-0000-000000000000']),
    _getServiceNamesByBookingId(bookingIds)
  ]);

  const userById = {};
  (userRows||[]).forEach(u=>{ userById[u.id] = u; });
  const workerNameById = {};
  const workerSkillById = {};
  const workerBannedUntilById = {};
  const workerLastBanLabelById = {};
  (workerRows||[]).forEach(w=>{
    workerNameById[w.id] = w.name;
    workerSkillById[w.id] = w.skill;
    workerBannedUntilById[w.id] = w.banned_until;
    workerLastBanLabelById[w.id] = w.last_ban_duration_label;
  });

  const now = new Date();
  /* Ban Duration / Unban Time columns only appear at all when at least
     one worker in this list is currently banned — otherwise they're
     removed from the table entirely (header + cells), rather than
     showing a column of nothing but dashes. */
  const anyBanned = (workerRows||[]).some(w => w.banned_until && new Date(w.banned_until) > now);

  if(thead){
    const existingBanCols = thead.querySelectorAll('.col-ban-duration,.col-ban-until');
    existingBanCols.forEach(el=>el.remove());
    if(anyBanned){
      const actionsTh = thead.lastElementChild; /* "Actions" column */
      const durTh = document.createElement('th');
      durTh.className = 'col-ban-duration';
      durTh.textContent = 'Ban Duration';
      const untilTh = document.createElement('th');
      untilTh.className = 'col-ban-until';
      untilTh.textContent = 'Unban Time';
      thead.insertBefore(durTh, actionsTh);
      thead.insertBefore(untilTh, actionsTh);
    }
  }

  const NEGATIVE_REVIEW_TAG_IDS = ['late','rude','unprofessional','poor_quality','overcharged','untidy'];

  body.innerHTML = _allReviews.map(r=>{
    const u = userById[r.user_id] || {};
    const tagsHtml = (r.tags||[]).map(t=>`<span class="badge badge-inactive">${REVIEW_TAG_LABELS[t]||t}</span>`).join(' ');
    const bannedUntil = workerBannedUntilById[r.worker_id];
    const isBanned = bannedUntil && new Date(bannedUntil) > now;
    const hasNegativeTag = (r.tags||[]).some(t=>NEGATIVE_REVIEW_TAG_IDS.includes(t));
    const isHighRating = Number(r.rating||0) >= 4;
    /* Ban action only makes sense on a review that actually flagged a
       problem — a good review (no negative tags, OR a 4-5 star
       rating) never shows a Ban button at all, regardless of the
       worker's current ban status. A high rating overrides even if a
       negative tag was somehow also selected alongside it. */
    const banBtn = !r.worker_id
      ? '—'
      : isBanned
        ? `<span class="badge badge-inactive">🚫 Banned</span>`
        : (hasNegativeTag && !isHighRating)
          ? `<button class="btn bd bs" onclick="openBanModal('${r.worker_id}')">🚫 Ban</button>`
          : '—';
    const banColsHtml = anyBanned
      ? `<td>${isBanned ? (workerLastBanLabelById[r.worker_id]||'—') : '—'}</td><td>${isBanned ? _fmtDateTime(bannedUntil) : '—'}</td>`
      : '';
    return `
    <tr>
      <td>${u.name || '—'}<div style="font-size:.7rem;color:var(--text3)">${u.email || ''}</div></td>
      <td>${workerNameById[r.worker_id] || '—'}</td>
      <td>${workerSkillById[r.worker_id] || '—'}</td>
      <td>${serviceByBookingId[r.booking_id] || '—'}</td>
      <td>${'★'.repeat(r.rating||0)}${'☆'.repeat(5-(r.rating||0))}</td>
      <td style="max-width:220px">${tagsHtml || '—'}</td>
      <td style="max-width:260px;white-space:normal">${r.comment ? r.comment : '—'}</td>
      <td>${_fmtDate(r.created_at)}</td>
      ${banColsHtml}
      <td>${banBtn}</td>
    </tr>`;
  }).join('');
}

/* ── WORKER BAN ESCALATION ─────────────────────────────────────
   Suggested duration climbs with each prior ban: 5 hrs → 24 hrs →
   120 hrs (5 days), then stays at 120 hrs unless the admin manually
   overrides the hours field. Nothing here is automatic — the admin
   always confirms (and can change) the duration before it's applied. */
/* Suggested defaults per prior-ban count — expressed as {amount, unit}
   so the modal's number+unit fields can be prefilled directly. Admin
   can still change both the amount and unit freely before confirming. */
const BAN_ESCALATION_STEPS = [
  {amount:5,  unit:'hours'},
  {amount:1,  unit:'days'},
  {amount:5,  unit:'days'}
];
const BAN_UNIT_TO_MS = {
  minutes: 60*1000,
  hours:   60*60*1000,
  days:    24*60*60*1000,
  weeks:   7*24*60*60*1000
};
let _pendingBanWorkerId = null;

async function openBanModal(workerId){
  if(!workerId){ alert('No worker linked to this review.'); return; }
  _pendingBanWorkerId = workerId;

  const {data:w, error} = await sb.from('workers').select('id,name,ban_count,banned_until').eq('id',workerId).single();
  if(error || !w){ alert('Could not load worker: '+(error?.message||'not found')); return; }

  const banCount = w.ban_count || 0;
  const suggested = BAN_ESCALATION_STEPS[Math.min(banCount, BAN_ESCALATION_STEPS.length-1)];

  document.getElementById('banWorkerName').textContent = w.name || 'Worker';
  document.getElementById('banWorkerHistory').textContent = banCount>0
    ? `This worker has been banned ${banCount} time${banCount>1?'s':''} before.`
    : `This will be this worker's first ban.`;

  const statusEl = document.getElementById('banCurrentStatus');
  if(w.banned_until && new Date(w.banned_until) > new Date()){
    statusEl.textContent = `⚠️ Currently banned until ${_fmtDateTime(w.banned_until)}`;
    statusEl.style.display = '';
  } else {
    statusEl.style.display = 'none';
  }

  document.getElementById('banAmount').value = suggested.amount;
  document.getElementById('banUnit').value = suggested.unit;
  document.getElementById('banWorkerModal').classList.add('on');
}

function closeBanModal(){
  document.getElementById('banWorkerModal').classList.remove('on');
  _pendingBanWorkerId = null;
}

function _formatBanDurationLabel(amount, unit){
  const unitLabels = { minutes:'Minute', hours:'Hour', days:'Day', weeks:'Week' };
  const label = unitLabels[unit] || unit;
  return `${amount} ${label}${amount==1?'':'s'}`;
}

async function confirmBanWorker(){
  const amount = parseFloat(document.getElementById('banAmount').value);
  const unit = document.getElementById('banUnit').value;
  const unitMs = BAN_UNIT_TO_MS[unit];
  if(!_pendingBanWorkerId || isNaN(amount) || amount<=0 || !unitMs){
    alert('Enter a valid ban duration.');
    return;
  }

  const {data:w, error:fetchErr} = await sb.from('workers').select('ban_count').eq('id',_pendingBanWorkerId).single();
  if(fetchErr){ alert('Failed to read worker: '+fetchErr.message); return; }

  const durationLabel = _formatBanDurationLabel(amount, unit);
  const bannedAt = new Date().toISOString();
  const bannedUntil = new Date(Date.now() + amount*unitMs).toISOString();

  const {data:updatedRows, error} = await sb.from('workers').update({
    banned_until: bannedUntil,
    ban_count: (w?.ban_count||0) + 1,
    last_ban_duration_label: durationLabel,
    is_available: false
  }).eq('id', _pendingBanWorkerId).select();

  if(error){ alert('Failed to ban worker: '+error.message); return; }
  if(!updatedRows || !updatedRows.length){
    alert('⚠️ Ban was not applied — no row was updated. This usually means a permissions (RLS) issue. Please check admin update permissions on the workers table.');
    return;
  }

  /* Permanent history row — independent of workers.banned_until, which
     only ever reflects the current/latest ban. This is what powers the
     Banned Workers tab's full history list. */
  const {error:banHistErr} = await sb.from('worker_bans').insert({
    worker_id: _pendingBanWorkerId,
    duration_label: durationLabel,
    banned_at: bannedAt,
    banned_until: bannedUntil
  });
  if(banHistErr) console.error('worker_bans insert:', banHistErr.message);

  closeBanModal();
  document.getElementById('banSuccessMsg').textContent =
    'Worker banned until '+_fmtDateTime(bannedUntil)+'. If they are currently logged in, they will be signed out automatically.';
  _replayBanTickAnimation();
  document.getElementById('banSuccessModal').classList.add('on');
  await Promise.all([loadReviews(), loadBannedWorkers()]);
  renderReviewsTable();
  renderBannedWorkersTable();
}

/* Re-triggers the tick-draw CSS animation on every ban, since a CSS
   animation only plays once unless the element is re-inserted (or its
   animation is restarted via reflow). Cloning the SVG node forces the
   browser to treat it as fresh, so it replays each time this modal opens. */
function _replayBanTickAnimation(){
  const wrap = document.querySelector('.ban-success-tick-wrap');
  if(!wrap) return;
  const oldSvg = wrap.querySelector('.ban-success-tick-svg');
  if(!oldSvg) return;
  const newSvg = oldSvg.cloneNode(true);
  wrap.replaceChild(newSvg, oldSvg);
}

/* ── PART 10: ANALYTICS ────────────────────────────────────── */
function renderAnalytics(){
  const overview = document.getElementById('analyticsOverview');
  const body = document.getElementById('analyticsBody');
  const empty = document.getElementById('analyticsEmpty');
  const now = Date.now();

  const totalPurchases = _allPasses.length;
  const activePasses = _allPasses.filter(p => p.status==='active' && new Date(p.expiry_date).getTime() >= now).length;
  const expiredPasses = _allPasses.filter(p => p.status!=='active' || new Date(p.expiry_date).getTime() < now).length;

  overview.innerHTML = `
    <div class="statcard"><div class="lb">Total Campaigns</div><div class="vl">${_allCampaigns.length}</div></div>
    <div class="statcard"><div class="lb">Total Passes Sold</div><div class="vl">${totalPurchases}</div></div>
    <div class="statcard"><div class="lb">Active Passes</div><div class="vl">${activePasses}</div></div>
    <div class="statcard"><div class="lb">Expired Passes</div><div class="vl">${expiredPasses}</div></div>
  `;

  if(!_allCampaigns.length){ body.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display = 'none';

  body.innerHTML = _allCampaigns.map(c=>{
    const passes = _allPasses.filter(p => String(p.campaign_id) === String(c.id));
    const active = passes.filter(p => p.status==='active' && new Date(p.expiry_date).getTime() >= now).length;
    const expired = passes.length - active;
    const revenue = passes.length * (Number(c.price)||0);
    return `
    <tr>
      <td><strong>${c.title}</strong></td>
      <td>${passes.length}</td>
      <td>${active}</td>
      <td>${expired}</td>
      <td>₹${revenue}</td>
    </tr>`;
  }).join('');
}

/* ── Admin nav hamburger (mobile/tablet only; desktop nav/logic unaffected) ── */
function toggleAdminNav(){
  const panel=document.getElementById('navActions');
  const overlay=document.getElementById('navOverlay');
  const hbg=document.getElementById('hbg');
  if(!panel||!overlay||!hbg)return;
  const opening=!panel.classList.contains('open');
  panel.classList.toggle('open',opening);
  overlay.classList.toggle('on',opening);
  hbg.classList.toggle('active',opening);
  hbg.setAttribute('aria-expanded',String(opening));
}
function closeAdminNav(){
  const panel=document.getElementById('navActions');
  const overlay=document.getElementById('navOverlay');
  const hbg=document.getElementById('hbg');
  if(!panel||!overlay||!hbg)return;
  panel.classList.remove('open');
  overlay.classList.remove('on');
  hbg.classList.remove('active');
  hbg.setAttribute('aria-expanded','false');
}
document.querySelectorAll('.navactions .btn').forEach(b=>b.addEventListener('click',closeAdminNav));
window.addEventListener('resize',()=>{ if(window.innerWidth>860) closeAdminNav(); });