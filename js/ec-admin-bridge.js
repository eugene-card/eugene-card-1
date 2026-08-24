/* Eugene Card — shared Supabase bridge for admin sub-pages */
(function () {
  const SUPABASE_URL = 'https://tsjgvzpzfjyecnginipt.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_o3oWlPh_EPj5xd0GBjDWYQ_UhVicSH3';
  const ADMIN_EMAILS = ['eugene.aquila06@gmail.com', 'eugenecard.market@gmail.com'];
  const isAdmin = email => ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());

  function goMarket() {
    if (!location.pathname.endsWith('/index.html') && !location.pathname.endsWith('/')) location.replace('index.html');
  }

  async function boot() {
    if (!window.supabase) return;
    const client = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
    });
    window.supabaseClient = client;
    const { data: { session } } = await client.auth.getSession();
    const user = session && session.user;
    if (!user || !isAdmin(user.email)) { goMarket(); return; }
    window.EUGENE_ADMIN_USER = user;
    document.documentElement.dataset.supabaseAuth = 'admin';
    client.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession?.user || !isAdmin(nextSession.user.email)) goMarket();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
