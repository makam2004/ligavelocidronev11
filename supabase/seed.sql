insert into public.pilots (user_id, name, country, active)
values
  (1001, 'Pilot Example 1', 'ES', true),
  (1002, 'Pilot Example 2', 'PT', true)
on conflict (user_id) do update
set name = excluded.name,
    country = excluded.country,
    active = excluded.active;

insert into public.tracks (name, is_official, track_id, online_id, laps, active)
values
  ('Track oficial ejemplo 1 lap', true, 1234, null, 1, true),
  ('Track oficial ejemplo 3 laps', true, 1234, null, 3, true)
on conflict (track_id, laps) do update
set name = excluded.name,
    active = excluded.active;
