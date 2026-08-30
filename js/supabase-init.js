// Creates the single shared Supabase client used by the whole app.
(function () {
  const { createClient } = window.supabase || {};
  const cfg = window.SUPABASE_CONFIG || {};
  if (!createClient) { console.error("Supabase JS SDK failed to load from the CDN."); return; }
  if (!cfg.url || cfg.url.startsWith("YOUR_") || !cfg.anonKey || cfg.anonKey.startsWith("YOUR_")) { console.error("Supabase is not configured. Add your project URL and anon/publishable key to js/supabase-config.js."); return; }
  window.supabaseClient = createClient(cfg.url, cfg.anonKey);
  // inventory-supabase.js is the single owner of the Inventory Tools UI.
  // Do not load inventory-backup-import.js because it creates a second toolbar.
  const scripts=['supabase-app-wire.js','inventory-supabase.js','inventory-owner-users.js','card-tracking-supabase.js','notifications-enhancement.js','profile-avatar.js','catalog-image-fix.js'];
  scripts.forEach(name=>{const s=document.createElement('script');s.src='./js/'+name+'?v=2';s.defer=true;document.head.appendChild(s);});
})();
