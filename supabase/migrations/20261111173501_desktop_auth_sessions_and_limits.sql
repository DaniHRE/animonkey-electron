create table public.desktop_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references next_auth.users (id) on delete cascade,
  device_id uuid not null,
  device_name text not null default 'Animonkey Desktop',
  family_id uuid not null,
  access_token_hash text not null unique check (access_token_hash ~ '^[0-9a-f]{64}$'),
  access_expires_at timestamptz not null,
  refresh_token_hash text not null unique check (refresh_token_hash ~ '^[0-9a-f]{64}$'),
  refresh_expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(device_name) between 1 and 80)
);

create index desktop_sessions_user_idx on public.desktop_sessions (user_id);
create index desktop_sessions_family_idx on public.desktop_sessions (family_id);
alter table public.desktop_sessions enable row level security;
revoke all on table public.desktop_sessions from public, anon, authenticated;
grant all on table public.desktop_sessions to service_role;

create table public.desktop_used_refresh_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  family_id uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index desktop_used_refresh_tokens_expiry_idx
  on public.desktop_used_refresh_tokens (expires_at);
alter table public.desktop_used_refresh_tokens enable row level security;
revoke all on table public.desktop_used_refresh_tokens from public, anon, authenticated;
grant all on table public.desktop_used_refresh_tokens to service_role;

