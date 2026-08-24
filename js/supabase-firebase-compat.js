/* Eugene Card — Supabase-only application data adapter. */
(function () {
  'use strict';
  const sb = window.supabaseClient;
  if (!sb) throw new Error('Supabase client is not initialized.');

  const ADMIN_EMAILS = ['eugene.aquila06@gmail.com', 'eugenecard.market@gmail.com'];
  const nativeTables = new Set(['profiles', 'cards']);
  const isAdminEmail = email => ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
  const now = () => new Date().toISOString();
  const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

  const normalizeUser = user => {
    if (!user) return null;
    const m = user.user_metadata || {};
    return { ...user, uid: user.id, displayName: m.full_name || m.name || user.email || '', photoURL: m.avatar_url || m.picture || null, emailVerified: !!user.email_confirmed_at, providerData: user.identities || [], isAdmin: isAdminEmail(user.email) };
  };
  const normalizeProfile = row => row ? ({ ...row, name: row.name ?? row.display_name ?? '', display_name: row.display_name ?? row.name ?? '', avatarUrl: row.avatarUrl ?? row.avatar_url ?? '', isPlusMember: row.isPlusMember ?? row.is_plus_member ?? false, socialIg: row.socialIg ?? row.social_ig ?? '', socialTwitter: row.socialTwitter ?? row.social_twitter ?? '', socialTiktok: row.socialTiktok ?? row.social_tiktok ?? '', socialWeb: row.socialWeb ?? row.social_web ?? '', profileCompleted: row.profileCompleted ?? row.profile_completed ?? false, isAdmin: isAdminEmail(row.email) || row.role === 'admin' }) : null;
  const normalizeCard = row => row ? ({ ...row, price: Number(row.price ?? row.asset_value ?? 0), baseFloorPrice: Number(row.baseFloorPrice ?? row.base_floor_price ?? 0), imgUrl: row.imgUrl ?? row.img_url ?? row.image_url ?? null, serial: row.serial ?? row.sn ?? null, sn: row.sn ?? row.serial ?? null }) : null;
  const normalize = (row, collection) => collection === 'profiles' ? normalizeProfile(row) : collection === 'cards' ? normalizeCard(row) : (row || null);

  function applyOps(payload, current = {}) {
    const out = { ...(payload || {}) };
    for (const [k, v] of Object.entries(out)) {
      if (!v || typeof v !== 'object') continue;
      if (v.__op === 'serverTimestamp') out[k] = v.value;
      if (v.__op === 'increment') out[k] = Number(current[k] || 0) + Number(v.value || 0);
      if (v.__op === 'arrayUnion') out[k] = Array.from(new Set([...(Array.isArray(current[k]) ? current[k] : []), ...(v.values || [])]));
      if (v.__op === 'arrayRemove') out[k] = (Array.isArray(current[k]) ? current[k] : []).filter(x => !(v.values || []).includes(x));
    }
    return out;
  }
  async function getUser() { const { data } = await sb.auth.getUser(); return data?.user || null; }

  async function getDoc(collection, id) {
    if (nativeTables.has(collection)) {
      if (collection === 'profiles' && !uuid(id)) return null;
      const { data, error } = await sb.from(collection).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return normalize(data, collection);
    }
    const { data, error } = await sb.from('app_data').select('id,data,created_at,updated_at,owner_id').eq('collection', collection).eq('id', String(id)).maybeSingle();
    if (error) throw error;
    return data ? { ...(data.data || {}), id: data.id, created_at: data.created_at, updated_at: data.updated_at, owner_id: data.owner_id } : null;
  }

  async function getRows(collection) {
    if (nativeTables.has(collection)) {
      const { data, error } = await sb.from(collection).select('*');
      if (error) throw error;
      return (data || []).map(r => normalize(r, collection));
    }
    const { data, error } = await sb.from('app_data').select('id,data,created_at,updated_at,owner_id').eq('collection', collection);
    if (error) throw error;
    return (data || []).map(r => ({ ...(r.data || {}), id: r.id, created_at: r.created_at, updated_at: r.updated_at, owner_id: r.owner_id }));
  }

  const field = (row, name) => name === '__name__' ? row?.id : name.split('.').reduce((v, k) => v == null ? undefined : v[k], row);
  const cmp = (a, b) => a === b ? 0 : a == null ? -1 : b == null ? 1 : typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true });

  async function queryRows(collection, filters, order, limit) {
    let result = await getRows(collection);
    for (const [name, op, expected] of filters) result = result.filter(row => {
      const actual = field(row, name);
      if (op === '==' || op === '=') return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
      if (op === '!=') return actual !== expected;
      if (op === '>') return actual > expected;
      if (op === '>=') return actual >= expected;
      if (op === '<') return actual < expected;
      if (op === '<=') return actual <= expected;
      if (op === 'array-contains') return Array.isArray(actual) && actual.includes(expected);
      return true;
    });
    if (order) result.sort((a, b) => cmp(field(a, order[0]), field(b, order[0])) * (order[1] === 'desc' ? -1 : 1));
    return limit == null ? result : result.slice(0, Number(limit));
  }

  const snap = rows => {
    const docs = rows.map(r => ({ id: r.id, exists: true, data: () => ({ ...r }) }));
    return { empty: !docs.length, size: docs.length, docs, forEach: cb => docs.forEach(cb) };
  };

  async function ensureProfile(user) {
    if (!user) return null;
    let profile = await getDoc('profiles', user.id);
    const email = String(user.email || '').trim().toLowerCase();
    if (!profile) {
      const m = user.user_metadata || {};
      const display = m.full_name || m.name || email.split('@')[0];
      const username = display.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || `user_${user.id.slice(0, 8)}`;
      const row = { id: user.id, username, display_name: display, avatar_url: m.avatar_url || m.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`, bio: '', role: isAdminEmail(email) ? 'admin' : 'user', is_plus_member: false, social_ig: '', social_twitter: '', social_tiktok: '', social_web: '', profile_completed: false, updated_at: now() };
      const { data, error } = await sb.from('profiles').upsert(row, { onConflict: 'id' }).select('*').single();
      if (error) throw error;
      profile = normalizeProfile(data || row);
    } else if (isAdminEmail(email) && profile.role !== 'admin') {
      const { data, error } = await sb.from('profiles').update({ role: 'admin', updated_at: now() }).eq('id', user.id).select('*').single();
      if (error) throw error;
      profile = normalizeProfile(data || profile);
    }
    return profile;
  }

  async function writeDoc(collection, id, payload, merge) {
    const user = await getUser();
    const existing = await getDoc(collection, id);
    const value = applyOps(merge ? { ...(existing || {}), ...(payload || {}) } : payload, existing || {});

    if (collection === 'profiles') {
      const email = String(user?.email || '').toLowerCase();
      const row = { id: user?.id || id, username: value.username ?? existing?.username ?? null, display_name: value.display_name ?? value.name ?? existing?.display_name ?? null, avatar_url: value.avatar_url ?? value.avatarUrl ?? existing?.avatar_url ?? null, bio: value.bio ?? existing?.bio ?? '', role: isAdminEmail(email) ? 'admin' : (existing?.role || 'user'), is_plus_member: value.is_plus_member ?? value.isPlusMember ?? existing?.is_plus_member ?? false, social_ig: value.social_ig ?? value.socialIg ?? value.instagram ?? existing?.social_ig ?? '', social_twitter: value.social_twitter ?? value.socialTwitter ?? value.x ?? existing?.social_twitter ?? '', social_tiktok: value.social_tiktok ?? value.socialTiktok ?? value.tiktok ?? existing?.social_tiktok ?? '', social_web: value.social_web ?? value.socialWeb ?? value.website ?? existing?.social_web ?? '', profile_completed: value.profile_completed ?? value.profileCompleted ?? existing?.profile_completed ?? false, updated_at: now() };
      const { error } = await sb.from('profiles').upsert(row, { onConflict: 'id' });
      if (error) throw error;
      return;
    }

    if (collection === 'cards') {
      const row = { id: String(value.id || id), serial: value.serial ?? value.sn ?? null, name: value.name || 'Eugene Card', type: value.type || 'STANDARD', price: Number(value.price ?? 0), base_floor_price: Number(value.baseFloorPrice ?? value.base_floor_price ?? value.price ?? 0), owner: value.owner ?? null, status: value.status || 'active', img_url: value.imgUrl ?? value.img_url ?? value.image_url ?? null, edition: value.edition ?? null, sn: value.sn ?? value.serial ?? null, tier: value.tier ?? null, printing: value.printing ?? null, description: value.description ?? null, image_url: value.image_url ?? value.imgUrl ?? null, asset_value: Number(value.asset_value ?? value.price ?? 0), metadata: value.metadata && typeof value.metadata === 'object' ? value.metadata : {}, updated_at: now() };
      const { error } = await sb.from('cards').upsert(row, { onConflict: 'id' });
      if (error) throw error;
      return;
    }

    const row = { collection, id: String(id), data: { ...value, id: String(id) }, owner_id: user?.id || existing?.owner_id || null, updated_at: now() };
    if (!existing) row.created_at = now();
    const { error } = await sb.from('app_data').upsert(row, { onConflict: 'collection,id' });
    if (error) throw error;
  }

  async function removeDoc(collection, id) {
    const { error } = nativeTables.has(collection) ? await sb.from(collection).delete().eq('id', id) : await sb.from('app_data').delete().eq('collection', collection).eq('id', String(id));
    if (error) throw error;
  }

  function collectionRef(collection, filters = [], order = null, limit = null) {
    const api = {
      async get() { return snap(await queryRows(collection, filters, order, limit)); },
      where(name, op, value) { return collectionRef(collection, [...filters, [name, op, value]], order, limit); },
      orderBy(name, direction = 'asc') { return collectionRef(collection, filters, [name, direction], limit); },
      limit(n) { return collectionRef(collection, filters, order, n); },
      doc(id) {
        return { id: String(id), async get() { const row = await getDoc(collection, id); return { id: String(id), exists: !!row, data: () => row ? { ...row } : undefined }; }, async set(data, options = {}) { await writeDoc(collection, id, data, !!options.merge); }, async update(data) { await writeDoc(collection, id, data, true); }, async delete() { await removeDoc(collection, id); }, collection(child) { return collectionRef(`${collection}.${id}.${child}`); } };
      },
      onSnapshot(callback) {
        let active = true, previous = '';
        const refresh = async () => { if (!active) return; try { const s = await api.get(); const key = JSON.stringify(s.docs.map(d => d.data())); if (key !== previous) { previous = key; callback(s); } } catch (e) { console.warn(`Supabase ${collection} sync`, e); } };
        refresh();
        const table = nativeTables.has(collection) ? collection : 'app_data';
        const channel = sb.channel(`eugene-${Math.random().toString(36).slice(2)}`).on('postgres_changes', { event: '*', schema: 'public', table }, refresh).subscribe();
        const timer = setInterval(refresh, 10000);
        return () => { active = false; clearInterval(timer); sb.removeChannel(channel); };
      }
    };
    return api;
  }

  const db = { collection: name => collectionRef(name), batch: () => { const ops = []; return { set: (r, d, o) => ops.push(() => r.set(d, o)), update: (r, d) => ops.push(() => r.update(d)), delete: r => ops.push(() => r.delete()), commit: async () => { for (const op of ops) await op(); } }; } };

  const auth = {
    currentUser: null,
    onAuthStateChanged(callback) {
      let stopped = false;
      const emit = async user => {
        if (stopped) return;
        const normalized = normalizeUser(user);
        auth.currentUser = normalized;
        window.currentUser = normalized;
        if (normalized) {
          try {
            const profile = await ensureProfile(normalized);
            if (profile) { normalized.profile = profile; normalized.name = profile.name || normalized.displayName; normalized.username = profile.username || ''; normalized.avatarUrl = profile.avatarUrl || normalized.photoURL || ''; normalized.bio = profile.bio || ''; normalized.isPlusMember = !!profile.isPlusMember; normalized.isAdmin = !!profile.isAdmin || isAdminEmail(normalized.email); }
          } catch (e) { console.warn('Supabase profile sync', e); }
        }
        callback(normalized);
      };
      sb.auth.getSession().then(({ data }) => emit(data?.session?.user || null));
      const listener = sb.auth.onAuthStateChange((_event, session) => emit(session?.user || null));
      return () => { stopped = true; listener.data.subscription.unsubscribe(); };
    },
    async signInWithPopup() {
      const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams: { prompt: 'select_account' } } });
      if (error) throw error;
    },
    async signOut() { const { error } = await sb.auth.signOut(); if (error) throw error; auth.currentUser = null; window.currentUser = null; }
  };

  const FieldValue = { serverTimestamp: () => ({ __op: 'serverTimestamp', value: now() }), increment: value => ({ __op: 'increment', value: Number(value) || 0 }), arrayUnion: (...values) => ({ __op: 'arrayUnion', values }), arrayRemove: (...values) => ({ __op: 'arrayRemove', values }) };
  window.db = db;
  window.auth = auth;
  window.firebase = { firestore: { FieldValue } };
  window.isUserAdmin = isAdminEmail;
  window.EUGENE_ADMIN_EMAIL = ADMIN_EMAILS[0];
  window.ensureSupabaseProfile = ensureProfile;
})();
