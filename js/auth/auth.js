/* ===== QuickFix Auth Script — extracted from auth.html (Phase 5.2) ===== */

/* sb now comes from js/common/supabase.js, loaded before this file. */

let curRole='user',curForm='login';
let areasData=[];

const LEFT_CONTENT={
  user:{tag:'For Homeowners',heading:'Book trusted<br/><span>pros instantly</span>',desc:'Find verified local professionals for any home repair or service — booked in under 2 minutes.',perks:['Browse 9 service categories','Live job tracking with OTP safety','Pay cash or UPI — your choice','Rate your experience after each job']},
  worker:{tag:'For Professionals',heading:'Get jobs that<br/><span>match your skill</span>',desc:'Receive job requests filtered by your skill and radius. Go online when ready, offline anytime.',perks:['Jobs matched to your exact skill','Set your own work radius','Toggle availability anytime','Fast payments after each job']}
};

/* ── AUTO-REDIRECT if already logged in ──────────────────────
   getSession() now reads the real, persisted Supabase session (the
   client above has persistSession:true, matching index.html). A
   genuine logged-in visitor landing on auth.html (e.g. via back button
   or a stale tab) gets redirected straight to their dashboard.
   We additionally require sessionStorage.qf_user to be present before
   redirecting, as a guard against acting on the Supabase session alone
   without the app-level profile cache also agreeing the user is logged
   in. After a real signOut() on index.html, both the Supabase session
   AND qf_user are cleared, so this check correctly keeps the user on
   auth.html. */
(async()=>{
  const {data:{session}}=await sb.auth.getSession();
  const cachedUser=sessionStorage.getItem('qf_user');

  if(session && cachedUser){
    let cachedRole=null;
    try{ cachedRole=JSON.parse(cachedUser).role; }catch(e){}
    const role=cachedRole||session.user.user_metadata?.role;

    if(role){
      redirect(role);
    }
  }
})();

const params=new URLSearchParams(location.search);
setRole(params.get('role')||sessionStorage.getItem('qf_role')||'user');
loadAreas();

async function loadAreas(){
  const sel=document.getElementById('swArea');
  const {data,error}=await sb.from('areas').select('id,name,lat,lng').order('name',{ascending:true});
  if(error||!data||!data.length){
    sel.innerHTML='<option value="">No areas available</option>';
    console.error('loadAreas:',error?.message);
    return;
  }
  areasData=data;
  sel.innerHTML='<option value="">Select your area…</option>'+
    data.map(a=>`<option value="${a.id}">${a.name}</option>`).join('');
}

function setRole(role){
  curRole=role;sessionStorage.setItem('qf_role',role);
  document.getElementById('tabUser').classList.toggle('on',role==='user');
  document.getElementById('tabWorker').classList.toggle('on',role==='worker');
  updateLeftPanel(role);updateAuthText();
  if(curForm==='signup')showSignupPanel(role);
  hideErr();
}
function setForm(form){
  curForm=form;
  document.getElementById('ftLogin').classList.toggle('on',form==='login');
  document.getElementById('ftSignup').classList.toggle('on',form==='signup');
  document.getElementById('fLogin').classList.toggle('on',form==='login');
  if(form==='signup')showSignupPanel(curRole);
  else{document.getElementById('fSignupUser').classList.remove('on');document.getElementById('fSignupWorker').classList.remove('on');}
  updateAuthText();hideErr();
}
function showSignupPanel(role){
  if(curForm!=='signup')return;
  document.getElementById('fLogin').classList.remove('on');
  document.getElementById('fSignupUser').classList.toggle('on',role==='user');
  document.getElementById('fSignupWorker').classList.toggle('on',role==='worker');
  if(role==='worker')toggleEmergencyField();
}
function toggleEmergencyField(){
  const skill=document.getElementById('swSkill').value;
  const grp=document.getElementById('swEmergGrp');
  const show=skill==='Electrician'||skill==='Plumber';
  grp.style.display=show?'':'none';
  if(!show)document.getElementById('swEmerg').checked=false;
}
function updateLeftPanel(role){
  const c=LEFT_CONTENT[role];
  document.getElementById('leftMain').innerHTML=`<div class="left-tag">${c.tag}</div><h2>${c.heading}</h2><p class="left-desc">${c.desc}</p><ul class="left-perks">${c.perks.map(p=>`<li><div class="perk-ico">✓</div>${p}</li>`).join('')}</ul>`;
}
function updateAuthText(){
  const T={user:{login:'Welcome back',signup:'Create your account'},worker:{login:'Worker sign in',signup:'Join as a Worker'}};
  const S={user:{login:'Sign in to book services near you.',signup:'Set up your account in seconds.'},worker:{login:'Sign in to see job requests near you.',signup:'Register to start receiving local jobs.'}};
  document.getElementById('authTitle').textContent=T[curRole][curForm]||'Welcome';
  document.getElementById('authSub').textContent=S[curRole][curForm]||'';
}

