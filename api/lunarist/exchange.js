const SUPABASE_URL = 'https://tsjgvzpzfjyecnginipt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_o3oWlPh_EPj5xd0GBjDWYQ_UhVicSH3';
const LUNARIST_TOKEN = 'https://lunaristudio.vercel.app/api/eugene-card/token';
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

  if (!response.ok || !data?.id) {
    return { ok: false, status: response.status || 401 };
  }
  return { ok: true, user: data };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const { code, supabase_access_token } = req.body || {};
    const bearer = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const token = String(supabase_access_token || bearer || '').trim();

    if (!code || !token) {
      return json(res, 400, { error: 'missing_code_or_supabase_access_token' });
    }

    const verification = await verifySupabaseToken(token);
    if (!verification.ok) {
      return json(res, 401, { error: 'eugene_card_supabase_authentication_could_not_be_verified' });
    }

    const upstream = await fetch(LUNARIST_TOKEN, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
        'authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        code: String(code),
        client_id: 'eugene-card',
        redirect_uri: REDIRECT_URI,
        supabase_access_token: token,
        eugene_user_id: verification.user.id
      })
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { error: 'invalid_lunarist_response' }; }
    if (!upstream.ok) return json(res, upstream.status, data);

    if (!data.lunarist_user_id || !data.username || !data.profile_url) {
      return json(res, 502, { error: 'invalid_lunarist_identity_response' });
    }

    return json(res, 200, {
      lunarist_user_id: data.lunarist_user_id,
      username: data.username,
      profile_url: data.profile_url,
      eugene_user_id: verification.user.id
    });
  } catch (error) {
    console.error('Lunarist exchange failed:', error);
    return json(res, 502, { error: 'lunarist_exchange_failed' });
  }
};
