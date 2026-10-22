-- =====================================================================
-- Family-Planner – Datenbank in Supabase (Phase 2)
-- Einmalig im Supabase «SQL Editor» einfügen und auf «Run» klicken.
-- Darf auch mehrfach ausgeführt werden (ändert dann nichts Bestehendes).
-- =====================================================================

-- 1) Haushalte: eine Familie = ein Haushalt
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Familie',
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

-- 2) Mitglieder: welches Konto gehört zu welchem Haushalt
create table if not exists public.members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- 3) Alle App-Daten (Personen, Menüs, Plan-Tage, Einkauf …) in einer Tabelle.
--    store = Art des Eintrags (z.B. 'menus'), id = ID aus der App, data = Inhalt.
create table if not exists public.records (
  household_id      uuid   not null references public.households(id) on delete cascade,
  store             text   not null,
  id                text   not null,
  data              jsonb  not null,
  updated_at        bigint not null,              -- Änderungszeit aus der App (ms)
  deleted           boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (household_id, store, id)
);
create index if not exists records_pull_idx on public.records (household_id, server_updated_at);

-- Neuere Änderung gewinnt; Server-Zeit für den Abgleich setzen
create or replace function public.records_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;  -- ältere Änderung ignorieren
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_before_write on public.records;
create trigger records_before_write before insert or update on public.records
  for each row execute function public.records_before_write();

-- 4) Hilfsfunktion: Haushalte des angemeldeten Kontos
create or replace function public.my_household_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.members where user_id = auth.uid()
$$;

-- 5) Sicherheitsregeln: jede Familie sieht nur ihre eigenen Daten
alter table public.households enable row level security;
alter table public.members    enable row level security;
alter table public.records    enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households for select
  using (id in (select public.my_household_ids()));

drop policy if exists households_update on public.households;
create policy households_update on public.households for update
  using (id in (select public.my_household_ids()));

drop policy if exists members_select on public.members;
create policy members_select on public.members for select
  using (household_id in (select public.my_household_ids()));

drop policy if exists members_delete_self on public.members;
create policy members_delete_self on public.members for delete
  using (user_id = auth.uid());

drop policy if exists records_all on public.records;
create policy records_all on public.records for all
  using (household_id in (select public.my_household_ids()))
  with check (household_id in (select public.my_household_ids()));

-- 6) Haushalt erstellen (der Ersteller wird automatisch Mitglied)
create or replace function public.create_household(p_name text default 'Familie')
returns public.households
language plpgsql security definer set search_path = public as $$
declare
  h public.households;
  code text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  loop
    code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  insert into public.households (name, invite_code) values (coalesce(nullif(trim(p_name), ''), 'Familie'), code)
    returning * into h;
  insert into public.members (household_id, user_id, role) values (h.id, auth.uid(), 'owner');
  return h;
end $$;

-- 7) Mit Einladungscode einem Haushalt beitreten
create or replace function public.join_household(p_code text)
returns public.households
language plpgsql security definer set search_path = public as $$
declare
  h public.households;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into h from public.households where invite_code = upper(trim(p_code));
  if h.id is null then raise exception 'Code ungültig'; end if;
  insert into public.members (household_id, user_id) values (h.id, auth.uid())
    on conflict do nothing;
  return h;
end $$;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text)  to authenticated;
grant select, update on public.households to authenticated;
grant select, delete on public.members to authenticated;
grant select, insert, update, delete on public.records to authenticated;
