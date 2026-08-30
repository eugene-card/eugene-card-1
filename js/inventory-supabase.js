/* Native Supabase Inventory adapter.
 * Inventory uses the real public.cards table directly.
 * This adapter preserves the small Firestore-shaped interface still used by
 * legacy inventory UI code, while translating UI field names to Supabase's
 * actual snake_case columns before every write.
 */
(function () {
  'use strict';

  const FIELD_MAP = {
    imgUrl: 'img_url',
    imageUrl: 'image_url',
    image: 'image_url',
    baseFloorPrice: 'base_floor_price',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  };

  const CARD_COLUMNS = new Set([
    'id', 'serial', 'name', 'type', 'price', 'base_floor_price', 'owner',
    'status', 'img_url', 'edition', 'sn', 'tier', 'printing', 'created_at',
    'updated_at', 'description', 'image_url', 'asset_value', 'metadata'
  ]);

  function normalizePayload(payload, forcedId) {
    const source = payload || {};
    const row = {};

    Object.keys(source).forEach(key => {
      const dbKey = FIELD_MAP[key] || key;
      if (!CARD_COLUMNS.has(dbKey)) return;
      row[dbKey] = source[key];
    });

    // The UI historically uses imgUrl/image; cards has both img_url and
    // image_url, so keep both in sync when either representation is supplied.
    if (source.imgUrl != null && row.img_url == null) row.img_url = source.imgUrl;
    if (source.imageUrl != null && row.image_url == null) row.image_url = source.imageUrl;
    if (source.image != null && row.image_url == null) row.image_url = source.image;

    if (forcedId != null) row.id = String(forcedId);
    if (!row.id) row.id = newId();
    return row;
  }

  function boot() {
    const client = window.supabaseClient;
    if (!client || !window.db || typeof window.db.collection !== 'function') {
      return setTimeout(boot, 50);
    }

    const legacyCollection = window.db.collection.bind(window.db);
    const nativeCards = makeCollection(client);

    window.db.collection = function (name) {
      if (String(name) === 'cards') return nativeCards;
      return legacyCollection(name);
    };

    window.__inventoryStorage = 'supabase';
    console.info('[Supabase] Inventory CRUD wired to public.cards');
  }

  function makeCollection(client) {
    return makeQuery(client, [], null, null);
  }

  function makeQuery(client, filters, ordering, limitN) {
    const api = {
      where(field, op, value) {
        return makeQuery(client, filters.concat([{ field, op, value }]), ordering, limitN);
      },
      orderBy(field, direction) {
        return makeQuery(client, filters, { field, direction: direction || 'asc' }, limitN);
      },
      limit(n) {
        return makeQuery(client, filters, ordering, Number(n));
      },
      doc(id) {
        return makeDoc(client, id || newId());
      },
      async add(payload) {
        const row = normalizePayload(payload);
        const { error } = await client.from('cards').insert(row);
        if (error) throw error;
        return makeDoc(client, row.id);
      },
      async get() {
        let q = client.from('cards').select('*');
        for (const f of filters) {
          if (f.op === '==') q = q.eq(f.field, f.value);
          else if (f.op === '!=') q = q.neq(f.field, f.value);
          else if (f.op === '>') q = q.gt(f.field, f.value);
          else if (f.op === '>=') q = q.gte(f.field, f.value);
          else if (f.op === '<') q = q.lt(f.field, f.value);
          else if (f.op === '<=') q = q.lte(f.field, f.value);
        }
        if (ordering) q = q.order(ordering.field, { ascending: ordering.direction !== 'desc' });
        if (limitN) q = q.limit(limitN);
        const { data, error } = await q;
        if (error) throw error;
        const docs = (data || []).map(row => snapshot(row));
        return { docs, empty: docs.length === 0, size: docs.length, forEach: fn => docs.forEach(fn) };
      },
      onSnapshot(callback) {
        api.get().then(callback).catch(console.error);
        const channel = client.channel('inventory-cards-' + newId())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => {
            api.get().then(callback).catch(console.error);
          })
          .subscribe();
        return () => client.removeChannel(channel);
      }
    };
    return api;
  }

  function makeDoc(client, id) {
    return {
      id,
      async get() {
        const { data, error } = await client.from('cards').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return data ? snapshot(data) : { id, exists: false, data: () => undefined };
      },
      async set(payload, opts) {
        let row = normalizePayload(payload, id);
        if (opts && opts.merge) {
          const current = await this.get();
          if (current.exists) row = { ...normalizePayload(current.data(), id), ...row, id: String(id) };
        }
        const { error } = await client.from('cards').upsert(row, { onConflict: 'id' });
        if (error) throw error;
      },
      async update(payload) {
        const row = normalizePayload(payload, id);
        delete row.id;
        const { error } = await client.from('cards').update(row).eq('id', id);
        if (error) throw error;
      },
      async delete() {
        const { error } = await client.from('cards').delete().eq('id', id);
        if (error) throw error;
      },
      onSnapshot(callback) {
        this.get().then(callback).catch(console.error);
        const channel = client.channel('inventory-card-' + id + '-' + newId())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'cards', filter: 'id=eq.' + id }, () => {
            this.get().then(callback).catch(console.error);
          })
          .subscribe();
        return () => client.removeChannel(channel);
      }
    };
  }

  function snapshot(row) {
    const data = { ...row };
    // Give the existing UI the names it expects without ever writing those
    // camelCase aliases back to Supabase.
    data.imgUrl = row.img_url || row.image_url || '';
    data.imageUrl = row.image_url || row.img_url || '';
    data.image = row.image_url || row.img_url || '';
    data.baseFloorPrice = row.base_floor_price;
    return { id: row.id, exists: true, data: () => data, ref: makeDoc(window.supabaseClient, row.id) };
  }

  function newId() {
    return window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : 'card-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
