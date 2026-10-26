-- =====================================================================
-- Family-Planner – Datenbank-Update für Version 0.14 (Kalender mit Google)
-- Einmalig im Supabase «SQL Editor» einfügen und «Run» klicken.
-- Darf mehrfach ausgeführt werden.
-- =====================================================================

-- Verbundene Google-Konten. Hier liegt der Zugangsschlüssel zu Google (refresh_token).
-- Darum: Sicherheitsregeln eingeschaltet und KEINE Regel, die etwas erlaubt.
-- Die App selbst kann diese Tabelle nie lesen; nur die Funktion «google-kalender»
-- (mit dem geheimen Server-Schlüssel) greift darauf zu.
create table if not exists public.google_accounts (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  household_id   uuid not null references public.households(id) on delete cascade,
  google_email   text,
  refresh_token  text not null,
  access_token   text,
  access_expires bigint,                       -- ms seit 1970
  calendars      jsonb not null default '[]',  -- ausgewählte Kalender: [{id, name, kind: 'own'|'family'}]
  updated_at     timestamptz not null default now()
);
create index if not exists google_accounts_household_idx on public.google_accounts (household_id);

alter table public.google_accounts enable row level security;
revoke all on public.google_accounts from anon, authenticated;

notify pgrst, 'reload schema';
