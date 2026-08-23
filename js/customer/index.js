/* ===== QuickFix Customer Script — extracted from index.html (Phase 5.2) ===== */

/* ── DATA LAYER ───────────────────────────────────────────── */
/* sb now comes from js/common/supabase.js, loaded before this file. */
/* Phase 5.3.3: GEOAPIFY_API_KEY now comes from js/common/config.js
   (CONFIG.GEOAPIFY_API_KEY), loaded before this file. Previously
   duplicated identically in worker-dashboard.html. */

/* Auth gate — index.html is for authenticated users only.
   getSession() is the single source of truth for whether this page is
   allowed to render. If a real session exists, qf_user/qf_role are
   populated from the actual authenticated user (queried from the `users`
   table — the real schema table, not the nonexistent `profiles`).
   If no session exists, there is no silent Guest fallback: the user is
   redirected to auth.html immediately, before any booking/worker UI runs,
   so an unauthenticated visitor can never reach a state where DB.save()
   falls through to the localStorage fallback path. */
/* Phase 5.9 hotfix: DB.bookings()/DB.save()/etc. each used to call
   sb.auth.getSession() fresh, independently of this gate. Fixing the
   gate's own race (INITIAL_SESSION) didn't fix theirs — clicking "My
   Bookings" (or the poll timer firing) in that same narrow post-login
   window could still hit an independent getSession() call before the
   client had fully synced, making real Supabase rows look empty. This
   one shared variable, updated only by onAuthStateChange, becomes the
   single source every DB.* function trusts instead of querying its own
   getSession() — since onAuthStateChange by definition never fires
   until the client is actually synced, there is no race left to hit. */
let CURRENT_SESSION = null;
sb.auth.onAuthStateChange(async (event, session)=>{
  CURRENT_SESSION = session;
  if(event !== 'INITIAL_SESSION') return;
  /* Phase 5.9 hotfix: raw getSession() here could resolve a moment before
     the Supabase client's REST calls actually carried that session's auth
     header (same race fixed in admin.js). Any RLS-protected query fired
     in that gap — including DB.bookings()'s "auth.uid() = user_id" check
     — ran as anonymous, matched 0 rows, and made a real, still-present
     Supabase row look like it had vanished from "My Bookings" right after
     a fresh login. onAuthStateChange's INITIAL_SESSION event fires only
     once the client is fully rehydrated, removing the race entirely. */
  if(!session?.user){
    sessionStorage.clear();
    window.location.replace('auth.html');
    return;
  }
  let {data:u,error}=await sb.from('users').select('*').eq('id',session.user.id).single();
  /* Self-heal: a session can exist with no matching public.users row if
     the account was created outside the app's own signup flow (e.g. added
     directly via Supabase Auth) or the original insert never completed.
     Previously this silently fell back to a placeholder profile and let
     the user proceed — right up until DB.save()'s bookings insert failed
     with a 409/bookings_user_id_fkey violation. Upsert the missing row
     here instead, so booking never breaks downstream on a legacy/orphaned
     session. */
  if(!u || error){
    const {data:healed,error:healErr}=await sb.from('users').upsert({
      id:    session.user.id,
      email: session.user.email,
      name:  session.user.user_metadata?.name || '',
      phone: '',
      role:  session.user.user_metadata?.role || 'user'
    }).select('*').single();
    if(!healErr) u = healed;
  }
  const profile = u
    ? {id:u.id, email:session.user.email, name:u.name||'', phone:u.phone||'', role:u.role||'user'}
    : {id:session.user.id, email:session.user.email, name:'', phone:'', role:'user'};
  sessionStorage.setItem('qf_user', JSON.stringify(profile));
  sessionStorage.setItem('qf_role', profile.role);

  /* Campaign popup (Phase 2A): show once per login session only, and
     only if an active campaign actually exists in the campaigns table.
     Flag lives in sessionStorage, which survives page refresh (so a
     refresh never re-shows it) but is wiped by signOut()'s existing
     sessionStorage.clear() and by the no-session branch above — so
     logging out and back in shows it again, exactly as specified. */
  if(profile.role === 'user' && !sessionStorage.getItem('qf_campaign_shown')){
    await _loadActiveCampaignForPopup();
    if(CAMPAIGN_SAMPLE){
      setTimeout(openCampaignModal, CONSTANTS.CAMPAIGN_POPUP_DELAY_MS);
    }
  }
});

/* Sign out
   - Explicitly attached to window so onclick="signOut()" resolves even if
     this script is ever loaded with defer/async/module semantics, or if a
     bundler/minifier wraps top-level declarations in a closure later.
   - Supabase sign-out wrapped in try/catch so a network error never blocks
     local cleanup and redirect.
   - Clears BOTH sessionStorage and the qf_bookings key in localStorage so
     no cached user/session/booking data survives the logout.
   - Uses location.replace() (not .href) so 'index.html' is dropped from
     browser history — pressing Back after logout cannot re-show a
     bfcache'd authenticated page or restore the previous session. */
async function signOut(){
  try{
    await sb.auth.signOut();
  }catch(err){
    console.error('signOut: Supabase sign-out failed (continuing local cleanup):', err);
  }
  try{
    sessionStorage.clear(); /* also clears qf_campaign_shown, so the campaign popup shows again on next login */
    localStorage.removeItem('qf_bookings');
  }catch(err){
    console.error('signOut: storage cleanup failed:', err);
  }
  window.location.replace('auth.html');
}
window.signOut = signOut;

/* ── DB: all reads/writes go to Supabase ── */
function getLocalBookings(){
  try { const raw=JSON.parse(localStorage.getItem('qf_bookings')||'[]'); return Array.isArray(raw)?raw:[]; }
  catch { return []; }
}
function setLocalBookings(list){
  localStorage.setItem('qf_bookings', JSON.stringify(Array.isArray(list)?list:[]));
}
function normalizeBookings(raw){
  if(!Array.isArray(raw)) return [];
  return raw.filter(Boolean).map(b=>({
    ...b,
    id: b.id ?? b.booking_id ?? String(Date.now()+Math.random()),
    status: b.status || CONSTANTS.BOOKING_STATUS.CONFIRMED,
    workerRole: b.workerRole || b.worker_role || 'Service',
    workerName: b.workerName || b.worker_name || 'Worker',
    workerPhone: b.workerPhone || b.worker_phone || '',
    workerEmoji: b.workerEmoji || b.worker_emoji || '🔧',
    paymentMethod: b.paymentMethod || b.payment_method || 'cash',
    passUsed: Boolean(b.passUsed ?? b.pass_used),
    passId: b.passId ?? b.pass_id ?? null,
    isEmergency: Boolean(b.isEmergency ?? b.is_emergency),
    isAdvance: Boolean(b.isAdvance ?? b.is_advance),
    rated: Boolean(b.rated),
    /* Timeline timestamps — passed through as-is from DB row */
    on_way_at:   b.on_way_at   || null,
    arrived_at:  b.arrived_at  || null,
    completed_at:b.completed_at|| null,
    accepted_at: b.accepted_at || null,
    started_at:  b.started_at  || null,
    /* Live tracking columns — worker GPS from bookings table only */
    worker_live_lat: b.worker_live_lat != null ? Number(b.worker_live_lat) : null,
    worker_live_lng: b.worker_live_lng != null ? Number(b.worker_live_lng) : null,
    customer_lat: b.customer_lat != null ? Number(b.customer_lat) : null,
    customer_lng: b.customer_lng != null ? Number(b.customer_lng) : null,
    /* Customer destination — resolved later via AREAS_CACHE, never geocoded */
    areaId: b.areaId ?? b.area_id ?? null,
  }));
}

const DB = {
  /* Fetch all service areas (id, name, lat, lng) for the Area dropdown */
  areas: async () => {
    const {data,error}=await sb.from('areas').select('*').order('name',{ascending:true});
    if(error){console.error('DB.areas:',error.message);return[];}
    return data||[];
  },

  /* Phase 6.5: fetch exactly one worker by id — used by openProfile()
     and openBooking(), which previously called DB.workers() (a full
     table SELECT * plus a get_worker_stats_bulk RPC across every
     worker) purely to .find() a single row by id. Same shape/derived
     fields as DB.workers()'s per-row mapping, computed for one row
     instead of all of them. */
  workerById: async (id) => {
    const {data:w,error}=await sb.from('workers').select('*').eq('id',id).single();
    if(error||!w){ console.error('DB.workerById:',error?.message); return null; }
    const {data:statsRows,error:se}=await sb.rpc('get_worker_stats_bulk',{p_worker_ids:[w.id]});
    if(se){ console.error('get_worker_stats_bulk:',se.message); }
    const s=(statsRows||[])[0]||{};
    return {
      ...w,
      role: w.skill,
      exp:  w.exp || 'N/A',
      desc: w.bio || '',
      emoji: '🔧',
      ea:   Boolean(w.emergency_available),
      dist: w.radius || 0,
      rating: s.rating ?? 0,
      reviews: s.completed_jobs ?? 0,
      worker_score: s.worker_score ?? 0,
      svcs: getCategorySections(w.skill)
              .flatMap(sec=>sec.items)
              .map(it=>({n:it.n, p:it.p})),
      revs: []
    };
  },

  /* Fetch workers from Supabase, optional role filter */
  workers: async (role=null) => {
    /* workers table only — no worker_services table exists in this schema.
       Case-insensitive skill match via ilike(); only is_available=true
       workers are eligible. */
    let q=sb.from('workers').select('*').eq('is_available',true);
    if(role) q=q.ilike('skill',role);
    const {data,error}=await q;
    if(error){console.error('DB.workers:',error.message);return[];}

    /* Live stats for every returned worker in ONE call — same formula as
       everywhere else (get_worker_stats), never cached workers columns.
       Feeds both the auto-match scoring below and the browse-listing
       rating/review-count display, since both read DB.workers() output. */
    const ids=(data||[]).map(w=>w.id).filter(Boolean);
    let statsById={};
    if(ids.length){
      const {data:statsRows,error:se}=await sb.rpc('get_worker_stats_bulk',{p_worker_ids:ids});
      if(se){ console.error('get_worker_stats_bulk:',se.message); }
      else { (statsRows||[]).forEach(s=>{ statsById[s.worker_id]=s; }); }
    }

    /* Normalise shape to match what the UI expects.
       svcs is derived from CAT_SECTIONS (existing client-side catalog,
       keyed by skill) using this worker's single `price` column as the
       displayed price for every listed service — no schema invented. */
    return (data||[]).map(w=>{
      const s=statsById[w.id]||{};
      return {
        ...w,
        role: w.skill,                 /* UI uses .role everywhere */
        exp:  w.exp || 'N/A',
        desc: w.bio || '',
        emoji: '🔧',
        ea:   Boolean(w.emergency_available),
        dist: w.radius || 0,
        rating: s.rating ?? 0,
        reviews: s.completed_jobs ?? 0,
        worker_score: s.worker_score ?? 0,
        /* Service prices come from the fixed CAT_SECTIONS catalog (the same
           source the Services page displays), NOT from workers.price.
           workers.price is a single per-worker "starting from" figure used
           elsewhere (worker card / profile), but it has no relationship to
           individual per-service prices and can be null — using it here was
           the cause of "₹null" showing in the booking dropdown. */
        svcs: getCategorySections(w.skill)
                .flatMap(sec=>sec.items)
                .map(it=>({n:it.n, p:it.p})),
        revs: []                       /* reviews fetched separately when needed */
      };
    });
  },

  /* Fetch all bookings for the logged-in user */
  bookings: async () => {
    const {data:{session}}=await sb.auth.getSession();
    const user=session?session.user:null;
    if(!user) return normalizeBookings(getLocalBookings());
    const {data,error}=await sb.from('bookings')
  .select('*')
  .eq('user_id',user.id)
  .eq('hidden_by_user', false)
  .order('created_at',{ascending:false});
    if(error){console.error('DB.bookings:',error.message);return [];}

    /* Profile photos, name, and phone all live on `workers`, not
       `bookings` — fetch in one bulk call, same pattern as
       get_worker_stats_bulk above. Never fetches document_url; that
       column is never read outside auth.html.
       IMPORTANT: neither create_booking() nor accept_booking() writes
       worker_name/worker_phone onto the bookings row — those columns
       are never populated server-side, so bookings.worker_name/
       worker_phone are always null/stale. Resolve them here from the
       live workers table instead, exactly like profile_photo_url. */
    const workerIds=[...new Set((data||[]).map(b=>b.worker_id).filter(Boolean))];
    let photoById={}, nameById={}, phoneById={};
    if(workerIds.length){
      const {data:workerRows,error:pe}=await sb.from('workers').select('id,profile_photo_url,name,phone').in('id',workerIds);
      if(pe){ console.error('worker photo/name/phone fetch:',pe.message); }
      else {
        (workerRows||[]).forEach(w=>{
          photoById[w.id]=w.profile_photo_url||'';
          nameById[w.id]=w.name||'';
          phoneById[w.id]=w.phone||'';
        });
      }
    }

    /* Normalise DB column names → JS camelCase the UI uses */
    return normalizeBookings((data||[]).map(b=>({
      ...b,
      workerName:    nameById[b.worker_id]  || b.worker_name  || '',
      workerPhone:   phoneById[b.worker_id] || b.worker_phone || '',
      workerRole:    b.worker_role,
      workerEmoji:   b.worker_emoji,
      workerPhotoUrl:photoById[b.worker_id]||'',
      workerDist:    0,
      areaId:        b.area_id,
      basePrice:     b.base_price,
      paymentMethod: b.payment_method,
      arrivalOtp:    b.arrival_otp,
      completionOtp: b.completion_otp,
      isEmergency:   b.is_emergency,
      isAdvance:     b.is_advance,
      createdAt:     b.created_at
    })));
  },

  clearAll: async () => {
  const {data:{session}} = await sb.auth.getSession();
  const user = session ? session.user : null;

  if(user){
    await sb
      .from('bookings')
      .update({ hidden_by_user: true })
      .eq('user_id', user.id);
  }

  setLocalBookings([]);
  sessionStorage.removeItem('qf_bookings_cache');
  return true;
},

  /* Save a single booking object to Supabase.
     Booking creation is now enforced server-side via create_booking() —
     trg_enforce_booking_insert_via_rpc rejects any direct client
     insert/upsert into bookings. create_booking() also generates the
     REAL arrival/completion OTPs itself; whatever bk.arrivalOtp/
     bk.completionOtp the caller passed in is a client-only placeholder
     and is discarded. The RPC's returned row (with the real OTPs,
     status='Pending', w_status='Pending') is written back into bk
     in place, so every caller downstream (acceptModal, confirmModal,
     arrOtpShow) ends up showing the OTP that's actually stored in the
     DB — not a value that will fail verifyOtp(). */
  save: async (bk) => {
    const {data:{session}}=await sb.auth.getSession();
    const user=session?session.user:null;
    if(!user){
      const list=getLocalBookings();
      const next=list.some(x=>String(x.id)===String(bk.id))
        ?list.map(x=>String(x.id)===String(bk.id)?{...x,...bk,id:String(bk.id)}:x)
        :[{...bk,id:String(bk.id)}, ...list];
      setLocalBookings(next);
      return true;
    }
    const {error:userHealErr}=await sb.from('users').upsert({
      id:    user.id,
      email: user.email,
      role:  user.user_metadata?.role || 'user'
    }, { onConflict:'id', ignoreDuplicates:true });
    if(userHealErr) console.error('DB.save: users self-heal failed:', userHealErr.message);

    const {data:result, error}=await sb.rpc('create_booking', {
      p_id:             String(bk.id),
      p_worker_id:      bk.workerId||null,
      p_worker_role:    bk.workerRole||'',
      p_worker_emoji:   bk.workerEmoji||'',
      p_item_name:      bk.service,
      p_is_emergency:   bk.isEmergency||false,
      p_is_advance:     bk.isAdvance||false,
      p_date:           bk.date,
      p_time:           bk.time||'',
      p_address:        bk.address,
      p_notes:          bk.notes||'',
      p_area_id:        bk.areaId||null,
      p_customer_lat:   bk.customer_lat != null ? bk.customer_lat : null,
      p_customer_lng:   bk.customer_lng != null ? bk.customer_lng : null,
      p_payment_method: bk.paymentMethod,
      p_pass_id:        bk.passId || null,
      p_price:          bk.price,
      p_base_price:     bk.basePrice,
      p_coins_redeemed: bk.coinsRedeemed || 0
    });

    if(error || !result?.success){
      console.error('DB.save:', result?.error || error?.message);
      return false;
    }

    /* Write the authoritative server row back into bk so the caller's
       in-memory object (pendBk._bk) matches what's actually in the DB —
       critically the real arrival_otp/completion_otp, id, status. */
    bk.arrivalOtp    = result.arrival_otp;
    bk.completionOtp = result.completion_otp;
    bk.status         = result.status;
    bk.wStatus        = result.w_status;
    bk.createdAt       = result.created_at;

    return true;
  },

  /* Update a single field on a booking */
  update: async (id, fields) => {
    const {data:{session}}=await sb.auth.getSession();
    const user=session?session.user:null;
    if(!user){
      const list=getLocalBookings().map(x=>String(x.id)===String(id)?{...x,...fields}:x);
      setLocalBookings(list);
      return;
    }
    const {error}=await sb.from('bookings').update(fields).eq('id',String(id));
    if(error) console.error('DB.update:',error.message);
  },

  /* Save a review — writes rating and comment back to the booking row
   using bookings.review_rating and bookings.review_comment as required.
   Also inserts into reviews table if it exists. */
saveReview: async (bkId, workerId, rating, comment, authorName) => {
  const {data:{session}}=await sb.auth.getSession();
  const user=session?session.user:null;
  if(!user) return;
  /* Write rating + comment into the booking row itself */
  const {error:bkErr}=await sb.from('bookings').update({
    rated:          true,
    review_rating:  rating,
    review_comment: comment||''
  }).eq('id',String(bkId));
  if(bkErr) console.error('DB.saveReview booking update:',bkErr.message);
  /* Also insert into reviews table */
  await sb.from('reviews').insert({
    booking_id:  String(bkId),
    user_id:     user.id,
    worker_id:   workerId||null,
    rating,
    comment,
    created_at:  new Date().toISOString()
  });
},

  /* Worker registration — saves to profiles table for now */
  saveReg: async (r) => {
    const {data:{session}}=await sb.auth.getSession();
    const user=session?session.user:null;
    if(!user) return;
    const {error}=await sb.from('profiles').upsert({
      id:    user.id,
      name:  r.rName||'',
      phone: r.rPhone||'',
      role:  'worker'
    });
    if(error) console.error('DB.saveReg:',error.message);
  }
};

/* ── WORKERS ──────────────────────────────────────────────── */
/* ── CATEGORIES ───────────────────────────────────────────── */
const CATS = [
  {id:'Electrician',  lb:'Electrician',  em:'⚡', items:[{i:'🌀',l:'Fan'},{i:'🔌',l:'Switchboard'},{i:'💡',l:'Lights'},{i:'🔋',l:'Wiring'},{i:'📦',l:'MCB/Fuse'},{i:'📷',l:'CCTV'}]},
  {id:'Plumber',      lb:'Plumber',      em:'🔧', items:[{i:'🚿',l:'Tap/Shower'},{i:'🚰',l:'Pipe Leak'},{i:'🚽',l:'Toilet'},{i:'♨️',l:'Geyser'},{i:'🪣',l:'Tank'},{i:'🕳️',l:'Drain'}]},
  {id:'Carpenter',    lb:'Carpenter',    em:'🪚', items:[{i:'🚪',l:'Door'},{i:'🪑',l:'Furniture'},{i:'🗄️',l:'Wardrobe'},{i:'🪟',l:'Window'},{i:'🛏️',l:'Bed Frame'},{i:'✨',l:'Polishing'}]},
  {id:'Painter',      lb:'Painter',      em:'🎨', items:[{i:'🏠',l:'Interior'},{i:'🏗️',l:'Exterior'},{i:'💧',l:'Waterproof'},{i:'🖌️',l:'Texture'},{i:'🔤',l:'Stencil'},{i:'🪟',l:'Window Paint'}]},
  {id:'Cleaner',      lb:'Cleaner',      em:'🧹', items:[{i:'🏡',l:'Full Home'},{i:'🍳',l:'Kitchen'},{i:'🛋️',l:'Sofa'},{i:'🚿',l:'Bathroom'},{i:'🪟',l:'Windows'},{i:'🏗️',l:'Post-Build'}]},
  {id:'AC Repair',    lb:'AC Repair',    em:'❄️', items:[{i:'🌬️',l:'Servicing'},{i:'⛽',l:'Gas Refill'},{i:'⚙️',l:'Compressor'},{i:'🔧',l:'Installation'},{i:'💧',l:'Water Leak'},{i:'❄️',l:'Not Cooling'}]},
  {id:'Mason',        lb:'Mason',        em:'🧱', items:[{i:'🪨',l:'Tiling'},{i:'🏗️',l:'Plastering'},{i:'💧',l:'Waterproof'},{i:'🔨',l:'Wall Repair'},{i:'🧱',l:'Brick Work'},{i:'🏠',l:'Flooring'}]},
  {id:'Pest Control', lb:'Pest Control', em:'🐜', items:[{i:'🪲',l:'Cockroach'},{i:'🐜',l:'Ants'},{i:'🐀',l:'Rodents'},{i:'🪱',l:'Termites'},{i:'🦟',l:'Mosquitoes'},{i:'🛏️',l:'Bed Bugs'}]},
];

