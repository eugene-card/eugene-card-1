// Compatibility shim: the rest of index.html was written against the
// Firebase v8 `auth` / `db` (Firestore) API — window.auth.signInWithPopup(),
// db.collection('x').doc('y').set(...), onSnapshot, batch, etc. — but this
// project now runs on Supabase. Rather than rewrite every one of those ~100
// call sites, this file exposes `window.auth` and `window.db` objects with
// the same shape, backed by Supabase Auth and a generic Postgres table
// (see supabase-setup.sql -> public.documents).
//
// IMPORTANT: the default RLS policies on public.documents are permissive
// (any signed-in user can write to any collection). Tighten them per
// collection before relying on this for anything sensitive (transactions,
// clientGifts, tokens, system).
(function () {
  const client = window.supabaseClient;
  if (!client) {
    console.error("supabaseClient is not ready — check js/supabase-init.js and js/supabase-config.js.");
    return;
  }

  // ---------------------------------------------------------------------
  // auth
  // ---------------------------------------------------------------------
  function toFirebaseUser(supaUser) {
    if (!supaUser) return null;
    const meta = supaUser.user_metadata || {};
    return {
      uid: supaUser.id,
      id: supaUser.id,
      email: supaUser.email || "",
      displayName: meta.full_name || meta.name || (supaUser.email ? supaUser.email.split("@")[0] : ""),
      photoURL: meta.avatar_url || meta.picture || null
    };
  }

  window.auth = {
    onAuthStateChanged(callback) {
      const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
        callback(toFirebaseUser(session?.user));
      });
      return () => sub?.subscription?.unsubscribe();
    },
    async signInWithPopup() {
      // Supabase OAuth is a full-page redirect, not a real popup — the page
      // navigates to Google and back, which is why loginWithGoogle() stashes
      // the current tab in sessionStorage before calling this.
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { access_type: "offline", prompt: "select_account" }
        }
      });
      if (error) throw error;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    }
  };

  // ---------------------------------------------------------------------
  // db (Firestore-shaped, backed by public.documents: collection, id, data)
  // ---------------------------------------------------------------------
  const OP_MAP = { "==": "eq", "!=": "neq", ">": "gt", ">=": "gte", "<": "lt", "<=": "lte" };

  function newId() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function rowToSnapshot(collectionName, row) {
    return {
      id: row.id,
      exists: true,
      data: () => row.data,
      ref: makeDocRef(collectionName, row.id)
    };
  }

  function missingSnapshot(collectionName, id) {
    return { id, exists: false, data: () => undefined, ref: makeDocRef(collectionName, id) };
  }

  function watchCollection(collectionName, onChange) {
    const channel = client
      .channel(`docs:${collectionName}:${newId()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `collection=eq.${collectionName}` }, onChange)
      .subscribe();
    return () => client.removeChannel(channel);
  }

  function makeDocRef(collectionName, id) {
    return {
      id,
      collectionName,
      async get() {
        const { data, error } = await client
          .from("documents")
          .select("*")
          .eq("collection", collectionName)
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data ? rowToSnapshot(collectionName, data) : missingSnapshot(collectionName, id);
      },
      async set(payload, opts = {}) {
        let toWrite = payload;
        if (opts.merge) {
          const existing = await this.get();
          toWrite = Object.assign({}, existing.exists ? existing.data() : {}, payload);
        }
        const { error } = await client
          .from("documents")
          .upsert({ collection: collectionName, id, data: toWrite, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
        if (error) throw error;
      },
      async update(partial) {
        const existing = await this.get();
        const merged = Object.assign({}, existing.exists ? existing.data() : {}, partial);
        const { error } = await client
          .from("documents")
          .upsert({ collection: collectionName, id, data: merged, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
        if (error) throw error;
      },
      async delete() {
        const { error } = await client.from("documents").delete().eq("collection", collectionName).eq("id", id);
        if (error) throw error;
      },
      onSnapshot(callback) {
        this.get().then(callback);
        return watchCollection(collectionName, () => this.get().then(callback));
      }
    };
  }

  function makeQuery(collectionName, filters, order, limitN) {
    filters = filters || [];
    const self = {
      where(field, op, value) {
        return makeQuery(collectionName, filters.concat([{ field, op, value }]), order, limitN);
      },
      orderBy(field, direction) {
        return makeQuery(collectionName, filters, { field, direction: direction || "asc" }, limitN);
      },
      limit(n) {
        return makeQuery(collectionName, filters, order, n);
      },
      async get() {
        let q = client.from("documents").select("*").eq("collection", collectionName);
        filters.forEach((f) => {
          q = q.filter(`data->>${f.field}`, OP_MAP[f.op] || "eq", String(f.value));
        });
        const { data, error } = await q;
        if (error) throw error;
        let rows = data || [];
        if (order) {
          rows = rows.slice().sort((a, b) => {
            const av = a.data ? a.data[order.field] : undefined;
            const bv = b.data ? b.data[order.field] : undefined;
            if (av === bv) return 0;
            const cmp = av > bv ? 1 : -1;
            return order.direction === "desc" ? -cmp : cmp;
          });
        }
        if (limitN) rows = rows.slice(0, limitN);
        const docs = rows.map((row) => rowToSnapshot(collectionName, row));
        return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn) => docs.forEach(fn) };
      },
      onSnapshot(callback) {
        this.get().then(callback);
        return watchCollection(collectionName, () => this.get().then(callback));
      }
    };
    return self;
  }

  function makeCollectionRef(collectionName) {
    const query = makeQuery(collectionName);
    return Object.assign(query, {
      doc(id) {
        return makeDocRef(collectionName, id || newId());
      },
      async add(payload) {
        const ref = makeDocRef(collectionName, newId());
        await ref.set(payload);
        return ref;
      }
    });
  }

  window.db = {
    collection(name) {
      return makeCollectionRef(name);
    },
    batch() {
      const ops = [];
      return {
        set(ref, data, opts) { ops.push(() => ref.set(data, opts)); return this; },
        update(ref, data) { ops.push(() => ref.update(data)); return this; },
        delete(ref) { ops.push(() => ref.delete()); return this; },
        async commit() {
          for (const op of ops) await op();
        }
      };
    },
    // NOTE: this is NOT an atomic transaction like Firestore's — Postgres
    // REST calls here just run sequentially. Fine for the current single
    // read/write use in this app, but don't rely on it for anything that
    // needs real isolation.
    async runTransaction(updateFn) {
      const txn = {
        get: (ref) => ref.get(),
        set: (ref, data, opts) => ref.set(data, opts),
        update: (ref, data) => ref.update(data),
        delete: (ref) => ref.delete()
      };
      return updateFn(txn);
    }
  };
})();
