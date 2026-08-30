/* Admin Inventory owner dropdowns backed by Supabase Auth users via secure RPC/Edge Function when available. */
(function(){'use strict';
const ADMINS=new Set(['eugene.aquila06@gmail.com','eugenecard.market@gmail.com']);let users=[],observer=null,running=false;
const sb=()=>window.supabaseClient;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function admin(){try{const r=await sb().auth.getUser(),u=r?.data?.user;return !!u?.email&&ADMINS.has(u.email.trim().toLowerCase())}catch(_){return false}}
async function load(){if(!sb())return false;users=[];
  try{const r=await sb().rpc('admin_list_users');if(!r.error&&Array.isArray(r.data)){users=r.data.filter(u=>u.id).map(u=>({id:String(u.id),email:u.email||'',username:u.username||u.user_metadata?.username||'',display_name:u.display_name||u.user_metadata?.display_name||u.user_metadata?.full_name||u.email||u.id}));return true}}catch(_){ }
  for(const source of ['admin_users','admin_user_list']){try{const r=await sb().from(source).select('id,email,username,display_name').order('display_name',{ascending:true});if(!r.error){users=(r.data||[]).filter(u=>u.id);return true}}catch(_){}}
  console.warn('Owner users: no secure Auth-user listing is configured.');return false}
function field(e){if(!(e instanceof HTMLInputElement||e instanceof HTMLSelectElement))return false;const n=(e.name||'').toLowerCase(),a=(e.getAttribute('data-field')||e.getAttribute('aria-label')||'').toLowerCase();return n==='owner'||n==='holder'||n==='card-owner'||a==='owner'||a.includes('card owner')||a.includes('holder')}
function decorate(input){
  if(input.dataset.inventoryOwnerUsers==='1'||!field(input))return;
  const cur=String(input.value||'');
  const wrap=document.createElement('div');
  wrap.className='inventory-owner-editor space-y-2';
  const s=document.createElement('select');
  s.name='owner_picker';
  s.className=input.className||'select';
  s.dataset.inventoryOwnerUsers='1';
  s.setAttribute('aria-label','Select card owner');
  let match=null;
  let html='<option value="">Select registered owner…</option>';
  users.forEach(u=>{
    const vals=[u.id,u.email,u.username,u.display_name].filter(Boolean).map(String);
    const same=vals.some(x=>x.toLowerCase()===cur.toLowerCase());
    if(same)match=String(u.id);
    const label=u.display_name||u.username||u.email||u.id;
    const extra=u.email&&label!==u.email?' — '+u.email:(u.username&&label!==u.username?' (@'+u.username+')':'');
    html+='<option value="'+esc(u.id)+'">'+esc(label)+esc(extra)+'</option>';
  });
  s.innerHTML=html;
  s.value=match||'';

  const manual=document.createElement('input');
  manual.type='text';
  manual.name=input.name||'owner';
  manual.value=cur;
  manual.className=input.className||'';
  manual.setAttribute('aria-label','Manual owner username');
  manual.placeholder='Or enter username manually';
  manual.autocomplete='off';
  manual.dataset.inventoryOwnerUsers='1';

  const hint=document.createElement('div');
  hint.className='text-[11px] text-slate-400';
  hint.textContent='Choose a registered owner above, or enter a username manually.';

  s.addEventListener('change',()=>{if(s.value)manual.value=s.value;});
  wrap.append(s,manual,hint);
  input.replaceWith(wrap);
}
function scan(){if(running)document.querySelectorAll('input,select').forEach(decorate)}
function strip(){document.querySelectorAll('.inventory-owner-editor').forEach(w=>{const i=w.querySelector('input[name="owner"],input[name="holder"],input[name="card-owner"]')||w.querySelector('input');if(i)w.replaceWith(i)})}
async function start(){if(!sb()||running||!(await admin()))return;running=true;await load();scan();observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true});sb().auth.onAuthStateChange(async(_,session)=>{const ok=!!session?.user?.email&&ADMINS.has(session.user.email.trim().toLowerCase());if(!ok){running=false;observer?.disconnect();observer=null;strip()}else{await load();scan()}})}
function boot(){setTimeout(start,400);setTimeout(start,1500);setTimeout(start,3000)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();