/* Admin Inventory owner dropdowns backed by Supabase Auth users via secure RPC/Edge Function when available. */
(function(){'use strict';
const ADMINS=new Set(['eugene.aquila06@gmail.com','eugenecard.market@gmail.com']);
let users=[],observer=null,running=false;
const sb=()=>window.supabaseClient;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function admin(){try{const client=sb();if(!client?.auth)return false;const r=await client.auth.getUser(),u=r?.data?.user;return !!u?.email&&ADMINS.has(u.email.trim().toLowerCase())}catch(_){return false}}
async function load(){const client=sb();if(!client)return false;users=[];
  try{const r=await client.rpc('admin_list_users');if(!r.error&&Array.isArray(r.data)){users=r.data.filter(u=>u?.id).map(u=>({id:String(u.id),email:u.email||'',username:u.username||u.user_metadata?.username||'',display_name:u.display_name||u.user_metadata?.display_name||u.user_metadata?.full_name||u.email||u.id}));return true}}catch(_){ }
  for(const source of ['admin_users','admin_user_list']){try{const r=await client.from(source).select('id,email,username,display_name').order('display_name',{ascending:true});if(!r.error){users=(r.data||[]).filter(u=>u?.id);return true}}catch(_){}}
  return false;
}
function field(e){if(!(e instanceof HTMLInputElement||e instanceof HTMLSelectElement))return false;const n=String(e.name||'').toLowerCase(),a=String(e.getAttribute('data-field')||e.getAttribute('aria-label')||'').toLowerCase();return n==='owner'||n==='holder'||n==='card-owner'||a==='owner'||a.includes('card owner')||a.includes('holder')}
function decorate(input){
  if(!input||input.dataset.inventoryOwnerUsers==='1'||!field(input))return;
  const cur=String(input.value||'');
  const originalName=input.name||'owner';
  const s=document.createElement('select');
  s.name='owner_picker';
  s.className=input.className||'';
  s.dataset.inventoryOwnerUsers='1';
  s.setAttribute('aria-label','Select registered card owner');
  let match=null;
  let html='<option value="">Select registered owner…</option>';
  users.forEach(u=>{
    const vals=[u.id,u.email,u.username,u.display_name].filter(Boolean).map(String);
    if(vals.some(x=>x.toLowerCase()===cur.toLowerCase()))match=u;
    const label=u.display_name||u.username||u.email||u.id;
    const extra=u.username&&label!==u.username?' (@'+u.username+')':(u.email&&label!==u.email?' — '+u.email:'');
    html+='<option value="'+esc(u.id)+'">'+esc(label)+esc(extra)+'</option>';
  });
  s.innerHTML=html;
  s.value=match?String(match.id):'';
  const manual=document.createElement('input');
  manual.type='text';
  manual.name=originalName;
  manual.value=cur;
  manual.className=input.className||'';
  manual.setAttribute('aria-label','Manual owner username');
  manual.placeholder='Enter username manually';
  manual.autocomplete='off';
  manual.dataset.inventoryOwnerUsers='1';
  const hint=document.createElement('div');
  hint.className='text-[11px] text-slate-400';
  hint.textContent='Registered owner or manual username';
  s.addEventListener('change',function(){
    const u=users.find(x=>String(x.id)===String(s.value));
    if(u)manual.value=u.username||u.display_name||u.email||u.id;
  });
  input.replaceWith(s);
  s.insertAdjacentElement('afterend',manual);
  manual.insertAdjacentElement('afterend',hint);
}
function scan(){if(!running)return;try{document.querySelectorAll('input,select').forEach(decorate)}catch(e){console.warn('Inventory owner UI scan failed',e)}}
function strip(){document.querySelectorAll('[data-inventory-owner-users="1"]').forEach(el=>{if(el.tagName==='INPUT'&&el.name!=='owner_picker')return;el.remove()});}
async function start(){const client=sb();if(!client||running)return;if(!(await admin()))return;running=true;await load();scan();observer=new MutationObserver(()=>scan());observer.observe(document.body,{childList:true,subtree:true});client.auth.onAuthStateChange(async(_,session)=>{const ok=!!session?.user?.email&&ADMINS.has(session.user.email.trim().toLowerCase());if(!ok){running=false;observer?.disconnect();observer=null;return;}await load();scan()})}
function boot(){setTimeout(start,500);setTimeout(start,1800);setTimeout(start,3500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();