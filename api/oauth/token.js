const crypto = require('crypto');
const { json, hash, safeEqual, basicAuth, db, issueAccessToken, issueRefreshToken, supabaseUser } = require('./_lib');

function verifyPkce(verifier, challenge) { return safeEqual(crypto.createHash('sha256').update(verifier).digest('base64url'), challenge); }
async function issue(userId, clientId, scope) {
  const access = issueAccessToken(); const refresh = issueRefreshToken();
  const now = Date.now();
  await db('oauth_access_tokens', { method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify({token_hash:hash(access),client_id:clientId,user_id:userId,scope,expires_at:new Date(now+60*60*1000).toISOString()}) });
  await db('oauth_refresh_tokens', { method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify({token_hash:hash(refresh),client_id:clientId,user_id:userId,scope,expires_at:new Date(now+30*24*60*60*1000).toISOString()}) });
  return { access_token:access, token_type:'Bearer', expires_in:3600, refresh_token:refresh, scope };
}
module.exports = async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'method_not_allowed'});
  try{
    const body=req.body||{}; const grant=body.grant_type;
    let clientId=body.client_id; const basic=basicAuth(req); if(basic){clientId=basic.client_id;}
    if(!clientId) return json(res,400,{error:'invalid_client'});
    const clients=await db(`oauth_clients?client_id=eq.${encodeURIComponent(clientId)}&is_active=eq.true&select=client_id,client_secret_hash`); const client=clients?.[0];
    if(!client) return json(res,401,{error:'invalid_client'});
    if(client.client_secret_hash && basic && !safeEqual(hash(basic.client_secret),client.client_secret_hash)) return json(res,401,{error:'invalid_client'});
    if(grant==='authorization_code'){
      const code=String(body.code||''), verifier=String(body.code_verifier||''), redirect=String(body.redirect_uri||'');
      if(!code||!verifier||!redirect) return json(res,400,{error:'invalid_request'});
      const rows=await db(`rpc/consume_oauth_authorization_code`,{method:'POST',body:JSON.stringify({p_code_hash:hash(code)})});
      const auth=rows?.[0]; if(!auth || auth.client_id!==clientId || auth.redirect_uri!==redirect || !verifyPkce(verifier,auth.code_challenge)) return json(res,400,{error:'invalid_grant'});
      return json(res,200,await issue(auth.user_id,clientId,auth.scope));
    }
    if(grant==='refresh_token'){
      const rt=String(body.refresh_token||''); if(!rt) return json(res,400,{error:'invalid_request'});
      const rows=await db(`oauth_refresh_tokens?token_hash=eq.${encodeURIComponent(hash(rt))}&client_id=eq.${encodeURIComponent(clientId)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,user_id,scope&limit=1`); const old=rows?.[0];
      if(!old) return json(res,400,{error:'invalid_grant'});
      await db(`oauth_refresh_tokens?id=eq.${old.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({revoked_at:new Date().toISOString()})});
      return json(res,200,await issue(old.user_id,clientId,old.scope));
    }
    return json(res,400,{error:'unsupported_grant_type'});
  }catch(e){console.error('OAuth token error',e);return json(res,500,{error:'token_endpoint_failed'});}
};
