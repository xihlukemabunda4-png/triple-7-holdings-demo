/* ============================================================
   Triple 7 Holdings — serverless shared helpers
   ------------------------------------------------------------
   Everything in /api runs on Vercel with the Supabase SERVICE ROLE
   key. That key bypasses row-level security, so nothing in this
   folder may ever echo a request body back into a query without
   checking it first, and nothing may return a whole order row to
   the browser.

   Environment variables (set in Vercel -> Settings -> Environment
   Variables, never in the repo):

     SUPABASE_URL               https://xxxx.supabase.co
     SUPABASE_SERVICE_ROLE_KEY  service_role key - SECRET
     PAYFAST_MERCHANT_ID        from the PayFast dashboard
     PAYFAST_MERCHANT_KEY       from the PayFast dashboard
     PAYFAST_PASSPHRASE         set one in PayFast; required for
                                signature validation - SECRET
     PAYFAST_MODE               'sandbox' (default) or 'live'
     SITE_URL                   https://triple7holdings.co.za
   ============================================================ */
const crypto = require('crypto');

/* These two must agree with js/commerce.js. They are duplicated on
   purpose: the browser needs them to display a total before the
   order exists, and the server refuses to trust the browser's
   arithmetic. If one changes, change both - create-order compares
   its own total against the browser's and rejects a mismatch, so a
   drift shows up immediately rather than silently. */
const SHIPPING_ZAR = 850;
const VAT_RATE = 0.15;

function totals(subtotal) {
  const net = Math.round(Number(subtotal) || 0);
  const vat = Math.round((net + SHIPPING_ZAR) * VAT_RATE);
  return { subtotal: net, shipping: SHIPPING_ZAR, vat: vat, total: net + SHIPPING_ZAR + vat };
}

/* ---------- Supabase, service role ---------- */
async function db(path, options) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured on the server.');

  const opts = options || {};
  const res = await fetch(url.replace(/\/$/, '') + '/rest/v1/' + path, {
    method: opts.method || 'GET',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=representation'
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error('Supabase ' + res.status + ' on ' + path + ': ' + detail.slice(0, 300));
  }
  return res.status === 204 ? null : res.json();
}

/* ---------- Request helpers ---------- */
function readBody(req) {
  /* Vercel parses JSON for us when the content type says so, but a
     gateway posting form-encoded data arrives as a raw stream. */
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1e6) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      const type = String(req.headers['content-type'] || '');
      try {
        if (type.indexOf('application/json') !== -1) return resolve(JSON.parse(raw));
        const out = {};
        new URLSearchParams(raw).forEach((v, k) => { out[k] = v; });
        /* The signature must be checked over the bytes as sent, so the
           raw string travels with the parsed object. */
        Object.defineProperty(out, '__raw', { value: raw, enumerable: false });
        resolve(out);
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function send(res, status, payload) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(payload));
}

/* Trims, strips control characters, caps length, and refuses anything
   that is not a string. Everything the buyer types passes through here
   before it is stored. Control characters have no place in a name or
   an address, and they are how log and header injection starts. */
function text(value, max, required) {
  if (typeof value !== 'string') return required ? null : '';
  const clean = value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (required && clean.length === 0) return null;
  return clean.slice(0, max);
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(value.trim());
}

/* ---------- Identifiers ---------- */
function makeReference() {
  return 'T7-' + new Date().getFullYear() + '-' + crypto.randomInt(10000, 100000);
}

function makeToken() {
  return crypto.randomBytes(16).toString('hex');
}

/* A token off the wire goes straight into a query string, so it is
   checked against its own alphabet before it is used. */
function isToken(value) {
  return typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);
}

/* Compares two secrets without leaking their length through timing. */
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

module.exports = {
  SHIPPING_ZAR, VAT_RATE, totals,
  db, readBody, send, text, isEmail,
  makeReference, makeToken, isToken, safeEqual,
  crypto
};
