/* ===== QuickFix Admin Script — extracted from admin.html (Phase 5.2) ===== */

/* sb now comes from js/common/supabase.js, loaded before this file. */

let _allCampaigns = [];
let _allPasses = [];
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
  await Promise.all([loadCampaigns(), loadPasses()]);
  renderCampaignsTable();
  renderPassesTable();
  renderAnalytics();

  /* Phase 5.9 hotfix: index.js/dashboard.js both poll on an interval so
     their views stay in sync with table changes made directly in
     Supabase. admin.js never had an equivalent poll — it only loaded
     data once here. Same pattern, applied for parity, so clearing/
     editing rows shows up on the admin panel without a manual refresh. */
  setInterval(async ()=>{
    await Promise.all([loadCampaigns(), loadPasses()]);
    renderCampaignsTable();
    renderPassesTable();
    renderAnalytics();
  }, CONSTANTS.ADMIN_DASHBOARD_POLL_INTERVAL_MS);
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