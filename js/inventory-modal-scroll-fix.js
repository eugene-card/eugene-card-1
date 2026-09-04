/* Eugene Card — Inventory card editor modal scrolling fix.
   The global premium modal layer intentionally uses overflow:hidden on modal
   panels, which overrides the original Tailwind overflow-y-auto on the
   Inventory editor. Restore a real bounded scroll container for this modal. */
(function(){
  'use strict';

  const STYLE_ID = 'eugene-inventory-modal-scroll-fix';

  function install(){
    if(!document.head) return;
    let style = document.getElementById(STYLE_ID);
    if(!style){
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      /* The Inventory editor is a fixed modal; ONLY its panel contents scroll. */
      #inventory-edit-modal {
        box-sizing: border-box !important;
        width: 100vw !important;
        max-width: 100vw !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        min-height: 0 !important;
        overflow: hidden !important;
        overscroll-behavior: contain !important;
        -webkit-overflow-scrolling: touch !important;
        align-items: center !important;
        justify-content: center !important;
      }

      #inventory-edit-modal > div:not(.absolute) {
        box-sizing: border-box !important;
        width: min(448px, calc(100vw - 24px)) !important;
        max-width: calc(100vw - 24px) !important;
        height: min(90dvh, 760px) !important;
        max-height: calc(100dvh - 24px) !important;
        min-height: 0 !important;
        margin: 0 !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        overscroll-behavior: contain !important;
        -webkit-overflow-scrolling: touch !important;
        scrollbar-width: thin !important;
        scrollbar-color: rgba(139,92,246,.55) rgba(2,6,23,.35) !important;
        touch-action: pan-y !important;
      }

      #inventory-edit-modal > div:not(.absolute)::-webkit-scrollbar {
        width: 7px;
      }
      #inventory-edit-modal > div:not(.absolute)::-webkit-scrollbar-track {
        background: rgba(2,6,23,.35);
        border-radius: 999px;
      }
      #inventory-edit-modal > div:not(.absolute)::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(129,140,248,.78), rgba(139,92,246,.56));
        border-radius: 999px;
        border: 2px solid rgba(15,23,42,.82);
      }

      /* Keep the close button visible while the form scrolls. */
      #inventory-edit-modal > div:not(.absolute) > button[onclick="closeInventoryModal()"] {
        position: sticky !important;
        top: 0 !important;
        right: auto !important;
        margin-left: auto !important;
        z-index: 1000002 !important;
      }

      #inventory-edit-modal input,
      #inventory-edit-modal select,
      #inventory-edit-modal textarea,
      #inventory-edit-modal button {
        touch-action: manipulation;
      }

      @media (max-width: 640px){
        #inventory-edit-modal {
          align-items: flex-start !important;
          justify-content: center !important;
          padding: 8px !important;
        }
        #inventory-edit-modal > div:not(.absolute) {
          width: 100% !important;
          max-width: calc(100vw - 16px) !important;
          height: calc(100dvh - 16px) !important;
          max-height: calc(100dvh - 16px) !important;
          padding: 18px 16px max(18px, env(safe-area-inset-bottom)) !important;
          border-radius: 22px !important;
        }
      }

      @media (max-width: 380px){
        #inventory-edit-modal {
          padding: 5px !important;
        }
        #inventory-edit-modal > div:not(.absolute) {
          max-width: calc(100vw - 10px) !important;
          height: calc(100dvh - 10px) !important;
          max-height: calc(100dvh - 10px) !important;
          padding-left: 13px !important;
          padding-right: 13px !important;
        }
      }
    `;
  }

  function init(){
    install();
    // Re-install if another UI enhancement replaces <head> styles or the modal.
    const observer = new MutationObserver(() => {
      if(!document.getElementById(STYLE_ID)) install();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
