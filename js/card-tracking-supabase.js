/* Native Supabase card view + live presence adapter. */
(function () {
  'use strict';

  function boot() {
    const client = window.supabaseClient;
    const db = window.db;
    if (!client || !db || typeof db.collection !== 'function') return setTimeout(boot, 50);

    // The legacy UI calls db.collection('cardViews') and db.collection('cardPresence').
    // Route those two collections directly to Supabase tables.
    const legacyCollection = db.collection.bind(db);
    const native = {
      cardViews: makeCollection(client, 'card_views'),
      cardPresence: makeCollection(client, 'card_presence')
    };

    db.collection = function (name) {
      if (native[name]) return native[name];
      return legacyCollection(name);
    };

    // Legacy index.html expects Firebase-style FieldValue helpers.
    // Provide them without bringing Firebase back into the app.
    const supa = window.supabase;
    if (supa && !supa.supabase) supa.supabase = {};
    if (supa && !supa.supabase.FieldValue) {
      supa.supabase.FieldValue = {
        increment: n => ({ __supabaseIncrement: Number(n || 0) }),
        serverTimestamp: () => ({ __supabaseServerTimestamp: true })
      };
    }

    window.__cardTrackingStorage = 'supabase';
    console.info('[Supabase] Card views + live presence wired to Supabase');
  }

  function makeCollection(client, table) {
    return {
      doc(id) { return makeDoc(client, table, id); },
      onSnapshot(callback, onError) {
        let active = true;
        const load = async () => {
          try {
            const { data, error } = await client.from(table).select('*');
            if (error) throw error;
            if (!active) return;
            const rows = data || [];
            callback({ docs: rows.map(row => snapshot(client, table, row)), forEach: fn => rows.forEach(row => fn(snapshot(client, table, row))) });
          } catch (e) { if (onError) onError(e); else console.warn('[Supabase] ' + table + ' listener:', e.message); }
        };
        load();
        const channel = client.channel(table + '-realtime-' + Math.random().toString(36).slice(2))
          .on('postgres_changes', { event: '*', schema: 'public', table }, load)
          .subscribe();
        return () => { active = false; client.removeChannel(channel); };
      }
    };
  }

  function makeDoc(client, table, id) {
    return {
      id,
      async get() {
        const { data, error } = await client.from(table).select('*').eq(table === 'card_views' ? 'card_id' : 'session_id', id).maybeSingle();
        if (error) throw error;
        return data ? snapshot(client, table, data) : { id, exists: false, data: () => undefined };
      },
      async set(payload, opts) {
        if (table === 'card_views') {
          // trackCardView uses increment(1); use an atomic Postgres RPC.
          if (payload && payload.views && payload.views.__supabaseIncrement) {
            await client.rpc('increment_card_view', { p_card_id: id });
            return;
          }
          const row = { card_id: id, views: Number(payload?.views || 0), updated_at: new Date().toISOString() };
          const { error } = await client.from(table).upsert(row, { onConflict: 'card_id' });
          if (error) throw error;
          return;
        }
        const row = { session_id: id, card_id: payload?.cardId ?? null, last_seen: new Date().toISOString() };
        const { error } = await client.from(table).upsert(row, { onConflict: 'session_id' });
        if (error) throw error;
      },
      async update(payload) { return this.set(payload, { merge: true }); },
      async delete() {
        const key = table === 'card_views' ? 'card_id' : 'session_id';
        const { error } = await client.from(table).delete().eq(key, id);
        if (error) throw error;
      },
      onSnapshot(callback) {
        const key = table === 'card_views' ? 'card_id' : 'session_id';
        let active = true;
        const load = async () => {
          const { data, error } = await client.from(table).select('*').eq(key, id).maybeSingle();
          if (!active) return;
          if (error) { console.warn('[Supabase] ' + table + ' doc:', error.message); return; }
          callback(data ? snapshot(client, table, data) : { id, exists: false, data: () => undefined });
        };
        load();
        const channel = client.channel(table + '-doc-' + id + '-' + Math.random().toString(36).slice(2))
          .on('postgres_changes', { event: '*', schema: 'public', table, filter: key + '=eq.' + id }, load)
          .subscribe();
        return () => { active = false; client.removeChannel(channel); };
      }
    };
  }

  function snapshot(client, table, row) {
    const id = table === 'card_views' ? row.card_id : row.session_id;
    return { id, exists: true, data: () => row, ref: makeDoc(client, table, id) };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
