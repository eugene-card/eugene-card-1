/* Eugene Card -> Lunarist integration. Self-contained and non-blocking. */
(function () {
  'use strict';
  var BASE = 'https://lunaristudio.vercel.app';
  function clean(v) { return String(v || '').trim().replace(/^@+/, '').replace(/^\/+|\/+$/g, ''); }
  function profileUrl(username) { var u = clean(username); return u ? BASE + '/' + encodeURIComponent(u) : BASE; }
  function addStyle() {
    if (document.getElementById('lunarist-link-style')) return;
    var s = document.createElement('style'); s.id = 'lunarist-link-style';
    s.textContent = '.lunarist-link-box{margin-top:12px;padding:14px;border:1px solid rgba(99,102,241,.25);border-radius:14px;background:rgba(99,102,241,.07)}.lunarist-link-title{font-weight:700;font-size:13px;margin-bottom:5px}.lunarist-link-copy{font-size:12px;opacity:.7;margin-bottom:10px}.lunarist-link-actions{display:flex;gap:8px;flex-wrap:wrap}.lunarist-link-btn{display:inline-flex;align-items:center;justify-content:center;padding:9px 12px;border-radius:10px;border:1px solid rgba(99,102,241,.35);background:rgba(99,102,241,.12);color:inherit;text-decoration:none;font-weight:700;font-size:12px;cursor:pointer}.lunarist-link-btn:hover{background:rgba(99,102,241,.2)}';
    document.head.appendChild(s);
  }
  function makeBox(username, connected) {
    var u = clean(username); if (!u) return null;
    var box = document.createElement('div'); box.className = 'lunarist-link-box'; box.dataset.lunaristBox = '1';
    box.innerHTML = '<div class="lunarist-link-title">Lunarist</div><div class="lunarist-link-copy">Connect your Eugene Card profile to your Lunarist creative profile.</div><div class="lunarist-link-actions"><a class="lunarist-link-btn" href="'+profileUrl(u)+'" target="_blank" rel="noopener noreferrer">Open Lunarist Profile</a><a class="lunarist-link-btn" href="'+profileUrl(u)+'?commission=1" target="_blank" rel="noopener noreferrer">Commission Me on Lunarist</a></div>';
    return box;
  }
  async function getLink(client, id) {
    try { var r = await client.from('lunarist_links').select('lunarist_username,lunarist_profile_url').eq('eugene_user_id', id).maybeSingle(); return r.data || null; } catch (_) { return null; }
  }
  function findAccountPanel() { return document.getElementById('accountPanel') || document.querySelector('[data-account-panel]'); }
  async function mount() {
    addStyle();
    var auth = window.EugeneCardAuth, panel = findAccountPanel();
    if (!auth || !panel || panel.querySelector('[data-lunarist-box]')) return false;
    var profile = auth.profile || {}, client = auth.client, link = await getLink(client, auth.user && auth.user.id);
    var username = link && link.lunarist_username || profile.lunarist_username || profile.username;
    if (!username) {
      var box = document.createElement('div'); box.className = 'lunarist-link-box'; box.dataset.lunaristBox = '1';
      box.innerHTML = '<div class="lunarist-link-title">Lunarist</div><div class="lunarist-link-copy">Add your Lunarist username to connect this profile.</div><button type="button" class="lunarist-link-btn" data-lunarist-connect>Connect Lunarist</button>';
      box.querySelector('[data-lunarist-connect]').addEventListener('click', async function () {
        var entered = clean(window.prompt('Enter your Lunarist username (without @):', ''));
        if (!entered || !auth.user) return;
        var result = await client.from('lunarist_links').upsert({eugene_user_id:auth.user.id,lunarist_username:entered,lunarist_profile_url:profileUrl(entered),sync_source:'lunarist',last_synced_at:new Date().toISOString(),metadata:{display_name:profile.display_name || '',role:profile.role || ''}},{onConflict:'eugene_user_id'});
        if (result.error) { alert('Could not connect Lunarist: ' + result.error.message); return; }
        box.replaceWith(makeBox(entered));
      });
      panel.appendChild(box); return true;
    }
    panel.appendChild(makeBox(username, true)); return true;
  }
  function boot() { var tries=0, timer=setInterval(function(){ tries++; if (mount() || tries>30) clearInterval(timer); }, 250); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
  window.LunaristLink = { profileUrl: profileUrl, baseUrl: BASE };
})();
