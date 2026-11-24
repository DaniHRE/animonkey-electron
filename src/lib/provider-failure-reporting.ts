export const PROVIDER_FAILURE_REPORTING_PREFERENCE_KEY =
  'privacy.provider-failure-reporting-v1';

export function isProviderFailureReportingPreference(
  value: unknown,
): value is boolean {
  return typeof value === 'boolean';
}
