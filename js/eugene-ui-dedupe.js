(() => {
  'use strict';
  if (window.__eugeneUiDedupe) return;
  window.__eugeneUiDedupe = true;

  const keepOne = (selector, keyFn) => {
    const seen = new Set();
    document.querySelectorAll(selector).forEach(el => {
      const key = keyFn(el);
      if (!key) return;
      if (seen.has(key)) el.remove();
      else seen.add(key);
    });
  };

  const clean = () => {
    // Enhancement scripts can be injected more than once during SPA navigation.
    // Keep one global dock and one panel/modal for each singleton feature.
    keepOne('.ec-dock', () => 'dock');
    keepOne('#ec-notifications', () => 'notifications');
    keepOne('#ec-inbox', () => 'inbox');
    keepOne('#ec-cart', () => 'cart');

    // Keep one navigation control per destination while preserving the app's
    // original controls and their order.
    keepOne('header nav a, header nav button, .nav a, .nav button', el => {
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const href = (el.getAttribute('href') || '').toLowerCase();
      if (!text && !href) return '';
      if (/^sell$/.test(text)) return '';
      return `nav:${href || text}`;
    });

    // Do not let enhancement panels squeeze or collapse the main application.
    document.documentElement.classList.add('eugene-ui-normalized');
  };

  const style = document.createElement('style');
  style.id = 'eugene-ui-normalized-style';
  style.textContent = `
    html.eugene-ui-normalized, html.eugene-ui-normalized body { min-height:100%; }
    .ec-dock { z-index: 1001; flex-shrink:0; }
    .ec-panel { max-width: min(420px, calc(100vw - 16px)); box-sizing:border-box; }
    .ec-modal { overflow:auto; }
    .ec-card { box-sizing:border-box; }
    .ec-dock + .ec-dock { display:none !important; }
    [data-eugene-duplicate="1"] { display:none !important; }
  `;
  document.head.appendChild(style);

  clean();
  const observer = new MutationObserver(() => clean());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('pageshow', clean);
  window.addEventListener('popstate', () => setTimeout(clean, 0));
})();
