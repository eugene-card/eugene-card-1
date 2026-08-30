/* Catalog image reliability layer.
 * Keeps the exact image URL stored for a card, normalizes common share links,
 * prevents CSS from cropping/distorting artwork, and retries image rendering
 * after dynamic catalog updates.
 */
(function () {
  'use strict';

  const PLACEHOLDER = '';
  const seen = new WeakMap();

  function clean(value) {
    if (value == null) return '';
    let s = String(value).trim();
    if (!s) return '';

    // Values occasionally arrive JSON/string-encoded from legacy records.
    if ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'")) {
      s = s.slice(1, -1).trim();
    }
    return s;
  }

  function normalizeImageUrl(value) {
    let url = clean(value);
    if (!url) return PLACEHOLDER;

    // Do not alter browser-local or inline image data.
    if (/^(data:image\/|blob:)/i.test(url)) return url;

    // Protocol-relative URLs.
    if (url.startsWith('//')) return 'https:' + url;

    // GitHub blob links are HTML pages, not image resources.
    const gh = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
    if (gh) return `https://raw.githubusercontent.com/${gh[1]}/${gh[2]}/${gh[4].replace(/ /g, '%20')}`;

    // Google Drive share/file links -> image endpoint.
    const drive = url.match(/^https?:\/\/(?:drive\.google\.com)\/file\/d\/([^/]+)/i);
    if (drive) return `https://drive.google.com/uc?export=view&id=${drive[1]}`;
    const driveOpen = url.match(/^https?:\/\/drive\.google\.com\/open\?id=([^&]+)/i);
    if (driveOpen) return `https://drive.google.com/uc?export=view&id=${driveOpen[1]}`;

    // Dropbox share links can be rendered directly with raw=1.
    if (/^https?:\/\/www\.dropbox\.com\//i.test(url)) {
      url = url.replace(/[?&]dl=0\b/i, '').replace(/[?&]raw=0\b/i, '');
      url += (url.includes('?') ? '&' : '?') + 'raw=1';
      return url;
    }

    // Root-relative and relative paths should remain on the deployed site.
    try {
      return new URL(url, window.location.href).href;
    } catch (_) {
      return url;
    }
  }

  function pickSource(img) {
    const attrs = [
      img.getAttribute('data-image-url'),
      img.getAttribute('data-img-url'),
      img.getAttribute('data-src'),
      img.getAttribute('data-original'),
      img.getAttribute('data-image'),
      img.getAttribute('src')
    ];
    for (const value of attrs) {
      const cleaned = clean(value);
      if (cleaned && !/^about:blank$/i.test(cleaned) && !/^(?:#|placeholder)/i.test(cleaned)) return cleaned;
    }
    return '';
  }

  function prepare(img) {
    if (!(img instanceof HTMLImageElement)) return;

    const source = pickSource(img);
    if (!source) return;
    const normalized = normalizeImageUrl(source);
    if (!normalized) return;

    const previous = seen.get(img);
    if (previous === normalized && img.src === normalized) return;
    seen.set(img, normalized);

    // Catalog artwork must preserve the actual uploaded/link image proportions.
    img.style.objectFit = 'contain';
    img.style.objectPosition = 'center';
    img.style.display = 'block';
    img.removeAttribute('width');
    img.removeAttribute('height');
    img.decoding = 'async';
    img.loading = img.loading || 'lazy';

    if (img.src !== normalized) img.src = normalized;
    img.dataset.resolvedImageUrl = normalized;

    if (!img.dataset.catalogImageErrorBound) {
      img.dataset.catalogImageErrorBound = '1';
      img.addEventListener('error', function () {
        // Never replace a broken real image with another card's image.
        // Keep the original URL available for debugging/retry.
        img.dataset.imageLoadError = 'true';
        img.dataset.failedImageUrl = normalized;
      }, { passive: true });
    }
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    if (root instanceof HTMLImageElement) prepare(root);
    root.querySelectorAll('img').forEach(prepare);
  }

  window.resolveCatalogImageUrl = normalizeImageUrl;
  window.refreshCatalogImages = function () { scan(document); };

  function boot() {
    scan(document);
    const observer = new MutationObserver(function (mutations) {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) scan(node);
        });
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLImageElement) {
          prepare(mutation.target);
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['src', 'data-src', 'data-image-url', 'data-img-url', 'data-original', 'data-image']
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
