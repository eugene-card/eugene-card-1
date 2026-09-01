const { json, randomToken, hash, cookie, supabaseUser, db } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  try {
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const user = await supabaseUser(bearer);
    if (!user) return json(res, 401, { error: 'invalid_eugene_card_session' });
    const sid = randomToken(32);
    await db('oauth_login_sessions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ session_hash: hash(sid), user_id: user.id, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() }) });
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookie('ec_oauth_session', sid, 600) });
  } catch (e) {
    console.error(e); return json(res, 500, { error: 'oauth_session_failed' });
  }
};
