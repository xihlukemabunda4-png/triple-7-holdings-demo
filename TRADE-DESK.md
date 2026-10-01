# Trade Desk — Person 3

Public marketplace for the Triple 7 Kimberley desk: Live Board, lot pages,
Trade Basket, quote requests. Built into the existing static site.

**Read this first if you are comparing against triple7holdings.co.za.** The
production Trade Desk is a **Next.js** application. This is the **static HTML
site**, a separate codebase. The two are not the same project and this folder
does not contain the Next.js source. What is here mirrors the live desk's
model, content and lot data — it does not replace it.

---

## The model

Not a shop. There is no cart, no basket, no checkout, no payment, and no price
anywhere in this codebase, because in this model no price exists until the desk
issues one in writing. Lots are approached one at a time: open a lot, request a
quote on it. A buyer may save lots to a watchlist, which is a bookmark and not a
step toward purchase.

```
DISCOVER → EVALUATE → REQUEST QUOTE → (desk prepares terms)
         → ACCEPT / DECLINE / REQUEST CHANGES → SETTLEMENT → DOCUMENTATION
```

Everything past **REQUEST QUOTE** happens off this site, at the desk. A quote
request registers interest. It reserves nothing, obliges nobody, and names no
figure.

---

## Files

| File | Does |
|---|---|
| `trade.html` + `js/board.js` | Live Board — search, filters, sort, market sections |
| `lot.html` + `js/lot.js` | One lot: detail, spec table, related lots, basket actions |
| `quote.html` + `js/quote.js` | Quote request for a single lot |
| `signin.html` + `js/signin.js` | **Sandbox** sign-in, buyer or seller |
| `buyer.html` + `js/buyer.js` | **Sandbox** buyer desk — watchlist, requests |
| `seller.html` + `js/seller.js` | **Sandbox** seller desk — drafts, inventory demo |
| `js/auth.js` | **Sandbox** session. NOT authentication — read its header |
| `how-to-buy.html` | The seven-step journey, browse through to documentation |
| `provenance.html` | What the desk will and will not put in writing about origin |
| `js/api.js` | **The seam.** Every read and write goes through here |
| `js/trade.js` | Watchlist store, lot media, toast |
| `js/t7-lots.js` | **Development data.** The four real lots. Delete once `lots` is seeded |
| `js/config.js` | Where Person 2 pastes the Supabase URL and anon key |
| `css/trade.css` | All desk styling. Touches nothing in `styles.css` |
| `api/quote-request.js` | Emails the desk, confirms to the buyer, stores if Supabase exists |
| `api/notify-signup.js` | Lot-alert sign-ups |
| `js/alerts.js` | "Tell me when new lots list" capture on the board |
| `images/lots/` | The four lot photographs, from the live desk's own assets |

Changes to Person 1's pages were four lines each: the nav link now reads
**Trade** and points at `trade.html`, the footer link likewise, plus
`trade.css` and `trade.js`. Nothing else in those files was touched.

---

## Lot data is copied, not invented

Every lot name, descriptor, description, pricing label and image in
`js/t7-lots.js` is taken **verbatim from triple7holdings.co.za/trade**. No
carat weights, purities, assays, certificates, quantities or origins were
added. Where the live desk is silent, the field is `null` and the UI omits the
row — a dash reads as "none" when the truth is "not stated".

Two consequences you will notice and should not treat as bugs:

- **The Origin filter does not appear.** Only D-1042 states an origin, and a
  facet with one value filters nothing.
- **The spec table is short.** Seven rows, because seven fields are published.

One thing worth raising with whoever owns the live site: **D-1042 "Kimberley
Rough Parcel" is illustrated with a photograph of gold bars** (`/brand/lot-rough.jpg`).
That is the live desk's own asset choice and it has been reproduced faithfully
here. It looks like a content error on their side.

---

## For Person 2 — the schema

