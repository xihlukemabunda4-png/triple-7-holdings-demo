/* ============================================================
   Triple 7 Holdings — frontend configuration
   ------------------------------------------------------------
   Person 2: fill these in and the Trade Desk switches from the
   local development lots to the real Supabase tables. Nothing
   else has to change — js/api.js reads this and picks its
   transport.

   Both values below are PUBLIC by design. The anon key is meant
   to be shipped to browsers; it is safe only because row-level
   security is on. The anon role needs exactly one privilege:

     lots                : RLS on. SELECT for anon. No writes.
     desks               : RLS on. SELECT for anon. No writes.
     quote_requests      : RLS on. NOTHING for anon.
     quote_request_lots  : RLS on. NOTHING for anon.

   Quote requests are written by the serverless function in
   /api using the service-role key, never from the browser — a
   browser that can insert a request can also set its status, and
   a browser that can read them can read other buyers' contact
   details.

   The service-role key must NEVER appear in this file. It belongs
   in Vercel environment variables, read only by /api.
   ============================================================ */
window.T7_CONFIG = {
  supabaseUrl: '',      // e.g. 'https://xxxxxxxx.supabase.co'
  supabaseAnonKey: '',  // the anon / publishable key

  /* OPTIONAL — only for hosting with no serverless functions at all.
     Set this to a form service endpoint (Formspree, Web3Forms, Basin)
     and quote requests and lot alerts POST there instead of /api.
     Leave it empty on Vercel: /api/quote-request already emails the
     desk and confirms to the buyer. See TRADE-DESK.md. */
  formEndpoint: ''
};
