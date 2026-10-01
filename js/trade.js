/* ============================================================
   Triple 7 Holdings — Trade Desk shared layer
   ------------------------------------------------------------
   Loaded on every page. Provides:
     T7.esc()        — escaping for anything from the database
     T7.watchlist    — lots a buyer has saved
     T7.lotMedia()   — lot imagery with a graceful fallback
     T7.toast()      — transient confirmations

   There is no basket. A commodities desk is approached lot by
   lot: you open a lot and request a quote on it. Saving a lot to
   a watchlist is a bookmark, not a step towards purchase, and it
   carries no price — because until the desk issues written terms
   no price exists.
   ============================================================ */
window.T7 = window.T7 || {};

(function () {

  T7.esc = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ---------- Lot imagery ---------- */
  const MARKS = {
    diamond: '<path d="M32 8h36l12 12v60L68 92H32L20 80V20z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' +
             '<path d="M28 18h44l6 6v52l-6 6H28l-6-6V24z" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".55"/>',
    gold:    '<rect x="16" y="38" width="68" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/>' +
             '<rect x="24" y="58" width="52" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".6"/>' +
             '<rect x="30" y="22" width="40" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".6"/>'
  };

  T7.lotMark = function (commodity) {
    return '<svg class="lot-mark" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
             (MARKS[commodity] || MARKS.diamond) + '</svg>';
  };

  T7.lotMedia = function (lot, opts) {
    const o = opts || {};
    const src = o.card ? (lot.image_card || lot.image) : lot.image;
    const alt = lot.image_alt || lot.name || '';
    return '<div class="lot-media' + (o.wide ? ' is-wide' : '') + (o.thumb ? ' is-thumb' : '') + '">' +
             T7.lotMark(lot.commodity) +
             (src ? '<img class="lot-photo" src="' + T7.esc(src) + '" alt="' + T7.esc(alt) + '" loading="lazy" decoding="async">' : '') +
           '</div>';
  };

  document.addEventListener('load', e => {
    const img = e.target;
    if (img.classList && img.classList.contains('lot-photo')) {
      const media = img.closest('.lot-media');
      if (media) media.classList.add('has-photo');
    }
  }, true);

  document.addEventListener('error', e => {
    const img = e.target;
    if (img.classList && img.classList.contains('lot-photo')) img.remove();
  }, true);

  /* ---------- Watchlist ---------- */
  const KEY = 't7.watchlist';

  function read() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('t7:watchlist', { detail: list }));
  }

  T7.watchlist = {
    items: read,
    count: () => read().length,
    has: id => read().some(i => i.lot_id === id),

    add(lot) {
      const list = read();
      if (list.some(i => i.lot_id === lot.lot_id)) return false;
      list.push({
        lot_id: lot.lot_id,
        name: lot.name,
        commodity: lot.commodity,
        type: lot.type,
        pricing: lot.pricing,
        image_card: lot.image_card || lot.image || null,
        added: new Date().toISOString()
      });
      write(list);
      return true;
    },

    remove(id) { write(read().filter(i => i.lot_id !== id)); },
    clear() { write([]); }
  };

  /* ---------- Toast ---------- */
  let toastEl, toastTimer;
  T7.toast = function (message, action) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = '<span>' + T7.esc(message) + '</span>' +
      (action ? '<a href="' + T7.esc(action.href) + '">' + T7.esc(action.label) + '</a>' : '');
    requestAnimationFrame(() => toastEl.classList.add('is-up'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-up'), 4600);
  };

  T7.COMMODITY_LABEL = { diamond: 'Diamond', gold: 'Gold' };

  /* Relative time for dashboards. Nothing here claims to be live. */
  T7.ago = function (iso) {
    if (!iso) return '';
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return 'just now';
    if (secs < 3600) return Math.floor(secs / 60) + ' min ago';
    if (secs < 86400) return Math.floor(secs / 3600) + ' hr ago';
    return Math.floor(secs / 86400) + ' d ago';
  };
})();
