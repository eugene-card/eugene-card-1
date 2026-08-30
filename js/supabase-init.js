// Creates the single shared Supabase client used by the whole app.
// This file was referenced by index.html but was missing from the export,
// which is why window.supabaseClient / window.db / window.auth were never
// set and the Google login button did nothing (see supabase-firebase-compat.js).
(function () {
  const { createClient } = window.supabase || {};
  const cfg = window.SUPABASE_CONFIG || {};

  if (!createClient) {
    console.error("Supabase JS SDK failed to load from the CDN.");
    return;
  }
  if (!cfg.url || cfg.url.startsWith("YOUR_") || !cfg.anonKey || cfg.anonKey.startsWith("YOUR_")) {
    console.error("Supabase is not configured. Add your project URL and anon/publishable key to js/supabase-config.js.");
    return;
  }

  window.supabaseClient = createClient(cfg.url, cfg.anonKey);

  // Notification UX loads as a separate module so the large legacy index.html
  // does not need to be rewritten. It waits for DOMContentLoaded and then wraps
  // the existing notification functions.
  const script = document.createElement('script');
  script.src = './js/notifications-enhancement.js';
  script.defer = true;
  document.head.appendChild(script);
})();
