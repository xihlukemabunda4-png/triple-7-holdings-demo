/* ============================================================
   GET /api/order-status?token=...
   ------------------------------------------------------------
   The confirmation page's only way to read an order. The anon
   Supabase role has no SELECT on `orders` at all, so this is the
   single door, and it is addressed by the order's own random token
   rather than by the short reference a person could guess.

   Returns the minimum the page needs to say "thank you". It does
   NOT return the delivery address, the phone number, or the
   internal ids — a token found in a shared browser's history
   should not be a way to read where a diamond is being sent.
   ============================================================ */
const { db, send, isToken } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { message: 'Method not allowed' });

  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  if (!isToken(token)) return send(res, 400, { message: 'That link is not valid.' });

  try {
    const rows = await db(
      'orders?select=reference,status,customer_email,subtotal_zar,shipping_zar,vat_zar,total_zar,' +
      'order_items(sku,title,unit_price_zar,qty)' +
      '&public_token=eq.' + encodeURIComponent(token) + '&limit=1'
    );
    const order = rows[0];
    if (!order) return send(res, 404, { message: 'We could not find that order.' });

    /* Enough to recognise the confirmation is yours, not enough to be
       worth stealing. */
    const email = String(order.customer_email || '');
    const masked = email.replace(/^(.)(.*)(@.*)$/, (m, a, b, c) => a + '•'.repeat(Math.min(b.length, 6)) + c);

    return send(res, 200, {
      reference: order.reference,
      status: order.status,
      customer_email: masked,
      subtotal_zar: order.subtotal_zar,
      shipping_zar: order.shipping_zar,
      vat_zar: order.vat_zar,
      total_zar: order.total_zar,
      items: (order.order_items || []).map(i => ({
        sku: i.sku, title: i.title, unit_price_zar: i.unit_price_zar, qty: i.qty
      }))
    });

  } catch (err) {
    console.error('order-status failed:', err);
    return send(res, 500, { message: 'We could not read that order just now.' });
  }
};
