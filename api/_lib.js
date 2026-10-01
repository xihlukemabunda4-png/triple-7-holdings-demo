/* ============================================================
   Triple 7 Holdings — serverless shared helpers
   ------------------------------------------------------------
   Everything in /api runs on Vercel with the Supabase SERVICE ROLE
   key. That key bypasses row-level security, so nothing in this
   folder may echo a request body into a query without checking it
   first, and nothing may return another party's record.

   Environment variables (set in Vercel -> Settings -> Environment
   Variables, never in the repo):

     SUPABASE_URL               https://xxxx.supabase.co
     SUPABASE_SERVICE_ROLE_KEY  service_role key - SECRET
     DESK_NOTIFY_EMAIL          where new quote requests are sent
   ============================================================ */
const crypto = require('crypto');

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
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1e6) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function send(res, status, payload) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(payload));
}

/* Drops control characters by character code rather than by regex —
   they have no place in a name or a company, and they are how log
   and header injection starts. */
function stripControl(value) {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 31 && code !== 127) out += value[i];
  }
  return out;
}

/* Trims, strips control characters, caps length, and refuses anything
   that is not a string. Everything the buyer types passes through here
   before it is stored. */
function text(value, max, required) {
  if (typeof value !== 'string') return required ? null : '';
  const clean = stripControl(value).trim();
  if (required && clean.length === 0) return null;
  return clean.slice(0, max);
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(value.trim());
}

/* ---------- Identifiers ---------- */
function makeReference() {
  return 'QR-' + new Date().getFullYear() + '-' + crypto.randomInt(1000, 10000);
}

function makeToken() {
  return crypto.randomBytes(16).toString('hex');
}

function isToken(value) {
  return typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);
}

module.exports = {
  db, readBody, send, text, stripControl, isEmail,
  makeReference, makeToken, isToken, crypto
};
