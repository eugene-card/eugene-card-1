(function(){'use strict';
const L='https://lunaristudio.vercel.app';
const CLIENT_ID='eugene-card';
const REDIRECT_URI='https://eugene-card-1.vercel.app/?connect=lunarist';
const ROOT='ec-lunarist-control',HOST='ec-lunarist-host',MENU_CLASS='ec-l-menu',STATE_KEY='ec-lunarist-oauth-state',VERIFIER_KEY='ec-lunarist-oauth-verifier';
if(window.__EUGENE_LUNARIST_SINGLETON__)return;window.__EUGENE_LUNARIST_SINGLETON__=true;
const db=()=>window.supabaseClient;
const clean=v=>String(v||'').trim().replace(/^@/,'');
function setCookie(k,v){document.cookie=encodeURIComponent(k)+'='+encodeURIComponent(v)+'; Max-Age=600; Path=/; SameSite=Lax'}
function getCookie(k){const p=encodeURIComponent(k)+'=';return document.cookie.split(';').map(x=>x.trim()).find(x=>x.indexOf(p)===0)?.slice(p.length)||''}
function delCookie(k){document.cookie=encodeURIComponent(k)+'=; Max-Age=0; Path=/; SameSite=Lax'}
function saveOAuthState(state,verifier){sessionStorage.setItem(STATE_KEY,state);sessionStorage.setItem(VERIFIER_KEY,verifier);setCookie(STATE_KEY,state);setCookie(VERIFIER_KEY,verifier)}
function loadOAuthState(){return{state:sessionStorage.getItem(STATE_KEY)||getCookie(STATE_KEY),verifier:sessionStorage.getItem(VERIFIER_KEY)||getCookie(VERIFIER_KEY)}}
function clearOAuthState(){sessionStorage.removeItem(STATE_KEY);sessionStorage.removeItem(VERIFIER_KEY);delCookie(STATE_KEY);delCookie(VERIFIER_KEY)}
async function me(){try{return window.EugeneCardAuth?.user||(await db()?.auth?.getUser())?.data?.user||null}catch{return null}}
async function token(){try{return(await db()?.auth?.getSession())?.data?.session?.access_token||null}catch{return null}}
async function link(id){try{const r=await db().from('lunarist_links').select('lunarist_user_id,lunarist_username,lunarist_profile_url,last_synced_at').eq('eugene_user_id',id).maybeSingle();return r.error?null:r.data}catch{return null}}
async function syncCurrentLunaristProfile(id,existing){if(!id||!existing?.lunarist_user_id)return existing;try{const r=await fetch(L+'/api/lunarist?resource=profiles',{cache:'no-store',headers:{accept:'application/json'}});if(!r.ok)return existing;const profiles=await r.json();const current=Array.isArray(profiles)?profiles.find(p=>String(p.id||'')===String(existing.lunarist_user_id)):null;if(!current?.username)return existing;const username=clean(current.username),profileUrl=`${L}/?username=${encodeURIComponent(username)}`;if(username===clean(existing.lunarist_username)&&profileUrl===String(existing.lunarist_profile_url||''))return existing;const patch={lunarist_username:username,lunarist_profile_url:profileUrl,last_synced_at:new Date().toISOString()};const local=await db().from('lunarist_links').update(patch).eq('eugene_user_id',id);if(local.error)return existing;await db().from('profiles').update({...patch,updated_at:new Date().toISOString()}).eq('id',id);return{...existing,...patch}}catch{return existing}}
async function sha(v){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));let s='';for(const b of new Uint8Array(d))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function random(){const a=new Uint8Array(16);crypto.getRandomValues(a);return[...a].map(x=>x.toString(16).padStart(2,'0')).join('')}
function toast(text,type){let t=document.getElementById('ec-l-toast');if(!t){t=document.createElement('div');t.id='ec-l-toast';document.body.appendChild(t)}t.className='ec-l-toast '+(type||'');t.textContent=String(text||'').replace(/\\n/g,' ');clearTimeout(window.__ecToast);window.__ecToast=setTimeout(()=>t.remove(),4500)}

// --- Dropdown menu is rendered as a body-level "portal" (fixed position,
// computed from the trigger's bounding rect) instead of being nested
// absolutely inside the nav pill. The nav strip scrolls horizontally
// (overflow-x), and an absolutely-positioned dropdown inside a scrolling
// container gets clipped by that container's overflow box — so opening it
// visually did nothing. Rendering it at the body level fixes that.
let openMenuEl=null,openTriggerEl=null,backdropEl=null;
const MOBILE_BREAKPOINT=768;
function isMobile(){return window.innerWidth<=MOBILE_BREAKPOINT}
function closeMenu(){if(openMenuEl){openMenuEl.classList.remove('open','mobile');openMenuEl.removeAttribute('style');openMenuEl.remove()}if(backdropEl){backdropEl.remove();backdropEl=null}if(openTriggerEl)openTriggerEl.setAttribute('aria-expanded','false');openMenuEl=null;openTriggerEl=null}
function positionMenu(trigger,menu){
  if(isMobile()){
    // Bottom sheet: full-width, pinned to the bottom of the viewport. A
    // small floating dropdown is easy to miss or mis-tap on a phone,
    // especially anchored under a pill that sits in a horizontally
    // scrolling nav strip.
    menu.classList.add('mobile');
    menu.style.left='12px';
    menu.style.right='12px';
    menu.style.width='auto';
    menu.style.top='';
    menu.style.bottom='max(12px, env(safe-area-inset-bottom))';
    return;
  }
  menu.classList.remove('mobile');
  menu.style.right='';
  menu.style.bottom='';
  const r=trigger.getBoundingClientRect();const width=Math.min(330,window.innerWidth-24);let left=r.right-width;if(left<12)left=12;let top=r.bottom+9;const maxTop=window.innerHeight-12;if(top>maxTop)top=Math.max(12,r.top-9-menu.offsetHeight);menu.style.width=width+'px';menu.style.left=left+'px';menu.style.top=top+'px';
}
function openMenu(trigger,menu){
  closeMenu();
  if(isMobile()){backdropEl=document.createElement('div');backdropEl.className='ec-l-backdrop';backdropEl.onclick=closeMenu;document.body.appendChild(backdropEl)}
  document.body.appendChild(menu);
  menu.classList.add('open');
  positionMenu(trigger,menu);
  openMenuEl=menu;openTriggerEl=trigger;trigger.setAttribute('aria-expanded','true');
}
function toggleMenu(trigger,menu){if(openMenuEl===menu)closeMenu();else openMenu(trigger,menu)}

async function waitForLunaristSession(timeout=5000){const end=Date.now()+timeout;while(Date.now()<end){const t=await token();if(t)return t;await new Promise(r=>setTimeout(r,250))}return null}
function closeOAuthDialog(){const d=document.getElementById('ec-l-oauth-dialog');if(d)d.remove()}
function showOAuthDialog(title,message,actions){closeOAuthDialog();const d=document.createElement('div');d.id='ec-l-oauth-dialog';d.innerHTML='<div class="ec-l-dialog-backdrop"></div><div class="ec-l-dialog"><div class="ec-l-dialog-title"></div><div class="ec-l-dialog-message"></div><div class="ec-l-dialog-actions"></div></div>';d.querySelector('.ec-l-dialog-title').textContent=title;d.querySelector('.ec-l-dialog-message').textContent=message;const box=d.querySelector('.ec-l-dialog-actions');(actions||[]).forEach(a=>{const b=document.createElement('button');b.type='button';b.className='ec-l-dialog-btn '+(a.kind||'');b.textContent=a.text;b.onclick=()=>{closeOAuthDialog();a.fn?.()};box.appendChild(b)});d.querySelector('.ec-l-dialog-backdrop').onclick=closeOAuthDialog;document.body.appendChild(d)}
async function approveLunaristConnection(){return new Promise(resolve=>{showOAuthDialog('Connect Lunarist Studio?','Eugene Card will request identity, profile, and offline access from your authenticated Lunarist account. You will be sent to Lunarist Studio to authorize the connection.',[{text:'Cancel',fn:()=>resolve(false)},{text:'Continue',kind:'primary',fn:()=>resolve(true)}])})}
async function finishOAuth(){const q=new URL(location.href).searchParams,code=q.get('code'),state=q.get('state'),error=q.get('error');if(!code&&!error)return;if(error){clearOAuthState();toast(q.get('error_description')||error,'error');history.replaceState({},'',location.pathname+location.hash);return}const saved=loadOAuthState();if(!state||!saved.state||state!==saved.state||!saved.verifier){showOAuthDialog('Lunarist connection expired','This authorization response no longer matches the active Eugene Card OAuth request. For security, the authorization code cannot be exchanged. Start a fresh Lunarist connection so Eugene Card can generate a new state and PKCE verifier.',[{text:'Start again',kind:'primary',fn:()=>{clearOAuthState();location.assign(location.pathname+'?connect=lunarist')}}]);return} /* EUGENE_LUNARIST_STATE_RECOVERY_V2 */const approved=await approveLunaristConnection();
if(!approved){clearOAuthState();history.replaceState({},'',location.pathname+location.hash);return}
/* EUGENE_LUNARIST_CALLBACK_APPROVAL_V1 */
const t=await waitForLunaristSession();if(!t){showOAuthDialog('Connection could not be completed','Your Eugene Card session was not ready when Lunarist returned. Please stay signed in and try Connect Lunarist again.',[{text:'Close'}]);return}try{const r=await fetch('/api/lunarist/exchange',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+t},body:JSON.stringify({code,code_verifier:saved.verifier,supabase_access_token:t})});let data={};try{data=await r.json()}catch{}if(!r.ok)throw Error(data.error||data.message||`OAuth exchange failed (${r.status})`);clearOAuthState();history.replaceState({},'',location.pathname+location.hash);const u=await me();let l=u?await link(u.id):null;l=u?await syncCurrentLunaristProfile(u.id,l):l;await mount(true);const dest=clean(l?.lunarist_username)&&l?.lunarist_profile_url;if(dest){toast('Lunarist connected — continuing to Lunarist…','success');setTimeout(()=>location.assign(dest),900)}else{toast('Lunarist connected successfully.','success')}}catch(e){showOAuthDialog('Lunarist authorization failed',e.message||'Failed to complete Lunarist OAuth. Please try the connection again.',[{text:'Close'}]);}}
async function start(button){if(button){button.disabled=true;button.textContent='Opening…'}try{const t=await token();if(!t)throw Error('Please sign in to Eugene Card first.');const state=random(),verifier=random(),challenge=await sha(verifier);saveOAuthState(state,verifier);const u=new URL(L+'/oauth/authorize');u.searchParams.set('client_id',CLIENT_ID);u.searchParams.set('redirect_uri',REDIRECT_URI);u.searchParams.set('response_type','code');u.searchParams.set('scope','identity profile offline_access');u.searchParams.set('state',state);u.searchParams.set('code_challenge',challenge);u.searchParams.set('code_challenge_method','S256');location.assign(u.toString())}catch(e){if(button){button.disabled=false;button.textContent='Connect Lunarist'}toast(e.message||'Unable to start Lunarist OAuth.','error')}}
async function revoke(button){const t=await token();if(!t)throw Error('Please sign in again.');button.disabled=true;button.textContent='Disconnecting…';try{const r=await fetch('/api/lunarist/revoke',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+t},body:JSON.stringify({supabase_access_token:t})});let x={};try{x=await r.json()}catch{}if(!r.ok)throw Error(x.error||'Unable to disconnect Lunarist');await mount(true);toast('Lunarist disconnected.','success')}finally{button.disabled=false;button.textContent='Disconnect'}}
function cleanupLiteralEscapedNewlines(root=document.body){if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const n of nodes){const p=n.parentElement;if(!p||/^(SCRIPT|STYLE|PRE|TEXTAREA)$/i.test(p.tagName))continue;if(n.nodeValue&&n.nodeValue.indexOf('\\n')!==-1)n.nodeValue=n.nodeValue.replace(/\\n+/g,' ')}}
function oauthDialogCss(){if(document.getElementById('ec-l-oauth-dialog-css'))return;const s=document.createElement('style');s.id='ec-l-oauth-dialog-css';s.textContent='#ec-l-oauth-dialog{position:fixed;inset:0;z-index:2147483647;font-family:Inter,system-ui,sans-serif}.ec-l-dialog-backdrop{position:absolute;inset:0;background:rgba(2,6,23,.72);backdrop-filter:blur(7px)}.ec-l-dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,calc(100vw - 32px));padding:22px;border:1px solid rgba(129,140,248,.3);border-radius:20px;background:linear-gradient(145deg,#111827,#030712);color:#f8fafc;box-shadow:0 30px 90px rgba(0,0,0,.65)}.ec-l-dialog-title{font-size:18px;font-weight:900}.ec-l-dialog-message{margin-top:9px;color:#94a3b8;font-size:12px;line-height:1.6}.ec-l-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.ec-l-dialog-btn{border:1px solid rgba(148,163,184,.22);border-radius:11px;padding:9px 14px;background:#1e293b;color:#e2e8f0;font:800 12px Inter,system-ui,sans-serif;cursor:pointer}.ec-l-dialog-btn.primary{background:#4f46e5;border-color:#6366f1;color:white}.ec-l-dialog-btn:hover{filter:brightness(1.08)}';document.head.appendChild(s)}
function oauthDialogCss(){if(document.getElementById('ec-l-oauth-dialog-css'))return;const s=document.createElement('style');s.id='ec-l-oauth-dialog-css';s.textContent='#ec-l-oauth-dialog{position:fixed;inset:0;z-index:2147483647;font-family:Inter,system-ui,sans-serif}.ec-l-dialog-backdrop{position:absolute;inset:0;background:rgba(2,6,23,.72);backdrop-filter:blur(7px)}.ec-l-dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,calc(100vw - 32px));padding:22px;border:1px solid rgba(129,140,248,.3);border-radius:20px;background:linear-gradient(145deg,#111827,#030712);color:#f8fafc;box-shadow:0 30px 90px rgba(0,0,0,.65)}.ec-l-dialog-title{font-size:18px;font-weight:900}.ec-l-dialog-message{margin-top:9px;color:#94a3b8;font-size:12px;line-height:1.6}.ec-l-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.ec-l-dialog-btn{border:1px solid rgba(148,163,184,.22);border-radius:11px;padding:9px 14px;background:#1e293b;color:#e2e8f0;font:800 12px Inter,system-ui,sans-serif;cursor:pointer}.ec-l-dialog-btn.primary{background:#4f46e5;border-color:#6366f1;color:white}.ec-l-dialog-btn:hover{filter:brightness(1.08)}';document.head.appendChild(s)}
function oauthDialogCss(){if(document.getElementById('ec-l-oauth-dialog-css'))return;const s=document.createElement('style');s.id='ec-l-oauth-dialog-css';s.textContent='#ec-l-oauth-dialog{position:fixed;inset:0;z-index:2147483647;font-family:Inter,system-ui,sans-serif}.ec-l-dialog-backdrop{position:absolute;inset:0;background:rgba(2,6,23,.72);backdrop-filter:blur(7px)}.ec-l-dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,calc(100vw - 32px));padding:22px;border:1px solid rgba(129,140,248,.3);border-radius:20px;background:linear-gradient(145deg,#111827,#030712);color:#f8fafc;box-shadow:0 30px 90px rgba(0,0,0,.65)}.ec-l-dialog-title{font-size:18px;font-weight:900}.ec-l-dialog-message{margin-top:9px;color:#94a3b8;font-size:12px;line-height:1.6}.ec-l-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.ec-l-dialog-btn{border:1px solid rgba(148,163,184,.22);border-radius:11px;padding:9px 14px;background:#1e293b;color:#e2e8f0;font:800 12px Inter,system-ui,sans-serif;cursor:pointer}.ec-l-dialog-btn.primary{background:#4f46e5;border-color:#6366f1;color:white}.ec-l-dialog-btn:hover{filter:brightness(1.08)}';document.head.appendChild(s)}
function oauthDialogCss(){if(document.getElementById('ec-l-oauth-dialog-css'))return;const s=document.createElement('style');s.id='ec-l-oauth-dialog-css';s.textContent='#ec-l-oauth-dialog{position:fixed;inset:0;z-index:2147483647;font-family:Inter,system-ui,sans-serif}.ec-l-dialog-backdrop{position:absolute;inset:0;background:rgba(2,6,23,.72);backdrop-filter:blur(7px)}.ec-l-dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,calc(100vw - 32px));padding:22px;border:1px solid rgba(129,140,248,.3);border-radius:20px;background:linear-gradient(145deg,#111827,#030712);color:#f8fafc;box-shadow:0 30px 90px rgba(0,0,0,.65)}.ec-l-dialog-title{font-size:18px;font-weight:900}.ec-l-dialog-message{margin-top:9px;color:#94a3b8;font-size:12px;line-height:1.6}.ec-l-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.ec-l-dialog-btn{border:1px solid rgba(148,163,184,.22);border-radius:11px;padding:9px 14px;background:#1e293b;color:#e2e8f0;font:800 12px Inter,system-ui,sans-serif;cursor:pointer}.ec-l-dialog-btn.primary{background:#4f46e5;border-color:#6366f1;color:white}.ec-l-dialog-btn:hover{filter:brightness(1.08)}';document.head.appendChild(s)}
function oauthDialogCss(){if(document.getElementById('ec-l-oauth-dialog-css'))return;const s=document.createElement('style');s.id='ec-l-oauth-dialog-css';s.textContent='#ec-l-oauth-dialog{position:fixed;inset:0;z-index:2147483647;font-family:Inter,system-ui,sans-serif}.ec-l-dialog-backdrop{position:absolute;inset:0;background:rgba(2,6,23,.72);backdrop-filter:blur(7px)}.ec-l-dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,calc(100vw - 32px));padding:22px;border:1px solid rgba(129,140,248,.3);border-radius:20px;background:linear-gradient(145deg,#111827,#030712);color:#f8fafc;box-shadow:0 30px 90px rgba(0,0,0,.65)}.ec-l-dialog-title{font-size:18px;font-weight:900}.ec-l-dialog-message{margin-top:9px;color:#94a3b8;font-size:12px;line-height:1.6}.ec-l-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.ec-l-dialog-btn{border:1px solid rgba(148,163,184,.22);border-radius:11px;padding:9px 14px;background:#1e293b;color:#e2e8f0;font:800 12px Inter,system-ui,sans-serif;cursor:pointer}.ec-l-dialog-btn.primary{background:#4f46e5;border-color:#6366f1;color:white}.ec-l-dialog-btn:hover{filter:brightness(1.08)}';document.head.appendChild(s)}
function oauthDialogCss(){if(document.getElementById('ec-l-oauth-dialog-css'))return;const s=document.createElement('style');s.id='ec-l-oauth-dialog-css';s.textContent='#ec-l-oauth-dialog{position:fixed;inset:0;z-index:2147483647;font-family:Inter,system-ui,sans-serif}.ec-l-dialog-backdrop{position:absolute;inset:0;background:rgba(2,6,23,.72);backdrop-filter:blur(7px)}.ec-l-dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,calc(100vw - 32px));padding:22px;border:1px solid rgba(129,140,248,.3);border-radius:20px;background:linear-gradient(145deg,#111827,#030712);color:#f8fafc;box-shadow:0 30px 90px rgba(0,0,0,.65)}.ec-l-dialog-title{font-size:18px;font-weight:900}.ec-l-dialog-message{margin-top:9px;color:#94a3b8;font-size:12px;line-height:1.6}.ec-l-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.ec-l-dialog-btn{border:1px solid rgba(148,163,184,.22);border-radius:11px;padding:9px 14px;background:#1e293b;color:#e2e8f0;font:800 12px Inter,system-ui,sans-serif;cursor:pointer}.ec-l-dialog-btn.primary{background:#4f46e5;border-color:#6366f1;color:white}.ec-l-dialog-btn:hover{filter:brightness(1.08)}';document.head.appendChild(s)}
function oauthDialogCss(){if(document.getElementById('ec-l-oauth-dialog-css'))return;const s=document.createElement('style');s.id='ec-l-oauth-dialog-css';s.textContent='#ec-l-oauth-dialog{position:fixed;inset:0;z-index:2147483647;font-family:Inter,system-ui,sans-serif}.ec-l-dialog-backdrop{position:absolute;inset:0;background:rgba(2,6,23,.72);backdrop-filter:blur(7px)}.ec-l-dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,calc(100vw - 32px));padding:22px;border:1px solid rgba(129,140,248,.3);border-radius:20px;background:linear-gradient(145deg,#111827,#030712);color:#f8fafc;box-shadow:0 30px 90px rgba(0,0,0,.65)}.ec-l-dialog-title{font-size:18px;font-weight:900}.ec-l-dialog-message{margin-top:9px;color:#94a3b8;font-size:12px;line-height:1.6}.ec-l-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.ec-l-dialog-btn{border:1px solid rgba(148,163,184,.22);border-radius:11px;padding:9px 14px;background:#1e293b;color:#e2e8f0;font:800 12px Inter,system-ui,sans-serif;cursor:pointer}.ec-l-dialog-btn.primary{background:#4f46e5;border-color:#6366f1;color:white}.ec-l-dialog-btn:hover{filter:brightness(1.08)}';document.head.appendChild(s)}
function oauthDialogCss(){if(document.getElementById('ec-l-oauth-dialog-css'))return;const s=document.createElement('style');s.id='ec-l-oauth-dialog-css';s.textContent='#ec-l-oauth-dialog{position:fixed;inset:0;z-index:2147483647;font-family:Inter,system-ui,sans-serif}.ec-l-dialog-backdrop{position:absolute;inset:0;background:rgba(2,6,23,.72);backdrop-filter:blur(7px)}.ec-l-dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,calc(100vw - 32px));padding:22px;border:1px solid rgba(129,140,248,.3);border-radius:20px;background:linear-gradient(145deg,#111827,#030712);color:#f8fafc;box-shadow:0 30px 90px rgba(0,0,0,.65)}.ec-l-dialog-title{font-size:18px;font-weight:900}.ec-l-dialog-message{margin-top:9px;color:#94a3b8;font-size:12px;line-height:1.6}.ec-l-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.ec-l-dialog-btn{border:1px solid rgba(148,163,184,.22);border-radius:11px;padding:9px 14px;background:#1e293b;color:#e2e8f0;font:800 12px Inter,system-ui,sans-serif;cursor:pointer}.ec-l-dialog-btn.primary{background:#4f46e5;border-color:#6366f1;color:white}.ec-l-dialog-btn:hover{filter:brightness(1.08)}';document.head.appendChild(s)}
function css(){if(document.getElementById('ec-l-css'))return;const s=document.createElement('style');s.id='ec-l-css';s.textContent='#'+HOST+'{display:flex;align-items:center;margin-left:auto;position:relative;z-index:50;font-family:Inter,system-ui,sans-serif;color:#f8fafc}#'+ROOT+'{position:relative;display:flex;align-items:center}#'+ROOT+' .ec-l-trigger{display:flex;align-items:center;gap:7px;border:1px solid rgba(129,140,248,.35);border-radius:11px;padding:8px 11px;background:linear-gradient(135deg,rgba(30,27,75,.92),rgba(15,23,42,.94));color:#f8fafc;cursor:pointer;font:800 12px Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.22)}#'+ROOT+' .ec-l-trigger:hover{border-color:#818cf8;box-shadow:0 8px 28px rgba(0,0,0,.3),0 0 18px rgba(99,102,241,.16)}.'+MENU_CLASS+'{display:none;position:fixed;width:330px;padding:16px;border:1px solid rgba(129,140,248,.28);border-radius:16px;background:linear-gradient(145deg,rgba(15,23,42,.99),rgba(3,7,18,.99));color:#f8fafc;box-shadow:0 24px 60px rgba(0,0,0,.58);backdrop-filter:blur(18px);z-index:2147483000}.'+MENU_CLASS+'.open{display:block}.ec-l-title{font-size:14px;font-weight:850;margin:0}.ec-l-sub{font-size:11px;color:#94a3b8;margin:4px 0 12px}.ec-l-status{padding:11px;border:1px solid rgba(129,140,248,.18);border-radius:11px;background:rgba(30,41,59,.62);margin-bottom:9px;font-size:12px}.ec-l-status span{display:block;color:#94a3b8;margin-top:3px;font-size:11px}.ec-l-actions{display:grid;gap:7px}.ec-l-action{width:100%;text-align:left;border:1px solid rgba(129,140,248,.35);border-radius:11px;padding:9px 11px;background:rgba(30,27,75,.72);color:#f8fafc;cursor:pointer;font:800 12px Inter,system-ui,sans-serif}.ec-l-action.danger{color:#fecaca;background:rgba(69,10,10,.55);border-color:rgba(248,113,113,.3)}.ec-l-dot{width:7px;height:7px;border-radius:50%;background:#64748b}.ec-l-dot.connected{background:#34d399;box-shadow:0 0 9px #34d399}#ec-l-toast{position:fixed;right:18px;top:18px;z-index:2147483001;padding:11px 13px;border-radius:11px;background:linear-gradient(135deg,#1e1b4b,#0f172a);color:#e2e8f0;border:1px solid rgba(129,140,248,.32);font:600 12px Inter,system-ui,sans-serif;box-shadow:0 15px 45px rgba(0,0,0,.5)}#ec-l-toast.error{color:#fecaca;border-color:#7f1d1d}.ec-l-backdrop{position:fixed;inset:0;background:rgba(2,6,23,.55);z-index:2147482999;backdrop-filter:blur(2px)}@media(max-width:768px){#'+HOST+'{margin-left:0}#'+ROOT+' .ec-l-trigger{padding:7px 9px}#'+ROOT+' .ec-l-trigger .ec-l-label{display:none}.'+MENU_CLASS+'.mobile{border-radius:18px 18px 12px 12px;padding:18px 16px calc(16px + env(safe-area-inset-bottom))}.'+MENU_CLASS+'.mobile .ec-l-actions{gap:9px}.'+MENU_CLASS+'.mobile .ec-l-action{padding:12px 13px;font-size:13px}}';document.head.appendChild(s)}
function action(text,fn,kind){const b=document.createElement('button');b.type='button';b.className='ec-l-action '+(kind||'');b.textContent=text;b.onclick=e=>{e.stopPropagation();fn(b)};return b}
function findHost(){
  // Defensive dedupe: if more than one host/root ended up on the page
  // (e.g. from a stale cached copy of this script, or a page that got
  // mounted twice before this fix), keep only the first of each and drop
  // the rest. This is what makes "sometimes 2, sometimes 3" pills
  // self-heal instead of accumulating.
  const hosts=[...document.querySelectorAll('#'+HOST)];
  hosts.slice(1).forEach(h=>h.remove());
  const roots=[...document.querySelectorAll('#'+ROOT)];
  roots.slice(1).forEach(r=>r.remove());
  document.querySelectorAll('.'+MENU_CLASS).forEach(m=>m.remove());
  const existing=hosts[0];
  if(existing)return existing;
  const header=document.querySelector('header');
  if(!header)return null;
  const host=document.createElement('div');
  host.id=HOST;
  host.setAttribute('data-eugene-lunarist','1');
  const nav=header.querySelector('nav');
  (nav||header).appendChild(host);
  return host;
}
async function mount(force){
  if(!document.body)return;
  css();
  const u=await me();
  if(!u){closeMenu();document.querySelectorAll('#'+HOST).forEach(h=>h.remove());return}
  const host=findHost();
  if(!host)return;
  let root=document.getElementById(ROOT);
  if(root&&root.parentElement!==host){root.remove();root=null}
  if(root&&!force)return;
  closeMenu();
  if(!root){root=document.createElement('div');root.id=ROOT;host.appendChild(root)}
  root.replaceChildren();
  let l=await link(u.id);
  l=await syncCurrentLunaristProfile(u.id,l);
  const ok=!!clean(l?.lunarist_username);
  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='ec-l-trigger';
  trigger.innerHTML='<span>↔</span><span class="ec-l-dot '+(ok?'connected':'')+'"></span><span class="ec-l-label">'+(ok?'Lunarist Connected':'Connect Lunarist')+'</span>';
  const menu=document.createElement('div');
  menu.className=MENU_CLASS;
  const title=document.createElement('p');
  title.className='ec-l-title';
  title.textContent='Lunarist Studio';
  const sub=document.createElement('p');
  sub.className='ec-l-sub';
  sub.textContent=ok?'Your Eugene Card account is securely linked.':'Secure OAuth 2.0 + PKCE connection.';
  const status=document.createElement('div');
  status.className='ec-l-status';
  status.innerHTML='<strong>'+(ok?'Connection active':'Ready to connect')+'</strong><span>'+(ok?'@'+clean(l.lunarist_username):'eugene-card • identity profile offline_access')+'</span>';
  const actions=document.createElement('div');
  actions.className='ec-l-actions';
  if(ok){
    actions.append(action('Open Lunarist',()=>location.assign(l.lunarist_profile_url||L)));
    actions.append(action('Disconnect',async b=>{if(confirm('Disconnect Lunarist from this Eugene Card account?'))try{await revoke(b)}catch(e){toast(e.message||'Unable to disconnect.','error')}},'danger'));
  }else{
    actions.append(action('Connect Lunarist',async b=>{const approved=await approveLunaristConnection();if(approved)await start(b)}));
  }
  menu.append(title,sub,status,actions);
  trigger.setAttribute('aria-expanded','false');
  trigger.onclick=e=>{e.stopPropagation();toggleMenu(trigger,menu)};
  menu.onclick=e=>e.stopPropagation();
  root.append(trigger);
}
function scheduleMount(){clearTimeout(window.__ecLunaristMountTimer);window.__ecLunaristMountTimer=setTimeout(()=>mount(false),80)}
function init(){
  oauthDialogCss();
  const run=async()=>{cleanupLiteralEscapedNewlines();await finishOAuth();await mount()};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run,{once:true}):run();
  document.addEventListener('click',e=>{if(e.target.closest?.('#'+ROOT)||e.target.closest?.('.'+MENU_CLASS))return;closeMenu()});
  window.addEventListener('resize',()=>{if(openMenuEl&&openTriggerEl)positionMenu(openTriggerEl,openMenuEl)});
  window.addEventListener('scroll',()=>{if(openMenuEl)closeMenu()},true);
  db()?.auth?.onAuthStateChange?.(()=>mount(true));
  const mo=new MutationObserver(()=>{
    cleanupLiteralEscapedNewlines();
    const hosts=document.querySelectorAll('#'+HOST);
    const root=document.getElementById(ROOT);
    if(hosts.length>1||!hosts.length||!root||root.parentElement!==hosts[0])scheduleMount();
  });
  mo.observe(document.body,{subtree:true,childList:true,characterData:true});
}
init();})();
