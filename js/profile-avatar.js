/* Eugene Card profile-picture upload/display flow backed by Supabase Storage. */
(function () {
  'use strict';

  const BUCKET = 'profile-photos';
  const MAX_BYTES = 5 * 1024 * 1024;
  const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

  function client() {
    return window.supabaseClient;
  }

  async function getUser() {
    const supabase = client();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  }

  function currentAvatarUrl() {
    return window.currentUser?.avatarUrl || window.EugeneCardAuth?.profile?.avatar_url || '';
  }

  function setAvatarUrl(url) {
    if (window.currentUser) window.currentUser.avatarUrl = url || '';
    if (window.EugeneCardAuth?.profile) window.EugeneCardAuth.profile.avatar_url = url || '';

    document.querySelectorAll('[data-profile-avatar], #profileAvatar, .profile-avatar').forEach((el) => {
      if (el.tagName === 'IMG') {
        el.src = url || el.dataset.fallback || '';
        el.hidden = !url && !el.dataset.fallback;
      } else if (url) {
        el.style.backgroundImage = `url("${url.replace(/"/g, '\\"')}")`;
        el.classList.add('has-avatar');
      }
    });

    const existing = document.getElementById('ecProfileAvatarPreview');
    if (existing && url) existing.src = url;
  }

  function ensureStyles() {
    if (document.getElementById('ecProfileAvatarStyles')) return;
    const style = document.createElement('style');
    style.id = 'ecProfileAvatarStyles';
    style.textContent = `
      .ec-avatar-upload { display:flex; align-items:center; gap:12px; margin-top:14px; }
      .ec-avatar-preview { width:64px; height:64px; border-radius:9999px; object-fit:cover; border:2px solid rgba(245,158,11,.55); background:#111827; }
      .ec-avatar-actions { display:flex; flex-direction:column; gap:6px; }
      .ec-avatar-button { cursor:pointer; border:1px solid rgba(148,163,184,.25); border-radius:10px; padding:8px 12px; background:#111827; color:#f9fafb; font-size:13px; font-weight:600; }
      .ec-avatar-button:hover { border-color:rgba(245,158,11,.7); }
      .ec-avatar-status { font-size:12px; color:#94a3b8; min-height:16px; }
      .ec-avatar-status.error { color:#fca5a5; }
      .ec-avatar-status.ok { color:#86efac; }
      .ec-avatar-input { display:none; }
    `;
    document.head.appendChild(style);
  }

  function findMount() {
    return document.getElementById('accountPanel') || document.getElementById('profileEmail')?.parentElement || document.getElementById('profileName')?.parentElement;
  }

  function ensureUploader() {
    if (document.getElementById('ecProfileAvatarUpload')) return;
    const mount = findMount();
    if (!mount) return;
    ensureStyles();

    const wrap = document.createElement('div');
    wrap.id = 'ecProfileAvatarUpload';
    wrap.className = 'ec-avatar-upload';
    wrap.innerHTML = `
      <img id="ecProfileAvatarPreview" class="ec-avatar-preview" alt="Profile picture">
      <div class="ec-avatar-actions">
        <label class="ec-avatar-button" for="ecProfileAvatarInput">Change profile picture</label>
        <input id="ecProfileAvatarInput" class="ec-avatar-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
        <div id="ecProfileAvatarStatus" class="ec-avatar-status" aria-live="polite"></div>
      </div>
    `;
    mount.appendChild(wrap);

    const preview = document.getElementById('ecProfileAvatarPreview');
    const input = document.getElementById('ecProfileAvatarInput');
    if (currentAvatarUrl()) preview.src = currentAvatarUrl();
    input.addEventListener('change', () => upload(input.files?.[0]));
  }

  async function upload(file) {
    const status = document.getElementById('ecProfileAvatarStatus');
    const input = document.getElementById('ecProfileAvatarInput');
    const supabase = client();
    if (!status || !supabase) return;

    if (!file) return;
    if (!ALLOWED.has(file.type)) {
      status.textContent = 'Please choose JPG, PNG, WebP, or GIF.';
      status.className = 'ec-avatar-status error';
      input.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      status.textContent = 'Profile pictures must be 5 MB or smaller.';
      status.className = 'ec-avatar-status error';
      input.value = '';
      return;
    }

    const user = await getUser();
    if (!user) {
      status.textContent = 'Please sign in first.';
      status.className = 'ec-avatar-status error';
      return;
    }

    status.textContent = 'Uploading…';
    status.className = 'ec-avatar-status';

    const ext = ({ 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/gif':'gif' })[file.type] || 'jpg';
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true
    });

    if (uploadError) {
      console.error('[Profile Avatar] upload failed:', uploadError);
      status.textContent = uploadError.message || 'Upload failed.';
      status.className = 'ec-avatar-status error';
      return;
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (profileError) {
      console.error('[Profile Avatar] profile update failed:', profileError);
      status.textContent = profileError.message || 'Image uploaded, but profile could not be updated.';
      status.className = 'ec-avatar-status error';
      return;
    }

    setAvatarUrl(avatarUrl);
    const preview = document.getElementById('ecProfileAvatarPreview');
    if (preview) preview.src = avatarUrl;
    status.textContent = 'Profile picture updated.';
    status.className = 'ec-avatar-status ok';
    input.value = '';
  }

  function boot() {
    ensureUploader();
    setAvatarUrl(currentAvatarUrl());
  }

  const observer = new MutationObserver(() => ensureUploader());
  function start() {
    boot();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.EugeneCardProfileAvatar = { upload };
})();
