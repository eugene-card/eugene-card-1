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
  // Idempotent + non-destructive: if something already installed a full
  // FieldValue here, don't clobber it. Otherwise, always point at the
  // canonical implementation.
  window.supabase.supabase = window.supabase.supabase || {};
  window.supabase.supabase.FieldValue = firestoreFieldValue;
})();
