/* Eugene Card mobile popout surfaces: profile + cart behave like the notification bell. */
(function () {
  'use strict';

  const ROOT_IDS = ['profile-manager-modal', 'cart-drawer-overlay'];
  const PANEL_IDS = ['cart-drawer'];
  const STYLE_ID = 'eugene-notification-style-popouts';
  const HIDDEN_ATTR = 'data-eugene-duplicate-popup';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
@media (max-width:768px){
  #profile-manager-modal,
  #cart-drawer-overlay{
    position:fixed!important;
    inset:0!important;
    z-index:999999!important;
    background:rgba(2,6,23,.28)!important;
    pointer-events:none!important;
    padding:0!important;
    overflow:visible!important;
  }

  #profile-manager-modal[${HIDDEN_ATTR}="1"],
  #cart-drawer-overlay[${HIDDEN_ATTR}="1"],
  #cart-drawer[${HIDDEN_ATTR}="1"]{
    display:none!important;
  }

  #profile-manager-modal > *:first-child,
  #cart-drawer{
    pointer-events:auto!important;
    position:fixed!important;
    z-index:1000000!important;
    box-sizing:border-box!important;
    left:12px!important;
    right:12px!important;
    top:max(84px, calc(env(safe-area-inset-top) + 72px))!important;
    bottom:auto!important;
    width:auto!important;
    max-width:none!important;
    height:calc(100dvh - max(84px, calc(env(safe-area-inset-top) + 72px)) - max(84px, calc(env(safe-area-inset-bottom) + 72px)))!important;
    max-height:calc(100dvh - max(84px, calc(env(safe-area-inset-top) + 72px)) - max(84px, calc(env(safe-area-inset-bottom) + 72px)))!important;
    overflow-y:auto!important;
    overflow-x:hidden!important;
    -webkit-overflow-scrolling:touch!important;
    overscroll-behavior:contain!important;
    touch-action:pan-y!important;
    border-radius:24px!important;
    border:1px solid rgba(139,92,246,.42)!important;
    background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(3,7,18,.98))!important;
    box-shadow:0 24px 70px rgba(0,0,0,.58),0 0 38px rgba(99,102,241,.20)!important;
    transform-origin:top center!important;
    animation:eugenePopoutIn .18s ease-out!important;
  }

  #profile-manager-modal > *:first-child{
    padding-bottom:24px!important;
    scrollbar-width:thin!important;
  }

  #profile-manager-modal .profile-manager-modal-panel{
    height:auto!important;
    min-height:0!important;
    max-height:none!important;
    overflow:visible!important;
  }

  #cart-drawer{
    padding-top:8px!important;
    padding-bottom:max(12px,env(safe-area-inset-bottom))!important;
    scrollbar-width:thin!important;
  }

  #profile-manager-modal button,
  #cart-drawer button{
    touch-action:manipulation!important;
  }

  #profile-manager-modal button[aria-label*="lose" i],
  #profile-manager-modal button[title*="lose" i],
  #cart-drawer button[aria-label*="lose" i],
  #cart-drawer button[title*="lose" i]{
    position:absolute!important;
    top:10px!important;
    right:10px!important;
    z-index:1000001!important;
    width:44px!important;
    height:44px!important;
    min-width:44px!important;
    min-height:44px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    border-radius:14px!important;
  }

  @keyframes eugenePopoutIn{
    from{opacity:0;transform:translateY(-10px) scale(.98)}
    to{opacity:1;transform:none}
  }
}
`;
    document.head.appendChild(s);
  }

  function allById(id) {
    return Array.from(document.querySelectorAll('[id="' + id + '"]'));
  }

  function isHidden(el) {
    if (!el) return true;
    if (el.hasAttribute(HIDDEN_ATTR)) return true;
    if (el.hidden) return true;
    const cs = window.getComputedStyle(el);
    return cs.display === 'none' || cs.visibility === 'hidden';
  }

  function dedupe(id) {
    const els = allById(id);
    if (els.length <= 1) return els[0] || null;

    let keeper = els.find(el => !isHidden(el));
    if (!keeper) keeper = els[0];

    els.forEach(el => {
      if (el === keeper) {
        el.removeAttribute(HIDDEN_ATTR);
        return;
      }
      el.setAttribute(HIDDEN_ATTR, '1');
      el.style.setProperty('display', 'none', 'important');
    });
    return keeper;
  }

  function moveToBody(el) {
    if (el && el.parentElement !== document.body) document.body.appendChild(el);
  }

  function prepare() {
    installStyle();

    ROOT_IDS.forEach(id => {
      const el = dedupe(id);
      if (el) moveToBody(el);
    });

    PANEL_IDS.forEach(id => {
      const el = dedupe(id);
      if (el) moveToBody(el);
    });
  }

  function run() {
    prepare();
    const observer = new MutationObserver(() => prepare());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(prepare, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
