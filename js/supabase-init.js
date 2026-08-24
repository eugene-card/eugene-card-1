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
})();
