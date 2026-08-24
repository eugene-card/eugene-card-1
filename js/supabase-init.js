/* Eugene Card — Supabase-only authentication, profiles and role UI */
(function () {
  const SUPABASE_URL = 'https://tsjgvzpzfjyecnginipt.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_o3oWlPh_EPj5xd0GBjDWYQ_UhVicSH3';
  const ADMIN_EMAILS = ['eugene.aquila06@gmail.com', 'eugenecard.market@gmail.com'];
  const isAdminEmail = email => ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
  window.isUserAdmin = isAdminEmail;
  window.EUGENE_ADMIN_EMAIL = ADMIN_EMAILS[0];

  if (!window.supabase) { console.error('Supabase SDK missing'); return; }
  const sb = window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
  });

  function authUser(user) {
    if (!user) return null;
    const m = user.user_metadata || {};
    return { ...user, uid:user.id, displayName:m.full_name || m.name || user.email || '', photoURL:m.avatar_url || m.picture || '', emailVerified:!!user.email_confirmed_at, isAdmin:isAdminEmail(user.email) };
  }
  function profile(row) {
    if (!row) return null;
    return { ...row,
      name:row.display_name || row.name || '', display_name:row.display_name || row.name || '',
      avatarUrl:row.avatar_url || row.avatarUrl || '', username:row.username || '', bio:row.bio || '',
      isPlusMember:!!(row.is_plus_member ?? row.isPlusMember),
      socialIg:row.social_ig || row.socialIg || '', socialTwitter:row.social_twitter || row.socialTwitter || '',
      socialTiktok:row.social_tiktok || row.socialTiktok || '', socialWeb:row.social_web || row.socialWeb || '',
      profileCompleted:!!(row.profile_completed ?? row.profileCompleted), isAdmin:row.role === 'admin' || isAdminEmail(row.email)
    };
  }

  async function ensureProfile(user) {
    if (!user) return null;
    const email = String(user.email || '').trim().toLowerCase();
    let {data:p,error} = await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
    if (error) { console.error('Profile read failed:', error); return null; }
    if (!p) {
      const m=user.user_metadata || {}, name=m.full_name || m.name || email.split('@')[0];
      const row={id:user.id,username:name.toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,''),display_name:name,avatar_url:m.avatar_url || m.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,bio:'',role:isAdminEmail(email)?'admin':'user',is_plus_member:false,social_ig:'',social_twitter:'',social_tiktok:'',social_web:'',profile_completed:false,updated_at:new Date().toISOString()};
      const r=await sb.from('profiles').upsert(row,{onConflict:'id'}).select().single();
      p=r.data || row;
    } else if (isAdminEmail(email) && p.role !== 'admin') {
      const r=await sb.from('profiles').update({role:'admin',updated_at:new Date().toISOString()}).eq('id',user.id).select().single();
      p=r.data || {...p,role:'admin'};
    }
    return profile(p);
  }
  window.ensureSupabaseProfile=ensureProfile;

  async function sync(reason='manual') {
    try {
      const {data,error}=await sb.auth.getSession(); if(error) throw error;
      const u=authUser(data.session?.user || null);
      window.currentUser=u; if(window.auth) window.auth.currentUser=u;
      if(u){ const p=await ensureProfile(u); if(p){u.profile=p;u.username=p.username;u.name=p.name;u.displayName=p.name || u.displayName;u.avatarUrl=p.avatarUrl || u.photoURL;u.bio=p.bio;u.isPlusMember=p.isPlusMember;u.isAdmin=p.isAdmin || isAdminEmail(u.email);window.currentUser=u;if(window.auth)window.auth.currentUser=u;} }
      window.dispatchEvent(new CustomEvent('eugene-card-sync',{detail:{reason,user:u}}));
      renderLoggedInUI(u);
      return u;
    } catch(e){ console.warn('Supabase sync failed:',e); return window.currentUser || null; }
  }
  window.syncEugeneCardFromServer=sync;

  function esc(v){return String(v ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
  function findAuthHost(){return document.getElementById('auth-header-container') || document.querySelector('[data-auth-header]') || document.querySelector('header');}
  function findLoginButtons(){return [...document.querySelectorAll('button,a,[role="button"]')].filter(el=>/^\s*(log\s*in|login|sign\s*in)\s*$/i.test(el.textContent||''));}

  function profileModal(){
    if(document.getElementById('ec-profile-modal')) return document.getElementById('ec-profile-modal');
    const d=document.createElement('div'); d.id='ec-profile-modal'; d.innerHTML=`<div class="ecp-backdrop"></div><div class="ecp-card" role="dialog" aria-modal="true" aria-labelledby="ecp-title"><div class="ecp-head"><h2 id="ecp-title">Customize Profile</h2><button type="button" data-ecp-close aria-label="Close">×</button></div><form id="ecp-form"><div class="ecp-avatar"><img id="ecp-avatar" alt="Profile avatar"><div><label>Avatar URL<input id="ecp-avatar-url" type="url" placeholder="https://..."></label></div></div><label>Display name<input id="ecp-name" maxlength="80" required></label><label>Username<input id="ecp-username" maxlength="40"></label><label>Bio<textarea id="ecp-bio" maxlength="500" rows="4"></textarea></label><div class="ecp-actions"><button type="button" data-ecp-close>Cancel</button><button type="submit">Save Profile</button></div><p id="ecp-status"></p></form></div>`;
    d.style.cssText='display:none;position:fixed;inset:0;z-index:99999;font-family:Inter,system-ui,sans-serif';
    const s=document.createElement('style'); s.textContent='#ec-profile-modal .ecp-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(8px)}#ec-profile-modal .ecp-card{position:relative;margin:7vh auto;max-width:560px;width:calc(100% - 24px);max-height:86vh;overflow:auto;background:#0f172a;color:#f8fafc;border:1px solid #334155;border-radius:20px;padding:22px;box-shadow:0 30px 90px rgba(0,0,0,.6)}#ec-profile-modal .ecp-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}#ec-profile-modal h2{font-size:20px;font-weight:800}#ec-profile-modal label{display:block;font-size:12px;font-weight:700;color:#cbd5e1;margin:12px 0}#ec-profile-modal input,#ec-profile-modal textarea{display:block;width:100%;margin-top:6px;background:#020617;border:1px solid #334155;color:#f8fafc;border-radius:10px;padding:10px;outline:none}#ec-profile-modal input:focus,#ec-profile-modal textarea:focus{border-color:#818cf8}#ec-profile-modal .ecp-avatar{display:grid;grid-template-columns:76px 1fr;gap:14px;align-items:center}.ecp-avatar img{width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid #6366f1}.ecp-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.ecp-actions button{border:1px solid #475569;border-radius:10px;padding:9px 14px;background:#1e293b;color:#fff;cursor:pointer}.ecp-actions button[type=submit]{background:#4f46e5;border-color:#6366f1}.ecp-head button{background:none;border:0;color:#94a3b8;font-size:28px;cursor:pointer}.ecp-status{font-size:12px;margin-top:10px;color:#94a3b8}'; document.head.appendChild(s); document.body.appendChild(d);
    const close=()=>d.style.display='none'; d.querySelectorAll('[data-ecp-close]').forEach(x=>x.addEventListener('click',close)); d.querySelector('.ecp-backdrop').addEventListener('click',close);
    d.querySelector('#ecp-form').addEventListener('submit',async e=>{e.preventDefault();const u=window.currentUser;if(!u)return;const status=d.querySelector('#ecp-status');status.textContent='Saving…';const row={display_name:d.querySelector('#ecp-name').value.trim(),username:d.querySelector('#ecp-username').value.trim(),bio:d.querySelector('#ecp-bio').value.trim(),avatar_url:d.querySelector('#ecp-avatar-url').value.trim(),updated_at:new Date().toISOString()};const r=await sb.from('profiles').update(row).eq('id',u.id).select().single();if(r.error){status.textContent='Could not save profile: '+r.error.message;return;}status.textContent='Profile saved.';await sync('profile-saved');setTimeout(close,500);});
    return d;
  }
  window.openProfileCustomization=()=>{const d=profileModal(),p=window.currentUser?.profile||{};d.querySelector('#ecp-name').value=p.name||window.currentUser?.displayName||'';d.querySelector('#ecp-username').value=p.username||'';d.querySelector('#ecp-bio').value=p.bio||'';d.querySelector('#ecp-avatar-url').value=p.avatarUrl||window.currentUser?.photoURL||'';d.querySelector('#ecp-avatar').src=p.avatarUrl||window.currentUser?.photoURL||'https://api.dicebear.com/7.x/initials/svg?seed=Eugene';d.querySelector('#ecp-status').textContent='';d.style.display='block';};

  async function logout(){await sb.auth.signOut();window.currentUser=null;if(window.auth)window.auth.currentUser=null;renderLoggedInUI(null);}
  function renderLoggedInUI(u){
    const buttons=findLoginButtons();
    buttons.forEach(el=>{
      if(!u){el.style.removeProperty('display');el.textContent='Log In';el.onclick=null;return;}
      const host=el.parentElement; if(!host)return;
      const replacement=document.createElement('div'); replacement.className='ec-auth-profile-control'; replacement.style.cssText='display:flex;align-items:center;gap:8px;position:relative';
      const img=document.createElement('img');img.src=u.profile?.avatarUrl||u.photoURL||`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.email)}`;img.alt='Profile';img.style.cssText='width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid #6366f1';
      const btn=document.createElement('button');btn.type='button';btn.textContent=u.profile?.name||u.displayName||u.email;btn.style.cssText='background:transparent;border:0;color:inherit;font-weight:700;cursor:pointer;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      const menu=document.createElement('div');menu.style.cssText='display:none;position:absolute;right:0;top:44px;min-width:220px;background:#0f172a;border:1px solid #334155;border-radius:14px;padding:8px;box-shadow:0 20px 50px rgba(0,0,0,.5);z-index:9999)';
      const item=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='display:block;width:100%;text-align:left;padding:10px;border:0;background:transparent;color:#f8fafc;border-radius:9px;cursor:pointer';b.onmouseenter=()=>b.style.background='#1e293b';b.onmouseleave=()=>b.style.background='transparent';b.onclick=()=>{menu.style.display='none';fn()};return b;};
      menu.append(item('Customize Profile',window.openProfileCustomization));
      if(u.isAdmin){menu.append(item('Admin Command Center',()=>location.href='./admin-command-center.html'),item('Inventory',()=>location.href='./admin-command-center.html#inventory'),item('Analytics',()=>location.href='./analytics.html'),item('Revenue',()=>location.href='./revenue.html'));}
      menu.append(item('Log Out',logout));
      btn.onclick=()=>menu.style.display=menu.style.display==='block'?'none':'block'; replacement.append(img,btn,menu); host.replaceChild(replacement,el);
    });
    // Also expose a stable profile control for pages that render the auth area later.
    const host=findAuthHost(); if(host && u && !host.querySelector('.ec-auth-profile-control')){const b=document.createElement('button');b.type='button';b.textContent='Profile';b.onclick=window.openProfileCustomization;b.dataset.ecProfileFallback='1';b.style.cssText='display:none';host.appendChild(b);}
  }

  sb.auth.onAuthStateChange((_event,session)=>{window.currentUser=authUser(session?.user||null);if(window.auth)window.auth.currentUser=window.currentUser;setTimeout(()=>sync('auth-change'),0);});
  sb.auth.getSession().then(()=>sync('initial'));
  window.addEventListener('focus',()=>sync('focus'));window.addEventListener('online',()=>sync('online'));document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync('visible')});setInterval(()=>{if(!document.hidden)sync('periodic')},15000);
  const channel=sb.channel('eugene-card-profile-sync').on('postgres_changes',{event:'*',schema:'public',table:'profiles'},()=>sync('profile-realtime')).subscribe();
  const boot=()=>{profileModal();renderLoggedInUI(window.currentUser);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  const observer=new MutationObserver(()=>{if(window.currentUser)renderLoggedInUI(window.currentUser);});
  const startObs=()=>{if(document.body)observer.observe(document.body,{childList:true,subtree:true});};
  startObs();
})();
