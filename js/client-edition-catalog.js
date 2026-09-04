/* Eugene Card — card-linked Client Edition + Beta trade privilege + Catalog default */
(function(){
'use strict';
const CLIENT_KEY='client_edition', BENEFIT_KEY='free_trade_tax', DEFAULT_CATALOG_ID='view-catalog';
let wrapped=false, tradeCollectionWrapped=false;
const normalize=v=>String(v||'').trim().replace(/\s+/g,' ');
function isBetaEdition(card){return /\bbeta\s+edition\b/i.test(normalize(card?.edition));}
function hasClientEdition(card){
  const a=Array.isArray(card?.additional_editions)?card.additional_editions:[];
  const m=card?.metadata&&typeof card.metadata==='object'?card.metadata:{};
  return a.some(v=>normalize(v).toLowerCase()==='client edition') || m[CLIENT_KEY]===true || normalize(m[CLIENT_KEY]).toLowerCase()==='client edition';
}
function hasFreeTradeTax(card){return !!card&&(isBetaEdition(card)||hasClientEdition(card));}
function getTradeTaxRate(card){return hasFreeTradeTax(card)?0:0.02;}
function getTradeBenefit(card){
  if(hasClientEdition(card))return{exempt:true,source:'Client Edition',rate:0};
  if(isBetaEdition(card))return{exempt:true,source:'Beta Edition',rate:0};
  return{exempt:false,source:null,rate:0.02};
}
function getTradeTaxForCards(a,b){const x=getTradeBenefit(a),y=getTradeBenefit(b),e=x.exempt||y.exempt;return{rate:e?0:0.02,exempt:e,sources:[x.source,y.source].filter(Boolean)};}
async function saveClientEdition(cardId,enabled){
  const c=window.supabaseClient;if(!c||!cardId)throw new Error('Database is not ready.');
  const {data,error}=await c.rpc('set_card_additional_edition',{p_card_id:String(cardId),p_edition:'Client Edition',p_enabled:!!enabled});
  if(error)throw error;
  const card=Array.isArray(window.inventory)?window.inventory.find(x=>String(x.id)===String(cardId)):null;
  if(card){card.additional_editions=data?.additional_editions||[];card.metadata=data?.metadata||card.metadata||{};}
  return data||card;
}
function injectStyles(){if(document.getElementById('eugene-client-edition-css'))return;const s=document.createElement('style');s.id='eugene-client-edition-css';s.textContent=`#eugene-client-edition-field{grid-column:1/-1}#eugene-client-edition-field .ce-help{font-size:9px;color:#64748b;margin-top:5px;line-height:1.35}#eugene-client-edition-field select{width:100%}.eugene-edition-badge,.eugene-beta-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:900}.eugene-edition-badge{border:1px solid rgba(236,72,153,.3);background:rgba(236,72,153,.08);color:#f9a8d4}.eugene-beta-badge{border:1px solid rgba(245,158,11,.3);background:rgba(245,158,11,.08);color:#fbbf24}`;document.head.appendChild(s);}
function ensureClientField(){const edition=document.getElementById('edit-card-edition');if(!edition||document.getElementById('eugene-client-edition-field'))return;const host=edition.closest('div');const field=document.createElement('div');field.id='eugene-client-edition-field';field.innerHTML=`<label class="block font-bold text-slate-400 mb-1">Additional Edition</label><select id="edit-card-client-edition" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"><option value="">No Client Edition</option><option value="Client Edition">Client Edition</option></select><p class="ce-help">Client Edition is permanently attached to this card. Ownership changes do not remove it, and the current holder keeps the 0% direct-trade-tax benefit.</p>`;if(host?.parentElement)host.parentElement.appendChild(field);}
function fillClientField(card){ensureClientField();const f=document.getElementById('edit-card-client-edition');if(f)f.value=hasClientEdition(card)?'Client Edition':'';}
function wrapInventoryModal(){if(wrapped||typeof window.openInventoryModal!=='function'||typeof window.saveInventoryCardChanges!=='function')return;wrapped=true;const oo=window.openInventoryModal,os=window.saveInventoryCardChanges;window.openInventoryModal=function(id){const r=oo.apply(this,arguments);setTimeout(()=>{const card=Array.isArray(window.inventory)?window.inventory.find(c=>String(c.id)===String(id)):null;ensureClientField();fillClientField(card);},0);return r;};window.saveInventoryCardChanges=async function(){const id=document.getElementById('edit-card-id')?.value;const enabled=document.getElementById('edit-card-client-edition')?.value==='Client Edition';const r=await os.apply(this,arguments);if(id)await saveClientEdition(id,enabled);return r;};}
function wrapTradeRequests(){if(tradeCollectionWrapped||!window.db||typeof window.db.collection!=='function')return;tradeCollectionWrapped=true;const original=window.db.collection.bind(window.db);window.db.collection=function(name){const col=original(name);if(String(name)!=='tradeRequests'||!col||typeof col.doc!=='function')return col;return new Proxy(col,{get(t,p){if(p!=='doc')return t[p];return function(id){const doc=t.doc(id);if(!doc||typeof doc.set!=='function')return doc;const set=doc.set.bind(doc);doc.set=async function(payload,options){const d={...(payload||{})};if(String(d.offerType||'').toUpperCase()==='TRADE'&&Array.isArray(window.inventory)){const a=window.inventory.find(c=>String(c.id)===String(d.cardId)),b=window.inventory.find(c=>String(c.id)===String(d.offeredCardId)),benefit=getTradeTaxForCards(a,b);d.tradeTaxRate=benefit.rate;d.tradeTaxAmount=Math.round(Number(d.plusAmount||0)*benefit.rate);d.tradeTaxExempt=benefit.exempt;d.tradeTaxBenefits=benefit.sources;}return set(d,options);};return doc;};}});};}
function showCatalogByDefault(){const catalog=document.getElementById(DEFAULT_CATALOG_ID);if(!catalog)return;if(typeof window.switchTab==='function'){try{window.switchTab('catalog');return;}catch(_){}}const home=document.getElementById('view-home');if(home)home.classList.add('hidden');catalog.classList.remove('hidden');try{if(typeof renderCardGrid==='function')renderCardGrid();}catch(_){} }
function patchTradeUI(){const trade=document.getElementById('view-trade');if(!trade||trade.dataset.eugeneTradeBenefitPatched==='1')return;trade.dataset.eugeneTradeBenefitPatched='1';const p=trade.querySelector('p');if(p&&/2% tax per trade/i.test(p.textContent||''))p.textContent=(p.textContent||'').replace(/2% tax per trade/i,'0% tax on Client Edition / Beta Edition • 2% standard tax');}
window.EugeneCardBenefits={isBetaEdition,hasClientEdition,hasFreeTradeTax,getTradeTaxRate,getTradeBenefit,getTradeTaxForCards,saveClientEdition};
function init(){injectStyles();wrapInventoryModal();wrapTradeRequests();ensureClientField();showCatalogByDefault();patchTradeUI();const o=new MutationObserver(()=>{wrapInventoryModal();wrapTradeRequests();ensureClientField();patchTradeUI();});o.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
