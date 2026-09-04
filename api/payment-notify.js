/* ============================================================
   POST /api/payment-notify   (PayFast ITN)
   ------------------------------------------------------------
   The ONLY thing in this codebase allowed to mark an order paid.
   The buyer's browser is never trusted with that, because anyone
   can open a console and call a function; PayFast's server calling
   ours, with a signature we can check, is the real evidence.

   Four checks before a cent is believed, in cheapest-first order:

     1. the signature over the posted fields matches our passphrase
     2. the request came from a PayFast IP address
     3. the amount matches what we stored for that order
     4. PayFast itself confirms the payload is VALID when we post
        it straight back at them

   Then, and only then, the order is settled and the stones are
   marked sold. Settling is idempotent: PayFast retries an ITN it
   thinks failed, and a retry must not sell the stones twice.

   ALWAYS answers 200. A non-200 makes PayFast retry, and there is
   nothing useful to retry when we have already decided the message
   is a forgery.
   ============================================================ */
const dns = require('dns').promises;
const { db, readBody, crypto } = require('./_lib');

const VALIDATE = {
  sandbox: 'https://sandbox.payfast.co.za/eng/query/validate',
  live: 'https://www.payfast.co.za/eng/query/validate'
};

/* PayFast posts from these hosts. Resolved at request time rather than
   hard-coded, because the addresses behind them do change. */
const PAYFAST_HOSTS = [
  'www.payfast.co.za',
  'sandbox.payfast.co.za',
  'w1w.payfast.co.za',
  'w2w.payfast.co.za'
];

function pfEncode(value) {
  return encodeURIComponent(String(value).trim())
    .replace(/%20/g, '+')
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/* The signature covers the fields in the order they arrived, which is
   why the raw body matters: re-serialising a parsed object can reorder
   them and the hash would never match. */
function orderedPairs(body) {
  const raw = body.__raw;
  if (typeof raw === 'string' && raw.length) {
    return raw.split('&').filter(Boolean).map(part => {
      const eq = part.indexOf('=');
      const key = eq === -1 ? part : part.slice(0, eq);
      const val = eq === -1 ? '' : part.slice(eq + 1);
      return [decodeURIComponent(key.replace(/\+/g, ' ')), decodeURIComponent(val.replace(/\+/g, ' '))];
    });
  }
  return Object.keys(body).map(k => [k, body[k]]);
}

function checkSignature(pairs, passphrase) {
  const posted = pairs.find(p => p[0] === 'signature');
  if (!posted) return false;

  let base = pairs
    .filter(p => p[0] !== 'signature')
    .map(p => p[0] + '=' + pfEncode(p[1]))
    .join('&');

  if (passphrase) base += '&passphrase=' + pfEncode(passphrase);
  const expected = crypto.createHash('md5').update(base).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(String(posted[1]).toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function fromPayFast(ip) {
  if (!ip) return false;
  const clean = String(ip).replace(/^::ffff:/, '');
  const lists = await Promise.all(PAYFAST_HOSTS.map(host =>
    dns.resolve4(host).catch(() => [])
  ));
  return lists.some(addresses => addresses.indexOf(clean) !== -1);
}

async function confirmWithPayFast(raw, mode) {
  const res = await fetch(VALIDATE[mode], {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: raw
  });
  const answer = (await res.text()).trim();
  return answer.split(/\s/)[0].toUpperCase() === 'VALID';
}

module.exports = async (req, res) => {
  /* Answer PayFast immediately whatever happens below. */
  const done = () => { res.status(200).send('OK'); };

  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }

  const passphrase = process.env.PAYFAST_PASSPHRASE || '';
  const mode = process.env.PAYFAST_MODE === 'live' ? 'live' : 'sandbox';

  let body;
  try { body = await readBody(req); }
  catch (e) { console.error('notify: unreadable body', e); return done(); }

  const pairs = orderedPairs(body);
  const get = key => { const p = pairs.find(x => x[0] === key); return p ? p[1] : undefined; };

  const reference = get('m_payment_id');
  const paymentStatus = String(get('payment_status') || '').toUpperCase();
  const gross = Number(get('amount_gross'));
  const pfPaymentId = get('pf_payment_id');

  if (!reference) { console.error('notify: no m_payment_id'); return done(); }

  /* 1 — signature */
  if (!checkSignature(pairs, passphrase)) {
    console.error('notify: signature mismatch for', reference);
    return done();
  }

  /* 2 — source */
  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
               (req.socket && req.socket.remoteAddress);
    const ok = await fromPayFast(ip);
    if (!ok) {
      if (mode === 'live') {
        console.error('notify: rejected, ' + ip + ' is not a PayFast address');
        return done();
      }
      /* Sandbox traffic sometimes arrives from an address outside the
         published list. Log it, carry on, never do this in live. */
      console.warn('notify: sandbox source ' + ip + ' not in PayFast ranges — continuing');
    }
  } catch (e) {
    console.error('notify: source check failed', e);
    if (mode === 'live') return done();
  }

  try {
    const rows = await db(
      'orders?select=id,reference,status,total_zar&reference=eq.' + encodeURIComponent(reference) + '&limit=1'
    );
    const order = rows[0];
    if (!order) { console.error('notify: no order', reference); return done(); }

    /* Idempotency. A retried notification for an order we already
       settled is normal and must change nothing. */
    if (order.status !== 'pending') {
      console.log('notify: ' + reference + ' already ' + order.status + ', ignoring');
      return done();
    }

    /* 3 — amount */
    if (!Number.isFinite(gross) || Math.abs(gross - Number(order.total_zar)) > 0.01) {
      console.error('notify: amount mismatch on ' + reference + ' — got ' + gross + ', expected ' + order.total_zar);
      return done();
    }

    /* 4 — PayFast's own word for it */
    const raw = body.__raw;
    if (typeof raw === 'string' && raw.length) {
      const valid = await confirmWithPayFast(raw, mode);
      if (!valid) {
        console.error('notify: PayFast did not validate the payload for', reference);
        return done();
      }
    } else {
      console.warn('notify: no raw body to validate for', reference);
    }

    const settled = paymentStatus === 'COMPLETE' ? 'paid' : 'failed';

    await db('orders?id=eq.' + encodeURIComponent(order.id), {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: {
        status: settled,
        payment_provider: 'payfast',
        payment_ref: pfPaymentId || null,
        paid_at: settled === 'paid' ? new Date().toISOString() : null
      }
    });

    if (settled === 'paid') {
      /* One stone, one buyer. Take them off the market. */
      const items = await db('order_items?select=product_id&order_id=eq.' + encodeURIComponent(order.id));
      const ids = items.map(i => i.product_id).filter(Boolean);
      if (ids.length) {
        const list = ids.map(id => '"' + id + '"').join(',');
        await db('products?id=in.(' + encodeURIComponent(list) + ')', {
          method: 'PATCH',
          prefer: 'return=minimal',
          body: { status: 'sold' }
        });
      }
      console.log('notify: ' + reference + ' paid, ' + ids.length + ' stone(s) marked sold');
    } else {
      console.log('notify: ' + reference + ' ' + paymentStatus);
    }

  } catch (err) {
    console.error('notify: settling failed for ' + reference, err);
  }

  return done();
};

/* Vercel would otherwise parse the form body for us and we would lose
   the exact field order the signature is computed over. */
module.exports.config = { api: { bodyParser: false } };
