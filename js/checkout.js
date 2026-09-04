/* ============================================================
   Triple 7 Holdings — checkout
   ------------------------------------------------------------
   Order of operations, and why:

     1. Re-validate the basket against the register. A stone sold in
        the last ten minutes must not reach a payment screen.
     2. Validate the form in the browser — courtesy, not security.
     3. Write a PENDING order through T7.api.
     4. Ask the serverless function to start a payment and hand the
        browser to the gateway.

   The browser never decides that an order is paid. It cannot be
   trusted to: anyone can open the console and call a function. Only
   the gateway's server-to-server notification, handled in
   api/payment-notify.js, moves an order to `paid`.
   ============================================================ */
(function () {
  const root    = document.getElementById('checkout-root');
  const form    = document.getElementById('checkout-form');
  const summary = document.getElementById('checkout-summary');
  if (!root || !form || !summary) return;

  let busy = false;

  /* ---------- Empty basket ---------- */
  function requireItems() {
    if (T7.cart.count()) return true;
    root.innerHTML =
      '<div class="shop-empty">' +
        '<h3>There is nothing to check out</h3>' +
        '<p>Your selection is empty. Add a stone and come back.</p>' +
        '<a href="diamonds.html" class="btn btn-solid">View The Collection</a>' +
      '</div>';
    return false;
  }

  /* ---------- Summary ---------- */
  function paintSummary(note) {
    const items = T7.cart.items();
    const money = T7.totals(T7.cart.subtotal());

    summary.innerHTML =
      '<h2>Your Order</h2>' +
      items.map(i =>
        '<div class="summary-row">' +
          '<span>' + T7.esc(i.title) + '<br><span style="opacity:.72">' + T7.esc(i.sku) + '</span></span>' +
          '<span>' + T7.money(i.price_zar) + '</span>' +
        '</div>').join('') +
      '<div class="summary-row" style="border-top:1px solid var(--line-inv);margin-top:8px;padding-top:16px"><span>Insured courier</span><span>' + T7.money(money.shipping) + '</span></div>' +
      '<div class="summary-row"><span>VAT at ' + (T7.VAT_RATE * 100) + '%</span><span>' + T7.money(money.vat) + '</span></div>' +
      '<div class="summary-row is-total"><span>Due now</span><span>' + T7.money(money.total) + '</span></div>' +
      '<button type="button" class="btn btn-ghost" id="pay">Pay ' + T7.money(money.total) + '</button>' +
      '<p class="summary-fine" id="pay-status">' + (note || 'You will be handed to the payment gateway. Triple 7 Holdings never sees or stores your card details.') + '</p>';

    document.getElementById('pay').addEventListener('click', submit);
  }

  function status(message) {
    const el = document.getElementById('pay-status');
    if (el) el.textContent = message;
  }

  function setBusy(on, label) {
    busy = on;
    const btn = document.getElementById('pay');
    if (!btn) return;
    btn.disabled = on;
    btn.style.opacity = on ? '.6' : '';
    btn.style.pointerEvents = on ? 'none' : '';
    if (label) btn.textContent = label;
  }

  /* ---------- Validation ----------
     Courtesy only. Person 2 must validate the same fields again on
     insert — a POST straight at the table would skip all of this. */
  const RULES = {
    customer_name:     v => v.trim().length >= 2 || 'Please give us your full name.',
    customer_email:    v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'That email address does not look right.',
    customer_phone:    v => v.replace(/[^\d]/g, '').length >= 9 || 'We need a number we can reach you on.',
    delivery_line1:    v => v.trim().length >= 4 || 'Please give a street address.',
    delivery_city:     v => v.trim().length >= 2 || 'Please give a city or town.',
    delivery_province: v => v.trim().length > 0 || 'Please choose a province.',
    delivery_postcode: v => /^\d{4}$/.test(v.trim()) || 'South African postal codes are four digits.'
  };

  function showError(name, message) {
    const field = form.elements[name];
    if (!field) return;
    const wrap = field.closest('.field');
    const err = document.getElementById('err-' + name);
    if (wrap) wrap.classList.toggle('is-invalid', Boolean(message));
    if (err) err.textContent = message || '';
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validate() {
    let firstBad = null;
    Object.keys(RULES).forEach(name => {
      const field = form.elements[name];
      const result = RULES[name](field.value);
      const message = result === true ? '' : result;
      showError(name, message);
      if (message && !firstBad) firstBad = field;
    });
    if (firstBad) {
      firstBad.focus();
      firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return !firstBad;
  }

  /* Clear a field's error as soon as it becomes valid, rather than
     making the buyer press Pay again to find out. */
  form.addEventListener('input', e => {
    const name = e.target.name;
    if (!RULES[name]) return;
    if (RULES[name](e.target.value) === true) showError(name, '');
  });
  form.addEventListener('submit', e => { e.preventDefault(); submit(); });

  /* ---------- Submit ---------- */
  async function submit() {
    if (busy) return;
    if (!validate()) return;

    setBusy(true, 'Checking the stones…');
    status('Confirming the stones are still available.');

    try {
      const items = T7.cart.items();
      const check = await T7.api.validateCart(items);

      if (check.problems.length) {
        check.problems.forEach(p => {
          if (p.reason === 'price') {
            const fresh = check.lines.find(l => l.sku === p.sku);
            if (fresh) { T7.cart.remove(p.sku); T7.cart.add(fresh); }
          } else {
            T7.cart.remove(p.sku);
          }
        });
        setBusy(false);
        if (!requireItems()) return;
        paintSummary(check.problems.map(p => p.message).join(' '));
        T7.toast('Your selection changed — please check it');
        return;
      }

      setBusy(true, 'Creating your order…');
      status('Recording your order.');

      const money = T7.totals(T7.cart.subtotal());
      const data = new FormData(form);
      const order = await T7.api.createOrder({
        customer_name:     data.get('customer_name').trim(),
        customer_email:    data.get('customer_email').trim(),
        customer_phone:    data.get('customer_phone').trim(),
        delivery_line1:    data.get('delivery_line1').trim(),
        delivery_city:     data.get('delivery_city').trim(),
        delivery_province: data.get('delivery_province'),
        delivery_postcode: data.get('delivery_postcode').trim(),
        delivery_country:  data.get('delivery_country'),
        notes:             (data.get('notes') || '').trim() || null,
        subtotal_zar:      money.subtotal,
        shipping_zar:      money.shipping,
        vat_zar:           money.vat,
        total_zar:         money.total,
        items:             T7.cart.items()
      });

      /* The reference survives the trip to the gateway and back, so the
         return page can find the order even if the URL loses everything
         else. */
      try { sessionStorage.setItem('t7.pending', order.public_token); } catch (e) {}

      setBusy(true, 'Opening the payment page…');
      status('Handing you to the payment gateway.');

      const payment = await T7.api.startPayment(order);

      if (payment.mode === 'redirect') {
        location.href = payment.url;
        return;
      }

      /* Gateways that want a signed form POST rather than a GET. The
         signature was produced server-side; nothing secret is here. */
      if (payment.mode === 'post') {
        const f = document.createElement('form');
        f.method = 'POST';
        f.action = payment.url;
        Object.keys(payment.fields).forEach(key => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = payment.fields[key];
          f.appendChild(input);
        });
        document.body.appendChild(f);
        f.submit();
        return;
      }

      throw new Error('The payment gateway answered in a form we do not understand.');

    } catch (err) {
      console.error(err);
      setBusy(false, 'Try Again');
      status('We could not start the payment. Your selection is untouched — try again, or call the Kimberley office on +27 73 569 4045.');
      T7.toast('Payment could not be started');
    }
  }

  /* ---------- Boot ---------- */
  if (!requireItems()) return;
  paintSummary();

  /* Reconcile quietly on load so a stale basket is caught before the
     buyer has typed out their whole address. */
  T7.api.validateCart(T7.cart.items())
    .then(check => {
      if (!check.problems.length) return;
      check.problems.forEach(p => {
        if (p.reason === 'price') {
          const fresh = check.lines.find(l => l.sku === p.sku);
          if (fresh) { T7.cart.remove(p.sku); T7.cart.add(fresh); }
        } else {
          T7.cart.remove(p.sku);
        }
      });
      if (!requireItems()) return;
      paintSummary(check.problems.map(p => p.message).join(' '));
    })
    .catch(err => console.error(err));
})();
