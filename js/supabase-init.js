// Creates the single shared Supabase client used by the whole app.
(function () {
  document.documentElement.lang = 'en';
  ['language','locale','lang','selectedLanguage','eugeneCardLanguage'].forEach(key => { try { localStorage.setItem(key, 'en'); } catch (_) {} });
  window.EugeneCardLanguage = 'en';

  function removeLiteralNewlineNodes() {
    try {
      const root = document.documentElement;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let n;
      while ((n = walker.nextNode())) {
        const value = n.nodeValue || '';
        if (/^\\n+$/.test(value) || /^\\r?\\n+$/.test(value)) nodes.push(n);
      }
      nodes.forEach(node => node.remove());
    } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', removeLiteralNewlineNodes, { once: true });
  else removeLiteralNewlineNodes();

  const { createClient } = window.supabase || {};
  const cfg = window.SUPABASE_CONFIG || {};
  if (!createClient) { console.error('Supabase JS SDK failed to load from the CDN.'); return; }
  if (!cfg.url || cfg.url.startsWith('YOUR_') || !cfg.anonKey || cfg.anonKey.startsWith('YOUR_')) { console.error('Supabase is not configured.'); return; }
  window.supabaseClient = createClient(cfg.url, cfg.anonKey);

  const scripts = ['supabase-app-wire.js','inventory-supabase.js','inventory-tools-scope.js','inventory-owner-users.js','card-tracking-supabase.js','notifications-enhancement.js','notification-bell-fix.js','profile-avatar.js','catalog-image-fix.js','lunarist-integration.js'];
  scripts.forEach(name => { const s=document.createElement('script'); s.src='./js/'+name+'?v=8'; s.defer=true; document.head.appendChild(s); });
})();
