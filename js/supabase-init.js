// Creates the single shared Supabase client used by the whole app.
(function () {
  // Eugene Card defaults to English. Persist the preference so the main app
  // and any language-aware enhancements start in EN instead of ID.
  document.documentElement.lang = 'en';
  ['language','locale','lang','selectedLanguage','eugeneCardLanguage'].forEach(key => {
    try { localStorage.setItem(key, 'en'); } catch (_) {}
  });
  window.EugeneCardLanguage = 'en';

  const { createClient } = window.supabase || {};
  const cfg = window.SUPABASE_CONFIG || {};
  if (!createClient) { console.error("Supabase JS SDK failed to load from the CDN."); return; }
  if (!cfg.url || cfg.url.startsWith("YOUR_") || !cfg.anonKey || cfg.anonKey.startsWith("YOUR_")) { console.error("Supabase is not configured. Add your project URL and anon/publishable key to js/supabase-config.js."); return; }
  window.supabaseClient = createClient(cfg.url, cfg.anonKey);
  const scripts=['supabase-app-wire.js','inventory-supabase.js','inventory-tools-scope.js','inventory-owner-users.js','card-tracking-supabase.js','notifications-enhancement.js','notification-bell-fix.js','profile-avatar.js','catalog-image-fix.js','lunarist-integration.js'];
  scripts.forEach(name=>{const s=document.createElement('script');s.src='./js/'+name+'?v=5';s.defer=true;document.head.appendChild(s);});
})();
