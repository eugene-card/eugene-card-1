const crypto = require('crypto');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsjgvzpzfjyecnginipt.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_o3oWlPh_EPj5xd0GBjDWYQ_UhVicSH3';
const ISSUER = process.env.EUGENE_CARD_OAUTH_ISSUER || 'https://eugene-card-1.vercel.app';
function json(res,status,body,extraHeaders={}){Object.entries({'Cache-Control':'no-store',Pragma:'no-cache',...extraHeaders}).forEach(([k,v])=>res.setHeader(k,v));return res.status(status).json(body);}
function randomToken(bytes=32){return crypto.randomBytes(bytes).toString('base64url');}
function hash(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
function safeEqual(a,b){const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
function basicAuth(req){const h=String(req.headers.authorization||'');if(!/^Basic\s+/i.test(h))return null;const raw=Buffer.from(h.replace(/^Basic\s+/i,''),'base64').toString('utf8'),i=raw.indexOf(':');return i<0?null:{client_id:raw.slice(0,i),client_secret:raw.slice(i+1)};}
function parseCookie(req,name){const raw=String(req.headers.cookie||'');const match=raw.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`));return match?decodeURIComponent(match.slice(name.length+1)):null;}
function cookie(name,value,maxAge){return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;}
async function supabaseUser(accessToken){if(!accessToken)return null;const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`}});if(!r.ok)return null;const u=await r.json();return u?.id?u:null;}
async function db(path,options={}){if(!SUPABASE_SERVICE_ROLE_KEY)throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',...(options.headers||{})}});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch(_){}if(!r.ok)throw new Error(data?.message||data?.error||text||`Supabase ${r.status}`);return data;}
function issueAccessToken(){return randomToken(32);} function issueRefreshToken(){return randomToken(48);} function scopes(value){return String(value||'').trim().split(/\s+/).filter(Boolean);} function validRedirect(client,redirectUri){return Array.isArray(client.redirect_uris)&&client.redirect_uris.includes(redirectUri);}
module.exports={SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,ISSUER,json,randomToken,hash,safeEqual,basicAuth,parseCookie,cookie,supabaseUser,db,issueAccessToken,issueRefreshToken,scopes,validRedirect};
