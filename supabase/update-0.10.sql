-- =====================================================================
-- Family-Planner – Datenbank-Update für Version 0.10 (ToDos & Ämtli)
-- Einmalig im Supabase «SQL Editor» einfügen und «Run» klicken.
-- Darf mehrfach ausgeführt werden.
-- =====================================================================

-- 1) Private Einträge: owner_id = Konto, das den Eintrag sehen darf (leer = ganze Familie)
alter table public.records add column if not exists owner_id uuid;

-- 2) Sicherheitsregeln: private Einträge sieht und ändert nur ihr Besitzer.
--    Personen (Namen, Faktoren) darf weiterhin nur ein Admin ändern.
drop policy if exists records_select on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;

create policy records_select on public.records for select
  using (household_id in (select public.my_household_ids())
         and (owner_id is null or owner_id = auth.uid()));
create policy records_insert on public.records for insert
  with check (household_id in (select public.my_household_ids())
              and (owner_id is null or owner_id = auth.uid())
              and (store <> 'persons' or public.is_household_admin(household_id)));
create policy records_update on public.records for update
  using (household_id in (select public.my_household_ids())
         and (owner_id is null or owner_id = auth.uid())
         and (store <> 'persons' or public.is_household_admin(household_id)))
  with check (household_id in (select public.my_household_ids())
              and (owner_id is null or owner_id = auth.uid())
              and (store <> 'persons' or public.is_household_admin(household_id)));
create policy records_delete on public.records for delete
  using (household_id in (select public.my_household_ids())
         and (owner_id is null or owner_id = auth.uid())
         and (store <> 'persons' or public.is_household_admin(household_id)));

-- Schnittstelle sofort über die Änderung informieren
notify pgrst, 'reload schema';
