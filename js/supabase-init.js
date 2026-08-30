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

  // The existing app uses a Firebase-shaped API. Keep that compatibility
  // layer, then load the native Supabase data bridge after the page has been
  // parsed so it can hydrate the real app state.
  const compat = document.createElement('script');
  compat.src = './js/supabase-firebase-compat.js';
  compat.defer = true;
  document.head.appendChild(compat);

  const wire = document.createElement('script');
  wire.src = './js/supabase-app-wire.js';
  wire.defer = true;
  document.head.appendChild(wire);

  const notifications = document.createElement('script');
  notifications.src = './js/notifications-enhancement.js';
  notifications.defer = true;
  document.head.appendChild(notifications);
})();
