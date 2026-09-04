# Commerce — Person 3

Diamond catalogue, filters, product pages, cart, checkout, payment integration,
and the seam onto Person 2's Supabase backend.

Right now it runs **end to end in demo mode** with no backend at all: the
catalogue reads a local seed file, orders go to `localStorage`, and a sandbox
gateway page stands in for PayFast. Point it at Supabase and the same UI runs
against real data without a line of UI code changing.

---

## What is in this slice

| File | Does |
|---|---|
| `diamonds.html` + `js/catalogue.js` | Catalogue, filter rail, sorting, URL-shareable filter state |
| `diamond.html` + `js/product.js` | One stone: full grading table, certificate, provenance, add to selection |
| `cart.html` + `js/cart-page.js` | The selection, re-checked against the register on load |
| `checkout.html` + `js/checkout.js` | Details form, validation, order creation, hand-off to the gateway |
| `order.html` + `js/order.js` | Confirmation. Reports what the *backend* says, never what the URL says |
| `pay.html` + `js/pay.js` | **Demo only** sandbox gateway. Delete before go-live |
| `js/api.js` | **The seam.** Every read and write goes through here |
| `js/commerce.js` | Cart store, money, stone drawings, nav cart button, toast |
| `js/config.js` | Where Person 2 pastes the Supabase URL and anon key |
| `js/t7-data.js` | **Demo only** placeholder inventory. Delete once `products` is seeded |
| `css/commerce.css` | All commerce styling. Touches nothing in `styles.css` |
| `api/*.js` | Vercel serverless functions — orders, payment, ITN |
| `tools/` | Local only, not deployed. `npm run stones` normalises raw photos onto a black backdrop at a consistent size |

Changes to Person 1's pages were kept to four lines each: a `Diamonds` nav
link, a `Diamonds` footer link, `commerce.css`, and `commerce.js`. Nothing
else in those files was touched.

---

## For Person 2 — the schema I am coding against

Column names below are the contract. If any of them need to change, change them
here and in `js/api.js` and the files in `api/` — nowhere else knows them.

```sql
create table products (
  id              uuid primary key default gen_random_uuid(),
  sku             text not null unique,
  title           text not null,
  type            text not null check (type in ('polished','rough')),
  shape           text not null,          -- round, princess, oval, emerald,
                                          -- pear, cushion, marquise, radiant, rough
  carat           numeric(6,2) not null,
  colour          text,                   -- D..M
  clarity         text,                   -- FL, IF, VVS1..SI2 (VS/SI for rough)
  cut             text,                   -- null for rough
  polish          text,
  symmetry        text,
  fluorescence    text,
  measurements    text,
  certificate_lab text,                   -- GIA, HRD, IGI
  certificate_no  text,
  origin_mine     text not null,          -- must match the mine page names
  price_zar       numeric(12,2) not null check (price_zar >= 0),
  status          text not null default 'available'
                    check (status in ('available','reserved','sold')),
  image_url       text,                   -- null until studio photography exists
  created_at      timestamptz not null default now()
);

create table orders (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique,       -- T7-2026-12345, quotable on the phone
  public_token      text not null unique,       -- 32 hex, addresses the confirmation page
  customer_name     text not null,
  customer_email    text not null,
  customer_phone    text not null,
  delivery_line1    text not null,
  delivery_city     text not null,
  delivery_province text not null,
  delivery_postcode text not null,
  delivery_country  text not null default 'South Africa',
  notes             text,
  subtotal_zar      numeric(12,2) not null,
  shipping_zar      numeric(12,2) not null,
  vat_zar           numeric(12,2) not null,
  total_zar         numeric(12,2) not null,
  status            text not null default 'pending'
                      check (status in ('pending','paid','failed','cancelled','fulfilled')),
  payment_provider  text,
  payment_ref       text,
  paid_at           timestamptz,
  created_at        timestamptz not null default now()
);

create table order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  product_id     uuid references products(id),
  sku            text not null,
  title          text not null,
  unit_price_zar numeric(12,2) not null,
  qty            int not null default 1 check (qty = 1)
);

create index on products (status);
create index on order_items (order_id);
```

`qty` is constrained to 1 on purpose. A diamond is a unique physical object —
there is no such thing as two of one stone, and the cart enforces the same rule.

### Row-level security

The anon key ships to every browser, so it must be able to do exactly one thing.

```sql
alter table products    enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;

create policy "anyone may read the catalogue"
  on products for select to anon, authenticated using (true);

-- orders and order_items get NO anon policy at all.
```

Orders are written and read only by the functions in `api/`, which use the
service-role key. Two reasons, both learned the hard way by other people:

- A browser that can insert an order can name its own prices.
- A browser that can select orders can read other buyers' addresses.

### Admin

Your admin screens should use the service role (or an authenticated staff role
with its own policies) for everything: creating stones, editing prices, setting
`status` to `reserved`, and marking orders `fulfilled`. The storefront never
writes to `products`; the one exception is the payment notification handler,
which sets `status = 'sold'` when an order is paid.

---

## Going from demo to live

1. Create the tables and policies above.
2. Seed `products`. `js/t7-data.js` is 24 rows in exactly the right shape if you
   want a starting point — the demo data is realistic but invented, so replace
   it with the real register.
