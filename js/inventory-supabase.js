/* Native Supabase Inventory adapter.
 * The legacy index.html uses a Firestore-shaped `db.collection('cards')` API.
 * This adapter replaces ONLY the cards collection with direct Supabase CRUD.
 * No inventory read/write/delete is routed through public.documents/Firestore.
 */
(function () {
  'use strict';

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
    return makeQuery(client, []);
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
        const row = { ...(payload || {}) };
        if (!row.id) row.id = newId();
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
        const row = { ...(payload || {}), id };
        if (opts && opts.merge) {
          const current = await this.get();
          if (current.exists) Object.assign(row, current.data(), payload, { id });
        }
        const { error } = await client.from('cards').upsert(row, { onConflict: 'id' });
        if (error) throw error;
      },
      async update(payload) {
        const { error } = await client.from('cards').update(payload || {}).eq('id', id);
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
    return { id: row.id, exists: true, data: () => row, ref: makeDoc(window.supabaseClient, row.id) };
  }

  function newId() {
    return window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'card-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
