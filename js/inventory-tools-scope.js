/* Keeps the single admin Inventory Tools panel inside the Inventory tab only. */
(function(){'use strict';
const ADMINS=new Set(['eugene.aquila06@gmail.com','eugenecard.market@gmail.com']);
const sb=()=>window.supabaseClient;
function visible(e){if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return !!(r.width||r.height)&&s.display!=='none'&&s.visibility!=='hidden'}
function inventoryHost(){
  const selectors=['#inventory','#inventorySection','[data-section="inventory"]','[data-page="inventory"]','.inventory-section','.inventory'];
  for(const sel of selectors){const e=document.querySelector(sel);if(e&&visible(e))return e}
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,[role="heading"]')];
  const h=headings.find(e=>visible(e)&&/^inventory(?: manager)?$/i.test((e.textContent||'').trim()));
  return h?.closest('section,main,article,.tab-content,.page,.panel')||h?.parentElement||null;
}
function activeInventory(){const host=inventoryHost();if(!host)return null;return visible(host)?host:null}
async function admin(){try{const r=await sb().auth.getUser(),u=r?.data?.user;return !!u?.email&&ADMINS.has(u.email.toLowerCase())}catch(_){return false}}
async function enforce(){
  const tool=document.getElementById('ecInventoryTools');
  if(!tool)return;
  if(!(await admin())){tool.remove();return}
  const host=activeInventory();
  if(!host){tool.style.display='none';tool.setAttribute('aria-hidden','true');return}
  if(tool.parentElement!==host)host.prepend(tool);
  tool.style.display='block';tool.removeAttribute('aria-hidden');
}
function boot(){setTimeout(enforce,200);setTimeout(enforce,800);setTimeout(enforce,1800);setInterval(enforce,1000);new MutationObserver(()=>enforce()).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-current']})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();