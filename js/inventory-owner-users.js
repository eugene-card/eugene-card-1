/* Stable Inventory owner helper. Keeps the existing owner selector unchanged. */
(function(){'use strict';
const ADMINS=new Set(['eugene.aquila06@gmail.com','eugenecard.market@gmail.com']);
const sb=()=>window.supabaseClient;
function isOwnerField(e){if(!(e instanceof HTMLSelectElement))return false;const n=String(e.name||'').toLowerCase(),a=String(e.getAttribute('aria-label')||'').toLowerCase();return n==='owner'||n==='holder'||n==='card-owner'||a==='owner'||a.includes('card owner')||a.includes('holder')}
function addManual(e){if(!isOwnerField(e)||e.dataset.manualOwnerAdded==='1')return;e.dataset.manualOwnerAdded='1';const box=document.createElement('div');box.className='mt-2';const label=document.createElement('label');label.className='block text-xs text-slate-400 mb-1';label.textContent='Manual username';const input=document.createElement('input');input.type='text';input.name='manual_owner_username';input.className=e.className||'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2';input.placeholder='Enter username manually';input.autocomplete='off';input.dataset.manualOwnerUsername='1';box.append(label,input);e.insertAdjacentElement('afterend',box)}
function scan(){try{document.querySelectorAll('select').forEach(addManual)}catch(err){console.warn('Owner manual field disabled',err)}}
function boot(){if(!document.body)return;try{const client=sb();if(!client?.auth)return;client.auth.getUser().then(r=>{const email=r?.data?.user?.email?.toLowerCase();if(ADMINS.has(email))scan()}).catch(()=>{});setTimeout(scan,1000);setTimeout(scan,3000)}catch(_){} }
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