```sql
create table lots (
  id            uuid primary key default gen_random_uuid(),
  lot_id        text not null unique,          -- D-1042, G-2201
  commodity     text not null check (commodity in ('diamond','gold')),
  name          text not null,
  type          text,                          -- rough, polished, refined, concentrate
  origin        text,
  descriptors   text[],                        -- 'Natural', 'Untreated', 'Mine origin'
  pricing       text,                          -- 'Quote on request', 'Market-linked'
  status        text not null default 'live'
                  check (status in ('draft','live','reserved','closed','withdrawn')),
  verification  text,
  description   text,
  image         text,
  image_card    text,
  image_alt     text,
  latest        boolean not null default false,
  quantity      numeric,
  unit          text,
  condition     text,
  treatment     text,
  last_updated  timestamptz,
  created_at    timestamptz not null default now()
);

create table desks (
  key          text primary key,               -- 'diamond', 'gold'
  label        text not null,
  status       text not null default 'open' check (status in ('open','closed')),
  blurb        text,
  board_blurb  text
);

create table quote_requests (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,          -- QR-2026-4969, quotable on the phone
  public_token  text not null unique,          -- 32 hex, for any future status lookup
  contact_name  text not null,
  company       text not null,
  email         text not null,
  phone         text not null,
  country       text,
  intended_use  text,
  message       text,
  status        text not null default 'submitted'
                  check (status in ('submitted','under_review','more_information_required',
                                    'quote_prepared','quote_sent','accepted','declined',
                                    'expired','cancelled','completed')),
  desk_notes    text,                          -- INTERNAL. Never returned to a buyer.
  created_at    timestamptz not null default now()
);

create table lot_alerts (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  interests   text[] not null default array['diamond','gold'],
  created_at  timestamptz not null default now()
);

create table quote_request_lots (
  id                uuid primary key default gen_random_uuid(),
  quote_request_id  uuid not null references quote_requests(id) on delete cascade,
  lot_id            uuid references lots(id),
  lot_ref           text not null
);

create index on lots (status);
create index on quote_request_lots (quote_request_id);
```

### Row-level security

The anon key ships to every browser, so it may do exactly two things.

```sql
alter table lots               enable row level security;
alter table desks              enable row level security;
alter table quote_requests     enable row level security;
alter table quote_request_lots enable row level security;
alter table lot_alerts         enable row level security;

create policy "anyone may read listed lots"
  on lots for select to anon, authenticated using (status <> 'draft');

create policy "anyone may read desks"
  on desks for select to anon, authenticated using (true);

-- quote_requests, quote_request_lots and lot_alerts get NO anon policy.
-- lot_alerts especially: a readable subscriber list is a leak, and an
-- anon-writable one is a spam target.
```

Requests are written by `api/quote-request.js` with the service-role key.
A browser that can insert a request can also set its own `status`; a browser
that can select them can read other buyers' contact details. `desk_notes` must
never leave the server.

### Environment variables

