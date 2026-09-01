const { json, hash, db } = require('./_lib');
module.exports = async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'method_not_allowed'});
  try{
    const body=req.body||{}; const token=String(body.token||'').trim(); if(!token) return json(res,400,{error:'invalid_request'});
    const h=hash(token); const now=new Date().toISOString();
    await db(`oauth_access_tokens?token_hash=eq.${encodeURIComponent(h)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({revoked_at:now})});
    await db(`oauth_refresh_tokens?token_hash=eq.${encodeURIComponent(h)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({revoked_at:now})});
    return json(res,200,{revoked:true});
  }catch(e){console.error(e);return json(res,500,{error:'revoke_failed'});}
};
