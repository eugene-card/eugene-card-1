/* Force Eugene Card's default UI language to English (EN). */
(function () {
  'use strict';
  const KEYS = ['language', 'lang', 'locale', 'preferredLanguage', 'ec-language'];
  function forceEnglish() {
    try { document.documentElement.lang = 'en'; } catch (_) {}
    try {
      KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if (!v || /^(id|id-id|ind|indonesian|bahasa indonesia)$/i.test(v)) localStorage.setItem(k, 'en');
      });
    } catch (_) {}
    ['setLanguage', 'changeLanguage', 'switchLanguage', 'setLocale', 'changeLocale'].forEach(name => {
      try { if (typeof window[name] === 'function') window[name]('en'); } catch (_) {}
    });
    document.querySelectorAll('select').forEach(select => {
      const option = [...select.options].find(o => /^(en|en-us|english)$/i.test(o.value) || /^(english|en)$/i.test(o.textContent.trim()));
      if (option && /^(id|id-id|ind|indonesian|bahasa indonesia)$/i.test(select.value)) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    document.querySelectorAll('button,a,[role="button"]').forEach(el => {
      const text = (el.textContent || '').trim().toLowerCase();
      const value = (el.getAttribute('data-language') || el.getAttribute('data-lang') || el.getAttribute('value') || '').toLowerCase();
      if (value === 'en' || value === 'english' || text === 'english' || text === 'en') {
        const parent = el.closest('[class*="language" i],[id*="language" i],[class*="lang" i],[id*="lang" i]');
        if (parent && !el.disabled) {
          try { el.click(); } catch (_) {}
        }
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', forceEnglish, { once: true });
  else forceEnglish();
  window.addEventListener('load', forceEnglish, { once: true });
  const observer = new MutationObserver(() => { if (document.documentElement.lang !== 'en') forceEnglish(); });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  // -----------------------------------------------------------------------
  // Eugene Card <-> Lunarist OAuth client
  // Public client: authorization-code + S256 PKCE.  No client secret is
  // stored in or sent by the browser.
  // -----------------------------------------------------------------------
  const OAUTH = Object.freeze({
    authorize: 'https://lunaristudio.vercel.app/oauth/authorize',
    clientId: 'eugene-card',
    redirectUri: 'https://eugene-card-1.vercel.app/?connect=lunarist',
    scope: 'openid profile email offline_access identity',
    verifierKey: 'eugene_lunarist_pkce_verifier',
    stateKey: 'eugene_lunarist_oauth_state',
    startedKey: 'eugene_lunarist_oauth_pending',
    consumedKey: 'eugene_lunarist_oauth_code_consumed'
  });

  function randomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  function base64Url(bytes) {
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function randomString(length = 48) {
    return base64Url(randomBytes(length)).slice(0, length);
  }

  async function sha256Base64Url(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return base64Url(new Uint8Array(digest));
  }

  function query() {
    return new URLSearchParams(window.location.search);
  }

  function isOAuthEntry() {
    const p = query();
    return p.get('connect') === 'lunarist' && p.get('oauth_start') === '1';
  }

  function cleanOAuthUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('oauth_start');
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '') + url.hash);
  }

  function toast(message) {
    try {
      if (typeof window.showToast === 'function') window.showToast(message);
    } catch (_) {}
  }

  async function getSupabaseSession() {
    try {
      const client = window.supabaseClient;
      if (!client?.auth) return null;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data?.session || null;
    } catch (error) {
      console.warn('[Lunarist OAuth] Could not read Eugene session:', error);
      return null;
    }
  }

  async function startLunaristAuthorization() {
    if (sessionStorage.getItem(OAUTH.startedKey) === '1') return;

    const session = await getSupabaseSession();
    if (!session?.access_token) {
      sessionStorage.setItem(OAUTH.startedKey, '1');
      sessionStorage.setItem(OAUTH.startedKey + '_needs_login', '1');
      try {
        if (typeof window.openAuthModal === 'function') window.openAuthModal();
      } catch (_) {}
      toast('Please log in to Eugene Card first.');
      return;
    }

    const verifier = randomString(64);
    const state = randomString(32);
    const challenge = await sha256Base64Url(verifier);

    sessionStorage.setItem(OAUTH.verifierKey, verifier);
    sessionStorage.setItem(OAUTH.stateKey, state);
    sessionStorage.setItem(OAUTH.startedKey, '1');
    sessionStorage.removeItem(OAUTH.consumedKey);

    const authorizeUrl = new URL(OAUTH.authorize);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', OAUTH.clientId);
    authorizeUrl.searchParams.set('redirect_uri', OAUTH.redirectUri);
    authorizeUrl.searchParams.set('scope', OAUTH.scope);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('code_challenge', challenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');

    window.location.assign(authorizeUrl.toString());
  }

  async function exchangeLunaristCode(code, returnedState) {
    if (sessionStorage.getItem(OAUTH.consumedKey) === code) return;

    const expectedState = sessionStorage.getItem(OAUTH.stateKey);
    const verifier = sessionStorage.getItem(OAUTH.verifierKey);
    if (!expectedState || returnedState !== expectedState) {
      throw new Error('lunarist_oauth_state_mismatch');
    }
    if (!verifier) throw new Error('lunarist_oauth_pkce_verifier_missing');

    const session = await getSupabaseSession();
    if (!session?.access_token) throw new Error('eugene_card_login_required');

    sessionStorage.setItem(OAUTH.consumedKey, code);

    const response = await fetch('/api/lunarist/exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        code,
        code_verifier: verifier
      })
    });

    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}
    if (!response.ok) {
      sessionStorage.removeItem(OAUTH.consumedKey);
      throw new Error(data?.error || data?.message || `lunarist_exchange_http_${response.status}`);
    }
    if (!data?.lunarist_user_id) {
      sessionStorage.removeItem(OAUTH.consumedKey);
      throw new Error('lunarist_identity_missing');
    }

    sessionStorage.removeItem(OAUTH.verifierKey);
    sessionStorage.removeItem(OAUTH.stateKey);
    sessionStorage.removeItem(OAUTH.startedKey);
    sessionStorage.removeItem(OAUTH.startedKey + '_needs_login');

    cleanOAuthUrl();
    toast(`Lunarist connected as @${data.username || 'user'}.`);
    return data;
  }

  async function handleLunaristOAuth() {
    const p = query();
    const code = p.get('code');
    const returnedState = p.get('state');
    const oauthError = p.get('error');

    if (oauthError) {
      console.error('[Lunarist OAuth] Authorization failed:', oauthError, p.get('error_description') || '');
      sessionStorage.removeItem(OAUTH.startedKey);
      sessionStorage.removeItem(OAUTH.startedKey + '_needs_login');
      toast(`Lunarist authorization failed: ${oauthError}`);
      cleanOAuthUrl();
      return;
    }

    if (code) {
      try {
        await exchangeLunaristCode(code, returnedState);
      } catch (error) {
        console.error('[Lunarist OAuth] Code exchange failed:', error);
        toast(`Lunarist connection failed: ${error.message}`);
      }
      return;
    }

    if (isOAuthEntry()) {
      await startLunaristAuthorization();
    }
  }

  function installOAuthListeners() {
    if (window.__eugeneLunaristOAuthInstalled) return;
    window.__eugeneLunaristOAuthInstalled = true;

    // The explicit entry URL is handled after the existing app initialization
    // has had a chance to create window.supabaseClient.
    const run = () => setTimeout(() => handleLunaristOAuth().catch(error => {
      console.error('[Lunarist OAuth] Handler failed:', error);
      toast(`Lunarist connection failed: ${error.message}`);
    }), 50);

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();

    // If the entry URL arrived before the Eugene Supabase session finished
    // restoring, resume automatically as soon as the authenticated session exists.
    const client = window.supabaseClient;
    if (client?.auth) {
      client.auth.onAuthStateChange((_event, session) => {
        if (session?.access_token && sessionStorage.getItem(OAUTH.startedKey + '_needs_login') === '1') {
          sessionStorage.removeItem(OAUTH.startedKey + '_needs_login');
          sessionStorage.removeItem(OAUTH.startedKey);
          setTimeout(() => startLunaristAuthorization().catch(console.error), 100);
        }
      });
    }
  }

  installOAuthListeners();
})();
