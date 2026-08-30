/* Eugene Card notification UX fix.
 * Uses the legacy systemNotifications array as the source of truth.
 * Read state is stored separately so notifications are never wiped by this module.
 */
(function () {
  const READ_KEY = 'eugene_notification_read_v2';
  let installed = false;
  let boundList = false;

  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(READ_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_) { return {}; }
  }

  function saveState(state) {
    try { localStorage.setItem(READ_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[c];
    });
  }

  function sourceList() {
    return Array.isArray(window.systemNotifications) ? window.systemNotifications : [];
  }

  function idFor(n, index) {
    if (n && (n.id || n.notificationId)) return String(n.id || n.notificationId);
    const raw = [n?.title, n?.message, n?.time, n?.createdAt, index].join('|');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    return 'legacy-' + Math.abs(hash);
  }

  function targetFor(n) {
    if (!n) return null;
    const explicit = n.url || n.href || n.targetUrl || n.link || n.destination;
    if (explicit) return { url: String(explicit) };

    const target = n.target || n.targetTab || n.tab || n.view || n.route;
    if (target) return { tab: String(target) };

    const action = n.action;
    if (typeof action === 'string') {
      if (/^https?:\/\//i.test(action) || action.startsWith('/') || action.startsWith('#')) return { url: action };
      return { tab: action };
    }

    const text = String((n.title || '') + ' ' + (n.message || '')).toLowerCase();
    if (text.includes('auction') || text.includes('lelang')) return { tab: 'auction' };
    if (text.includes('trade') || text.includes('tukar')) return { tab: 'trade' };
    if (text.includes('inbox') || text.includes('message') || text.includes('chat') || text.includes('pesan')) return { tab: 'inbox' };
    if (text.includes('wishlist')) return { tab: 'wishlist' };
    if (text.includes('inventory') || text.includes('inventori')) return { tab: 'inventory' };
    if (text.includes('order') || text.includes('paid') || text.includes('payment') || text.includes('sell-back') || text.includes('sellback')) return { tab: 'history' };
    if (text.includes('catalog') || text.includes('marketplace')) return { tab: 'catalog' };
    if (text.includes('analytics')) return { tab: 'analytics' };
    return null;
  }

  function normalized() {
    const state = readState();
    return sourceList().map(function (n, index) {
      const id = idFor(n, index);
      return Object.assign({}, n, {
        __id: id,
        __read: state[id] === true,
        __target: targetFor(n)
      });
    });
  }

  function navigate(target) {
    if (!target) return;
    if (target.url) {
      window.location.href = target.url;
      return;
    }
    if (target.tab && typeof window.switchTab === 'function') {
      window.switchTab(target.tab);
    }
  }

  function markRead(id) {
    const state = readState();
    state[id] = true;
    saveState(state);
  }

  function markAllRead() {
    const state = readState();
    normalized().forEach(function (n) { state[n.__id] = true; });
    saveState(state);
    render();
    if (typeof window.showToast === 'function') window.showToast('All notifications marked as read.');
  }

  function render() {
    const list = document.getElementById('notification-list');
    const badge = document.getElementById('notification-badge');
    if (!list) return;

    const notifications = normalized();
    const unread = notifications.filter(n => !n.__read).length;

    if (badge) {
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.classList.toggle('hidden', unread === 0);
      badge.classList.toggle('flex', unread > 0);
    }

    const markButton = document.querySelector('[data-ec-mark-all-read]');
    if (markButton) markButton.classList.toggle('hidden', unread === 0);

    if (!notifications.length) {
      list.innerHTML = '<div class="p-6 text-center text-xs text-slate-500">No recent notifications.</div>';
      return;
    }

    list.innerHTML = notifications.map(function (n) {
      const clickable = !!n.__target;
      return '<div role="button" tabindex="0" data-ec-notification-id="' + esc(n.__id) + '" class="p-3 transition-colors flex items-start gap-3 text-xs ' +
        (clickable ? 'cursor-pointer hover:bg-slate-950/85 ' : '') +
        (n.__read ? 'opacity-60' : 'bg-indigo-500/10 border-l-2 border-indigo-400') + '">' +
        '<div class="mt-0.5 p-2 rounded-xl bg-slate-950 border border-slate-800 relative"><i class="fa-solid ' + esc(n.iconClass || 'fa-bell text-indigo-400') + '"></i>' +
        (!n.__read ? '<span class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-400"></span>' : '') +
        '</div>' +
        '<div class="flex-1 min-w-0 space-y-0.5">' +
        '<div class="flex justify-between items-center gap-2"><span class="font-extrabold text-white text-[11px] truncate">' + esc(n.title || 'Notification') + '</span><span class="text-[9px] font-mono text-slate-500 shrink-0">' + esc(n.time || '') + '</span></div>' +
        '<p class="text-[11px] text-slate-400 leading-snug">' + esc(n.message || '') + '</p>' +
        (clickable ? '<div class="mt-1 text-[9px] font-bold text-indigo-400"><i class="fa-solid fa-arrow-right"></i> Open</div>' : '') +
        '</div></div>';
    }).join('');
  }

  function install() {
    if (installed) return;
    const list = document.getElementById('notification-list');
    const dropdown = document.getElementById('notification-dropdown');
    if (!list || !dropdown) return;
    installed = true;

    const header = dropdown.querySelector('.p-3\.5.border-b') || dropdown.firstElementChild;
    if (header && !header.querySelector('[data-ec-mark-all-read]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-ec-mark-all-read', '');
      button.className = 'px-2 py-1 rounded-lg text-[9px] font-black text-indigo-300 hover:text-white hover:bg-indigo-500/20 transition-colors whitespace-nowrap';
      button.title = 'Mark all as read';
      button.innerHTML = '<i class="fa-solid fa-check-double"></i> Mark all as read';
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        markAllRead();
      });
      header.appendChild(button);
    }

    if (!boundList) {
      boundList = true;
      list.addEventListener('click', function (event) {
        const row = event.target.closest('[data-ec-notification-id]');
        if (!row) return;
        const id = row.getAttribute('data-ec-notification-id');
        const item = normalized().find(n => n.__id === id);
        if (!item) return;
        markRead(id);
        const menu = document.getElementById('notification-dropdown');
        if (menu) menu.classList.add('hidden');
        render();
        if (item.__target) setTimeout(() => navigate(item.__target), 0);
      });
      list.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const row = event.target.closest('[data-ec-notification-id]');
        if (row) { event.preventDefault(); row.click(); }
      });
    }

    render();
  }

  // The legacy index.html owns systemNotifications and renderNotifications.
  // We override only the renderer after the page has loaded, leaving the source
  // array and all existing notification creation code intact.
  function boot() {
    install();
    if (typeof window.renderNotifications === 'function') {
      window.renderNotifications = render;
    }
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  setTimeout(boot, 250);
  setTimeout(boot, 1000);
  setInterval(render, 2000);
})();
