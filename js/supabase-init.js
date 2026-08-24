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

  // The main UI uses the Firebase-style user shape (uid/photoURL/displayName),
  // while Supabase supplies id/user_metadata. Normalize both getSession() and
  // auth-state events before the compatibility layer receives them.
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
    if (result?.data?.session?.user) {
      result.data.session.user = toLegacyAuthUser(result.data.session.user);
    }
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

  // Bridge Supabase's real session into the legacy UI's window.auth.currentUser.
  // The compatibility layer exposes window.auth, but its currentUser property
  // was previously left at null forever, so the header could keep showing
  // "Log In" even though Supabase had a valid session.
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
  setTimeout(syncExistingSession, 0);
  originalOnAuthStateChange((_event, session) => {
    syncLegacyCurrentUser(session?.user || null);
  });
})();
