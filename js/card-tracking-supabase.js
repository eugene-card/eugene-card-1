/* Native Supabase card view + live presence adapter. */
(function () {
  'use strict';
  let viewPatchTimer = 0;

  function boot() {
    const client = window.supabaseClient;
    const db = window.db;
    if (!client || !db || typeof db.collection !== 'function') return setTimeout(boot, 50);

    const legacyCollection = db.collection.bind(db);
    const native = {
      cardViews: makeCollection(client, 'card_views'),
      cardPresence: makeCollection(client, 'card_presence')
    };
    db.collection = function (name) {
      if (native[name]) return native[name];
      return legacyCollection(name);
    };

    const supa = window.supabase;
    if (supa && !supa.supabase) supa.supabase = {};
    if (supa && !supa.supabase.FieldValue) {
      supa.supabase.FieldValue = {
        increment: n => ({ __supabaseIncrement: Number(n || 0) }),
        serverTimestamp: () => ({ __supabaseServerTimestamp: true })
      };
    }

    window.__cardTrackingStorage = 'supabase';
    patchVisibleViewCounts(client);
    const observer = new MutationObserver(() => {
      clearTimeout(viewPatchTimer);
      viewPatchTimer = setTimeout(() => patchVisibleViewCounts(client), 180);
    });
    observer.observe(document.body, {subtree:true, childList:true});
    client.channel('card-view-counts-ui').on('postgres_changes',{event:'*',schema:'public',table:'card_views'},()=>patchVisibleViewCounts(client)).subscribe();
    console.info('[Supabase] Card views + live presence wired to Supabase');
  }

  async function patchVisibleViewCounts(client) {
    try {
      const cards = await client.from('cards').select('id,serial');
      const views = await client.from('card_views').select('card_id,views');
      if (cards.error || views.error) return;
      const byId = new Map((views.data || []).map(r => [String(r.card_id), Number(r.views || 0)]));
      const bySerial = new Map((cards.data || []).map(r => [String(r.serial || '').replace(/^#/, '').trim(), String(r.id)]));
      const candidates = [...document.querySelectorAll('[data-card-id],[data-id],[data-card],article,.card-holo-premium,.card-holo-standard')];
      for (const el of candidates) {
        const text = (el.textContent || '').trim();
        if (!/\b\d+\s+views?\b/i.test(text)) continue;
        let id = el.getAttribute('data-card-id') || el.getAttribute('data-id') || el.getAttribute('data-card');
        if (!id) {
          const serialMatch = text.match(/#?([0-9]{2,})/);
          if (serialMatch) id = bySerial.get(serialMatch[1]);
        }
        if (!id) continue;
        const count = byId.get(String(id));
        if (count == null) continue;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const nodes=[];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        for (const node of nodes) {
          if (/\b\d+\s+views?\b/i.test(node.nodeValue || '')) {
            node.nodeValue = node.nodeValue.replace(/\b\d+\s+views?\b/i, `${count} ${count === 1 ? 'view' : 'views'}`);
            break;
          }
        }
      }
    } catch (_) {}
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
