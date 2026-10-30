-- =====================================================================
-- Family-Planner – Datenbank-Update für Version 0.22 (private Dokumente)
-- Zuerst muss update-0.21.sql ausgeführt sein (Ablage «dokumente»).
-- Einmalig im Supabase «SQL Editor» einfügen und «Run» klicken.
-- Darf mehrfach ausgeführt werden.
-- =====================================================================

-- Private Dokumente liegen im Ordner «<haushalt-id>/privat/<konto-id>/…».
-- Diese Dateien darf nur das Konto sehen und ändern, dem der Ordner gehört.
-- Alle anderen Dateien des Haushalts bleiben für alle Mitglieder zugänglich.
drop policy if exists dokumente_select on storage.objects;
drop policy if exists dokumente_insert on storage.objects;
drop policy if exists dokumente_update on storage.objects;
drop policy if exists dokumente_delete on storage.objects;

create or replace function public.dokument_erlaubt(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select (storage.foldername(p_name))[1] in (select h::text from public.my_household_ids() h)
     and (coalesce((storage.foldername(p_name))[2], '') <> 'privat'
          or (storage.foldername(p_name))[3] = auth.uid()::text)
$$;
grant execute on function public.dokument_erlaubt(text) to authenticated;

create policy dokumente_select on storage.objects for select to authenticated
  using (bucket_id = 'dokumente' and public.dokument_erlaubt(name));
create policy dokumente_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dokumente' and public.dokument_erlaubt(name));
create policy dokumente_update on storage.objects for update to authenticated
  using (bucket_id = 'dokumente' and public.dokument_erlaubt(name))
  with check (bucket_id = 'dokumente' and public.dokument_erlaubt(name));
create policy dokumente_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dokumente' and public.dokument_erlaubt(name));

notify pgrst, 'reload schema';
