const { json, hash, db, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = require('./_lib');
module.exports = async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{error:'method_not_allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim(); if(!token) return json(res,401,{error:'invalid_token'});
    const rows=await db(`oauth_access_tokens?token_hash=eq.${encodeURIComponent(hash(token))}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=user_id,scope&limit=1`); const t=rows?.[0];
    if(!t) return json(res,401,{error:'invalid_token'});
    const profiles=await db(`profiles?id=eq.${encodeURIComponent(t.user_id)}&select=id,username,display_name,avatar_url,bio&limit=1`); const p=profiles?.[0]||{};
    let email=null;
    if(SUPABASE_SERVICE_ROLE_KEY){const r=await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(t.user_id)}`,{headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`}});if(r.ok){const u=await r.json();email=u?.email||null;}}
    return json(res,200,{sub:t.user_id,email,preferred_username:p.username||null,name:p.display_name||p.username||null,picture:p.avatar_url||null,bio:p.bio||null,scope:t.scope});
  }catch(e){console.error(e);return json(res,500,{error:'userinfo_failed'});}
};
