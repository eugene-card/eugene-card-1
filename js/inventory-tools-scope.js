/* Keeps the single admin Inventory Tools panel inside the Inventory tab only. */
(function(){'use strict';
const ADMINS=new Set(['eugene.aquila06@gmail.com','eugenecard.market@gmail.com']);
const sb=()=>window.supabaseClient;
let isAdmin=null;      // cached result — null means "not resolved yet"
let checking=null;     // in-flight admin lookup, so concurrent triggers share one request
let scheduled=false;   // rAF debounce flag

function visible(e){if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return !!(r.width||r.height)&&s.display!=='none'&&s.visibility!=='hidden'}
function inventoryHost(){
  const selectors=['#inventory','#inventorySection','[data-section="inventory"]','[data-page="inventory"]','.inventory-section','.inventory'];
  for(const sel of selectors){const e=document.querySelector(sel);if(e&&visible(e))return e}
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,[role="heading"]')];
  const h=headings.find(e=>visible(e)&&/^inventory(?: manager)?$/i.test((e.textContent||'').trim()));
  return h?.closest('section,main,article,.tab-content,.page,.panel')||h?.parentElement||null;
}
function activeInventory(){const host=inventoryHost();if(!host)return null;return visible(host)?host:null}

/* Resolve admin status ONCE (network call), then cache it. Re-checked only
 * on explicit login/logout — never on every DOM mutation or timer tick.
 * This is the fix for the crash: the old code called auth.getUser() from
 * inside enforce(), which ran on every mutation AND every 1s interval AND
 * re-triggered itself via the DOM writes it made, flooding Supabase Auth
 * with concurrent requests that timed out and crashed the page. */
async function resolveAdmin(){
  if(checking)return checking;
  checking=(async()=>{
    try{
      const client=sb();
      if(!client?.auth)return false;
      const r=await client.auth.getUser(),u=r?.data?.user;
      return !!u?.email&&ADMINS.has(u.email.toLowerCase());
    }catch(_){return false}
    finally{checking=null}
  })();
  return checking;
}
async function ensureAdminKnown(){
  if(isAdmin===null)isAdmin=await resolveAdmin();
  return isAdmin;
}

function enforceSync(){
  const tool=document.getElementById('ecInventoryTools');
  if(!tool)return;
  if(!isAdmin){tool.remove();return}
  const host=activeInventory();
  if(!host){
    // Idempotent writes: only touch the DOM if something actually changes,
    // so this function doesn't keep re-triggering its own MutationObserver.
    if(tool.style.display!=='none'){tool.style.display='none';tool.setAttribute('aria-hidden','true')}
    return;
  }
  if(tool.parentElement!==host)host.prepend(tool);
  if(tool.style.display!=='block'){tool.style.display='block';tool.removeAttribute('aria-hidden')}
}

async function enforce(){
  await ensureAdminKnown();
  enforceSync();
}

/* Coalesce bursts of triggers (mutation storms, timers, clicks elsewhere)
 * into a single enforce() call per animation frame instead of one call
 * per event. This is what stops the request flood under DOM churn. */
function scheduleEnforce(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;enforce()});
}

function boot(){
  setTimeout(scheduleEnforce,200);
  setTimeout(scheduleEnforce,800);
  setTimeout(scheduleEnforce,1800);
  // Safety-net poll only. Cheap now — admin status is cached, so this no
  // longer makes a network call every second.
  setInterval(scheduleEnforce,5000);
  new MutationObserver(scheduleEnforce).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-current']});
  const client=sb();
  client?.auth?.onAuthStateChange((_event,session)=>{
    const email=session?.user?.email;
    isAdmin=!!email&&ADMINS.has(email.trim().toLowerCase());
    scheduleEnforce();
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
