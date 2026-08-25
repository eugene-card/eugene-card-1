(() => {
  const { createClient } = window.supabase;
  const cfg = window.SUPABASE_CONFIG || {};
  if (!cfg.url || cfg.url.startsWith("YOUR_") || !cfg.anonKey || cfg.anonKey.startsWith("YOUR_")) {
    console.warn("Configure js/supabase-config.js before using authentication.");
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
    state.profile = await loadProfile(state.session?.user);
    render();
  }

  $("loginButton").addEventListener("click", async () => {
    $("loginButton").disabled = true;
    $("loginError").textContent = "";

    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });

    if (error) $("loginError").textContent = error.message;
    $("loginButton").disabled = false;
  });

  $("logoutButton").addEventListener("click", async () => {
    await client.auth.signOut();
  });

  client.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.profile = await loadProfile(session?.user);
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
})();
