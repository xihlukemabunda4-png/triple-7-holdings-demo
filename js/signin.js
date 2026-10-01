/* ============================================================
   Triple 7 Holdings — SANDBOX sign-in screen
   ------------------------------------------------------------
   Two roles, one form. Any email signs you in, because nothing is
   verified — see js/auth.js. The screen says so plainly rather
   than staging a convincing-looking login, which would be the
   dishonest version of the same demo.
   ============================================================ */
(function () {
  const root      = document.getElementById('signin-root');
  const tabBuyer  = document.getElementById('tab-buyer');
  const tabSeller = document.getElementById('tab-seller');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  let role = params.get('role') === 'seller' ? 'seller' : 'buyer';
  const next = params.get('next');

  const COPY = {
    buyer: {
      title: 'Buyer Sign In',
      sub: 'Browse listed lots, keep a watchlist, and request quotes from the Kimberley desk.',
      cta: 'Sign In As Buyer',
      dest: 'buyer.html'
    },
    seller: {
      title: 'Seller Sign In',
      sub: 'Manage the lots you have placed with the desk and submit new ones for review.',
      cta: 'Sign In As Seller',
      dest: 'seller.html'
    }
  };

  function paintTabs() {
    tabBuyer.classList.toggle('is-on', role === 'buyer');
    tabSeller.classList.toggle('is-on', role === 'seller');
    tabBuyer.setAttribute('aria-selected', role === 'buyer' ? 'true' : 'false');
    tabSeller.setAttribute('aria-selected', role === 'seller' ? 'true' : 'false');
  }

  function render() {
    const c = COPY[role];
    const session = T7.auth.current();

    document.getElementById('desk-title').textContent = c.title;
    document.getElementById('desk-sub').textContent = c.sub;
    document.title = c.title + ' — Trade Desk — Triple 7 Holdings';

    if (session) {
      root.innerHTML =
        '<div class="notice" style="margin-bottom:22px">' +
          '<strong>Already signed in</strong> as ' + T7.esc(session.company) +
          ' (' + T7.esc(session.role) + ').' +
        '</div>' +
        '<div class="action-row">' +
          '<a class="btn-desk" href="' + (session.role === 'seller' ? 'seller.html' : 'buyer.html') + '">Go To Dashboard</a>' +
          '<button type="button" class="btn-line" id="do-signout">Sign Out</button>' +
        '</div>';
      document.getElementById('do-signout').addEventListener('click', () => {
        T7.auth.signOut();
        render();
        T7.toast('Signed out');
      });
      return;
    }

    root.innerHTML =
      '<form class="form" id="signin-form" novalidate>' +
        '<div class="field">' +
          '<label for="email">Email</label>' +
          '<input id="email" name="email" type="email" autocomplete="email" placeholder="you@company.co.za" required>' +
          '<p class="field-error" id="err-email"></p>' +
        '</div>' +
        '<div class="field">' +
          '<label for="company">Company <span class="opt">(optional)</span></label>' +
          '<input id="company" name="company" type="text" autocomplete="organization" placeholder="Your trading name">' +
        '</div>' +
        '<div class="field">' +
          '<label for="password">Password</label>' +
          '<input id="password" name="password" type="password" autocomplete="current-password" placeholder="Anything at all">' +
          '<p class="field-error" style="color:var(--text-dark-2)">Not checked. This is a sandbox — do not type a real password.</p>' +
        '</div>' +
        '<button type="submit" class="btn-desk" style="justify-content:center">' + c.cta + '</button>' +
      '</form>' +

      '<p class="desk-footnote" style="margin-top:30px">' +
        'Real accounts are opened with the Trade Desk directly. ' +
        '<a class="textlink" href="contact.html">Contact the desk</a> to begin registration.' +
      '</p>';

    const form = document.getElementById('signin-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const email = form.elements.email.value.trim();
      const err = document.getElementById('err-email');
      const wrap = form.elements.email.closest('.field');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        err.textContent = 'Enter an email address so the demo has something to show.';
        wrap.classList.add('is-invalid');
        form.elements.email.focus();
        return;
      }
      err.textContent = '';
      wrap.classList.remove('is-invalid');

      T7.auth.signIn(role, email, form.elements.company.value);
      T7.toast('Signed in — sandbox');
      location.href = next || COPY[role].dest;
    });

    form.addEventListener('input', e => {
      if (e.target.name === 'email') {
        document.getElementById('err-email').textContent = '';
        e.target.closest('.field').classList.remove('is-invalid');
      }
    });
  }

  tabBuyer.addEventListener('click', () => { role = 'buyer'; paintTabs(); render(); });
  tabSeller.addEventListener('click', () => { role = 'seller'; paintTabs(); render(); });

  paintTabs();
  render();
})();
