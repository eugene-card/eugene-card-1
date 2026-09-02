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

  // NOTE: js/lunarist-integration.js is loaded exactly once, by the script
  // list in js/supabase-init.js. It used to also be injected from here,
  // which loaded the module twice (under two different URLs) and produced
  // duplicate "Lunarist Connected" pills in the nav. Do not re-add a loader
  // here — lunarist-integration.js is also self-healing (see its own
  // dedupe-on-mount logic) in case this file still ends up on the page
  // more than once.
})();
