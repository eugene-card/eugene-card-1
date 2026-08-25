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

  const dedupeProfileEditors = () => {
    const candidates = [...document.querySelectorAll('.ec-modal')].filter(el => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').toLowerCase();
      return text.includes('profile customization') || text.includes('customize profile');
    });
    if (candidates.length <= 1) return;

    // There are two generations of the profile editor in the app. Keep the
    // newest/full editor (photo upload + social fields) and remove the legacy
    // display-name/username/avatar-URL-only editor.
    const score = el => {
      const text = (el.textContent || '').toLowerCase();
      return (el.querySelector('input[type="file"]') ? 100 : 0)
        + (text.includes('instagram') ? 20 : 0)
        + (text.includes('tiktok') ? 20 : 0)
        + (/\bx\b/.test(text) ? 20 : 0)
        + (text.includes('website') ? 20 : 0)
        + (text.includes('profile photo') ? 10 : 0)
        + (el.querySelector('#ec-save-profile') ? 10 : 0);
    };
    const keep = candidates.sort((a, b) => score(b) - score(a))[0];
    candidates.forEach(el => {
      if (el !== keep) el.setAttribute('data-eugene-duplicate', '1');
      if (el !== keep) el.remove();
    });
  };

  const clean = () => {
    // Enhancement scripts can be injected more than once during SPA navigation.
    keepOne('.ec-dock', () => 'dock');
    keepOne('#ec-notifications', () => 'notifications');
    keepOne('#ec-inbox', () => 'inbox');
    keepOne('#ec-cart', () => 'cart');
    dedupeProfileEditors();

    // Keep one navigation control per destination while preserving the app's
    // original controls and their order.
    keepOne('header nav a, header nav button, .nav a, .nav button', el => {
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const href = (el.getAttribute('href') || '').toLowerCase();
      if (!text && !href) return '';
      if (/^sell$/.test(text)) return '';
      return `nav:${href || text}`;
    });

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
