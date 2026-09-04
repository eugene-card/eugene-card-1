/* Eugene Card — card-linked Client Edition + Beta trade privilege + Catalog default */
(function () {
  'use strict';

  const CLIENT_KEY = 'client_edition';
  const BENEFIT_KEY = 'free_trade_tax';
  const DEFAULT_CATALOG_ID = 'view-catalog';
  let wrapped = false;

  const normalize = value => String(value || '').trim().replace(/\s+/g, ' ');

  function isBetaEdition(card) {
    const edition = normalize(card?.edition);
    return /^beta\s+edition\b/i.test(edition) || /\bbeta\s+edition\b/i.test(edition);
  }

  function hasClientEdition(card) {
    const metadata = card?.metadata && typeof card.metadata === 'object' ? card.metadata : {};
    return metadata[CLIENT_KEY] === true || normalize(metadata[CLIENT_KEY]).toLowerCase() === 'client edition';
  }

  function hasFreeTradeTax(card) {
    return !!card && (isBetaEdition(card) || hasClientEdition(card));
  }

  function getTradeTaxRate(card) {
    return hasFreeTradeTax(card) ? 0 : 0.02;
  }

  function getTradeBenefit(card) {
    if (hasClientEdition(card)) return { exempt: true, source: 'Client Edition', rate: 0 };
    if (isBetaEdition(card)) return { exempt: true, source: 'Beta Edition', rate: 0 };
    return { exempt: false, source: null, rate: 0.02 };
  }

  async function saveClientEdition(cardId, enabled) {
    const client = window.supabaseClient;
    if (!client || !cardId) throw new Error('Database is not ready.');
    const card = Array.isArray(window.inventory) ? window.inventory.find(c => String(c.id) === String(cardId)) : null;
    const metadata = card?.metadata && typeof card.metadata === 'object' ? { ...card.metadata } : {};
    if (enabled) {
      metadata[CLIENT_KEY] = true;
      metadata[BENEFIT_KEY] = true;
    } else {
      delete metadata[CLIENT_KEY];
      delete metadata[BENEFIT_KEY];
    }
    const { data, error } = await client.from('cards').update({ metadata }).eq('id', String(cardId)).select('*').maybeSingle();
    if (error) throw error;
    if (card) card.metadata = data?.metadata || metadata;
    return data || card;
  }

  function injectStyles() {
    if (document.getElementById('eugene-client-edition-css')) return;
    const style = document.createElement('style');
    style.id = 'eugene-client-edition-css';
    style.textContent = `
      #eugene-client-edition-field{grid-column:1/-1}
      #eugene-client-edition-field .ce-help{font-size:9px;color:#64748b;margin-top:5px;line-height:1.35}
      #eugene-client-edition-field select{width:100%}
      .eugene-edition-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:999px;border:1px solid rgba(236,72,153,.3);background:rgba(236,72,153,.08);color:#f9a8d4;font-size:9px;font-weight:900;letter-spacing:.04em}
      .eugene-beta-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:999px;border:1px solid rgba(245,158,11,.3);background:rgba(245,158,11,.08);color:#fbbf24;font-size:9px;font-weight:900;letter-spacing:.04em}
    `;
    document.head.appendChild(style);
  }

  function ensureClientField() {
    const edition = document.getElementById('edit-card-edition');
    if (!edition || document.getElementById('eugene-client-edition-field')) return;
    const host = edition.closest('div');
    const field = document.createElement('div');
    field.id = 'eugene-client-edition-field';
    field.innerHTML = `
      <label class="block font-bold text-slate-400 mb-1">Additional Edition</label>
      <select id="edit-card-client-edition" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none">
        <option value="">No Client Edition</option>
        <option value="Client Edition">Client Edition</option>
      </select>
      <p class="ce-help">Client Edition stays attached to this card permanently. If the card is sold or traded, the current holder keeps the 0% direct-trade tax benefit.</p>`;
    if (host?.parentElement) host.parentElement.appendChild(field);
  }

  function fillClientField(card) {
    ensureClientField();
    const field = document.getElementById('edit-card-client-edition');
    if (!field) return;
    field.value = hasClientEdition(card) ? 'Client Edition' : '';
  }

  function wrapInventoryModal() {
    if (wrapped || typeof window.openInventoryModal !== 'function' || typeof window.saveInventoryCardChanges !== 'function') return;
    wrapped = true;
    const originalOpen = window.openInventoryModal;
    const originalSave = window.saveInventoryCardChanges;

    window.openInventoryModal = function (cardId) {
      const result = originalOpen.apply(this, arguments);
      setTimeout(() => {
        const card = Array.isArray(window.inventory) ? window.inventory.find(c => String(c.id) === String(cardId)) : null;
        ensureClientField();
        fillClientField(card);
      }, 0);
      return result;
    };

    window.saveInventoryCardChanges = async function () {
      const cardId = document.getElementById('edit-card-id')?.value;
      const enabled = document.getElementById('edit-card-client-edition')?.value === 'Client Edition';
      let before = null;
      if (cardId && Array.isArray(window.inventory)) before = window.inventory.find(c => String(c.id) === String(cardId));
      try {
        const result = await originalSave.apply(this, arguments);
        if (cardId) await saveClientEdition(cardId, enabled);
        return result;
      } catch (error) {
        console.error('[Eugene Card] Client Edition save failed:', error);
        if (before && cardId) {
          try { await saveClientEdition(cardId, hasClientEdition(before)); } catch (_) {}
        }
        throw error;
      }
    };
  }

  function showCatalogByDefault() {
    const catalog = document.getElementById(DEFAULT_CATALOG_ID);
    if (!catalog) return;
    const home = document.getElementById('view-home');
    if (home && !home.classList.contains('hidden')) home.classList.add('hidden');
    catalog.classList.remove('hidden');

    // Keep the existing navigation intact; only mark the Catalog destination active.
    document.querySelectorAll('nav button,[role="tab"],button').forEach(btn => {
      const label = normalize(btn.textContent).toLowerCase();
      if (!label) return;
      if (label === 'catalog' || label.includes('catalog')) {
        btn.classList.add('bg-slate-800');
        btn.setAttribute('aria-selected', 'true');
      }
    });
    try { if (typeof renderCardGrid === 'function') renderCardGrid(); } catch (_) {}
  }

  function patchTradeUI() {
    const trade = document.getElementById('view-trade');
    if (!trade || trade.dataset.eugeneTradeBenefitPatched === '1') return;
    trade.dataset.eugeneTradeBenefitPatched = '1';
    const p = trade.querySelector('p');
    if (p && /2% tax per trade/i.test(p.textContent || '')) {
      p.textContent = (p.textContent || '').replace(/2% tax per trade/i, '0% tax on Client Edition / Beta Edition • 2% standard tax');
    }
  }

  function exposeHelpers() {
    window.EugeneCardBenefits = { isBetaEdition, hasClientEdition, hasFreeTradeTax, getTradeTaxRate, getTradeBenefit, saveClientEdition };
  }

  function init() {
    injectStyles();
    exposeHelpers();
    wrapInventoryModal();
    ensureClientField();
    showCatalogByDefault();
    patchTradeUI();

    const observer = new MutationObserver(() => {
      wrapInventoryModal();
      ensureClientField();
      patchTradeUI();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
