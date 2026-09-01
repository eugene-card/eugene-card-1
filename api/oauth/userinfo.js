const { json, hash, db } = require('./_lib');
module.exports = async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{error:'method_not_allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim(); if(!token) return json(res,401,{error:'invalid_token'});
    const rows=await db(`oauth_access_tokens?token_hash=eq.${encodeURIComponent(hash(token))}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=user_id,scope&limit=1`); const t=rows?.[0];
    if(!t) return json(res,401,{error:'invalid_token'});
    const profiles=await db(`profiles?id=eq.${encodeURIComponent(t.user_id)}&select=id,username,display_name,avatar_url,bio&limit=1`); const p=profiles?.[0]||{};
    const users=await db(`auth.users?id=eq.${encodeURIComponent(t.user_id)}&select=id,email`); const u=users?.[0]||{};
    return json(res,200,{sub:t.user_id,email:u.email||null,preferred_username:p.username||null,name:p.display_name||p.username||null,picture:p.avatar_url||null,bio:p.bio||null});
  }catch(e){console.error(e);return json(res,500,{error:'userinfo_failed'});}
};
