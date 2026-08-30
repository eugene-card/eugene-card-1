/* Eugene Card native Supabase data wiring.
 * Keeps the legacy Firebase-shaped UI API working, but makes core marketplace
 * state come from the real Supabase tables instead of browser-only state.
 */
(function () {
  'use strict';
  const client = window.supabaseClient;
  if (!client) return console.error('[Supabase] app wire: client unavailable');

  const ADMIN_EMAILS = new Set(['eugene.aquila06@gmail.com', 'eugenecard.market@gmail.com']);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function getUser() {
    const { data } = await client.auth.getUser();
    return data?.user || null;
  }

  async function loadProfile(user) {
    if (!user) return null;
    const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) { console.warn('[Supabase] profile load:', error.message); return null; }
    return data;
  }

  function applyProfile(user, profile) {
    if (!user) return;
    const meta = user.user_metadata || {};
    const p = profile || {};
    currentUser = {
      ...(currentUser || {}),
      uid: user.id,
      id: user.id,
      email: user.email || p.email || '',
      username: p.username || meta.username || (user.email || '').split('@')[0],
      name: p.display_name || meta.full_name || meta.name || (user.email || '').split('@')[0],
      displayName: p.display_name || meta.full_name || meta.name || (user.email || '').split('@')[0],
      avatarUrl: p.avatar_url || meta.avatar_url || meta.picture || '',
      bio: p.bio || '',
      role: ADMIN_EMAILS.has(String(user.email || '').toLowerCase()) ? 'admin' : (p.role || 'user'),
      isAdmin: ADMIN_EMAILS.has(String(user.email || '').toLowerCase()) || p.role === 'admin',
      isPlusMember: !!p.is_plus_member,
      socialIg: p.social_ig || '',
      socialTwitter: p.social_twitter || '',
      socialTiktok: p.social_tiktok || '',
      socialWeb: p.social_web || ''
    };
  }

  async function hydrateCards() {
    const { data, error } = await client.from('cards').select('*').order('id', { ascending: true });
    if (error) throw error;
    if (!Array.isArray(data)) return;
    inventory = data.map(c => ({
      ...c,
      image: c.image_url || c.img_url || '',
      imgUrl: c.image_url || c.img_url || '',
      owner: c.owner || '',
      price: Number(c.price || c.asset_value || 0),
      baseFloorPrice: Number(c.base_floor_price || 0),
      status: c.status || 'AVAILABLE'
    }));
    if (typeof updateAllViews === 'function') updateAllViews();
  }

  async function hydrateCart(user) {
    if (!user) { cart = []; if (typeof renderCartItems === 'function') renderCartItems(); return; }
    const { data, error } = await client.from('cart_items').select('*').eq('user_id', user.id);
    if (error) { console.warn('[Supabase] cart load:', error.message); return; }
    cart = (data || []).map(row => {
      const card = inventory.find(c => String(c.id) === String(row.card_id));
      return card ? { ...card, id: card.id, quantity: Number(row.quantity || 1) } : { id: row.card_id, quantity: Number(row.quantity || 1) };
    });
    if (typeof renderCartItems === 'function') renderCartItems();
  }

  async function hydrateNotifications(user) {
    if (!user) { systemNotifications = []; if (typeof renderNotifications === 'function') renderNotifications(); return; }
    const { data, error } = await client.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (error) { console.warn('[Supabase] notifications load:', error.message); return; }
    systemNotifications = (data || []).map(n => ({
      id: n.id,
      title: n.title || 'Eugene Card',
      message: n.body || '',
      body: n.body || '',
      link: n.link || '#',
      url: n.link || '#',
      iconClass: n.type === 'message' ? 'fa-comments text-violet-400' : 'fa-info-circle text-indigo-400',
      readAt: n.read_at,
      read: !!n.read_at,
      createdAt: n.created_at,
      time: n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    }));
    if (typeof renderNotifications === 'function') renderNotifications();
  }

  async function hydrateAuctions() {
    const { data, error } = await client.from('auctions').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[Supabase] auctions load:', error.message); return; }
    const active = (data || []).find(a => String(a.status || '').toLowerCase() === 'active') || (data || [])[0] || null;
    activeAuction = active;
    if (typeof renderAuction === 'function') renderAuction();
  }

  async function hydrateTrades() {
    const { data, error } = await client.from('trade_listings').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[Supabase] trades load:', error.message); return; }
    activeListings = (data || []).map(x => ({ id: x.id, ...x, ownerId: x.owner_id, offeredCardIds: x.offered_card_ids || [], desiredCardIds: x.desired_card_ids || [] }));
    if (typeof renderP2PListings === 'function') renderP2PListings();
  }

  async function hydratePosts() {
    const { data, error } = await client.from('posts').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) { console.warn('[Supabase] posts load:', error.message); return; }
    window.supabasePosts = data || [];
    document.dispatchEvent(new CustomEvent('supabase:posts', { detail: window.supabasePosts }));
  }

  async function hydrateOrders(user) {
    if (!user) { transactionsList = []; return; }
    const { data, error } = await client.from('orders').select('*, order_items(*)').eq('buyer_id', user.id).order('created_at', { ascending: false });
    if (error) { console.warn('[Supabase] orders load:', error.message); return; }
    transactionsList = (data || []).map(o => ({ id: o.id, ...o, orderId: o.id, totalAmount: o.total, items: o.order_items || [] }));
    if (typeof renderTransactionHistoryTable === 'function') renderTransactionHistoryTable();
  }

  async function hydrateProfiles() {
    const { data, error } = await client.from('profiles').select('id,email,username,display_name,avatar_url').order('display_name', { ascending: true });
    if (error) { console.warn('[Supabase] profiles load:', error.message); return []; }
    window.supabaseProfiles = data || [];
    window.supabaseProfileMap = new Map((data || []).flatMap(p => [[String(p.id), p], [String(p.username || '').toLowerCase(), p]].filter(x => x[0])));
    document.dispatchEvent(new CustomEvent('supabase:profiles', { detail: window.supabaseProfiles }));
    return data || [];
  }

  function holderDisplayPatch(root, profiles) {
    const list = profiles || window.supabaseProfiles || [];
    if (!list.length || !root) return;
    const byKey = new Map();
    list.forEach(p => {
      if (p.id) byKey.set(String(p.id).toLowerCase(), p);
      if (p.username) byKey.set(String(p.username).toLowerCase(), p);
      if (p.display_name) byKey.set(String(p.display_name).toLowerCase(), p);
    });
    const nodes = root.querySelectorAll ? root.querySelectorAll('[data-holder-id],[data-owner-id],[data-holder],[data-owner], [class*="holder" i], [id*="holder" i]') : [];
    nodes.forEach(el => {
      const key = String(el.dataset?.holderId || el.dataset?.ownerId || el.dataset?.holder || el.dataset?.owner || '').trim().toLowerCase();
      const p = byKey.get(key);
      if (p?.display_name) {
        const username = p.username ? '@' + p.username : '';
        if (el.children.length === 0 || el.dataset.holderNameOnly === 'true') el.textContent = p.display_name;
        else {
          [...el.childNodes].forEach(n => {
            if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) n.textContent = p.display_name;
          });
        }
        if (username && el.title && el.title.includes(username)) el.title = p.display_name;
      }
    });
    // Holder rows sometimes have only the username as text. Restrict this fallback
    // to ancestors whose class/id/aria-label identifies a holder list.
    const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
    all.forEach(el => {
      const marker = `${el.className || ''} ${el.id || ''} ${el.getAttribute?.('aria-label') || ''}`.toLowerCase();
      if (!/holder/.test(marker)) return;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const texts = [];
      let n; while ((n = walker.nextNode())) texts.push(n);
      texts.forEach(t => {
        const raw = t.textContent.trim();
        if (!raw) return;
        const key = raw.replace(/^@/, '').toLowerCase();
        const p = byKey.get(key);
        if (p?.display_name && raw !== p.display_name) t.textContent = p.display_name;
      });
    });
  }

  function profileCountPatch(root, profiles) {
    const count = (profiles || []).length;
    if (!root || !count) return;
    // Update explicit count elements first; this avoids changing unrelated numbers.
    root.querySelectorAll('[data-profile-count],[data-collector-count],[data-holder-count]').forEach(el => { el.textContent = String(count); });
    root.querySelectorAll('*').forEach(el => {
      if (el.children.length > 0) return;
      const label = `${el.parentElement?.textContent || ''} ${el.parentElement?.previousElementSibling?.textContent || ''}`.toLowerCase();
      if (!/(collector|member|profile|holder)/.test(label)) return;
      const txt = el.textContent.trim();
      if (/^\d+$/.test(txt) && Number(txt) !== count) el.textContent = String(count);
    });
  }

  let profilePatchTimer = null;
  async function patchProfilesUI() {
    const profiles = await hydrateProfiles();
    if (!profiles.length) return;
    holderDisplayPatch(document, profiles);
    profileCountPatch(document, profiles);
  }

  function scheduleProfilesUIPatch() {
    clearTimeout(profilePatchTimer);
    profilePatchTimer = setTimeout(() => patchProfilesUI().catch(e => console.warn('[Supabase] profile UI patch:', e.message)), 150);
  }

  async function syncAll(user) {
    try { await hydrateCards(); } catch (e) { console.warn('[Supabase] cards:', e.message); }
    await Promise.all([
      hydrateCart(user), hydrateNotifications(user), hydrateAuctions(), hydrateTrades(),
      hydratePosts(), hydrateOrders(user), hydrateProfiles()
    ]);
    if (typeof renderAuthHeader === 'function') renderAuthHeader();
    if (typeof updateAllViews === 'function') updateAllViews();
    scheduleProfilesUIPatch();
  }

  if (typeof saveCartToStorage === 'function') {
    const legacySaveCart = saveCartToStorage;
    window.saveCartToStorage = async function () {
      legacySaveCart();
      const user = await getUser();
      if (!user) return;
      const wanted = new Map((cart || []).map(i => [String(i.id), Number(i.quantity || 1)]));
      const { data: existing } = await client.from('cart_items').select('card_id').eq('user_id', user.id);
      for (const row of (existing || [])) {
        if (!wanted.has(String(row.card_id))) await client.from('cart_items').delete().eq('user_id', user.id).eq('card_id', row.card_id);
      }
      for (const [cardId, quantity] of wanted) {
        await client.from('cart_items').upsert({ user_id: user.id, card_id: cardId, quantity }, { onConflict: 'user_id,card_id' });
      }
    };
  }

  window.markSupabaseNotificationRead = async function (id) {
    const user = await getUser();
    if (!user || !id) return;
    await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
    await hydrateNotifications(user);
  };
  window.markAllSupabaseNotificationsRead = async function () {
    const user = await getUser();
    if (!user) return;
    await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
    await hydrateNotifications(user);
  };
  window.addSupabaseNotification = async function (title, body, type = 'system', link = '#') {
    const user = await getUser();
    if (!user) return;
    await client.from('notifications').insert({ user_id: user.id, title, body, type, link });
    await hydrateNotifications(user);
  };

  let channel;
  function subscribeRealtime(user) {
    if (channel) client.removeChannel(channel);
    if (!user) return;
    channel = client.channel('eugene-card-native-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => hydrateCards())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => scheduleProfilesUIPatch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () => hydrateAuctions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_listings' }, () => hydrateTrades())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => hydrateNotifications(user))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items', filter: `user_id=eq.${user.id}` }, () => hydrateCart(user))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `buyer_id=eq.${user.id}` }, () => hydrateOrders(user))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => hydratePosts())
      .subscribe();
  }

  async function boot() {
    for (let i = 0; i < 80 && typeof updateAllViews !== 'function'; i++) await sleep(50);
    const user = await getUser();
    const profile = await loadProfile(user);
    if (user) applyProfile(user, profile);
    await syncAll(user);
    subscribeRealtime(user);
    scheduleProfilesUIPatch();
    const observer = new MutationObserver(() => scheduleProfilesUIPatch());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  client.auth.onAuthStateChange(async (_event, session) => {
    const user = session?.user || null;
    const profile = await loadProfile(user);
    if (user) applyProfile(user, profile);
    else currentUser = null;
    await syncAll(user);
    subscribeRealtime(user);
    scheduleProfilesUIPatch();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
