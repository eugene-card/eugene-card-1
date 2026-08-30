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
        if (stopped) return;
        const userId = user?.id || null;
        if (!user) {
          // Do not race session initialization with a premature null callback.
          return;
        }
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

        // The legacy pages check the email synchronously. If Supabase says this
        // account has role=admin, preserve the real user object but ensure the
        // legacy email allowlist can recognize an admin profile.
        const bridgedUser = authorized && !String(user.email || '').toLowerCase().includes('@')
          ? { ...user, email: 'eugenecard.market@gmail.com' }
          : user;
        callback(bridgedUser);
      };

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
