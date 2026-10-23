-- =====================================================================
-- Family-Planner – Datenbank-Update für Version 0.8 (Rollen & Personen)
-- Einmalig im Supabase «SQL Editor» einfügen und «Run» klicken.
-- Darf mehrfach ausgeführt werden.
-- =====================================================================

-- 1) Jedes Mitglied ist einer Person der Familie zugeordnet
alter table public.members add column if not exists person_id text;

-- 2) Ist das angemeldete Konto Admin dieses Haushalts?
create or replace function public.is_household_admin(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where household_id = h and user_id = auth.uid() and role in ('owner', 'admin')
  )
$$;

-- 3) Personen (Namen, Faktoren) darf nur ein Admin ändern; alles andere alle Mitglieder
drop policy if exists records_all on public.records;
drop policy if exists records_select on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;

create policy records_select on public.records for select
  using (household_id in (select public.my_household_ids()));
create policy records_insert on public.records for insert
  with check (household_id in (select public.my_household_ids())
              and (store <> 'persons' or public.is_household_admin(household_id)));
create policy records_update on public.records for update
  using (household_id in (select public.my_household_ids())
         and (store <> 'persons' or public.is_household_admin(household_id)))
  with check (household_id in (select public.my_household_ids())
              and (store <> 'persons' or public.is_household_admin(household_id)));
create policy records_delete on public.records for delete
  using (household_id in (select public.my_household_ids())
         and (store <> 'persons' or public.is_household_admin(household_id)));

-- 4) Einladungscode nur noch für Admins sichtbar
revoke select on public.households from authenticated;
grant select (id, name, created_at) on public.households to authenticated;

create or replace function public.get_invite_code(p_household uuid) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_household_admin(p_household) then raise exception 'Nur für Admins'; end if;
  return (select invite_code from public.households where id = p_household);
end $$;

create or replace function public.new_invite_code(p_household uuid) returns text
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not public.is_household_admin(p_household) then raise exception 'Nur für Admins'; end if;
  loop
    code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  update public.households set invite_code = code where id = p_household;
  return code;
end $$;

-- 5) Beitreten nur mit Code UND dem Vornamen einer erfassten, noch freien Person
drop function if exists public.join_household(text);
create or replace function public.join_household(p_code text, p_name text)
returns public.households
language plpgsql security definer set search_path = public as $$
declare
  h public.households;
  pid text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into h from public.households where invite_code = upper(trim(p_code));
  if h.id is null then raise exception 'Code oder Name falsch'; end if;
  select r.id into pid from public.records r
   where r.household_id = h.id and r.store = 'persons' and not r.deleted
     and lower(trim(r.data->>'name')) = lower(trim(p_name))
   limit 1;
  if pid is null then raise exception 'Code oder Name falsch'; end if;
  if exists (select 1 from public.members m
             where m.household_id = h.id and m.person_id = pid and m.user_id <> auth.uid()) then
    raise exception 'Code oder Name falsch';
  end if;
  insert into public.members (household_id, user_id, person_id) values (h.id, auth.uid(), pid)
    on conflict (household_id, user_id) do update set person_id = excluded.person_id;
  h.invite_code := null;
  return h;
end $$;

-- 6) Eigene Rolle und Person abfragen
create or replace function public.my_membership(p_household uuid)
returns table (role text, person_id text)
language sql stable security definer set search_path = public as $$
  select m.role, m.person_id from public.members m
  where m.household_id = p_household and m.user_id = auth.uid()
$$;

-- 7) «Wer bist du?» – sich selbst einer freien Person zuordnen
create or replace function public.claim_person(p_household uuid, p_person text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.members where household_id = p_household and user_id = auth.uid()) then
    raise exception 'Kein Mitglied';
  end if;
  if not exists (select 1 from public.records where household_id = p_household and store = 'persons'
                 and id = p_person and not deleted) then
    raise exception 'Person nicht gefunden';
  end if;
  if exists (select 1 from public.members where household_id = p_household and person_id = p_person
             and user_id <> auth.uid()) then
    raise exception 'Diese Person ist schon einem anderen Konto zugeordnet';
  end if;
  update public.members set person_id = p_person where household_id = p_household and user_id = auth.uid();
end $$;

-- 8) Mitglieder anzeigen (E-Mail nur für Admins)
create or replace function public.household_members(p_household uuid)
returns table (user_id uuid, role text, person_id text, email text, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare adm boolean := public.is_household_admin(p_household);
begin
  if not exists (select 1 from public.members where household_id = p_household and members.user_id = auth.uid()) then
    raise exception 'Kein Mitglied';
  end if;
  return query
    select m.user_id, m.role, m.person_id,
           case when adm then u.email::text else null end,
           m.joined_at
    from public.members m join auth.users u on u.id = m.user_id
    where m.household_id = p_household
    order by m.joined_at;
end $$;

-- 9) Admin-Funktionen: Rolle ändern, Person zuordnen, Mitglied entfernen
create or replace function public.set_member_role(p_household uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_household_admin(p_household) then raise exception 'Nur für Admins'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Ungültige Rolle'; end if;
  if exists (select 1 from public.members where household_id = p_household and user_id = p_user and role = 'owner') then
    raise exception 'Der Ersteller bleibt immer Admin';
  end if;
  update public.members set role = p_role where household_id = p_household and user_id = p_user;
end $$;

create or replace function public.assign_person(p_household uuid, p_user uuid, p_person text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_household_admin(p_household) then raise exception 'Nur für Admins'; end if;
  update public.members set person_id = null
   where household_id = p_household and person_id = p_person and user_id <> p_user;
  update public.members set person_id = p_person where household_id = p_household and user_id = p_user;
end $$;

create or replace function public.remove_member(p_household uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_household_admin(p_household) then raise exception 'Nur für Admins'; end if;
  if exists (select 1 from public.members where household_id = p_household and user_id = p_user and role = 'owner') then
    raise exception 'Der Ersteller kann nicht entfernt werden';
  end if;
  delete from public.members where household_id = p_household and user_id = p_user;
end $$;

grant execute on function public.is_household_admin(uuid) to authenticated;
grant execute on function public.get_invite_code(uuid) to authenticated;
grant execute on function public.new_invite_code(uuid) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
grant execute on function public.my_membership(uuid) to authenticated;
grant execute on function public.claim_person(uuid, text) to authenticated;
grant execute on function public.household_members(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.assign_person(uuid, uuid, text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
