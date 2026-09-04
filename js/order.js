/* ============================================================
   Triple 7 Holdings — order confirmation
   ------------------------------------------------------------
   The page the gateway returns the browser to. It reports what the
   BACKEND says the order's status is — it never infers "paid" from
   having been redirected here, because a buyer can type this URL.

   A gateway's server-to-server notification often lands a second or
   two after the shopper's browser does, so `pending` is a normal
   state to arrive in, not an error. The page re-checks a few times
   before it says anything discouraging.
   ============================================================ */
(function () {
  const root      = document.getElementById('order-root');
  const titleEl   = document.getElementById('order-title');
  const eyebrowEl = document.getElementById('order-eyebrow');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  let token = params.get('t');
  if (!token) {
    try { token = sessionStorage.getItem('t7.pending'); } catch (e) {}
  }

  let attempts = 0;
  const MAX_ATTEMPTS = 5;

  function shell(eyebrow, title, body) {
    eyebrowEl.textContent = eyebrow;
    titleEl.textContent = title;
    document.title = title + ' — Triple 7 Holdings';
    root.innerHTML = body;
  }

  function receipt(order) {
    const lines = (order.items || []).map(i =>
      '<div class="receipt-line"><span>' + T7.esc(i.title) + ' · ' + T7.esc(i.sku) + '</span><span>' + T7.money(i.unit_price_zar) + '</span></div>'
    ).join('');
    return '<div class="receipt">' +
             '<p class="receipt-ref">' + T7.esc(order.reference) + '</p>' +
             lines +
             '<div class="receipt-line"><span>Insured courier</span><span>' + T7.money(order.shipping_zar) + '</span></div>' +
             '<div class="receipt-line"><span>VAT</span><span>' + T7.money(order.vat_zar) + '</span></div>' +
             '<div class="receipt-total"><span>Paid</span><span>' + T7.money(order.total_zar) + '</span></div>' +
           '</div>';
  }

  function showPaid(order) {
    /* The stones are sold. Whatever is left in this browser's basket
       from this order is now meaningless. */
    T7.cart.clear();
    try { sessionStorage.removeItem('t7.pending'); } catch (e) {}

    shell('Paid', 'Thank You',
      '<div style="max-width:660px;margin:0 auto 34px;text-align:center">' +
        '<p class="section-body">Your payment went through and the stones are off the market. ' +
        'A confirmation is on its way to <strong>' + T7.esc(order.customer_email || 'your email address') + '</strong>. ' +
        'Our Kimberley office will call you to arrange the insured handover and the Kimberley Process paperwork.</p>' +
      '</div>' +
      receipt(order) +
      '<p style="text-align:center;margin-top:34px"><a href="diamonds.html" class="btn btn-solid">Back To The Collection</a></p>');
  }

  function showPending(order) {
    shell('Awaiting confirmation', 'Almost There',
      '<div style="max-width:660px;margin:0 auto 30px;text-align:center">' +
        '<p class="section-body">We have your order as <strong>' + T7.esc(order.reference) + '</strong> but the bank has not confirmed the payment yet. ' +
        'This usually takes a few seconds. Nothing is lost — if the payment did go through, the confirmation email will still arrive.</p>' +
      '</div>' +
      receipt(order) +
      '<p style="text-align:center;margin-top:30px">' +
        '<button type="button" class="btn btn-solid" id="recheck">Check Again</button>' +
      '</p>');
    const btn = document.getElementById('recheck');
    if (btn) btn.addEventListener('click', () => { attempts = 0; load(); });
  }

  function showFailed(order) {
    shell('Not paid', 'Payment Did Not Go Through',
      '<div style="max-width:660px;margin:0 auto 30px;text-align:center">' +
        '<p class="section-body">Order <strong>' + T7.esc(order.reference) + '</strong> was not paid, so nothing has been charged and the stones are still available. ' +
        'You can try again, or call the Kimberley office on <a class="textlink" href="tel:+27735694045">+27 73 569 4045</a> and we will take it from there.</p>' +
      '</div>' +
      '<p style="text-align:center"><a href="diamonds.html" class="btn btn-solid">Back To The Collection</a></p>');
  }

  function showMissing() {
    shell('Not found', 'We Cannot Find That Order',
      '<div class="shop-empty">' +
        '<h3>No order matches that link</h3>' +
        '<p>The link may have expired or been mistyped. Call the Kimberley office on +27 73 569 4045 with your order number and we will look it up.</p>' +
        '<a href="contact.html" class="btn btn-solid">Contact Us</a>' +
      '</div>');
  }

  function load() {
    T7.api.getOrder(token).then(order => {
      if (!order) { showMissing(); return; }

      if (order.status === 'paid' || order.status === 'fulfilled') { showPaid(order); return; }
      if (order.status === 'failed' || order.status === 'cancelled') { showFailed(order); return; }

      showPending(order);
      /* Back off rather than hammering: 2s, 4s, 6s, 8s, then stop and
         leave the buyer the manual button. */
      if (++attempts < MAX_ATTEMPTS) setTimeout(load, attempts * 2000);
    }).catch(err => {
      console.error(err);
      shell('Something went wrong', 'We Could Not Load Your Order',
        '<div class="shop-empty">' +
          '<h3>Your order is safe</h3>' +
          '<p>We could not read it just now. Refresh in a moment, or call +27 73 569 4045.</p>' +
          '<a href="contact.html" class="btn btn-solid">Contact Us</a>' +
        '</div>');
    });
  }

  if (!token) { showMissing(); return; }
  shell('Step 3 of 3', 'Your Order', '<p class="section-body" style="text-align:center">Checking your order…</p>');
  load();
})();
