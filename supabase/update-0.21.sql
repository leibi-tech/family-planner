-- =====================================================================
-- Family-Planner – Datenbank-Update für Version 0.21 (Dokumente)
-- Einmalig im Supabase «SQL Editor» einfügen und «Run» klicken.
-- Darf mehrfach ausgeführt werden.
-- =====================================================================

-- 1) Ablage «dokumente» für gescannte PDFs und Fotos (nicht öffentlich, höchstens 20 MB pro Datei)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dokumente', 'dokumente', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) Sicherheitsregeln: Jede Datei liegt im Ordner ihres Haushalts («<haushalt-id>/<dokument>.pdf»).
--    Nur Mitglieder dieses Haushalts dürfen sie sehen, hochladen, ersetzen und löschen.
drop policy if exists dokumente_select on storage.objects;
drop policy if exists dokumente_insert on storage.objects;
drop policy if exists dokumente_update on storage.objects;
drop policy if exists dokumente_delete on storage.objects;

create policy dokumente_select on storage.objects for select to authenticated
  using (bucket_id = 'dokumente'
         and (storage.foldername(name))[1] in (select h::text from public.my_household_ids() h));
create policy dokumente_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dokumente'
              and (storage.foldername(name))[1] in (select h::text from public.my_household_ids() h));
create policy dokumente_update on storage.objects for update to authenticated
  using (bucket_id = 'dokumente'
         and (storage.foldername(name))[1] in (select h::text from public.my_household_ids() h))
  with check (bucket_id = 'dokumente'
              and (storage.foldername(name))[1] in (select h::text from public.my_household_ids() h));
create policy dokumente_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dokumente'
         and (storage.foldername(name))[1] in (select h::text from public.my_household_ids() h));

notify pgrst, 'reload schema';
