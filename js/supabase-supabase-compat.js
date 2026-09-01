// Compatibility shim: a lot of index.html was written calling
// `supabase.supabase.FieldValue.arrayUnion(...)`, `.arrayRemove(...)`,
// `.increment(...)`, `.serverTimestamp()`, etc. (toggleLikePost,
// toggleRepost, marking chats as read, view/comment/quote counters, ...).
//
// js/supabase-firebase-compat.js already builds a complete, correctly
// tagged FieldValue implementation and exposes it at
// window.firebase.firestore.FieldValue — the generic db.set()/db.update()
// resolver in that same file only recognizes sentinels created by THAT
// object. This file just aliases it onto window.supabase.supabase.FieldValue
// so every call site above resolves correctly instead of hitting a
// stripped-down fallback that's missing arrayUnion/arrayRemove.
//
// Load order matters: this must run after supabase-firebase-compat.js and
// before anything (e.g. card-tracking-supabase.js) that might otherwise
// install its own partial FieldValue.
(function () {
  const firestoreFieldValue = window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue;
  if (!firestoreFieldValue) {
    console.error("[supabase-supabase-compat] firebase.firestore.FieldValue is not ready — check that supabase-firebase-compat.js loaded first.");
    return;
  }

  window.supabase = window.supabase || {};
  window.supabase.supabase = window.supabase.supabase || {};
  window.supabase.supabase.FieldValue = firestoreFieldValue;

  // The compatibility shim is loaded more than once by the legacy page.
  // Keep the Lunarist integration loader and DOM mount strictly singleton.
  if (!window.__EC_LUNARIST_SCRIPT_LOADING) {
    window.__EC_LUNARIST_SCRIPT_LOADING = true;
    var script = document.createElement('script');
    script.src = './js/lunarist-integration.js?v=2';
    script.async = true;
    script.onerror = function () {
      window.__EC_LUNARIST_SCRIPT_LOADING = false;
      console.warn('[Lunarist] integration module unavailable');
    };
    document.head.appendChild(script);
  }

  // Defensive cleanup for concurrent auth callbacks/mounts. Multiple async
  // mount() calls can race before the first root is appended, creating several
  // elements with the same id. Keep the first connector and remove later ones.
  if (!window.__EC_LUNARIST_DEDUP_OBSERVER) {
    window.__EC_LUNARIST_DEDUP_OBSERVER = true;
    var dedupe = function () {
      var nodes = document.querySelectorAll('#ec-lunarist-fab');
      if (nodes.length > 1) {
        for (var i = 1; i < nodes.length; i++) nodes[i].remove();
      }
    };
    if (document.body) dedupe();
    new MutationObserver(dedupe).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
