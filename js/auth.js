/* ============================================================
   Triple 7 Holdings — SANDBOX sign-in
   ------------------------------------------------------------
   READ THIS BEFORE TRUSTING ANYTHING BELOW.

   This is NOT authentication. It is a demonstration of the buyer
   and seller journeys with no server behind it:

     - no password is checked
     - no identity is verified
     - the session is a localStorage object the visitor can edit
     - the route guard runs in the browser, so anyone who opens
       dev tools reaches any dashboard

   It exists so the desk's shape can be walked through and shown
   to a client. It must never hold real buyer or seller data, and
   it must never be presented as a secure area. Every screen it
   unlocks carries a visible SANDBOX marker for that reason —
   do not remove them.

   Real accounts need Supabase Auth with row-level security in the
   Next.js application, where the rules are enforced server-side.
   See TRADE-DESK.md.
   ============================================================ */
window.T7 = window.T7 || {};

(function () {
  const KEY = 't7.sandbox.session';

  function read() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return s && s.role ? s : null;
    } catch (e) { return null; }
  }

  function write(session) {
    try {
      if (session) localStorage.setItem(KEY, JSON.stringify(session));
      else localStorage.removeItem(KEY);
    } catch (e) {}
    document.dispatchEvent(new CustomEvent('t7:session', { detail: session }));
  }

  T7.auth = {
    /* Always true in a sandbox — that is the point, and the sign-in
       screen says so out loud rather than pretending to check. */
    signIn(role, email, company) {
      const session = {
        role: role === 'seller' ? 'seller' : 'buyer',
        email: String(email || '').trim(),
        company: String(company || '').trim() || 'Demo Company (Pty) Ltd',
        since: new Date().toISOString(),
        sandbox: true
      };
      write(session);
      return session;
    },

    signOut() { write(null); },
    current: read,
    is(role) { const s = read(); return Boolean(s && s.role === role); },

    /* A courtesy redirect, not a security control. Anyone can skip it.
       Never put anything behind this that actually needs protecting. */
    requireRole(role, redirectTo) {
      const s = read();
      if (s && s.role === role) return s;
      const target = redirectTo || ('signin.html?role=' + role + '&next=' + encodeURIComponent(location.pathname.replace(/^\//, '')));
      location.replace(target);
      return null;
    }
  };

  /* ---------- Session-aware nav ----------
     Injected rather than written into 17 files, and it is JS-only
     anyway. Shows who you are pretending to be, and a way out. */
  function mountNavSession() {
    const links = document.querySelector('.nav-links');
    if (!links || links.querySelector('.nav-session')) return;

    const el = document.createElement('div');
    el.className = 'nav-session';
    links.insertBefore(el, links.querySelector('.nav-cta') || null);
    paint();
  }

  function paint() {
    const s = T7.auth.current();
    document.querySelectorAll('.nav-session').forEach(el => {
      el.innerHTML = s
        ? '<a class="nav-who" href="' + (s.role === 'seller' ? 'seller.html' : 'buyer.html') + '">' +
            '<span class="nav-role">' + (s.role === 'seller' ? 'Seller' : 'Buyer') + '</span>' +
            '<span class="nav-dot" aria-hidden="true"></span>' +
          '</a>'
        : '<a class="nav-who is-out" href="signin.html">Sign in</a>';
    });
    document.querySelectorAll('[data-session-role]').forEach(el => {
      el.textContent = s ? (s.company || s.email) : '';
    });
  }

  document.addEventListener('t7:session', paint);
  window.addEventListener('storage', e => { if (e.key === KEY) paint(); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountNavSession);
  } else {
    mountNavSession();
  }
})();
