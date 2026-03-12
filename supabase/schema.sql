create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.pilots (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null unique,
  name text not null,
  country text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_official boolean not null,
  track_id integer,
  online_id text,
  laps integer not null check (laps in (1, 3)),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracks_mode_reference_check check (
    (is_official = true and track_id is not null and online_id is null)
    or
    (is_official = false and track_id is null and online_id is not null)
  )
);

create unique index if not exists tracks_official_reference_unique on public.tracks (track_id, laps);
create unique index if not exists tracks_unofficial_reference_unique on public.tracks (online_id, laps);
create index if not exists tracks_active_idx on public.tracks (active, laps);
create index if not exists pilots_active_idx on public.pilots (active);

create or replace trigger set_pilots_updated_at
before update on public.pilots
for each row
execute function public.set_current_timestamp_updated_at();

create or replace trigger set_tracks_updated_at
before update on public.tracks
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.pilots enable row level security;
alter table public.tracks enable row level security;

create policy if not exists "public read pilots" on public.pilots
for select using (true);

create policy if not exists "public read tracks" on public.tracks
for select using (true);
