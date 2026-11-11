create unique index if not exists activity_feed_episode_completed_once_idx
  on public.activity_feed (user_id, anime_id, (payload ->> 'episode_number'))
  where type = 'episode_completed';

create or replace function private.emit_started_watching()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  share_activity boolean;
  was_completed boolean := false;
begin
  if tg_op = 'UPDATE' then
    was_completed := old.completed;
  end if;

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

  if new.completed and not was_completed then
    insert into public.activity_feed (user_id, type, anime_id, payload)
    values (
      new.user_id, 'episode_completed', new.anime_id,
      pg_catalog.jsonb_build_object('episode_number', new.episode_number)
    )
    on conflict (user_id, anime_id, (payload ->> 'episode_number'))
      where type = 'episode_completed'
    do nothing;
  end if;

  return new;
end;
$function$;
