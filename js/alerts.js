/* ============================================================
   Triple 7 Holdings — lot alerts
   ------------------------------------------------------------
   "Tell me when new lots list."

   The desk lists a handful of lots and restocks irregularly. A
   buyer who arrives on a quiet week has no reason to return, and
   no way to know when that changes. This is the one mechanism
   that fixes that, and the resulting list belongs to Triple 7.

   Deliberately modest: an address and which markets you care
   about. It promises notification and nothing else — no
   newsletter, no "exclusive access", no claims about frequency
   the desk has not agreed to.
   ============================================================ */
(function () {
  const mount = document.getElementById('alerts');
  if (!mount) return;

  function form(existing) {
    mount.innerHTML =
      '<div class="alerts">' +
        '<div class="alerts-copy">' +
          '<h2>New lots, as they list</h2>' +
          '<p>The desk lists irregularly. Leave an address and we will tell you when ' +
             'something new comes onto the board — nothing else.</p>' +
        '</div>' +
        '<form class="alerts-form" id="alerts-form" novalidate>' +
          '<div class="alerts-row">' +
            '<label class="sr-only" for="alert-email">Email address</label>' +
            '<input id="alert-email" name="email" type="email" autocomplete="email" ' +
              'placeholder="you@company.co.za" value="' + T7.esc(existing || '') + '" required>' +
            '<button type="submit" class="btn-desk" id="alert-submit">Notify Me</button>' +
          '</div>' +
          '<div class="chips" style="margin-top:14px">' +
            '<label class="chip is-on"><input type="checkbox" name="interests" value="diamond" checked>Diamonds</label>' +
            '<label class="chip is-on"><input type="checkbox" name="interests" value="gold" checked>Gold</label>' +
          '</div>' +
          '<p class="field-error" id="alert-error"></p>' +
        '</form>' +
      '</div>';

    const f = document.getElementById('alerts-form');

    f.addEventListener('change', e => {
      if (e.target.name === 'interests') {
        e.target.closest('.chip').classList.toggle('is-on', e.target.checked);
      }
    });

    f.addEventListener('input', () => { document.getElementById('alert-error').textContent = ''; });

    f.addEventListener('submit', async e => {
      e.preventDefault();
      const input = document.getElementById('alert-email');
      const err = document.getElementById('alert-error');
      const email = input.value.trim();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        err.textContent = 'That email address does not look right.';
        input.focus();
        return;
      }

      const interests = [...f.querySelectorAll('[name=interests]:checked')].map(i => i.value);
      if (!interests.length) {
        err.textContent = 'Pick at least one market.';
        return;
      }

      const btn = document.getElementById('alert-submit');
      btn.disabled = true;
      btn.textContent = 'Adding…';

      try {
        const result = await T7.api.subscribe(email, interests);
        done(email, interests, result.delivered);
      } catch (e2) {
        console.error(e2);
        btn.disabled = false;
        btn.textContent = 'Try Again';
        err.textContent = 'We could not add you just now. Try again, or call +27 73 569 4045.';
      }
    });
  }

  function done(email, interests, delivered) {
    const markets = interests.map(i => T7.COMMODITY_LABEL[i] || i).join(' and ');
    mount.innerHTML =
      '<div class="alerts is-done">' +
        '<div class="alerts-copy">' +
          '<h2>' + (delivered ? 'You are on the list' : 'Saved on this device') + '</h2>' +
          '<p>' +
            (delivered
              ? 'We will let ' + T7.esc(email) + ' know when new ' + T7.esc(markets.toLowerCase()) + ' lots come onto the board.'
              : 'We could not reach the desk from this browser, so this has not been registered. ' +
                'Email <a class="textlink" href="mailto:info@triple7holdings.co.za?subject=' +
                encodeURIComponent('Lot alerts') + '&body=' +
                encodeURIComponent('Please add ' + email + ' to lot alerts for: ' + markets) +
                '">info@triple7holdings.co.za</a> and we will add you.') +
          '</p>' +
        '</div>' +
        '<button type="button" class="btn-line" id="alert-change">Change</button>' +
      '</div>';
    document.getElementById('alert-change').addEventListener('click', () => form(email));
  }

  const already = T7.api.subscribedAs();
  form(already);
})();
