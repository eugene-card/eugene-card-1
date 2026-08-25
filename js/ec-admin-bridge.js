// js/ec-admin-bridge.js

(function () {
  window.EC_ADMIN = window.EC_ADMIN || {};

  // List of authorized admin emails
  const ALLOWED_ADMIN_EMAILS = [
    'eugenecard.market@gmail.com',
    'eugene.aquila06@gmail.com'
  ];

  const client = window.supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);

  if (!client) {
    console.error('Supabase client not initialized.');
    return;
  }

  // Helper function to sync admin session across features
  async function syncSession(session) {
    const user = session?.user || null;
    const userEmail = user?.email?.toLowerCase();

    // Verify user is logged in AND their email is in the allowed list
    const isAdmin = user && userEmail && ALLOWED_ADMIN_EMAILS.includes(userEmail);

    if (isAdmin) {
      window.EC_ADMIN.currentUser = user;
      window.EC_ADMIN.session = session;
      window.EC_ADMIN.isAdmin = true;
      localStorage.setItem('ec_admin_authenticated', 'true');
      localStorage.setItem('ec_admin_email', userEmail);
    } else {
      window.EC_ADMIN.currentUser = null;
      window.EC_ADMIN.session = null;
      window.EC_ADMIN.isAdmin = false;
      localStorage.removeItem('ec_admin_authenticated');
      localStorage.removeItem('ec_admin_email');
    }

    // Dispatch event so feature components know authentication check has completed
    window.dispatchEvent(
      new CustomEvent('ec-auth-ready', {
        detail: { session, isAdmin, user }
      })
    );
  }

  // Initial check on script load
  client.auth.getSession().then(({ data: { session } }) => {
    syncSession(session);
  });

  // Listen for login/logout state changes
  client.auth.onAuthStateChange((event, session) => {
    syncSession(session);
  });
})();