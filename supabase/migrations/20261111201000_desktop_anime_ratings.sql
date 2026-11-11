alter table public.desktop_sync_tombstones
  drop constraint if exists desktop_sync_tombstones_entity_check;

alter table public.desktop_sync_tombstones
  add constraint desktop_sync_tombstones_entity_check
  check (entity in ('watch-later', 'episode-progress', 'anime-rating'));