/* ── HOUSEHELP SUBCATEGORIES ────────────────────────────────
   Each section has a title, and items with name + price.
   Clicking an item goes straight to the booking page
   with the service pre-selected on the nearest HH worker.
─────────────────────────────────────────────────────────── */
const HH_SECTIONS = [
  { title:'🧹 Cleaning Services', items:[
    {n:'Room Cleaning',p:99},{n:'Bathroom Cleaning',p:99},
    {n:'Kitchen Cleaning',p:129},{n:'Deep Cleaning (Full House)',p:299},{n:'Sofa / Carpet Cleaning',p:199}
  ]},
  { title:'🍽️ Kitchen Help', items:[
    {n:'Cooking Assistance',p:149},{n:'Full-time Cook (Daily)',p:399},
    {n:'Meal Prep – Weekly Batch',p:279},{n:'Utensil Washing',p:79}
  ]},
  { title:'🧺 Laundry & Ironing', items:[
    {n:'Clothes Washing',p:99},{n:'Ironing Service',p:89},{n:'Folding & Organizing',p:79}
  ]},
  { title:'🧼 General Household Help', items:[
    {n:'Dusting & Tidying',p:79},{n:'Organizing Rooms',p:99},{n:'Daily Chores Support',p:129}
  ]},
  { title:'🛒 Errands / Small Tasks', items:[
    {n:'Grocery Pickup',p:79},{n:'Market Errands',p:79},{n:'Parcel Drop / Pickup',p:69}
  ]},
  { title:'👶 Care Services', items:[
    {n:'Babysitting',p:199},{n:'Elder Care Assistance',p:249},{n:'Patient Assistance',p:229}
  ]},
  { title:'🌿 Specialized Cleaning', items:[
    {n:'Balcony Cleaning',p:99},{n:'Window Cleaning',p:129},{n:'Post-Party Cleanup',p:349}
  ]},
];

/* ── MASSAGE & WELLNESS SUBCATEGORIES ──────────────────────── */
const MW_SECTIONS = [
  { title:'💆 Body Massage', items:[
    {n:'Full Body Massage (60 min)',p:599},{n:'Full Body Massage (90 min)',p:799},
    {n:'Back & Shoulder Massage',p:349},{n:'Swedish Massage',p:649},
    {n:'Deep Tissue Massage',p:699},{n:'Aromatherapy Massage',p:749},
    {n:'Hot Stone Massage',p:849},{n:'Couple Massage (60 min)',p:999}
  ]},
  { title:'🦶 Head & Foot Massage', items:[
    {n:'Head Massage',p:199},{n:'Foot Massage',p:249},
    {n:'Head + Foot Combo',p:399},{n:'Hair Oil Massage',p:249}
  ]},
  { title:'🛁 Home Spa Services', items:[
    {n:'Home Spa Package (Full)',p:999},{n:'Aromatherapy Session',p:749},
    {n:'Detox Body Wrap',p:849},{n:'Hot Stone Therapy',p:849}
  ]},
  { title:'✨ Salon at Home – Face', items:[
    {n:'Facial (Basic)',p:399},{n:'Facial (Premium)',p:599},
    {n:'Cleanup & Glow',p:349},{n:'Tan Removal',p:299},
    {n:'Threading (Eyebrows)',p:49},{n:'Eyebrow + Upper Lip',p:79}
  ]},
  { title:'🪒 Waxing & Hair Removal', items:[
    {n:'Waxing – Full Arms',p:199},{n:'Waxing – Full Legs',p:249},
    {n:'Underarm Waxing',p:99},{n:'Full Body Wax',p:599}
  ]},
  { title:'💅 Nails & Hands', items:[
    {n:'Manicure',p:299},{n:'Pedicure',p:349},
    {n:'Manicure + Pedicure',p:549},{n:'Nail Art (per hand)',p:199}
  ]},
  { title:'💇 Hair Services', items:[
    {n:'Hair Spa',p:499},{n:'Hair Oil Massage',p:249},
    {n:'Blowdry & Styling',p:299},{n:'Keratin Treatment',p:999}
  ]},
];

const CAT_SECTIONS = {
  Electrician:[{ title:'⚡ Electrical Services', items:[
      {n:'Fan',p:149},{n:'Switchboard',p:179},{n:'Lights',p:129},{n:'Wiring',p:179},{n:'MCB/Fuse',p:149},{n:'CCTV',p:249}
    ]}],
  Plumber:[{ title:'🔧 Plumbing Services', items:[
      {n:'Tap/Shower',p:149},{n:'Pipe Leak',p:179},{n:'Toilet',p:169},{n:'Geyser',p:199},{n:'Tank',p:159},{n:'Drain',p:169}
    ]}],
  Carpenter:[{ title:'🪚 Carpentry Services', items:[
      {n:'Door',p:149},{n:'Furniture',p:199},{n:'Wardrobe',p:249},{n:'Window',p:189},{n:'Bed Frame',p:249},{n:'Polishing',p:199}
    ]}],
  Painter:[{ title:'🎨 Painting Services', items:[
      {n:'Interior',p:249},{n:'Exterior',p:299},{n:'Waterproof',p:349},{n:'Texture',p:449},{n:'Stencil',p:199},{n:'Window Paint',p:229}
    ]}],
  Cleaner:[{ title:'🧹 Cleaning Services', items:[
      {n:'Full Home',p:299},{n:'Kitchen',p:149},{n:'Sofa',p:199},{n:'Bathroom',p:129},{n:'Windows',p:129},{n:'Post-Build',p:349}
    ]}],
  'AC Repair':[{ title:'❄️ AC Repair Services', items:[
      {n:'Servicing',p:199},{n:'Gas Refill',p:179},{n:'Compressor',p:249},{n:'Installation',p:299},{n:'Water Leak',p:179},{n:'Not Cooling',p:179}
    ]}],
  Mason:[{ title:'🧱 Masonry Services', items:[
      {n:'Tiling',p:249},{n:'Plastering',p:299},{n:'Waterproof',p:349},{n:'Wall Repair',p:179},{n:'Brick Work',p:299},{n:'Flooring',p:299}
    ]}],
  'Pest Control':[{ title:'🐜 Pest Control Services', items:[
      {n:'Cockroach',p:199},{n:'Ants',p:169},{n:'Rodents',p:199},{n:'Termites',p:249},{n:'Mosquitoes',p:169},{n:'Bed Bugs',p:199}
    ]}],
  Househelp:HH_SECTIONS,
  'Massage & Wellness':MW_SECTIONS
};

function getCategorySections(catId){
  return CAT_SECTIONS[catId] || [{ title:'Services', items:(CATS.find(c=>c.id===catId)?.items||[]).map(it=>({n:it.l,p:0})) }];
}

