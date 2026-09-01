export default async function handler(req, res) {
  try {
    const source = 'https://raw.githubusercontent.com/eugene-card/eugene-card-1/main/index.html';
    const response = await fetch(source, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Homepage source returned ${response.status}`);

    let html = await response.text();

    // Make English the canonical/default language at the document level.
    html = html.replace(/(<html\b[^>]*\blang=["'])(?:id|id-ID|in)(["'])/i, '$1en$2');

    // Apply English before the existing client-side language UI can initialize.
    const bootstrap = `<script data-force-default-english>
(() => {
  try {
    document.documentElement.lang = 'en';
    for (const key of ['language','lang','locale','preferredLanguage','selectedLanguage','currentLanguage']) {
      const value = localStorage.getItem(key);
      if (value && /^(id|id-ID|in)$/i.test(value)) localStorage.setItem(key, 'en');
    }
  } catch (_) {}
})();
</script>`;

    if (!html.includes('data-force-default-english')) {
      html = html.replace(/<head>/i, `<head>\n${bootstrap}`);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.status(200).send(html);
  } catch (error) {
    res.status(502).send('Unable to load the Eugene Card homepage.');
  }
}
