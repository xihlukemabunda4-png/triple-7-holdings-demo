-- =========================================================
-- Staff auth + row level security
--
-- Public site (anon key in js/config.js): may ONLY read lots
-- and desks. Everything else is written by /api with the
-- service-role key, which bypasses RLS.
--
-- Staff (desk admins) sign in with Supabase Auth. Their role
-- lives in profiles. This powers admin today via Studio /
-- the Supabase client, and the future Next.js admin portal.
-- =========================================================

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'none' check (role in ('none','desk','admin')),
  created_at  timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('desk','admin'));
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin');
$$;

-- every new auth user gets a profile with NO access
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- only admins can grant roles
create or replace function public.protect_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'only an admin can change roles';
  end if;
  return new;
end $$;
create trigger trg_protect_role before update on public.profiles
  for each row execute function public.protect_role();

-- ---------- enable RLS everywhere ----------
alter table public.lots               enable row level security;
alter table public.desks              enable row level security;
alter table public.quote_requests     enable row level security;
alter table public.quote_request_lots enable row level security;
alter table public.lot_alerts         enable row level security;
alter table public.status_events      enable row level security;
alter table public.profiles           enable row level security;

-- ---------- public (contract from TRADE-DESK.md) ----------
create policy "anyone may read listed lots" on public.lots
  for select to anon, authenticated using (status <> 'draft' or public.is_staff());

create policy "anyone may read desks" on public.desks
  for select to anon, authenticated using (true);

-- quote_requests, quote_request_lots, lot_alerts: NO anon policy, on purpose.

-- ---------- staff ----------
create policy "staff manage lots" on public.lots
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "staff manage desks" on public.desks
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "staff read requests" on public.quote_requests
  for select to authenticated using (public.is_staff());
create policy "staff update requests" on public.quote_requests
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "staff read request lots" on public.quote_request_lots
  for select to authenticated using (public.is_staff());

create policy "staff read alerts" on public.lot_alerts
  for select to authenticated using (public.is_staff());
create policy "admin delete alerts" on public.lot_alerts
  for delete to authenticated using (public.is_admin());   -- unsubscribe / POPIA requests

create policy "staff read audit" on public.status_events
  for select to authenticated using (public.is_staff());

create policy "read own profile, admin reads all" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "admin manages profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- column guard: anon must never see these even if a policy slips ----------
revoke all on public.quote_requests, public.quote_request_lots,
              public.lot_alerts, public.status_events, public.profiles from anon;

-- ---------- staff work queue ----------
create or replace view public.desk_queue with (security_invoker = true) as
select r.id, r.reference, r.status, r.company, r.contact_name, r.email, r.phone,
       r.country, r.intended_use, r.message, r.desk_notes, r.created_at, r.updated_at,
       array_agg(q.lot_ref order by q.lot_ref) as lots
  from public.quote_requests r
  left join public.quote_request_lots q on q.quote_request_id = r.id
 group by r.id
 order by case r.status when 'submitted' then 0 when 'under_review' then 1
                        when 'more_information_required' then 2 else 3 end,
          r.created_at desc;

-- ---------- lot images bucket (staff upload, public read) ----------
insert into storage.buckets (id, name, public)
values ('lot-images', 'lot-images', true)
on conflict (id) do nothing;

create policy "lot-images public read" on storage.objects
  for select using (bucket_id = 'lot-images');
create policy "lot-images staff write" on storage.objects
  for insert to authenticated with check (bucket_id = 'lot-images' and public.is_staff());
create policy "lot-images staff update" on storage.objects
  for update to authenticated using (bucket_id = 'lot-images' and public.is_staff());
create policy "lot-images staff delete" on storage.objects
  for delete to authenticated using (bucket_id = 'lot-images' and public.is_staff());
