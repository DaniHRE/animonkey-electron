import { getSubtitleFormat, normalizeSubtitleLanguage } from '@/lib/subtitle';
import { AniListCatalog } from '@/services/anilist.service';
import type {
  AnimeEpisode,
  EpisodeServer,
  EpisodeSources,
  EpisodeSubtitle,
  EpisodeTimestamp,
} from '@/types/player';

const API_BASE = (
  import.meta.env.VITE_ANIVEXA_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:4000' : '')
).replace(/\/$/, '');
const PROVIDER_PRIORITY = [
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
];

interface ProviderEpisode {
  id?: string;
  number?: number | string;
  title?: string;
  description?: string;
  image?: string;
}
interface ProviderEntry {
  error?: string;
  episodes?: { sub?: ProviderEpisode[]; dub?: ProviderEpisode[] };
}
type EpisodeIndex = Record<string, ProviderEntry>;
interface StreamPayload {
  streams?: Array<{
    url?: string;
    type?: string;
    server?: string;
    isActive?: boolean;
    key?: string;
    playlist_key?: string;
    embed?: string;
    referer?: string;
    headers?: Record<string, string>;
    subtitles?: Array<Record<string, unknown>>;
    thumbnails_vtt?: string | null;
    intro?: unknown;
    outro?: unknown;
  }>;
  subtitles?: Array<Record<string, unknown>>;
  headers?: Record<string, string>;
  intro?: unknown;
  outro?: unknown;
}

function requireBase(): string {
  if (!API_BASE)
    throw new Error('Configure VITE_ANIVEXA_API_URL para habilitar episódios.');
  return API_BASE;
}

