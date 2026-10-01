/* ============================================================
   Triple 7 Holdings — lot page
   ------------------------------------------------------------
   Renders one lot. Every field is printed only if the desk
   actually publishes it; absent fields are dropped from the table
   rather than shown as a dash, because a dash reads as "none"
   when the truth is "not stated".
   ============================================================ */
(function () {
  const root    = document.getElementById('lot-root');
  const titleEl = document.getElementById('desk-title');
  const crumbEl = document.getElementById('crumb-lot');
  const subEl   = document.getElementById('desk-sub');
  if (!root) return;

  const lotId = new URLSearchParams(location.search).get('id');

  function notFound(heading, body) {
    titleEl.textContent = heading;
    if (crumbEl) crumbEl.textContent = 'Not found';
    document.title = heading + ' — Trade Desk — Triple 7 Holdings';
    root.innerHTML =
      '<div class="empty">' +
        '<h3>' + T7.esc(heading) + '</h3>' +
        '<p>' + T7.esc(body) + '</p>' +
        '<a href="trade.html" class="btn-desk">Back To The Live Board</a>' +
      '</div>';
  }

  function specRows(l) {
    const rows = [
      ['Lot ID',        l.lot_id],
      ['Commodity',     T7.COMMODITY_LABEL[l.commodity] || l.commodity],
      ['Type',          l.type ? l.type.charAt(0).toUpperCase() + l.type.slice(1) : null],
      ['Origin',        l.origin],
      ['Condition',     l.condition],
      ['Treatment',     l.treatment],
      ['Quantity',      l.quantity && l.unit ? l.quantity + ' ' + l.unit : l.quantity],
      ['Verification',  l.verification],
      ['Availability',  l.status === 'live' ? 'Listed' : (l.status ? l.status.charAt(0).toUpperCase() + l.status.slice(1) : null)],
      ['Pricing',       l.pricing],
      ['Last updated',  l.last_updated]
    ];
    return rows
      .filter(r => r[1] != null && r[1] !== '')
      .map(r => '<div><dt>' + T7.esc(r[0]) + '</dt><dd>' + T7.esc(r[1]) + '</dd></div>')
      .join('');
  }

  function relatedRows(all, current) {
    const rest = all.filter(l => l.commodity === current.commodity && l.lot_id !== current.lot_id);
    if (!rest.length) return '';
    return '<section style="margin-top:56px">' +
             '<h2 class="market-name" style="margin-bottom:18px">Other ' +
               T7.esc((T7.COMMODITY_LABEL[current.commodity] || current.commodity).toLowerCase()) + ' lots</h2>' +
             '<div class="market">' +
               rest.map(l =>
                 '<article class="lot-row">' +
                   '<a href="lot.html?id=' + encodeURIComponent(l.lot_id) + '" aria-hidden="true" tabindex="-1">' +
                     T7.lotMedia(l, { card: true }) +
                   '</a>' +
                   '<div>' +
                     '<div class="lot-meta"><span class="lot-id">' + T7.esc(l.lot_id) + '</span></div>' +
                     '<a class="lot-name textlink" href="lot.html?id=' + encodeURIComponent(l.lot_id) + '">' + T7.esc(l.name) + '</a>' +
                     '<p class="lot-desc">' + T7.esc((l.descriptors || []).join(' · ')) + '</p>' +
                   '</div>' +
                   '<div class="lot-right">' +
                     '<span class="lot-pricing">' + T7.esc(l.pricing || '') + '</span>' +
                     '<a class="lot-open" href="lot.html?id=' + encodeURIComponent(l.lot_id) + '">View lot <span aria-hidden="true">↗</span></a>' +
                   '</div>' +
                 '</article>').join('') +
             '</div>' +
           '</section>';
  }

  function render(l, all) {
    document.title = l.name + ' · ' + l.lot_id + ' — Trade Desk — Triple 7 Holdings';
    titleEl.textContent = l.name;
    if (crumbEl) crumbEl.textContent = l.lot_id;
    if (subEl) {
      subEl.textContent = [l.lot_id].concat(l.descriptors || []).concat([l.pricing]).filter(Boolean).join(' · ');
    }

    root.innerHTML =
      '<div class="lot-layout">' +
        '<div class="lot-figure">' + T7.lotMedia(l, { wide: true }) + '</div>' +
        '<div>' +
          '<div class="lot-meta">' +
            '<span class="tag">' + T7.esc(T7.COMMODITY_LABEL[l.commodity] || l.commodity) + '</span>' +
            (l.verification ? '<span class="tag is-verified">' + T7.esc(l.verification) + '</span>' : '') +
            '<span class="lot-id">' + T7.esc(l.lot_id) + '</span>' +
          '</div>' +
          '<p style="margin-top:16px;color:var(--text-dark-2);max-width:56ch">' + T7.esc(l.description) + '</p>' +
          '<dl class="spec-list">' + specRows(l) + '</dl>' +

          '<div class="trade-action">' +
            '<h2>Trade</h2>' +
            '<p id="action-note"></p>' +
            '<div class="action-row" id="action-row"></div>' +
          '</div>' +

          '<p class="lot-tools no-print">' +
            '<button type="button" class="reset-link" id="print-lot">Print this lot sheet</button>' +
          '</p>' +

          '<div class="notice" style="margin-top:20px">' +
            '<strong>Provenance documentation</strong> for this lot is released by the desk to ' +
            'registered buyers during the quote process. ' +
            '<a class="textlink" href="provenance.html">How Triple 7 handles origin</a>.' +
          '</div>' +
        '</div>' +
      '</div>' +
      relatedRows(all, l);

    paintActions(l);

    const pr = document.getElementById('print-lot');
    if (pr) pr.addEventListener('click', () => window.print());
  }

  function paintActions(l) {
    const row = document.getElementById('action-row');
    const note = document.getElementById('action-note');
    const session = T7.auth.current();
    const watching = T7.watchlist.has(l.lot_id);

    if (l.status !== 'live') {
      row.innerHTML = '<a href="contact.html" class="btn-desk">Ask About Similar Lots</a>';
      note.textContent = 'This lot is no longer open for quotes. The desk can tell you what else is available.';
      return;
    }

    /* Signed out, the desk asks you to sign in first — the same gate the
       live desk uses. It is a courtesy, not a security control. */
    if (!session) {
      row.innerHTML =
        '<a class="btn-desk" href="signin.html?role=buyer&next=' + encodeURIComponent('quote.html?id=' + l.lot_id) + '">Sign In To Request A Quote</a>' +
        '<a class="btn-line" href="contact.html">Ask The Desk</a>';
      note.textContent = 'Quotes are issued to buyers known to the desk. Sign in to request one, or contact the desk directly.';
      return;
    }

    if (session.role === 'seller') {
      row.innerHTML = '<a class="btn-line" href="seller.html">Go To Seller Desk</a>';
      note.textContent = 'You are signed in as a seller. Quote requests are made from a buyer account.';
      return;
    }

    row.innerHTML =
      '<a class="btn-desk" href="quote.html?id=' + encodeURIComponent(l.lot_id) + '">Request A Quote</a>' +
      '<button type="button" class="btn-line' + (watching ? ' is-on' : '') + '" id="act-watch">' +
        (watching ? 'On Watchlist' : 'Add To Watchlist') +
      '</button>';

    note.textContent = watching
      ? 'Saved to your watchlist. Request a quote whenever you are ready — no price is named until the desk issues written terms.'
      : 'Request a quote on this lot, or save it to your watchlist and come back. Neither commits you to anything.';

    const w = document.getElementById('act-watch');
    if (w) w.addEventListener('click', () => {
      if (T7.watchlist.has(l.lot_id)) {
        T7.watchlist.remove(l.lot_id);
        T7.toast('Removed from your watchlist');
      } else {
        T7.watchlist.add(l);
        T7.toast('Saved to your watchlist', { href: 'buyer.html', label: 'View watchlist' });
      }
      paintActions(l);
    });
  }

  if (!lotId) {
    notFound('No lot selected', 'Open a lot from the Live Board to see its detail.');
    return;
  }

  Promise.all([T7.api.getLot(lotId), T7.api.listLots()])
    .then(([lot, all]) => {
      if (!lot) {
        notFound('Lot not found', 'Lot ' + lotId + ' is not listed on the desk. It may have been withdrawn.');
        return;
      }
      render(lot, all);
    })
    .catch(err => {
      console.error(err);
      notFound('We could not load this lot', 'Please try again in a moment, or call the Kimberley desk on +27 73 569 4045.');
    });
})();
