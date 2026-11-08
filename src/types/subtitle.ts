export const SUBTITLE_SIZES = ['small', 'medium', 'large', 'xlarge'] as const;
export type SubtitleSize = (typeof SUBTITLE_SIZES)[number];

export const SUBTITLE_SCALE: Record<SubtitleSize, number> = {
  small: 0.75,
  medium: 1,
  large: 1.35,
  xlarge: 1.7,
};

export const SUBTITLE_LABEL: Record<SubtitleSize, string> = {
  small: 'Pequena',
  medium: 'Média',
  large: 'Grande',
  xlarge: 'Extra grande',
};
