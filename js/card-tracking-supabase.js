/* Native Supabase card view + live presence adapter. */
(function () {
  'use strict';
  let viewPatchTimer = 0;
  let viewRefreshTimer = 0;

  function cleanupLiteralEscapedNewlines(root = document.documentElement) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const parent = node.parentElement;
      if (!parent || /^(SCRIPT|STYLE|PRE|TEXTAREA)$/i.test(parent.tagName)) continue;
      if (node.nodeValue?.includes('\\n')) node.nodeValue = node.nodeValue.replace(/\\n+/g, ' ');
    }
  }

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
    window.refreshEugeneCardViewCounts = () => patchVisibleViewCounts(client);
    cleanupLiteralEscapedNewlines();
    patchVisibleViewCounts(client);

    const observer = new MutationObserver(() => {
      cleanupLiteralEscapedNewlines();
      clearTimeout(viewPatchTimer);
      viewPatchTimer = setTimeout(() => patchVisibleViewCounts(client), 180);
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });

    document.addEventListener('click', event => {
      const card = event.target?.closest?.('[data-card-id],[data-id],[data-card],article,.card-holo-premium,.card-holo-standard');
      if (!card) return;
      clearTimeout(viewRefreshTimer);
      viewRefreshTimer = setTimeout(() => patchVisibleViewCounts(client), 350);
      setTimeout(() => patchVisibleViewCounts(client), 1100);
    }, true);

    client.channel('card-view-counts-ui')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_views' }, () => patchVisibleViewCounts(client))
      .subscribe();

    console.info('[Supabase] Card views + live presence wired to Supabase');
  }

  function normalizeSerial(value) {
    const raw = String(value || '').replace(/^#/, '').trim();
    if (!raw) return '';
    const match = raw.match(/\d+/);
    return match ? String(Number(match[0])).padStart(3, '0') : '';
  }

  function viewTextPattern() {
    return /\b(\d+)\s*(views?|kali\s+dilihat)\b/i;
  }

  async function resolveCardId(client, id) {
    const raw = String(id ?? '').trim();
    if (!raw) return '';

    const { data: direct } = await client.from('cards').select('id').eq('id', raw).maybeSingle();
    if (direct?.id != null) return String(direct.id);

    const serialKey = normalizeSerial(raw);
    if (!serialKey) return raw;

    const { data: cards } = await client.from('cards').select('id,serial');
    const match = (cards || []).find(row => normalizeSerial(row.serial) === serialKey);
    return match?.id != null ? String(match.id) : raw;
  }

  function findCardId(el, bySerial) {
    let node = el;
    for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
      const direct = node.getAttribute?.('data-card-id') || node.getAttribute?.('data-id') || node.getAttribute?.('data-card');
      if (direct) return String(direct);
      const serialText = node.textContent || '';
      const serials = serialText.match(/#?\b\d{1,4}\b/g) || [];
      for (const serial of serials) {
        const key = normalizeSerial(serial);
        if (key && bySerial.has(key)) return bySerial.get(key);
      }
    }
    return '';
  }

  async function patchVisibleViewCounts(client) {
    try {
      const [{ data: cards, error: cardsError }, { data: views, error: viewsError }] = await Promise.all([
        client.from('cards').select('id,serial'),
        client.from('card_views').select('card_id,views')
      ]);
      if (cardsError || viewsError) return;

      const byId = new Map((views || []).map(row => [String(row.card_id), Number(row.views || 0)]));
      const bySerial = new Map();
      (cards || []).forEach(row => {
        const key = normalizeSerial(row.serial);
        if (key) bySerial.set(key, String(row.id));
      });

      const pattern = viewTextPattern();
      const nodes = [...document.querySelectorAll('body *')].filter(el => {
        if (!pattern.test(el.textContent || '')) return false;
        return ![...el.children].some(child => pattern.test(child.textContent || ''));
      });

      for (const el of nodes) {
        const id = findCardId(el, bySerial);
        if (!id) continue;
        const count = byId.get(String(id));
        if (count == null) continue;

        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        for (const node of textNodes) {
          if (!pattern.test(node.nodeValue || '')) continue;
          node.nodeValue = node.nodeValue.replace(pattern, (_, __, unit) =>
            unit.toLowerCase().startsWith('kali')
              ? `${count} kali dilihat`
              : `${count} ${count === 1 ? 'view' : 'views'}`
          );
          break;
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
        const key = table === 'card_views' ? 'card_id' : 'session_id';
        const resolved = table === 'card_views' ? await resolveCardId(client, id) : id;
        const { data, error } = await client.from(table).select('*').eq(key, resolved).maybeSingle();
        if (error) throw error;
        return data ? snapshot(client, table, data) : { id: resolved, exists: false, data: () => undefined };
      },
      async set(payload) {
        if (table === 'card_views') {
          const resolved = await resolveCardId(client, id);
          if (!resolved) throw new Error('card_id is required');
          // FieldValue.increment(n) sentinels (from supabase-firebase-compat.js) are
          // Symbol-tagged objects shaped like { [FIELD_VALUE]: 'increment', amount: n }.
          // Detect them generically by shape (any non-null object with a numeric
          // `amount`, or the older `__supabaseIncrement` marker) rather than requiring
          // one exact key, since the literal key never actually matched here.
          const v = payload?.views;
          const isIncrementSentinel = v && typeof v === 'object' && (typeof v.amount === 'number' || typeof v.__supabaseIncrement === 'number');
          if (isIncrementSentinel) {
            const { error } = await client.rpc('increment_card_view', { p_card_id: resolved });
            if (error) throw error;
            return;
          }
          const row = { card_id: resolved, views: Number(v || 0), updated_at: new Date().toISOString() };
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
        const resolved = table === 'card_views' ? await resolveCardId(client, id) : id;
        const { error } = await client.from(table).delete().eq(key, resolved);
        if (error) throw error;
      },
      onSnapshot(callback) {
        const key = table === 'card_views' ? 'card_id' : 'session_id';
        let active = true;
        const load = async () => {
          const resolved = table === 'card_views' ? await resolveCardId(client, id) : id;
          const { data, error } = await client.from(table).select('*').eq(key, resolved).maybeSingle();
          if (!active) return;
          if (error) { console.warn('[Supabase] ' + table + ' doc:', error.message); return; }
          callback(data ? snapshot(client, table, data) : { id: resolved, exists: false, data: () => undefined });
        };
        load();
        return () => { active = false; };
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
