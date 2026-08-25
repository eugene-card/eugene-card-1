/* Eugene Card — single Supabase client/profile UI layer.
   IMPORTANT: auth state is owned by supabase-firebase-compat.js.
   This file must never create a second auth listener or second currentUser state. */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://tsjgvzpzfjyecnginipt.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_o3oWlPh_EPj5xd0GBjDWYQ_UhVicSH3';
  const ADMIN_EMAILS = ['eugene.aquila06@gmail.com', 'eugenecard.market@gmail.com'];

  if (!window.supabase) {
    console.error('Supabase SDK missing');
    return;
  }

  // Reuse an existing client if one was already created. There is exactly one
  // Supabase client and exactly one auth/session owner for the whole application.
  const sb = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'eugene-card-supabase-auth'
    }
  });
  window.supabaseClient = sb;

  const isAdminEmail = email => ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
  window.isUserAdmin = isAdminEmail;
  window.EUGENE_ADMIN_EMAIL = ADMIN_EMAILS[0];

  function normalizeProfile(row) {
    if (!row) return null;
    return {
      ...row,
      name: row.display_name ?? row.name ?? '',
      display_name: row.display_name ?? row.name ?? '',
      avatarUrl: row.avatar_url ?? row.avatarUrl ?? '',
      username: row.username ?? '',
      bio: row.bio ?? '',
      isPlusMember: !!(row.is_plus_member ?? row.isPlusMember),
      socialIg: row.social_ig ?? row.socialIg ?? '',
      socialTwitter: row.social_twitter ?? row.socialTwitter ?? '',
      socialTiktok: row.social_tiktok ?? row.socialTiktok ?? '',
      socialWeb: row.social_web ?? row.socialWeb ?? '',
      profileCompleted: !!(row.profile_completed ?? row.profileCompleted),
      isAdmin: row.role === 'admin' || isAdminEmail(row.email)
    };
  }

  async function ensureProfile(user) {
    if (!user) return null;
    const email = String(user.email || '').trim().toLowerCase();
    let { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw error;

    if (!data) {
      const meta = user.user_metadata || {};
      const display = meta.full_name || meta.name || email.split('@')[0] || 'Eugene Card User';
      const username = display.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || `user_${user.id.slice(0, 8)}`;
      const row = {
        id: user.id,
        username,
        display_name: display,
        avatar_url: meta.avatar_url || meta.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(display)}`,
        bio: '',
        role: isAdminEmail(email) ? 'admin' : 'user',
        is_plus_member: false,
        social_ig: '',
        social_twitter: '',
        social_tiktok: '',
        social_web: '',
        profile_completed: false,
        updated_at: new Date().toISOString()
      };
      const created = await sb.from('profiles').upsert(row, { onConflict: 'id' }).select('*').single();
      if (created.error) throw created.error;
      data = created.data || row;
    } else if (isAdminEmail(email) && data.role !== 'admin') {
      const promoted = await sb.from('profiles').update({ role: 'admin', updated_at: new Date().toISOString() }).eq('id', user.id).select('*').single();
      if (promoted.error) throw promoted.error;
      data = promoted.data || { ...data, role: 'admin' };
    }

    return normalizeProfile(data);
  }

  window.ensureSupabaseProfile = ensureProfile;

  // Profile customization is UI only. It reads/writes the canonical user held by
  // supabase-firebase-compat.js and never creates another auth state.
  function ensureModal() {
    let modal = document.getElementById('ec-profile-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'ec-profile-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;font-family:Inter,system-ui,sans-serif';
    modal.innerHTML = `
      <div class="ecp-backdrop"></div>
      <div class="ecp-card" role="dialog" aria-modal="true" aria-labelledby="ecp-title">
        <div class="ecp-head"><h2 id="ecp-title">Customize Profile</h2><button type="button" data-ecp-close aria-label="Close">×</button></div>
        <form id="ecp-form">
          <div class="ecp-avatar"><img id="ecp-avatar" alt="Profile avatar"><label>Avatar URL<input id="ecp-avatar-url" type="url" placeholder="https://..."></label></div>
          <label>Display name<input id="ecp-name" maxlength="80" required></label>
          <label>Username<input id="ecp-username" maxlength="40"></label>
          <label>Bio<textarea id="ecp-bio" maxlength="500" rows="4"></textarea></label>
          <div class="ecp-actions"><button type="button" data-ecp-close>Cancel</button><button type="submit">Save Profile</button></div>
          <p id="ecp-status"></p>
        </form>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #ec-profile-modal .ecp-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(8px)}
      #ec-profile-modal .ecp-card{position:relative;margin:7vh auto;max-width:560px;width:calc(100% - 24px);max-height:86vh;overflow:auto;background:#0f172a;color:#f8fafc;border:1px solid #334155;border-radius:20px;padding:22px;box-shadow:0 30px 90px rgba(0,0,0,.6)}
      #ec-profile-modal .ecp-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
      #ec-profile-modal h2{font-size:20px;font-weight:800}
      #ec-profile-modal label{display:block;font-size:12px;font-weight:700;color:#cbd5e1;margin:12px 0}
      #ec-profile-modal input,#ec-profile-modal textarea{display:block;width:100%;box-sizing:border-box;margin-top:6px;background:#020617;border:1px solid #334155;color:#f8fafc;border-radius:10px;padding:10px;outline:none}
      #ec-profile-modal .ecp-avatar{display:grid;grid-template-columns:76px 1fr;gap:14px;align-items:center}
      #ec-profile-modal .ecp-avatar img{width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid #6366f1}
      #ec-profile-modal .ecp-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
      #ec-profile-modal .ecp-actions button{border:1px solid #475569;border-radius:10px;padding:9px 14px;background:#1e293b;color:#fff;cursor:pointer}
      #ec-profile-modal .ecp-actions button[type=submit]{background:#4f46e5;border-color:#6366f1}
    `;
    document.head.appendChild(style);
    document.body.appendChild(modal);

    const close = () => { modal.style.display = 'none'; };
    modal.querySelectorAll('[data-ecp-close]').forEach(button => button.addEventListener('click', close));
    modal.querySelector('.ecp-backdrop').addEventListener('click', close);

    modal.querySelector('#ecp-form').addEventListener('submit', async event => {
      event.preventDefault();
      const user = window.auth?.currentUser || window.currentUser;
      const status = modal.querySelector('#ecp-status');
      if (!user?.id) { status.textContent = 'Please log in first.'; return; }
      status.textContent = 'Saving…';

      const payload = {
        display_name: modal.querySelector('#ecp-name').value.trim(),
        username: modal.querySelector('#ecp-username').value.trim(),
        bio: modal.querySelector('#ecp-bio').value.trim(),
        avatar_url: modal.querySelector('#ecp-avatar-url').value.trim(),
        updated_at: new Date().toISOString()
      };
      const result = await sb.from('profiles').update(payload).eq('id', user.id).select('*').single();
      if (result.error) { status.textContent = `Could not save profile: ${result.error.message}`; return; }

      // Let the canonical adapter refresh its one user object and all existing UI.
      if (typeof window.syncEugeneCardFromServer === 'function') await window.syncEugeneCardFromServer('profile-saved');
      status.textContent = 'Profile saved.';
      setTimeout(close, 350);
    });

    return modal;
  }

  window.openProfileCustomization = async function () {
    const user = window.auth?.currentUser || window.currentUser;
    if (!user) { window.dispatchEvent(new CustomEvent('eugene-auth-required')); return; }
    const modal = ensureModal();
    let profile = user.profile;
    if (!profile) {
      try { profile = await ensureProfile(user); } catch (error) { console.error('Profile load failed:', error); }
    }
    modal.querySelector('#ecp-name').value = profile?.name || user.displayName || user.email || '';
    modal.querySelector('#ecp-username').value = profile?.username || user.username || '';
    modal.querySelector('#ecp-bio').value = profile?.bio || user.bio || '';
    modal.querySelector('#ecp-avatar-url').value = profile?.avatarUrl || user.avatarUrl || user.photoURL || '';
    modal.querySelector('#ecp-avatar').src = profile?.avatarUrl || user.avatarUrl || user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.email || 'user')}`;
    modal.querySelector('#ecp-status').textContent = '';
    modal.style.display = 'block';
  };

  // Only expose profile helpers. Do NOT call onAuthStateChange here: the adapter
  // is the sole owner of authentication state and login/logout UI.
  const boot = () => { ensureModal(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