3. Fill in `js/config.js` with the project URL and the **anon** key.
4. Set the environment variables in Vercel (see below).
5. Delete `js/t7-data.js`, `pay.html`, and `js/pay.js`, and drop their `<script>`
   tags from the commerce pages.

`js/api.js` switches transport on the presence of the config values, so step 3
is the moment the whole frontend goes live.

### Environment variables (Vercel → Settings → Environment Variables)

| Name | Notes |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** — never in the repo, never in `config.js` |
| `PAYFAST_MERCHANT_ID` | from the PayFast dashboard |
| `PAYFAST_MERCHANT_KEY` | from the PayFast dashboard |
| `PAYFAST_PASSPHRASE` | **secret** — set one in PayFast; signatures depend on it |
| `PAYFAST_MODE` | `sandbox` (default) or `live` |
| `SITE_URL` | `https://triple7holdings.co.za` — no trailing slash |

I have not set any of these and cannot: they belong to the owner's accounts.

---

## Why PayFast

Card gateways (Yoco, Stripe) have per-transaction ceilings and carry chargeback
exposure that is painful on a six-figure stone. PayFast is South African,
settles in ZAR, and supports Instant EFT and ordinary EFT next to card — which
is how large-ticket South African sales actually get paid. It also has a real
sandbox, so the whole flow was built and tested without a merchant account.

The choice is not baked in. `api/create-payment.js` is the entire gateway
integration; it answers with either `{mode:'redirect', url}` or
`{mode:'post', url, fields}`, and `js/checkout.js` handles both. A Yoco or
Stripe version returns `mode:'redirect'` with a session URL, and nothing else
in the site moves.

---

## The payment flow, and what is trusted

```
browser                     /api/create-order            Supabase
   |  skus + address              |                          |
   |----------------------------->|  re-reads every price --->|
   |                              |  recomputes the total     |
   |                              |  inserts pending order -->|
   |<-- reference + token --------|                          |
   |
   |  /api/create-payment (token) |
   |----------------------------->|  signs a PayFast form
   |<-- signed fields ------------|
   |
   |  POST to PayFast ----------------------------> gateway
   |                                                   |
   |<-- redirected to order.html?t=<token>             |
                                                       |
        /api/payment-notify  <-------------------------+  server-to-server
              verifies signature, source IP, amount,
              and re-validates with PayFast, then
              marks the order paid and the stones sold
```

The browser sends **which** stones it wants, never what they cost. The server
prices the order from the `products` table and refuses the order if its own
total disagrees with what the browser displayed — so nobody is ever shown one
number and charged another.

Nothing in the browser can mark an order paid. Only `api/payment-notify.js`
does that, and only after four checks: the signature matches our passphrase,
the request came from a PayFast address, the amount matches the stored order,
and PayFast itself confirms the payload is `VALID` when we post it back.
Settling is idempotent — PayFast retries notifications it thinks failed.

---

## Testing PayFast before go-live

Set `PAYFAST_MODE=sandbox` and use PayFast's sandbox merchant credentials.
The ITN cannot reach `localhost`, so run `vercel dev` behind a tunnel (or test
on a Vercel preview deployment) and point `SITE_URL` at that address, otherwise
orders will sit at `pending` forever and the confirmation page will keep saying
"almost there" — which is the correct behaviour, not a bug.

---

## Still open

- **Real inventory.** `js/t7-data.js` is invented. Prices, certificate numbers
  and measurements are plausible, not real. Nothing ships until the owner's
  actual register replaces it.
- **Photography.** The plate takes a photograph when one exists and falls back
  to the drawing when it doesn't — per file, per stone, with no code change.
  Order of preference: `products.image_url` (a photo of *this* stone) →
  `images/stones/<cut>.jpg` (one photo per cut, shared, and labelled on the
  product page as not being this stone) → the drawing. A missing file is
  removed rather than left as a broken image.

  Supplying the pictures is Person 1's job. Two things they need before they
  start, or it gets redone: files are named after the cut — `round.jpg`,
  `princess.jpg`, `oval.jpg`, `emerald.jpg`, `pear.jpg`, `cushion.jpg`,
  `marquise.jpg`, `radiant.jpg`, `rough.jpg` — and they want **black
  backgrounds**, square, about 1400px. The plate blends a dark backdrop away so
  the stone floats in the same ink frame as the drawings; a white backdrop
  survives as a bright square. `tools/normalise-stones.js` will rescue a light
  one, imperfectly.

  Only per-stone photography should ship for anything actually on sale.
- **Reserving stock at checkout.** Today the first *paid* order takes the
  stone, and a second buyer who was mid-checkout gets told at the payment step.
  For a shop this size that is fine and it is stated plainly on the product
  page. If it ever becomes a problem, the fix is a short hold written by
  `create-order` with a timeout that clears it.
- **VAT.** Quoted at the standard 15%. Export sales are zero-rated, and the
  page tells international buyers to speak to the office first rather than
  guessing their tax position from a form.
- **Order confirmation emails.** Not built — they belong on Person 2's side of
  the wire, triggered off the order reaching `paid`. The confirmation page
  already promises the buyer one.
