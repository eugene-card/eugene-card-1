const { json, parseCookie, hash, db, validRedirect, scopes, ISSUER } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  try {
    const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query || {};
    if (response_type !== 'code' || !client_id || !redirect_uri || !state || !code_challenge || code_challenge_method !== 'S256') return json(res, 400, { error: 'invalid_authorization_request' });
    const clients = await db(`oauth_clients?client_id=eq.${encodeURIComponent(client_id)}&is_active=eq.true&select=client_id,redirect_uris,allowed_scopes,client_name`);
    const client = clients?.[0];
    if (!client || !validRedirect(client, redirect_uri)) return json(res, 400, { error: 'invalid_client_or_redirect_uri' });
    const requested = scopes(scope || 'openid profile');
    const allowed = new Set(client.allowed_scopes || []);
    if (requested.some(s => !allowed.has(s))) return json(res, 400, { error: 'invalid_scope' });
    const sid = parseCookie(req, 'ec_oauth_session');
    if (!sid) return res.redirect(`/index.html?oauth=login_required&return_to=${encodeURIComponent(req.url)}`);
    const sessions = await db(`oauth_login_sessions?session_hash=eq.${encodeURIComponent(hash(sid))}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=user_id&limit=1`);
    const session = sessions?.[0];
    if (!session) return res.redirect(`/index.html?oauth=login_required&return_to=${encodeURIComponent(req.url)}`);
    const code = require('./_lib').randomToken(32);
    await db('oauth_authorization_codes', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ code_hash: hash(code), client_id, user_id: session.user_id, redirect_uri, scope: requested.join(' '), code_challenge, code_challenge_method: 'S256', expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() }) });
    const target = new URL(redirect_uri); target.searchParams.set('code', code); target.searchParams.set('state', state);
    return res.redirect(target.toString());
  } catch (e) { console.error(e); return json(res, 500, { error: 'authorization_failed' }); }
};
