const SUPABASE_URL = 'https://tsjgvzpzfjyecnginipt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_o3oWlPh_EPj5xd0GBjDWYQ_UhVicSH3';
const LUNARIST_TOKEN = 'https://lunaristudio.vercel.app/oauth/token';
const LUNARIST_USERINFO = 'https://lunaristudio.vercel.app/oauth/userinfo';
const CLIENT_ID = 'eugene-card';
const REDIRECT_URI = 'https://eugene-card-1.vercel.app/?connect=lunarist';

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

async function verifySupabaseToken(token) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch (_) { data = null; }
  if (!response.ok || !data?.id) return { ok: false, status: response.status || 401 };
  return { ok: true, user: data };
}

async function syncLink(token, eugeneUserId, identity) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/lunarist_links?on_conflict=eugene_user_id`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify({
      eugene_user_id: eugeneUserId,
      lunarist_user_id: String(identity.lunarist_user_id || identity.sub || identity.user_id),
      lunarist_username: String(identity.username || identity.preferred_username || identity.name),
      lunarist_profile_url: identity.profile_url || identity.profile || null,
      sync_source: 'lunarist',
      last_synced_at: new Date().toISOString(),
      metadata: {
        issuer: 'https://lunaristudio.vercel.app',
        scopes: identity.scope || 'identity profile offline_access'
      }
    })
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch (_) { data = null; }
  if (!response.ok) throw Error(data?.message || data?.hint || 'supabase_lunarist_link_sync_failed');
  return Array.isArray(data) ? data[0] : data;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const body = req.body || {};
    const code = String(body.code || '').trim();
    const codeVerifier = String(body.code_verifier || '').trim();
    const bearer = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const token = String(body.supabase_access_token || bearer || '').trim();

    if (!code || !codeVerifier || !token) {
      return json(res, 400, { error: 'missing_code_code_verifier_or_supabase_access_token' });
    }

    const verification = await verifySupabaseToken(token);
    if (!verification.ok) {
      return json(res, 401, { error: 'eugene_card_supabase_authentication_could_not_be_verified' });
    }

    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier
    });

    const upstream = await fetch(LUNARIST_TOKEN, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json'
      },
      body: form.toString()
    });

    const text = await upstream.text();
    let tokenData;
    try { tokenData = JSON.parse(text); } catch (_) { tokenData = null; }
    if (!upstream.ok || !tokenData?.access_token) {
      return json(res, upstream.status || 502, tokenData || { error: 'lunarist_token_exchange_failed' });
    }

    const userinfo = await fetch(LUNARIST_USERINFO, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${tokenData.access_token}`
      }
    });
    const userText = await userinfo.text();
    let identity;
    try { identity = JSON.parse(userText); } catch (_) { identity = null; }
    if (!userinfo.ok || !identity || !(identity.lunarist_user_id || identity.sub || identity.user_id) || !(identity.username || identity.preferred_username || identity.name)) {
      return json(res, userinfo.status || 502, { error: 'invalid_lunarist_identity_response' });
    }

    const link = await syncLink(token, verification.user.id, identity);

    return json(res, 200, {
      eugene_user_id: verification.user.id,
      lunarist_user_id: link?.lunarist_user_id || identity.lunarist_user_id || identity.sub || identity.user_id,
      username: link?.lunarist_username || identity.username || identity.preferred_username || identity.name,
      profile_url: link?.lunarist_profile_url || identity.profile_url || identity.profile || null,
      synced_at: link?.last_synced_at || new Date().toISOString()
    });
  } catch (error) {
    console.error('Lunarist exchange failed:', error);
    return json(res, 502, { error: error.message || 'lunarist_exchange_failed' });
  }
};
