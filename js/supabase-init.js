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

  // Native application data bridge.
  const wire = document.createElement('script');
  wire.src = './js/supabase-app-wire.js';
  wire.defer = true;
  document.head.appendChild(wire);

  // Native Inventory adapter. It waits for the legacy db compatibility layer
  // to exist, then replaces ONLY db.collection('cards') with direct Supabase
  // CRUD against public.cards.
  const inventory = document.createElement('script');
  inventory.src = './js/inventory-supabase.js';
  inventory.defer = true;
  document.head.appendChild(inventory);

  // Notification UX enhancement.
  const notifications = document.createElement('script');
  notifications.src = './js/notifications-enhancement.js';
  notifications.defer = true;
  document.head.appendChild(notifications);
})();
