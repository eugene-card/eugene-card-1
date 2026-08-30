// Shared admin authorization + database bridge for secondary HTML pages.
// Secondary pages (analytics/revenue/admin) use the same Supabase session and
// the same public.documents store that backs index.html's Firestore-shaped API.
(function () {
  const client = window.supabaseClient || window.supabase?.createClient?.(
    window.SUPABASE_CONFIG?.url,
    window.SUPABASE_CONFIG?.anonKey,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
  if (!client) return;

  window.supabaseClient = client;

  // -------------------------------------------------------------------------
  // Shared Supabase-backed Firestore compatibility layer
  // -------------------------------------------------------------------------
  const OP_MAP = { '==': 'eq', '!=': 'neq', '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte' };
  const newId = () => (window.crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  function rowSnapshot(collection, row) {
    return { id: row.id, exists: true, data: () => row.data, ref: makeDocRef(collection, row.id) };
  }

  function missingSnapshot(collection, id) {
    return { id, exists: false, data: () => undefined, ref: makeDocRef(collection, id) };
  }

  function watchCollection(collection, reload) {
    const channel = client
      .channel(`secondary-docs:${collection}:${newId()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'documents',
        filter: `collection=eq.${collection}`
      }, reload)
      .subscribe();
    return () => client.removeChannel(channel);
  }

  function makeDocRef(collection, id) {
    return {
      id,
      collectionName: collection,
      async get() {
        const { data, error } = await client
          .from('documents').select('*')
          .eq('collection', collection).eq('id', id).maybeSingle();
        if (error) throw error;
        return data ? rowSnapshot(collection, data) : missingSnapshot(collection, id);
      },
      async set(payload, opts = {}) {
        let data = payload || {};
        if (opts.merge) {
          const existing = await this.get();
          data = { ...(existing.exists ? existing.data() : {}), ...data };
        }
        const { error } = await client.from('documents').upsert({
          collection, id, data, updated_at: new Date().toISOString()
        }, { onConflict: 'collection,id' });
        if (error) throw error;
      },
      async update(payload) {
        const existing = await this.get();
        const data = { ...(existing.exists ? existing.data() : {}), ...(payload || {}) };
        const { error } = await client.from('documents').upsert({
          collection, id, data, updated_at: new Date().toISOString()
        }, { onConflict: 'collection,id' });
        if (error) throw error;
      },
      async delete() {
        const { error } = await client.from('documents').delete()
          .eq('collection', collection).eq('id', id);
        if (error) throw error;
      },
      onSnapshot(callback, onError) {
        this.get().then(callback).catch(error => onError?.(error));
        return watchCollection(collection, () => this.get().then(callback).catch(error => onError?.(error)));
      }
    };
  }

  function makeQuery(collection, filters = [], order = null, limitN = null) {
    const query = {
      where(field, op, value) {
        return makeQuery(collection, [...filters, { field, op, value }], order, limitN);
      },
      orderBy(field, direction = 'asc') {
        return makeQuery(collection, filters, { field, direction }, limitN);
      },
      limit(n) {
        return makeQuery(collection, filters, order, n);
      },
      async get() {
        let q = client.from('documents').select('*').eq('collection', collection);
        for (const f of filters) {
          q = q.filter(`data->>${f.field}`, OP_MAP[f.op] || 'eq', String(f.value));
        }
        const { data, error } = await q;
        if (error) throw error;
        let rows = data || [];
        if (order) {
          rows = rows.slice().sort((a, b) => {
            const av = a.data?.[order.field];
            const bv = b.data?.[order.field];
            if (av === bv) return 0;
            const cmp = av > bv ? 1 : -1;
            return order.direction === 'desc' ? -cmp : cmp;
          });
        }
        if (limitN) rows = rows.slice(0, limitN);
        const docs = rows.map(row => rowSnapshot(collection, row));
        return { docs, empty: docs.length === 0, size: docs.length, forEach: fn => docs.forEach(fn) };
      },
      onSnapshot(callback, onError) {
        this.get().then(callback).catch(error => onError?.(error));
        return watchCollection(collection, () => this.get().then(callback).catch(error => onError?.(error)));
      }
    };
    return query;
  }

  function makeCollectionRef(collection) {
    return Object.assign(makeQuery(collection), {
      doc(id) { return makeDocRef(collection, id || newId()); },
      async add(payload) {
        const ref = makeDocRef(collection, newId());
        await ref.set(payload);
        return ref;
      }
    });
  }

  window.db = {
    collection(name) { return makeCollectionRef(name); },
    batch() {
      const ops = [];
      return {
        set(ref, data, opts) { ops.push(() => ref.set(data, opts)); return this; },
        update(ref, data) { ops.push(() => ref.update(data)); return this; },
        delete(ref) { ops.push(() => ref.delete()); return this; },
        async commit() { for (const op of ops) await op(); }
      };
    }
  };

  // -------------------------------------------------------------------------
  // Shared admin authorization bridge
  // -------------------------------------------------------------------------
  const existingAuth = window.auth || {};

  window.auth = {
    ...existingAuth,
    onAuthStateChanged(callback) {
      let stopped = false;
      let lastUserId = null;
      let lastAuthorized = null;

      const emit = async (user) => {
        if (stopped) return;
        if (!user) {
          lastUserId = null;
          lastAuthorized = false;
          callback(null);
          return;
        }

        const userId = user.id || user.uid || null;
        if (!userId) {
          callback(user);
          return;
        }
        if (userId === lastUserId && lastAuthorized === true) return;

        let authorized = false;
        try {
          const { data, error } = await client
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();
          authorized = !error && String(data?.role || '').toLowerCase() === 'admin';
        } catch (error) {
          console.error('Admin profile lookup failed:', error);
        }

        if (stopped) return;
        lastUserId = userId;
        lastAuthorized = authorized;

        // Legacy pages use an email allowlist. The profile role remains the
        // source of truth; this preserves the legacy page contract.
        const bridgedUser = authorized
          ? { ...user, id: userId, uid: userId,
              email: String(user.email || '').includes('@') ? user.email : 'eugenecard.market@gmail.com' }
          : user;
        callback(bridgedUser);
      };

      client.auth.getSession()
        .then(({ data }) => emit(data?.session?.user || null))
        .catch(error => { console.error('Supabase session restore failed:', error); callback(null); });

      const { data } = client.auth.onAuthStateChange((_event, session) => {
        emit(session?.user || null);
      });

      return () => {
        stopped = true;
        data?.subscription?.unsubscribe();
      };
    }
  };
})();
