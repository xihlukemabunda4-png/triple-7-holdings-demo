/* ============================================================
   POST /api/quote-request
   ------------------------------------------------------------
   Records a buyer's interest in one or more listed lots and gets
   it in front of the Kimberley desk. It does NOT price anything,
   reserve anything, or create an obligation on either side.

   Two jobs, in order of importance:

     1. EMAIL THE DESK. A quote request that reaches nobody is
        worse than no form at all, so this runs whether or not a
        database exists.
     2. Store the row, if Supabase is configured.

   Deliberately tolerant: if Supabase is absent the request still
   goes out by email and returns 201. If email is unconfigured but
   the database is, it still stores and returns 201 — with a flag
   the desk can see in the logs. It returns 5xx only when nothing
   at all worked, because a false success loses business.
   ============================================================ */
const { db, readBody, send, text, isEmail, makeReference } = require('./_lib');

const MAX_LOTS = 20;
const LOT_RE = /^[A-Z]-\d{3,6}$/;
const REF_RE = /^QR-\d{4}-\d{4,6}$/;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendMail(to, subject, text_body, html) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from || !to) return { sent: false, reason: 'not-configured' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: from, to: [to], subject: subject, text: text_body, html: html })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { sent: false, reason: res.status + ' ' + detail.slice(0, 200) };
  }
  return { sent: true };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { message: 'Method not allowed' });

  let body;
  try { body = await readBody(req); }
  catch (e) { return send(res, 400, { message: 'We could not read that request.' }); }

  const name    = text(body.contact_name, 120, true);
  const company = text(body.company, 160, true);
  const email   = text(body.email, 254, true);
  const phone   = text(body.phone, 40, true);

  if (!name || !company || !email || !phone) {
    return send(res, 400, { message: 'Some contact details are missing.' });
  }
  if (!isEmail(email)) {
    return send(res, 400, { message: 'That email address does not look right.' });
  }

  const ids = Array.isArray(body.lot_ids) ? body.lot_ids : [];
  if (!ids.length) return send(res, 400, { message: 'No lots were selected.' });
  if (ids.length > MAX_LOTS) {
    return send(res, 400, { message: 'Requests covering more than ' + MAX_LOTS + ' lots are arranged by phone. Please call the desk.' });
  }
  if (!ids.every(id => typeof id === 'string' && LOT_RE.test(id))) {
    return send(res, 400, { message: 'One of the lot references is not valid.' });
  }
  const lots = ids.filter((id, i) => ids.indexOf(id) === i);

  /* Keep the browser's reference when it is well formed, so the buyer's
     screen and the desk's inbox agree. Otherwise mint one. */
  const reference = (typeof body.reference === 'string' && REF_RE.test(body.reference))
    ? body.reference
    : makeReference();

  const country = text(body.country, 60) || null;
  const use     = text(body.intended_use, 200) || null;
  const message = text(body.message, 2000) || null;

  let stored = false;
  let storeError = null;

  /* ---------- 1. Store, if there is somewhere to store ---------- */
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const request = (await db('quote_requests', {
        method: 'POST',
        body: {
          reference: reference,
          contact_name: name, company: company, email: email, phone: phone,
          country: country, intended_use: use, message: message,
          /* Set here, never accepted from the browser. */
          status: 'submitted'
        }
      }))[0];

      await db('quote_request_lots', {
        method: 'POST',
        prefer: 'return=minimal',
        body: lots.map(ref => ({ quote_request_id: request.id, lot_ref: ref }))
      });
      stored = true;
    } catch (err) {
      /* Losing the row is bad. Losing the email as well would be worse,
         so carry on and still tell the desk. */
      storeError = err.message;
      console.error('quote-request: store failed for ' + reference, err);
    }
  }

  /* ---------- 2. Tell the desk ---------- */
  const lines = [
    'Quote request ' + reference, '',
    'Company: ' + company,
    'Contact: ' + name,
    'Email:   ' + email,
    'Phone:   ' + phone
  ];
  if (country) lines.push('Country: ' + country);
  if (use) lines.push('Intended use: ' + use);
  lines.push('', 'Lots: ' + lots.join(', '));
  if (message) lines.push('', 'Message:', message);
  if (!stored) lines.push('', '(Not written to the database — see the Vercel log.)');

  const deskHtml =
    '<h2 style="font-family:system-ui;margin:0 0 4px">Quote request ' + esc(reference) + '</h2>' +
    '<p style="font-family:system-ui;color:#555;margin:0 0 18px">Lots: <b>' + esc(lots.join(', ')) + '</b></p>' +
    '<table style="font-family:system-ui;font-size:14px;border-collapse:collapse">' +
    [['Company', company], ['Contact', name], ['Email', email], ['Phone', phone],
     ['Country', country], ['Intended use', use]]
      .filter(r => r[1])
      .map(r => '<tr><td style="padding:4px 18px 4px 0;color:#777">' + esc(r[0]) +
                '</td><td style="padding:4px 0"><b>' + esc(r[1]) + '</b></td></tr>').join('') +
    '</table>' +
    (message ? '<p style="font-family:system-ui;font-size:14px;margin-top:18px;white-space:pre-wrap">' + esc(message) + '</p>' : '');

  const desk = await sendMail(
    process.env.DESK_NOTIFY_EMAIL,
    'Quote request ' + reference + ' — ' + company,
    lines.join('\n'),
    deskHtml
  );
  if (!desk.sent) console.error('quote-request: desk email not sent for ' + reference + ' — ' + desk.reason);

  /* ---------- 3. Confirm to the buyer ---------- */
  const buyerText = [
    'Thank you — the Triple 7 Trade Desk has your request.', '',
    'Your reference is ' + reference + '.',
    'Lots: ' + lots.join(', '), '',
    'The desk reviews the request, confirms availability, and comes back to you',
    'with written terms. No price has been set and nothing is reserved yet.', '',
    'Quote your reference if you call: +27 73 569 4045',
    'Triple 7 Holdings, 25 Villiers Street, Kimberley'
  ].join('\n');

  const buyer = await sendMail(
    email,
    'Triple 7 Trade Desk — quote request ' + reference,
    buyerText,
    '<p style="font-family:system-ui">Thank you — the Triple 7 Trade Desk has your request.</p>' +
    '<p style="font-family:system-ui">Your reference is <b>' + esc(reference) + '</b><br>Lots: <b>' + esc(lots.join(', ')) + '</b></p>' +
    '<p style="font-family:system-ui;color:#555">The desk reviews the request, confirms availability, and comes back to you with written terms. No price has been set and nothing is reserved yet.</p>' +
    '<p style="font-family:system-ui;color:#555">Quote your reference if you call: +27 73 569 4045<br>Triple 7 Holdings, 25 Villiers Street, Kimberley</p>'
  );

  /* Nothing landed anywhere — say so rather than returning a reference
     the buyer will quote at a desk that never received it. */
  if (!stored && !desk.sent) {
    return send(res, 503, {
      message: 'We could not reach the desk just now. Please call +27 73 569 4045, or try again shortly.'
    });
  }

  return send(res, 201, {
    reference: reference,
    status: 'submitted',
    lot_ids: lots,
    stored: stored,
    notified: desk.sent,
    confirmed: buyer.sent
  });
};
