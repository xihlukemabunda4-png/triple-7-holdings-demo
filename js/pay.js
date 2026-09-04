/* ============================================================
   Triple 7 Holdings — sandbox gateway (demo mode only)
   ------------------------------------------------------------
   Imitates the two things a real gateway does that matter to us:
   it shows the buyer an amount they must agree to, and it settles
   the order server-side before sending the browser back.

   In live mode this page is unreachable — js/api.js redirects to
   the real gateway instead. Delete pay.html and this file when the
   merchant account is live.
   ============================================================ */
(function () {
  const root = document.getElementById('pay-root');
  if (!root) return;

  const token = new URLSearchParams(location.search).get('t');

  function fail(message) {
    root.innerHTML =
      '<p class="eyebrow">Sandbox</p>' +
      '<h1 class="section-title" style="margin-bottom:16px">Payment could not start</h1>' +
      '<p class="section-body" style="margin-bottom:30px">' + T7.esc(message) + '</p>' +
      '<a href="cart.html" class="btn btn-ghost">Back To Your Selection</a>';
  }

  if (T7.api.mode !== 'demo') {
    fail('This sandbox only runs in demo mode. With live credentials configured you are sent to the real gateway.');
    return;
  }
  if (!token) { fail('No order was referenced.'); return; }

  T7.api.getOrder(token).then(order => {
    if (!order) { fail('We could not find that order.'); return; }

    if (order.status !== 'pending') {
      location.replace('order.html?t=' + encodeURIComponent(token));
      return;
    }

    root.innerHTML =
      '<p class="eyebrow">Sandbox — no money moves</p>' +
      '<h1 class="section-title" style="margin-bottom:18px">Confirm Payment</h1>' +
      '<p class="section-body" style="margin-bottom:34px">This is where PayFast would take over. Approve or decline to see how the site handles each outcome.</p>' +

      '<div style="border:1px solid var(--line-inv);border-radius:var(--r-lg);padding:26px 28px;margin-bottom:30px">' +
        '<div class="summary-row"><span>Order</span><span>' + T7.esc(order.reference) + '</span></div>' +
        '<div class="summary-row"><span>' + order.items.length + (order.items.length === 1 ? ' stone' : ' stones') + '</span><span>' + T7.money(order.subtotal_zar) + '</span></div>' +
        '<div class="summary-row"><span>Courier and VAT</span><span>' + T7.money(order.shipping_zar + order.vat_zar) + '</span></div>' +
        '<div class="summary-row is-total"><span>Amount</span><span>' + T7.money(order.total_zar) + '</span></div>' +
      '</div>' +

      '<div style="display:flex;flex-wrap:wrap;gap:12px">' +
        '<button type="button" class="btn btn-ghost" id="approve" style="background:var(--text-light);color:var(--ink);border-color:var(--text-light)">Approve Payment</button>' +
        '<button type="button" class="btn btn-ghost" id="decline">Decline</button>' +
      '</div>';

    const settle = status => {
      T7.api.settleDemoOrder(token, status);
      location.replace('order.html?t=' + encodeURIComponent(token));
    };

    document.getElementById('approve').addEventListener('click', () => settle('paid'));
    document.getElementById('decline').addEventListener('click', () => settle('failed'));
  }).catch(err => {
    console.error(err);
    fail('Something went wrong reading the order.');
  });
})();
