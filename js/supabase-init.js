/* Eugene Card — Supabase-only auth/profile bootstrap */
(function () {
  const URL = 'https://tsjgvzpzfjyecnginipt.supabase.co';
  const KEY = 'sb_publishable_o3oWlPh_EPj5xd0GBjDWYQ_UhVicSH3';
  const ADMIN_EMAILS = ['eugene.aquila06@gmail.com', 'eugenecard.market@gmail.com'];
  if (!window.supabase) throw new Error('Supabase SDK missing');

  const sb = window.supabaseClient = window.supabase.createClient(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
  });
  window.isUserAdmin = email => ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
  window.EUGENE_ADMIN_EMAIL = ADMIN_EMAILS[0];

  const toLegacyAuthUser = user => {
    if (!user) return null;
    const metadata = user.user_metadata || {};
    return {
      ...user,
      uid: user.id,
      displayName: metadata.full_name || metadata.name || user.email || '',
      photoURL: metadata.avatar_url || metadata.picture || null,
      emailVerified: !!user.email_confirmed_at,
      providerData: user.identities || []
    };
  };

  const originalGetSession = sb.auth.getSession.bind(sb.auth);
  sb.auth.getSession = async (...args) => {
    const result = await originalGetSession(...args);
    if (result?.data?.session?.user) result.data.session.user = toLegacyAuthUser(result.data.session.user);
    return result;
  };

  const originalOnAuthStateChange = sb.auth.onAuthStateChange.bind(sb.auth);
  sb.auth.onAuthStateChange = callback => originalOnAuthStateChange((event, session) => {
    callback(event, session ? { ...session, user: toLegacyAuthUser(session.user) } : null);
  });

  const normalize = r => r ? ({
    ...r,
    name: r.name ?? r.display_name ?? '',
    display_name: r.display_name ?? r.name ?? '',
    avatarUrl: r.avatarUrl ?? r.avatar_url ?? '',
    isPlusMember: r.isPlusMember ?? r.is_plus_member ?? false,
    socialIg: r.socialIg ?? r.social_ig ?? '',
    socialTwitter: r.socialTwitter ?? r.social_twitter ?? '',
    socialTiktok: r.socialTiktok ?? r.social_tiktok ?? '',
    socialWeb: r.socialWeb ?? r.social_web ?? '',
    profileCompleted: r.profileCompleted ?? r.profile_completed ?? false,
    isAdmin: r.isAdmin ?? r.role === 'admin'
  }) : null;

  async function ensureSupabaseProfile(user) {
    if (!user) return null;
    const email = String(user.email || '').toLowerCase().trim();
    let { data: p } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (!p) {
      const { data: legacy } = await sb.from('legacy_profiles').select('*').eq('email', email).maybeSingle();
      const m = legacy || {};
      const name = m.display_name || user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0];
      const row = {
        id: user.id,
        username: m.username || name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, ''),
        display_name: name,
        avatar_url: m.avatar_url || user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`,
        bio: m.bio || '',
        role: window.isUserAdmin(email) ? 'admin' : 'user',
        is_plus_member: !!m.is_plus_member,
        social_ig: m.social_ig || '',
        social_twitter: m.social_twitter || '',
        social_tiktok: m.social_tiktok || '',
        social_web: m.social_web || '',
        profile_completed: !!m.profile_completed,
        updated_at: new Date().toISOString()
      };
      const created = await sb.from('profiles').upsert(row, { onConflict: 'id' }).select().single();
      p = created.data || row;
    } else if (window.isUserAdmin(email) && p.role !== 'admin') {
      const updated = await sb.from('profiles').update({ role: 'admin', updated_at: new Date().toISOString() }).eq('id', user.id).select().single();
      p = updated.data || { ...p, role: 'admin' };
    }
    return normalize(p);
  }
  window.ensureSupabaseProfile = ensureSupabaseProfile;

  const syncLegacyCurrentUser = user => {
    const legacyUser = user ? toLegacyAuthUser(user) : null;
    if (window.auth) window.auth.currentUser = legacyUser;
    window.currentUser = legacyUser;
    if (legacyUser) ensureSupabaseProfile(legacyUser).catch(err => console.warn('Profile bootstrap:', err));
  };

  const syncExistingSession = async () => {
    try {
      const { data } = await originalGetSession();
      syncLegacyCurrentUser(data?.session?.user || null);
    } catch (err) {
      console.warn('Session bootstrap:', err);
    }
  };

  const bridgeAuthListener = () => {
    if (!window.auth || window.auth.__supabaseBridgeInstalled) return !!window.auth;
    const original = window.auth.onAuthStateChanged;
    if (typeof original !== 'function') return false;
    window.auth.onAuthStateChanged = callback => original(user => {
      const normalized = user ? toLegacyAuthUser(user) : null;
      syncLegacyCurrentUser(normalized);
      callback(normalized);
    });
    window.auth.__supabaseBridgeInstalled = true;
    if (window.auth.currentUser) syncLegacyCurrentUser(window.auth.currentUser);
    return true;
  };

  let bridgeAttempts = 0;
  const installBridge = () => {
    if (bridgeAuthListener() || ++bridgeAttempts >= 50) return;
    setTimeout(installBridge, 50);
  };
  installBridge();

  // Add a small profile-customization affordance to the authenticated header.
  // The existing header already has an avatar/edit icon; this makes the action
  // explicit and gives logged-in users a single place to customize their name,
  // username, avatar, bio and social links. It never appears for guests.
  const enhanceProfileButton = () => {
    const container = document.getElementById('auth-header-container');
    if (!container || !window.currentUser) return;
    if (container.querySelector('[data-profile-customize-label]')) return;
    const editButton = container.querySelector('button[aria-label="Edit Profile"]');
    if (!editButton) return;
    editButton.classList.remove('p-2');
    editButton.classList.add('px-2.5', 'py-2');
    editButton.innerHTML = '<i class="fa-solid fa-user-pen text-xs mr-1.5"></i><span data-profile-customize-label>Customize</span>';
    editButton.title = 'Customize Profile';
    editButton.setAttribute('aria-label', 'Customize Profile');
  };

  const watchProfileHeader = () => {
    enhanceProfileButton();
    const container = document.getElementById('auth-header-container');
    if (!container || container.__profileEnhancer) return;
    container.__profileEnhancer = true;
    new MutationObserver(() => enhanceProfileButton()).observe(container, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchProfileHeader);
  else watchProfileHeader();
  setTimeout(watchProfileHeader, 1000);
  setTimeout(watchProfileHeader, 2500);

  setTimeout(syncExistingSession, 0);
  originalOnAuthStateChange((_event, session) => {
    syncLegacyCurrentUser(session?.user || null);
    setTimeout(watchProfileHeader, 50);
  });
})();
