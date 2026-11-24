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

/* ── IMAGE COMPRESSION ────────────────────────────────────────
   Resizes an image file down to a max dimension and re-encodes it
   as JPEG at the given quality, via an off-screen canvas. Used
   before every user-photo upload (worker docs/photos, booking
   arrival/completion photos) to keep Storage usage and page load
   times reasonable. Falls back to the original file untouched if
   anything goes wrong (unsupported format, canvas failure, etc.) —
   compression is a nice-to-have, never a blocker on upload. */
function compressImageFile(file, maxDimension=1280, quality=0.75){
  return new Promise((resolve)=>{
    if(!file || !file.type.startsWith('image/')){ resolve(file); return; }
    const img=new Image();
    const reader=new FileReader();
    reader.onload=(e)=>{
      img.onload=()=>{
        let {width,height}=img;
        if(width>maxDimension || height>maxDimension){
          if(width>height){ height=Math.round(height*(maxDimension/width)); width=maxDimension; }
          else{ width=Math.round(width*(maxDimension/height)); height=maxDimension; }
        }
        const canvas=document.createElement('canvas');
        canvas.width=width; canvas.height=height;
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0,width,height);
        canvas.toBlob((blob)=>{
          if(!blob){ resolve(file); return; }
          const compressed=new File([blob], file.name.replace(/\.\w+$/,'.jpg'), {type:'image/jpeg'});
          resolve(compressed.size<file.size ? compressed : file);
        }, 'image/jpeg', quality);
      };
      img.onerror=()=>resolve(file);
      img.src=e.target.result;
    };
    reader.onerror=()=>resolve(file);
    reader.readAsDataURL(file);
  });
}

/* ── Notification sound ─────────────────────────────────────
   Short two-tone beep made with the Web Audio API (no audio file).
   Browsers keep audio locked until the person has clicked, tapped or
   pressed a key on the page once, so the first interaction unlocks it.
   Calls within 3 seconds of the last beep are ignored, so two code
   paths reacting to the same event never double-ring. */
(function(){
  function unlockAudio(){
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC) return;
      if(!window._qfAudioCtx) window._qfAudioCtx=new AC();
      if(window._qfAudioCtx.state==='suspended') window._qfAudioCtx.resume();
    }catch(e){}
    ['click','touchstart','keydown'].forEach(ev=>document.removeEventListener(ev,unlockAudio,true));
  }
  ['click','touchstart','keydown'].forEach(ev=>document.addEventListener(ev,unlockAudio,true));
})();

function playNotifySound(){
  try{
    const now=Date.now();
    if(window._qfLastBeep && now-window._qfLastBeep<3000) return;
    window._qfLastBeep=now;

    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return;
    if(!window._qfAudioCtx) window._qfAudioCtx=new AC();
    const ctx=window._qfAudioCtx;
    if(ctx.state==='suspended') ctx.resume();

    const t0=ctx.currentTime+0.02;
    [[880,0],[1175,0.18]].forEach(([freq,offset])=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type='sine';
      osc.frequency.value=freq;
      gain.gain.setValueAtTime(0.0001,t0+offset);
      gain.gain.exponentialRampToValueAtTime(0.25,t0+offset+0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001,t0+offset+0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0+offset);
      osc.stop(t0+offset+0.18);
    });
  }catch(e){
    console.warn('Notification sound failed:',e);
  }
}