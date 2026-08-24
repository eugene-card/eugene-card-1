/* Eugene Card — Supabase-only auth/profile bootstrap */
(function () {
  const URL = 'https://tsjgvzpzfjyecnginipt.supabase.co';
  const KEY = 'sb_publishable_o3oWlPh_EPj5xd0GBjDWYQ_UhVicSH3';
  const ADMIN_EMAILS = ['eugene.aquila06@gmail.com', 'eugenecard.market@gmail.com'];

  if (!window.supabase) throw new Error('Supabase SDK missing');

  const sb = window.supabaseClient = window.supabase.createClient(URL, KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  });

  window.isUserAdmin = email => ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
  window.EUGENE_ADMIN_EMAIL = ADMIN_EMAILS[0];

  function normalizeAuthUser(user) {
    if (!user) return null;
    const m = user.user_metadata || {};
    return {
      ...user,
      uid: user.id,
      displayName: m.full_name || m.name || user.email || '',
      photoURL: m.avatar_url || m.picture || null,
      emailVerified: !!user.email_confirmed_at,
      providerData: user.identities || [],
      isAdmin: window.isUserAdmin(user.email)
    };
  }

  function normalizeProfile(row) {
    if (!row) return null;
    return {
      ...row,
      name: row.name ?? row.display_name ?? '',
      display_name: row.display_name ?? row.name ?? '',
      avatarUrl: row.avatarUrl ?? row.avatar_url ?? '',
      isPlusMember: row.isPlusMember ?? row.is_plus_member ?? false,
      socialIg: row.socialIg ?? row.social_ig ?? '',
      socialTwitter: row.socialTwitter ?? row.social_twitter ?? '',
      socialTiktok: row.socialTiktok ?? row.social_tiktok ?? '',
      socialWeb: row.socialWeb ?? row.social_web ?? '',
      profileCompleted: row.profileCompleted ?? row.profile_completed ?? false,
      isAdmin: row.isAdmin ?? row.role === 'admin'
    };
  }

  async function ensureSupabaseProfile(user) {
    if (!user) return null;
    const email = String(user.email || '').trim().toLowerCase();
    let { data: profile, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) {
      console.warn('Supabase profile read:', error);
      return null;
    }

    if (!profile) {
      const metadata = user.user_metadata || {};
      const name = metadata.full_name || metadata.name || email.split('@')[0];
      const row = {
        id: user.id,
        username: name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, ''),
        display_name: name,
        avatar_url: metadata.avatar_url || metadata.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`,
        bio: '',
        role: window.isUserAdmin(email) ? 'admin' : 'user',
        is_plus_member: false,
        social_ig: '',
        social_twitter: '',
        social_tiktok: '',
        social_web: '',
        profile_completed: false,
        updated_at: new Date().toISOString()
      };
      const created = await sb.from('profiles').upsert(row, { onConflict: 'id' }).select().single();
      profile = created.data || row;
    } else if (window.isUserAdmin(email) && profile.role !== 'admin') {
      const updated = await sb.from('profiles').update({ role: 'admin', updated_at: new Date().toISOString() }).eq('id', user.id).select().single();
      profile = updated.data || { ...profile, role: 'admin' };
    }
    return normalizeProfile(profile);
  }

  window.ensureSupabaseProfile = ensureSupabaseProfile;

  // Keep the existing index.html/UI untouched. This bridge only mirrors the
  // real Supabase session into the user object expected by the existing UI.
  function syncCurrentUser(user) {
    const normalized = normalizeAuthUser(user);
    window.currentUser = normalized;
    if (window.auth) window.auth.currentUser = normalized;
    if (normalized) ensureSupabaseProfile(normalized).catch(err => console.warn('Profile bootstrap:', err));
    return normalized;
  }

  // Bootstrap an already-authenticated browser session as soon as the app loads.
  sb.auth.getSession().then(({ data, error }) => {
    if (error) console.warn('Supabase session:', error);
    syncCurrentUser(data?.session?.user || null);
  }).catch(err => console.warn('Supabase session bootstrap:', err));

  // Do not monkey-patch Supabase Auth methods. The compatibility layer owns the
  // existing app's auth callback and calls this bridge through the real session.
  sb.auth.onAuthStateChange((_event, session) => {
    const user = syncCurrentUser(session?.user || null);
    // Let the existing header render after the session has been committed.
    setTimeout(() => {
      if (typeof window.renderAuthHeader === 'function') window.renderAuthHeader();
    }, 0);
    if (user) setTimeout(() => ensureSupabaseProfile(user), 0);
  });

  // Wait for the compatibility layer to create window.auth, then keep its
  // currentUser in sync without replacing any of its existing behavior.
  let attempts = 0;
  const syncCompat = () => {
    if (window.auth) {
      if (window.currentUser) window.auth.currentUser = window.currentUser;
      return;
    }
    if (++attempts < 100) setTimeout(syncCompat, 25);
  };
  syncCompat();

  // Existing profile customization button: only relabel it when the user is
  // logged in; no new feature or route is introduced here.
  const enhanceProfileButton = () => {
    const container = document.getElementById('auth-header-container');
    if (!container || !window.currentUser) return;
    const button = container.querySelector('button[aria-label="Edit Profile"]');
    if (!button || button.querySelector('[data-profile-customize-label]')) return;
    button.classList.remove('p-2');
    button.classList.add('px-2.5', 'py-2');
    button.innerHTML = '<i class="fa-solid fa-user-pen text-xs mr-1.5"></i><span data-profile-customize-label>Customize</span>';
    button.title = 'Customize Profile';
    button.setAttribute('aria-label', 'Customize Profile');
  };

  const observeHeader = () => {
    const container = document.getElementById('auth-header-container');
    if (!container || container.__profileEnhancer) return;
    container.__profileEnhancer = true;
    new MutationObserver(enhanceProfileButton).observe(container, { childList: true, subtree: true });
    enhanceProfileButton();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeHeader);
  else observeHeader();
  setTimeout(observeHeader, 500);
  setTimeout(observeHeader, 1500);
})();
