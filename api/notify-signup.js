/* ============================================================
   POST /api/notify-signup
   ------------------------------------------------------------
   "Tell me when new lots list." A desk with irregular supply has
   no other way to bring a buyer back, and the resulting list
   belongs to Triple 7 rather than to a search engine.

   Stores the address when Supabase is configured, and tells the
   desk either way. Deliberately quiet about whether an address is
   already on the list — that answer is a way to test whether a
   given person trades with Triple 7, which is not ours to give.
   ============================================================ */
const { db, readBody, send, text, isEmail } = require('./_lib');

const VALID = ['diamond', 'gold'];

async function sendMail(to, subject, body) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from || !to) return { sent: false, reason: 'not-configured' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: from, to: [to], subject: subject, text: body })
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

  const email = text(body.email, 254, true);
  if (!email || !isEmail(email)) {
    return send(res, 400, { message: 'Please give an email address we can reach you on.' });
  }

  const interests = Array.isArray(body.interests)
    ? body.interests.filter(i => VALID.indexOf(i) !== -1)
    : [];
  const wants = interests.length ? interests : VALID.slice();

  let stored = false;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      /* Upsert on email so a second sign-up updates interests rather
         than erroring on the unique index. */
      await db('lot_alerts?on_conflict=email', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: { email: email, interests: wants }
      });
      stored = true;
    } catch (err) {
      console.error('notify-signup: store failed', err);
    }
  }

  const desk = await sendMail(
    process.env.DESK_NOTIFY_EMAIL,
    'Lot alert sign-up — ' + email,
    ['New lot alert sign-up.', '', 'Email: ' + email, 'Interested in: ' + wants.join(', '),
     stored ? '' : '(Not written to the database — see the Vercel log.)'].join('\n')
  );

  if (!stored && !desk.sent) {
    return send(res, 503, { message: 'We could not add you just now. Please try again shortly.' });
  }

  /* Same answer whether or not they were already on the list. */
  return send(res, 201, { ok: true, interests: wants });
};
