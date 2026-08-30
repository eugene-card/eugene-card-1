document.addEventListener("DOMContentLoaded", () => {
  const { createClient } = window.supabase || {};
  const cfg = window.SUPABASE_CONFIG || {};
  const loginButton = document.getElementById("loginButton");
  const loginError = document.getElementById("loginError");

  if (!createClient || !cfg.url || cfg.url.startsWith("YOUR_") || !cfg.anonKey || cfg.anonKey.startsWith("YOUR_")) {
    if (loginButton) loginButton.disabled = true;
    if (loginError) loginError.textContent = "Supabase is not configured. Add your Supabase URL and anon/publishable key to js/supabase-config.js.";
    console.error("Supabase configuration missing.");
    return;
  }

  const client = createClient(cfg.url, cfg.anonKey);
  window.supabaseClient = client;

  const $ = (id) => document.getElementById(id);
  const state = { session: null, profile: null };

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  async function loadProfile(user) {
    if (!user) return null;
    const { data, error } = await client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Profile load failed:", error);
      return null;
    }
    if (data) return data;

    const fallback = {
      id: user.id,
      email: user.email,
      username: (user.email || "user").split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30) || "user",
      display_name: user.user_metadata?.full_name || user.user_metadata?.name || (user.email || "User").split("@")[0]
    };

    const { data: created, error: createError } = await client
      .from("profiles")
      .insert(fallback)
      .select("*")
      .single();

    if (createError) {
      console.warn("Profile creation failed. Create a profiles table/policy or adjust its columns.", createError);
      return fallback;
    }
    return created;
  }

  function render() {
    const loggedIn = !!state.session;
    $("authStatus").innerHTML = loggedIn
      ? `<span class="status-dot"></span> Signed in as ${escapeHtml(state.profile?.display_name || state.session.user.email)}`
      : `<span class="status-dot guest"></span> Guest`;

    $("loginPanel").hidden = loggedIn;
    $("accountPanel").hidden = !loggedIn;
    $("loginButton").hidden = loggedIn;
    $("logoutButton").hidden = !loggedIn;

    if (loggedIn) {
      $("profileName").textContent = state.profile?.display_name || "User";
      $("profileUsername").textContent = state.profile?.username ? "@" + state.profile.username : "";
      $("profileEmail").textContent = state.session.user.email || "";
    }
  }

  async function refreshSession() {
    const { data, error } = await client.auth.getSession();
    if (error) console.error(error);
    state.session = data?.session || null;
    try {
      state.profile = await loadProfile(state.session?.user);
    } catch (e) {
      console.warn("Profile load skipped:", e);
      state.profile = state.session?.user ? {
        id: state.session.user.id,
        email: state.session.user.email,
        role: "user",
        display_name: state.session.user.user_metadata?.full_name || state.session.user.email?.split("@")[0] || "User"
      } : null;
    }
    if (state.profile && !state.profile.role) state.profile.role = "user";
    render();
  }

  if (!loginButton) {
    console.error("Google login button not found.");
  } else {
    loginButton.addEventListener("click", async () => {
      loginButton.disabled = true;
      if (loginError) loginError.textContent = "Opening Google…";

      try {
        const redirectTo = window.location.origin + window.location.pathname;
        const { data, error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            queryParams: { access_type: "offline", prompt: "select_account" }
          }
        });

        if (error) throw error;
        if (data?.url) window.location.assign(data.url);
      } catch (error) {
        console.error("Google login failed:", error);
        if (loginError) loginError.textContent = error?.message || "Google login could not be started.";
        loginButton.disabled = false;
      }
    });
  }

  $("logoutButton").addEventListener("click", async () => {
    await client.auth.signOut();
  });

  client.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    try {
      state.profile = await loadProfile(session?.user);
    } catch (e) {
      console.warn("Profile load skipped:", e);
      state.profile = session?.user ? {
        id: session.user.id,
        email: session.user.email,
        role: "user",
        display_name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "User"
      } : null;
    }
    if (state.profile && !state.profile.role) state.profile.role = "user";
    render();
  });

  window.EugeneCardAuth = {
    client,
    get session() { return state.session; },
    get user() { return state.session?.user || null; },
    get profile() { return state.profile; },
    requireAuth() {
      if (!state.session) {
        alert("Please log in first.");
        return false;
      }
      return true;
    }
  };

  refreshSession();

  // -----------------------------------------------------------------------
  // Social post interaction repair
  // The social feed can be rendered/re-rendered dynamically, so delegated
  // handlers are used instead of binding once to the initial DOM.
  // -----------------------------------------------------------------------
  let socialBusy = false;

  async function getSocialUser() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }

  function socialPostId(el) {
    const article = el?.closest?.('[data-post]');
    return el?.dataset?.socialLike || el?.dataset?.socialRepost || el?.dataset?.post || article?.dataset?.post || null;
  }

  function socialToast(message, error = false) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const node = document.createElement('div');
    node.className = `toast${error ? ' error' : ''}`;
    node.textContent = message;
    root.appendChild(node);
    setTimeout(() => node.remove(), 2800);
  }

  async function refreshSocialPost(postId) {
    const { data: likes, error: likeError } = await client
      .from('post_likes')
      .select('user_id')
      .eq('post_id', postId);
    if (likeError) throw likeError;

    const count = likes?.length || 0;
    document.querySelectorAll(`[data-like-count="${CSS.escape(postId)}"]`).forEach(el => {
      el.textContent = String(count);
    });

    const user = await getSocialUser();
    const liked = !!user && (likes || []).some(row => row.user_id === user.id);
    document.querySelectorAll(`[data-social-like="${CSS.escape(postId)}"]`).forEach(btn => {
      btn.classList.toggle('liked', liked);
      btn.setAttribute('aria-pressed', String(liked));
    });
  }

  async function handleSocialLike(button) {
    if (socialBusy) return;
    const postId = socialPostId(button);
    if (!postId) return;
    const user = await getSocialUser();
    if (!user) {
      socialToast('Log in to like posts', true);
      return;
    }

    socialBusy = true;
    button.disabled = true;
    try {
      const { data: existing, error: readError } = await client
        .from('post_likes')
        .select('post_id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (readError) throw readError;

      if (existing) {
        const { error } = await client.from('post_likes').delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await client.from('post_likes').upsert(
          { post_id: postId, user_id: user.id },
          { onConflict: 'post_id,user_id', ignoreDuplicates: true }
        );
        if (error) throw error;
      }
      await refreshSocialPost(postId);
    } catch (error) {
      console.error('Social like failed:', error);
      socialToast(error?.message || 'Could not update like.', true);
    } finally {
      socialBusy = false;
      button.disabled = false;
    }
  }

  async function handleSocialRepost(button) {
    if (socialBusy) return;
    const postId = socialPostId(button);
    if (!postId) return;
    const user = await getSocialUser();
    if (!user) {
      socialToast('Log in to repost', true);
      return;
    }

    socialBusy = true;
    button.disabled = true;
    try {
      const { data: original, error: readError } = await client
        .from('posts')
        .select('id,content,image_url')
        .eq('id', postId)
        .maybeSingle();
      if (readError) throw readError;
      if (!original) throw new Error('Post no longer exists.');

      const { error } = await client.from('posts').insert({
        author_id: user.id,
        content: `Reposted: ${String(original.content || '').slice(0, 500)}`,
        image_url: original.image_url || null,
        repost_of: original.id
      });
      if (error) throw error;

      socialToast('Reposted');
      window.dispatchEvent(new CustomEvent('eugene:social-refresh'));
    } catch (error) {
      console.error('Social repost failed:', error);
      socialToast(error?.message || 'Could not repost.', true);
    } finally {
      socialBusy = false;
      button.disabled = false;
    }
  }

  async function handleSocialComment(form) {
    if (socialBusy) return;
    const postId = form.dataset.commentForm || form.closest('[data-post]')?.dataset?.post;
    if (!postId) return;
    const user = await getSocialUser();
    if (!user) {
      socialToast('Log in to comment', true);
      return;
    }

    const input = form.querySelector('[name="content"]');
    const content = String(input?.value || '').trim();
    if (!content) return;

    socialBusy = true;
    const submit = form.querySelector('button[type="submit"], button');
    if (submit) submit.disabled = true;
    try {
      const { error } = await client.from('post_comments').insert({
        post_id: postId,
        author_id: user.id,
        content
      });
      if (error) throw error;
      if (input) input.value = '';
      socialToast('Comment posted');
      window.dispatchEvent(new CustomEvent('eugene:social-refresh'));
    } catch (error) {
      console.error('Social comment failed:', error);
      socialToast(error?.message || 'Could not post comment.', true);
    } finally {
      socialBusy = false;
      if (submit) submit.disabled = false;
    }
  }

  document.addEventListener('click', (event) => {
    const like = event.target.closest?.('[data-social-like]');
    if (like) {
      event.preventDefault();
      event.stopPropagation();
      handleSocialLike(like);
      return;
    }

    const repost = event.target.closest?.('[data-social-repost]');
    if (repost) {
      event.preventDefault();
      event.stopPropagation();
      handleSocialRepost(repost);
      return;
    }

    const article = event.target.closest?.('[data-post]');
    if (article) {
      const button = event.target.closest?.('button');
      const label = String(button?.textContent || '').trim().toLowerCase();
      if (button && !button.dataset.socialLike && !button.dataset.socialRepost && /^(♥|♡)?\s*like/.test(label)) {
        event.preventDefault();
        event.stopPropagation();
        button.dataset.socialLike = article.dataset.post;
        handleSocialLike(button);
      }
      if (button && !button.dataset.socialRepost && /repost/.test(label)) {
        event.preventDefault();
        event.stopPropagation();
        button.dataset.socialRepost = article.dataset.post;
        handleSocialRepost(button);
      }
      if (button && /comment/.test(label) && !button.dataset.socialCommentFocus) {
        const input = article.querySelector('[data-comment-form] input[name="content"], .comment-form input[name="content"]');
        if (input) {
          event.preventDefault();
          input.focus();
          button.dataset.socialCommentFocus = '1';
        }
      }
    }
  }, true);

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('[data-comment-form], .comment-form');
    if (!form) return;
    event.preventDefault();
    event.stopPropagation();
    handleSocialComment(form);
  }, true);

  // Expose a small refresh hook for any existing feed renderer. If it does
  // not listen for the event, the interaction itself still persists normally.
  window.EugeneCardSocial = {
    like: handleSocialLike,
    repost: handleSocialRepost,
    comment: handleSocialComment,
    refreshPost: refreshSocialPost
  };
});
