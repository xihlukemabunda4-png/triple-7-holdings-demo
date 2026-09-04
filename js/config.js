/* ============================================================
   Triple 7 Holdings — frontend configuration
   ------------------------------------------------------------
   Person 2: fill these in and the whole commerce frontend switches
   from the demo seed to the real Supabase tables. Nothing else has
   to change — js/api.js reads this and picks its transport.

   Both values below are PUBLIC by design. The anon key is meant to
   be shipped to browsers; it is safe only because row-level
   security is on. The anon role needs exactly one privilege:

     - products    : RLS on. SELECT for anon. No INSERT or UPDATE.
     - orders      : RLS on. NOTHING for anon — not even SELECT.
     - order_items : RLS on. NOTHING for anon.

   Orders are written and read by the serverless functions in /api
   using the service-role key, because the browser cannot be trusted
   to name its own prices or to read someone else's delivery address.

   The service-role key must NEVER appear in this file. It belongs
   in Vercel/Supabase environment variables, read only by the
   serverless functions in /api.
   ============================================================ */
window.T7_CONFIG = {
  supabaseUrl: '',      // e.g. 'https://xxxxxxxx.supabase.co'
  supabaseAnonKey: '',  // the anon / publishable key

  // Which gateway api/create-payment.js should talk to.
  // 'payfast' | 'yoco' | 'stripe'
  paymentProvider: 'payfast'
};