function renderCategoryPage(catId){
  const cat=CATS.find(c=>c.id===catId)||{id:catId,lb:catId,em:'',items:[]};
  document.getElementById('catBread').textContent=cat.lb;
  document.getElementById('catTitle').textContent=`${cat.em} ${cat.lb}`;
  document.getElementById('catDesc').textContent=`Select the service you need — a certified professional will be assigned near you.`;
  const sections=getCategorySections(catId);
  if(!sections.length || sections.every(sec=>!sec.items.length)){
    document.getElementById('catSections').innerHTML=`<div class="empty" style="padding:2rem 1rem;text-align:center"><div class="emptyico">🔍</div><h3>No services available</h3><p>Try another category or come back later.</p></div>`;
    return;
  }
  document.getElementById('catSections').innerHTML=sections.map(sec=>`
    <div class="hhsec">
      <div class="hhsec-title">${sec.title}</div>
      <div class="hhgrid">
        ${sec.items.map(it=>`
          <div class="hhbtn" onclick="bookCategoryService('${it.n.replace(/'/g,"\\'")}', '${catId}')">
            <div class="hhbtn-left">
              <div class="hhbtn-name">${it.n}</div>
              ${it.p?`<div class="hhbtn-price">₹${it.p}</div>`:''}
            </div>
            <div class="hhbtn-arrow">›</div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function openCategory(catId){ renderCategoryPage(catId); goPage('category'); }

async function bookCategoryService(serviceName, catId){
  /* Phase 6.6: only checking that SOME worker exists in this category,
     for early feedback. The job itself broadcasts to every eligible
     worker on submit — it's no longer locked to whichever worker
     happened to be nearest at click time. */
  const workers=await DB.workers(catId);
  if(!workers.length){ showToast(`⚠️ No ${catId} workers available right now`); return; }
  sst={catId, item:serviceName, issue:''};
  openBookingForRole(catId);
}

/* ── HOURS ────────────────────────────────────────────────── */
const WS_H = 8,
      WS_M = 30,
      WE_H = 20,
      WE_M = 30;
const EROLES = ['Electrician','Plumber'];

/* ── AREA-BASED ASSIGNMENT ────────────────────────────────────
   areas(id,name,lat,lng) + workers(area,lat,lng,radius).
   No external geocoding API — coordinates come straight from the
   areas table, selected via the booking-form Area dropdown. */
/* TODO(config): MAX_ASSIGN_KM has no value in constants.js yet — no
   authoritative source found in this repo. Until set, this evaluates
   to undefined and the distance-cap check below always fails. */
const MAX_ASSIGN_KM = CONSTANTS.MAX_ASSIGN_KM;
let AREAS_CACHE = null;   /* populated once on first booking-form open */

/* Haversine formula — great-circle distance in km between two lat/lng points */
function haversineKm(lat1, lng1, lat2, lng2){
  if([lat1,lng1,lat2,lng2].some(v=>v===null||v===undefined||Number.isNaN(Number(v)))) return Infinity;
  const toRad=d=>d*Math.PI/180;
  const R=6371; /* Earth radius in km */
  const dLat=toRad(lat2-lat1), dLng=toRad(lng2-lng1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

/* Load areas table once and cache for the session (re-fetches if empty) */
async function loadAreas(){
  if(AREAS_CACHE && AREAS_CACHE.length) return AREAS_CACHE;
  AREAS_CACHE = await DB.areas();
  return AREAS_CACHE;
}

/* Given a role + selected area, return workers eligible by:
     1. skill match (case-insensitive, already done in DB.workers)
     2. is_available = true (already done in DB.workers)
     3. Haversine distance from area coords to worker coords <= worker.radius
     4. Haversine distance <= MAX_ASSIGN_KM (hard cap)
   Sorted nearest-first. Each worker gets a `.kmDist` (actual computed km). */
async function getEligibleWorkersForArea(role, area, opts={}){
  const pool=await DB.workers(role);
  const filtered=pool.filter(w=>opts.emergencyOnly ? w.ea : true);
  if(!area || area.lat==null || area.lng==null){
    /* No area selected / area missing coords — cannot validate distance,
       so no worker is eligible. Server-side validation must not silently
       fall back to "any worker". */
    return [];
  }
  return filtered
    .map(w=>{
      const wLat=w.lat, wLng=w.lng;
      const km=haversineKm(area.lat, area.lng, wLat, wLng);
      const workerRadius=Number(w.radius)||0;
      return {...w, kmDist:km, withinOwnRadius: km<=workerRadius, withinMaxAssign: km<=MAX_ASSIGN_KM};
    })
    .filter(w=>w.withinOwnRadius && w.withinMaxAssign)
    .sort((a,b)=>{
      /* ── ASSIGNMENT PRIORITY ──────────────────────────────
         1. Distance priority — nearer worker wins within a small band.
         2. Worker score priority — among comparably-near workers,
            prefer the higher worker_score so poor performers
            gradually receive fewer bookings. */
      const distDiff=a.kmDist-b.kmDist;
      if(Math.abs(distDiff)>0.5) return distDiff; /* clearly nearer wins outright */
      const scoreA=Number(a.worker_score)||0, scoreB=Number(b.worker_score)||0;
      if(scoreA!==scoreB) return scoreB-scoreA;    /* tie-break: higher score first */
      return distDiff;                             /* final tie-break: raw distance */
    });
}

/* getIST now comes from js/common/utils.js, loaded before this file. */
function istDateStr(){
  const d=getIST();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function isEmerg(){
  const d=getIST(), mins=d.getHours()*60+d.getMinutes();
  return mins>=WE_H*60+WE_M || mins<WS_H*60+WS_M;
}
function inWork(hhmm){
  const [h,m]=hhmm.split(':').map(Number), mins=h*60+m;
  return mins>=WS_H*60+WS_M && mins<WE_H*60+WE_M;
}
function nowSlot(){
  const d=getIST();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function fmt12(hhmm){
  if(!hhmm) return '';
  const [h,m]=hhmm.split(':').map(Number);
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;
}
function fmtDate(d){ return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function revealAt(time){
  const [h,m]=time.split(':').map(Number);
  let rh=h, rm=m-10; if(rm<0){rm+=60;rh--;} if(rh<0)rh+=24;
  return fmt12(`${String(rh).padStart(2,'0')}:${String(rm).padStart(2,'0')}`);
}
function isAdv(date,time){
  const ist=getIST(), [h,m]=time.split(':').map(Number);
  const slot=new Date(date); slot.setHours(h,m,0,0);
  return slot-ist>CONSTANTS.ADVANCE_BOOKING_REVEAL_WINDOW_MS;
}
function shouldReveal(bk){
  if(!bk.isAdvance) return true;
  const ist=getIST(), [h,m]=bk.time.split(':').map(Number);
  const slot=new Date(bk.date); slot.setHours(h,m,0,0);
  return slot-ist<=CONSTANTS.ADVANCE_BOOKING_REVEAL_WINDOW_MS;
}

/* ── CLOCK ─────────────────────────────────────────────────── */
function tickClock(){
  const d=getIST(), h=d.getHours(), m=d.getMinutes(), s=d.getSeconds();
  const str=`${String(h%12||12).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} ${h<12?'AM':'PM'}`;
  document.getElementById('istTime').textContent=str;
  document.getElementById('emergTime').textContent=str;
  const e=isEmerg(), bar=document.getElementById('emergBar'), prev=bar.classList.contains('on');
  document.getElementById('istClock').classList.toggle('em',e);
  bar.classList.toggle('on',e);
  syncEmergFilters(e);
  if(e!==prev){
    if(isActivePage('home')) renderHomeCats();
    if(isActivePage('services')) renderServices();
  }
  if(isActivePage('booking')&&!document.getElementById('bkTime').value) setBkBtn(e);
}
function isActivePage(id){ return document.getElementById('page-'+id).classList.contains('on'); }
function syncEmergFilters(e){
  document.querySelectorAll('#catBar .fbtn.eonly').forEach(b=>b.classList.toggle('ehide',e));
  const ab=document.querySelector('#catBar .fbtn[data-cat="all"]');
  if(ab) ab.classList.toggle('ehide',e);
  if(e){
    const ac=document.querySelector('#catBar .fbtn.on');
    if(ac&&ac.classList.contains('ehide')){
      document.querySelectorAll('#catBar .fbtn').forEach(b=>b.classList.remove('on'));
      const el=document.querySelector('#catBar .fbtn[data-cat="Electrician"]');
      if(el){el.classList.add('on'); filters.cat='Electrician';}
    }
  }
}

/* ── STATE ─────────────────────────────────────────────────── */
const filters={cat:'all',sort:'default',search:''};
let curW=null, curTab='all';
let accInt=null, accLeft=CONSTANTS.WORKER_ACCEPT_TIMEOUT_SECONDS;
let arrInt=null, arrLeft=CONSTANTS.ARRIVAL_TIMEOUT_SECONDS, arrExt=false;
let pendBk=null, pendBkId=null, otpMode=null;
let sst={catId:null,item:null,issue:''};
let pollInt=null, pollCnt=0, qrInt=null;
let revRat=0, revId=null, aadhaarData=null;
/* TODO(config): PAYMENT_POLL_MAX_ATTEMPTS and PAYMENT_POLL_INTERVAL_MS
   have no value in constants.js yet — no authoritative source found
   in this repo. Until set, payment polling runs with undefined bounds. */
const POLL_MAX=CONSTANTS.PAYMENT_POLL_MAX_ATTEMPTS, POLL_MS=CONSTANTS.PAYMENT_POLL_INTERVAL_MS;

setInterval(tickClock,CONSTANTS.CLOCK_TICK_INTERVAL_MS); tickClock();

/* ── HELPERS ───────────────────────────────────────────────── */
function stars(r){ return Array.from({length:5},(_,i)=>`<span class="star${i<Math.round(r)?'':' empty'}">★</span>`).join(''); }
function genOtp(){ return String(Math.floor(100000+Math.random()*900000)); }
/* closeModal now comes from js/common/utils.js, loaded before this file. */

/* ── CAMPAIGN SYSTEM (Phase 2A popup + Phase 2B Offers page) ─────
   SINGLE SOURCE OF TRUTH: both the login popup and the Offers page
   read from the same `campaigns` table through fetchActiveCampaigns()
   below. The popup takes the first (highest-priority) result; the
   Offers page renders all of them. No hardcoded data, no second
   query path. */
function _formatPrice(p){
  const n = Number(p);
  if(isNaN(n)) return '';
  return '₹' + (Number.isInteger(n) ? n : n.toFixed(2));
}

/* Phase 7 UX fix: coins-only campaigns have no ₹ price at all
   (price is 0 in the DB, per admin.js's publishCampaign()). Showing
   "₹0" there falsely implies the offer is free. This shows the real
   cost — the coin price — in the same big hero-price slot instead. */
function _formatCampaignHeroPrice(row){
  if(row.purchase_method === 'coins'){
    return `${row.coin_price} 🪙`;
  }
  return _formatPrice(row.price);
}

function _buildPerks(row){
  const visits = row.number_of_visits ?? 1;
  const perks = [`${visits} Visit${visits===1?'':'s'}${row.emergency_included ? ' (Includes Emergency Bookings)' : ''}`];
  if(row.priority_booking) perks.push('Priority Booking');
  return perks;
}

let _campaignCache = {}; /* id -> mapped campaign, populated on every fetch, used by campaignBuyPass() */

function _mapCampaignRow(row){
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    icon: (CATS.find(c => c.id.toLowerCase() === String(row.service||'').toLowerCase()) || {}).em || '🎫',
    price: _formatCampaignHeroPrice(row),
    priceValue: Number(row.price),
    perks: _buildPerks(row),
    endsAt: new Date(row.offer_end_date),
    validityDays: row.validity_days,
    totalVisits: row.number_of_visits ?? 1,
    emergencyIncluded: !!row.emergency_included,
    priorityBooking: !!row.priority_booking,
    purchaseMethod: row.purchase_method || 'gpay',
    coinPrice: Number(row.coin_price) || 0
  };
}

async function fetchActiveCampaigns(){
  const nowIso = new Date().toISOString();
  const {data, error} = await sb.from('campaigns')
    .select('*')
    .eq('status', 'active')
    .lte('offer_start_date', nowIso)
    .gt('offer_end_date', nowIso)
    .order('priority', {ascending:true})
    .order('offer_end_date', {ascending:true});

  if(error){
    console.error('fetchActiveCampaigns:', error.message);
    return [];
  }
  const mapped = (data||[]).map(_mapCampaignRow);
  mapped.forEach(c => { _campaignCache[c.id] = c; });
  return mapped;
}

/* Resolves the single campaign the login popup should show, or null
   if none is currently active — in which case the popup never opens. */
let CAMPAIGN_SAMPLE = null;
async function _loadActiveCampaignForPopup(){
  const list = await fetchActiveCampaigns();
  CAMPAIGN_SAMPLE = list[0] || null;
  return CAMPAIGN_SAMPLE;
}

function openCampaignModal(){
  if(!CAMPAIGN_SAMPLE) return; /* future: no active campaign this week */
  const el = document.getElementById('campaignModal');
  if(!el) return;
  document.getElementById('campaignTitle').textContent = CAMPAIGN_SAMPLE.title;
  document.getElementById('campaignPrice').textContent = CAMPAIGN_SAMPLE.price;
  document.getElementById('campaignPerks').innerHTML =
    CAMPAIGN_SAMPLE.perks.map(p=>`<li>✓ ${p}</li>`).join('');
  el.classList.remove('campaign-closing');
  el.classList.add('on');
  _updateCampaignCountdown();
  clearInterval(window._campaignCountdownTimer);
  window._campaignCountdownTimer = setInterval(_updateCampaignCountdown, CONSTANTS.COUNTDOWN_TICK_MS);
}

function closeCampaignModal(){
  const el = document.getElementById('campaignModal');
  if(!el || !el.classList.contains('on')) return;
  el.classList.add('campaign-closing');
  clearInterval(window._campaignCountdownTimer);
  setTimeout(()=>{ el.classList.remove('on','campaign-closing'); }, CONSTANTS.CAMPAIGN_MODAL_CLOSE_ANIM_MS);
}

function campaignBuyPass(id){
  const campaign = id ? _campaignCache[id] : CAMPAIGN_SAMPLE;
  openPaymentModal(campaign);
}

/* ── PASS PAYMENT (Phase 2C) ──────────────────────────────────────
   DEMO MODE: _simulatePaymentProvider() is the ONLY function a real
   gateway (Razorpay/PhonePe/Stripe) needs to replace later. It takes
   one callback, onSuccess, and calls it once payment is confirmed —
   everything downstream (activatePass, UI states, timers) stays
   exactly the same regardless of how payment was actually confirmed. */
let _paymentState = { campaign:null, countdownTimer:null, demoTimer:null, expired:false, succeeded:false, secondsLeft:CONSTANTS.PASS_PAYMENT_COUNTDOWN_SECONDS };

function openPaymentModal(campaign){
  if(!campaign) return;
  const el = document.getElementById('paymentModal');
  if(!el) return;

  _clearPaymentTimers();
  _paymentState = { campaign, countdownTimer:null, demoTimer:null, expired:false, succeeded:false, secondsLeft:CONSTANTS.PASS_PAYMENT_COUNTDOWN_SECONDS };

  document.getElementById('payTitle').textContent = campaign.title;
  document.getElementById('payOk').classList.remove('on');

  const method = campaign.purchaseMethod || 'gpay';
  const gpaySection = document.getElementById('paySection');
  const coinsSection = document.getElementById('payCoinsSection');
  const methodNote = document.getElementById('payMethodNote');

  if(method === 'coins'){
    /* Phase 7: pure coin redemption — no GPay flow at all, no QR,
       no timer. activate_pass() itself does the real, atomic balance
       check + deduction; this UI is just a confirm step. */
    gpaySection.style.display = 'none';
    coinsSection.style.display = '';
    methodNote.textContent = 'This offer is redeemable with QuickCoins only.';
    _renderCoinsConfirmUI(campaign);
  } else {
    gpaySection.style.display = '';
    coinsSection.style.display = 'none';
    methodNote.textContent = 'Passes are GPay only — prepaid digital product.';
    const statusEl = document.getElementById('payStatus');
    statusEl.textContent = 'Waiting for payment...';
    statusEl.classList.remove('payment-expired');
    document.getElementById('payExpiry').style.display = '';
    drawPassQR(campaign);
    _updatePaymentTimerDisplay();
    _paymentState.countdownTimer = setInterval(()=>{
      _paymentState.secondsLeft--;
      _updatePaymentTimerDisplay();
      if(_paymentState.secondsLeft <= 0) _onPaymentExpired();
    }, CONSTANTS.COUNTDOWN_TICK_MS);
    _simulatePaymentProvider(_onPaymentSuccess);
  }

  el.classList.add('on');
}

async function _renderCoinsConfirmUI(campaign){
  const balance = await _getMyQuickCoinsBalance();
  const btn = document.getElementById('payCoinsConfirmBtn');
  const info = document.getElementById('payCoinsInfo');
  info.textContent = `Redeem ${campaign.coinPrice} 🪙 for this pass (your balance: ${balance} 🪙)`;
  btn.style.display = '';
  btn.disabled = balance < campaign.coinPrice;
  btn.textContent = btn.disabled ? 'Insufficient QuickCoins' : `Redeem ${campaign.coinPrice} 🪙`;
  btn.onclick = () => _confirmCoinsPurchase(campaign);
}

async function _confirmCoinsPurchase(campaign){
  const btn = document.getElementById('payCoinsConfirmBtn');
  btn.disabled = true; btn.textContent = 'Processing…';
  const ok = await activatePass(campaign);
  if(ok){
    document.getElementById('payCoinsSection').style.display='none';
    document.getElementById('payOk').classList.add('on');
    showToast('🎉 Pass activated! Check My Passes.');
    _removeOfferCardFromGrid(campaign.id);
    setTimeout(closePaymentModal, CONSTANTS.PASS_PAYMENT_MODAL_CLOSE_DELAY_MS);
  } else {
    btn.disabled=false; btn.textContent = `Redeem ${campaign.coinPrice} 🪙`;
  }
}

function _updatePaymentTimerDisplay(){
  const t = Math.max(_paymentState.secondsLeft, 0);
  const mm = String(Math.floor(t/60)).padStart(2,'0');
  const ss = String(t%60).padStart(2,'0');
  const el = document.getElementById('payTimer');
  if(el) el.textContent = `${mm}:${ss}`;
}

/* Same QRCode library and lazy-load pattern as the booking flow's
   drawQR() — reused, not modified. Pass-specific amount/title/UPI id. */
function drawPassQR(campaign){
  const upi = `upi://pay?pa=quickfix@test&pn=${encodeURIComponent('QuickFix')}&am=${campaign.priceValue}&cu=INR&tn=${encodeURIComponent(campaign.title)}`;
  const cont = document.getElementById('payQrCont');
  cont.innerHTML = '';
  function render(){
    try{
      new QRCode(cont,{text:upi, width:190, height:190, colorDark:'#1a1a1a', colorLight:'#fff', correctLevel:QRCode.CorrectLevel.M});
      const d = document.createElement('div');
      d.innerHTML = `<div class="qramt">${campaign.price}</div><div class="qrnote">quickfix@test · Scan with GPay</div>`;
      cont.appendChild(d);
    } catch(e){ showFallback(); }
  }
  function showFallback(){
    cont.innerHTML = `<div style="padding:1rem;text-align:center"><div style="font-size:.78rem;color:var(--text2);margin-bottom:.5rem">Open in GPay:</div><a href="${upi}" style="color:var(--brand);font-weight:600;font-size:.78rem;word-break:break-all">${upi}</a><div class="qramt" style="margin-top:.75rem">${campaign.price}</div></div>`;
  }
  if(typeof QRCode !== 'undefined'){ render(); }
  else {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = render;
    s.onerror = showFallback;
    s.setAttribute('crossorigin','anonymous');
    document.head.appendChild(s);
  }
}

function _simulatePaymentProvider(onSuccess){
  /* Phase 5.6.1: was 10000 — now CONSTANTS.DEMO_PAYMENT_PROVIDER_DELAY_MS.
     Still the one function a real gateway integration needs to replace. */
  _paymentState.demoTimer = setTimeout(()=>{
    if(_paymentState.expired || _paymentState.succeeded) return;
    onSuccess();
  }, CONSTANTS.DEMO_PAYMENT_PROVIDER_DELAY_MS);
}

function _clearPaymentTimers(){
  clearInterval(_paymentState.countdownTimer);
  clearTimeout(_paymentState.demoTimer);
}

async function _onPaymentSuccess(){
  if(_paymentState.expired || _paymentState.succeeded) return;
  _paymentState.succeeded = true;
  _clearPaymentTimers();

  document.getElementById('paySection').style.display = 'none';
  document.getElementById('payOk').classList.add('on');

  await new Promise(r=>setTimeout(r, CONSTANTS.PASS_ACTIVATION_DELAY_MS));

  const ok = await activatePass(_paymentState.campaign);
  if(ok){
    showToast('🎉 Pass activated! Check My Passes.');
    _removeOfferCardFromGrid(_paymentState.campaign.id);
  }
  setTimeout(closePaymentModal, CONSTANTS.PASS_PAYMENT_MODAL_CLOSE_DELAY_MS);
}

/* Removes a card the moment its pass is bought — same cleanup the
   countdown-expiry path already does, reused here rather than
   duplicated. */
function _removeOfferCardFromGrid(campaignId){
  clearInterval(_offerCountdownTimers[campaignId]);
  delete _offerCountdownTimers[campaignId];
  const card = document.getElementById('offer-card-'+campaignId);
  if(card) card.remove();
  const grid = document.getElementById('offersGrid');
  if(grid && !grid.children.length){
    const empty = document.getElementById('offersEmpty');
    if(empty) empty.style.display = 'flex';
  }
}

function _onPaymentExpired(){
  if(_paymentState.succeeded) return;
  _paymentState.expired = true;
  _clearPaymentTimers();
  const statusEl = document.getElementById('payStatus');
  statusEl.textContent = 'Payment Session Expired — Please try again.';
  statusEl.classList.add('payment-expired');
  document.getElementById('payExpiry').style.display = 'none';
}

function closePaymentModal(){
  _clearPaymentTimers();
  document.getElementById('paymentModal').classList.remove('on');
  const coinsSection = document.getElementById('payCoinsSection');
  if(coinsSection) coinsSection.style.display = 'none';
  const coinsBtn = document.getElementById('payCoinsConfirmBtn');
  if(coinsBtn){ coinsBtn.style.display=''; coinsBtn.disabled=false; }
}

async function activatePass(campaign){
  const {data:{session}} = await sb.auth.getSession();
  if(!session?.user) return false;

  /* Phase 6.4 — the client no longer decides visit counts, validity,
     or perks. activate_pass() re-reads the real campaigns row
     server-side. campaign.id is the only client-supplied value trusted. */
  const {data:result, error} = await sb.rpc('activate_pass', { p_campaign_id: campaign.id });

  if(error || !result?.success){
    console.error('activatePass:', result?.error || error?.message);
    showToast('⚠️ ' + (result?.error || 'Could not activate pass — please contact support.'));
    return false;
  }
  return true;
}

async function renderMyPasses(){
  const grid = document.getElementById('passesGrid');
  const empty = document.getElementById('passesEmpty');
  if(!grid || !empty) return;

  empty.style.display = 'none';
  grid.innerHTML = '<p style="color:var(--text2);font-size:.85rem;grid-column:1/-1">Loading your passes…</p>';

  const {data:{session}} = await sb.auth.getSession();
  if(!session?.user){ grid.innerHTML=''; empty.style.display='flex'; return; }

  const {data, error} = await sb.from('user_passes')
    .select('*')
    .eq('user_id', session.user.id)
    .order('purchase_date', {ascending:false});

  if(error || !data || !data.length){
    if(error) console.error('renderMyPasses:', error.message);
    grid.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }

  const campaignIds = [...new Set(data.map(p=>p.campaign_id))];
  const {data:campaignRows} = await sb.from('campaigns').select('id,title').in('id', campaignIds);
  const titleById = {};
  (campaignRows||[]).forEach(c=>{ titleById[c.id] = c.title; });

  const fmtDate = d => new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short'});

  grid.innerHTML = data.map(p => `
    <div class="offer-card">
      <h2 class="campaign-title">${titleById[p.campaign_id] || 'Service Pass'}</h2>
      <div class="pass-status pass-status-${p.status}">${String(p.status).toUpperCase()}</div>
      <div class="pass-row"><span>Purchased</span><strong>${fmtDate(p.purchase_date)}</strong></div>
      <div class="pass-row"><span>Expires</span><strong>${fmtDate(p.expiry_date)}</strong></div>
      <div class="pass-row"><span>Visits Remaining</span><strong>${p.visits_remaining} / ${p.total_visits}</strong></div>
      <ul class="campaign-perks">
        ${p.emergency_included ? '<li>✓ Emergency Included</li>' : ''}
        ${p.priority_booking ? '<li>✓ Priority Booking</li>' : ''}
      </ul>
    </div>
  `).join('');
}

function _updateCampaignCountdown(){
  if(!CAMPAIGN_SAMPLE) return;
  const dEl=document.getElementById('cdDays'), hEl=document.getElementById('cdHrs'),
        mEl=document.getElementById('cdMin'), sEl=document.getElementById('cdSec');
  if(!dEl || !hEl || !mEl || !sEl) return;

  const diff = CAMPAIGN_SAMPLE.endsAt.getTime() - Date.now();
  const pad = n => String(Math.max(n,0)).padStart(2,'0');

  if(diff <= 0){
    dEl.textContent='00'; hEl.textContent='00'; mEl.textContent='00'; sEl.textContent='00';
    clearInterval(window._campaignCountdownTimer);
    return;
  }
  dEl.textContent = pad(Math.floor(diff / 86400000));
  hEl.textContent = pad(Math.floor((diff % 86400000) / 3600000));
  mEl.textContent = pad(Math.floor((diff % 3600000) / 60000));
  sEl.textContent = pad(Math.floor((diff % 60000) / 1000));
}
let _offerCountdownTimers = {};

async function _getOwnedActiveCampaignIds(){
  const {data:{session}} = await sb.auth.getSession();
  if(!session?.user) return new Set();
  const {data, error} = await sb.from('user_passes')
    .select('campaign_id')
    .eq('user_id', session.user.id)
    .eq('status', 'active');
  if(error){
    console.error('_getOwnedActiveCampaignIds:', error.message);
    return new Set();
  }
  return new Set((data||[]).map(r=>r.campaign_id));
}

async function renderOffers(){
  const grid = document.getElementById('offersGrid');
  const empty = document.getElementById('offersEmpty');
  if(!grid || !empty) return;

  Object.values(_offerCountdownTimers).forEach(t=>clearInterval(t));
  _offerCountdownTimers = {};

  empty.style.display = 'none';
  grid.innerHTML = '<p style="color:var(--text2);font-size:.85rem;grid-column:1/-1">Loading offers…</p>';

  const [allCampaigns, ownedIds] = await Promise.all([
    fetchActiveCampaigns(),
    _getOwnedActiveCampaignIds()
  ]);
  const campaigns = allCampaigns.filter(c => !ownedIds.has(c.id));

  if(!campaigns.length){
    grid.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }

  grid.innerHTML = campaigns.map(c => `
    <div class="offer-card" id="offer-card-${c.id}">
      <div class="campaign-badge">🎉 Limited Time Offer</div>
      <div class="campaign-hero">
        <div class="campaign-icon">${c.icon}</div>
        <h2 class="campaign-title">${c.title}</h2>
        ${c.description ? `<p class="campaign-desc">${c.description}</p>` : ''}
        <div class="campaign-price-amt">${c.price}</div>
      </div>
      <ul class="campaign-perks">
        ${c.perks.map(p=>`<li>✓ ${p}</li>`).join('')}
      </ul>
      <div class="campaign-countdown">
        <div class="campaign-countdown-lbl">⏳ Offer Ends In</div>
        <div class="campaign-countdown-units">
          <div class="campaign-unit"><span id="offer-d-${c.id}">00</span><small>Days</small></div>
          <div class="campaign-unit"><span id="offer-h-${c.id}">00</span><small>Hrs</small></div>
          <div class="campaign-unit"><span id="offer-m-${c.id}">00</span><small>Min</small></div>
          <div class="campaign-unit"><span id="offer-s-${c.id}">00</span><small>Sec</small></div>
        </div>
      </div>
      <div class="campaign-actions">
        <button class="btn bp campaign-buy" onclick="campaignBuyPass('${c.id}')">⚡ ${c.purchaseMethod==='coins' ? `Redeem ${c.coinPrice} 🪙` : 'Buy Pass'}</button>
      </div>
    </div>
  `).join('');

  campaigns.forEach(c=>{
    _updateOfferCountdown(c);
    _offerCountdownTimers[c.id] = setInterval(()=>_updateOfferCountdown(c), 1000);
  });
}

function _updateOfferCountdown(c){
  const dEl=document.getElementById('offer-d-'+c.id), hEl=document.getElementById('offer-h-'+c.id),
        mEl=document.getElementById('offer-m-'+c.id), sEl=document.getElementById('offer-s-'+c.id);
  if(!dEl){ clearInterval(_offerCountdownTimers[c.id]); return; }

  const diff = c.endsAt.getTime() - Date.now();
  const pad = n => String(Math.max(n,0)).padStart(2,'0');

  if(diff <= 0){
    clearInterval(_offerCountdownTimers[c.id]);
    delete _offerCountdownTimers[c.id];
    const card = document.getElementById('offer-card-'+c.id);
    if(card) card.remove();
    const grid = document.getElementById('offersGrid');
    if(grid && !grid.children.length){
      document.getElementById('offersEmpty').style.display = 'flex';
    }
    return;
  }
  dEl.textContent = pad(Math.floor(diff / 86400000));
  hEl.textContent = pad(Math.floor((diff % 86400000) / 3600000));
  mEl.textContent = pad(Math.floor((diff % 3600000) / 60000));
  sEl.textContent = pad(Math.floor((diff % 60000) / 1000));
}

function openPhotoLightbox(url){
  if(!url) return;
  document.getElementById('photoLightboxImg').src=url;
  document.getElementById('photoLightbox').classList.add('on');
}
/* markErr now comes from js/common/utils.js, loaded before this file. */
/* showToast now comes from js/common/toast.js, loaded before this file. */

/* ── NAV ───────────────────────────────────────────────────── */
function goPage(id){
  /* Phase 6.6: booking no longer lets a customer browse and pick an
     individual worker — jobs are broadcast to every eligible worker,
     first to accept gets it. Services (browse workers) is retired;
     any leftover entry point redirects Home instead of rendering it. */
  if(id==='services') id='home';

  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.nl[data-pg]').forEach(l=>l.classList.remove('on'));

  const pg=document.getElementById('page-'+id);
  if(!pg) return;

  pg.classList.add('on');

  const b=document.querySelector(`.nl[data-pg="${id}"]`);
  if(b) b.classList.add('on');

  window.scrollTo({top:0,behavior:'smooth'});

  if(id==='services') renderServices();
  if(id==='home'){ renderHomeCats(); }
  if(id==='bookings') renderBookings();
  if(id==='account') renderAccount();
  if(id==='househelp') renderHousehelp();
  if(id==='offers') renderOffers();
  if(id==='passes') renderMyPasses();
  if(id!=='offers'){
    Object.values(_offerCountdownTimers).forEach(t=>clearInterval(t));
    _offerCountdownTimers = {};
  }

  clearInterval(window._bookingPoll);

  if(id==='bookings'){
    window._bookingPoll = setInterval(async () => {
  const all = normalizeBookings(await DB.bookings());

  /* Update only the live tracking markers. */
  updateTrackingMaps(all);

  /* Re-render if booking count/status changed, OR if any advance
     booking's reveal state flipped (e.g. crossed the 10-minute mark).
     shouldReveal() is the existing single source of truth — reused
     as-is, not reimplemented — this just makes it part of what the
     poll compares so a state change is never missed without a
     manual refresh. */
  const snapshot = all.map(b => `${b.id}:${b.status}:${shouldReveal(b)}`).join('|');

  if (window._bookingSnapshot !== snapshot) {
    window._bookingSnapshot = snapshot;
    renderBookings();
  }
}, CONSTANTS.CUSTOMER_BOOKING_POLL_INTERVAL_MS);
  }
}
function toggleMenu(){
  document.getElementById('navLinks').classList.toggle('open');
  document.getElementById('navOverlay').classList.toggle('on');
}
// Responsive-only addition: close the mobile hamburger menu after a nav item is tapped.
// Does not alter navigation behavior, IDs, or any existing handler — purely closes the panel.
document.querySelectorAll('#navLinks a, #navLinks button').forEach(function(el){
  el.addEventListener('click', function(){
    document.getElementById('navLinks').classList.remove('open');
    document.getElementById('navOverlay').classList.remove('on');
  });
});
function goBack(){ sst.catId?goPage('smart'):goPage('services'); }
function doSearch(){ filters.search=document.getElementById('homeSearch').value; document.getElementById('svcSearch').value=filters.search; goPage('services'); }

/* ── HOME ──────────────────────────────────────────────────── */
function renderHomeCats(){
  const e=isEmerg();
  /* Show all cats including Househelp (househelp not available during emergency) */
  const vis=e ? CATS.filter(c=>EROLES.includes(c.id)) : CATS;
  const hhCard=e?'':'<div class="catc" onclick="openCategory(\'Househelp\')"><div class="catic">🏠</div><div class="catlbl">Househelp</div></div>';
  const mwCard=e?'':'<div class="catc" onclick="openCategory(\'Massage & Wellness\')"><div class="catic">💆</div><div class="catlbl">Massage & Wellness</div></div>';
  document.getElementById('homeCats').innerHTML=
    vis.map(c=>`<div class="catc" onclick="openCategory('${c.id}')"><div class="catic">${c.em}</div><div class="catlbl">${c.lb}</div></div>`).join('')+
    hhCard+
    mwCard+
    (e?`<div style="grid-column:1/-1;text-align:center;font-size:.76rem;color:var(--emerg);font-weight:600;padding:.4rem .875rem;background:var(--emerg-light);border-radius:var(--radius-sm);border:1px solid var(--emerg-border)">🚨 Emergency hours — Only Electrician &amp; Plumber available (8:30 PM – 8:30 AM IST)</div>`:'');
}
/* ── HOUSEHELP PICKER ──────────────────────────────────────── */
function renderHousehelp(){
  document.getElementById('hhSections').innerHTML=HH_SECTIONS.map(sec=>`
    <div class="hhsec">
      <div class="hhsec-title">${sec.title}</div>
      <div class="hhgrid">
        ${sec.items.map(it=>`
          <div class="hhbtn" onclick="bookHousehelp('${it.n.replace(/'/g,"\\'")}',${it.p})">
            <div class="hhbtn-left">
              <div class="hhbtn-name">${it.n}</div>
              <div class="hhbtn-price">₹${it.p}</div>
            </div>
            <div class="hhbtn-arrow">›</div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

async function bookHousehelp(serviceName, price){
  const workers=await DB.workers('Househelp');
  if(!workers.length){ showToast('⚠️ No Househelp workers available right now'); return; }
  sst={catId:'Househelp', item:serviceName, issue:''};
  openBookingForRole('Househelp');
}

/* ── MASSAGE & WELLNESS ──────────────────────────────────── */
/* ── SMART SEARCH (other categories) ───────────────────────── */

async function renderStep(step){
  drawStepBar(step);
  const cat=CATS.find(c=>c.id===sst.catId);
  ['ss1','ss2','ss3'].forEach((id,i)=>document.getElementById(id).style.display=(i+1===step)?'':'none');

  if(step===1){
    document.getElementById('ss1').innerHTML=`<div class="ibox">
      <h3>${cat.em} What needs attention?</h3><p>Select the item or area that needs service</p>
      <div class="igrid">${cat.items.map(it=>`<div class="ibtn${sst.item===it.l?' sel':''}" onclick="pickItem('${it.l}')"><span class="ii">${it.i}</span>${it.l}</div>`).join('')}</div>
      ${sst.item?`<button class="btn bp bfull" style="margin-top:.5rem" onclick="renderStep(2)">Next: Describe Issue →</button>`:''}</div>`;
  }

  if(step===2){
    document.getElementById('ss2').innerHTML=`<div class="ibox">
      <h3>📝 Describe the issue</h3><p>Tell us what's wrong with your <strong>${sst.item}</strong> in simple words</p>
      <div class="fg"><textarea class="finput" id="issueText" rows="4" placeholder="e.g. My fan makes a noise and spins slowly…" style="resize:vertical">${sst.issue}</textarea></div>
      <div style="display:flex;gap:.65rem">
        <button class="btn bo" onclick="renderStep(1)">← Back</button>
        <button class="btn bp" style="flex:1;justify-content:center" onclick="runSearch()">🔍 Find Workers →</button>
      </div></div>`;
  }

  if(step===3){
    sst.issue=document.getElementById('issueText')?.value||sst.issue;
    const e=isEmerg();
    /* DB.workers() already filters is_available=true server-side */
    let pool=await DB.workers(sst.catId);
    if(e) pool=pool.filter(w=>w.ea);
    pool.sort((a,b)=>a.dist-b.dist);
    const noW=pool.length===0;
    const nearest=pool[0];
    document.getElementById('ss3').innerHTML=
      (e?`<div class="ebanner"><div class="ebi">🚨</div><div><h3>Emergency Hours (8:30 PM – 8:30 AM IST)</h3><p>Only 24/7 emergency workers shown. Nearest worker auto-assigned.</p></div></div>`:'')+
      (noW?`<div class="hnotice emerg"><span class="hi">⚠️</span><div><strong>No workers available right now</strong><br/>Please try again shortly or choose a different category.</div></div>`:'')+
      `<div class="ibox" style="margin-bottom:1rem">
        <div style="font-size:.79rem;color:var(--text2);margin-bottom:.4rem">Your request:</div>
        <strong>${cat.em} ${sst.item}</strong>
        ${sst.issue?`<div style="font-size:.79rem;color:var(--text2);margin-top:.3rem">"${sst.issue}"</div>`:''}
        <button class="btn bo" style="margin-top:.65rem;font-size:.76rem;padding:6px 12px" onclick="renderStep(2)">✏️ Edit</button>
      </div>
      <div style="background:var(--surface);border-radius:var(--radius);border:1px solid var(--border);padding:1.5rem;box-shadow:var(--sh0);text-align:center">
        <div style="font-size:2rem;margin-bottom:.5rem">📋</div>
        <h3 style="font-size:1rem;font-weight:700;margin-bottom:.4rem">Ready to Book</h3>
        <p style="font-size:.82rem;color:var(--text2);margin-bottom:1.25rem">
          ${noW?'No workers available in your area right now.'
            :`${pool.length} worker${pool.length!==1?'s':''} available · Nearest is <strong>${nearest.dist} km</strong> away`}
        </p>
        <button class="btn${e?' be':' bp'} blg bfull"
          ${noW?'disabled style="opacity:.5;cursor:not-allowed"':'onclick="openBookingFromSmart()"'}>
          ${noW?'⚠️ No Workers Available':e?'🚨 Request Emergency Worker':'📅 Continue to Booking'}
        </button>
      </div>`;
  }
}

function pickItem(l){ sst.item=l; renderStep(1); }
function runSearch(){ sst.issue=document.getElementById('issueText')?.value.trim()||''; renderStep(3); }
async function openBookingFromSmart(){
  const e=isEmerg();
  let pool=await DB.workers(sst.catId);
  if(e) pool=pool.filter(w=>w.ea);
  if(!pool.length){ showToast('⚠️ No workers available right now.'); return; }
  openBookingForRole(sst.catId);
}

function drawStepBar(cur){
  const steps=['Select Item','Describe Issue','Results'];
  document.getElementById('stepBar').innerHTML=steps.map((s,i)=>{
    const n=i+1, cls=n<cur?'done':n===cur?'cur':'', lc=n<cur?'done':'';
    return `<div class="snode ${cls}"><div class="snum">${n<cur?'✓':n}</div>${s}</div>${n<steps.length?`<div class="sline ${lc}"></div>`:''}`;
  }).join('');
}

/* ── WORKER CARD ──────────────────────────────────────────── */
function wCard(w){
  const e=isEmerg()&&w.ea;
  return `<div class="wcard${e?' ec':''}" onclick="openProfile(${w.id})">
    ${w.ea?`<div class="webadge"><span class="bdg bge">🚨 24/7</span></div>`:''}
    <div class="wtop">
      <div class="wav">🔒</div>
      <div class="wmeta">
        <div class="wanon">Identity revealed after booking</div>
        <div class="wrole${e?' er':''}">${w.emoji} ${w.role}</div>
        <div class="wstars">
  ${stars(Number(w.rating || 0))}
  <span class="rnum">
    ${Number(w.rating || 0).toFixed(1)}
    (${w.total_jobs || 0} jobs)
  </span>
</div>
      </div>
    </div>
    <div class="wdesc">
  ${w.skill || w.role}
</div>
    <div class="wfoot">
      <div>
  <div class="wprice">
    ₹${w.basePrice || w.base_price || 149}
    <span>/ visit</span>
  </div>

  <div class="wmeta2">
    📍 ${w.dist ?? 5} km away · ${w.experience || w.exp || 0} yrs
  </div>
</div>
      <button class="btn${e?' be':' bp'}" onclick="event.stopPropagation();openBooking(${w.id})">Book</button>
    </div>
  </div>`;
}

/* ── SERVICES PAGE ────────────────────────────────────────── */
function setFilter(type,val,btn){
  filters[type]=val;
  btn.closest('.fbar').querySelectorAll('.fbtn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  applyFilters();
}
/* Phase 6.5: svcSearch fires oninput on every keystroke, and
   renderServices() -> DB.workers() does a full workers SELECT * plus
   a get_worker_stats_bulk RPC call each time it runs. Typing an
   11-letter word previously fired 11 full fetches. Debounced to one
   fetch, 300ms after the user stops typing. */
let _applyFiltersDebounce=null;
function applyFilters(){
  clearTimeout(_applyFiltersDebounce);
  _applyFiltersDebounce=setTimeout(()=>{
    filters.search=document.getElementById('svcSearch').value.toLowerCase();
    renderServices();
  }, 300);
}

async function renderServices(){
  const e=isEmerg();
  let ws=await DB.workers();
  if(e) ws=ws.filter(w=>EROLES.includes(w.role)&&w.ea);
  else if(filters.cat!=='all') ws=ws.filter(w=>w.role===filters.cat);
  if(filters.search) ws=ws.filter(w=>w.role.toLowerCase().includes(filters.search)||w.desc.toLowerCase().includes(filters.search));
  if(filters.sort==='rating') ws.sort((a,b)=>b.rating-a.rating);
  if(filters.sort==='price-asc') ws.sort((a,b)=>a.price-b.price);
  if(filters.sort==='price-desc') ws.sort((a,b)=>b.price-a.price);
  const note=e?`<div style="grid-column:1/-1;font-size:.78rem;color:var(--emerg);font-weight:600;background:var(--emerg-light);border:1px solid var(--emerg-border);border-radius:var(--radius-sm);padding:.5rem .875rem;margin-bottom:.875rem">🚨 Emergency Hours — Only Electrician &amp; Plumber (24/7) workers shown (8:30 PM – 8:30 AM IST)</div>`:'';
  document.getElementById('svcCount').textContent=`Showing ${ws.length} professional${ws.length!==1?'s':''}`;
  document.getElementById('svcGrid').innerHTML=note+(ws.length===0?`<div class="empty" style="grid-column:1/-1"><div class="emptyico">🔍</div><h3>No results</h3><p>Try different filters.</p></div>`:ws.map(wCard).join(''));
}

/* ── PROFILE ──────────────────────────────────────────────── */
async function openProfile(id){
  const w=await DB.workerById(id); if(!w) return;
  curW=w;
  document.getElementById('profBread').textContent=w.role+' Professional';
  document.getElementById('profContent').innerHTML=`
    <div class="profhero">
      <div class="pav">🔒</div>
      <div class="pinf">
        <div class="pnm">Identity revealed after booking</div>
        <div class="prl">${w.emoji} ${w.role}${w.ea?' &nbsp;<span class="bdg bge">🚨 24/7</span>':''}</div>
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:.5rem">${stars(w.rating)}<span style="font-size:.8rem;color:var(--text2)">${w.rating} · ${w.reviews} reviews</span></div>
        <span class="bdg bgn">✔ Verified</span>&nbsp;<span class="bdg bgg">📞 Name &amp; contact after booking</span>
        <div style="margin-top:.4rem;font-size:.76rem;color:var(--text2)">📍 ${w.dist} km away</div>
        <div class="pstats">
          <div class="pstat"><strong>${w.exp}</strong><span>Experience</span></div>
          <div class="pstat"><strong>${w.reviews}</strong><span>Reviews</span></div>
          <div class="pstat"><strong>See services</strong><span>Pricing</span></div>
          <div class="pstat"><strong>${w.rating}★</strong><span>Rating</span></div>
        </div>
      </div>
      <div style="align-self:center"><button class="btn bp blg" onclick="openBooking(${w.id})">📅 Book Service</button></div>
    </div>
    <div class="csec"><div class="cst">📖 About</div><p style="font-size:.875rem;color:var(--text2);line-height:1.65">${w.desc} With ${w.exp} of experience, has served 200+ satisfied customers.</p></div>
    <div class="csec"><div class="cst">🛠 Services &amp; Pricing</div><ul class="svlist">${w.svcs.map(s=>`<li class="svitem"><span class="svnm">${s.n}</span><span class="svpr">₹${s.p}</span></li>`).join('')}</ul></div>
    <div class="csec"><div class="cst">💬 Reviews (${w.revs.length})</div><div class="revlist">${w.revs.map(r=>`<div class="revcard"><div class="revhdr"><span class="revauth">${r.a}</span><span>${stars(r.s)}</span></div><p class="revtxt">${r.t}</p></div>`).join('')}</div></div>`;
  goPage('profile');
}

/* ── MY ACCOUNT (the logged-in user's own profile) ───────────
   Separate from openProfile()/#page-profile above, which shows a
   WORKER's public profile to a customer browsing services. This is
   the customer's own account: name/email/phone/saved address,
   booking history, and password change. */
async function openAccount(){
  goPage('account');
}

async function renderAccount(){
  const det=document.getElementById('acctDetails');
  det.textContent='Loading…';

  const {data:{session}}=await sb.auth.getSession();
  if(!session?.user){ det.textContent='Could not load account details.'; return; }

  const {data:u,error}=await sb.from('users').select('*').eq('id',session.user.id).single();
  if(error||!u){
    det.textContent='Could not load account details.';
  } else {
    det.innerHTML=`
      <div><strong>Name:</strong> ${u.name||'—'}</div>
      <div><strong>Email:</strong> ${u.email||session.user.email||'—'}</div>
      <div><strong>Phone:</strong> ${u.phone||'—'}</div>
      <div><strong>Saved Address:</strong> ${u.saved_address||'—'}</div>`;
  }
  const acctUsernameEl=document.getElementById('acctUsername');
  if(acctUsernameEl) acctUsernameEl.value = u?.email || session.user.email || ''; 

  const bc=document.getElementById('acctBookings');
  const all=await DB.bookings();
  if(!all.length){
    bc.innerHTML=`<div class="empty"><div class="emptyico">📋</div><h3>No bookings yet</h3><p>Your bookings will appear here.</p></div>`;
    return;
  }
  const sorted=[...all].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  bc.innerHTML=`<div class="bklist">${sorted.map(b=>`
    <div class="bkitem">
      <div class="bkico">${b.workerEmoji||'🔧'}</div>
      <div class="bkdet">
        <div class="bktit">${b.service||'Service'}</div>
        <div class="bkmeta"><span>${fmtDate(b.date)}</span><span>${fmt12(b.time)}</span></div>
      </div>
      <div class="bkst"><span class="bdg bgg">${b.status||'—'}</span></div>
    </div>`).join('')}</div>`;
}

async function openQuickWallet(){
  document.getElementById('walletModal').classList.add('on');

  const {data:{session}}=await sb.auth.getSession();
  if(!session?.user) return;

  const {data:u,error}=await sb.from('users').select('quickcoins_balance,quickcoins_earned,quickcoins_redeemed,total_completed_bookings').eq('id',session.user.id).single();
  if(error||!u) return;

  document.getElementById('wBalance').textContent=(u.quickcoins_balance ?? 0);
  document.getElementById('wEarned').textContent=(u.quickcoins_earned ?? 0);
  document.getElementById('wRedeemed').textContent=(u.quickcoins_redeemed ?? 0);
  document.getElementById('wBookings').textContent=(u.total_completed_bookings ?? 0);
}
window.openQuickWallet = openQuickWallet;

async function changeAccountPassword(){
  const pw=document.getElementById('acctNewPw').value;
  const cpw=document.getElementById('acctConfirmPw').value;
  const msg=document.getElementById('acctPwMsg');
  msg.textContent='';

  if(!pw||pw.length<CONSTANTS.MIN_PASSWORD_LENGTH){
    msg.innerHTML=`<p style="color:var(--danger);font-size:.82rem;margin-bottom:.75rem">Password must be at least 6 characters.</p>`;
    return;
  }
  if(pw!==cpw){
    msg.innerHTML=`<p style="color:var(--danger);font-size:.82rem;margin-bottom:.75rem">Passwords do not match.</p>`;
    return;
  }

  const {error}=await sb.auth.updateUser({password:pw});
  if(error){
    msg.innerHTML=`<p style="color:var(--danger);font-size:.82rem;margin-bottom:.75rem">${error.message}</p>`;
    return;
  }
  msg.innerHTML=`<p style="color:var(--teal);font-size:.82rem;margin-bottom:.75rem">✅ Password updated successfully.</p>`;
  document.getElementById('acctNewPw').value='';
  document.getElementById('acctConfirmPw').value='';
}

/* Phase 6.6: broadcast-model booking entry point. Unlike openBooking(id)
   below (still present, still used by openProfile()'s "Book Service"
   button as a legacy direct-book path), this never fetches or locks a
   specific worker — curW holds only role/emoji/pricing context, which
   updatePrice()/onAreaChange()/initiateBooking() already read
   generically via curW.role, not curW.id. */
async function openBookingForRole(catId){
  const cat=CATS.find(c=>c.id===catId);
  const emoji=cat?cat.em:'🔧';
  const label=cat?cat.lb:catId;
  curW={
    role: catId,
    emoji: emoji,
    svcs: getCategorySections(catId).flatMap(sec=>sec.items).map(it=>({n:it.n,p:it.p}))
  };
  const e=isEmerg();
  document.getElementById('bkBread').textContent=label;
  document.getElementById('bkWorkerInfo').innerHTML=`
    <div style="display:flex;align-items:center;gap:11px;background:var(--surface2);border-radius:var(--radius-sm);padding:.95rem;border:1px solid var(--border)">
      <div style="width:44px;height:44px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">${emoji}</div>
      <div>
        <div style="font-weight:700;font-size:.9rem">${label} Service</div>
        <div style="font-size:.76rem;color:var(--text2)">Your job will be sent to nearby available workers — first to accept gets it</div>
      </div>
    </div>`;

  const sel=document.getElementById('bkSvc');
  sel.innerHTML=curW.svcs.map(s=>`<option value="${s.p}" data-sname="${s.n}">${s.n} — ₹${s.p}</option>`).join('');
  if(sst.item){
    const kw=sst.item.toLowerCase();
    let best=-1, bscore=-1;
    for(let i=0;i<sel.options.length;i++){
      const sn=sel.options[i].dataset.sname.toLowerCase();
      const sc=sn===kw?4:sn.includes(kw)?3:sn.startsWith(kw)?2:sn.split(' ').some(w=>w.startsWith(kw))?1:0;
      if(sc>bscore){bscore=sc;best=i;}
    }
    if(best>=0&&bscore>0) sel.selectedIndex=best;
    if(sst.issue) document.getElementById('bkNotes').value=sst.issue;
  } else { document.getElementById('bkNotes').value=''; }

  const tg=document.getElementById('bkTimeGrp');
  if(e){ tg.style.display='none'; document.getElementById('bkTime').value=nowSlot(); }
  else { tg.style.display=''; buildSlots(); document.getElementById('bkTime').value=''; }

  const today=istDateStr();
  const maxDt=getIST(); maxDt.setDate(maxDt.getDate()+30);
  const maxStr=`${maxDt.getFullYear()}-${String(maxDt.getMonth()+1).padStart(2,'0')}-${String(maxDt.getDate()).padStart(2,'0')}`;
  document.getElementById('bkDate').min=today;
  document.getElementById('bkDate').max=maxStr;
  document.getElementById('bkDate').value='';
  document.getElementById('bkAddr').value='';
  await populateAreaDropdown();
  document.getElementById('bkAreaNote').textContent='';
  document.getElementById('bkNotice').innerHTML=e?`<div class="hnotice emerg"><span class="hi">🚨</span><div><strong>Emergency Hours Active (8:30 PM – 8:30 AM IST)</strong><br/>Nearest available worker will be dispatched. Time set to now automatically.</div></div>`:'';
  setBkBtn(e); updatePrice(); goPage('booking');
}

/* ── BOOKING PAGE ─────────────────────────────────────────── */
async function openBooking(id){
  const w=await DB.workerById(id); if(!w) return;
  curW=w;
  const e=isEmerg();
  document.getElementById('bkBread').textContent=w.role;
  document.getElementById('bkWorkerInfo').innerHTML=`
    <div style="display:flex;align-items:center;gap:11px;background:var(--surface2);border-radius:var(--radius-sm);padding:.95rem;border:1px solid var(--border)">
      <div style="width:44px;height:44px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">${w.emoji}</div>
      <div>
        <div style="font-weight:700;font-size:.9rem">${w.role} Service</div>
        <div style="font-size:.76rem;color:var(--text2)">Nearest worker · ${w.dist} km radius</div>
        ${w.ea?'<span class="bdg bge" style="margin-top:3px;display:inline-flex">🚨 Emergency Available</span>':''}
      </div>
      <div style="margin-left:auto;text-align:right">
  <div style="display:flex;justify-content:flex-end;gap:2px;line-height:1">
    ${stars(w.rating)}
  </div>
  <span style="font-size:.68rem;color:var(--text3)">
    🔒 Identity hidden
  </span>
</div>
    </div>`;

  const sel=document.getElementById('bkSvc');
  sel.innerHTML=w.svcs.map(s=>`<option value="${s.p}" data-sname="${s.n}">${s.n} — ₹${s.p}</option>`).join('');
  if(sst.item){
    const kw=sst.item.toLowerCase();
    let best=-1, bscore=-1;
    for(let i=0;i<sel.options.length;i++){
      const sn=sel.options[i].dataset.sname.toLowerCase();
      const sc=sn===kw?4:sn.includes(kw)?3:sn.startsWith(kw)?2:sn.split(' ').some(w=>w.startsWith(kw))?1:0;
      if(sc>bscore){bscore=sc;best=i;}
    }
    if(best>=0&&bscore>0) sel.selectedIndex=best;
    if(sst.issue) document.getElementById('bkNotes').value=sst.issue;
  } else { document.getElementById('bkNotes').value=''; }

  const tg=document.getElementById('bkTimeGrp');
  if(e){ tg.style.display='none'; document.getElementById('bkTime').value=nowSlot(); }
  else { tg.style.display=''; buildSlots(); document.getElementById('bkTime').value=''; }

  const today=istDateStr();
  const maxDt=getIST(); maxDt.setDate(maxDt.getDate()+30);
  const maxStr=`${maxDt.getFullYear()}-${String(maxDt.getMonth()+1).padStart(2,'0')}-${String(maxDt.getDate()).padStart(2,'0')}`;
  document.getElementById('bkDate').min=today;
  document.getElementById('bkDate').max=maxStr;
  document.getElementById('bkDate').value='';
  document.getElementById('bkAddr').value='';
  await populateAreaDropdown();
  document.getElementById('bkAreaNote').textContent='';
  document.getElementById('bkNotice').innerHTML=e?`<div class="hnotice emerg"><span class="hi">🚨</span><div><strong>Emergency Hours Active (8:30 PM – 8:30 AM IST)</strong><br/>Worker dispatched immediately. Time set to now automatically.</div></div>`:'';
  setBkBtn(e); updatePrice(); goPage('booking');
}

function setBkBtn(e){
  const b=document.getElementById('bkBtn');
  b.textContent=e?'🚨 Request Emergency Worker & Pay':'📡 Book & Pay';
  b.className=`btn ${e?'be':'bp'} bfull blg`;
}

/* ── AREA DROPDOWN (area-based assignment) ───────────────────
   Populates from the areas table — no external geocoding API.
   Selected area's lat/lng drive Haversine-based worker matching. */
async function populateAreaDropdown(){
  const sel=document.getElementById('bkArea');
  const areas=await loadAreas();
  if(!areas.length){
    sel.innerHTML='<option value="">No service areas configured</option>';
    return;
  }
  sel.innerHTML='<option value="">Select your area…</option>'+
    areas.map(a=>`<option value="${a.id}">${a.name}</option>`).join('');
  sel.value='';
}

async function onAreaChange(){
  const sel=document.getElementById('bkArea');
  const note=document.getElementById('bkAreaNote');
  const areaId=sel.value;
  if(!areaId){ note.textContent=''; return; }
  const areas=await loadAreas();
  const area=areas.find(a=>String(a.id)===String(areaId));
  if(!area || area.lat==null || area.lng==null){
    note.innerHTML='<span style="color:var(--danger)">⚠️ This area has no coordinates configured — booking cannot be matched.</span>';
    return;
  }
  if(!curW || !curW.role){ note.textContent=''; return; }
  const e=isEmerg();
  const eligible=await getEligibleWorkersForArea(curW.role, area, {emergencyOnly:e});
  if(!eligible.length){
    note.innerHTML=`<span style="color:var(--danger)">⚠️ No ${curW.role} workers available within ${MAX_ASSIGN_KM} km of ${area.name} right now.</span>`;
  } else {
    note.innerHTML=`<span style="color:var(--teal)">✔ ${eligible.length} worker${eligible.length>1?'s':''} available near ${area.name} (nearest ${eligible[0].kmDist.toFixed(1)} km)</span>`;
  }
}

function buildSlots(){
  const sel=document.getElementById('bkTime');
  const dateVal=document.getElementById('bkDate').value;
  const ist=getIST(), isToday=(dateVal===istDateStr()), nowMins=ist.getHours()*60+ist.getMinutes();
  sel.innerHTML='<option value="">Select time…</option>';
  const startMins=WS_H*60+WS_M, endMins=WE_H*60+WE_M;
  for(let t=startMins;t<=endMins;t+=15){
    if(isToday&&t<=nowMins) continue;
    const h=Math.floor(t/60), m=t%60;
    const hh=String(h).padStart(2,'0'), mm=String(m).padStart(2,'0');
    sel.innerHTML+=`<option value="${hh}:${mm}">${fmt12(`${hh}:${mm}`)}</option>`;
  }
  if(isToday&&sel.options.length===1) sel.innerHTML='<option value="">No more slots today — pick tomorrow</option>';
}

function onDateChange(){ if(!isEmerg()){ buildSlots(); document.getElementById('bkNotice').innerHTML=''; } }
function onTimeChange(){
  if(isEmerg()) return;
  const t=document.getElementById('bkTime').value, el=document.getElementById('bkNotice');
  if(!t){el.innerHTML='';return;}
  el.innerHTML=!inWork(t)
    ?`<div class="hnotice emerg"><span class="hi">🚨</span><div><strong>Outside working hours (8:30 AM – 8:30 PM)</strong><br/>Request goes to 24/7 emergency workers only.</div></div>`
    :`<div class="hnotice normal"><span class="hi">🕙</span><div>Working hours: <strong>8:30 AM – 8:30 PM</strong>. Slot is within working hours.</div></div>`;
}

/* Phase 7: fixed QuickCoins redemption tiers — MUST exactly mirror
   quickcoins_redemption_value() server-side. This list is display/UI
   only; the server independently recomputes and enforces the
   discount from coins_redeemed via that function, never trusting
   whatever the client sends. */
const REDEMPTION_TIERS = [
  {coins:1000, discount:200},
  {coins:500,  discount:75},
  {coins:250,  discount:30},
  {coins:100,  discount:10}
];

async function _getMyQuickCoinsBalance(){
  const {data:{session}} = await sb.auth.getSession();
  if(!session?.user) return 0;
  const {data} = await sb.from('users').select('quickcoins_balance').eq('id',session.user.id).single();
  return data?.quickcoins_balance || 0;
}

async function _populateRedeemDropdown(){
  const sel=document.getElementById('bkRedeem');
  if(!sel) return;
  const balance=await _getMyQuickCoinsBalance();
  const eligible=REDEMPTION_TIERS.filter(t=>t.coins<=balance);
  sel.innerHTML='<option value="0">Don\'t redeem coins</option>'+
    eligible.map(t=>`<option value="${t.coins}">${t.coins} coins → ₹${t.discount} off</option>`).join('');
  if(!eligible.length){
    sel.innerHTML+=`<option value="0" disabled>Not enough coins (balance: ${balance})</option>`;
  }
}

/* Phase 2D.1: resolves whether the logged-in user holds an active,
   unexpired, unused-up Service Pass for the current booking's
   category. Read by initiateBooking() at click time. No new columns:
   reads only status/visits_remaining/expiry_date/campaign_id from the
   existing user_passes table, and service from the existing campaigns
   table. */
let activeServicePass = null;

async function _checkActivePassForService(category){
  const {data:{session}} = await sb.auth.getSession();
  if(!session?.user || !category) return null;

  const nowIso = new Date().toISOString();
  const {data, error} = await sb.from('user_passes')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .gt('visits_remaining', 0)
    .gt('expiry_date', nowIso);
  if(error || !data || !data.length) return null;

  const campaignIds = [...new Set(data.map(p=>p.campaign_id))];
  const {data:campaignRows} = await sb.from('campaigns').select('id,service').in('id', campaignIds);
  const serviceById = {};
  (campaignRows||[]).forEach(c=>{ serviceById[c.id] = c.service; });

  return data.find(p => String(serviceById[p.campaign_id]||'').toLowerCase() === category.toLowerCase()) || null;
}

async function updatePrice(){
  const sel=document.getElementById('bkSvc'), opt=sel.options[sel.selectedIndex];
  const fixedBase=parseInt(sel.value)||0;
  const e=isEmerg();
  /* Emergency = fixed price × 1.5, calculated once here for display.
     The same formula is applied in initiateBooking() before storing. */
  const base=e&&fixedBase?Math.round(fixedBase*1.5):fixedBase;
  const fee=base?Math.min(50,Math.max(20,Math.round(base*.1))):0;
  document.getElementById('pSvc').textContent=opt?opt.dataset.sname:'—';

  activeServicePass = base ? await _checkActivePassForService(curW.role) : null;

  const payRow = document.getElementById('pPayMethodRow');
  const payVal = document.getElementById('pPayMethod');
  const redeemGrp = document.getElementById('bkRedeemGrp');
  const discountRow = document.getElementById('pDiscountRow');

  if(activeServicePass){
    /* Phase 7: redemption and a service pass are mutually exclusive —
       same rule the server enforces. */
    if(redeemGrp) redeemGrp.style.display='none';
    if(discountRow) discountRow.style.display='none';
    document.getElementById('pBase').textContent = '₹0 — Covered by Service Pass';
    document.getElementById('pFee').textContent = '₹0';
    document.getElementById('pTotal').textContent = '₹0';
    if(payRow){ payRow.style.display=''; payVal.textContent='⚡ Service Pass'; }
    return;
  }

  if(payRow) payRow.style.display='none';
  if(redeemGrp){
    redeemGrp.style.display='';
    if(!redeemGrp.dataset.loaded){ await _populateRedeemDropdown(); redeemGrp.dataset.loaded='1'; }
  }

  const redeemSel=document.getElementById('bkRedeem');
  const coinsRedeemed=base?(parseInt(redeemSel?.value)||0):0;
  const tier=REDEMPTION_TIERS.find(t=>t.coins===coinsRedeemed);
  const discount=tier?tier.discount:0;
  const total=Math.max(0, base+fee-discount);

  if(discount>0 && discountRow){
    discountRow.style.display='';
    document.getElementById('pDiscount').textContent=`− ₹${discount}`;
  } else if(discountRow){
    discountRow.style.display='none';
  }

  document.getElementById('pBase').textContent=base?`₹${base}${e?' (incl. 1.5× emergency)':''}`:'—';
  document.getElementById('pFee').textContent=base?`₹${fee}`:'—';
  document.getElementById('pTotal').textContent=base?`₹${total}`:'—';
}

/* ── ADDRESS CLEANING & GEOCODING (Phase 4.2) ────────────────
   Strips flat/wing/house/room/apartment identifiers so only the
   building/society name, landmark, road, area and city reach the
   geocoder. Flat numbers add noise and break address geocoding. */
function cleanAddressForGeocoding(raw){
  const FLAT_WORDS=/^(flat|apt|apartment|room|unit|door|house)\b/i;
  const WING_SUFFIX=/\s+(wing|floor|flr)$/i; // strips a trailing "wing"/"floor" word, e.g. "1301/B wing" -> "1301/B"
  const FLAT_PATTERN=/^[A-Za-z]{0,3}[-\/]?\d+[-\/]?[A-Za-z]{0,3}$/; // matches BOTH "B-1301" and "1301/B" style flat numbers
  return raw
    .split(',')
    .map(p=>p.trim())
    .filter(p=>{
      if(!p) return false;
      if(FLAT_WORDS.test(p)) return false;
      const stripped=p.replace(WING_SUFFIX,'').trim();
      if(/\d/.test(stripped) && FLAT_PATTERN.test(stripped)) return false;
      return true;
    })
    .join(', ');
}

/* Confirms a locality string mentions the selected area. Used against
   the geocoder's own suburb/neighbourhood field first; only falls
   back to checking the cleaned address text if the geocoder returned
   no locality at all. */
function addressMatchesArea(localityOrAddr, areaName){
  if(!areaName) return false;
  const norm=s=>s.toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
  return norm(localityOrAddr).includes(norm(areaName));
}

/* Geocodes the cleaned address via Nominatim (OpenStreetMap) — no
   API key required. Returns coordinates AND the locality/suburb/
   neighbourhood from the SAME successful response, so area
   validation never triggers a second lookup on a hit.
   Nominatim does strict matching: an unrecognized building/society
   name anywhere in the query commonly returns zero results for the
   whole query, even when the road/area/city portion is valid. On a
   zero-result response only, this retries with the leading (most
   specific, most likely-unrecognized) segment dropped, one at a
   time, until it finds a match or runs out of segments. */
async function geocodeAddress(cleanedAddr){
  async function tryQuery(q){
    const url=`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&addressdetails=1&q=${encodeURIComponent(q)}`;
    let res;
    try{
      res=await fetch(url,{headers:{'Accept':'application/json'}});
    }catch(networkErr){
      console.error('[geocode] 4. fetch failed before a response was received (network/CORS block):', networkErr);
      return null;
    }
    const rawText=await res.text();
    if(!res.ok){
      console.error('[geocode] request rejected by Nominatim, status', res.status);
      return null;
    }
    let data;
    try{
      data=JSON.parse(rawText);
    }catch(parseErr){
      console.error('[geocode] response was not valid JSON:', parseErr);
      return null;
    }
    if(!Array.isArray(data)||!data.length) return null;
    const lat=parseFloat(data[0].lat), lng=parseFloat(data[0].lon);
    if(!isFinite(lat)||!isFinite(lng)){
      console.error('[geocode] result had non-numeric lat/lng:', data[0].lat, data[0].lon);
      return null;
    }
    const a=data[0].address||{};
    /* Combine every locality-ish field instead of picking just one.
       Nominatim's suburb/neighbourhood ordering isn't consistent
       across areas — e.g. this exact response has neighbourhood
       "Tilak Nagar" AND suburb "Chheda Nagar" for the same point.
       Picking only the first non-null field can silently discard the
       one that actually matches the selected area. addressMatchesArea
       does a substring check, so handing it the combined string still
       matches correctly against any one of these fields. */
    const locality=[a.neighbourhood,a.suburb,a.locality,a.city_district,a.quarter,a.city]
      .filter(Boolean).join(' ');
    return {lat,lng,locality: locality || null};
  }

  const parts=cleanedAddr.split(',').map(p=>p.trim()).filter(Boolean);
  for(let i=0;i<Math.max(parts.length-1,1);i++){
    const attempt=parts.slice(i).join(', ');
    const result=await tryQuery(attempt);
    if(result) return result;
  }
  console.warn('[geocode] Nominatim returned zero results for every fallback attempt');
  return null;
} 

/* Phase 5.3.6: _geoapifyReverseGeocode moved to js/common/maps.js */



/* ── PHASE 4.6: PERMANENT CUSTOMER LOCATION PINNING ──────────
   Exact-string match against users.saved_address decides whether to
   offer reuse or go straight to the map picker. Nothing here touches
   booking creation itself — it only resolves pendBk.customerLat/
   customerLng before _continueAfterPin() runs the exact payment/pass
   logic that already existed. */
async function _resolveCustomerPin(addr, areaId, geo){
  const {data:{session}} = await sb.auth.getSession();
  let saved = null;
  if(session?.user){
    const {data:u} = await sb.from('users')
      .select('saved_address,saved_area_id,saved_lat,saved_lng')
      .eq('id', session.user.id).single();
    saved = u || null;
  }

  const exactMatch = !!(saved && saved.saved_address != null
    && saved.saved_address === addr
    && saved.saved_lat != null && saved.saved_lng != null);

  if(exactMatch){
    _showReusePinDialog(addr, areaId, geo, saved);
  } else {
    _openPinPicker(addr, areaId, geo, saved);
  }
}

function _showReusePinDialog(addr, areaId, geo, saved){
  document.getElementById('reusePinModal').classList.add('on');
  document.getElementById('reusePinYes').onclick = ()=>{
    closeModal('reusePinModal');
    pendBk.customerLat = saved.saved_lat;
    pendBk.customerLng = saved.saved_lng;
    _continueAfterPin();
  };
  document.getElementById('reusePinAgain').onclick = ()=>{
    closeModal('reusePinModal');
    _openPinPicker(addr, areaId, geo, saved);
  };
}

let _pinMap = null, _pinMarker = null;
function _openPinPicker(addr, areaId, geo, saved){
  document.getElementById('pinLocationModal').classList.add('on');
  const startLat = geo?.lat ?? saved?.saved_lat;
  const startLng = geo?.lng ?? saved?.saved_lng;

  setTimeout(()=>{
    const mapEl = document.getElementById('pinMapEl');
    if(_pinMap){ _pinMap.remove(); _pinMap = null; }
    _pinMap = L.map(mapEl, { zoomControl:true, attributionControl:false }).setView([startLat, startLng], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(_pinMap);
    _pinMarker = L.marker([startLat, startLng], { draggable:true }).addTo(_pinMap);
    _pinMarker.on('dragend', ()=>{});
    _pinMap.on('click', (ev)=>{
      _pinMarker.setLatLng(ev.latlng);
    });
    setTimeout(()=>{ _pinMap.invalidateSize(); }, CONSTANTS.MAP_INVALIDATE_DELAY_MS);
  }, 30);

  document.getElementById('confirmPinBtn').onclick = async ()=>{
    const ll = _pinMarker.getLatLng();
    const {data:{session}} = await sb.auth.getSession();
    if(session?.user){
      await sb.from('users').update({
        saved_address: addr,
        saved_area_id: areaId,
        saved_lat: ll.lat,
        saved_lng: ll.lng
      }).eq('id', session.user.id);
    }
    pendBk.customerLat = ll.lat;
    pendBk.customerLng = ll.lng;
    closeModal('pinLocationModal');
    _continueAfterPin();
  };
}

/* ── INITIATE BOOKING ─────────────────────────────────────── */
async function initiateBooking(){
  const date=document.getElementById('bkDate').value;
  const addr=document.getElementById('bkAddr').value.trim();
  const areaId=document.getElementById('bkArea').value;
  const sel=document.getElementById('bkSvc');
  const svcName=sel.options[sel.selectedIndex]?.dataset.sname||'';
  const fixedBase=parseInt(sel.value)||0;
  const e=isEmerg();
  /* Price always comes from fixed service prices in the select options.
     workers.price is never used. Emergency adds 1.5× multiplier once,
     stored into booking.price — never recalculated after this point. */
  const base=e&&fixedBase?Math.round(fixedBase*1.5):fixedBase;
  const fee=base?Math.min(50,Math.max(20,Math.round(base*.1))):0;
  const total=base+fee;
  let time=document.getElementById('bkTime').value;
  if(e) time=nowSlot();
  let ok=true;
  if(!date){markErr('bkDate');ok=false;}
  if(!time&&!e){markErr('bkTime');ok=false;}
  if(!addr){markErr('bkAddr');ok=false;}
  if(!areaId){markErr('bkArea');ok=false;}
  if(!ok){showToast('⚠️ Please fill in all required fields');return;}

  /* Phase 4.2: clear any previous inline address/area warning before
     re-validating this attempt. */
  const addrAreaWarn=document.getElementById('bkAddrAreaWarn');
  if(addrAreaWarn) addrAreaWarn.textContent='';

  /* Area-based assignment validation — block booking if no eligible
     worker exists within radius/MAX_ASSIGN_KM before a booking is even
     created. This is enforced again server-side in onAccepted(). */
  const areas=await loadAreas();
  const area=areas.find(a=>String(a.id)===String(areaId));
  if(!area || area.lat==null || area.lng==null){
    showToast('⚠️ Selected area has no coordinates — cannot validate assignment.');
    return;
  }
  const eligible=await getEligibleWorkersForArea(curW.role, area, {emergencyOnly:e});
  if(!eligible.length){
    showToast(`⚠️ No ${curW.role} workers available within ${MAX_ASSIGN_KM} km of ${area.name} right now.`);
    return;
  }

  /* Phase 4.2: clean the address, then run ONE geocode call. Locality
     validation and coordinates both come from that same response —
     no second Nominatim lookup. Either failure blocks the payment
     popup with an inline message; no alert(). */
  const cleanedAddr=cleanAddressForGeocoding(addr);
  const geo=await geocodeAddress(cleanedAddr);
  if(!geo){
    if(addrAreaWarn) addrAreaWarn.textContent='⚠️ Unable to locate this address. Please include your building/society name, road and locality.';
    markErr('bkAddr');
    return;
  }
  const areaMatches = geo.locality
    ? addressMatchesArea(geo.locality, area.name)
    : addressMatchesArea(cleanedAddr, area.name);
  if(!areaMatches){
    if(addrAreaWarn) addrAreaWarn.textContent='⚠️ This address does not belong to the selected area. Please choose the correct area.';
    markErr('bkAddr');
    return;
  }

  /* Phase 4.6: customerLat/customerLng are resolved AFTER this point
     — by _resolveCustomerPin() below — from the customer's permanent
     building pin, not directly from the area-level geocode. geo is
     passed through only to seed the map picker's initial center. */
  /* Phase 7: coinsRedeemed travels through pendBk -> bk -> DB.save() ->
     create_booking()'s p_coins_redeemed. The server independently
     recomputes and verifies this exact discount from coinsRedeemed via
     quickcoins_redemption_value() — never trusted on its own. */
  const redeemSel=document.getElementById('bkRedeem');
  const coinsRedeemed=activeServicePass?0:(parseInt(redeemSel?.value)||0);

  pendBk={
    workerId:curW.id, workerRole:curW.role, workerEmoji:curW.emoji,
    service:svcName, date, time, address:addr,
    price:total, basePrice:base,
    coinsRedeemed,
    notes:document.getElementById('bkNotes').value.trim(),
    isEmergency:e||!inWork(time),
    areaId, areaName:area.name, areaLat:area.lat, areaLng:area.lng,
    customerLat:null, customerLng:null
  };

  await _resolveCustomerPin(addr, areaId, geo);
}

/* Phase 4.6: everything below is UNCHANGED from what used to run
   immediately after pendBk was built — only WHEN it runs has moved,
   to after pendBk.customerLat/customerLng are set by the pin flow. */
function _continueAfterPin(){
  /* Phase 2D.1: pass-covered booking — skip the payment screen
     entirely and go straight to the existing broadcast flow.
     basePrice is left exactly as calculated above (the true service
     price), so whatever the existing system derives worker earning
     from is completely unaffected. Only price and paymentMethod are
     overridden — no new booking fields, no schema changes, no visit
     deduction here. */
  if(activeServicePass){
    pendBk.price = 0;
    pendBk.passUsed = true;
    pendBk.passId = activeServicePass.id;
    paymentMethod = 'Service Pass';
    startBroadcast();
    return;
  }

  paymentMethod=null;
  ['pGpay','pCash'].forEach(id=>document.getElementById(id).classList.remove('sel'));
  document.getElementById('gpaySection').style.display='none';
  document.getElementById('cashSection').style.display='none';
  document.getElementById('gpayOk').classList.remove('on');
  document.getElementById('cashAmt').textContent=`₹${pendBk.price}`;
  document.getElementById('payModal').classList.add('on');
}

/* ── PAYMENT ──────────────────────────────────────────────── */
function selectPay(m){
  paymentMethod=m;
  document.getElementById('pGpay').classList.toggle('sel',m==='gpay');
  document.getElementById('pCash').classList.toggle('sel',m==='cash');
  if(m==='gpay'){
    document.getElementById('gpaySection').style.display='';
    document.getElementById('cashSection').style.display='none';
    document.getElementById('gpayOk').classList.remove('on');
    drawQR(pendBk.price);
    startPoll();
  } else {
    document.getElementById('gpaySection').style.display='none';
    document.getElementById('cashSection').style.display='';
    stopPoll();
  }
}

function startPoll(){
  stopPoll(); pollCnt=0;
  let qrSecs=CONSTANTS.QR_PAYMENT_EXPIRY_SECONDS;
  document.getElementById('qrExpiry').style.display='';
  qrInt=setInterval(()=>{
    qrSecs--;
    const mn=Math.floor(qrSecs/60), sc=qrSecs%60;
    document.getElementById('qrCountdown').textContent=`${mn}:${String(sc).padStart(2,'0')}`;
    if(qrSecs<=0){ clearInterval(qrInt); stopPoll(); document.getElementById('qrExpiry').textContent='❌ QR expired — please try again'; }
  },1000);
  pollInt=setInterval(async()=>{
    pollCnt++;
    if(pollCnt>POLL_MAX){ stopPoll(); showToast('⚠️ Payment timeout. Try again or choose Cash.'); return; }
    if(await checkPayStatus()){ stopPoll(); onPayOk(); }
  },POLL_MS);
}

function stopPoll(){ clearInterval(pollInt); pollInt=null; pollCnt=0; clearInterval(qrInt); qrInt=null; }
async function checkPayStatus(){ return pollCnt>=3; }
function onPayOk(){
  document.getElementById('gpayOk').classList.add('on');
  setTimeout(()=>{ closeModal('payModal'); startBroadcast(); },CONSTANTS.GPAY_CONFIRM_REDIRECT_DELAY_MS);
}
function onCashConfirm(){ stopPoll(); closeModal('payModal'); startBroadcast(); }

function drawQR(amount){
  const url=`upi://pay?pa=quickfix@upi&pn=${encodeURIComponent('QuickFix')}&am=${amount}&cu=INR&tn=${encodeURIComponent('QuickFix Service Booking')}`;
  const cont=document.getElementById('qrCont'); cont.innerHTML='';
  function render(){
    try{
      new QRCode(cont,{text:url,width:190,height:190,colorDark:'#1a1a1a',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M});
      const d=document.createElement('div');
      d.innerHTML=`<div class="qramt">₹${amount}</div><div class="qrnote">quickfix@upi · Scan with any UPI app</div>`;
      cont.appendChild(d);
    } catch(e){ showQRFallback(); }
  }
  function showQRFallback(){
    cont.innerHTML=`<div style="padding:1rem;text-align:center"><div style="font-size:.78rem;color:var(--text2);margin-bottom:.5rem">Open in UPI app:</div><a href="${url}" style="color:var(--brand);font-weight:600;font-size:.78rem;word-break:break-all">${url}</a><div class="qramt" style="margin-top:.75rem">₹${amount}</div></div>`;
  }
  if(typeof QRCode!=='undefined'){ render(); }
  else {
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload=render;
    s.onerror=showQRFallback;
    s.setAttribute('crossorigin','anonymous');
    document.head.appendChild(s);
  }
}

/* ── BROADCAST ────────────────────────────────────────────── */
async function startBroadcast(){
  accLeft=CONSTANTS.WORKER_ACCEPT_TIMEOUT_SECONDS;
  clearInterval(accInt);

  const bkId = Date.now();
  const arrivalOtp = genOtp();
  const completionOtp = genOtp();
  const advance = isAdv(pendBk.date, pendBk.time);

  navigator.geolocation.getCurrentPosition(
  async (pos)=>{

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // Update current booking object immediately
    bk.customer_lat = lat;
    bk.customer_lng = lng;

    if(pendBk?._bk){
      pendBk._bk.customer_lat = lat;
      pendBk._bk.customer_lng = lng;
    }

    const { error } = await sb.from('bookings').update({
      customer_lat: lat,
      customer_lng: lng
    }).eq('id', String(bkId));

    if(error){
      console.error('Customer GPS update:', error.message);
    }
  },
  ()=>{},
  {
    enableHighAccuracy:true,
    timeout:8000,
    maximumAge:0
  }
);

  /* Phase 4.2: geocoded address coordinates seed customer_lat/lng at
     creation time. The live-GPS callback above is unchanged and will
     still overwrite them asynchronously if/when it resolves. */
  const bk = {
    id:           bkId,
    workerId:     pendBk.workerId,
    workerName:   curW.name||'',
    workerPhone:  curW.phone||'',
    workerRole:   pendBk.workerRole,
    workerEmoji:  pendBk.workerEmoji,
    workerDist:   null,
    service:      pendBk.service,
    date:         pendBk.date,
    time:         pendBk.time,
    address:      pendBk.address,
    areaId:       pendBk.areaId||null,
  customer_lat: pendBk.customerLat != null ? pendBk.customerLat : null,
  customer_lng: pendBk.customerLng != null ? pendBk.customerLng : null,
  price:        pendBk.price,
    basePrice:    pendBk.basePrice,
    notes:        pendBk.notes,
    isEmergency:  pendBk.isEmergency,
    isAdvance:    advance,
    paymentMethod,
    passUsed:     pendBk.passUsed || false,
    passId:       pendBk.passId || null,
    // Same basePrice already computed in initiateBooking() for every
    // booking (normal or pass-covered) — reused as-is, never recalculated.
    workerEarning: pendBk.basePrice,
    coinsRedeemed: pendBk.coinsRedeemed || 0,
    status:       CONSTANTS.BOOKING_STATUS.PENDING,
    wStatus:      CONSTANTS.BOOKING_STATUS.PENDING,
    arrivalOtp,
    completionOtp,
    rated:        false,
    createdAt:    new Date().toISOString()
  };

  const saved = await DB.save(bk);
  if(!saved){
    showToast('⚠️ Booking could not be saved. Please try again.');
    return;
  }

  pendBkId = bkId;
  pendBk._bk = bk;

  document.getElementById('acceptModal').classList.add('on');
  updateAcc();

  accInt = setInterval(async ()=>{

  try{
    const all = await DB.bookings();
    const current = all.find(x => String(x.id) === String(pendBkId));

    if(current && current.status === CONSTANTS.BOOKING_STATUS.ACCEPTED){
      clearInterval(accInt);
      closeModal('acceptModal');

      // show confirmation modal immediately
      pendBk._bk = current;
      await onAccepted();

      return;
    }
  }catch(err){
    console.error(err);
  }

  accLeft--;
  updateAcc();

  if(accLeft<=0){
    clearInterval(accInt);
    closeModal('acceptModal');
    document.getElementById('noAcceptModal').classList.add('on');
  }

},1000);
}
function updateAcc(){
  const mn=Math.floor(accLeft/60), sc=accLeft%60;
  document.getElementById('acceptTimer').textContent=`${mn}:${String(sc).padStart(2,'0')}`;
  document.getElementById('acceptBar').style.width=((accLeft/CONSTANTS.WORKER_ACCEPT_TIMEOUT_SECONDS)*100)+'%';
}

/* ── ON ACCEPTED ──────────────────────────────────────────── */
async function onAccepted(){
  try {

    const bkBase = pendBk._bk;

    const nearest = {
      id:        bkBase.worker_id    || bkBase.workerId,
      name:      bkBase.worker_name  || bkBase.workerName,
      phone:     bkBase.worker_phone || bkBase.workerPhone,
      role:      bkBase.worker_role  || bkBase.workerRole,
      emoji:     bkBase.worker_emoji || bkBase.workerEmoji || '🔧',
      kmDist:    bkBase.worker_dist  || bkBase.workerDist || 0
    };

    const arrivalOtp   = bkBase.arrivalOtp || bkBase.arrival_otp;
    const advance      = bkBase.isAdvance ?? bkBase.is_advance ?? false;

    /* Fix: the worker has ALREADY written worker_id/status/accepted_at
       to this row — RLS scopes that write to auth.uid() = worker_id.
       Re-upserting the SAME row from the customer's session here never
       changed anything the customer is allowed to change, and whenever
       the live row had moved even slightly further than this stale
       poll snapshot, enforce_booking_update_boundaries() correctly
       rejected the write, DB.save() returned false, and this function
       returned BEFORE ever showing the Booking Summary modal.
       onAccepted() now only READS bkBase (already fetched by the poll)
       to build the display object — it never writes to bookings. */
    const bk = {
  ...bkBase,
  workerId: nearest.id,
  workerName: nearest.name,
  workerPhone: nearest.phone,
  workerRole: nearest.role,
  workerEmoji: nearest.emoji,
  workerDist: Number(nearest.kmDist || 0),
  status: bkBase.status,
  wStatus: bkBase.w_status || CONSTANTS.BOOKING_STATUS.ACCEPTED
};

    const sf = fmt12(bk.time);
    const rf = revealAt(bk.time);

    const ico = document.getElementById('confIco');

    ico.textContent = advance ? '📅' : '✅';
    ico.style.background = advance ? '#fef3d0' : 'var(--teal-light)';
    ico.className = 'mico anim';

    document.getElementById('confTitle').textContent =
      advance ? 'Booking Scheduled!' : 'Worker Assigned!';

    document.getElementById('confDesc').innerHTML =
      advance
      ? `Your service is booked for <strong>${fmtDate(bk.date)} at ${sf}</strong>.<br/>Worker details & OTPs appear in My Bookings at <strong>${rf}</strong> (30 min before).`
      : `The nearest available worker accepted. Their details are now in My Bookings.`;

    const _totalDiscount = Number(bk.discount_amount||0) + Number(bk.milestone_discount||0);
    document.getElementById('confDet').innerHTML = `
      ${Number(bk.milestone_discount||0) > 0 ? `
        <div style="background:#fff8e6;border:1px solid #f5d98a;border-radius:var(--radius-sm);padding:.6rem .8rem;margin-bottom:.75rem;font-size:.8rem;color:#8a6600;text-align:center">
          🎉 Surprise! You got a loyalty discount of ₹${bk.milestone_discount} on this booking.
        </div>` : ''}
      <div class="mrow">
        <span class="ml">Service</span>
        <span class="mv">${bk.service}</span>
      </div>

      <div class="mrow">
        <span class="ml">Date & Time</span>
        <span class="mv">${fmtDate(bk.date)} · ${sf}</span>
      </div>

      <div class="mrow" style="align-items:flex-start">
        <span class="ml">Address</span>
        <span class="mv"
          style="max-width:260px;text-align:right;white-space:normal;word-break:break-word;line-height:1.4">
          ${bk.address}
        </span>
      </div>

      ${
        advance
        ? `
          <div class="mrow">
            <span class="ml">Worker</span>
            <span class="mv" style="color:var(--text3);font-style:italic">
              🔒 Revealed at ${rf}
            </span>
          </div>

          <div class="mrow">
            <span class="ml">Phone</span>
            <span class="mv" style="color:var(--text3);font-style:italic">
              🔒 Revealed at ${rf}
            </span>
          </div>
        `
        : `
          <div class="mrow">
            <span class="ml">Worker</span>
            <span class="mv">${nearest.name}</span>
          </div>

          <div class="mrow">
            <span class="ml">Phone</span>
            <span class="mv">${nearest.phone}</span>
          </div>

          <div class="mrow">
            <span class="ml">Distance</span>
            <span class="mv">${Number(nearest.kmDist || 0).toFixed(2)} km away</span>
          </div>
        `
      }

      <div class="mrow">
        <span class="ml">Payment</span>
        <span class="mv">
          ${paymentMethod === 'gpay'
            ? '📱 GPay (Paid)'
            : '💵 Cash on Arrival'}
        </span>
      </div>

      ${_totalDiscount > 0 ? `
      <div class="mrow">
        <span class="ml">🪙 Discount</span>
        <span class="mv" style="color:var(--teal)">− ₹${_totalDiscount}</span>
      </div>` : ''}
      <div class="mrow">
        <span class="ml">Total</span>
        <span class="mv" style="color:var(--brand)">
          ₹${bk.price}
        </span>
      </div>
    `;

    document.getElementById('confOtps').innerHTML =
      advance
      ? `
        <div
          style="background:var(--surface2);
          border:1px solid var(--border);
          border-radius:var(--radius-sm);
          padding:.95rem;
          text-align:center;
          margin-bottom:1.1rem">

          <div style="font-size:.82rem;color:var(--text2)">
            🔒 OTPs appear in My Bookings at <strong>${rf}</strong>
          </div>
        </div>
      `
      : `
        <div class="cotps">
          <div class="cotp">
            <div class="cotplbl">
              🚗 Arrival OTP
              <br>
              <span style="font-size:.58rem;opacity:.75">
                Give to worker on arrival
              </span>
            </div>

            <div class="cotpcode">
              ${arrivalOtp}
            </div>
          </div>
        </div>
      `;

    document.getElementById('confirmModal').classList.add('on');

  } catch(err){

    console.error('onAccepted failed:', err);

    alert(
      'onAccepted error:\n\n' +
      err.message +
      '\n\n' +
      err.stack
    );

    showToast(
      '⚠️ Booking confirmation hit an error. Please try again.'
    );
  }
}

/* ── BOOKING TIMELINE ──────────────────────────────────────── */
/* Maps each real status value (as stored in DB) to a timeline step index.
   Steps 0-7 match the 8-step flow: Created → Assigned → Accepted →
   On The Way → Arrived → Started → Completed → Review.
   'Cancelled' is handled separately — it stops the timeline at whatever
   step it reached and marks that step red. */
const TL_STATUS_IDX = {
  'Pending':       0,   /* created, no worker yet */
  'Scheduled':     1,   /* advance booking, worker assigned */
  'Confirmed':     1,   /* worker assigned (non-advance) */
  'Accepted':      2,   /* worker accepted on their dashboard */
  'Worker on Way': 3,   /* user clicked Track */
  'Arrived':       4,   /* arrival OTP verified */
  /* No separate "Service Started" status exists — Arrived doubles as that */
  'Completed':     6,   /* completion OTP verified */
};

function fmtTlTs(iso){
  if(!iso) return '';
  try{
    return new Date(iso).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'});
  }catch(e){ return ''; }
}

function buildTimeline(b){
  const cancelled = b.status === CONSTANTS.BOOKING_STATUS.CANCELLED;
  const activeIdx = cancelled
    ? (TL_STATUS_IDX[b.w_status||''] ?? TL_STATUS_IDX['Pending'])
    : (TL_STATUS_IDX[b.status] ?? 0);

  /* Timestamps available per step. We only have 4 real DB timestamps.
     created_at  → step 0 (created)
     created_at  → step 1 (assigned — same moment in this push model)
     accepted_at → step 2
     on_way_at   → step 3
     arrived_at  → step 4
     started_at  → step 5
     completed_at→ steps 6 and 7 */
  const ct = b.createdAt || b.created_at || null;
  const bkTimeLbl = b.date && b.time ? `${fmtDate(b.date)}, ${fmt12(b.time)}` : '';

  const steps = [
    { ico:'🟢', label:'Booking Created',   ts: fmtTlTs(ct) || bkTimeLbl },
    { ico:'👷', label:'Worker Assigned',   ts: fmtTlTs(ct) || bkTimeLbl },
    { ico:'👍', label:'Worker Accepted',   ts: fmtTlTs(b.accepted_at) },
    { ico:'🚗', label:'Worker On The Way', ts: fmtTlTs(b.on_way_at) },
    { ico:'📍', label:'Worker Arrived',    ts: fmtTlTs(b.arrived_at) },
    { ico:'🛠', label:'Service Started',   ts: fmtTlTs(b.started_at) },
    { ico:'✅', label:'Service Completed', ts: fmtTlTs(b.completed_at) },
    { ico:'⭐', label:'Review Submitted',  ts: fmtTlTs(b.completed_at) },
  ];

  /* If rated, step 7 is done; if completed but not rated, step 7 pending */
  const effectiveIdx = b.rated ? 7 : activeIdx;

  let html = '<div class="tl-body">';

  for(let i=0;i<steps.length;i++){
    const s = steps[i];
    const isDone      = !cancelled && i < effectiveIdx;
    const isActive    = !cancelled && i === effectiveIdx;
    const isCancelled = cancelled && i === effectiveIdx;
    const isPending   = (!isDone && !isActive && !isCancelled);

    /* Stop rendering pending steps after cancelled */
    if(cancelled && i > effectiveIdx) break;

    let dotCls = 'tl-dot';
    let labelCls = 'tl-label';
    let dotContent = '';

    if(isCancelled){
      dotCls += ' cancelled';
      labelCls += ' cancelled';
      /* Replace current step with cancel marker */
      html += `<div class="tl-step">
        <div class="${dotCls}"><span class="tl-ico">❌</span></div>
        <div class="tl-right">
          <div class="${labelCls}">Cancelled</div>
          ${s.ts?`<div class="tl-ts">${s.ts}</div>`:''}
        </div>
      </div>`;
      break;
    } else if(isDone){
      dotCls += ' done';
      dotContent = '<span class="tl-ico">✓</span>';
    } else if(isActive){
      dotCls += ' active';
      dotContent = `<span class="tl-ico">${s.ico}</span>`;
    } else {
      labelCls += ' pending';
    }

    const tsHtml = s.ts
      ? `<div class="tl-ts">${s.ts}</div>`
      : (isPending ? `<div class="tl-ts">—</div>` : '');

    html += `<div class="tl-step">
      <div class="${dotCls}">${dotContent}</div>
      <div class="tl-right">
        <div class="${labelCls}">${s.label}</div>
        ${tsHtml}
      </div>
    </div>`;
  }

  html += '</div>';
  return html;
}

function toggleTimeline(id){
  const btn  = document.getElementById('tl-btn-'+id);
  const wrap = document.getElementById('tl-wrap-'+id);
  if(!btn || !wrap) return;
  const opening = !wrap.classList.contains('open');
  wrap.classList.toggle('open', opening);
  btn.classList.toggle('open', opening);
  btn.innerHTML = opening
    ? '▲ Hide Timeline <span class="tl-arr">▲</span>'
    : '▼ View Timeline <span class="tl-arr">▼</span>';
  if(opening && !wrap.dataset.built){
    /* Content injected on first open to avoid blocking initial render */
    wrap.dataset.built = '1';
  }
}

/* ── LIVE WORKER TRACKING (Leaflet + OpenStreetMap) ───────────
   No polling timers of its own, no extra Supabase channels.
   updateTrackingMaps() is called by renderBookings() after every
   refresh — that is the only update mechanism.

   Phase 2 additions:
   - Fixed green customer marker, resolved from AREAS_CACHE via
     booking.areaId only (no geolocation, no geocoding).
   - Blue route line between worker and customer, drawn via OSRM,
     falling back to a dashed straight line if OSRM fails.
   - map.fitBounds() is called exactly ONCE per map instance, at the
     end of _buildTrackingMap(). Nothing after that ever moves the
     camera — updateTrackingMaps() only moves the worker marker and
     refreshes the route geometry. */
/* Phase 5.3.3: TRACKING_ZOOM now comes from js/common/config.js
   (CONFIG.TRACKING_ZOOM), loaded before this file. Previously
   duplicated as TRACK_CUSTOMER_ZOOM in worker-dashboard.html with
   the same value (15) and the same purpose. */

/* bookingId → { map, marker, customerMarker, routeLine, initialized, lastRouteFetch } */
const _trkState = {};

/* Renders inside the existing trk-slot box — same element the live map
   would otherwise occupy, so the container never resizes. Never touches
   Leaflet. Safe to call repeatedly; only writes if not already showing. */
function _showTrackingLockPlaceholder(b){
  const slot = document.getElementById('trk-slot-'+b.id);
  const msgEl = document.getElementById('trk-eta-'+b.id);
  if(!slot) return;
  if(!slot.querySelector('.trk-lock')){
    slot.innerHTML = `
      <div class="trk-lock" style="height:100%;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:.3rem;padding:.75rem">
        <div style="font-size:1.5rem">🔒</div>
        <div style="font-size:.8rem;font-weight:600;color:var(--text2)">Tracking unlocks<br>10 minutes before your booking.</div>
        <div style="font-size:.74rem;color:var(--text3)">Unlocks at <strong>${revealAt(b.time)}</strong></div>
      </div>`;
  }
  if(msgEl) msgEl.textContent = 'Locked until '+revealAt(b.time);
}

function toggleTracking(bkId){
  const btn  = document.getElementById('trk-btn-'+bkId);
  const wrap = document.getElementById('trk-wrap-'+bkId);
  if(!btn || !wrap) return;
  const opening = !wrap.classList.contains('open');
  wrap.classList.toggle('open', opening);
  btn.classList.toggle('open', opening);
  btn.innerHTML = opening
    ? '📍 Track Worker <span class="trk-arr">▲</span>'
    : '📍 Track Worker <span class="trk-arr">▼</span>';
  if(opening){
    /* Build/reattach immediately — do not wait for the CSS panel
       transition. Leaflet can measure a fixed-height child even while
       the parent's max-height is still animating, so tiles start
       loading right away. invalidateSize() is called again once the
       transition genuinely ends, as a safety net in case sizing was
       off during the animation. */
    (async ()=>{
      if(_trkState[bkId]?.map){
        _reattachTrackingDom(bkId);
        _trkState[bkId].map.invalidateSize();
      } else {
        const fresh = normalizeBookings(await DB.bookings());
        const booking = fresh.find(b => String(b.id) === String(bkId));
        _buildTrackingMap(booking);
      }
    })();

    const onTransitionEnd = (e)=>{
      if(e.target !== wrap || e.propertyName !== 'max-height') return;
      if(_trkState[bkId]?.map){
        try{ _trkState[bkId].map.invalidateSize(); }catch(err){}
      }
      wrap.removeEventListener('transitionend', onTransitionEnd);
    };
    wrap.addEventListener('transitionend', onTransitionEnd);
  }
}

/* Resolve a booking's customer destination.
   Prefers exact GPS captured at booking time; falls back to
   AREAS_CACHE when customer_lat/customer_lng are null. */
async function _resolveCustomerLatLng(b){
  if(b.customer_lat != null && b.customer_lng != null){
    return { lat:Number(b.customer_lat), lng:Number(b.customer_lng) };
  }
  if(b.areaId == null) return null;
  const areas = await loadAreas();
  const area = areas.find(a=>String(a.id)===String(b.areaId));
  if(!area || area.lat==null || area.lng==null) return null;
  return { lat:Number(area.lat), lng:Number(area.lng) };
}

/* Phase 5.3.6: _fetchRoadRoute, _fmtDistance, _fmtDuration,
   _metersBetween, _animateMarkerTo moved to js/common/maps.js */

function _updateEtaPanel(bkId, distance, duration){
  const distEl = document.getElementById('trk-dist-'+bkId);
  const timeEl = document.getElementById('trk-time-'+bkId);
  if(distEl) distEl.textContent = _fmtDistance(distance);
  if(timeEl) timeEl.textContent = _fmtDuration(duration);
  const st = _trkState[bkId];
  if(st){ st.lastDistance = distance; st.lastDuration = duration; }
}

/* Draws the worker→customer line the first time, then only ever
   updates its points — the layer itself is never recreated.
   Throttled to one OSRM call per 8s per booking; marker still moves
   every tick regardless. Falls back to a dashed straight line. */
async function _drawOrUpdateRoute(bkId, workerPt, customerPt){
  const st = _trkState[bkId];
  if(!st || !st.map) return;

  const now = Date.now();
  const throttled = st.lastRouteFetch && (now - st.lastRouteFetch < 8000);
  /* Requirement 8: worker hasn't moved since the last successful
     fetch — don't spend a Geoapify call on an identical route. */
  const unmoved = st.lastWorkerPt && _metersBetween(st.lastWorkerPt, workerPt) < 10;

  let latlngs = null;

  if(!throttled && !unmoved){
    st.lastRouteFetch = now;
    st.lastWorkerPt = workerPt;

    latlngs = await _fetchRoadRoute(workerPt, customerPt);

    // prevent race condition (map destroyed / re-init)
    if(_trkState[bkId] !== st || !st.map) return;

    // Phase 4.5: distance/duration ride along as extra properties on
    // the array _fetchRoadRoute returns (see Phase 4.5 comment there).
    // Undefined when latlngs is null (Geoapify failed) — the ?? null
    // covers that case and the panel correctly shows "--".
    _updateEtaPanel(bkId, latlngs?.distance ?? null, latlngs?.duration ?? null);
  }

  /* Phase 4.7: no straight-line/dashed fallback. If Geoapify routing
     failed this cycle, keep whatever road route is already on the
     map (or draw nothing yet) rather than ever rendering a straight
     or dashed line. */
  if(!latlngs) return;

  const isNewLine = !st.routeLine;

  if(isNewLine){
    st.routeLine = L.polyline(latlngs, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(st.map);
  } else {
    // IMPORTANT: ONLY update geometry, no style mutation
    st.routeLine.setLatLngs(latlngs);
  }
}

/* Only builds the map — never called unless panel is open.
   Called by toggleTracking and updateTrackingMaps (when panel is open). */
function _reattachTrackingDom(id){
  const st = _trkState[id];
  if(!st || !st.map || !st.container) return;
  const slot = document.getElementById('trk-slot-'+id);
  if(!slot) return;
  if(st.container.parentNode !== slot){
    slot.appendChild(st.container);
    try{ st.map.invalidateSize(); }catch(e){}
  }
  _updateEtaPanel(id, st.lastDistance ?? null, st.lastDuration ?? null);
}

/* 4.9.6: tear down a tracking map instance — Leaflet map, in-flight
   marker animation frame, and stored state. index.html currently has
   no function that ever removes a _trkState entry. */
function _destroyTrackingMap(bkId){
  const st = _trkState[bkId];
  if(!st) return;
  if(st.marker?._animFrame) cancelAnimationFrame(st.marker._animFrame);
  try{ if(st.map) st.map.remove(); }catch(e){}
  delete _trkState[bkId];
}

async function _buildTrackingMap(b){
  if(!b) return;

  /* Tracking is a booking-sensitive feature too — never initialise
     Leaflet, never touch worker location, before the reveal window. */
  if(!shouldReveal(b)){
    _showTrackingLockPlaceholder(b);
    return;
  }

  if(_trkState[b.id]?.map){
    try{
      _trkState[b.id].map.invalidateSize();
    }catch(e){}
    return;
  }
  const lat = b.worker_live_lat != null ? Number(b.worker_live_lat) : null;
  const lng = b.worker_live_lng != null ? Number(b.worker_live_lng) : null;
  if(lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;  

  const slot = document.getElementById('trk-slot-'+b.id);
  if(!slot) return;

  slot.innerHTML = ''; /* clear the lock placeholder if it was showing */
  const mapEl = document.createElement('div');
  mapEl.className = 'trk-map';
  mapEl.id = 'trk-map-live-'+b.id;
  slot.appendChild(mapEl);

  const map = L.map(mapEl, { zoomControl:true, attributionControl:false })
               .setView([lat, lng], CONFIG.TRACKING_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19
  }).addTo(map);

  const workerIcon = L.divIcon({
    className: "worker-marker",
    html: `
      <div style="
        width:22px;height:22px;border-radius:50%;
        background:#ff6b35;border:3px solid white;
        box-shadow:0 0 8px rgba(0,0,0,.35);
        display:flex;align-items:center;justify-content:center;
        font-size:12px;color:#fff;
      ">🔧</div>
    `,
    iconSize:[28,28],
    iconAnchor:[14,14]
  });

  const marker = L.marker([lat, lng],{ icon:workerIcon }).addTo(map);

  /* State exists BEFORE any await so a live update landing mid-flight
     never races an uninitialised entry, and can always move the marker.
     Requirement 6/8: autoFollow starts true; lastWorkerPt tracks the
     last coordinates a route was actually fetched for. */
  _trkState[b.id] = { map, marker, container:mapEl, customerMarker:null, routeLine:null, initialized:false, lastRouteFetch:0, autoFollow:true, lastWorkerPt:null };

  const msgEl = document.getElementById('trk-eta-'+b.id);
  if(msgEl) msgEl.textContent = '📍 Live worker location';

  /* Requirement 6: Uber-style auto-follow. Any user-initiated drag
     disables it and reveals a Re-center button; tapping the button
     re-enables it and pans back to the worker without touching zoom.
     Attached once here at map creation — never re-attached, so no
     duplicate listeners accumulate across updates. */
  const recenterBtn = document.createElement('button');
  recenterBtn.textContent = '⦿ Re-center';
  recenterBtn.type = 'button';
  recenterBtn.style.cssText = 'position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:1000;display:none;background:#111;color:#fff;border:none;border-radius:20px;padding:.4rem .9rem;font-size:.78rem;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer';
  mapEl.style.position = 'relative';
  mapEl.appendChild(recenterBtn);
  _trkState[b.id].recenterBtn = recenterBtn;
  recenterBtn.addEventListener('click', ()=>{
    const st = _trkState[b.id];
    if(!st) return;
    st.autoFollow = true;
    recenterBtn.style.display = 'none';
    map.panTo(st.marker.getLatLng(), { animate:true, duration:0.6 });
  });
  map.on('dragstart', ()=>{
    const st = _trkState[b.id];
    if(!st) return;
    st.autoFollow = false;
    recenterBtn.style.display = 'block';
  });

  setTimeout(()=>{ map.invalidateSize(); }, CONSTANTS.MAP_INVALIDATE_DELAY_MS);

  /* ── Customer marker + route + ONE-TIME overview fit ──────────
     Everything below runs once per map instance. Wrapped so a
     network hiccup here can never break tracking (fallback #8). */
  try{
    const customer = await _resolveCustomerLatLng(b);
    if(_trkState[b.id]?.map !== map) return; /* torn down while awaiting */

    if(!customer){
      /* No area on this booking — keep worker tracking working exactly
         as before, just centred on the worker. */
      _trkState[b.id].initialized = true;
      return;
    }

    const customerIcon = L.divIcon({
      className: "customer-marker",
      html: `
        <div style="
          width:20px;height:20px;border-radius:50%;
          background:#2f9e5c;border:3px solid white;
          box-shadow:0 0 8px rgba(0,0,0,.35);
          display:flex;align-items:center;justify-content:center;
          font-size:11px;color:#fff;
        ">🏠</div>
      `,
      iconSize:[26,26],
      iconAnchor:[13,13]
    });
    const customerMarker = L.marker([customer.lat, customer.lng], { icon:customerIcon }).addTo(map);
    _trkState[b.id].customerMarker = customerMarker;

    /* Phase 4.7: destination building name — resolved once via the
       same Geoapify reverse-geocoding call used in the pin picker,
       against the same stored customer_lat/customer_lng. The pin
       is fixed once confirmed, so this never needs to re-run. */
    _geoapifyReverseGeocode(customer.lat, customer.lng).then(name=>{
      const bEl = document.getElementById('trk-building-'+b.id);
      if(bEl) bEl.textContent = name ? '🏠 '+name : '';
    }).catch(()=>{});

    await _drawOrUpdateRoute(b.id, {lat,lng}, customer);
    if(_trkState[b.id]?.map !== map) return; /* torn down while awaiting */

    const st = _trkState[b.id];
    const bounds = st.routeLine
      ? st.routeLine.getBounds().pad(0.25)
      : L.latLngBounds([[lat,lng],[customer.lat,customer.lng]]).pad(0.35);

    /* The ONLY fitBounds call in this map instance's lifetime. */
    map.fitBounds(bounds, { maxZoom:16, padding:[40,40] });
    st.initialized = true;
  }catch(err){
    console.error('_buildTrackingMap overview failed (worker tracking continues):', err);
    if(_trkState[b.id]) _trkState[b.id].initialized = true;
  }
}

/* Called by renderBookings() after every re-render.
   - If panel is closed: store coords, build map only when user opens panel
   - If panel is open and map exists: move marker only
   - If panel is open and no map: build it now */
function updateTrackingMaps(bookingList){
  /* 4.9.6: destroy any tracking map whose booking has left the active
     statuses — covers Completed, Cancelled, Rejected, Expired, or any
     other terminal status, since it's driven by current status alone
     rather than by which exit path was taken. bookingList here is
     always the full set (renderBookings passes `all`), so this never
     misses a booking that's just off the current tab. */
  const _activeTrkIds = new Set(
    bookingList.filter(b=>[CONSTANTS.BOOKING_STATUS.ACCEPTED,CONSTANTS.BOOKING_STATUS.WORKER_ON_WAY].includes(b.status)).map(b=>String(b.id))

  );
  Object.keys(_trkState).forEach(id=>{
    if(!_activeTrkIds.has(String(id))) _destroyTrackingMap(id);
  });

  bookingList.forEach(b=>{
    if(![CONSTANTS.BOOKING_STATUS.ACCEPTED,CONSTANTS.BOOKING_STATUS.WORKER_ON_WAY].includes(b.status)) return;

    if(!shouldReveal(b)){
      _showTrackingLockPlaceholder(b);
      return; /* never reach coordinate/map logic before reveal */
    }

    const lat = b.worker_live_lat != null ? Number(b.worker_live_lat) : null;
    const lng = b.worker_live_lng != null ? Number(b.worker_live_lng) : null;
    const hasCoords = lat != null && lng != null && !isNaN(lat) && !isNaN(lng);
    const msgEl = document.getElementById('trk-eta-'+b.id);
    const wrap  = document.getElementById('trk-wrap-'+b.id);
    const isOpen = wrap?.classList.contains('open');

    if(!hasCoords){
  if(msgEl) msgEl.textContent = 'Waiting for worker location...';

  // If panel is open, keep checking when location arrives
  return;
}

    if(_trkState[b.id]?.map){
      /* Map exists — move marker, never recreate */
      const st = _trkState[b.id];
      /* Requirement 5: glide, don't jump. Requirement 7: panTo never
         changes zoom, so the user's zoom level is always preserved. */
      _animateMarkerTo(st.marker, lat, lng, 900);
      if(st.autoFollow) st.map.panTo([lat, lng], { animate:true, duration:0.9 });
      if(msgEl) msgEl.textContent = '📍 Live worker location';
      /* Phase 4.4/4.7: refresh the road route on every live GPS fix,
         but _drawOrUpdateRoute now skips the Geoapify call itself if
         the worker hasn't actually moved (Requirement 8) — this call
         stays unconditional so the marker/ETA path is untouched.
         Reuses the existing routeLine (setLatLngs only — never
         recreated). Fire-and-forget: _drawOrUpdateRoute already
         guards against races if the map is torn down mid-request,
         and never draws a straight/dashed fallback. Customer marker
         is never moved. */
      if(st.customerMarker){
        const c = st.customerMarker.getLatLng();
        _drawOrUpdateRoute(b.id, {lat, lng}, {lat:c.lat, lng:c.lng});
      }
      return;
    }

    /* No map yet — only build if panel is open (has real dimensions) */
    if(isOpen){
      _buildTrackingMap(b);
    } else {
      /* Panel closed — update message, map will be built when user opens */
      if(msgEl) msgEl.textContent = '📍 Live worker location';
    }
  });
}

/* ── MY BOOKINGS ──────────────────────────────────────────── */
async function renderBookings(){
  /* Remember which timelines are currently open so we can restore them
     after the list is rebuilt (polling wipes and recreates the DOM). */
  const openTls=new Set(
    [...document.querySelectorAll('.tl-wrap.open')]
      .map(el=>el.id.replace('tl-wrap-',''))
  );
  const openTrks=new Set(
    [...document.querySelectorAll('.trk-wrap.open')]
      .map(el=>el.id.replace('trk-wrap-',''))
  );
  const all=normalizeBookings(await DB.bookings());
  /* Customer-side QuickCoins trigger — runs on every renderBookings()
     call (polling, tab switch, refresh, reopen), but only reacts on
     the render where a booking's status is OBSERVED to flip from
     Arrived -> Completed. See checkQuickCoinsRewards(). */
  checkQuickCoinsRewards(all);
  checkServicePassConsumption(all);
  let list=all;
  if(curTab==='upcoming') list=all.filter(b=>[CONSTANTS.BOOKING_STATUS.SCHEDULED,CONSTANTS.BOOKING_STATUS.CONFIRMED,CONSTANTS.BOOKING_STATUS.ACCEPTED,CONSTANTS.BOOKING_STATUS.WORKER_ON_WAY,CONSTANTS.BOOKING_STATUS.ARRIVED].includes(b.status));
  if(curTab==='completed') list=all.filter(b=>b.status===CONSTANTS.BOOKING_STATUS.COMPLETED);
  if(curTab==='cancelled') list=all.filter(b=>b.status===CONSTANTS.BOOKING_STATUS.CANCELLED);
  const c=document.getElementById('bkList');
  if(!list.length){
    c.innerHTML=`<div class="empty"><div class="emptyico">📋</div><h3>No bookings here</h3><p>Your bookings will appear here.</p>${curTab==='all'?`<button class="btn bp" style="margin-top:1rem" onclick="goPage('services')">Browse Services</button>`:''}</div>`;
    return;
  }
  const sMap={Scheduled:'bgb',Confirmed:'bgbr','Worker on Way':'bga',Arrived:'bgt',Completed:'bgn',Cancelled:'bgr',Pending:'bgg'};
  c.innerHTML=`<div class="bklist">${list.map(b=>{
    const cls=sMap[b.status]||'bgg';
    /* ── SINGLE UNIFIED BOOKING-SENSITIVE REVEAL DECISION ──
       Phone, worker details, Arrival OTP entry, and (once it exists)
       profile photo all depend on this ONE flag. Do not add a
       separate status check for any of them. */
    const rev=shouldReveal(b);
    const show =
 b.status===CONSTANTS.BOOKING_STATUS.COMPLETED
  || ([CONSTANTS.BOOKING_STATUS.ACCEPTED,CONSTANTS.BOOKING_STATUS.CONFIRMED,CONSTANTS.BOOKING_STATUS.WORKER_ON_WAY,CONSTANTS.BOOKING_STATUS.ARRIVED,CONSTANTS.BOOKING_STATUS.SCHEDULED].includes(b.status)&&rev);
    const rf=b.isAdvance?revealAt(b.time):null;
    const payLabel=b.paymentMethod==='gpay'?'📱 GPay (Paid)':'💵 Cash on Arrival';
    const contactHtml = show
  ? `
    <div class="cbox" style="display:flex;align-items:center;gap:.55rem;flex-wrap:wrap">
      ${b.workerPhotoUrl?`<img src="${b.workerPhotoUrl}" alt="Worker profile photo" onclick="openPhotoLightbox('${b.workerPhotoUrl}')" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:1.5px solid var(--teal);flex-shrink:0;cursor:pointer">`:''}
      <span>
        <strong>👤 ${b.workerName}</strong>
        &nbsp; 📞
        <a href="tel:${b.workerPhone}"
           style="color:#266049;font-weight:600;text-decoration:none">
           ${b.workerPhone}
        </a>
      </span>
    </div>`
  : b.isAdvance
    ? `
      <div style="background:var(--surface2);
                  border:1px solid var(--border);
                  border-radius:var(--radius-sm);
                  padding:.6rem .95rem;
                  margin-top:.55rem;
                  font-size:.79rem;
                  color:var(--text2)">
          🔒 Worker details revealed at
          <strong>${rf}</strong>
      </div>`
    : '';
    const otpHtml=show?(()=>{
      /* Sequential OTP: never show both at once.
         arrival_otp is nulled after verification; completion_otp only exists after Arrived. */
      if(b.status===CONSTANTS.BOOKING_STATUS.ARRIVED&&b.completion_otp){
        return `<div class="otppair" style="grid-template-columns:1fr">
          <div class="otpbox c2"><div class="otplbl">Completion OTP</div><div class="otpcode c2">${b.completion_otp}</div><div style="font-size:.72rem;color:var(--text2);margin-top:.3rem">Share this OTP with the worker after the service is completed.</div></div></div>`;
      }
            if([CONSTANTS.BOOKING_STATUS.ACCEPTED,CONSTANTS.BOOKING_STATUS.CONFIRMED,CONSTANTS.BOOKING_STATUS.WORKER_ON_WAY].includes(b.status)&&b.arrival_otp){
        return `<div class="otppair" style="grid-template-columns:1fr">
          <div class="otpbox"><div class="otplbl">🚗 Arrival OTP — Share with worker on arrival</div><div class="otpcode">${b.arrival_otp}</div></div></div>`;
      }
      return '';
    })():'';
    const payHtml=(show||b.status===CONSTANTS.BOOKING_STATUS.SCHEDULED)?`<div style="font-size:.72rem;color:var(--text2);margin-top:.3rem">${payLabel}</div>`:'';
    const schedNote=b.status===CONSTANTS.BOOKING_STATUS.SCHEDULED&&!rev?`<div style="font-size:.76rem;color:var(--brand);font-weight:600;margin-top:.4rem">📅 Scheduled for ${fmt12(b.time)} · Worker assigned</div>`:'';
    const trackBtn=([CONSTANTS.BOOKING_STATUS.ACCEPTED,CONSTANTS.BOOKING_STATUS.CONFIRMED].includes(b.status)&&show)?`<button class="btn bt" style="font-size:.72rem;padding:5px 10px" onclick="openArrival(${b.id})">🚗 Track</button>`:'';
    const compBtn='';
    const canCancel=[CONSTANTS.BOOKING_STATUS.ACCEPTED,CONSTANTS.BOOKING_STATUS.CONFIRMED,CONSTANTS.BOOKING_STATUS.SCHEDULED].includes(b.status)&&!rev;
const cancelBtn=canCancel
  ?`<div><button class="btn bd" style="font-size:.72rem;padding:5px 10px" onclick="cancelBk(${b.id})">❌ Cancel</button><div style="font-size:.65rem;color:var(--text3);margin-top:3px">Free cancellation up to 10 min before</div></div>`
  :([CONSTANTS.BOOKING_STATUS.CONFIRMED,CONSTANTS.BOOKING_STATUS.SCHEDULED].includes(b.status)&&rev)?`<div style="font-size:.65rem;color:var(--danger);font-weight:600;margin-top:4px">🔒 Cancellation locked — worker is on the way</div>`:'' ;
    const bookAgainBtn=b.status===CONSTANTS.BOOKING_STATUS.CANCELLED?`<button class="btn bp" style="font-size:.72rem;padding:5px 10px" onclick="goPage('services')">🔄 Book Again</button>`:'';
    const rateBtn=b.status===CONSTANTS.BOOKING_STATUS.COMPLETED&&!b.rated?`<button class="btn" style="font-size:.72rem;padding:5px 10px;background:var(--amber);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-weight:600" onclick="openReview('${b.id}')">⭐ Rate</button>`:'';
    return `<div class="bkitem">
      <div class="bkico">${b.workerEmoji}</div>
      <div class="bkdet">
        <div class="bktit">${b.service}
          ${b.isEmergency?'&nbsp;<span class="bdg bge">🚨 Emergency</span>':''}
          ${b.isAdvance&&b.status===CONSTANTS.BOOKING_STATUS.SCHEDULED?'&nbsp;<span class="bdg bgb">📅 Advance</span>':''}

        </div>
        <div class="bkmeta"><span>${b.workerRole}</span><span>${fmtDate(b.date)} · ${fmt12(b.time)}</span><span>₹${b.price}</span></div>
        ${schedNote}${contactHtml}${otpHtml}${payHtml}
        <div class="bkacts">${trackBtn}${compBtn}${cancelBtn}${bookAgainBtn}${rateBtn}</div>
        <button class="tl-toggle" id="tl-btn-${b.id}" onclick="toggleTimeline('${b.id}')">▼ View Timeline <span class="tl-arr">▼</span></button>
        <div class="tl-wrap" id="tl-wrap-${b.id}">${buildTimeline(b)}</div>
        ${[CONSTANTS.BOOKING_STATUS.ACCEPTED,CONSTANTS.BOOKING_STATUS.WORKER_ON_WAY].includes(b.status)?`
         <button class="trk-toggle" id="trk-btn-${b.id}" onclick="toggleTracking('${b.id}')">📍 Track Worker <span class="trk-arr">▼</span></button>
        <div class="trk-wrap" id="trk-wrap-${b.id}">
          <div class="trk-body">
            <div class="trk-map" id="trk-slot-${b.id}"></div>
            <div class="trk-meta" id="trk-meta-${b.id}"><span class="trk-dot"></span><span id="trk-eta-${b.id}">Waiting for worker location...</span></div>
            <div id="trk-building-${b.id}" style="font-size:.78rem;font-weight:600;color:var(--teal,#2f9e5c);text-align:center;margin-top:.3rem"></div>
            <div class="trk-eta-panel" id="trk-etapanel-${b.id}" style="display:flex;gap:1.5rem;justify-content:center;margin-top:.5rem;font-size:.85rem;color:var(--text2,#666)">
              <span>🚗 Distance Remaining<br><b id="trk-dist-${b.id}">--</b></span>
              <span>⏱ ETA<br><b id="trk-time-${b.id}">--</b></span>
            </div>
          </div>
        </div>`:''}
      </div>
      <div class="bkst"><span class="bdg ${cls}">${b.status}</span></div>
    </div>`;
  }).join('')}</div>`;
  /* Restore any timelines that were open before the re-render */
  openTls.forEach(id=>{
    const wrap=document.getElementById('tl-wrap-'+id);
    const btn=document.getElementById('tl-btn-'+id);
    if(wrap&&btn){
      wrap.classList.add('open');
      btn.classList.add('open');
      btn.innerHTML='▲ Hide Timeline <span class="tl-arr">▲</span>';
    }
  });
  /* Restore open tracking panels after re-render.
   The booking cards were rebuilt with innerHTML, so any previous
   Leaflet map belongs to the OLD DOM node. Destroy it and rebuild
   the map on the NEW container. */
openTrks.forEach(id=>{
  const wrap=document.getElementById('trk-wrap-'+id);
  const btn=document.getElementById('trk-btn-'+id);

  if(!wrap || !btn) return;

  wrap.classList.add('open');
  btn.classList.add('open');
  btn.innerHTML='📍 Track Worker <span class="trk-arr">▲</span>';

  const booking = all.find(b => String(b.id) === String(id));
  if(!booking) return;

  if(_trkState[id]?.map){
    _reattachTrackingDom(id);
  } else {
    setTimeout(()=>{ _buildTrackingMap(booking); }, CONSTANTS.TRACKING_MAP_BUILD_DELAY_MS);
  }
});
  /* Pass full booking list so active bookings are always tracked
     regardless of which tab the user is currently viewing */
  updateTrackingMaps(all);
}

async function cancelBk(id){
  await DB.update(id,{status:CONSTANTS.BOOKING_STATUS.CANCELLED});
  showToast('🗑 Booking cancelled'); renderBookings();
}
function clearHistory(){ document.getElementById('clrModal').classList.add('on'); }
async function clrConfirmed(){
  closeModal('clrModal');
  await DB.clearAll();
  curTab='all';
  document.querySelectorAll('.tab').forEach((b,i)=>b.classList.toggle('on',i===0));
  showToast('🗑 Booking history cleared');
  await renderBookings();
}
function switchTab(tab,btn){
  curTab=tab; document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); renderBookings();
}

/* ── ARRIVAL TIMER ────────────────────────────────────────── */
async function openArrival(bkId){
  const all=await DB.bookings(); const b=all.find(x=>x.id===bkId); if(!b) return;
  /* Phase 6.2 — status/'Worker on Way' and on_way_at are no longer
     written from the customer client. That transition is worker/
     backend-owned; the database now rejects this write from a
     customer session regardless. This view is informational tracking
     only — it no longer changes booking state. */
  pendBkId=bkId; arrExt=false; arrLeft=CONSTANTS.ARRIVAL_TIMEOUT_SECONDS;
  document.getElementById('arrOtpShow').textContent=b.arrivalOtp||'——';
  document.getElementById('arrivalModal').classList.add('on');
  startArr(); renderBookings();
}
function startArr(){
  clearInterval(arrInt); updateArr();
  arrInt=setInterval(()=>{ arrLeft--; updateArr(); if(arrLeft<=0){ clearInterval(arrInt); closeModal('arrivalModal'); if(!arrExt) document.getElementById('notArrivedModal').classList.add('on'); else autoCancel(); } },1000);
}
function updateArr(){
  const tot=arrExt?CONSTANTS.ARRIVAL_EXTENDED_TIMEOUT_SECONDS:CONSTANTS.ARRIVAL_TIMEOUT_SECONDS, mn=Math.floor(arrLeft/60), sc=arrLeft%60;
  document.getElementById('arrivalTimer').textContent=`${mn}:${String(sc).padStart(2,'0')}`;
  document.getElementById('arrivalBar').style.width=((arrLeft/tot)*100)+'%';
}
function extendTimer(){
  closeModal('notArrivedModal'); arrExt=true; arrLeft=CONSTANTS.ARRIVAL_EXTENDED_TIMEOUT_SECONDS;
  document.getElementById('arrivalModal').classList.add('on'); startArr(); showToast('⏱ Extended by 5 minutes');
}
async function autoCancel(){
  closeModal('notArrivedModal'); closeModal('arrivalModal'); if(!pendBkId) return;
  /* Phase 6.2 — disabled. There is no authoritative server-side no-show
     rule yet, and a client-only countdown is not a security or business
     boundary. Customers cannot set is_no_show themselves (enforced at
     the database level as of Phase 6.2). This will be re-enabled once a
     real no-show rule is defined and enforced server-side, not before. */
  showToast('Worker has not arrived yet. This booking has not been auto-cancelled — you can cancel it manually if you no longer want it.');
  renderBookings();
}

/* ── OTP VERIFICATION ─────────────────────────────────────── */
function triggerOtp(mode,id){
  otpMode=mode; if(id) pendBkId=id;
  document.getElementById('otpTitle').textContent=mode==='arrival'?'Verify Arrival OTP':'Verify Completion OTP';
  document.getElementById('otpDesc').textContent=mode==='arrival'?'Enter the 6-digit Arrival OTP to confirm the worker has arrived.':'Enter the 6-digit Completion OTP to mark the service as done.';
  document.getElementById('otpInput').value='';
  document.getElementById('otpModal').classList.add('on');
}
async function verifyOtp(){
  const entered = document.getElementById('otpInput').value.trim();
  if(!entered){
    showToast('⚠️ Please enter the OTP');
    return;
  }

  /* Phase 6.4 — OTP verification now happens entirely server-side via RPC.
     The RPC performs ownership check, OTP comparison, status update, and
     OTP nulling atomically. The client never reads the OTP from the
     booking response or writes status directly for this step. */

  if(otpMode === 'arrival'){
    const {data:result, error:rpcErr} = await sb.rpc('verify_arrival_otp_customer', {
      p_booking_id: String(pendBkId),
      p_entered_otp: entered
    });

    if(rpcErr || !result?.success){
      showToast('❌ ' + (result?.error || rpcErr?.message || 'Incorrect Arrival OTP'));
      return;
    }

    clearInterval(arrInt);
    closeModal('arrivalModal');
    closeModal('otpModal');
    showToast('✅ Arrival confirmed!');
    await renderBookings();

  } else {
    const {data:result, error:rpcErr} = await sb.rpc('verify_completion_otp_customer', {
      p_booking_id: String(pendBkId),
      p_entered_otp: entered
    });

    if(rpcErr || !result?.success){
      showToast('❌ ' + (result?.error || rpcErr?.message || 'Incorrect Completion OTP'));
      return;
    }

    closeModal('otpModal');
    showToast('🎉 Service marked as Completed!');
    await renderBookings();
  }
}

/* ── QUICKCOINS REWARD (Phase 1.5) ───────────────────────────────
   Customer-side ONLY, and fully independent of verifyOtp() — the
   customer never verifies the Completion OTP, only the worker does.
   Instead this watches the customer's own booking feed (already
   refreshed by renderBookings() on every poll/tab-switch/reopen) and
   reacts the moment a booking's status is OBSERVED to flip from
   Arrived -> Completed. Updates ONLY existing users-table columns;
   no new columns/tables; quickcoins_redeemed is never touched. */

/* In-memory only (per the spec: no localStorage, no schema changes).
   Both reset to empty on every page load/refresh.
     qcLastStatus  : bookingId -> last status OBSERVED this session
     qcRewardedIds : bookingId set already rewarded this session
   Key trick for "refresh after already Completed shouldn't re-reward":
   the FIRST time a booking is seen in a session we only record its
   status as a baseline and return — we never reward on that first
   sighting, even if the status is already 'Completed'. A reward only
   fires when a booking we've already seen as 'Arrived' is next seen
   as 'Completed' — i.e. an actual transition happening live while
   the page is open, not just "it happens to be Completed already". */
const qcLastStatus  = new Map();
const qcRewardedIds = new Set();

function checkQuickCoinsRewards(all){
  all.forEach(b=>{
    const prevStatus = qcLastStatus.get(b.id);

    if(prevStatus===undefined){
      // First sighting this session — establish baseline only, never reward here.
      qcLastStatus.set(b.id, b.status);
      return;
    }

   if(prevStatus===CONSTANTS.BOOKING_STATUS.ARRIVED && b.status===CONSTANTS.BOOKING_STATUS.COMPLETED && !qcRewardedIds.has(b.id)){
      // Mark rewarded BEFORE awaiting the DB call so an overlapping
      // poll tick can never double-trigger the award for this booking.
      qcRewardedIds.add(b.id);
      awardQuickCoins(b);
    }

    qcLastStatus.set(b.id, b.status);
  });
}

async function awardQuickCoins(booking){
  const {data:{session}}=await sb.auth.getSession();
  if(!session?.user) return; // safety guard; this path is customer-only anyway

  /* Phase 6.4 — the client no longer computes or writes the reward.
     award_quickcoins() re-reads the real booking row server-side,
     verifies ownership + Completed status, and is idempotent per
     booking. booking.id is the only client-supplied value trusted. */
  const {data:result, error} = await sb.rpc('award_quickcoins', { p_booking_id: booking.id });

  if(error || !result?.success){
    console.error('awardQuickCoins:', result?.error || error?.message);
    return;
  }

  const coins = result.coins;

  const {data:u} = await sb.from('users').select('quickcoins_balance').eq('id',session.user.id).single();
  const newBalance = u?.quickcoins_balance ?? 0;

  const rewardModalEl   = document.getElementById('rewardModal');
  const rewardCoinsEl   = document.getElementById('rewardCoins');
  const rewardBalanceEl = document.getElementById('rewardBalance');

  if(rewardCoinsEl) rewardCoinsEl.textContent = '+'+coins+' QuickCoins Credited';
  if(rewardBalanceEl) rewardBalanceEl.textContent = newBalance+' QC';
  if(rewardModalEl) rewardModalEl.classList.add('on');
}
function closeRewardModal(){ closeModal('rewardModal'); }

const spLastStatus  = new Map();
const spConsumedIds = new Set();

function checkServicePassConsumption(all){
  all.forEach(b=>{
    const prevStatus = spLastStatus.get(b.id);

    if(prevStatus===undefined){
      spLastStatus.set(b.id, b.status);
      return;
    }

    if(prevStatus==='Arrived' && b.status==='Completed' && !spConsumedIds.has(b.id)){
      spConsumedIds.add(b.id);
      if(b.pass_used && b.pass_id) consumeServicePassVisit(b);
    }

    spLastStatus.set(b.id, b.status);
  });
}

async function consumeServicePassVisit(booking){
  const {data:{session}}=await sb.auth.getSession();
  if(!session?.user) return;

  /* Phase 6.4 — direct user_passes writes are blocked by
     trg_prevent_direct_pass_tampering. consume_pass_visit() is the
     only server-trusted path: it resolves the pass from the booking
     row itself and decrements/expires it atomically, under
     quickfix.trusted_write. */
  const {data:result, error} = await sb.rpc('consume_pass_visit', {
    p_booking_id: String(booking.id)
  });

  if(error || !result?.success){
    console.error('consumeServicePassVisit:', result?.error || error?.message);
    return;
  }

  if(document.getElementById('page-passes')?.classList.contains('active')) renderMyPasses();
}

/* ── REWARD POPUP UI ENHANCEMENTS (presentational only, Phase 1.5) ──
   Does NOT call, wrap, or modify awardQuickCoins(). It only WATCHES
   #rewardModal for the .on class that awardQuickCoins() already adds,
   then reads the final text it already wrote and replays it as an
   animation. Remove this whole block and the reward system behaves
   identically to before — no coupling into reward/DB logic. */
(function(){
  const modalEl   = document.getElementById('rewardModal');
  const coinsEl   = document.getElementById('rewardCoins');
  const balanceEl = document.getElementById('rewardBalance');
  if(!modalEl || !coinsEl || !balanceEl) return;

  function animateCount(el, to, mode, duration){
    const start = performance.now();
    function tick(now){
      const p = Math.min(1, (now-start)/duration);
      const eased = 1 - Math.pow(1-p, 3);
      const val = Math.round(to * eased);
      el.textContent = mode==='coins' ? ('+'+val+' QuickCoins Credited') : (val+' QC');
      if(p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function spawnConfetti(){
    const layer = document.createElement('div');
    layer.className = 'reward-confetti-layer';
    const colors = ['#b5651d','#d4890a','#4a8b6e','#d4875a','#fdf6ee'];
    for(let i=0;i<24;i++){
      const p = document.createElement('span');
      p.className = 'reward-confetti-piece';
      const fromLeft = i % 2 === 0;
      p.style.left = fromLeft ? (Math.random()*16)+'%' : (84+Math.random()*16)+'%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random()*0.3)+'s';
      p.style.setProperty('--tx', ((fromLeft?1:-1)*(40+Math.random()*90))+'px');
      layer.appendChild(p);
    }
    modalEl.appendChild(layer);
    setTimeout(()=>layer.remove(), CONSTANTS.PULSE_LAYER_REMOVE_DELAY_MS);
  }

  function spawnCoins(){
    const layer = document.createElement('div');
    layer.className = 'reward-coin-layer';
    for(let i=0;i<10;i++){
      const c = document.createElement('span');
      c.className = 'reward-coin-piece';
      c.textContent = '🪙';
      c.style.left = (5+Math.random()*90)+'%';
      c.style.animationDelay = (Math.random()*0.6)+'s';
      layer.appendChild(c);
    }
    modalEl.appendChild(layer);
    setTimeout(()=>layer.remove(), CONSTANTS.PULSE_LAYER_REMOVE_DELAY_MS);
  }

  const observer = new MutationObserver(()=>{
    if(!modalEl.classList.contains('on')) return;

    const coinsMatch = coinsEl.textContent.match(/-?\d+/);
    const balMatch   = balanceEl.textContent.match(/-?\d+/);
    const finalCoins = coinsMatch ? parseInt(coinsMatch[0],10) : 0;
    const finalBal   = balMatch ? parseInt(balMatch[0],10) : 0;

    coinsEl.textContent   = '+0 QuickCoins Credited';
    balanceEl.textContent = '0 QC';

    spawnConfetti();
    spawnCoins();
    animateCount(coinsEl, finalCoins, 'coins', 1400);
    animateCount(balanceEl, finalBal, 'balance', 1650);
  });
  observer.observe(modalEl, { attributes:true, attributeFilter:['class'] });
})();

/* ── REVIEW ───────────────────────────────────────────────── */
async function openReview(bkId){
  revId=String(bkId); revRat=0;
  const all=await DB.bookings();
  const b=all.find(x=>String(x.id)===String(bkId));
  if(!b){ showToast('⚠️ Booking not found'); return; }
  document.getElementById('reviewDesc').innerHTML=`How was your <strong>${b.workerRole||b.worker_role||'service'}</strong> experience?`;
  setRating(0); document.getElementById('reviewComment').value='';
  document.getElementById('reviewModal').classList.add('on');
}
function setRating(r){ revRat=r; document.querySelectorAll('#starInput span').forEach((s,i)=>s.classList.toggle('lit',i<r)); }
async function submitReview(){
  if(!revRat){
    showToast('⚠️ Please select a star rating');
    return;
  }

  const all = await DB.bookings();

  const b = all.find(
    x => String(x.id) === String(revId)
  );

  if(!b){
    showToast('⚠️ Booking not found');
    return;
  }

  const user = JSON.parse(
    sessionStorage.getItem('qf_user') || '{}'
  );

  const workerId =
    b.workerId ||
    b.worker_id ||
    null;

  await DB.saveReview(
    revId,
    workerId,
    revRat,
    document.getElementById('reviewComment').value.trim(),
    user.name || 'Anonymous'
  );

  closeModal('reviewModal');

  showToast('⭐ Thank you for your review!');

  /* refresh latest booking state from DB */
  await renderBookings();
}

/* ── AADHAAR UPLOAD ───────────────────────────────────────── */
function handleUpload(input){
  const file=input.files[0]; if(!file) return;
  if(file.size>CONSTANTS.MAX_UPLOAD_FILE_SIZE_BYTES){ showToast('⚠️ File too large. Max 5MB.'); input.value=''; return; }
  if(!file.type.startsWith('image/')){ showToast('⚠️ Please upload an image file (JPG or PNG).'); input.value=''; return; }
  const reader=new FileReader();
  reader.onload=e=>{
    aadhaarData=e.target.result;
    document.getElementById('upPrevImg').src=aadhaarData;
    document.getElementById('upPrev').style.display='';
    document.getElementById('upOk').style.display='';
    document.getElementById('upZone').classList.add('done');
  };
  reader.readAsDataURL(file);
}

/* ── REGISTRATION ─────────────────────────────────────────── */
async function submitReg(){
  const fields=['rName','rPhone','rEmail','rArea','rCat','rExp','rPrice','rBio','rAadhaar'];
  let ok=true;
  fields.forEach(id=>{ if(!document.getElementById(id).value.trim()){ markErr(id); ok=false; } });
  if(!aadhaarData){ showToast('⚠️ Please upload your Aadhaar card photo'); ok=false; }
  if(!ok){ showToast('⚠️ Please fill all required fields'); return; }
  const entry={};
  fields.forEach(id=>entry[id]=document.getElementById(id).value.trim());
  entry.aadhaarPhoto=aadhaarData;
  entry.emergencyAvailable=document.getElementById('rEmerg').checked;
  entry.pan=document.getElementById('rPan').value.trim();
  entry.status='Pending Review'; entry.joinedAt=new Date().toISOString();
  const phone=entry.rPhone;
  await DB.saveReg(entry);
  [...fields,'rPan','rRadius'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('rEmerg').checked=false;
  aadhaarData=null;
  document.getElementById('upPrev').style.display='none';
  document.getElementById('upOk').style.display='none';
  document.getElementById('upZone').classList.remove('done');
  document.getElementById('rAadhaarPhoto').value='';
  document.getElementById('successPhone').textContent=phone;
  goPage('regsuccess');
}

/* ── BACKDROP CLOSE ───────────────────────────────────────── */
['payModal','confirmModal','noAcceptModal','otpModal','clrModal','reviewModal'].forEach(id=>{
  document.getElementById(id).addEventListener('click',function(e){
    if(e.target===this){ if(id==='payModal') stopPoll(); closeModal(id); }
  });
});
window.addEventListener('focus',()=>{
  renderBookings();
});
/* ── INIT ─────────────────────────────────────────────────── */
renderHomeCats();