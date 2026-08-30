// Creates the single shared Supabase client used by the whole app.
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

  // index.html already loads the legacy compatibility layer immediately
  // after this file. The native bridge waits for the page to finish parsing
  // and then connects the app state to real Supabase tables.
  const wire = document.createElement('script');
  wire.src = './js/supabase-app-wire.js';
  wire.defer = true;
  document.head.appendChild(wire);

  // Notification UX enhancement.
  const notifications = document.createElement('script');
  notifications.src = './js/notifications-enhancement.js';
  notifications.defer = true;
  document.head.appendChild(notifications);
})();
