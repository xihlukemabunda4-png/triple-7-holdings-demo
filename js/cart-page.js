/* ============================================================
   Triple 7 Holdings — selection (cart) page
   ------------------------------------------------------------
   The basket lives in localStorage and can be days old, so the
   first thing this page does is ask the backend what those stones
   cost NOW and whether they are still for sale. A stone that has
   been taken in the meantime is pulled out and the buyer is told
   why — better here than at the payment screen.
   ============================================================ */
(function () {
  const root = document.getElementById('cart-root');
  if (!root) return;

  function empty() {
    root.innerHTML =
      '<div class="shop-empty">' +
        '<h3>Nothing set aside yet</h3>' +
        '<p>Browse the collection and add the stones you want to look at properly.</p>' +
        '<a href="diamonds.html" class="btn btn-solid">View The Collection</a>' +
      '</div>';
  }

  function rowFor(item) {
    const spec = item.type === 'rough'
      ? [Number(item.carat).toFixed(2) + ' ct', 'Rough']
      : [Number(item.carat).toFixed(2) + ' ct', item.colour, item.clarity].filter(Boolean);
    return '<div class="cart-row">' +
             '<a href="diamond.html?sku=' + encodeURIComponent(item.sku) + '" aria-hidden="true" tabindex="-1">' + T7.plate(item) + '</a>' +
             '<div>' +
               '<a class="cart-row-name textlink" href="diamond.html?sku=' + encodeURIComponent(item.sku) + '">' + T7.esc(item.title) + '</a>' +
               '<p class="cart-row-meta">' + T7.esc(spec.join(' · ')) + ' · ' + T7.esc(item.sku) + '</p>' +
             '</div>' +
             '<div class="cart-row-right">' +
               '<span class="cart-row-price">' + T7.money(item.price_zar) + '</span>' +
               '<button type="button" class="link-quiet" data-remove="' + T7.esc(item.sku) + '">Remove</button>' +
             '</div>' +
           '</div>';
  }

  function render(problems) {
    const items = T7.cart.items();
    if (!items.length) { empty(); return; }

    const money = T7.totals(T7.cart.subtotal());

    const notice = problems && problems.length
      ? '<div class="notice" style="margin-bottom:26px">' +
          '<strong>Your selection changed since you last looked.</strong>' +
          '<ul>' + problems.map(p => '<li>' + T7.esc(p.message) + '</li>').join('') + '</ul>' +
        '</div>'
      : '';

    root.innerHTML =
      notice +
      '<div class="cart-layout">' +
        '<div>' +
          items.map(rowFor).join('') +
          '<p style="margin-top:26px"><a class="link-quiet" href="diamonds.html">← Keep looking</a></p>' +
        '</div>' +
        '<aside class="summary">' +
          '<h2>Summary</h2>' +
          '<div class="summary-row"><span>' + items.length + (items.length === 1 ? ' stone' : ' stones') + '</span><span>' + T7.money(money.subtotal) + '</span></div>' +
          '<div class="summary-row"><span>Insured courier</span><span>' + T7.money(money.shipping) + '</span></div>' +
          '<div class="summary-row"><span>VAT at ' + (T7.VAT_RATE * 100) + '%</span><span>' + T7.money(money.vat) + '</span></div>' +
          '<div class="summary-row is-total"><span>Total</span><span>' + T7.money(money.total) + '</span></div>' +
          '<a href="checkout.html" class="btn btn-ghost">Checkout</a>' +
          '<p class="summary-fine">Prices are confirmed against the register again at checkout. Nothing is reserved until an order is paid in full.</p>' +
        '</aside>' +
      '</div>';
  }

  /* Remove is delegated — the list is re-rendered on every change. */
  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    T7.cart.remove(btn.getAttribute('data-remove'));
    render();
    T7.toast('Removed from your selection');
  });

  render();

  /* Then reconcile against the register. */
  const items = T7.cart.items();
  if (items.length) {
    T7.api.validateCart(items)
      .then(result => {
        if (!result.problems.length) return;
        result.problems.forEach(p => {
          if (p.reason === 'price') {
            /* Price moved: keep the stone, take the new number. */
            const fresh = result.lines.find(l => l.sku === p.sku);
            if (fresh) { T7.cart.remove(p.sku); T7.cart.add(fresh); }
          } else {
            T7.cart.remove(p.sku);
          }
        });
        render(result.problems);
      })
      .catch(err => console.error(err));
  }
})();
