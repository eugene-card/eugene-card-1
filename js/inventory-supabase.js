/* Supabase-backed cards adapter + strictly Inventory-scoped admin tools. */
(function(){'use strict';
const FIELD_MAP={imgUrl:'img_url',imageUrl:'image_url',image:'image_url',baseFloorPrice:'base_floor_price',createdAt:'created_at',updatedAt:'updated_at'};
const CARD_COLUMNS=new Set(['id','serial','name','type','price','base_floor_price','owner','status','img_url','edition','sn','tier','printing','created_at','updated_at','description','image_url','asset_value','metadata']);
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
 const selectors=['#inventory','#inventorySection','[data-section="inventory"]','[data-tab-content="inventory"]','[data-page="inventory"]','.inventory-section','.inventory-view','.inventory'];
 for(const s of selectors){for(const e of document.querySelectorAll(s)){if(isVisible(e)&&!e.closest('header,nav'))return e}}
 const heading=[...document.querySelectorAll('h1,h2,h3,h4')].find(e=>isVisible(e)&&/^inventory( manager)?$/i.test((e.textContent||'').trim())&&!e.closest('header,nav'));
 return heading?.closest('section,main,[role="tabpanel"],.tab-content,.page-content,.view')||heading?.parentElement||null;
}
function ensureScope(c){if(!adminVerified||!isInventoryTabActive()){removeTools();return false}const host=findInventoryHost();const box=document.getElementById('ecInventoryTools');if(box&&host&&!host.contains(box)){box.remove();return false}if(!box&&host)injectTools(c);return !!host}
function watchScope(c){clearTimeout(toolsTimer);toolsTimer=setTimeout(()=>ensureScope(c),80)}
function makeCollection(c){return makeQuery(c,[],null,null)}
function makeQuery(c,filters,ordering,limitN){const api={where(f,o,v){return makeQuery(c,filters.concat([{f,o,v}]),ordering,limitN)},orderBy(f,d){return makeQuery(c,filters,{f,d:d||'asc'},limitN)},limit(n){return makeQuery(c,filters,ordering,Number(n))},doc(id){return makeDoc(c,id||newId())},async add(p){const r=normalize(p),x=await c.from('cards').insert(r);if(x.error)throw x.error;return makeDoc(c,r.id)},async get(){let q=c.from('cards').select('*');filters.forEach(f=>{if(f.o==='==')q=q.eq(f.f,f.v);else if(f.o==='!=')q=q.neq(f.f,f.v);else if(f.o==='>')q=q.gt(f.f,f.v);else if(f.o==='>=')q=q.gte(f.f,f.v);else if(f.o==='<')q=q.lt(f.f,f.v);else if(f.o==='<=' )q=q.lte(f.f,f.v)});if(ordering)q=q.order(ordering.f,{ascending:ordering.d!=='desc'});if(limitN)q=q.limit(limitN);const x=await q;if(x.error)throw x.error;const docs=(x.data||[]).map(snapshot);return{docs,empty:!docs.length,size:docs.length,forEach:fn=>docs.forEach(fn)}},onSnapshot(cb){api.get().then(cb).catch(console.error);const ch=c.channel('inventory-cards-'+newId()).on('postgres_changes',{event:'*',schema:'public',table:'cards'},()=>api.get().then(cb).catch(console.error)).subscribe();return()=>c.removeChannel(ch)}};return api}
function makeDoc(c,id){return{id,async get(){const x=await c.from('cards').select('*').eq('id',id).maybeSingle();if(x.error)throw x.error;return x.data?snapshot(x.data):{id,exists:false,data:()=>undefined}},async set(p,o){let r=normalize(p,id);if(o?.merge){const cur=await this.get();if(cur.exists)r={...normalize(cur.data(),id),...r,id:String(id)}}const x=await c.from('cards').upsert(r,{onConflict:'id'});if(x.error)throw x.error},async update(p){const r=normalize(p,id);delete r.id;const x=await c.from('cards').update(r).eq('id',id);if(x.error)throw x.error},async delete(){const x=await c.from('cards').delete().eq('id',id);if(x.error)throw x.error},onSnapshot(cb){this.get().then(cb).catch(console.error);const ch=c.channel('inventory-card-'+id+'-'+newId()).on('postgres_changes',{event:'*',schema:'public',table:'cards',filter:'id=eq.'+id},()=>this.get().then(cb).catch(console.error)).subscribe();return()=>c.removeChannel(ch)}}}
function snapshot(r){const d={...r,imgUrl:r.img_url||r.image_url||'',imageUrl:r.image_url||r.img_url||'',image:r.image_url||r.img_url||'',baseFloorPrice:r.base_floor_price};return{id:r.id,exists:true,data:()=>d,ref:makeDoc(window.supabaseClient,r.id)}}
function injectTools(c){if(!adminVerified||!isInventoryTabActive())return removeTools();if(document.getElementById('ecInventoryTools'))return;const host=findInventoryHost();if(!host)return;const box=document.createElement('section');box.id='ecInventoryTools';box.setAttribute('aria-label','Inventory Tools');box.innerHTML='<div class="ecit-title"><span>Inventory Tools</span><em id="ecitStatus">Administrator only • Ready</em></div><div class="ecit-row"><button data-a="backup">⬇ Backup JSON</button><button data-a="csv">⬇ Export CSV</button><button data-a="import">⬆ Import / Restore</button></div><div class="ecit-row ecit-danger"><button data-a="owners">↻ Reset Owners & Availability</button><button data-a="all">⟳ Reset All Cards → 0</button></div><input id="ecitFile" type="file" accept=".json,.csv,application/json,text/csv" hidden>';
if(!document.getElementById('ecInventoryToolsStyle')){const st=document.createElement('style');st.id='ecInventoryToolsStyle';st.textContent='#ecInventoryTools{display:block;width:100%;box-sizing:border-box;margin:16px 0;padding:16px;border:2px solid #6366f1;border-radius:16px;background:#0f172a;color:#f8fafc;position:relative;z-index:50;box-shadow:0 8px 30px rgba(0,0,0,.35)}#ecInventoryTools .ecit-title{display:flex;justify-content:space-between;align-items:center;font-size:18px;font-weight:800;margin-bottom:12px}#ecInventoryTools .ecit-title em{font-style:normal;font-size:11px;font-weight:500;opacity:.7}#ecInventoryTools .ecit-row{display:flex;flex-wrap:wrap;gap:9px;margin:8px 0}#ecInventoryTools button{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:10px 14px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#fff;font:inherit;font-weight:700;cursor:pointer}#ecInventoryTools .ecit-danger button{border-color:#ef4444;background:#451a1a}';document.head.appendChild(st)}
host.prepend(box);
const status=t=>{const e=box.querySelector('#ecitStatus');if(e)e.textContent=t};const dl=(n,t,type)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type}));a.download=n;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};const guard=()=>adminVerified&&isInventoryTabActive()&&host.contains(box)?true:(removeTools(),false);async function rows(){if(!guard())throw Error('Administrator access required.');let out=[],from=0;while(1){const x=await c.from('cards').select('*').range(from,from+999);if(x.error)throw x.error;out=out.concat(x.data||[]);if(!x.data||x.data.length<1000)break;from+=1000}return out}
box.addEventListener('click',async e=>{const b=e.target.closest('[data-a]');if(!b||!guard())return;try{const a=b.dataset.a;if(a==='backup'){status('Backing up…');const r=await rows();dl('eugene-card-inventory-backup.json',JSON.stringify({schema_version:3,exported_at:new Date().toISOString(),data:r},null,2),'application/json');status(r.length+' cards backed up')}else if(a==='csv'){status('Exporting…');const r=await rows(),h=['id','serial','name','type','price','owner','status','image_url','img_url'];const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';dl('eugene-card-inventory.csv',h.join(',')+'\n'+r.map(x=>h.map(k=>q(x[k])).join(',')).join('\n'),'text/csv')}else if(a==='import'){const f=box.querySelector('#ecitFile');f.onchange=async()=>{if(!guard())return;try{const file=f.files?.[0];if(!file)return;const text=await file.text();let data;if(/\.csv$/i.test(file.name)){const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean),parse=s=>{const out=[];let cur='',q=false;for(let i=0;i<s.length;i++){const ch=s[i];if(ch==='"'&&s[i+1]==='"'){cur+='"';i++}else if(ch==='"')q=!q;else if(ch===','&&!q){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out};const h=parse(lines[0]);data=lines.slice(1).map(line=>{const v=parse(line),r={};h.forEach((k,i)=>r[k]=v[i]??'');return normalize(r)})}else{const p=JSON.parse(text);data=(Array.isArray(p)?p:(p?.data||p?.cards||[])).map(normalize)}if(!data.length)throw Error('No records found');if(!confirm('Import '+data.length+' records using Merge / Update?'))return;for(let i=0;i<data.length;i+=250){const x=await c.from('cards').upsert(data.slice(i,i+250),{onConflict:'id'});if(x.error)throw x.error}status('Imported '+data.length+' cards');setTimeout(()=>location.reload(),700)}catch(err){status('Import failed: '+(err.message||err))}f.value=''};f.click()}else if(a==='owners'){if(!confirm('Reset ALL owners and availability? Cards and images stay intact.'))return;status('Resetting owners…');const x=await c.from('cards').update({owner:null,status:'AVAILABLE'}).neq('id','__never_match__');if(x.error)throw x.error;status('Owners cleared; all AVAILABLE');setTimeout(()=>location.reload(),700)}else if(a==='all'){if(!confirm('RESET ALL CARDS TO 0? This permanently deletes the entire catalog. Backup first.'))return;if(!confirm('FINAL CONFIRMATION: permanently delete every card?'))return;status('Deleting all cards…');const x=await c.from('cards').delete().neq('id','__never_match__');if(x.error)throw x.error;status('Catalog reset — 0 cards');setTimeout(()=>location.reload(),700)}}catch(err){status('Error: '+(err.message||err))}})}
function boot(){const c=window.supabaseClient;if(!c||!window.db||typeof window.db.collection!=='function')return setTimeout(boot,100);const legacy=window.db.collection.bind(window.db),nativeCards=makeCollection(c);window.db.collection=n=>String(n)==='cards'?nativeCards:legacy(n);window.__inventoryStorage='supabase';verifyAdmin(c).then(()=>ensureScope(c));c.auth.onAuthStateChange((_event,session)=>{adminVerified=!!session?.user?.email&&ADMIN_EMAILS.has(session.user.email.toLowerCase());ensureScope(c)});const mo=new MutationObserver(()=>watchScope(c));mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','aria-selected','data-active']});document.addEventListener('click',()=>watchScope(c),true);window.addEventListener('popstate',()=>watchScope(c));setInterval(()=>ensureScope(c),1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

/* Social interaction loader: app.js contains the delegated Like / Comment / Repost repair. */
(function(){
  function load(){
    if(window.__eugeneSocialLoader)return;
    window.__eugeneSocialLoader=true;
    const s=document.createElement('script');
    s.src='./js/app.js?v=20260830-social2';
    s.async=false;
    s.onload=()=>console.info('[Eugene Card] social interaction repair loaded');
    s.onerror=()=>console.error('[Eugene Card] social interaction repair failed to load');
    document.head.appendChild(s);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load,{once:true}); else load();
})();

/* Mobile modal stacking fix. This file is loaded after app.js, so inject a final CSS layer at runtime. */
(function(){
  function install(){
    if(document.getElementById('eugene-mobile-modal-stack-v2')) return;
    const style=document.createElement('style');
    style.id='eugene-mobile-modal-stack-v2';
    style.textContent=`
@media (max-width:768px){
  header.sticky{z-index:1000!important}
  header nav{z-index:1000!important}
  .mobile-nav{z-index:1000!important}
  #profile-manager-modal,#complete-profile-modal,#admin-edit-collector-modal,#generic-confirm-modal,#auction-winner-modal,#auth-modal,#card-detail-modal,#image-preview-modal,#onboarding-modal,#loading-modal,#chat-drawer-overlay,#cart-drawer-overlay{z-index:20000!important}
  #cart-drawer{z-index:20001!important;top:0!important;bottom:0!important;height:100dvh!important;max-height:100dvh!important;padding-top:max(16px,env(safe-area-inset-top))!important;padding-bottom:max(16px,env(safe-area-inset-bottom))!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch}
  #profile-manager-modal{z-index:20000!important;padding-top:max(10px,env(safe-area-inset-top))!important;padding-bottom:max(10px,env(safe-area-inset-bottom))!important}
  #profile-manager-modal .profile-manager-modal-panel{max-height:calc(100dvh - max(20px,env(safe-area-inset-top)) - max(20px,env(safe-area-inset-bottom)))!important}
  #profile-manager-modal .profile-manager-modal-panel>button:first-child,#cart-drawer>div:first-child button,#complete-profile-modal>div:first-child>button,#admin-edit-collector-modal>div:first-child>button{z-index:50!important;touch-action:manipulation!important}
  #profile-manager-modal,#cart-drawer-overlay,#cart-drawer{overscroll-behavior:contain!important}
}
`;
    document.head.appendChild(style);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();