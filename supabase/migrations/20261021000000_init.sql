-- Schéma initial de Réplique : pièces, personnages, actes, scènes, répliques, réglages.
-- Pas de comptes : le texte est partagé par tous, le rôle et la progression sont gardés sur chaque appareil.

create table if not exists public.plays (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  source_url text,
  status text not null default 'draft' check (status in ('draft', 'ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null references public.plays (id) on delete cascade,
  name text not null,
  -- Description trouvée dans la distribution du texte source (« père de Cléante… »)
  description text,
  -- Personnalité libre, utilisée comme consigne de jeu pour la voix IA
  personality text,
  gender text not null default 'neutral' check (gender in ('male', 'female', 'neutral')),
  tone text not null default 'neutre',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists characters_play_id_idx on public.characters (play_id);

create table if not exists public.acts (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null references public.plays (id) on delete cascade,
  number integer not null,
  title text,
  position integer not null default 0
);
create index if not exists acts_play_id_idx on public.acts (play_id);

create table if not exists public.scenes (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null references public.plays (id) on delete cascade,
  act_id uuid not null references public.acts (id) on delete cascade,
  number integer not null,
  title text,
  position integer not null default 0
);
create index if not exists scenes_act_id_idx on public.scenes (act_id);
create index if not exists scenes_play_id_idx on public.scenes (play_id);

create table if not exists public.lines (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null references public.plays (id) on delete cascade,
  scene_id uuid not null references public.scenes (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  -- Flottant pour pouvoir insérer une réplique entre deux autres sans renuméroter
  position double precision not null,
  text text not null,
  updated_at timestamptz not null default now()
);
create index if not exists lines_scene_id_idx on public.lines (scene_id, position);
create index if not exists lines_character_id_idx on public.lines (character_id);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value)
values ('tts', '{"provider": "browser", "openaiModel": "gpt-4o-mini-tts"}')
on conflict (key) do nothing;

-- Accès public (clé anon) : application partagée par une troupe, sans connexion
alter table public.plays enable row level security;
alter table public.characters enable row level security;
alter table public.acts enable row level security;
alter table public.scenes enable row level security;
alter table public.lines enable row level security;
alter table public.app_settings enable row level security;

create policy "Accès public plays" on public.plays for all to anon, authenticated using (true) with check (true);
create policy "Accès public characters" on public.characters for all to anon, authenticated using (true) with check (true);
create policy "Accès public acts" on public.acts for all to anon, authenticated using (true) with check (true);
create policy "Accès public scenes" on public.scenes for all to anon, authenticated using (true) with check (true);
create policy "Accès public lines" on public.lines for all to anon, authenticated using (true) with check (true);
create policy "Accès public app_settings" on public.app_settings for all to anon, authenticated using (true) with check (true);

-- Import atomique d'une pièce analysée côté client (identifiants générés par le client)
create or replace function public.import_play(payload jsonb)
returns uuid
language plpgsql
as $$
declare
  v_play uuid := (payload ->> 'id')::uuid;
begin
  insert into public.plays (id, title, author, source_url)
  values (v_play, payload ->> 'title', nullif(payload ->> 'author', ''), payload ->> 'source_url');

  insert into public.characters (id, play_id, name, description, gender, position)
  select c.id, v_play, c.name, c.description, coalesce(c.gender, 'neutral'), c.position
  from jsonb_to_recordset(payload -> 'characters')
    as c (id uuid, name text, description text, gender text, position integer);

  insert into public.acts (id, play_id, number, title, position)
  select a.id, v_play, a.number, a.title, a.position
  from jsonb_to_recordset(payload -> 'acts')
    as a (id uuid, number integer, title text, position integer);

  insert into public.scenes (id, play_id, act_id, number, title, position)
  select s.id, v_play, s.act_id, s.number, s.title, s.position
  from jsonb_to_recordset(payload -> 'scenes')
    as s (id uuid, act_id uuid, number integer, title text, position integer);

  insert into public.lines (play_id, scene_id, character_id, position, text)
  select v_play, l.scene_id, l.character_id, l.position, l.text
  from jsonb_to_recordset(payload -> 'lines')
    as l (scene_id uuid, character_id uuid, position double precision, text text);

  return v_play;
end;
$$;

-- Doublon : les répliques du personnage source sont rattachées au personnage cible
create or replace function public.merge_character(p_source uuid, p_target uuid)
returns void
language plpgsql
as $$
begin
  if p_source = p_target then
    return;
  end if;
  update public.lines set character_id = p_target, updated_at = now() where character_id = p_source;
  delete from public.characters where id = p_source;
end;
$$;

grant execute on function public.import_play(jsonb) to anon, authenticated;
grant execute on function public.merge_character(uuid, uuid) to anon, authenticated;
