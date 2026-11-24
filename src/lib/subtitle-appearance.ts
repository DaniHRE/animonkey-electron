export const SUBTITLE_SIZE_PREFERENCE_KEY = 'player.subtitle-size';
export const DEFAULT_SUBTITLE_SIZE = 'medium';
export const SUBTITLE_SIZE_VALUES = [
  'small',
  'medium',
  'large',
  'xlarge',
] as const;

export type SubtitleSize = (typeof SUBTITLE_SIZE_VALUES)[number];

export function isSubtitleSize(value: unknown): value is SubtitleSize {
  return (
    typeof value === 'string' &&
    SUBTITLE_SIZE_VALUES.includes(value as SubtitleSize)
  );
}

export function normalizeSubtitleSize(value: unknown): SubtitleSize {
  return isSubtitleSize(value) ? value : DEFAULT_SUBTITLE_SIZE;
}
