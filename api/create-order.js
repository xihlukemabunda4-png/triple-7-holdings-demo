/* ============================================================
   POST /api/create-order
   ------------------------------------------------------------
   The browser sends WHICH stones it wants and where to send them.
   It does not send what they cost. This function re-reads every
   stone from the products table, adds it up itself, and stores
   that. The browser's total arrives only as `expected_total_zar`
   and is used for one thing: if it disagrees with the server's
   arithmetic the order is refused, so the buyer is never shown one
   number and charged another.

   Returns only what the confirmation page needs, plus the token
   that page is addressed by.
   ============================================================ */
const {
  db, readBody, send, text, isEmail, totals,
  makeReference, makeToken
} = require('./_lib');

const MAX_STONES = 10;
const SKU_RE = /^[A-Za-z0-9-]{1,32}$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { message: 'Method not allowed' });

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return send(res, 400, { message: 'We could not read that request.' });
  }

  /* ---------- Validate the buyer ---------- */
  const customer = body.customer || {};
  const delivery = body.delivery || {};

  const name  = text(customer.name, 120, true);
  const email = text(customer.email, 254, true);
  const phone = text(customer.phone, 40, true);
  const line1 = text(delivery.line1, 200, true);
  const city  = text(delivery.city, 100, true);
  const prov  = text(delivery.province, 60, true);
  const post  = text(delivery.postcode, 10, true);

  if (!name || !email || !phone || !line1 || !city || !prov || !post) {
    return send(res, 400, { message: 'Some delivery details are missing.' });
  }
  if (!isEmail(email)) {
    return send(res, 400, { message: 'That email address does not look right.' });
  }
  if (!/^\d{4}$/.test(post)) {
    return send(res, 400, { message: 'South African postal codes are four digits.' });
  }

  /* ---------- Validate the basket ---------- */
  const skus = Array.isArray(body.skus) ? body.skus : [];
  if (!skus.length) return send(res, 400, { message: 'There is nothing in the order.' });
  if (skus.length > MAX_STONES) {
    return send(res, 400, { message: 'Orders of more than ' + MAX_STONES + ' stones are arranged by phone. Please call us.' });
  }
  if (!skus.every(s => typeof s === 'string' && SKU_RE.test(s))) {
    return send(res, 400, { message: 'One of the stock numbers is not valid.' });
  }
  /* A repeated SKU would be counted twice against a stone that only
     exists once. */
  const unique = skus.filter((s, i) => skus.indexOf(s) === i);

  try {
    /* ---------- Price from the register, not from the browser ---------- */
    const list = unique.map(s => '"' + s + '"').join(',');
    const rows = await db(
      'products?select=id,sku,title,price_zar,status&sku=in.(' + encodeURIComponent(list) + ')'
    );

    const unavailable = unique.filter(sku => {
      const row = rows.find(r => r.sku === sku);
      return !row || row.status !== 'available';
    });
    if (unavailable.length) {
      return send(res, 409, {
        code: 'unavailable',
        unavailable: unavailable,
        message: 'One of the stones has just been taken. Your selection has been updated.'
      });
    }

    const money = totals(rows.reduce((sum, r) => sum + Number(r.price_zar), 0));

    const expected = Number(body.expected_total_zar);
    if (Number.isFinite(expected) && expected !== money.total) {
      return send(res, 409, {
        code: 'price-changed',
        message: 'Prices have changed since you loaded the page. Please check your selection again.'
      });
    }

    /* ---------- Store it ---------- */
    const order = (await db('orders', {
      method: 'POST',
      body: {
        reference: makeReference(),
        public_token: makeToken(),
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        delivery_line1: line1,
        delivery_city: city,
        delivery_province: prov,
        delivery_postcode: post,
        delivery_country: text(delivery.country, 60) || 'South Africa',
        notes: text(body.notes, 1000) || null,
        subtotal_zar: money.subtotal,
        shipping_zar: money.shipping,
        vat_zar: money.vat,
        total_zar: money.total,
        status: 'pending'
      }
    }))[0];

    await db('order_items', {
      method: 'POST',
      prefer: 'return=minimal',
      body: rows.map(r => ({
        order_id: order.id,
        product_id: r.id,
        sku: r.sku,
        title: r.title,
        unit_price_zar: r.price_zar,
        qty: 1
      }))
    });

    /* Nothing about other people's orders, and no internal ids. */
    return send(res, 201, {
      reference: order.reference,
      public_token: order.public_token,
      status: order.status,
      subtotal_zar: order.subtotal_zar,
      shipping_zar: order.shipping_zar,
      vat_zar: order.vat_zar,
      total_zar: order.total_zar
    });

  } catch (err) {
    /* The detail goes to the Vercel log, never to the browser — it can
       carry table names and constraint text. */
    console.error('create-order failed:', err);
    return send(res, 500, { message: 'We could not create the order. Please try again, or call +27 73 569 4045.' });
  }
};
