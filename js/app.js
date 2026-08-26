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
});