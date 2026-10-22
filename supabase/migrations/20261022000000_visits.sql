-- Statistiques de visite : une ligne par session (ouverture de l'app), sans adresse IP.
-- L'identifiant de visiteur est un uuid aléatoire gardé sur l'appareil ; la localisation vient du
-- fuseau horaire du navigateur (« Europe/Paris »), pas d'un service de géolocalisation.

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  timezone text,
  language text,
  device text check (device in ('mobile', 'tablet', 'desktop')),
  os text,
  browser text,
  -- Ouverte comme appli installée (PWA) plutôt que dans un onglet
  standalone boolean not null default false,
  screen text
);
create index if not exists visits_created_at_idx on public.visits (created_at);

-- Les visiteurs peuvent seulement ajouter leur visite ; la lecture passe par visit_stats (agrégats)
alter table public.visits enable row level security;
create policy "Ajout public visits" on public.visits for insert to anon, authenticated with check (true);

create or replace function public.visit_stats(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with v as (
    select * from public.visits where created_at >= now() - make_interval(days => greatest(p_days, 1))
  ),
  top as (
    select dim, coalesce(value, 'Inconnu') as value, count(*) as sessions, count(distinct visitor_id) as visitors
    from v
    cross join lateral (values
      ('timezone', timezone),
      ('device', device),
      ('os', os),
      ('browser', browser),
      ('language', language),
      ('mode', case when standalone then 'Appli installée' else 'Navigateur' end)
    ) as d (dim, value)
    group by dim, coalesce(value, 'Inconnu')
  )
  select jsonb_build_object(
    'sessions', (select count(*) from v),
    'visitors', (select count(distinct visitor_id) from v),
    'new_visitors', (
      select count(*) from (
        select visitor_id from public.visits group by visitor_id
        having min(created_at) >= now() - make_interval(days => greatest(p_days, 1))
      ) n
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'sessions', sessions, 'visitors', visitors) order by day)
      from (
        select (created_at at time zone 'Europe/Paris')::date as day, count(*) as sessions,
          count(distinct visitor_id) as visitors
        from v group by 1
      ) d
    ), '[]'::jsonb),
    'breakdown', coalesce((
      select jsonb_object_agg(dim, rows)
      from (
        select dim, jsonb_agg(jsonb_build_object('value', value, 'sessions', sessions, 'visitors', visitors)
          order by visitors desc, sessions desc) as rows
        from top group by dim
      ) b
    ), '{}'::jsonb),
    'recent', coalesce((
      select jsonb_agg(r order by r.created_at desc)
      from (
        select created_at, timezone, device, os, browser, standalone
        from v order by created_at desc limit 20
      ) r
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.visit_stats(integer) to anon, authenticated;
