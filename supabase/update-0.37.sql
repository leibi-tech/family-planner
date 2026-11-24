-- =====================================================================
-- Family-Planner – Datenbank-Update für Version 0.37 (Claude-Connector)
-- Einmalig im Supabase «SQL Editor» einfügen und «Run» klicken.
-- Darf mehrfach ausgeführt werden.
-- =====================================================================

-- Verbindungen zu Claude. Hier liegt der Anmelde-Schlüssel, mit dem Claude
-- im Namen eines Kontos auf myFam. zugreift. Darum: Sicherheitsregeln an und
-- KEINE Regel, die etwas erlaubt. Nur die Funktion «claude-connector»
-- (mit dem geheimen Server-Schlüssel) liest und schreibt diese Tabelle.
create table if not exists public.claude_connections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  household_id    uuid not null references public.households(id) on delete cascade,
  client_id       text not null,
  redirect_uri    text not null,
  sb_refresh      text not null,           -- Supabase-Anmeldung dieses Kontos (wird laufend erneuert)
  sb_access       text,
  sb_expires      bigint,                  -- ms seit 1970
  code_hash       text,                    -- einmaliger Code nach «Erlauben» (gültig 5 Minuten)
  code_challenge  text,
  code_expires    bigint,
  refresh_hash    text,                    -- Schlüssel, mit dem Claude sich neu anmeldet
  created_at      timestamptz not null default now(),
  last_used       timestamptz not null default now()
);
create index if not exists claude_connections_code_idx on public.claude_connections (code_hash);
create index if not exists claude_connections_refresh_idx on public.claude_connections (refresh_hash);
create index if not exists claude_connections_user_idx on public.claude_connections (user_id);

alter table public.claude_connections enable row level security;
revoke all on public.claude_connections from anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.claude_connections to service_role;

notify pgrst, 'reload schema';
