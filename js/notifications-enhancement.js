/* Eugene Card notification UX enhancement.
 * Adds unread state, Mark all as read, clickable notifications, and target navigation
 * without rewriting the large legacy notification implementation in index.html.
 */
(function () {
  const STORAGE_KEY = 'eugene_notifications';
  const COOKIE_KEY = 'eugene_notifications';
  let installed = false;

  function readNotifications() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) { return []; }
  }

  function saveNotifications(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      const expires = new Date(Date.now() + 7 * 86400000).toUTCString();
      document.cookie = encodeURIComponent(COOKIE_KEY) + '=' + encodeURIComponent(JSON.stringify(list)) + '; expires=' + expires + '; path=/; SameSite=Lax';
    } catch (_) {}
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[c];
    });
  }

  function normalize(list) {
    return list.map(function (n, i) {
      if (!n || typeof n !== 'object') return null;
      return Object.assign({}, n, {
        id: n.id || ('notif-' + Date.now() + '-' + i),
        read: n.read === true,
        url: n.url || n.targetUrl || n.href || '',
        target: n.target || n.targetTab || ''
      });
    }).filter(Boolean);
  }

  function inferTarget(n) {
    if (n.url) return n.url;
    const text = ((n.title || '') + ' ' + (n.message || '')).toLowerCase();
    if (text.includes('auction')) return { tab: 'auction' };
    if (text.includes('trade')) return { tab: 'trade' };
    if (text.includes('order') || text.includes('paid') || text.includes('sell-back') || text.includes('sellback')) return { tab: 'history' };
    if (text.includes('profile')) return { tab: 'profile' };
    if (text.includes('inventory') || text.includes('card updated')) return { tab: 'inventory' };
    if (text.includes('wishlist')) return { tab: 'wishlist' };
    if (text.includes('vault')) return { tab: 'vault' };
    if (text.includes('inbox') || text.includes('message') || text.includes('chat')) return { tab: 'inbox' };
    return null;
  }

  function navigateTarget(target) {
    if (!target) return;
    if (typeof target === 'string') {
      if (/^https?:\/\//i.test(target) || target.startsWith('/') || target.startsWith('./') || target.startsWith('../') || target.startsWith('#')) {
        window.location.href = target;
        return;
      }
      target = { tab: target };
    }
    if (target.url) {
      window.location.href = target.url;
      return;
    }
    const tab = target.tab || target.targetTab;
    if (tab && typeof window.switchTab === 'function') {
      window.switchTab(tab);
      return;
    }
    if (target.cardId && typeof window.openCardDetailModal === 'function') {
      window.openCardDetailModal(target.cardId);
    }
  }

  function setRead(id) {
    const list = normalize(readNotifications());
    const item = list.find(function (n) { return n.id === id; });
    if (item) item.read = true;
    saveNotifications(list);
    render();
  }

  function markAllAsRead() {
    const list = normalize(readNotifications()).map(function (n) {
      return Object.assign({}, n, { read: true });
    });
    saveNotifications(list);
    if (Array.isArray(window.systemNotifications)) {
      window.systemNotifications = list;
    }
    render();
    if (typeof window.showToast === 'function') window.showToast('All notifications marked as read.');
  }

  function render() {
    const listEl = document.getElementById('notification-list');
    const badge = document.getElementById('notification-badge');
    if (!listEl) return;

    const notifications = normalize(readNotifications());
    if (Array.isArray(window.systemNotifications)) {
      window.systemNotifications = notifications;
    }

    const unreadCount = notifications.filter(function (n) { return !n.read; }).length;
    if (badge) {
      badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      badge.classList.toggle('hidden', unreadCount === 0);
      badge.classList.toggle('flex', unreadCount > 0);
    }

    const header = listEl.parentElement ? listEl.parentElement.querySelector('[data-notification-actions]') : null;
    if (header) {
      header.querySelector('[data-mark-all-read]')?.classList.toggle('hidden', unreadCount === 0);
    }

    if (!notifications.length) {
      const dict = window.i18nDict && window.currentLanguage && window.i18nDict[window.currentLanguage];
      listEl.innerHTML = '<div class="p-6 text-center text-xs text-slate-500">' + esc(dict?.noNotifications || 'No recent notifications.') + '</div>';
      return;
    }

    listEl.innerHTML = notifications.map(function (n) {
      const target = inferTarget(n);
      const clickable = !!target;
      const unread = !n.read;
      const targetAttr = target ? ' data-notification-target="' + esc(typeof target === 'string' ? target : (target.url || target.tab || '')) + '"' : '';
      return '<div role="button" tabindex="0" data-notification-id="' + esc(n.id) + '" class="p-3 transition-colors flex items-start gap-3 text-xs ' +
        (clickable ? 'cursor-pointer hover:bg-slate-950/85 ' : 'cursor-default ') +
        (unread ? 'bg-indigo-500/10 border-l-2 border-indigo-400 ' : 'opacity-75 ') + '"' + targetAttr + '>' +
        '<div class="mt-0.5 p-2 rounded-xl bg-slate-950 border border-slate-800 relative"><i class="fa-solid ' + esc(n.iconClass || 'fa-info-circle text-indigo-400') + '"></i>' +
        (unread ? '<span class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-400"></span>' : '') + '</div>' +
        '<div class="flex-1 min-w-0 space-y-0.5"><div class="flex justify-between items-center gap-2">' +
        '<span class="font-extrabold ' + (unread ? 'text-white' : 'text-slate-300') + ' text-[11px] truncate">' + esc(n.title) + '</span>' +
        '<span class="text-[9px] font-mono text-slate-500 shrink-0">' + esc(n.time) + '</span></div>' +
        '<p class="text-[11px] ' + (unread ? 'text-slate-300' : 'text-slate-500') + ' leading-snug">' + esc(n.message) + '</p>' +
        (clickable ? '<div class="mt-1 text-[9px] font-bold text-indigo-400"><i class="fa-solid fa-arrow-right"></i> Open</div>' : '') +
        '</div></div>';
    }).join('');
  }

  function install() {
    if (installed) return;
    if (!document.getElementById('notification-list')) return;
    installed = true;

    // Mark existing notifications as unread unless explicitly read.
    const existing = normalize(readNotifications());
    saveNotifications(existing);

    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) {
      const header = dropdown.querySelector('.p-3\.5.border-b') || dropdown.firstElementChild;
      if (header && !header.querySelector('[data-notification-actions]')) {
        const actions = document.createElement('div');
        actions.setAttribute('data-notification-actions', '');
        actions.className = 'flex items-center gap-1.5';
        actions.innerHTML = '<button type="button" data-mark-all-read class="px-2 py-1 rounded-lg text-[9px] font-black text-indigo-300 hover:text-white hover:bg-indigo-500/20 transition-colors" title="Mark all as read"><i class="fa-solid fa-check-double"></i> Mark all as read</button>';
        header.appendChild(actions);
        actions.querySelector('[data-mark-all-read]').addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          markAllAsRead();
        });
      }
    }

    const listEl = document.getElementById('notification-list');
    listEl.addEventListener('click', function (event) {
      const row = event.target.closest('[data-notification-id]');
      if (!row) return;
      const id = row.getAttribute('data-notification-id');
      const notifications = normalize(readNotifications());
      const item = notifications.find(function (n) { return n.id === id; });
      if (!item) return;
      item.read = true;
      saveNotifications(notifications);
      if (Array.isArray(window.systemNotifications)) window.systemNotifications = notifications;
      render();
      const target = inferTarget(item);
      if (target) {
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
        setTimeout(function () { navigateTarget(target); }, 0);
      }
    });
    listEl.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const row = event.target.closest('[data-notification-id]');
      if (row) { event.preventDefault(); row.click(); }
    });

    // Replace the legacy renderer after all inline functions are defined.
    if (typeof window.renderNotifications === 'function') {
      window.__legacyRenderNotifications = window.renderNotifications;
      window.renderNotifications = render;
    }

    // Preserve target URLs and unread state for future notifications.
    if (typeof window.addNotification === 'function') {
      window.__legacyAddNotification = window.addNotification;
      window.addNotification = function (title, message, iconClass, options) {
        options = options || {};
        window.__legacyAddNotification(title, message, iconClass, options);
        const notifications = normalize(readNotifications());
        const newest = notifications[0];
        if (newest) {
          newest.read = false;
          newest.url = options.url || options.targetUrl || options.href || newest.url || '';
          newest.target = options.target || options.targetTab || newest.target || '';
          saveNotifications(notifications);
        }
        render();
      };
    }

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
  // Inline application code is large and may define the legacy functions after
  // DOMContentLoaded listeners are registered, so retry once on the next tick.
  setTimeout(install, 0);
})();
