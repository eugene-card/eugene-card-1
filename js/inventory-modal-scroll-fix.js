/* Eugene Card — Inventory card editor modal: one modal + internal scrolling. */
(function(){
  'use strict';
  const STYLE_ID='eugene-inventory-modal-scroll-fix';

  function install(){
    if(!document.head)return;
    let style=document.getElementById(STYLE_ID);
    if(!style){style=document.createElement('style');style.id=STYLE_ID;document.head.appendChild(style);}
    style.textContent=`
      #inventory-edit-modal{
        box-sizing:border-box!important;
        width:100vw!important;max-width:100vw!important;
        height:100dvh!important;max-height:100dvh!important;
        min-height:0!important;overflow:hidden!important;
        overscroll-behavior:contain!important;
        align-items:center!important;justify-content:center!important;
      }
      #inventory-edit-modal > div:not(.absolute){
        box-sizing:border-box!important;
        width:min(448px,calc(100vw - 24px))!important;
        max-width:calc(100vw - 24px)!important;
        height:min(90dvh,760px)!important;
        max-height:calc(100dvh - 24px)!important;
        min-height:0!important;margin:0!important;
        overflow-x:hidden!important;overflow-y:auto!important;
        overscroll-behavior:contain!important;
        -webkit-overflow-scrolling:touch!important;
        scrollbar-width:thin!important;
        scrollbar-color:rgba(139,92,246,.65) rgba(2,6,23,.35)!important;
        touch-action:pan-y!important;
      }
      #inventory-edit-modal > div:not(.absolute)::-webkit-scrollbar{width:7px}
      #inventory-edit-modal > div:not(.absolute)::-webkit-scrollbar-track{background:rgba(2,6,23,.35);border-radius:999px}
      #inventory-edit-modal > div:not(.absolute)::-webkit-scrollbar-thumb{background:rgba(139,92,246,.65);border-radius:999px;border:2px solid rgba(15,23,42,.82)}
      #inventory-edit-modal > div:not(.absolute) > button[onclick="closeInventoryModal()"]{
        position:sticky!important;top:0!important;right:auto!important;margin-left:auto!important;
        z-index:1000002!important;touch-action:manipulation!important;
      }
      #inventory-edit-modal input,#inventory-edit-modal select,#inventory-edit-modal textarea,#inventory-edit-modal button{touch-action:manipulation}
      @media(max-width:640px){
        #inventory-edit-modal{align-items:flex-start!important;justify-content:center!important;padding:8px!important}
        #inventory-edit-modal > div:not(.absolute){
          width:100%!important;max-width:calc(100vw - 16px)!important;
          height:calc(100dvh - 16px)!important;max-height:calc(100dvh - 16px)!important;
          padding:18px 16px max(18px,env(safe-area-inset-bottom))!important;border-radius:22px!important;
        }
      }
      @media(max-width:380px){
        #inventory-edit-modal{padding:5px!important}
        #inventory-edit-modal > div:not(.absolute){max-width:calc(100vw - 10px)!important;height:calc(100dvh - 10px)!important;max-height:calc(100dvh - 10px)!important;padding-left:13px!important;padding-right:13px!important}
      }
    `;
  }

  function fixModal(){
    const modals=[...document.querySelectorAll('[id="inventory-edit-modal"]')];
    if(!modals.length)return;
    // The source currently contains the editor twice. The app's open/close
    // functions use getElementById(), so keep the first instance and remove
    // the duplicate to prevent competing hidden/visible modal layers.
    for(let i=1;i<modals.length;i++)modals[i].remove();
    const modal=document.getElementById('inventory-edit-modal');
    if(!modal)return;
    const panel=modal.querySelector(':scope > div:not(.absolute)');
    if(!panel)return;
    panel.style.setProperty('height','min(90dvh, 760px)','important');
    panel.style.setProperty('max-height','calc(100dvh - 24px)','important');
    panel.style.setProperty('min-height','0','important');
    panel.style.setProperty('overflow-y','auto','important');
    panel.style.setProperty('overflow-x','hidden','important');
    panel.style.setProperty('touch-action','pan-y','important');
    panel.style.setProperty('-webkit-overflow-scrolling','touch','important');
  }

  function init(){
    install();
    fixModal();
    const observer=new MutationObserver(()=>{if(!document.getElementById(STYLE_ID))install();fixModal();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
