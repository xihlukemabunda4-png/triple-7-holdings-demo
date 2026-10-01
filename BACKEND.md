# Backend — Person 2

Supabase for the Trade Desk. Built to the contract in `TRADE-DESK.md`, so
`js/api.js` and `api/*.js` work unchanged.

```
supabase/
  migrations/
    20261001000001_trade_desk_schema.sql   lots, desks, quote_requests, quote_request_lots,
                                           lot_alerts, status_events (audit) + triggers
    20261001000002_staff_auth_rls.sql      profiles + roles, is_staff(), all RLS,
                                           desk_queue view, lot-images bucket
  seed.sql                                 the 4 lots + 2 desks from js/t7-lots.js
```

## Mapping from the original split
| Brief said | In this codebase |
|---|---|
| products | `lots` |
| orders | `quote_requests` + `quote_request_lots` (no prices, by design) |
| inventory | `lots.status`: draft → live → reserved → closed / withdrawn |
| authentication | Supabase Auth for **staff only**. Public sign-in stays the sandbox |
| admin | `profiles.role` (`desk` / `admin`), staff RLS, `desk_queue`, `status_events` |

## Additions beyond TRADE-DESK.md
- `public_token` now has a default. `api/quote-request.js` never sends one, so without
  this every insert failed and requests only arrived by email.
- `quote_request_lots.lot_id` is filled from `lot_ref` by a trigger.
- `lots.last_updated` / `quote_requests.updated_at` stamp themselves.
- `status_events` records every lot and request status change and who made it.

## Access
| Role | Can |
|---|---|
| anon (browser) | read non-draft lots, read desks. Nothing else |
| authenticated, role `none` | nothing |
| `desk` | manage lots/desks, read + update requests, read alerts/audit |
| `admin` | the above + grant roles, delete alert sign-ups |
| service role (`/api` only) | everything; bypasses RLS |

## Secrets
Anon key → `js/config.js` (public by design).
Service-role key → Vercel env `SUPABASE_SERVICE_ROLE_KEY` only. Never in the repo.
