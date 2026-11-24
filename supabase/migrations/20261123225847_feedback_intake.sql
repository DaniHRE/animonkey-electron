create extension if not exists pg_cron with schema pg_catalog;

create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references next_auth.users (id) on delete cascade,
  feedback_type text not null
    check (feedback_type in ('suggestion', 'bug_report')),
  functional_area text not null
    check (functional_area in (
      'discovery',
      'catalog',
      'player',
      'library',
      'account',
      'notifications',
      'interface',
      'other'
    )),
  title text not null
    check (char_length(btrim(title)) between 1 and 120),
  description text not null
    check (char_length(btrim(description)) between 1 and 2000),
  consent_version text not null
    check (consent_version = 'feedback-v2'),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index feedback_submissions_user_created_idx
  on public.feedback_submissions (user_id, created_at desc);

create index feedback_submissions_created_idx
  on public.feedback_submissions (created_at);

alter table public.feedback_submissions enable row level security;
revoke all on table public.feedback_submissions
  from public, anon, authenticated, service_role;
grant select, insert on table public.feedback_submissions to service_role;

create or replace function public.desktop_submit_feedback(
  p_user_id uuid,
  p_type text,
  p_area text,
  p_title text,
  p_description text,
  p_consent_version text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_submission_id uuid;
  v_recent_submissions integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  select pg_catalog.count(*)::integer
    into v_recent_submissions
    from public.feedback_submissions
    where user_id = p_user_id
      and created_at >= pg_catalog.now() - interval '24 hours';

  if v_recent_submissions >= 3 then
    raise exception 'too_many_feedback_submissions'
      using errcode = 'P0001';
  end if;

  insert into public.feedback_submissions (
    user_id,
    feedback_type,
    functional_area,
    title,
    description,
    consent_version
  )
  values (
    p_user_id,
    p_type,
    p_area,
    p_title,
    p_description,
    p_consent_version
  )
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

revoke all on function public.desktop_submit_feedback(
  uuid, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.desktop_submit_feedback(
  uuid, text, text, text, text, text
) to service_role;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'desktop-feedback-retention',
  '17 3 * * *',
  'delete from public.feedback_submissions where created_at < now() - interval ''180 days'';'
);
