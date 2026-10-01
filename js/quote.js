/* ============================================================
   Triple 7 Holdings — quote request, one lot at a time
   ------------------------------------------------------------
   Reads ?id= and requests a quote on that single lot. No basket,
   no totals, no price — the desk sets terms afterwards.

   Signed out, this shows the same thing the live desk shows: an
   invitation to sign in. That gate is a sandbox courtesy, not a
   security control, so the form behind it collects nothing that
   would matter if someone skipped it.
   ============================================================ */
(function () {
  const root = document.getElementById('quote-root');
  if (!root) return;

  const lotId = new URLSearchParams(location.search).get('id');
  let lot = null;

  const RULES = {
    contact_name: v => v.trim().length >= 2 || 'Please give the name we should reply to.',
    company:      v => v.trim().length >= 2 || 'The desk trades with registered businesses — please give a company name.',
    email:        v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'That email address does not look right.',
    phone:        v => v.replace(/[^\d]/g, '').length >= 9 || 'We need a number the desk can reach you on.'
  };

  function lotStrip(l) {
    return '<div class="lot-card" style="flex-direction:row;align-items:center;gap:20px;padding:16px;margin-bottom:30px">' +
             '<div style="width:110px;flex-shrink:0">' + T7.lotMedia(l, { card: true, thumb: true }) + '</div>' +
             '<div>' +
               '<div class="lot-meta">' +
                 '<span class="lot-id">' + T7.esc(l.lot_id) + '</span>' +
                 '<span class="tag">' + T7.esc(T7.COMMODITY_LABEL[l.commodity] || l.commodity) + '</span>' +
               '</div>' +
               '<a class="lot-name textlink" href="lot.html?id=' + encodeURIComponent(l.lot_id) + '">' + T7.esc(l.name) + '</a>' +
               '<p class="lot-desc">' + T7.esc((l.descriptors || []).join(' · ')) + ' · ' + T7.esc(l.pricing || '') + '</p>' +
             '</div>' +
           '</div>';
  }

  function signedOut(l) {
    root.innerHTML =
      lotStrip(l) +
      '<div class="panel" style="margin-top:0">' +
        '<h2>Quote</h2>' +
        '<p>Sign in to request a quote for this lot.</p>' +
        '<div class="action-row">' +
          '<a class="btn-desk" href="signin.html?role=buyer&next=' + encodeURIComponent('quote.html?id=' + l.lot_id) + '">Sign In As Buyer</a>' +
          '<a class="btn-line" href="signin.html?role=seller">Sign In As Seller</a>' +
        '</div>' +
      '</div>' +
      '<p style="margin-top:26px"><a class="reset-link" href="lot.html?id=' + encodeURIComponent(l.lot_id) + '">← Back to the lot</a></p>';
  }

  function form(l, session) {
    root.innerHTML =
      lotStrip(l) +
      '<form class="form" id="qr-form" novalidate>' +
        '<div class="form-row">' +
          '<div class="field"><label for="contact_name">Contact name</label><input id="contact_name" name="contact_name" type="text" autocomplete="name" required><p class="field-error" id="err-contact_name"></p></div>' +
          '<div class="field"><label for="company">Company</label><input id="company" name="company" type="text" autocomplete="organization" value="' + T7.esc(session.company || '') + '" required><p class="field-error" id="err-company"></p></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" value="' + T7.esc(session.email || '') + '" required><p class="field-error" id="err-email"></p></div>' +
          '<div class="field"><label for="phone">Phone</label><input id="phone" name="phone" type="tel" autocomplete="tel" required><p class="field-error" id="err-phone"></p></div>' +
        '</div>' +
        '<div class="field"><label for="country">Country <span class="opt">(optional)</span></label><input id="country" name="country" type="text" autocomplete="country-name"></div>' +
        '<div class="field"><label for="intended_use">Intended use <span class="opt">(optional)</span></label><input id="intended_use" name="intended_use" type="text" placeholder="Resale, manufacturing, investment…"></div>' +
        '<div class="field"><label for="message">Message to the desk <span class="opt">(optional)</span></label><textarea id="message" name="message" placeholder="Volumes you are working to, documentation you need, timelines."></textarea></div>' +

        '<div class="notice">' +
          '<strong>This is not an offer or a purchase.</strong> Submitting registers your ' +
          'interest with the Kimberley desk. It does not reserve the lot and sets no price — ' +
          'the desk issues written terms afterwards. <a class="textlink" href="how-to-buy.html">How buying works</a>.' +
        '</div>' +

        '<button type="submit" class="btn-desk" id="submit-qr" style="justify-content:center">Submit Quote Request</button>' +
        '<p class="desk-footnote" id="qr-status" style="margin-top:0;border:0;padding-top:0">No price is named until the Trade Desk issues written terms.</p>' +
      '</form>';

    const f = document.getElementById('qr-form');
    f.addEventListener('submit', e => { e.preventDefault(); submit(); });
    f.addEventListener('input', e => {
      const n = e.target.name;
      if (RULES[n] && RULES[n](e.target.value) === true) showError(n, '');
    });
  }

  function showError(name, message) {
    const f = document.getElementById('qr-form');
    if (!f) return;
    const field = f.elements[name];
    if (!field) return;
    const wrap = field.closest('.field');
    const err = document.getElementById('err-' + name);
    if (wrap) wrap.classList.toggle('is-invalid', Boolean(message));
    if (err) err.textContent = message || '';
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validate() {
    const f = document.getElementById('qr-form');
    let firstBad = null;
    Object.keys(RULES).forEach(name => {
      const result = RULES[name](f.elements[name].value);
      const message = result === true ? '' : result;
      showError(name, message);
      if (message && !firstBad) firstBad = f.elements[name];
    });
    if (firstBad) { firstBad.focus(); firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return !firstBad;
  }

  function mailtoFor(req, l) {
    const lines = [
      'Quote request ' + req.reference, '',
      'Company: ' + req.company,
      'Contact: ' + req.contact_name,
      'Email:   ' + req.email,
      'Phone:   ' + req.phone
    ];
    if (req.country) lines.push('Country: ' + req.country);
    if (req.intended_use) lines.push('Intended use: ' + req.intended_use);
    lines.push('', 'Lot: ' + l.lot_id + '  ' + l.name);
    if (req.message) lines.push('', 'Message:', req.message);
    return 'mailto:info@triple7holdings.co.za?subject=' +
      encodeURIComponent('Quote request ' + req.reference) +
      '&body=' + encodeURIComponent(lines.join('\n'));
  }

  function confirmed(req, l) {
    /* Two genuinely different outcomes, said plainly. Claiming the desk
       has it when the request never left the browser is the one thing
       this screen must not do. */
    const landed = req.delivered === true;

    root.innerHTML =
      '<div style="max-width:660px">' +
        '<div class="lot-meta">' +
          '<span class="tag is-verified">' + (landed ? 'Received' : 'Saved') + '</span>' +
          '<span class="lot-id">' + T7.esc(req.reference) + '</span>' +
        '</div>' +
        '<h2 style="font-family:var(--f-display);font-weight:700;text-transform:uppercase;font-size:clamp(28px,4vw,44px);line-height:1;margin:14px 0 16px">' +
          (landed ? 'Request Received' : 'Request Saved') +
        '</h2>' +
        '<p style="color:var(--text-dark-2);max-width:56ch">Quote request <strong>' + T7.esc(req.reference) +
          '</strong> covers lot ' + T7.esc(l.lot_id) + ' — ' + T7.esc(l.name) + '. ' +
          (landed
            ? 'The Kimberley desk has it, and a confirmation is on its way to ' + T7.esc(req.email) + '.'
            : 'It is saved on this device but has not reached the desk yet.') +
        '</p>' +

        (landed
          ? '<div class="notice" style="margin-top:24px">' +
              '<strong>What happens next.</strong> The desk reviews your request, confirms ' +
              'availability, and comes back with written terms. No price has been set and ' +
              'nothing is reserved. Quote your reference if you call.' +
            '</div>'
          : '<div class="notice" style="margin-top:24px">' +
              '<strong>One more step — send it to the desk.</strong> We could not reach the ' +
              'Trade Desk from this browser, so the request is held on this device only. ' +
              'Send it by email below, or call <a class="textlink" href="tel:+27735694045">' +
              '+27 73 569 4045</a> and quote your reference.' +
            '</div>') +

        '<div class="action-row" style="margin-top:22px">' +
          (landed
            ? '<a class="btn-desk" href="buyer.html">My Requests</a>' +
              '<a class="btn-line" href="trade.html">Back To The Board</a>'
            : '<a class="btn-desk" href="' + T7.esc(mailtoFor(req, l)) + '">Send To The Desk</a>' +
              '<a class="btn-line" href="buyer.html">My Requests</a>') +
        '</div>' +
      '</div>';
  }

  let busy = false;
  async function submit() {
    if (busy) return;
    if (!validate()) return;

    const btn = document.getElementById('submit-qr');
    busy = true;
    btn.disabled = true;
    btn.textContent = 'Checking the lot…';

    try {
      const check = await T7.api.validateLots([{ lot_id: lot.lot_id, name: lot.name }]);
      if (check.problems.length) {
        busy = false;
        btn.disabled = false;
        btn.textContent = 'Submit Quote Request';
        document.getElementById('qr-status').textContent = check.problems[0].message;
        T7.toast('That lot is no longer open for quotes');
        return;
      }

      btn.textContent = 'Submitting…';
      const f = document.getElementById('qr-form');
      const d = new FormData(f);
      const req = await T7.api.submitQuoteRequest({
        contact_name: d.get('contact_name').trim(),
        company:      d.get('company').trim(),
        email:        d.get('email').trim(),
        phone:        d.get('phone').trim(),
        country:      (d.get('country') || '').trim() || null,
        intended_use: (d.get('intended_use') || '').trim() || null,
        message:      (d.get('message') || '').trim() || null,
        lot_ids:      [lot.lot_id]
      });

      confirmed(req, lot);
      T7.toast('Quote request ' + req.reference + ' registered');

    } catch (err) {
      console.error(err);
      busy = false;
      btn.disabled = false;
      btn.textContent = 'Try Again';
      document.getElementById('qr-status').textContent =
        'We could not submit that. Try again, or call the desk on +27 73 569 4045.';
      T7.toast('Request could not be submitted');
    }
  }

  if (!lotId) {
    root.innerHTML = '<div class="empty"><h3>No lot selected</h3><p>Open a lot from the Live Board and request a quote from there.</p><a class="btn-desk" href="trade.html">Open The Live Board</a></div>';
    return;
  }

  T7.api.getLot(lotId).then(l => {
    if (!l) {
      root.innerHTML = '<div class="empty"><h3>Lot not found</h3><p>Lot ' + T7.esc(lotId) + ' is not listed on the desk.</p><a class="btn-desk" href="trade.html">Open The Live Board</a></div>';
      return;
    }
    lot = l;
    const session = T7.auth.current();
    if (session && session.role === 'buyer') form(l, session);
    else signedOut(l);
  }).catch(err => {
    console.error(err);
    root.innerHTML = '<div class="empty"><h3>We could not load that lot</h3><p>Please try again in a moment, or call +27 73 569 4045.</p><a class="btn-desk" href="trade.html">Open The Live Board</a></div>';
  });
})();
