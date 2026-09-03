/* Supabase-backed card view counter. */
(function(){'use strict';
  const viewedThisPage = new Set();
  const client = () => window.supabaseClient;

  async function increment(cardId){
    cardId = String(cardId || '').trim();
    const c = client();
    if(!cardId || !c || viewedThisPage.has(cardId)) return null;
    viewedThisPage.add(cardId);
    try {
      const { data, error } = await c.rpc('increment_card_view', { p_card_id: cardId });
      if(error) throw error;
      const views = Number(data || 0);
      document.querySelectorAll('[data-card-views="'+CSS.escape(cardId)+'"]').forEach(el => el.textContent = views.toLocaleString());
      return views;
    } catch(error){
      viewedThisPage.delete(cardId);
      console.warn('[Eugene Card] card view increment failed:', error);
      return null;
    }
  }

  async function load(cardId){
    const c = client();
    cardId = String(cardId || '').trim();
    if(!c || !cardId) return 0;
    try {
      const { data, error } = await c.from('card_views').select('views').eq('card_id', cardId).maybeSingle();
      if(error) throw error;
      const views = Number(data?.views || 0);
      document.querySelectorAll('[data-card-views="'+CSS.escape(cardId)+'"]').forEach(el => el.textContent = views.toLocaleString());
      return views;
    } catch(error){
      console.warn('[Eugene Card] card view load failed:', error);
      return 0;
    }
  }

  function findCardId(target){
    const el = target?.closest?.('[data-card-id],[data-card],[data-id]');
    if(!el) return null;
    return el.dataset.cardId || el.dataset.card || el.dataset.id || null;
  }

  document.addEventListener('click', event => {
    const id = findCardId(event.target);
    if(id) increment(id);
  }, true);

  window.EugeneCardViews = { increment, load };
})();

/* Ensure the notification-style mobile Profile and Cart popouts are loaded on every page. */
(function(){
  function load(){
    if(window.__eugeneMobilePopoutsLoaded) return;
    window.__eugeneMobilePopoutsLoaded = true;
    const s=document.createElement('script');
    s.src='./js/mobile-popup-popout.js?v=4';
    s.async=false;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();
