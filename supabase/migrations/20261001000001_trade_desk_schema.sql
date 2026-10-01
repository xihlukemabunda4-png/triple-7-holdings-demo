-- =========================================================
-- Trade Desk schema — Person 2
-- Column names are the contract with js/api.js and
-- api/quote-request.js (see TRADE-DESK.md). Do not rename.
-- =========================================================
create extension if not exists pgcrypto;

-- ---------- lots (the "products") ----------
create table public.lots (
  id            uuid primary key default gen_random_uuid(),
  lot_id        text not null unique check (lot_id ~ '^[A-Z]-\d{3,6}$'),  -- D-1042, G-2201
  commodity     text not null check (commodity in ('diamond','gold')),
  name          text not null,
  type          text,                          -- rough, polished, refined, concentrate
  origin        text,
  descriptors   text[],
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

-- ---------- desks ----------
create table public.desks (
  key          text primary key,               -- 'diamond', 'gold'
  label        text not null,
  status       text not null default 'open' check (status in ('open','closed')),
  blurb        text,
  board_blurb  text
);

-- ---------- quote requests (the "orders") ----------
create table public.quote_requests (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,
  -- FIX: api/quote-request.js does not send this, so it must default
  -- or every insert fails and requests only arrive by email.
  public_token  text not null unique default encode(gen_random_bytes(16), 'hex'),
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
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table public.quote_request_lots (
  id                uuid primary key default gen_random_uuid(),
  quote_request_id  uuid not null references public.quote_requests(id) on delete cascade,
  lot_id            uuid references public.lots(id),
  lot_ref           text not null
);

-- ---------- lot alerts ----------
create table public.lot_alerts (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  interests   text[] not null default array['diamond','gold'],
  created_at  timestamptz not null default now()
);

-- ---------- audit log: every status change on a lot or request ----------
create table public.status_events (
  id          bigint generated always as identity primary key,
  entity      text not null check (entity in ('lot','quote_request')),
  entity_id   uuid not null,
  from_status text,
  to_status   text not null,
  changed_by  uuid,                            -- auth.uid(), null when service role
  created_at  timestamptz not null default now()
);

create index on public.lots (status);
create index on public.lots (commodity, status);
create index on public.quote_requests (status, created_at desc);
create index on public.quote_request_lots (quote_request_id);
create index on public.quote_request_lots (lot_id);
create index on public.status_events (entity, entity_id, created_at desc);

-- =========================================================
-- Triggers
-- =========================================================

-- lots.last_updated / quote_requests.updated_at stamp themselves
create or replace function public.stamp_lot() returns trigger language plpgsql as $$
begin new.last_updated = now(); return new; end $$;
create trigger trg_lots_stamp before update on public.lots
  for each row execute function public.stamp_lot();

create or replace function public.stamp_request() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger trg_requests_stamp before update on public.quote_requests
  for each row execute function public.stamp_request();

-- quote_request_lots: api only sends lot_ref; resolve the FK here
create or replace function public.resolve_lot_ref() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lot_id is null then
    select id into new.lot_id from public.lots where lot_id = new.lot_ref;
  end if;
  return new;
end $$;
create trigger trg_resolve_lot_ref before insert on public.quote_request_lots
  for each row execute function public.resolve_lot_ref();

-- status audit
create or replace function public.log_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.status_events (entity, entity_id, from_status, to_status, changed_by)
    values (case tg_table_name when 'lots' then 'lot' else 'quote_request' end,
            new.id,
            case when tg_op = 'UPDATE' then old.status end,
            new.status,
            auth.uid());
  end if;
  return new;
end $$;
create trigger trg_lots_status after insert or update of status on public.lots
  for each row execute function public.log_status();
create trigger trg_requests_status after insert or update of status on public.quote_requests
  for each row execute function public.log_status();
