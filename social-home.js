(() => {
  'use strict';
  const SUPABASE_URL='https://tsjgvzpzfjyecnginipt.supabase.co';
  const SUPABASE_KEY='sb_publishable_o3oWlPh_EPj5xd0GBjDWYQ_UhVicSH3';
  const socialSb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'eugene-card-supabase-auth'}});
  let socialUser=null,posts=[],profiles=new Map(),likes=new Set(),comments=new Map(),channel=null,refreshTimer=null,rendering=false;
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const ago=iso=>{const s=Math.max(0,(Date.now()-new Date(iso).getTime())/1000);if(s<60)return `${Math.floor(s)}s`;if(s<3600)return `${Math.floor(s/60)}m`;if(s<86400)return `${Math.floor(s/3600)}h`;if(s<604800)return `${Math.floor(s/86400)}d`;return new Date(iso).toLocaleDateString()};
  const avatar=p=>p?.avatar_url||`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p?.display_name||p?.username||'Collector')}`;
  function toast(msg,error=false){const d=document.createElement('div');d.className='toast'+(error?' error':'');d.textContent=msg;document.getElementById('toast-root')?.appendChild(d);setTimeout(()=>d.remove(),3000)}
  async function session(){const r=await socialSb.auth.getSession();socialUser=r.data.session?.user||null;return socialUser}
  async function load(){
    const pr=await socialSb.from('posts').select('*').order('created_at',{ascending:false}).limit(100);
    if(pr.error){console.error(pr.error);return}
    posts=pr.data||[];
    const authorIds=[...new Set(posts.flatMap(p=>[p.author_id,p.repost_of]).filter(Boolean))];
    if(authorIds.length){const prof=await socialSb.from('profiles').select('id,display_name,username,avatar_url,bio').in('id',authorIds);profiles=new Map((prof.data||[]).map(p=>[p.id,p]))}else profiles.clear();
    const postIds=posts.map(p=>p.id);likes.clear();comments.clear();
    if(postIds.length){
      const [lr,cr]=await Promise.all([
        socialSb.from('post_likes').select('post_id,user_id').in('post_id',postIds),
        socialSb.from('post_comments').select('*').in('post_id',postIds).order('created_at',{ascending:true})
      ]);
      likes=new Set((lr.data||[]).filter(x=>socialUser&&x.user_id===socialUser.id).map(x=>x.post_id));
      (cr.data||[]).forEach(c=>{if(!comments.has(c.post_id))comments.set(c.post_id,[]);comments.get(c.post_id).push(c)});
      const commentAuthors=[...new Set((cr.data||[]).map(c=>c.author_id).filter(Boolean))].filter(id=>!profiles.has(id));
      if(commentAuthors.length){const cp=await socialSb.from('profiles').select('id,display_name,username,avatar_url,bio').in('id',commentAuthors);(cp.data||[]).forEach(p=>profiles.set(p.id,p))}
    }
  }
  async function refresh(){if(!isHome()||rendering)return;clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{if(rendering)return;rendering=true;try{await session();await load();await renderHome(false)}finally{rendering=false}},80)}
  function subscribe(){
    if(channel)return;
    channel=socialSb.channel('eugene-card-home-feed')
      .on('postgres_changes',{event:'*',schema:'public',table:'posts'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'post_likes'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'post_comments'},refresh)
      .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){console.warn('Home realtime status:',status);setTimeout(()=>{if(isHome()){channel=null;subscribe()}},2000)}});
  }
  function postCard(p){const author=profiles.get(p.author_id)||{};const original=p.repost_of?posts.find(x=>x.id===p.repost_of):null;const originalAuthor=original?profiles.get(original.author_id)||{}:{};const cs=comments.get(p.id)||[];return `<article class="social-post" data-post="${esc(p.id)}"><div class="social-head"><img src="${esc(avatar(author))}" alt=""><div><strong>${esc(author.display_name||author.username||'Collector')}</strong><span>@${esc(author.username||'collector')} · ${ago(p.created_at)}</span></div></div>${p.repost_of?`<div class="repost-label">↻ Reposted</div>`:''}<div class="social-text">${esc(p.content)}</div>${p.image_url?`<img class="social-image" src="${esc(p.image_url)}" alt="Post image">`:''}${original?`<div class="quoted-post"><div class="social-head"><img src="${esc(avatar(originalAuthor))}" alt=""><div><strong>${esc(originalAuthor.display_name||originalAuthor.username||'Collector')}</strong><span>@${esc(originalAuthor.username||'collector')} · ${ago(original.created_at)}</span></div></div><div class="social-text">${esc(original.content)}</div>${original.image_url?`<img class="social-image" src="${esc(original.image_url)}" alt="">`:''}</div>`:''}<div class="social-actions"><button data-social-like="${esc(p.id)}" class="${likes.has(p.id)?'liked':''}">♥ <span data-like-count="${esc(p.id)}">${p.like_count??0}</span> Like</button><button data-social-comment="${esc(p.id)}">💬 <span>${cs.length}</span> Comment</button><button data-social-repost="${esc(p.id)}">↻ Repost</button></div><div class="comment-list">${cs.map(c=>{const cp=profiles.get(c.author_id)||{};return `<div class="comment"><img src="${esc(avatar(cp))}" alt=""><div><strong>${esc(cp.display_name||cp.username||'Collector')}</strong><span>${esc(c.content)}</span></div></div>`}).join('')}</div><form class="comment-form" data-comment-form="${esc(p.id)}"><input class="input" name="content" maxlength="2000" placeholder="Reply to this post…" required><button class="btn">Post</button></form></article>`}
  async function counts(){const ids=posts.map(p=>p.id);if(!ids.length)return;const r=await socialSb.from('post_likes').select('post_id').in('post_id',ids);const m=new Map();(r.data||[]).forEach(x=>m.set(x.post_id,(m.get(x.post_id)||0)+1));posts.forEach(p=>p.like_count=m.get(p.id)||0)}
  async function renderHome(full=true){
    if(full){await session();await load();await counts()}
    const app=document.getElementById('app');if(!app)return;
    app.innerHTML=`<div class="shell social-shell"><header class="topbar"><div class="topbar-inner"><a class="brand" href="./"><span class="brand-mark">E</span>Eugene Card</a><nav class="nav"><button class="social-home-active" data-social-home>Home</button><button data-social-route="market">Marketplace</button><button data-social-route="binder">Binder</button><button data-social-route="sell">Sell</button><button data-social-route="trade">Trade</button><button data-social-route="favorites">Favorites</button><button data-social-route="profile">Profile</button></nav><div class="auth-area"><span class="social-user-mini">${socialUser?esc(profiles.get(socialUser.id)?.display_name||socialUser.email||'Logged in'):'Guest'}</span></div></div></header><main class="main"><section class="social-layout"><div><div class="section-title"><div><div class="eyebrow">Community</div><h1 style="margin:4px 0 0">Home</h1></div><span>${posts.length} posts</span></div>${socialUser?`<div class="composer panel"><div class="social-composer-head"><img src="${esc(avatar(profiles.get(socialUser.id)))}" alt=""><textarea id="social-compose" class="textarea" maxlength="5000" rows="3" placeholder="What are you collecting, trading, or thinking about?"></textarea></div><div class="composer-bottom"><input id="social-image" class="input" type="url" placeholder="Optional image URL"><button id="social-post" class="btn primary">Post</button></div></div>`:`<div class="panel social-login-card"><h2>Join the Eugene Card community</h2><p class="muted">Log in to post, like, comment, and repost collector updates.</p><button id="social-login" class="btn primary">Log in</button></div>`}${posts.length?`<div class="social-feed">${posts.map(postCard).join('')}</div>`:'<div class="empty">No posts yet. Be the first collector to post.</div>'}</div><aside class="social-sidebar"><div class="panel"><div class="eyebrow">Community</div><h3>Collector feed</h3><p class="muted">Share card finds, collection updates, trades, and marketplace news.</p><div class="social-rule"></div><div><strong>${posts.length}</strong><span class="muted"> posts loaded</span></div><div class="muted" style="margin-top:8px">Live synchronization enabled</div></div></aside></section></main></div>`;
    bindHome();
    subscribe();
  }
  function bindHome(){
    document.getElementById('social-login')?.addEventListener('click',()=>{const btn=document.getElementById('login');if(btn)btn.click();else document.querySelector('#modal')?.classList.add('open')});
    document.getElementById('social-post')?.addEventListener('click',createPost);
    document.querySelectorAll('[data-social-like]').forEach(b=>b.onclick=()=>likePost(b.dataset.socialLike));
    document.querySelectorAll('[data-social-repost]').forEach(b=>b.onclick=()=>repost(b.dataset.socialRepost));
    document.querySelectorAll('[data-social-route]').forEach(b=>b.onclick=()=>route(b.dataset.socialRoute));
    document.querySelectorAll('[data-comment-form]').forEach(f=>f.onsubmit=submitComment);
  }
  async function createPost(){if(!socialUser){toast('Log in to post',true);return}const content=document.getElementById('social-compose')?.value.trim();const image_url=document.getElementById('social-image')?.value.trim()||null;if(!content){toast('Write something first',true);return}const r=await socialSb.from('posts').insert({author_id:socialUser.id,content,image_url}).select().single();if(r.error){toast(r.error.message,true);return}toast('Posted');await refresh()}
  async function likePost(id){if(!socialUser){toast('Log in to like posts',true);return}const active=likes.has(id);const r=active?await socialSb.from('post_likes').delete().eq('post_id',id).eq('user_id',socialUser.id):await socialSb.from('post_likes').insert({post_id:id,user_id:socialUser.id});if(r.error){toast(r.error.message,true);return}await refresh()}
  async function submitComment(e){e.preventDefault();if(!socialUser){toast('Log in to comment',true);return}const f=new FormData(e.target);const content=String(f.get('content')||'').trim();if(!content)return;const r=await socialSb.from('post_comments').insert({post_id:e.target.dataset.commentForm,author_id:socialUser.id,content});if(r.error){toast(r.error.message,true);return}await refresh()}
  async function repost(id){if(!socialUser){toast('Log in to repost',true);return}const original=posts.find(p=>p.id===id);if(!original)return;const r=await socialSb.from('posts').insert({author_id:socialUser.id,content:`Reposted: ${original.content.slice(0,500)}`,repost_of:id});if(r.error){toast(r.error.message,true);return}toast('Reposted');await refresh()}
  function route(view){history.pushState({view},'',`?view=${encodeURIComponent(view)}`);window.dispatchEvent(new PopStateEvent('popstate'))}
  function injectHomeButton(){const nav=document.querySelector('.topbar .nav');if(!nav||nav.querySelector('[data-social-home]'))return;const b=document.createElement('button');b.textContent='Home';b.dataset.socialHome='';b.onclick=()=>{history.pushState({view:'home'},'','?view=home');renderHome()};nav.prepend(b)}
  function isHome(){return new URLSearchParams(location.search).get('view')==='home'}
  const observer=new MutationObserver(()=>{if(!isHome())injectHomeButton()});observer.observe(document.getElementById('app'),{childList:true,subtree:true});
  window.addEventListener('popstate',()=>{if(isHome())renderHome()});
  window.addEventListener('pageshow',()=>{if(isHome())refresh()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&isHome())refresh()});
  socialSb.auth.onAuthStateChange(()=>{if(isHome())refresh()});
  if(isHome())renderHome();else setTimeout(injectHomeButton,300);
})();