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

  const wire = document.createElement('script');
  wire.src = './js/supabase-app-wire.js';
  wire.defer = true;
  document.head.appendChild(wire);

  const inventory = document.createElement('script');
  inventory.src = './js/inventory-supabase.js';
  inventory.defer = true;
  document.head.appendChild(inventory);

  const inventoryBackup = document.createElement('script');
  inventoryBackup.src = './js/inventory-backup-import.js';
  inventoryBackup.defer = true;
  document.head.appendChild(inventoryBackup);

  const tracking = document.createElement('script');
  tracking.src = './js/card-tracking-supabase.js';
  tracking.defer = true;
  document.head.appendChild(tracking);

  const notifications = document.createElement('script');
  notifications.src = './js/notifications-enhancement.js';
  notifications.defer = true;
  document.head.appendChild(notifications);

  const profileAvatar = document.createElement('script');
  profileAvatar.src = './js/profile-avatar.js';
  profileAvatar.defer = true;
  document.head.appendChild(profileAvatar);

  const catalogImages = document.createElement('script');
  catalogImages.src = './js/catalog-image-fix.js';
  catalogImages.defer = true;
  document.head.appendChild(catalogImages);
})();
