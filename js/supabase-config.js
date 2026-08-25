// js/supabase-config.js

// Ensure Supabase client initializes with session persistence and URL detection enabled
if (typeof supabase !== 'undefined' && !window.supabaseClient) {
  const SUPABASE_URL = window.SUPABASE_URL || 'https://tsjgvzpzfjyecnginipt.supabase.co';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdG1ndnZwb2p6Zmp5ZWNuZ2luaXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0ODcyNjMsImV4cCI6MjEwMzA2MzI2M30.IdGwR7fxglsni_uncd-roCXCJxoxqfrUtvkHBiudKl0';

  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'ec_supabase_auth_token',
      storage: window.localStorage
    }
  });
}

(function loadEugeneEnhancements(){
  if (window.__eugeneEnhancementsLoaded) return;
  window.__eugeneEnhancementsLoaded = true;
  const load = () => {
    if (document.querySelector('script[data-eugene-enhancements]')) return;
    const s = document.createElement('script');
    s.src = '/js/eugene-enhancements.js?v=20260825';
    s.async = true;
    s.dataset.eugeneEnhancements = '1';
    document.head.appendChild(s);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, {once:true});
  else load();
})();
