create table public.anivexa_provider_health (
  provider text primary key
    check (provider = any (array[
      'mkissa',
      'reanime',
      'anikoto',
      'animegg',
      'animenosub',
      'anizone',
      'aniwaves',
      'senshi',
      'kaa',
      'animedunya',
      'animeonsen',
      'anipm'
    ])),
  status text not null
    check (status in ('healthy', 'degraded', 'unavailable', 'indeterminate')),
  sample_count smallint not null check (sample_count > 0),
  successful_sample_count smallint not null check (successful_sample_count >= 0),
  technical_failure_count smallint not null check (technical_failure_count >= 0),
  no_match_count smallint not null check (no_match_count >= 0),
  episodes_returned integer not null check (episodes_returned >= 0),
  average_response_time_ms integer not null check (average_response_time_ms >= 0),
  summary text not null check (char_length(summary) between 1 and 180),
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anivexa_provider_health_sample_counts_check
    check (
      successful_sample_count + technical_failure_count + no_match_count = sample_count
    )
);

create index anivexa_provider_health_status_checked_idx
  on public.anivexa_provider_health (status, checked_at desc);

alter table public.anivexa_provider_health enable row level security;
revoke all on table public.anivexa_provider_health
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.anivexa_provider_health to service_role;

comment on table public.anivexa_provider_health is
  'Latest sanitized scheduled health snapshot for each embedded Anivexa provider. Updated by the trusted GitHub Actions monitor.';
comment on column public.anivexa_provider_health.provider is
  'Allow-listed provider slug from the pinned Anivexa runtime.';
comment on column public.anivexa_provider_health.status is
  'healthy means at least one sample returned episodes without technical failures; degraded means success and technical failure were both observed; unavailable means all matched samples failed technically; indeterminate means no sample could establish provider availability.';
comment on column public.anivexa_provider_health.summary is
  'Short generated summary with counts only. Must not contain titles, sample IDs, URLs, or raw provider errors.';
