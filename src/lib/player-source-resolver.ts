import { createMediaProxyUrl } from '@/lib/media-proxy';
import type { EpisodeSources } from '@/types/player';

export type PlaybackSourceFormat = 'hls' | 'dash' | 'mp4';
export type PlaybackSourceMimeType =
  'application/x-mpegurl' | 'application/dash+xml' | 'video/mp4';

export type PlaybackSourceResolution =
  | {
      kind: 'media';
      url: string;
      proxyUrl: string;
      directUrl: string;
      type: PlaybackSourceMimeType;
      format: PlaybackSourceFormat;
      embedUrl: string;
    }
  | { kind: 'embed'; url: string }
  | { kind: 'none'; url: '' };

interface Options {
  direct?: boolean;
  embed?: boolean;
}

function getAllowedEmbedUrl(value: string | undefined): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname === 'embed.settlar.io' ||
      url.hostname.endsWith('.embed.settlar.io')
    )
      return '';
    return url.href;
  } catch {
    return '';
  }
}

function getFormat(sources: EpisodeSources): PlaybackSourceFormat {
  if (
    sources.format === 'hls' ||
    /\.m3u8?(?:$|\?)/i.test(sources.sourceUrl ?? '')
  )
    return 'hls';
  if (
    sources.format === 'dash' ||
    /\.mpd(?:$|\?)/i.test(sources.sourceUrl ?? '')
  )
    return 'dash';
  return 'mp4';
}

function getMimeType(format: PlaybackSourceFormat): PlaybackSourceMimeType {
  if (format === 'hls') return 'application/x-mpegurl';
  if (format === 'dash') return 'application/dash+xml';
  return 'video/mp4';
}

export function resolvePlaybackSource(
  sources: EpisodeSources | null,
  options: Options = {},
): PlaybackSourceResolution {
  if (!sources) return { kind: 'none', url: '' };
  const embedUrl = getAllowedEmbedUrl(sources.embedUrl);
  if (options.embed && embedUrl) return { kind: 'embed', url: embedUrl };

  const directUrl = sources.sourceUrl ?? '';
  if (directUrl) {
    const format = getFormat(sources);
    const proxyUrl = createMediaProxyUrl(directUrl, sources);
    return {
      kind: 'media',
      url: options.direct ? directUrl : proxyUrl,
      proxyUrl,
      directUrl,
      format,
      type: getMimeType(format),
      embedUrl,
    };
  }
  if (embedUrl) return { kind: 'embed', url: embedUrl };
  return { kind: 'none', url: '' };
}
