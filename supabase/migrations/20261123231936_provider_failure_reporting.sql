create extension if not exists pg_cron with schema pg_catalog;

create table public.provider_failure_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references next_auth.users (id) on delete cascade,
  provider_id text not null
    check (provider_id in (
      'reanime',
      'anikoto',
      'animegg',
      'anineko',
      'anibdapp',
      '2dhive',
      'anibd',
      'aniwaves',
      'senshi',
      'anizone',
      'animeonsen',
      'animedunya',
      'kaa',
      'animenosub',
      'mkissa'
    )),
  http_status smallint not null
    check (http_status in (502, 503, 504)),
  consent_version text not null
    check (consent_version = 'provider-failure-v1'),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index provider_failure_reports_user_created_idx
  on public.provider_failure_reports (user_id, created_at desc);

create index provider_failure_reports_user_provider_created_idx
  on public.provider_failure_reports (user_id, provider_id, created_at desc);

create index provider_failure_reports_created_idx
  on public.provider_failure_reports (created_at);

alter table public.provider_failure_reports enable row level security;
revoke all on table public.provider_failure_reports
  from public, anon, authenticated, service_role;
grant select, insert on table public.provider_failure_reports to service_role;

create or replace function public.desktop_report_provider_failure(
  p_user_id uuid,
  p_provider_id text,
  p_http_status smallint,
  p_consent_version text
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_recent_reports integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  if exists (
    select 1
    from public.provider_failure_reports
    where user_id = p_user_id
      and provider_id = p_provider_id
      and created_at >= pg_catalog.now() - interval '1 hour'
  ) then
    return false;
  end if;

  select pg_catalog.count(*)::integer
    into v_recent_reports
    from public.provider_failure_reports
    where user_id = p_user_id
      and created_at >= pg_catalog.now() - interval '24 hours';

  if v_recent_reports >= 10 then
    raise exception 'too_many_provider_reports'
      using errcode = 'P0001';
  end if;

  insert into public.provider_failure_reports (
    user_id,
    provider_id,
    http_status,
    consent_version
  )
  values (
    p_user_id,
    p_provider_id,
    p_http_status,
    p_consent_version
  );

  return true;
end;
$$;

revoke all on function public.desktop_report_provider_failure(
  uuid, text, smallint, text
) from public, anon, authenticated;
grant execute on function public.desktop_report_provider_failure(
  uuid, text, smallint, text
) to service_role;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'desktop-provider-failure-retention',
  '37 3 * * *',
  'delete from public.provider_failure_reports where created_at < now() - interval ''30 days'';'
);
