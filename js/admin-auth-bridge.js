// Shared admin authorization + database bridge for secondary HTML pages.
(function () {
  const client = window.supabaseClient || window.supabase?.createClient?.(window.SUPABASE_CONFIG?.url, window.SUPABASE_CONFIG?.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  if (!client) return;
  window.supabaseClient = client;
  const ADMINS = new Set(['eugene.aquila06@gmail.com', 'eugenecard.market@gmail.com']);
  const OP_MAP = { '==':'eq','!=':'neq','>':'gt','>=':'gte','<':'lt','<=':'lte' };
  const newId=()=>window.crypto?.randomUUID?crypto.randomUUID():`id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const normalizeEmail=u=>String(u?.email||u?.user_metadata?.email||'').trim().toLowerCase();
  async function isAdmin(user){
    if(!user)return false;
    if(ADMINS.has(normalizeEmail(user)))return true;
    try{const {data,error}=await client.from('profiles').select('role').eq('id',user.id||user.uid).maybeSingle();return !error&&String(data?.role||'').trim().toLowerCase()==='admin';}catch(_){return false;}
  }
  function setCommandCenterHealth(authorized,user){
    const el=document.getElementById('admin-status');
    if(!el)return;
    el.textContent=authorized?'VERIFIED':'UNAUTHORIZED';
    el.className='text-[10px] font-black '+(authorized?'text-emerald-400':'text-rose-400');
    const box=document.getElementById('auth-state');
    if(box&&authorized&&user)box.innerHTML='<div class="glass rounded-2xl p-4 text-sm text-emerald-300">Admin session verified: <b>'+String(normalizeEmail(user)).replace(/[&<>"\']/g,'')+'</b></div>';
  }
  window.EugeneCardAdmin={admins:[...ADMINS],async validate(user){return isAdmin(user||(await client.auth.getUser()).data?.user)},async getUser(){return (await client.auth.getUser()).data?.user||null},async requireAdmin(){const u=await this.getUser();if(!(await isAdmin(u)))throw new Error('Admin access required. Please sign in with an approved admin account.');return u;}};
  function rowSnapshot(c,row){return{id:row.id,exists:true,data:()=>row.data,ref:makeDocRef(c,row.id)}}
  function missingSnapshot(c,id){return{id,exists:false,data:()=>undefined,ref:makeDocRef(c,id)}}
  function watchCollection(c,reload){const ch=client.channel(`secondary-docs:${c}:${newId()}`).on('postgres_changes',{event:'*',schema:'public',table:'documents',filter:`collection=eq.${c}`},reload).subscribe();return()=>client.removeChannel(ch)}
  function makeDocRef(c,id){return{id,collectionName:c,async get(){const{data,error}=await client.from('documents').select('*').eq('collection',c).eq('id',id).maybeSingle();if(error)throw error;return data?rowSnapshot(c,data):missingSnapshot(c,id)},async set(payload,opts={}){let data=payload||{};if(opts.merge){const e=await this.get();data={...(e.exists?e.data():{}),...data}}const{error}=await client.from('documents').upsert({collection:c,id,data,updated_at:new Date().toISOString()},{onConflict:'collection,id'});if(error)throw error},async update(payload){const e=await this.get();const data={...(e.exists?e.data():{}),...(payload||{})};const{error}=await client.from('documents').upsert({collection:c,id,data,updated_at:new Date().toISOString()},{onConflict:'collection,id'});if(error)throw error},async delete(){const{error}=await client.from('documents').delete().eq('collection',c).eq('id',id);if(error)throw error},onSnapshot(cb,onError){this.get().then(cb).catch(e=>onError?.(e));return watchCollection(c,()=>this.get().then(cb).catch(e=>onError?.(e)))}}
  function makeQuery(c,filters=[],order=null,limitN=null){return{where(f,o,v){return makeQuery(c,[...filters,{field:f,op:o,value:v}],order,limitN)},orderBy(f,d='asc'){return makeQuery(c,filters,{field:f,direction:d},limitN)},limit(n){return makeQuery(c,filters,order,n)},async get(){let q=client.from('documents').select('*').eq('collection',c);for(const f of filters)q=q.filter(`data->>${f.field}`,OP_MAP[f.op]||'eq',String(f.value));const{data,error}=await q;if(error)throw error;let rows=data||[];if(order)rows=rows.slice().sort((a,b)=>{const av=a.data?.[order.field],bv=b.data?.[order.field];if(av===bv)return 0;const cmp=av>bv?1:-1;return order.direction==='desc'?-cmp:cmp});if(limitN)rows=rows.slice(0,limitN);const docs=rows.map(r=>rowSnapshot(c,r));return{docs,empty:!docs.length,size:docs.length,forEach:fn=>docs.forEach(fn)}},onSnapshot(cb,onError){this.get().then(cb).catch(e=>onError?.(e));return watchCollection(c,()=>this.get().then(cb).catch(e=>onError?.(e)))}}}
  function makeCollectionRef(c){return Object.assign(makeQuery(c),{doc(id){return makeDocRef(c,id||newId())},async add(p){const r=makeDocRef(c,newId());await r.set(p);return r}})}
  window.db={collection(c){return makeCollectionRef(c)},batch(){const ops=[];return{set(r,d,o){ops.push(()=>r.set(d,o));return this},update(r,d){ops.push(()=>r.update(d));return this},delete(r){ops.push(()=>r.delete());return this},async commit(){for(const op of ops)await op()}}}};
  const existingAuth=window.auth||{};
  window.auth={...existingAuth,onAuthStateChanged(callback){let stopped=false,lastUserId=null,lastAuthorized=null;const emit=async user=>{if(stopped)return;if(!user){lastUserId=null;lastAuthorized=false;setCommandCenterHealth(false,null);callback(null);return}const userId=user.id||user.uid||null;if(!userId){callback(user);return}const authorized=await isAdmin(user);if(stopped)return;setCommandCenterHealth(authorized,user);if(userId===lastUserId&&authorized===lastAuthorized)return;lastUserId=userId;lastAuthorized=authorized;callback(authorized?{...user,id:userId,uid:userId,isAdmin:true,role:'admin'}:user)};client.auth.getSession().then(({data})=>emit(data?.session?.user||null)).catch(e=>{console.error('Supabase session restore failed:',e);callback(null)});const{data}=client.auth.onAuthStateChange((_e,s)=>emit(s?.user||null));return()=>{stopped=true;data?.subscription?.unsubscribe()}}};
  // The command center's inline auth check runs before this bridge. Re-check after load so a valid session is not left displayed as UNAUTHORIZED.
  setTimeout(async()=>{try{const u=(await client.auth.getUser()).data?.user;setCommandCenterHealth(await isAdmin(u),u)}catch(_){ }},0);
})();