/* ── LOGIN ── */
async function doLogin(){
  hideErr();
  const email=document.getElementById('lEmail').value.trim();
  const pass=document.getElementById('lPass').value.trim();
  if(!email)markErr('lEmail');
  if(!pass)markErr('lPass');
  if(!email||!pass){showErr('Please fill in all fields.');return;}
  setBtn('loginBtn','loginBtnTxt',true,'Signing in…');

  const {data,error}=await sb.auth.signInWithPassword({email,password:pass});
  if(error){
    setBtn('loginBtn','loginBtnTxt',false,'Sign In →');
    if(error.message.includes('Invalid login'))showErr('Incorrect email or password.');
    else if(error.message.includes('not confirmed'))showErr('Please confirm your email first. Check your inbox.');
    else showErr(error.message);
    return;
  }

  const authRole=data.user.user_metadata?.role||'user';
  const {data:profile,error:pe}=authRole==='worker'
    ? await sb.from('workers').select('*').eq('id',data.user.id).single()
    : await sb.from('users').select('*').eq('id',data.user.id).single();
  if(pe||!profile){
    setBtn('loginBtn','loginBtnTxt',false,'Sign In →');
    showErr('Profile not found. Please sign up.');
    return;
  }

  const sess={
    id:    data.user.id,
    email: profile.email||email,
    name:  profile.name||'',
    phone: profile.phone||'',
    role:  authRole
  };

  if(authRole==='worker'){
    Object.assign(sess,{
      skill:        profile.skill||'',
      radius:       profile.radius||10,
      exp:          profile.exp||0,
      price:        profile.price||'',
      bio:          profile.bio||'',
      is_available: profile.is_available||false,
      emergency_available: profile.emergency_available||false,
      area:         profile.area||'',
      lat:          profile.lat||null,
      lng:          profile.lng||null
    });
  }

  sessionStorage.setItem('qf_user',JSON.stringify(sess));
  sessionStorage.setItem('qf_role',authRole);
  showToast('✅ Signed in! Redirecting…');
  setTimeout(()=>redirect(authRole),CONSTANTS.AUTH_REDIRECT_DELAY_MS);
}

/* ── DOCUMENT UPLOAD PREVIEW ── */
function handleDocUpload(input){
  const file=input.files[0];
  const label=document.getElementById('swDocLabel');
  const nameEl=document.getElementById('swDocName');
  const mainEl=label.querySelector('.file-upload-main');
  if(!file){
    label.classList.remove('has-file');
    nameEl.style.display='none';
    nameEl.textContent='';
    mainEl.textContent='Click to upload or drag & drop';
    return;
  }
  const allowed=['image/jpeg','image/jpg','image/png','application/pdf'];
  if(!allowed.includes(file.type)){
    showErr('Invalid file type. Please upload JPG, JPEG, PNG, or PDF.');
    input.value='';
    label.classList.remove('has-file');
    nameEl.style.display='none';
    return;
  }
  if(file.size>CONSTANTS.MAX_UPLOAD_FILE_SIZE_BYTES){
    showErr('File too large. Maximum size is 5MB.');
    input.value='';
    label.classList.remove('has-file');
    nameEl.style.display='none';
    return;
  }
  label.classList.add('has-file');
  nameEl.textContent='✅ '+file.name;
  nameEl.style.display='block';
  mainEl.textContent='File selected';
}

/* ── PROFILE PHOTO UPLOAD PREVIEW (separate from Government ID — same pattern) ── */
function handlePhotoUpload(input){
  const file=input.files[0];
  const label=document.getElementById('swPhotoLabel');
  const nameEl=document.getElementById('swPhotoName');
  const mainEl=label.querySelector('.file-upload-main');
  if(!file){
    label.classList.remove('has-file');
    nameEl.style.display='none';
    nameEl.textContent='';
    mainEl.textContent='Click to upload or take a photo';
    return;
  }
  const allowed=['image/jpeg','image/jpg','image/png'];
  if(!allowed.includes(file.type)){
    showErr('Invalid file type. Please upload a JPG or PNG photo.');
    input.value='';
    label.classList.remove('has-file');
    nameEl.style.display='none';
    return;
  }
  if(file.size>5*1024*1024){
    showErr('File too large. Maximum size is 5MB.');
    input.value='';
    label.classList.remove('has-file');
    nameEl.style.display='none';
    return;
  }
  label.classList.add('has-file');
  nameEl.textContent='✅ '+file.name;
  nameEl.style.display='block';
  mainEl.textContent='Photo selected';
}

