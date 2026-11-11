create table public.desktop_sync_tombstones (
  user_id uuid not null references next_auth.users (id) on delete cascade,
  entity text not null check (entity in ('watch-later', 'episode-progress')),
  record_key text not null check (length(record_key) between 1 and 64),
  deleted_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, entity, record_key)
);

alter table public.desktop_sync_tombstones enable row level security;
revoke all on table public.desktop_sync_tombstones from public, anon, authenticated;
grant all on table public.desktop_sync_tombstones to service_role;

create or replace function public.desktop_upsert_sync_tombstone(
  p_user_id uuid,
  p_entity text,
  p_record_key text,
  p_deleted_at timestamptz
)
returns timestamptz
language sql
set search_path = ''
as $$
  insert into public.desktop_sync_tombstones as current_tombstone
    (user_id, entity, record_key, deleted_at)
  values (p_user_id, p_entity, p_record_key, p_deleted_at)
  on conflict (user_id, entity, record_key) do update
    set deleted_at = greatest(
      current_tombstone.deleted_at,
      excluded.deleted_at
    )
  returning deleted_at;
$$;

revoke all on function public.desktop_upsert_sync_tombstone(uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.desktop_upsert_sync_tombstone(uuid, text, text, timestamptz)
  to service_role;
