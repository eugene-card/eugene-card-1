/* Lunarist integration for Eugene Card.
   Non-blocking: failures here must never stop Eugene Card from rendering.
   Lunarist credentials/tokens are never stored in the browser or database.
*/
(function () {
  'use strict';

  var BASE = 'https://lunaristudio.vercel.app';
  var booted = false;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];
    });
  }
  function username(v) {
    return String(v || '').trim().replace(/^@/, '').replace(/^\/+|\/+$/g, '');
  }
  function profileUrl(u) {
    u = username(u);
    return u ? BASE + '/' + encodeURIComponent(u) : BASE;
  }
  function commissionUrl(u) {
    u = username(u);
    return u ? profileUrl(u) + '?commission=1' : BASE;
  }
  function css() {
    if (document.getElementById('ec-lunarist-css')) return;
    var s = document.createElement('style');
    s.id = 'ec-lunarist-css';
    s.textContent = '.ec-lunarist{margin-top:12px;padding:14px;border:1px solid rgba(139,92,246,.28);border-radius:14px;background:rgba(30,27,75,.32)}' +
      '.ec-lunarist h4{margin:0 0 4px;font-size:12px;font-weight:900;color:#e9d5ff}' +
      '.ec-lunarist p{margin:0 0 10px;font-size:11px;color:#94a3b8}' +
      '.ec-lunarist-row{display:flex;gap:8px;align-items:center}' +
      '.ec-lunarist input{flex:1;min-width:0;background:rgba(2,6,23,.72);border:1px solid #334155;border-radius:10px;padding:9px 10px;color:#f8fafc;outline:0;font-size:11px}' +
      '.ec-lunarist input:focus{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.1)}' +
      '.ec-lunarist button,.ec-lunarist a{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;padding:9px 12px;font-size:10px;font-weight:900;text-decoration:none;cursor:pointer;border:1px solid rgba(139,92,246,.38);background:rgba(124,58,237,.14);color:#ddd6fe}' +
      '.ec-lunarist button:hover,.ec-lunarist a:hover{background:rgba(124,58,237,.24)}' +
      '.ec-lunarist-status{margin-top:8px;font-size:10px;color:#94a3b8}.ec-lunarist-status.ok{color:#86efac}' +
      '.ec-lunarist-cta{margin-top:9px;width:100%;box-sizing:border-box}' +
      '.ec-lunarist-link{margin-top:7px;display:inline-block;font-size:10px;color:#c4b5fd;text-decoration:none}' +
      '@media(max-width:520px){.ec-lunarist-row{flex-direction:column;align-items:stretch}}';
    document.head.appendChild(s);
  }

  function getClient() { return window.supabaseClient || null; }

  async function currentUser() {
    var c = getClient();
    if (!c || !c.auth) return null;
    try {
      var r = await c.auth.getUser();
      return r && r.data ? r.data.user : null;
    } catch (_) { return null; }
  }

  async function saveLink(u) {
    var c = getClient();
    var user = await currentUser();
    u = username(u);
    if (!c || !user || !u) throw new Error('Please sign in and enter your Lunarist username.');

    var profileUrlValue = profileUrl(u);
    var payload = {
      eugene_user_id: user.id,
      lunarist_username: u,
      lunarist_profile_url: profileUrlValue,
      last_synced_at: new Date().toISOString()
    };
    var r = await c.from('lunarist_links').upsert(payload, { onConflict: 'eugene_user_id' });
    if (r.error) throw r.error;

    // Keep public profile data available to Eugene Card's existing public profile UI.
    var p = await c.from('profiles').update({
      lunarist_username: u,
      lunarist_profile_url: profileUrlValue,
      updated_at: new Date().toISOString()
    }).eq('id', user.id);
    if (p.error) console.warn('[Lunarist] public profile update skipped:', p.error.message);
    return payload;
  }

  async function renderAccountLink() {
    var panel = document.getElementById('accountPanel');
    if (!panel || panel.querySelector('[data-ec-lunarist]')) return;
    var user = await currentUser();
    if (!user) return;
    var c = getClient();
    if (!c) return;

    var existing = null;
    try {
      var q = await c.from('lunarist_links').select('lunarist_username,lunarist_profile_url').eq('eugene_user_id', user.id).maybeSingle();
      existing = q.data || null;
    } catch (_) {}

    var wrap = document.createElement('section');
    wrap.className = 'ec-lunarist';
    wrap.setAttribute('data-ec-lunarist', '1');
    wrap.innerHTML = '<h4><i class="fa-solid fa-moon"></i> Lunarist</h4>' +
      '<p>Connect your Eugene Card profile to your Lunarist creator profile.</p>' +
      '<div class="ec-lunarist-row">' +
      '<input id="ec-lunarist-username" autocomplete="off" placeholder="Lunarist username" value="' + esc(existing && existing.lunarist_username || '') + '">' +
      '<button type="button" id="ec-lunarist-save">Connect</button></div>' +
      '<div class="ec-lunarist-status" id="ec-lunarist-status"></div>';
    panel.appendChild(wrap);

    var save = wrap.querySelector('#ec-lunarist-save');
    var input = wrap.querySelector('#ec-lunarist-username');
    var status = wrap.querySelector('#ec-lunarist-status');
    if (existing && existing.lunarist_username) {
      status.className = 'ec-lunarist-status ok';
      status.textContent = 'Connected to @' + existing.lunarist_username;
      var link = document.createElement('a');
      link.className = 'ec-lunarist-link';
      link.href = existing.lunarist_profile_url || profileUrl(existing.lunarist_username);
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = 'Open my Lunarist profile →';
      wrap.appendChild(link);
    }
    save.addEventListener('click', async function () {
      save.disabled = true; status.className = 'ec-lunarist-status'; status.textContent = 'Connecting…';
      try {
        var result = await saveLink(input.value);
        status.className = 'ec-lunarist-status ok';
        status.textContent = 'Connected to @' + result.lunarist_username;
        var old = wrap.querySelector('.ec-lunarist-link'); if (old) old.remove();
        var a = document.createElement('a'); a.className = 'ec-lunarist-link'; a.href = result.lunarist_profile_url; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent='Open my Lunarist profile →'; wrap.appendChild(a);
        decoratePublicProfiles();
      } catch (e) {
        status.className = 'ec-lunarist-status'; status.textContent = e && e.message ? e.message : 'Could not connect Lunarist.';
      } finally { save.disabled = false; }
    });
  }

  function addCTA(card, u) {
    if (!card || !u || card.querySelector('[data-ec-lunarist-cta]')) return;
    var a = document.createElement('a');
    a.setAttribute('data-ec-lunarist-cta','1');
    a.className = 'ec-lunarist-cta';
    a.href = commissionUrl(u);
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Commission Me on Lunarist';
    card.appendChild(a);
  }

  async function decoratePublicProfiles() {
    var c = getClient();
    if (!c) return;
    try {
      var r = await c.from('profiles').select('username,lunarist_username,lunarist_profile_url').not('lunarist_username','is',null);
      var rows = r.data || [];
      if (!rows.length) return;
      var map = {};
      rows.forEach(function (p) { if (p.username && p.lunarist_username) map[username(p.username).toLowerCase()] = p; });
      Object.keys(map).forEach(function (key) {
        var p = map[key];
        var nodes = Array.prototype.slice.call(document.querySelectorAll('a,button,span,p,h2,h3,h4,div'));
        nodes.forEach(function (el) {
          if (el.children.length > 2) return;
          var t = (el.textContent || '').trim().replace(/^@/,'').toLowerCase();
          if (t !== key) return;
          var card = el.closest('.profile-card,.user-card,.member-card,.artist-card,.collector-card,[class*="card"],article');
          if (card) addCTA(card, p.lunarist_username);
        });
      });
    } catch (e) { console.warn('[Lunarist] public CTA skipped:', e.message); }
  }

  function init() {
    if (booted) return; booted = true; css();
    // app.js initializes Supabase during DOMContentLoaded; wait briefly without blocking it.
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (getClient()) { clearInterval(timer); renderAccountLink(); decoratePublicProfiles(); }
      else if (tries > 40) clearInterval(timer);
    }, 250);
    var observer = new MutationObserver(function () {
      if (getClient()) { renderAccountLink(); decoratePublicProfiles(); }
    });
    observer.observe(document.body, {childList:true, subtree:true});
  }

  window.EugeneCardLunarist = {
    baseUrl: BASE,
    profileUrl: profileUrl,
    commissionUrl: commissionUrl,
    connect: saveLink
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
