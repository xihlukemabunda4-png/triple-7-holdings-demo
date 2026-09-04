/* ============================================================
   Triple 7 Holdings — data layer
   ------------------------------------------------------------
   THE SEAM. Every read and write the commerce frontend performs
   goes through T7.api. Nothing else in the UI knows whether the
   data came from Supabase or from the local demo seed.

   Two modes, chosen at load:

     supabase — window.T7_CONFIG.supabaseUrl + supabaseAnonKey are
                set (see js/config.js). Talks to Person 2's tables
                over PostgREST.
     demo     — no config. Reads js/t7-data.js, keeps orders in
                localStorage. Every page still works end to end.

   Column names are the contract with Person 2 — see COMMERCE.md.
   If a column name changes, it changes HERE and nowhere else.
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

  /* ---------- Demo store ---------- */
  const ORDERS_KEY = 't7.orders';
  const SOLD_KEY = 't7.sold';

  /* In live mode a paid order updates products.status and the stone is
     gone for everybody. Demo mode has no database, so the stones sold
     during a demo are remembered here instead — otherwise a diamond you
     just bought would still be on sale on the next page. */
  function demoSold() {
    try { return JSON.parse(localStorage.getItem(SOLD_KEY)) || []; }
    catch (e) { return []; }
  }
  function applySold(rows) {
    const sold = demoSold();
    if (!sold.length) return rows;
    return rows.map(r => sold.indexOf(r.sku) === -1 ? r : Object.assign({}, r, { status: 'sold' }));
  }

  function demoOrders() {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveDemoOrders(list) {
    try { localStorage.setItem(ORDERS_KEY, JSON.stringify(list)); } catch (e) {}
  }

  /* Reference the customer can quote on the phone. Person 2's table
     should generate its own on insert; in demo mode we mint one here. */
  function makeReference() {
    const n = Math.floor(Math.random() * 90000) + 10000;
    return 'T7-' + new Date().getFullYear() + '-' + n;
  }

  /* The reference is short so it can be read down a phone, which also
     makes it guessable — so it must never be the thing that unlocks an
     order. The confirmation page is addressed by this token instead. */
  function makeToken() {
    const bytes = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.prototype.map.call(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- Public API ---------- */
  T7.api = {
    mode: live ? 'supabase' : 'demo',

    /* Every available and reserved stone. Sold stones are excluded —
       a diamond is a unique item, so a sold row is gone for good. */
    async listDiamonds() {
      if (live) {
        return rest('products?select=*&status=neq.sold&order=price_zar.desc');
      }
      return applySold(window.T7_SEED || [])
        .filter(d => d.status !== 'sold')
        .sort((a, b) => b.price_zar - a.price_zar);
    },

    async getDiamond(sku) {
      if (live) {
        const rows = await rest('products?select=*&sku=eq.' + encodeURIComponent(sku) + '&limit=1');
        return rows[0] || null;
      }
      return applySold((window.T7_SEED || []).filter(d => d.sku === sku))[0] || null;
    },

    /* Re-reads the current price of every stone in the cart and reports
       what changed. The cart in localStorage can be days old, and a stone
       may have been reserved or sold in the meantime. */
    async validateCart(items) {
      const skus = items.map(i => i.sku);
      if (!skus.length) return { lines: [], problems: [] };

      let rows;
      if (live) {
        const list = skus.map(encodeURIComponent).join(',');
        rows = await rest('products?select=*&sku=in.(' + list + ')');
      } else {
        rows = applySold((window.T7_SEED || []).filter(d => skus.indexOf(d.sku) !== -1));
      }

      const lines = [];
      const problems = [];
      items.forEach(item => {
        const row = rows.find(r => r.sku === item.sku);
        if (!row) {
          problems.push({ sku: item.sku, reason: 'gone', message: item.title + ' is no longer listed.' });
          return;
        }
        if (row.status !== 'available') {
          problems.push({ sku: item.sku, reason: row.status, message: row.title + ' has been ' + row.status + '.' });
          return;
        }
        if (Number(row.price_zar) !== Number(item.price_zar)) {
          problems.push({ sku: item.sku, reason: 'price', message: row.title + ' has changed price.' });
        }
        lines.push(row);
      });
      return { lines: lines, problems: problems };
    },

    /* Writes the order. In live mode this is a pending order that only the
       payment notification can move to `paid` — the browser never marks an
       order paid, because the browser can lie. */
    async createOrder(payload) {
      const order = {
        reference: makeReference(),
        public_token: makeToken(),
        customer_name: payload.customer_name,
        customer_email: payload.customer_email,
        customer_phone: payload.customer_phone,
        delivery_line1: payload.delivery_line1,
        delivery_city: payload.delivery_city,
        delivery_province: payload.delivery_province,
        delivery_postcode: payload.delivery_postcode,
        delivery_country: payload.delivery_country || 'South Africa',
        notes: payload.notes || null,
        subtotal_zar: payload.subtotal_zar,
        shipping_zar: payload.shipping_zar,
        vat_zar: payload.vat_zar,
        total_zar: payload.total_zar,
        status: 'pending',
        payment_provider: null,
        payment_ref: null
      };

      if (live) {
        /* Deliberately NOT a PostgREST insert. The browser must not be
           able to write an order — it would be free to name its own
           prices. The function re-reads every stone from the products
           table, recomputes the totals, and inserts with the service
           role. The amounts sent from here are a cross-check that the
           server is allowed to reject, not an instruction. */
        const res = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer: {
              name: order.customer_name,
              email: order.customer_email,
              phone: order.customer_phone
            },
            delivery: {
              line1: order.delivery_line1,
              city: order.delivery_city,
              province: order.delivery_province,
              postcode: order.delivery_postcode,
              country: order.delivery_country
            },
            notes: order.notes,
            skus: payload.items.map(i => i.sku),
            expected_total_zar: order.total_zar
          })
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.message || 'The order could not be created.');
        }
        return res.json();
      }

      order.id = 'demo-' + Date.now();
      order.created_at = new Date().toISOString();
      order.items = payload.items.map(i => ({
        sku: i.sku, title: i.title, unit_price_zar: i.price_zar, qty: 1
      }));
      const all = demoOrders();
      all.push(order);
      saveDemoOrders(all);
      return order;
    },

    /* Addressed by the order's own token, never by the reference, and
       answered by a serverless function rather than PostgREST — the anon
       role has no SELECT on `orders` at all, which is what stops one
       buyer reading another buyer's address off the confirmation page. */
    async getOrder(token) {
      if (live) {
        const res = await fetch('/api/order-status?token=' + encodeURIComponent(token));
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('Order lookup failed (' + res.status + ')');
        return res.json();
      }
      return demoOrders().find(o => o.public_token === token) || null;
    },

    /* Demo only. Stands in for the gateway's server-to-server notification,
       which in live mode is the ONLY thing allowed to settle an order. */
    settleDemoOrder(token, status) {
      if (live) throw new Error('Orders are settled by the payment notification, not the browser.');
      const all = demoOrders();
      const order = all.find(o => o.public_token === token);
      if (!order) return null;
      order.status = status;
      order.payment_provider = 'demo-sandbox';
      order.payment_ref = 'SIM-' + Date.now();
      saveDemoOrders(all);

      /* Mirror what the backend does on payment: the stones come off the
         market, and stay off across page loads. */
      if (status === 'paid') {
        const sold = demoSold();
        (order.items || []).forEach(item => {
          if (sold.indexOf(item.sku) === -1) sold.push(item.sku);
        });
        try { localStorage.setItem(SOLD_KEY, JSON.stringify(sold)); } catch (e) {}
      }
      return order;
    },

    /* ---------- Payment ----------
       Hands the order to the serverless function, which is the only place
       that may hold a merchant passphrase. It answers with either a URL to
       send the browser to, or a set of form fields to POST to the gateway.
       Swapping PayFast for Yoco or Stripe changes api/create-payment.js
       and nothing on this side of the wire. */
    async startPayment(order) {
      /* Demo mode has no merchant account, so it stands in a sandbox
         gateway page that can approve or decline. Same shape of answer,
         same redirect, so the checkout code below is unchanged when the
         real function takes over. */
      if (!live) {
        return { mode: 'redirect', url: 'pay.html?t=' + encodeURIComponent(order.public_token) };
      }

      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: order.public_token })
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error('Payment could not be started. ' + detail.slice(0, 200));
      }
      return res.json();
    }
  };
})();