function inferRefererFromEmbed(
  embedUrl: string | undefined,
): string | undefined {
  if (!embedUrl) return undefined;
  try {
    const embed = new URL(embedUrl);
    if (
      embed.protocol === 'https:' &&
      (embed.hostname === 'flixcloud.cc' ||
        embed.hostname.endsWith('.flixcloud.cc'))
    )
      return 'https://flixcloud.cc/';
  } catch {
    // Invalid embed URLs are ignored; the player validates the URL separately.
  }
  return undefined;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${requireBase()}${path}`, {
      headers: { Accept: 'application/json' },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(25000)])
        : AbortSignal.timeout(25000),
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    if (cause instanceof DOMException && cause.name === 'TimeoutError')
      throw new Error(
        'A busca por episódios demorou demais. Tente novamente.',
        {
          cause,
        },
      );
    throw new Error(
      'Não foi possível conectar aos servidores de episódios. Verifique sua conexão e tente novamente.',
      { cause },
    );
  }

  if (!response.ok) {
    if (response.status === 404)
      throw new Error('Este episódio não está disponível no momento.');
    if (response.status >= 500)
      throw new Error(
        'O serviço de episódios está temporariamente indisponível. Tente novamente em instantes.',
      );
    throw new Error(
      'Não foi possível carregar este episódio. Tente outro servidor.',
    );
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new Error(
      'O serviço de episódios retornou uma resposta inválida. Tente novamente em instantes.',
      { cause },
    );
  }
}

function orderedProviders(index: EpisodeIndex): string[] {
  return [
    ...PROVIDER_PRIORITY.filter((provider) => provider in index),
    ...Object.keys(index).filter(
      (provider) => !PROVIDER_PRIORITY.includes(provider),
    ),
  ];
}

function parseEpisodeId(episodeId: string): {
  animeId: string;
  audio: 'sub' | 'dub';
  number: number;
} {
  const match = episodeId.match(/^(\d+):(sub|dub):(\d+)$/);
  if (!match) throw new Error('Identificador do episódio inválido.');
  return {
    animeId: match[1],
    audio: match[2] as 'sub' | 'dub',
    number: Number(match[3]),
  };
}

function matchingEpisodes(
  index: EpisodeIndex,
  audio: 'sub' | 'dub',
  number: number,
) {
  return orderedProviders(index).flatMap((provider) => {
    const episode = index[provider]?.episodes?.[audio]?.find(
      (item) => Number(item.number) === number,
    );
    return episode ? [{ provider, episode }] : [];
  });
}

function watchPath(
  provider: string,
  animeId: string,
  audio: 'sub' | 'dub',
  episode: ProviderEpisode,
  number: number,
): string {
  const suffix = episode.id?.split('/').pop();
  const providerEpisode = suffix?.startsWith(`${provider}-`)
    ? suffix.slice(provider.length + 1)
    : String(number);
  return `/watch/${encodeURIComponent(provider)}/${encodeURIComponent(animeId)}/${audio}/${encodeURIComponent(`${provider}-${providerEpisode}`)}`;
}

function supportedLanguages(
  payload: StreamPayload,
  stream: NonNullable<StreamPayload['streams']>[number],
): Array<'pt-BR' | 'en'> {
  const found = new Set<'pt-BR' | 'en'>();
  for (const track of [
    ...(stream.subtitles ?? []),
    ...(payload.subtitles ?? []),
  ]) {
    const language = [
      track.srclang,
      track.lang,
      track.label,
      track.language,
    ].find(
      (item): item is string =>
        typeof item === 'string' && item.trim().length > 0,
    );
    const normalized = language ? normalizeSubtitleLanguage(language) : null;
    if (normalized) found.add(normalized);
  }
  return [...found];
}

function asTimestamp(value: unknown): EpisodeTimestamp | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const maybe = value as { start?: unknown; end?: unknown };
  if (
    typeof maybe.start !== 'number' ||
    typeof maybe.end !== 'number' ||
    maybe.start < 0 ||
    maybe.end <= maybe.start
  )
    return undefined;
  return { start: maybe.start, end: maybe.end };
}

function mapTracks(
  payload: StreamPayload,
  stream: NonNullable<StreamPayload['streams']>[number],
): EpisodeSubtitle[] {
  const tracks = new Map<string, EpisodeSubtitle>();
  for (const track of [
    ...(stream.subtitles ?? []),
    ...(payload.subtitles ?? []),
  ]) {
    const url =
      typeof track.url === 'string'
        ? track.url
        : typeof track.file === 'string'
          ? track.file
          : undefined;
    if (!url || tracks.has(url)) continue;
    const lang = [track.srclang, track.lang, track.label, track.language].find(
      (item): item is string =>
        typeof item === 'string' && item.trim().length > 0,
    );
    const format = getSubtitleFormat(url);
    tracks.set(url, {
      kind: 'captions',
      url,
      lang,
      ...(format ? { format } : {}),
    });
  }
  if (stream.thumbnails_vtt)
    tracks.set(stream.thumbnails_vtt, {
      kind: 'thumbnails',
      url: stream.thumbnails_vtt,
    });
  return [...tracks.values()];
}

export const AnivexaCatalog = {
  async episodes(
    animeId: string,
    signal?: AbortSignal,
  ): Promise<AnimeEpisode[]> {
    if (!/^\d+$/.test(animeId)) return [];
    const index = await getJson<EpisodeIndex>(
      `/episodes/${encodeURIComponent(animeId)}`,
      signal,
    );
    const episodes = new Map<number, AnimeEpisode>();
    for (const provider of orderedProviders(index)) {
      for (const episode of index[provider]?.episodes?.sub ?? []) {
        const number = Number(episode.number);
        if (!Number.isSafeInteger(number) || number < 0) continue;
        const previous = episodes.get(number);
        episodes.set(number, {
          id: `${animeId}:sub:${number}`,
          number,
          title: episode.title ?? previous?.title,
          description: episode.description ?? previous?.description,
          image: episode.image ?? previous?.image,
          isSubbed: true,
          isDubbed: false,
        });
      }
    }
    return [...episodes.values()].sort(
      (first, second) => first.number - second.number,
    );
  },

  async servers(
    episodeId: string,
    signal?: AbortSignal,
  ): Promise<EpisodeServer[]> {
    const { animeId, audio, number } = parseEpisodeId(episodeId);
    const index = await getJson<EpisodeIndex>(
      `/episodes/${encodeURIComponent(animeId)}`,
      signal,
    );
    const anime =
      audio === 'sub'
        ? await AniListCatalog.getAnime(animeId, signal).catch(() => null)
        : null;
    const allowEmbeddedSubtitles =
      anime?.isAdult === true ||
      anime?.genres.some((genre) => genre.trim().toLowerCase() === 'hentai') ===
        true;
    const candidates = matchingEpisodes(index, audio, number);
    const resolved = await Promise.all(
      candidates.map(async ({ provider, episode }) => {
        try {
          const payload = await getJson<StreamPayload>(
            watchPath(provider, animeId, audio, episode, number),
            signal,
          );
          return (payload.streams ?? []).flatMap((stream, streamIndex) => {
            if (!stream.url) return [];
            const languages = supportedLanguages(payload, stream);
            if (!languages.length && !allowEmbeddedSubtitles) return [];
            return [
              {
                name: `${provider} · ${stream.server ?? `Fonte ${streamIndex + 1}`}`,
                id: `${provider}|${streamIndex}`,
                subtitleLanguages: languages,
                subtitlePresentation: languages.length
                  ? ('tracks' as const)
                  : ('embedded' as const),
              },
            ];
          });
        } catch {
          return [];
        }
      }),
    );
    return resolved.flat();
  },

  async sources(
    episodeId: string,
    serverId?: string,
    signal?: AbortSignal,
  ): Promise<EpisodeSources> {
    const { animeId, audio, number } = parseEpisodeId(episodeId);
    const wanted = serverId?.split('|');
    if (
      wanted &&
      (!/^[a-z0-9_-]+$/i.test(wanted[0]) || !/^\d+$/.test(wanted[1] ?? ''))
    )
      throw new Error('Servidor de episódio inválido.');
    const index = await getJson<EpisodeIndex>(
      `/episodes/${encodeURIComponent(animeId)}`,
      signal,
    );
    const candidates = matchingEpisodes(index, audio, number).filter(
      ({ provider }) => !wanted || provider === wanted[0],
    );
    let sourceLookupFailed = false;
    for (const { provider, episode } of candidates) {
      try {
        const payload = await getJson<StreamPayload>(
          watchPath(provider, animeId, audio, episode, number),
          signal,
        );
        const streams = payload.streams ?? [];
        const stream = wanted
          ? streams[Number(wanted[1])]
          : (streams.find((item) => item.url && item.isActive) ??
            streams.find((item) => item.url));
        if (!stream?.url) continue;
        const type = String(stream.type ?? '').toLowerCase();
        const isHls = type === 'hls' || /\.m3u8?(?:$|\?)/i.test(stream.url);
        const isDash = type === 'dash' || /\.mpd(?:$|\?)/i.test(stream.url);
        const embedUrl =
          typeof stream.embed === 'string'
            ? stream.embed
            : type === 'embed'
              ? stream.url
              : undefined;
        const referer =
          stream.referer ??
          stream.headers?.Referer ??
          stream.headers?.referer ??
          inferRefererFromEmbed(embedUrl);
        return {
          headers: {
            ...(payload.headers ?? {}),
            ...(stream.headers ?? {}),
            ...(referer ? { Referer: referer } : {}),
          },
          ...(isHls || isDash
            ? {
                sourceUrl: stream.url,
                format: isHls ? ('hls' as const) : ('dash' as const),
              }
            : !embedUrl
              ? { sourceUrl: stream.url, format: 'mp4' as const }
              : {}),
          subtitles: mapTracks(payload, stream),
          embedUrl,
          playlistKey: stream.playlist_key ?? stream.key,
          intro: asTimestamp(stream.intro ?? payload.intro),
          outro: asTimestamp(stream.outro ?? payload.outro),
        };
      } catch {
        if (signal?.aborted) throw signal.reason;
        sourceLookupFailed = true;
      }
    }
    if (sourceLookupFailed)
      throw new Error(
        'Não foi possível consultar a transmissão deste servidor. Tente outro servidor.',
      );
    throw new Error('Nenhuma fonte disponível para este episódio.');
  },
};
