const LUNARIST_TOKEN = 'https://lunaristudio.vercel.app/api/eugene-card/token';
const REDIRECT_URI = 'https://eugene-card-1.vercel.app/?connect=lunarist';

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  try {
    const { code, supabase_access_token } = req.body || {};
    if (!code || !supabase_access_token) {
      return json(res, 400, { error: 'missing_code_or_supabase_access_token' });
    }

    const upstream = await fetch(LUNARIST_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify({
        code: String(code),
        client_id: 'eugene-card',
        redirect_uri: REDIRECT_URI,
        supabase_access_token: String(supabase_access_token)
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
      profile_url: data.profile_url
    });
  } catch (error) {
    console.error('Lunarist exchange failed:', error);
    return json(res, 502, { error: 'lunarist_exchange_failed' });
  }
};