create table public.desktop_login_attempts (
  lookup_hash text primary key check (lookup_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null check (attempts > 0),
  updated_at timestamptz not null default now()
);

create index desktop_login_attempts_updated_idx
  on public.desktop_login_attempts (updated_at);
alter table public.desktop_login_attempts enable row level security;
revoke all on table public.desktop_login_attempts from public, anon, authenticated;
grant all on table public.desktop_login_attempts to service_role;

grant usage on schema next_auth to service_role;
grant select, insert on table next_auth.users to service_role;

create or replace function public.desktop_consume_login_attempt(p_lookup_hash text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  insert into public.desktop_login_attempts (lookup_hash, window_started_at, attempts)
  values (p_lookup_hash, pg_catalog.now(), 1)
  on conflict (lookup_hash) do update
    set window_started_at = case
          when public.desktop_login_attempts.window_started_at < pg_catalog.now() - interval '15 minutes'
            then pg_catalog.now()
          else public.desktop_login_attempts.window_started_at
        end,
        attempts = case
          when public.desktop_login_attempts.window_started_at < pg_catalog.now() - interval '15 minutes'
            then 1
          else public.desktop_login_attempts.attempts + 1
        end,
        updated_at = pg_catalog.now()
  returning attempts into v_attempts;

  return v_attempts <= 8;
end;
$$;

revoke all on function public.desktop_consume_login_attempt(text) from public, anon, authenticated;
grant execute on function public.desktop_consume_login_attempt(text) to service_role;

create or replace function public.desktop_clear_login_attempt(p_lookup_hash text)
returns void
language sql
set search_path = ''
as $$
  delete from public.desktop_login_attempts
  where lookup_hash = p_lookup_hash;
$$;

revoke all on function public.desktop_clear_login_attempt(text) from public, anon, authenticated;
grant execute on function public.desktop_clear_login_attempt(text) to service_role;

create or replace function public.desktop_register_user(p_email text, p_name text, p_password_hash text)
returns table (id uuid, email text, name text, image text)
language plpgsql
set search_path = ''
as $$
begin
  return query
    insert into next_auth.users as account_user (email, name, password_hash)
    values (p_email, p_name, p_password_hash)
    returning account_user.id, account_user.email, account_user.name, account_user.image;
end;
$$;

create or replace function public.desktop_get_user_by_email(p_email text)
returns table (id uuid, email text, name text, image text, password_hash text)
language sql
stable
set search_path = ''
as $$
  select account_user.id, account_user.email, account_user.name,
         account_user.image, account_user.password_hash
  from next_auth.users as account_user
  where account_user.email = p_email
  limit 1;
$$;

create or replace function public.desktop_get_user_by_id(p_user_id uuid)
returns table (id uuid, email text, name text, image text)
language sql
stable
set search_path = ''
as $$
  select account_user.id, account_user.email, account_user.name, account_user.image
  from next_auth.users as account_user
  where account_user.id = p_user_id
  limit 1;
$$;

revoke all on function public.desktop_register_user(text, text, text) from public, anon, authenticated;
revoke all on function public.desktop_get_user_by_email(text) from public, anon, authenticated;
revoke all on function public.desktop_get_user_by_id(uuid) from public, anon, authenticated;
grant execute on function public.desktop_register_user(text, text, text) to service_role;
grant execute on function public.desktop_get_user_by_email(text) to service_role;
grant execute on function public.desktop_get_user_by_id(uuid) to service_role;

create or replace function public.desktop_rotate_session_tokens(
  p_refresh_token_hash text,
  p_new_access_token_hash text,
  p_new_access_expires_at timestamptz,
  p_new_refresh_token_hash text,
  p_new_refresh_expires_at timestamptz
)
returns table (session_id uuid, user_id uuid, device_id uuid, device_name text, token_status text)
language plpgsql
set search_path = ''
as $$
declare
  v_session public.desktop_sessions%rowtype;
  v_family_id uuid;
begin
  delete from public.desktop_used_refresh_tokens
  where expires_at <= pg_catalog.now();

  select * into v_session
  from public.desktop_sessions
  where refresh_token_hash = p_refresh_token_hash
  for update;

  if found then
    if v_session.revoked_at is not null or v_session.refresh_expires_at <= pg_catalog.now() then
      return query select null::uuid, null::uuid, null::uuid, null::text, 'invalid'::text;
      return;
    end if;

    insert into public.desktop_used_refresh_tokens (token_hash, family_id, expires_at)
    values (v_session.refresh_token_hash, v_session.family_id, v_session.refresh_expires_at)
    on conflict (token_hash) do nothing;

    update public.desktop_sessions
    set access_token_hash = p_new_access_token_hash,
        access_expires_at = p_new_access_expires_at,
        refresh_token_hash = p_new_refresh_token_hash,
        refresh_expires_at = p_new_refresh_expires_at,
        updated_at = pg_catalog.now()
    where id = v_session.id;

    return query select v_session.id, v_session.user_id, v_session.device_id,
                        v_session.device_name, 'rotated'::text;
    return;
  end if;

  select family_id into v_family_id
  from public.desktop_used_refresh_tokens
  where token_hash = p_refresh_token_hash
    and expires_at > pg_catalog.now();

  if found then
    update public.desktop_sessions
    set revoked_at = coalesce(revoked_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    where family_id = v_family_id;

    return query select null::uuid, null::uuid, null::uuid, null::text, 'replayed'::text;
    return;
  end if;

  return query select null::uuid, null::uuid, null::uuid, null::text, 'invalid'::text;
end;
$$;

revoke all on function public.desktop_rotate_session_tokens(text, text, timestamptz, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.desktop_rotate_session_tokens(text, text, timestamptz, text, timestamptz)
  to service_role;

create or replace function public.desktop_revoke_session(p_refresh_token_hash text, p_access_token_hash text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_session_id uuid;
begin
  if p_refresh_token_hash is not null then
    select family_id into v_family_id
    from public.desktop_sessions
    where refresh_token_hash = p_refresh_token_hash;

    if not found then
      select family_id into v_family_id
      from public.desktop_used_refresh_tokens
      where token_hash = p_refresh_token_hash;
    end if;

    if found then
      update public.desktop_sessions
      set revoked_at = coalesce(revoked_at, pg_catalog.now()),
          updated_at = pg_catalog.now()
      where family_id = v_family_id;
      return true;
    end if;
  end if;

  if p_access_token_hash is not null then
    update public.desktop_sessions
    set revoked_at = coalesce(revoked_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    where access_token_hash = p_access_token_hash
      and revoked_at is null
    returning id into v_session_id;
    return found;
  end if;

  return false;
end;
$$;

revoke all on function public.desktop_revoke_session(text, text) from public, anon, authenticated;
grant execute on function public.desktop_revoke_session(text, text) to service_role;

create or replace function public.desktop_revoke_device_sessions(p_device_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.desktop_sessions
  set revoked_at = coalesce(revoked_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  where device_id = p_device_id
    and revoked_at is null;
$$;

revoke all on function public.desktop_revoke_device_sessions(uuid) from public, anon, authenticated;
grant execute on function public.desktop_revoke_device_sessions(uuid) to service_role;
