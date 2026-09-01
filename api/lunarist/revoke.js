const LUNARIST_REVOKE = 'https://lunaristudio.vercel.app/api/eugene-card/revoke';
function json(res,status,body){res.status(status).setHeader('Cache-Control','no-store').json(body)}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  try{
    const {supabase_access_token}=req.body||{};
    if(!supabase_access_token)return json(res,400,{error:'missing_supabase_access_token'});
    const upstream=await fetch(LUNARIST_REVOKE,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({supabase_access_token:String(supabase_access_token)})});
    const text=await upstream.text();let data;try{data=JSON.parse(text)}catch(_){data={error:'invalid_lunarist_response'}}
    return json(res,upstream.status,data);
  }catch(error){console.error('Lunarist revoke failed:',error);return json(res,502,{error:'lunarist_revoke_failed'})}
};
