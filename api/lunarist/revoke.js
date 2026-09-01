const SUPABASE_URL = 'https://tsjgvzpzfjyecnginipt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_o3oWlPh_EPj5xd0GBjDWYQ_UhVicSH3';

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

async function verifySupabaseToken(token) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch (_) { data = null; }
  return response.ok && data?.id ? data : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  try {
    const { supabase_access_token } = req.body || {};
    const bearer = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const token = String(supabase_access_token || bearer || '').trim();
    if (!token) return json(res, 401, { error: 'missing_supabase_access_token' });

    const user = await verifySupabaseToken(token);
    if (!user) return json(res, 401, { error: 'eugene_card_supabase_authentication_could_not_be_verified' });

    const base = `${SUPABASE_URL}/rest/v1`;
    const headers = {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    };

    const response = await fetch(`${base}/lunarist_links?eugene_user_id=eq.${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('Failed to delete Lunarist link:', response.status, text);
      return json(res, 502, { error: 'lunarist_link_revoke_failed' });
    }

    return json(res, 200, { ok: true, disconnected: true, eugene_user_id: user.id });
  } catch (error) {
    console.error('Lunarist revoke failed:', error);
    return json(res, 502, { error: 'lunarist_revoke_failed' });
  }
};
