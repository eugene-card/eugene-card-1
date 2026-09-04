/* Supabase-backed cards adapter + strictly Inventory-scoped admin tools. */
(function(){'use strict';
const FIELD_MAP={imgUrl:'img_url',imageUrl:'image_url',image:'image_url',baseFloorPrice:'base_floor_price',createdAt:'created_at',updatedAt:'updated_at'};
const CARD_COLUMNS=new Set(['id','serial','name','type','price','base_floor_price','owner','status','img_url','edition','additional_editions','sn','tier','printing','created_at','updated_at','description','image_url','asset_value','metadata']);
const ADMIN_EMAILS=new Set(['eugene.aquila06@gmail.com','eugenecard.market@gmail.com']);let adminVerified=false,toolsTimer=null;
const newId=()=>crypto&&crypto.randomUUID?crypto.randomUUID():'card-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
function normalize(p,id){const s=p||{},r={};Object.keys(s).forEach(k=>{const d=FIELD_MAP[k]||k;if(CARD_COLUMNS.has(d))r[d]=s[k]});const image=r.image_url||r.img_url||s.imageUrl||s.imgUrl||s.image||'';r.image_url=image;r.img_url=image;if(id!=null)r.id=String(id);if(!r.id)r.id=newId();return r}
async function verifyAdmin(c){try{const{data:{user}}=await c.auth.getUser();adminVerified=!!user?.email&&ADMIN_EMAILS.has(user.email.toLowerCase());return adminVerified}catch(_){adminVerified=false;return false}}
function isVisible(e){if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return !!(r.width||r.height)&&s.display!=='none'&&s.visibility!=='hidden'}
function removeTools(){document.querySelectorAll('#ecInventoryTools,#inventoryBackupImport').forEach(e=>e.remove())}
function isInventoryTabActive(){
 const active=[...document.querySelectorAll('.active,[aria-selected="true"],[data-active="true"],.tab-active')].filter(isVisible);
 if(active.some(e=>/inventory/i.test((e.textContent||'').trim())))return true;
 const visibleSections=[...document.querySelectorAll('section,main,[role="tabpanel"],.tab-content,.page-content,.view')].filter(isVisible);
 const inv=visibleSections.find(e=>/inventory/i.test((e.id||'')+' '+(e.getAttribute('data-section')||'')+' '+(e.getAttribute('data-tab')||''));
 if(inv)return true;
 const heading=[...document.querySelectorAll('h1,h2,h3,h4')].find(e=>isVisible(e)&&/^inventory( manager)?$/i.test((e.textContent||'').trim()));
 return !!heading;
}
function findInventoryHost(){
 const byId=document.getElementById('view-inventory');
 if(byId)return byId;
 const section=[...document.querySelectorAll('section,main,[role="tabpanel"],.tab-content,.page-content,.view')].find(e=>isVisible(e)&&/inventory/i.test((e.id||'')+' '+(e.getAttribute('data-section')||'')+' '+(e.getAttribute('data-tab')||'')));
 return section||null;
}
function ensureInventoryTools(){
 if(!isInventoryTabActive())return;
 const host=findInventoryHost();
 if(!host||document.getElementById('ecInventoryTools'))return;
 const wrap=document.createElement('div');wrap.id='ecInventoryTools';wrap.className='mt-3 flex flex-wrap items-center gap-2';
 wrap.innerHTML='<span class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Supabase inventory</span>';
 host.appendChild(wrap);
}
function wire(){
 ensureInventoryTools();
 if(!toolsTimer)toolsTimer=setInterval(ensureInventoryTools,1000);
}
window.EugeneInventorySupabase={normalize,verifyAdmin,wire};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
})();
