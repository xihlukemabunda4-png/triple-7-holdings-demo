/* ============================================================
   Triple 7 Holdings — buyer dashboard (SANDBOX)
   ------------------------------------------------------------
   Watchlist and quote requests, both read from this browser's own
   localStorage. Nothing here is fetched from a desk, because
   there is no desk to fetch from — and nothing shows a price,
   status movement or document, because inventing those would be
   the dishonest part of a demo.
   ============================================================ */
(function () {
  const root = document.getElementById('buyer-root');
  if (!root) return;

  const session = T7.auth.requireRole('buyer');
  if (!session) return;

  document.getElementById('desk-sub').textContent =
    'Signed in as ' + session.company + '. Sandbox session — nothing here is verified.';

  function stat(label, value) {
    return '<div class="stat"><p class="stat-label">' + T7.esc(label) + '</p>' +
           '<p class="stat-value">' + T7.esc(String(value)) + '</p></div>';
  }

  function watchRow(item) {
    const href = 'lot.html?id=' + encodeURIComponent(item.lot_id);
    return '<div class="row-item">' +
             '<a href="' + href + '" aria-hidden="true" tabindex="-1">' +
               T7.lotMedia({ commodity: item.commodity, image: item.image_card, image_alt: item.name }, { card: true, thumb: true }) +
             '</a>' +
             '<div>' +
               '<div class="lot-meta"><span class="lot-id">' + T7.esc(item.lot_id) + '</span>' +
                 '<span class="tag">' + T7.esc(T7.COMMODITY_LABEL[item.commodity] || item.commodity) + '</span></div>' +
               '<a class="lot-name textlink" style="font-size:19px" href="' + href + '">' + T7.esc(item.name) + '</a>' +
               '<p class="row-when">Saved ' + T7.esc(T7.ago(item.added)) + '</p>' +
             '</div>' +
             '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">' +
               '<a class="btn-line" style="padding:9px 15px;font-size:10px" href="quote.html?id=' + encodeURIComponent(item.lot_id) + '">Request quote</a>' +
               '<button type="button" class="btn-line" style="padding:9px 15px;font-size:10px" data-unwatch="' + T7.esc(item.lot_id) + '">Remove</button>' +
             '</div>' +
           '</div>';
  }

  function requestRow(r) {
    return '<div class="row-item">' +
             '<span class="lot-id">' + T7.esc((r.lot_ids || []).join(', ')) + '</span>' +
             '<div>' +
               '<span class="lot-name" style="font-size:19px">' + T7.esc(r.reference) + '</span>' +
               '<p class="row-when">Submitted ' + T7.esc(T7.ago(r.created_at)) + ' · ' + T7.esc(r.company || '') + '</p>' +
             '</div>' +
             '<span class="tag is-verified">' + T7.esc(r.status) + '</span>' +
           '</div>';
  }

  function render() {
    const watch = T7.watchlist.items();
    const reqs = T7.api.listLocalRequests().slice().reverse();

    root.innerHTML =
      '<div class="dash-head">' +
        '<div><p class="market-state">Account</p>' +
        '<p style="font-family:var(--f-display);font-weight:700;text-transform:uppercase;font-size:28px;line-height:1">' + T7.esc(session.company) + '</p>' +
        '<p class="row-when">' + T7.esc(session.email) + '</p></div>' +
        '<div class="action-row"><a class="btn-line" href="trade.html">Browse Lots</a>' +
        '<button type="button" class="btn-line" id="signout">Sign Out</button></div>' +
      '</div>' +

      '<div class="dash-grid">' +
        stat('Watchlist', watch.length) +
        stat('Quote requests', reqs.length) +
        stat('Active trades', 0) +
      '</div>' +

      '<section class="dash-section">' +
        '<h2>Watchlist <a class="reset-link" href="trade.html">Browse the board</a></h2>' +
        (watch.length
          ? '<div class="row-list">' + watch.map(watchRow).join('') + '</div>'
          : '<div class="empty"><h3>Your watchlist is empty</h3><p>Save lots you are interested in so you can come back to them and request a quote.</p><a class="btn-desk" href="trade.html">Open The Live Board</a></div>') +
      '</section>' +

      '<section class="dash-section">' +
        '<h2>Quote requests</h2>' +
        (reqs.length
          ? '<div class="row-list">' + reqs.map(requestRow).join('') + '</div>' +
            '<p class="desk-footnote">Requests are held on this device. Status tracking, written ' +
            'quotes and documents need the Trade Desk backend — until then the desk replies to you directly.</p>'
          : '<div class="empty"><h3>No quote requests yet</h3><p>Open a lot and request a quote. The desk prepares terms and comes back to you.</p><a class="btn-desk" href="trade.html">Find A Lot</a></div>') +
      '</section>' +

      '<section class="dash-section">' +
        '<h2>Active trades</h2>' +
        '<div class="empty"><h3>No active trades</h3><p>A trade opens once you accept a quote from the desk. That step happens with the Trade Desk directly.</p><a class="btn-line" href="how-to-buy.html">How Buying Works</a></div>' +
      '</section>';

    document.getElementById('signout').addEventListener('click', () => {
      T7.auth.signOut();
      location.href = 'trade.html';
    });
  }

  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-unwatch]');
    if (!btn) return;
    T7.watchlist.remove(btn.getAttribute('data-unwatch'));
    render();
    T7.toast('Removed from your watchlist');
  });

  render();
})();