/* ── SIGNUP ── */
async function doSignup(role){
  hideErr();

  /* ── USER SIGNUP ── */
  if(role==='user'){
    const fname=document.getElementById('suFname').value.trim();
    const lname=document.getElementById('suLname').value.trim();
    const email=document.getElementById('suEmail').value.trim();
    const phone=document.getElementById('suPhone').value.trim();
    const pass =document.getElementById('suPass').value.trim();

    if(!fname)markErr('suFname');
    if(!email)markErr('suEmail');
    if(!phone)markErr('suPhone');
    if(!pass) markErr('suPass');
    if(!fname||!email||!phone||!pass){showErr('Please fill in all required fields.');return;}
    if(pass.length<CONSTANTS.MIN_PASSWORD_LENGTH){showErr('Password must be at least 6 characters.');return;}

    const name=(fname+' '+lname).trim();
    setBtn('signupUserBtn','suBtnTxt',true,'Creating account…');

    const {data:a,error:ae}=await sb.auth.signUp({
      email,
      password:pass,
      options:{data:{name,role:'user'}}
    });
    if(ae){
      setBtn('signupUserBtn','suBtnTxt',false,'Create Account →');
      showErr(ae.message.includes('already registered')?'Email already registered. Try signing in.':ae.message);
      return;
    }

    const {error:de}=await sb.from('users').insert({
      id:    a.user.id,
      email: email,
      name:  name,
      phone: phone,
      role:  'user'
    });
    if(de){
      setBtn('signupUserBtn','suBtnTxt',false,'Create Account →');
      showErr('Profile save failed: '+de.message);
      return;
    }

    sessionStorage.setItem('qf_user',JSON.stringify({id:a.user.id,email,name,phone,role:'user'}));
    sessionStorage.setItem('qf_role','user');
    setBtn('signupUserBtn','suBtnTxt',false,'Create Account →');
    showToast('🎉 Account created! Redirecting…');
    setTimeout(()=>redirect('user'),CONSTANTS.AUTH_REDIRECT_DELAY_MS);

  /* ── WORKER SIGNUP ── */
  }else{
    const name  =document.getElementById('swName').value.trim();
    const email =document.getElementById('swEmail').value.trim();
    const phone =document.getElementById('swPhone').value.trim();
    const skill =document.getElementById('swSkill').value.trim();
    const radius=document.getElementById('swRadius').value.trim();
    const areaId=document.getElementById('swArea').value;
    const expVal=document.getElementById('swExp').value.trim();
    const pass  =document.getElementById('swPass').value.trim();
    const emergencyAvailable=(skill==='Electrician'||skill==='Plumber')&&document.getElementById('swEmerg').checked;

    if(!name)  markErr('swName');
    if(!email) markErr('swEmail');
    if(!phone) markErr('swPhone');
    if(!skill) markErr('swSkill');
    if(!radius)markErr('swRadius');
    if(!areaId)markErr('swArea');
    if(!pass)  markErr('swPass');
    if(!name||!email||!phone||!skill||!radius||!areaId||!pass){showErr('Please fill in all required fields.');return;}
    if(pass.length<6){showErr('Password must be at least 6 characters.');return;}
    if(isNaN(parseInt(radius))||parseInt(radius)<1){markErr('swRadius');showErr('Work radius must be a number greater than 0.');return;}

    const selectedArea=areasData.find(a=>String(a.id)===String(areaId));
    if(!selectedArea){markErr('swArea');showErr('Please select a valid area.');return;}

    const radiusInt=parseInt(radius);
    const expInt=expVal===''?0:parseInt(expVal)||0;

    /* Document validation */
    const docInput=document.getElementById('swDocFile');
    const docFile=docInput&&docInput.files[0]?docInput.files[0]:null;
    if(!docFile){showErr('Please upload a valid government ID proof.');return;}

    /* Profile photo validation — separate mandatory field */
    const photoInput=document.getElementById('swPhotoFile');
    const photoFile=photoInput&&photoInput.files[0]?photoInput.files[0]:null;
    if(!photoFile){showErr('Please upload a profile photo.');return;}

    setBtn('signupWorkerBtn','swBtnTxt',true,'Registering…');

    /* Step 0: Upload document to Supabase Storage */
    let docUrl='',docFileName='';
    try{
      const ext=docFile.name.split('.').pop().toLowerCase();
      docFileName='worker_'+Date.now()+'_'+Math.random().toString(36).slice(2,8)+'.'+ext;
      const {error:uploadErr}=await sb.storage
        .from('worker-documents')
        .upload(docFileName,docFile,{cacheControl:CONSTANTS.STORAGE_UPLOAD_CACHE_CONTROL,upsert:false});
      if(uploadErr)throw uploadErr;
      const {data:publicData}=sb.storage.from('worker-documents').getPublicUrl(docFileName);
      docUrl=publicData.publicUrl||'';
    }catch(uploadEx){
  console.error("UPLOAD ERROR OBJECT:", uploadEx);
  console.error("MESSAGE:", uploadEx?.message);
  console.error("FULL:", JSON.stringify(uploadEx,null,2));

  alert(uploadEx?.message || JSON.stringify(uploadEx,null,2));

  setBtn('signupWorkerBtn','swBtnTxt',false,'Register as Worker →');
  return;
}

    /* Step 0b: Upload Profile Photo — separate, customer-visible bucket.
       Deliberately NOT the same bucket as the Government ID document. */
    let photoUrl='';
    try{
      const pext=photoFile.name.split('.').pop().toLowerCase();
      const photoFileName='profile_'+Date.now()+'_'+Math.random().toString(36).slice(2,8)+'.'+pext;
      const {error:photoUploadErr}=await sb.storage
        .from('worker-photos')
        .upload(photoFileName,photoFile,{cacheControl:CONSTANTS.STORAGE_UPLOAD_CACHE_CONTROL,upsert:false});
      if(photoUploadErr)throw photoUploadErr;
      const {data:photoPublicData}=sb.storage.from('worker-photos').getPublicUrl(photoFileName);
      photoUrl=photoPublicData.publicUrl||'';
    }catch(photoUploadEx){
      console.error("PHOTO UPLOAD ERROR:", photoUploadEx);
      alert(photoUploadEx?.message || JSON.stringify(photoUploadEx,null,2));
      setBtn('signupWorkerBtn','swBtnTxt',false,'Register as Worker →');
      return;
    }

    /* Step 1: Create auth account */
    const {data:a,error:ae}=await sb.auth.signUp({
      email,
      password:pass,
      options:{data:{name,role:'worker'}}
    });
    if(ae){
      setBtn('signupWorkerBtn','swBtnTxt',false,'Register as Worker →');
      showErr(ae.message.includes('already registered')?'Email already registered. Try signing in.':ae.message);
      return;
    }

    const uid=a.user.id;

    /* Step 2: Insert into workers table ONLY — name, phone, skill, radius, exp, area/lat/lng all explicit */
    const {error:we}=await sb.from('workers').insert({
      id:           uid,
      name:         name,
      phone:        phone,
      skill:        skill,
      radius:       radiusInt,
      exp:          expInt,
      is_available: false,
      rating:       0,
      total_jobs:   0,
      emergency_available: emergencyAvailable,
      area:         selectedArea.name,
      lat:          selectedArea.lat,
      lng:          selectedArea.lng,
      document_url:  docUrl,
      document_name: docFileName,
      profile_photo_url: photoUrl
    });
    if(we){
      setBtn('signupWorkerBtn','swBtnTxt',false,'Register as Worker →');
      showErr('Worker profile save failed: '+we.message);
      await sb.from('workers').delete().eq('id',uid);
      await sb.auth.signOut();
      return;
    }

    const sess={
      id:     uid,
      email:  email,
      name:   name,
      phone:  phone,
      role:   'worker',
      skill:  skill,
      radius: radiusInt,
      exp:    expInt,
      emergency_available: emergencyAvailable,
      area:   selectedArea.name,
      lat:    selectedArea.lat,
      lng:    selectedArea.lng
    };
    sessionStorage.setItem('qf_user',JSON.stringify(sess));
    sessionStorage.setItem('qf_role','worker');
    setBtn('signupWorkerBtn','swBtnTxt',false,'Register as Worker →');
    showToast('🎉 Registration successful. Document uploaded successfully.');
    setTimeout(()=>redirect('worker'),CONSTANTS.AUTH_REDIRECT_DELAY_MS);
  }
}

