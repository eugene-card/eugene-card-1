/* Eugene Card — Inventory Edition Manager */
(function () {
  'use strict';

  const CONFIG_COLLECTION = 'system';
  const CONFIG_DOC = 'editionConfig';
  const SELECT_ID = 'edit-card-edition';
  const WRAP_ID = 'inventory-edition-select-wrap';
  const MODAL_ID = 'inventory-add-edition-modal';
  const STYLE_ID = 'eugene-inventory-edition-css';
  let editions = [];
  let ready = false;

  const normalize = value => String(value || '').trim().replace(/\s+/g, ' ');
  const unique = values => [...new Set(values.map(normalize).filter(Boolean))];

  function dbRef() {
    try {
      if (typeof db !== 'undefined' && db && typeof db.collection === 'function') return db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC);
    } catch (_) {}
    return null;
  }

  function getInventoryEditions() {
    try {
      const inv = typeof inventory !== 'undefined' && Array.isArray(inventory) ? inventory : [];
      return unique(inv.map(card => card && card.edition).filter(Boolean));
    } catch (_) { return []; }
  }

  function isAdmin() {
    try { return typeof currentUser !== 'undefined' && currentUser && currentUser.isAdmin; } catch (_) { return false; }
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${WRAP_ID}{display:flex;align-items:center;gap:8px;width:100%;}
      #${WRAP_ID} select{flex:1;min-width:0;}
      #${WRAP_ID} button{flex:0 0 auto;white-space:nowrap;}
      #${MODAL_ID}{z-index:1000000;}
      #${MODAL_ID} .edition-dialog{width:min(420px,calc(100vw - 24px));}
      @media(max-width:640px){
        #${WRAP_ID}{align-items:stretch;flex-direction:column;}
        #${WRAP_ID} .edition-add-btn{width:100%;min-height:42px;}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (document.getElementById(MODAL_ID)) return;
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'fixed inset-0 bg-slate-950/80 backdrop-blur-md hidden items-center justify-center p-4';
    modal.innerHTML = `
      <div class="edition-dialog bg-slate-900 border border-violet-500/30 rounded-3xl p-5 space-y-4 relative shadow-2xl">
        <button type="button" class="edition-close absolute top-3 right-3 w-9 h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        <div class="pr-10">
          <span class="text-[9px] uppercase tracking-[.16em] font-black text-violet-300">Inventory</span>
          <h3 class="text-base font-black text-white mt-1">Add Edition</h3>
          <p class="text-[10px] text-slate-500 mt-1">Create an edition once, then reuse it from the Inventory dropdown.</p>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-400 mb-1">Edition Name</label>
          <input id="inventory-new-edition-input" type="text" maxlength="80" placeholder="e.g. Genesis Edition #1" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500">
        </div>
        <button type="button" id="inventory-save-edition-btn" class="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs transition-all"><i class="fa-solid fa-plus mr-1"></i> Add Edition</button>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.edition-close').addEventListener('click', closeAddEdition);
    modal.addEventListener('click', event => { if (event.target === modal) closeAddEdition(); });
    modal.querySelector('#inventory-save-edition-btn').addEventListener('click', addEdition);
    modal.querySelector('#inventory-new-edition-input').addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); addEdition(); }
      if (event.key === 'Escape') closeAddEdition();
    });
  }

  function showToastSafe(message) {
    try { if (typeof showToast === 'function') showToast(message); } catch (_) {}
  }

  function renderDropdown(selectedValue) {
    const select = document.getElementById(SELECT_ID);
    if (!select) return;
    const current = normalize(selectedValue || select.value);
    const values = unique([...editions, ...getInventoryEditions(), current]);
    editions = values;
    select.innerHTML = '';
    if (!values.length) values.push('Beta Edition: #0');
    values.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    const desired = current || values[0];
    select.value = values.includes(desired) ? desired : values[0];
  }

  function transformEditionField() {
    const input = document.getElementById(SELECT_ID);
    if (!input || input.tagName === 'SELECT') return;
    const wrap = document.createElement('div');
    wrap.id = WRAP_ID;
    const select = document.createElement('select');
    select.id = SELECT_ID;
    select.name = input.name || SELECT_ID;
    select.className = input.className;
    select.setAttribute('aria-label', 'Edition');
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'edition-add-btn px-3 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-[10px] font-black';
    addButton.innerHTML = '<i class="fa-solid fa-plus mr-1"></i> Add Edition';
    addButton.title = 'Add a new edition';
    addButton.addEventListener('click', openAddEdition);
    wrap.appendChild(select);
    wrap.appendChild(addButton);
    input.replaceWith(wrap);
    renderDropdown(input.value);
  }

  async function loadEditions() {
    const ref = dbRef();
    editions = unique(['Beta Edition: #0', ...getInventoryEditions()]);
    if (ref) {
      try {
        const snap = await ref.get();
        if (snap && snap.exists) {
          const data = snap.data() || {};
          editions = unique([...editions, ...(Array.isArray(data.editions) ? data.editions : [])]);
        }
      } catch (error) { console.warn('[Eugene Card] Could not load saved editions:', error); }
    }
    renderDropdown();
    ready = true;
  }

  async function persistEditions() {
    const ref = dbRef();
    if (!ref) throw new Error('Database is not ready.');
    await ref.set({ editions, updatedAt: new Date().toISOString() }, { merge: true });
  }

  function openAddEdition() {
    if (!isAdmin()) return showToastSafe('Admin permission required to add an edition.');
    ensureModal();
    const modal = document.getElementById(MODAL_ID);
    const input = document.getElementById('inventory-new-edition-input');
    if (!modal || !input) return;
    input.value = '';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => input.focus(), 40);
  }

  function closeAddEdition() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  async function addEdition() {
    if (!isAdmin()) return showToastSafe('Admin permission required to add an edition.');
    const input = document.getElementById('inventory-new-edition-input');
    const button = document.getElementById('inventory-save-edition-btn');
    const value = normalize(input && input.value);
    if (!value) return showToastSafe('Enter an edition name first.');
    const existing = editions.find(item => item.toLowerCase() === value.toLowerCase());
    if (existing) {
      renderDropdown(existing);
      document.getElementById(SELECT_ID).value = existing;
      closeAddEdition();
      return showToastSafe('That edition already exists.');
    }
    editions = unique([...editions, value]);
    if (button) { button.disabled = true; button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Saving...'; }
    try {
      await persistEditions();
      renderDropdown(value);
      const select = document.getElementById(SELECT_ID);
      if (select) select.value = value;
      closeAddEdition();
      showToastSafe(`Edition "${value}" added.`);
    } catch (error) {
      editions = editions.filter(item => item !== value);
      showToastSafe('Could not save edition: ' + (error.message || 'Unknown error'));
    } finally {
      if (button) { button.disabled = false; button.innerHTML = '<i class="fa-solid fa-plus mr-1"></i> Add Edition'; }
    }
  }

  function refreshForInventoryModal() {
    if (!ready) return;
    const select = document.getElementById(SELECT_ID);
    if (!select) return;
    renderDropdown(select.value);
  }

  function init() {
    installStyle();
    transformEditionField();
    ensureModal();
    loadEditions();
    const observer = new MutationObserver(() => transformEditionField());
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', event => {
      const editButton = event.target.closest && event.target.closest('[onclick*="openInventoryModal"]');
      if (editButton) setTimeout(refreshForInventoryModal, 0);
    }, true);
  }

  window.EugeneInventoryEditions = { get: () => [...editions], add: addEdition, openAddEdition, closeAddEdition, refresh: refreshForInventoryModal };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
