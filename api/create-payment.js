/* ============================================================
   POST /api/create-payment
   ------------------------------------------------------------
   Turns a pending order into a signed PayFast form post. The
   merchant passphrase never leaves this function; the browser
   receives only the fields and the signature, which are public by
   the time the buyer's browser posts them anyway.

   Swapping gateway: this file is the whole swap. Yoco and Stripe
   both want a server-created session and answer with a redirect
   URL, which is the `mode: 'redirect'` shape js/api.js already
   understands — a Yoco version of this file returns that instead
   and nothing else in the site changes.
   ============================================================ */
const { db, readBody, send, isToken, crypto } = require('./_lib');

const ENDPOINT = {
  sandbox: 'https://sandbox.payfast.co.za/eng/process',
  live: 'https://www.payfast.co.za/eng/process'
};

/* PayFast signs the string exactly as PHP's urlencode() produces it:
   spaces become '+', hex digits are upper case, and !'()* are escaped
   too. encodeURIComponent agrees on almost all of that, so we correct
   the differences rather than hand-rolling an encoder. */
function pfEncode(value) {
  return encodeURIComponent(String(value).trim())
    .replace(/%20/g, '+')
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function sign(fields, passphrase) {
  /* Order matters — PayFast rebuilds this string from the fields in the
     order they were posted, so the object's insertion order IS the
     contract. Empty fields are left out entirely. */
  let base = Object.keys(fields)
    .filter(key => fields[key] !== '' && fields[key] != null)
    .map(key => key + '=' + pfEncode(fields[key]))
    .join('&');

  if (passphrase) base += '&passphrase=' + pfEncode(passphrase);
  return crypto.createHash('md5').update(base).digest('hex');
}

function splitName(full) {
  const parts = String(full).trim().split(/\s+/);
  const first = parts.shift() || '';
  return { first: first.slice(0, 100), last: (parts.join(' ') || first).slice(0, 100) };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { message: 'Method not allowed' });

  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE || '';
  const mode = process.env.PAYFAST_MODE === 'live' ? 'live' : 'sandbox';
  const site = (process.env.SITE_URL || '').replace(/\/$/, '');

  if (!merchantId || !merchantKey || !site) {
    console.error('create-payment: PayFast or SITE_URL environment variables are missing.');
    return send(res, 500, { message: 'Payments are not configured yet. Please call +27 73 569 4045.' });
  }

  let body;
  try { body = await readBody(req); }
  catch (e) { return send(res, 400, { message: 'We could not read that request.' }); }

  const token = body.token;
  if (!isToken(token)) return send(res, 400, { message: 'That order reference is not valid.' });

  try {
    const rows = await db(
      'orders?select=reference,public_token,status,total_zar,customer_name,customer_email,customer_phone' +
      '&public_token=eq.' + encodeURIComponent(token) + '&limit=1'
    );
    const order = rows[0];
    if (!order) return send(res, 404, { message: 'We could not find that order.' });

    if (order.status !== 'pending') {
      /* Already settled. Sending the buyer to the gateway again would
         risk charging them twice. */
      return send(res, 409, { code: 'settled', message: 'This order has already been dealt with.' });
    }

    const name = splitName(order.customer_name);

    /* Insertion order below IS the signature order. Do not reorder. */
    const fields = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: site + '/order.html?t=' + encodeURIComponent(order.public_token),
      cancel_url: site + '/cart.html',
      notify_url: site + '/api/payment-notify',

      name_first: name.first,
      name_last: name.last,
      email_address: order.customer_email,
      cell_number: String(order.customer_phone || '').replace(/[^\d+]/g, '').slice(0, 20),

      m_payment_id: order.reference,
      amount: Number(order.total_zar).toFixed(2),
      item_name: ('Triple 7 Holdings order ' + order.reference).slice(0, 100),
      item_description: 'Natural diamonds, insured courier and VAT included'
    };

    fields.signature = sign(fields, passphrase);

    return send(res, 200, {
      mode: 'post',
      url: ENDPOINT[mode],
      fields: fields,
      sandbox: mode === 'sandbox'
    });

  } catch (err) {
    console.error('create-payment failed:', err);
    return send(res, 500, { message: 'We could not start the payment. Please try again.' });
  }
};
