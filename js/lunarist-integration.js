/* Eugene Card ↔ Lunarist account connection UI.
 * This is an account-link feature, not a replacement for the planned server-side SSO exchange.
 * No Lunarist credentials or tokens are stored in the browser.
 */
(function () {
  'use strict';

  var BASE = 'https://lunaristudio.vercel.app';
  var CARD = 'ec-lunarist-connection';
  var STYLE = 'ec-lunarist-connection-css';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>\"']/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]);
    });
  }

  function username(value) {
    return String(value || '').trim().replace(/^@/, '').replace(/^\/+|\/+$/g, '');
  }

  function profileUrl(value) {
    var u = username(value);
    return u ? BASE + '/' + encodeURIComponent(u) : BASE;
  }

  function client() {
    return window.supabaseClient || window.supabase || window.supabaseClientInstance || null;
  }

  async function currentUser() {
    var c = client();
    if (!c || !c.auth || !c.auth.getUser) return null;
    try {
      var result = await c.auth.getUser();
      return result && result.data ? result.data.user : null;
    } catch (_) { return null; }
  }

  async function getLink(userId) {
    var c = client();
    if (!c || !userId) return null;
    try {
      var result = await c.from('lunarist_links')
        .select('lunarist_username,lunarist_profile_url,last_synced_at')
        .eq('eugene_user_id', userId)
        .maybeSingle();
      if (result && !result.error) return result.data || null;
    } catch (_) {}
    return null;
  }

  async function saveLink(user, lunaristUsername) {
    var c = client();
    var u = username(lunaristUsername);
    if (!c || !user || !u) throw new Error('Please sign in and enter a valid Lunarist username.');

    var payload = {
      eugene_user_id: user.id,
      lunarist_username: u,
      lunarist_profile_url: profileUrl(u),
      last_synced_at: new Date().toISOString()
    };

    var result = await c.from('lunarist_links').upsert(payload, { onConflict: 'eugene_user_id' });
    if (result && result.error) throw result.error;

    try {
      await c.from('profiles').update({
        lunarist_username: u,
        lunarist_profile_url: payload.lunarist_profile_url,
        updated_at: new Date().toISOString()
      }).eq('id', user.id);
    } catch (_) {}

    return payload;
  }

  async function removeLink(user) {
    var c = client();
    if (!c || !user) return;
    var result = await c.from('lunarist_links').delete().eq('eugene_user_id', user.id);
    if (result && result.error) throw result.error;
    try {
      await c.from('profiles').update({
        lunarist_username: null,
        lunarist_profile_url: null,
        updated_at: new Date().toISOString()
      }).eq('id', user.id);
    } catch (_) {}
  }

  function css() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = `
      #${CARD}{margin-top:14px;padding:16px;border:1px solid rgba(139,92,246,.30);border-radius:16px;background:linear-gradient(135deg,rgba(30,27,75,.72),rgba(15,23,42,.82));box-shadow:0 12px 30px rgba(0,0,0,.22)}
      #${CARD} .ec-l-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px}
      #${CARD} .ec-l-brand{display:flex;align-items:center;gap:9px;font-weight:800;color:#f5f3ff;font-size:13px}
      #${CARD} .ec-l-dot{width:9px;height:9px;border-radius:999px;background:#64748b;box-shadow:0 0 0 4px rgba(100,116,139,.12)}
      #${CARD} .ec-l-dot.ok{background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.12)}
      #${CARD} .ec-l-status{font-size:11px;font-weight:800;color:#94a3b8}
      #${CARD} .ec-l-status.ok{color:#86efac}
      #${CARD} .ec-l-copy{margin:0 0 12px;color:#94a3b8;font-size:11px;line-height:1.5}
      #${CARD} .ec-l-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      #${CARD} .ec-l-btn{border:1px solid rgba(139,92,246,.38);border-radius:10px;padding:9px 12px;background:rgba(124,58,237,.16);color:#ede9fe;font-size:11px;font-weight:800;cursor:pointer;text-decoration:none}
      #${CARD} .ec-l-btn:hover{background:rgba(124,58,237,.28)}
      #${CARD} .ec-l-btn.secondary{background:rgba(15,23,42,.7);color:#cbd5e1;border-color:#334155}
      #${CARD} .ec-l-user{font-size:11px;color:#c4b5fd;font-weight:700;margin-right:auto}
      #${CARD} .ec-l-modal-backdrop{position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;padding:18px}
      #${CARD} .ec-l-modal{width:min(430px,100%);padding:20px;border-radius:18px;background:#0f172a;border:1px solid rgba(139,92,246,.35);box-shadow:0 30px 80px rgba(0,0,0,.5)}
      #${CARD} .ec-l-modal h3{margin:0 0 7px;color:#f8fafc;font-size:16px}
      #${CARD} .ec-l-modal p{margin:0 0 14px;color:#94a3b8;font-size:12px;line-height:1.5}
      #${CARD} .ec-l-modal input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;background:#020617;color:#f8fafc;border:1px solid #334155;outline:none}
      #${CARD} .ec-l-modal input:focus{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.12)}
      #${CARD} .ec-l-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
      @media(max-width:520px){#${CARD}{padding:14px}}
    `;
    document.head.appendChild(s);
  }

  function button(label, action, secondary) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ec-l-btn' + (secondary ? ' secondary' : '');
    b.textContent = label;
    b.addEventListener('click', action);
    return b;
  }

  function modal(mode, onSubmit) {
    var wrap = document.createElement('div');
    wrap.className = 'ec-l-modal-backdrop';
    var box = document.createElement('div');
    box.className = 'ec-l-modal';
    var title = document.createElement('h3');
    title.textContent = mode === 'connect' ? 'Connect to Lunarist' : 'Lunarist connection';
    var p = document.createElement('p');
    p.textContent = 'Enter your Lunarist username. Eugene Card will save the account link and show its connection status here.';
    var input = document.createElement('input');
    input.type = 'text'; input.placeholder = '@username'; input.autocomplete = 'off';
    var actions = document.createElement('div'); actions.className = 'ec-l-modal-actions';
    var cancel = button('Cancel', function(){ wrap.remove(); }, true);
    var save = button('Connect', async function(){
      save.disabled = true; save.textContent = 'Connecting…';
      try { await onSubmit(input.value); wrap.remove(); await render(); }
      catch (e) { save.disabled = false; save.textContent = 'Connect'; alert(e && e.message ? e.message : 'Unable to connect to Lunarist.'); }
    });
    actions.appendChild(cancel); actions.appendChild(save);
    box.appendChild(title); box.appendChild(p); box.appendChild(input); box.appendChild(actions);
    wrap.appendChild(box); document.body.appendChild(wrap); input.focus();
  }

  async function render() {
    css();
    var panel = document.getElementById('accountPanel');
    if (!panel) return;
    var user = await currentUser();
    if (!user) return;

    var old = document.getElementById(CARD);
    if (old) old.remove();

    var card = document.createElement('section');
    card.id = CARD;
    var link = await getLink(user.id);
    var connected = !!(link && username(link.lunarist_username));

    var title = document.createElement('div'); title.className = 'ec-l-title';
    var brand = document.createElement('div'); brand.className = 'ec-l-brand';
    var dot = document.createElement('span'); dot.className = 'ec-l-dot' + (connected ? ' ok' : '');
    var name = document.createElement('span'); name.textContent = 'Lunarist';
    brand.appendChild(dot); brand.appendChild(name);
    var status = document.createElement('span'); status.className = 'ec-l-status' + (connected ? ' ok' : ''); status.textContent = connected ? 'Connected' : 'Not connected';
    title.appendChild(brand); title.appendChild(status);

    var copy = document.createElement('p'); copy.className = 'ec-l-copy';
    copy.textContent = connected ? 'Your Eugene Card account is linked to Lunarist.' : 'Link your Lunarist account to keep the two profiles connected.';

    var row = document.createElement('div'); row.className = 'ec-l-row';
    if (connected) {
      var who = document.createElement('span'); who.className = 'ec-l-user'; who.textContent = '@' + username(link.lunarist_username);
      row.appendChild(who);
      row.appendChild(button('Open Lunarist', function(){ window.open(profileUrl(link.lunarist_username), '_blank', 'noopener'); }));
      row.appendChild(button('Disconnect', async function(){
        if (!confirm('Disconnect your Eugene Card account from Lunarist?')) return;
        try { await removeLink(user); await render(); } catch (e) { alert(e && e.message ? e.message : 'Unable to disconnect.'); }
      }, true));
    } else {
      row.appendChild(button('Connect Lunarist', function(){
        modal('connect', function(value){ return saveLink(user, value); });
      }));
      row.appendChild(button('Learn more', function(){ window.open(BASE, '_blank', 'noopener'); }, true));
    }

    card.appendChild(title); card.appendChild(copy); card.appendChild(row);
    panel.appendChild(card);
  }

  function init() {
    if (window.__ecLunaristInitialized) return;
    window.__ecLunaristInitialized = true;
    var run = function(){ setTimeout(render, 150); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once:true }); else run();
    document.addEventListener('click', function(e){
      var t = e.target;
      if (t && (t.id === 'profileBtn' || t.closest && t.closest('#profileBtn'))) setTimeout(render, 250);
    });
    var c = client();
    if (c && c.auth && c.auth.onAuthStateChange) c.auth.onAuthStateChange(function(){ setTimeout(render, 200); });
  }

  init();
})();