/* ── FORGOT PASSWORD ── */
async function forgotPassword(e){
  e.preventDefault();
  const email=document.getElementById('lEmail').value.trim();
  if(!email){markErr('lEmail');showErr('Enter your email address above first.');return;}
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/auth.html'});
  if(error)showErr(error.message);
  else showToast('📧 Password reset email sent! Check your inbox.');
}

/* ── HELPERS ── */
function redirect(role){window.location.replace(role==='admin'?'admin.html':role==='worker'?'worker-dashboard.html':'index.html');}

function setBtn(bid,tid,loading,txt){
  document.getElementById(bid).classList.toggle('loading',loading);
  document.getElementById(tid).innerHTML=loading?`<span class="spin"></span> ${txt}`:txt;
}

/* markErr now comes from js/common/utils.js, loaded before this file. */
/* showToast now comes from js/common/toast.js, loaded before this file. */
function showErr(msg){
  const b=document.getElementById('errBanner');
  b.textContent='⚠️ '+msg;
  b.style.display='flex';
  b.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function hideErr(){document.getElementById('errBanner').style.display='none';}

document.querySelectorAll('.finput,.fselect').forEach(el=>{
  el.addEventListener('input', ()=>el.classList.remove('err'));
  el.addEventListener('change',()=>el.classList.remove('err'));
});