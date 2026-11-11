create unique index if not exists activity_feed_started_watching_once_idx
  on public.activity_feed (user_id, anime_id)
  where type = 'started_watching';

create or replace function private.emit_started_watching()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  share_activity boolean;
begin
  select show_activity into share_activity
    from public.users where id = new.user_id;
  if not coalesce(share_activity, false) then return new; end if;

  insert into public.activity_feed (user_id, type, anime_id, payload)
  values (
    new.user_id, 'started_watching', new.anime_id,
    pg_catalog.jsonb_build_object('episode_number', new.episode_number)
  )
  on conflict (user_id, anime_id) where type = 'started_watching'
  do nothing;
  return new;
end;
$function$;

drop trigger if exists trg_emit_started_watching on public.episode_progress;
create trigger trg_emit_started_watching
after insert or update on public.episode_progress
for each row execute function private.emit_started_watching();