| Name | Notes |
|---|---|
| `RESEND_API_KEY` | **secret.** Without it nothing is emailed — see below |
| `MAIL_FROM` | e.g. `Triple 7 Trade Desk <desk@triple7holdings.co.za>`, on a verified domain |
| `DESK_NOTIFY_EMAIL` | where quote requests and alert sign-ups land |
| `SUPABASE_URL` | optional — `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | optional, **secret** — never in the repo, never in `config.js` |

**Set the three mail variables first.** They matter more than the database:
a stored request nobody reads is worth less than an email with no row behind it.

## How a request actually reaches the desk

This is the part that decides whether the Trade Desk works or merely looks
like it does. `deliver()` in `js/api.js` tries, in order:

1. **`T7_CONFIG.formEndpoint`** — a form service (Formspree, Web3Forms, Basin).
   Only for hosting with no serverless at all. Leave it empty on Vercel.
2. **`/api/quote-request`** — emails the desk, sends the buyer a confirmation
   carrying their reference, and writes a row when Supabase is configured.
3. **Neither worked** — the request is kept in the browser and the buyer is
   handed a pre-addressed email.

The UI reports which of these happened, honestly. Delivered, it says
**"Request Received"** and describes what the desk does next. Not delivered, it
says **"Request Saved"**, states that the desk does not have it, and offers the
email fallback. It never claims a request landed when it did not — a buyer who
believes the desk has their enquiry and then hears nothing is worse off than
one who knows to phone.

The serverless function is deliberately tolerant: Supabase missing is fine
(email still goes), email misconfigured is survivable (the row is still
written, and the failure is logged). It returns 503 only when *nothing* worked,
so the browser can tell the truth.

Note that `mailto:` alone was the previous design and is no longer the primary
path. It depends on the visitor having a mail client configured and choosing to
press send; on a phone or on webmail, a meaningful share of requests quietly
evaporate. It survives only as the last fallback.

---

## Going live

1. Create the tables and policies above.
2. Seed `lots` and `desks`. `js/t7-lots.js` is the four real lots in exactly
   the right shape.
3. Fill in `js/config.js` with the project URL and the **anon** key.
4. Delete `js/t7-lots.js` and its `<script>` tags.

`js/api.js` switches transport on the presence of the config values, so step 3
is the moment the desk goes live.

---

## The sandbox sign-in is NOT authentication

`signin.html`, `buyer.html` and `seller.html` demonstrate the buyer and seller
journeys. Behind them:

- no password is checked — the form says so on screen
- no identity is verified
- the session is a localStorage object the visitor can edit
- `T7.auth.requireRole()` is a courtesy redirect, not a control; dev tools
  bypass it in seconds

Every screen it unlocks carries a blue SANDBOX bar. **Do not remove those, do
not put real buyer or seller data behind it, and do not present it to a client
as a secure area.** Real accounts need Supabase Auth with RLS in the Next.js
application, where rules are enforced server-side.

The seller desk shows the desk's own listed lots as illustrative inventory and
says so in a notice on the page — a seller does not own those lots.

## What is deliberately NOT built

The brief asks for buyer, seller and admin portals with registration,
verification, inventory submission, quote preparation, documents, messaging and
audit logs. **None of that is here, and it should not be faked here.**

Section 28 of the brief is the reason: *Buyer A must NOT be able to access
Buyer B's quote by changing an ID in the URL… Authorization must be enforced
server-side.* A static HTML site has no server and no session. Every
"portal" it could offer would be a screen anyone opens with dev tools, and
every "private" document would be a public URL. That is worse than having no
portal, because it looks like security and is not.

What exists instead is the part that is honestly achievable without a backend:
the public marketplace, a quote request that genuinely reaches the desk, and a
clearly-labelled sandbox that walks through the buyer and seller journeys
without pretending to secure anything.

The portals belong in the Next.js application, where Supabase Auth, RLS and
server components can actually enforce the rules. When someone hands over that
repo, the schema above is already the right shape to extend.

## Lot alerts, and why they are there

The desk lists a handful of lots and restocks irregularly. A buyer who arrives
on a quiet week has no reason to return and no way to know when that changes.
The capture block at the bottom of the board is the only mechanism that fixes
that, and the list it builds belongs to Triple 7 rather than to a search engine.

It promises notification and nothing else — no newsletter, no frequency the
desk has not agreed to. `api/notify-signup.js` gives the same answer whether or
not an address is already on the list, because a different answer would let
anyone test whether a given person trades with Triple 7.

## Printing a lot

B2B buyers forward lots internally, and the person who signs off is rarely the
person browsing. The lot page has a print stylesheet: nav, strip, footer and
panels drop away, the ink header goes to paper-white, and links print their own
URLs so a paper copy can still be acted on. "Print this lot sheet" sits under
the lot detail.

### The one other gap

Request tracking. `submitQuoteRequest` records the request and returns a
reference, but there is no `/trade/buyer/quotes/[id]` for the buyer to watch,
because reading a request back safely needs the same server-side authorization.
Until then the confirmation page hands the buyer a pre-addressed email carrying
their reference and lot ID, and the desk replies directly. That is stated
plainly on screen rather than hidden behind a status badge that never moves.
