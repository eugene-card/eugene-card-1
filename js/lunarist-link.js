/* Eugene Card ↔ Lunarist connection controls. */
(function () {
  'use strict';
  const BASE = 'https://lunaristudio.vercel.app';
  const ROOT = 'ec-lunarist-settings-fallback';
  const clean = v => String(v || '').trim().replace(/^@+/, '').replace(/^\/+|\/+$/g, '');
  const profileUrl = v => { const u = clean(v); return u ? BASE + '/' + encodeURIComponent(u) : BASE; };

  function style() {
    if (document.getElementById('ec-lunarist-fallback-style')) return;
    const s = document.createElement('style'); s.id = 'ec-lunarist-fallback-style';
    s.textContent = `#${ROOT}{margin-top:14px;padding:15px;border:1px solid rgba(139,92,246,.3);border-radius:15px;background:linear-gradient(135deg,rgba(30,27,75,.72),rgba(15,23,42,.9));color:#e5e7eb}#${ROOT} .ec-lh{display:flex;justify-content:space-between;align-items:center;gap:10px}#${ROOT} .ec-ltitle{font-size:13px;font-weight:800}#${ROOT} .ec-lstatus{font-size:11px;font-weight:800;color:#94a3b8}#${ROOT} .ec-lstatus.ok{color:#86efac}#${ROOT} .ec-lcopy{margin:6px 0 12px;font-size:11px;color:#94a3b8;line-height:1.5}#${ROOT} .ec-lrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#${ROOT} .ec-luser{margin-right:auto;color:#c4b5fd;font-size:11px;font-weight:800}#${ROOT} button{border:1px solid rgba(139,92,246,.4);border-radius:9px;padding:9px 12px;background:rgba(124,58,237,.16);color:#f5f3ff;font-size:11px;font-weight:800;cursor:pointer}#${ROOT} button.secondary{background:rgba(15,23,42,.75);border-color:#334155;color:#cbd5e1}`;
    document.head.appendChild(s);
  }
  function host() {
    const selectors = ['#accountPanel','#profileSettings','#collectorProfileSettings','#profile-settings','.profile-settings','.profile-settings-panel','.account-panel','[data-account-panel]'];
    for (const q of selectors) { const el = document.querySelector(q); if (el) return el; }
    const nodes = [...document.querySelectorAll('h1,h2,h3,h4,h5,button,div,section,dialog')];
    const heading = nodes.find(el => /collector\s+profile\s+settings/i.test((el.textContent || '').trim()));
    return heading ? (heading.closest('dialog,section') || heading.parentElement) : null;
  }
  async function authUser() {
    try { if (window.EugeneCardAuth?.user) return window.EugeneCardAuth.user; const r = await window.supabaseClient?.auth?.getUser?.(); return r?.data?.user || null; } catch (_) { return null; }
  }
  async function link(user) {
    try { const r = await window.supabaseClient.from('lunarist_links').select('lunarist_username,lunarist_profile_url').eq('eugene_user_id',user.id).maybeSingle(); return r.data || null; } catch (_) { return null; }
  }
  function modal(user, current, refresh) {
    const back = document.createElement('div'); back.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(2,6,23,.78);display:flex;align-items:center;justify-content:center;padding:18px';
    const box = document.createElement('div'); box.style.cssText='width:min(420px,100%);padding:20px;border-radius:18px;background:#0f172a;border:1px solid rgba(139,92,246,.4);box-shadow:0 30px 80px rgba(0,0,0,.55)';
    box.innerHTML='<h3 style="margin:0 0 8px;color:#f8fafc">Connect to Lunarist</h3><p style="margin:0 0 14px;color:#94a3b8;font-size:12px;line-height:1.5">Enter your Lunarist username to connect it to this Eugene Card profile.</p><input id="ec-lunarist-name" style="width:100%;box-sizing:border-box;padding:11px;border-radius:10px;background:#020617;color:#fff;border:1px solid #334155" placeholder="@username"><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button data-cancel class="secondary">Cancel</button><button data-save>Connect</button></div>';
    const input = box.querySelector('#ec-lunarist-name'); input.value = current ? '@' + clean(current) : '';
    box.querySelector('[data-cancel]').onclick=()=>back.remove();
    box.querySelector('[data-save]').onclick=async()=>{ const name=clean(input.value); if(!name){alert('Enter a Lunarist username.');return;} const b=box.querySelector('[data-save']); b.disabled=true;b.textContent='Connecting…'; try { const payload={eugene_user_id:user.id,lunarist_username:name,lunarist_profile_url:profileUrl(name),sync_source:'lunarist',last_synced_at:new Date().toISOString()}; const r=await window.supabaseClient.from('lunarist_links').upsert(payload,{onConflict:'eugene_user_id'}); if(r.error)throw r.error; back.remove(); await refresh(); } catch(e){b.disabled=false;b.textContent='Connect';alert(e?.message||'Unable to connect Lunarist.');} };
    back.appendChild(box); document.body.appendChild(back); input.focus();
  }
  async function mount() {
    style();
    const a = window.EugeneCardAuth, h = host(); if (!a || !h || !a.user || !window.supabaseClient) return false;
    let root = document.getElementById(ROOT); if (root && root.parentElement !== h) { root.remove(); root=null; }
    if (!root) { root=document.createElement('section'); root.id=ROOT; h.appendChild(root); }
    const l = await link(a.user); const connected=!!clean(l?.lunarist_username); root.innerHTML='';
    const head=document.createElement('div');head.className='ec-lh'; const title=document.createElement('div');title.className='ec-ltitle';title.textContent='Lunarist'; const status=document.createElement('div');status.className='ec-lstatus '+(connected?'ok':'');status.textContent=connected?'Connected':'Not connected';head.append(title,status);
    const copy=document.createElement('div');copy.className='ec-lcopy';copy.textContent=connected?'Your Eugene Card profile is connected to Lunarist.':'Connect your Lunarist profile to this Eugene Card account.';
    const row=document.createElement('div');row.className='ec-lrow';
    if(connected){const who=document.createElement('span');who.className='ec-luser';who.textContent='@'+clean(l.lunarist_username);const open=document.createElement('button');open.textContent='Open Lunarist';open.onclick=()=>window.open(profileUrl(l.lunarist_username),'_blank','noopener');const dis=document.createElement('button');dis.className='secondary';dis.textContent='Disconnect';dis.onclick=async()=>{if(!confirm('Disconnect Lunarist from this profile?'))return;const r=await window.supabaseClient.from('lunarist_links').delete().eq('eugene_user_id',a.user.id);if(r.error)alert(r.error.message);else mount();};row.append(who,open,dis);}else{const btn=document.createElement('button');btn.textContent='Connect Lunarist';btn.onclick=()=>modal(a.user,'',mount);row.append(btn);}
    root.append(head,copy,row); return true;
  }
  function boot(){let ticks=0;const run=()=>{mount();if(++ticks>120)clearInterval(timer)};const timer=setInterval(run,500);run();new MutationObserver(()=>mount()).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.LunaristLink={profileUrl,baseUrl:BASE};
})();
