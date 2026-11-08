import type { EpisodeSources } from '@/types/player';

export function createMediaProxyUrl(
  target: string,
  sources: EpisodeSources,
): string {
  const proxy = new URL('animonkey-media://proxy/');
  proxy.searchParams.set('url', target);
  const referer = sources.headers.Referer ?? sources.headers.referer;
  const authorization =
    sources.headers.Authorization ?? sources.headers.authorization;
  if (referer) proxy.searchParams.set('referer', referer);
  if (sources.playlistKey && /\.m3u8?(?:$|\?)/i.test(target)) {
    proxy.searchParams.set('playlistKey', sources.playlistKey);
  }
  if (authorization) proxy.searchParams.set('authorization', authorization);
  return proxy.href;
}
