import type { EpisodeSubtitle } from '@/types/player';

export type SupportedSubtitleLanguage = 'pt-BR' | 'en';

export function normalizeSubtitleLanguage(
  language: string,
): SupportedSubtitleLanguage | null {
  const normalized = language
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replaceAll('_', '-');
  if (
    /^(pt|por)(?:-[a-z0-9]+)*$/.test(normalized) ||
    /^(pt|por)br$/.test(normalized) ||
    /\b(?:portugues|portuguese|brazilian|brazil)\b/.test(normalized)
  )
    return 'pt-BR';
  if (
    /^(en|eng)(?:-[a-z0-9]+)*$/.test(normalized) ||
    /\benglish\b/.test(normalized)
  )
    return 'en';
  return null;
}

export function getSubtitleLabel(language: string): string {
  const normalized = normalizeSubtitleLanguage(language);
  if (normalized === 'pt-BR') return 'Português (Brasil)';
  if (normalized === 'en') return 'English';
  return language.trim();
}

export function getSubtitleFormat(url: string): 'ass' | 'ssa' | null {
  try {
    const extension = new URL(url, 'https://subtitle.invalid').pathname
      .split('.')
      .pop()
      ?.toLowerCase();
    return extension === 'ass' || extension === 'ssa' ? extension : null;
  } catch {
    return null;
  }
}

export function filterSubtitles(
  subtitles: EpisodeSubtitle[],
): EpisodeSubtitle[] {
  const seen = new Set<SupportedSubtitleLanguage>();
  return subtitles.filter((subtitle) => {
    if (subtitle.kind !== 'captions' || !subtitle.lang) return false;
    const language = normalizeSubtitleLanguage(subtitle.lang);
    if (!language || seen.has(language)) return false;
    seen.add(language);
    return true;
  });
}
