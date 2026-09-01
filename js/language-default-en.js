/* Force Eugene Card's default UI language to English (EN). */
(function () {
  'use strict';
  const KEYS = ['language', 'lang', 'locale', 'preferredLanguage', 'selectedLanguage', 'ec-language'];
  function forceEnglish() {
    try { document.documentElement.lang = 'en'; } catch (_) {}
    try {
      KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if (!v || /^(id|id-id|ind|indonesian|bahasa indonesia)$/i.test(v)) localStorage.setItem(k, 'en');
      });
    } catch (_) {}
    ['setLanguage', 'changeLanguage', 'switchLanguage', 'setLocale', 'changeLocale'].forEach(name => {
      try { if (typeof window[name] === 'function') window[name]('en'); } catch (_) {}
    });
    document.querySelectorAll('select').forEach(select => {
      const option = [...select.options].find(o => /^(en|en-us|english)$/i.test(o.value) || /^(english|en)$/i.test(o.textContent.trim()));
      if (option && /^(id|id-id|ind|indonesian|bahasa indonesia)$/i.test(select.value)) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    document.querySelectorAll('button,a,[role="button"]').forEach(el => {
      const text = (el.textContent || '').trim().toLowerCase();
      const value = (el.getAttribute('data-language') || el.getAttribute('data-lang') || el.getAttribute('value') || '').toLowerCase();
      if (value === 'en' || value === 'english' || text === 'english' || text === 'en') {
        const parent = el.closest('[class*="language" i],[id*="language" i],[class*="lang" i],[id*="lang" i]');
        if (parent && !el.disabled) {
          try { el.click(); } catch (_) {}
        }
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', forceEnglish, { once: true });
  else forceEnglish();
  window.addEventListener('load', forceEnglish, { once: true });
  const observer = new MutationObserver(() => { if (document.documentElement.lang !== 'en') forceEnglish(); });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
