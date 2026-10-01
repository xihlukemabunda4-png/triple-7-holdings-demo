/* ============================================================
   Triple 7 Holdings — Trade Desk data layer
   ------------------------------------------------------------
   THE SEAM. Every read and write the Trade Desk performs goes
   through T7.api. Nothing in the UI knows whether the data came
   from Supabase or from the local development lots.

   Two modes, chosen at load:

     supabase — window.T7_CONFIG.supabaseUrl + supabaseAnonKey are
                set (see js/config.js). Talks to the Trade Desk
                tables over PostgREST.
     demo     — no config. Reads js/t7-lots.js. Quote requests are
                kept locally and handed to the desk by email, so
                nothing is silently lost.

   Column names are the contract with Person 2 — see COMMERCE.md.
   If a column name changes, it changes HERE and nowhere else.

   WHAT THIS DELIBERATELY DOES NOT DO: buyer accounts, seller
   inventory, admin approval, quote pricing. Those need
   server-enforced authorization, which a static site cannot
   provide. See COMMERCE.md for where that boundary sits.
   ============================================================ */
window.T7 = window.T7 || {};

(function () {
  const cfg = window.T7_CONFIG || {};
  const live = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);

  /* ---------- Supabase / PostgREST transport ---------- */
  async function rest(path, options) {
    const opts = options || {};
    const res = await fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + path, {
      method: opts.method || 'GET',
      headers: Object.assign({
        apikey: cfg.supabaseAnonKey,
        Authorization: 'Bearer ' + cfg.supabaseAnonKey,
        'Content-Type': 'application/json',
        Prefer: opts.prefer || 'return=representation'
      }, opts.headers || {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error('Supabase ' + res.status + ': ' + detail.slice(0, 200));
    }
    return res.status === 204 ? null : res.json();
  }

  /* ---------- Local store ---------- */
  const REQUESTS_KEY = 't7.requests';

  function localRequests() {
    try { return JSON.parse(localStorage.getItem(REQUESTS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveLocalRequests(list) {
    try { localStorage.setItem(REQUESTS_KEY, JSON.stringify(list)); } catch (e) {}
  }

  /* ---------- Delivery ----------
     Three ways a submission can reach the desk, tried in this order:

       1. T7_CONFIG.formEndpoint — a third-party form service. This is
          the route for plain static hosting with no serverless at all.
       2. the serverless function in /api — email via Resend, plus a
          Supabase row when the database exists.
       3. nothing worked — the caller is told, and the UI falls back to
          handing the buyer a pre-addressed email.

     The one thing this must never do is claim success it did not get. */
  async function deliver(apiPath, payload) {
    const endpoint = cfg.formEndpoint || apiPath;
    const via = cfg.formEndpoint ? 'form' : 'api';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) return { delivered: false, reason: 'status-' + res.status };
      const body = await res.json().catch(() => ({}));
      return { delivered: true, via: via, reference: body.reference || null };
    } catch (e) {
      /* A static host with no /api returns 404 rather than throwing, so
         this branch is usually a genuine network failure. */
      return { delivered: false, reason: 'network' };
    }
  }

  /* Reference a buyer can quote on the phone. The real table should
     generate its own on insert. */
  function makeReference() {
    const n = Math.floor(Math.random() * 9000) + 1000;
    return 'QR-' + new Date().getFullYear() + '-' + n;
  }

  /* ---------- Public API ---------- */
  T7.api = {
    mode: live ? 'supabase' : 'demo',

    /* Every listed lot. Closed lots stay visible — a buyer seeing what
       has recently traded is part of the desk's pitch — and the board
       sorts them below what is open. */
    async listLots() {
      if (live) {
        return rest('lots?select=*&order=lot_id.asc');
      }
      return (window.T7_LOTS || []).slice();
    },

    async getLot(lotId) {
      if (live) {
        const rows = await rest('lots?select=*&lot_id=eq.' + encodeURIComponent(lotId) + '&limit=1');
        return rows[0] || null;
      }
      return (window.T7_LOTS || []).find(l => l.lot_id === lotId) || null;
    },

    async listDesks() {
      if (live) return rest('desks?select=*');
      return (window.T7_DESKS || []).slice();
    },

    /* Re-reads the given lots and reports anything that has changed or
       gone since the buyer last looked. */
    async validateLots(items) {
      const ids = items.map(i => i.lot_id);
      if (!ids.length) return { lines: [], problems: [] };

      let rows;
      if (live) {
        const list = ids.map(encodeURIComponent).join(',');
        rows = await rest('lots?select=*&lot_id=in.(' + list + ')');
      } else {
        rows = (window.T7_LOTS || []).filter(l => ids.indexOf(l.lot_id) !== -1);
      }

      const lines = [];
      const problems = [];
      items.forEach(item => {
        const row = rows.find(r => r.lot_id === item.lot_id);
        if (!row) {
          problems.push({ lot_id: item.lot_id, message: item.name + ' is no longer listed on the desk.' });
          return;
        }
        if (row.status !== 'live') {
          problems.push({ lot_id: item.lot_id, message: row.name + ' is no longer open for quotes.' });
          return;
        }
        lines.push(row);
      });
      return { lines: lines, problems: problems };
    },

    /* Records a quote request against one or more lots.

       A quote request is an expression of interest, NOT a purchase and
       NOT an offer. No price is named here by either side — the desk
       prices it afterwards. That is the whole point of the model.

       Delivery is deliberately NOT gated on Supabase. A request that
       reaches nobody is worse than no form at all, so it is attempted
       whatever the database situation, and the caller is told plainly
       whether it landed. */
    async submitQuoteRequest(payload) {
      const request = {
        reference: makeReference(),
        contact_name: payload.contact_name,
        company: payload.company,
        email: payload.email,
        phone: payload.phone,
        country: payload.country || null,
        message: payload.message || null,
        intended_use: payload.intended_use || null,
        lot_ids: payload.lot_ids,
        status: 'submitted',
        created_at: new Date().toISOString()
      };

      /* Kept locally first, so the buyer's own dashboard shows it even
         if the network drops on the way out. */
      const all = localRequests();
      all.push(request);
      saveLocalRequests(all);

      const result = await deliver('/api/quote-request', request);
      if (result.reference) request.reference = result.reference;

      /* Reflect the real reference back into the local copy. */
      if (result.reference) {
        const stored = localRequests();
        const last = stored[stored.length - 1];
        if (last) { last.reference = result.reference; saveLocalRequests(stored); }
      }

      return Object.assign({}, request, {
        delivered: result.delivered,
        via: result.via || null
      });
    },

    /* "Tell me when new lots list." A desk with irregular supply has no
       other way to bring a buyer back, and it builds a list the desk
       owns rather than renting from a search engine. */
    async subscribe(email, interests) {
      const entry = {
        kind: 'lot-alert',
        email: String(email || '').trim(),
        interests: interests && interests.length ? interests : ['diamond', 'gold'],
        created_at: new Date().toISOString()
      };
      try { localStorage.setItem('t7.alerts', JSON.stringify(entry)); } catch (e) {}
      const result = await deliver('/api/notify-signup', entry);
      return Object.assign({}, entry, { delivered: result.delivered, via: result.via || null });
    },

    subscribedAs() {
      try {
        const e = JSON.parse(localStorage.getItem('t7.alerts'));
        return e && e.email ? e.email : null;
      } catch (e) { return null; }
    },

    /* Local only. Real request tracking needs the Trade Desk backend —
       a buyer must never be able to read another buyer's request, and
       that can only be enforced server-side. */
    listLocalRequests() {
      return localRequests();
    }
  };
})();
