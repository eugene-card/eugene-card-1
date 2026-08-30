// Shared admin authorization bridge for secondary HTML pages.
// Uses the same Supabase session as index.html and waits for session restoration
// before invoking the page's existing admin callback.
(function () {
  const client = window.supabaseClient || window.supabase?.createClient?.(
    window.SUPABASE_CONFIG?.url,
    window.SUPABASE_CONFIG?.anonKey,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
  if (!client) return;

  window.supabaseClient = client;
  const existingAuth = window.auth || {};

  window.auth = {
    ...existingAuth,
    onAuthStateChanged(callback) {
      let stopped = false;
      let lastUserId = null;
      let lastAuthorized = null;

      const emit = async (user) => {
        if (stopped || !user) return;
        const userId = user.id || null;
        if (!userId) return;
        if (userId === lastUserId && lastAuthorized === true) return;

        let authorized = false;
        try {
          const { data, error } = await client
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();
          authorized = !error && String(data?.role || '').toLowerCase() === 'admin';
        } catch (error) {
          console.error('Admin profile lookup failed:', error);
        }

        if (stopped) return;
        lastUserId = userId;
        lastAuthorized = authorized;

        // Legacy pages only understand their email allowlist. The profile role
        // is the source of truth; for an authorized admin, provide a compatible
        // allowlisted email while keeping the real user id/session intact.
        const bridgedUser = authorized
          ? { ...user, email: String(user.email || '').toLowerCase().includes('@') ? user.email : 'eugenecard.market@gmail.com' }
          : user;
        callback(bridgedUser);
      };

      // getSession waits for the persisted browser session to be restored.
      client.auth.getSession().then(({ data }) => emit(data?.session?.user || null));
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        if (session?.user) emit(session.user);
      });

      return () => {
        stopped = true;
        data.subscription.unsubscribe();
      };
    }
  };
})();
