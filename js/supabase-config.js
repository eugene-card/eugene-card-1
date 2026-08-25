// js/supabase-config.js

// Ensure Supabase client initializes with session persistence and URL detection enabled
if (typeof supabase !== 'undefined' && !window.supabaseClient) {
  const SUPABASE_URL = window.SUPABASE_URL || 'https://tsjgvzpzfjyecnginipt.supabase.co';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzamd2enB6Zmp5ZWNuZ2luaXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0ODcyNjMsImV4cCI6MjEwMzA2MzI2M30.IdGwR7fxglsni_uncd-roCXCJxoxqfrUtvkHBiudKl0';

  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // MUST be true to capture auth redirects/tokens
      storageKey: 'ec_supabase_auth_token',
      storage: window.localStorage
    }
  });
}