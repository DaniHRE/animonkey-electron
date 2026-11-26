alter table public.provider_failure_reports
  drop constraint provider_failure_reports_provider_id_check;

alter table public.provider_failure_reports
  add constraint provider_failure_reports_provider_id_check
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
    'mkissa',
    'anipm',
    'anihq',
    'pahenime'
  ));

alter table public.anivexa_provider_health
  drop constraint anivexa_provider_health_provider_check;

delete from public.anivexa_provider_health
where provider in ('mkissa', 'senshi');

alter table public.anivexa_provider_health
  add constraint anivexa_provider_health_provider_check
  check (provider = any (array[
    'anihq',
    'reanime',
    'anikoto',
    'animegg',
    'animenosub',
    'anizone',
    'aniwaves',
    'pahenime',
    'kaa',
    'animedunya',
    'animeonsen',
    'anipm'
  ]));
