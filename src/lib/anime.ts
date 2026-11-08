import type { AnimeResult, AnimeTitle } from '@/types/anime';

export function resolveAnimeTitle(
  title: AnimeTitle | undefined,
  language: 'en' | 'jp' = 'en',
): string {
  if (!title) return 'Título indisponível';
  return language === 'jp'
    ? (title.romaji ?? title.native ?? title.english ?? 'Título indisponível')
    : (title.english ?? title.romaji ?? title.native ?? 'Título indisponível');
}

export function getAnimeImage(anime: AnimeResult): string | undefined {
  const image = anime.image ?? anime.banner;
  if (!image) return undefined;
  return image.startsWith('//')
    ? `https:${image}`
    : image.replace(/^http:/, 'https:');
}

export function stripHtml(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
