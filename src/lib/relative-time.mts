const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat('pt-BR', {
  numeric: 'auto',
  style: 'short',
});

export function formatRelativeTime(timestamp: number, now: number): string {
  const elapsedSeconds = (timestamp - now) / 1000;
  const distance = Math.abs(elapsedSeconds);
  if (distance < 60) return 'agora';

  const unit =
    distance < 60 * 60 ? 'minute' : distance < 24 * 60 * 60 ? 'hour' : 'day';
  const divisor =
    unit === 'minute' ? 60 : unit === 'hour' ? 60 * 60 : 24 * 60 * 60;
  const amount = Math.max(1, Math.floor(distance / divisor));
  return RELATIVE_TIME_FORMATTER.format(
    elapsedSeconds > 0 ? amount : -amount,
    unit,
  );
}
