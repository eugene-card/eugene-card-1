/* Admin Inventory owner dropdowns backed by Supabase profiles. */
(function(){'use strict';
  const ADMINS=new Set(['eugene.aquila06@gmail.com','eugenecard.market@gmail.com']);
  let profiles=[]; let observer=null; let running=false;
  const sb=()=>window.supabaseClient;
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  async function isAdmin(){try{const {data:{user}}=await sb().auth.getUser();return !!user?.email&&ADMINS.has(user.email.toLowerCase())}catch(_){return false}}
  async function loadProfiles(){if(!sb())return;const {data,error}=await sb().from('profiles').select('id,email,username,display_name').order('display_name',{ascending:true});if(error){console.warn('Inventory owner users:',error.message);return}profiles=(data||[]).filter(p=>p.id&&(p.username||p.display_name||p.email));}
  function label(p){return p.display_name||p.username||p.email||p.id}
  function valueFor(p){return p.username||p.display_name||p.email||p.id}
  function isOwnerField(el){if(!(el instanceof HTMLInputElement||el instanceof HTMLSelectElement))return false;const n=(el.name||'').toLowerCase();const a=(el.getAttribute('data-field')||el.getAttribute('data-name')||el.getAttribute('aria-label')||'').toLowerCase();return n==='owner'||n==='holder'||n==='card-owner'||a==='owner'||a.includes('card owner')||a.includes('holder')}
  function decorate(input){if(input.dataset.inventoryOwnerUsers==='1')return;if(!(input instanceof HTMLInputElement||input instanceof HTMLSelectElement))return;const current=input.value||'';const select=document.createElement('select');select.name=input.name||'owner';select.className=input.className||'select';select.dataset.inventoryOwnerUsers='1';select.dataset.originalOwnerField='1';select.setAttribute('aria-label','Card owner');
    const opts=['<option value="">Unassigned / None</option>'];let matched=false;
    profiles.forEach(p=>{const v=valueFor(p);const matches=[p.id,p.username,p.display_name,p.email].filter(Boolean).some(x=>String(x)===String(current));if(matches)matched=true;opts.push(`<option value="${esc(v)}">${esc(label(p))}${p.username&&label(p)!==p.username?` (@${esc(p.username)})`:''}</option>`)});
    if(current&&!matched)opts.push(`<option value="${esc(current)}">Current: ${esc(current)}</option>`);
    select.innerHTML=opts.join('');select.value=current;
    input.replaceWith(select);
  }
  function scan(){if(!running)return;document.querySelectorAll('input[name="owner"],select[name="owner"],input[data-field="owner"],select[data-field="owner"],input[aria-label*="Owner" i],select[aria-label*="Owner" i]').forEach(decorate)}
  async function start(){if(!sb()||running)return;if(!(await isAdmin()))return;running=true;await loadProfiles();scan();observer=new MutationObserver(()=>scan());observer.observe(document.body,{childList:true,subtree:true});sb().auth.onAuthStateChange(async(_event,session)=>{const ok=!!session?.user?.email&&ADMINS.has(session.user.email.toLowerCase());if(!ok){running=false;observer?.disconnect();observer=null;document.querySelectorAll('[data-inventory-owner-users="1"]').forEach(s=>{const i=document.createElement('input');i.name=s.name||'owner';i.value=s.value||'';i.className=s.className||'';s.replaceWith(i)})}else{await loadProfiles();scan()}})}
  function boot(){setTimeout(start,400);setTimeout(start,1500);setTimeout(start,3000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();