import {
  isDASHProvider,
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
  Track,
  type MediaPlayerInstance,
  type MediaProviderAdapter,
  type MediaTimeUpdateEventDetail,
} from '@vidstack/react';
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from '@vidstack/react/player/layouts/default';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlaybackController } from '@/hooks/use-playback-controller';
import type { EpisodeSources, EpisodeSubtitle } from '@/types/player';
import { createMediaProxyUrl } from '@/lib/media-proxy';
import { resolvePlaybackSource } from '@/lib/player-source-resolver';
import {
  filterSubtitles,
  getSubtitleLabel,
  normalizeSubtitleLanguage,
} from '@/lib/subtitle';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import './vidstack-video-player.css';

interface Props {
  sources: EpisodeSources | null;
  sourceId?: string;
  title: string;
  poster?: string;
  loading: boolean;
  loadingLabel?: string;
  error?: string | null;
  onRetry?: () => void;
  onSourceFailure?: () => boolean;
  initialTime?: number;
  onProgress?: (currentTime: number, duration: number) => void;
}

type SubtitleFormat = 'vtt' | 'srt' | 'ass' | 'ssa' | 'json';

function getSubtitleFormat(subtitle: EpisodeSubtitle): SubtitleFormat {
  if (subtitle.format === 'ass' || subtitle.format === 'ssa')
    return subtitle.format;
  try {
    const extension = new URL(subtitle.url, 'https://subtitle.invalid').pathname
      .split('.')
      .pop()
      ?.toLowerCase();
    if (
      extension === 'vtt' ||
      extension === 'srt' ||
      extension === 'json' ||
      extension === 'ass' ||
      extension === 'ssa'
    )
      return extension;
  } catch {
    // Use the common text track format when the URL cannot be parsed.
  }
  return 'vtt';
}

export function VidstackVideoPlayer({
  sources,
  sourceId,
  title,
  poster,
  loading,
  loadingLabel = 'Preparando transmissão…',
  error,
  onRetry,
  onSourceFailure,
  initialTime,
  onProgress,
}: Props) {
  const playerRef = useRef<MediaPlayerInstance | null>(null);
  const sourceKey =
    sourceId ??
    `${sources?.format ?? ''}:${sources?.sourceUrl ?? ''}:${sources?.embedUrl ?? ''}`;
  const {
    fallback: activeFallback,
    reportFailure: reportPlaybackFailure,
    markHealthy,
    reset: resetPlayback,
  } = usePlaybackController({ sourceKey, sources, onSourceFailure });
  const resolvedSource = resolvePlaybackSource(sources, {
    direct: activeFallback.direct,
    embed: activeFallback.embed,
  });
  const embedUrl =
    resolvedSource.kind === 'embed'
      ? resolvedSource.url
      : resolvedSource.kind === 'media'
        ? resolvedSource.embedUrl
        : '';
  const useEmbed = resolvedSource.kind === 'embed';
  const playbackKey = `${sourceKey}:${activeFallback.direct ? 'direct' : 'proxy'}:${useEmbed ? 'embed' : 'media'}`;
  const [mediaLoadingState, setMediaLoadingState] = useState<{
    key: string;
    value: boolean;
  }>({ key: '', value: false });
  const [skipState, setSkipState] = useState<{
    key: string;
    value: { label: string; time: number } | null;
  }>({ key: '', value: null });
  const mediaLoading =
    mediaLoadingState.key === playbackKey
      ? mediaLoadingState.value
      : Boolean(sources?.sourceUrl && !useEmbed);
  const skip = skipState.key === playbackKey ? skipState.value : null;
  const lastSavedAt = useRef(0);
  const resumed = useRef(false);
  const sourcesRef = useRef(sources);

  const activeSource =
    resolvedSource.kind === 'media' ? resolvedSource.url : '';
  const auth = sources?.headers.Authorization ?? sources?.headers.authorization;
  const subtitles = useMemo(
    () => filterSubtitles(sources?.subtitles ?? []),
    [sources?.subtitles],
  );
  const defaultSubtitle = subtitles.find(
    (track) => normalizeSubtitleLanguage(track.lang ?? '') === 'pt-BR',
  );
  const intro = sources?.intro;
  const outro = sources?.outro;

  const chapterUrl = useMemo(() => {
    if (!intro && !outro) return '';
    const formatTime = (time: number) => {
      const milliseconds = Math.round(time * 1000);
      const hours = Math.floor(milliseconds / 3_600_000);
      const minutes = Math.floor(milliseconds / 60_000) % 60;
      const seconds = Math.floor(milliseconds / 1000) % 60;
      const clock = [hours, minutes, seconds]
        .map((part) => String(part).padStart(2, '0'))
        .join(':');
      return `${clock}.${String(milliseconds % 1000).padStart(3, '0')}`;
    };
    const chapters = ['WEBVTT', ''];
    if (intro)
      chapters.push(
        `${formatTime(intro.start)} --> ${formatTime(intro.end)}`,
        'Intro',
        '',
      );
    if (outro)
      chapters.push(
        `${formatTime(outro.start)} --> ${formatTime(outro.end)}`,
        'Encerramento',
        '',
      );
    return URL.createObjectURL(
      new Blob([chapters.join('\n')], { type: 'text/vtt' }),
    );
  }, [intro, outro]);

  useEffect(
    () => () => {
      if (chapterUrl) URL.revokeObjectURL(chapterUrl);
    },
    [chapterUrl],
  );

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => {
    resumed.current = false;
    lastSavedAt.current = 0;
  }, [playbackKey]);

  const setPlaybackLoading = useCallback(
    (value: boolean) => setMediaLoadingState({ key: playbackKey, value }),
    [playbackKey],
  );

  const setPlaybackSkip = useCallback(
    (value: { label: string; time: number } | null) =>
      setSkipState({ key: playbackKey, value }),
    [playbackKey],
  );

  const handleProviderChange = useCallback(
    (provider: MediaProviderAdapter | null) => {
      if (isHLSProvider(provider)) {
        provider.library = () => import('hls.js');
        provider.config = {
          ...provider.config,
          xhrSetup: (xhr, url) => {
            if (auth && url.startsWith('animonkey-media://proxy/'))
              xhr.setRequestHeader('Authorization', auth);
          },
        };
      }
      if (isDASHProvider(provider)) {
        provider.library = () => import('dashjs');
        provider.onInstance((dash) => {
          dash.addRequestInterceptor(
            (request: { url: string; headers?: Record<string, string> }) => {
              if (/^https?:\/\//i.test(request.url) && sourcesRef.current)
                request.url = createMediaProxyUrl(
                  request.url,
                  sourcesRef.current,
                );
              if (auth)
                request.headers = { ...request.headers, Authorization: auth };
              return Promise.resolve(request);
            },
          );
        });
      }
    },
    [auth],
  );

  const handleTimeUpdate = useCallback(
    ({ currentTime }: MediaTimeUpdateEventDetail) => {
      const player = playerRef.current;
      if (!player) return;
      const duration = player.duration;
      const now = Date.now();
      if (duration > 0 && now - lastSavedAt.current >= 5000) {
        lastSavedAt.current = now;
        onProgress?.(currentTime, duration);
      }
      if (
        !resumed.current &&
        initialTime &&
        initialTime > 0 &&
        duration > initialTime
      ) {
        resumed.current = true;
        player.remoteControl.seek(initialTime);
      }
      if (intro && currentTime >= intro.start && currentTime < intro.end)
        setPlaybackSkip({ label: 'Pular abertura', time: intro.end });
      else if (outro && currentTime >= outro.start && currentTime < outro.end)
        setPlaybackSkip({ label: 'Pular encerramento', time: outro.end });
      else setPlaybackSkip(null);
    },
    [initialTime, intro, onProgress, outro, setPlaybackSkip],
  );

  const retryPlayback = useCallback(() => {
    resumed.current = false;
    resetPlayback();
    setPlaybackLoading(false);
    onRetry?.();
  }, [onRetry, resetPlayback, setPlaybackLoading]);

  const sourceType =
    resolvedSource.kind === 'media' ? resolvedSource.type : 'video/mp4';
  const canMountPlayer = resolvedSource.kind === 'media';
  const playerError =
    error ??
    (activeFallback.failed
      ? 'Não foi possível reproduzir esta fonte.'
      : !loading && !activeSource && !embedUrl
        ? 'Nenhuma fonte disponível para este episódio.'
        : null);
  const statusLabel = loading
    ? loadingLabel
    : mediaLoading
      ? 'Carregando vídeo…'
      : null;
  const showOverlay = loading || mediaLoading || Boolean(playerError);

  return (
    <div className="vidstack-player relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      {showOverlay && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 backdrop-blur-[2px]">
          <div className="max-w-md rounded-2xl border border-white/10 bg-[#101012]/90 px-7 py-5 text-center shadow-2xl">
            <p
              role={playerError ? 'alert' : 'status'}
              className={
                playerError ? 'text-sm text-red-100' : 'text-sm text-white/75'
              }
            >
              {playerError ?? statusLabel}
            </p>
            {playerError && onRetry && (
              <button
                type="button"
                onClick={retryPlayback}
                className="mt-3 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
              >
                Tentar novamente
              </button>
            )}
          </div>
        </div>
      )}
      {canMountPlayer && (
        <MediaPlayer
          key={`${sourceKey}:${activeFallback.direct}`}
          ref={playerRef}
          className="h-full w-full"
          title={title}
          poster={poster}
          src={{ src: activeSource, type: sourceType }}
          playsInline
          preload="none"
          onProviderChange={handleProviderChange}
          onCanPlay={() => {
            setPlaybackLoading(false);
            markHealthy();
          }}
          onWaiting={() => setPlaybackLoading(true)}
          onPlaying={() => {
            setPlaybackLoading(false);
            markHealthy();
          }}
          onTimeUpdate={handleTimeUpdate}
          onPause={() => {
            const player = playerRef.current;
            if (player && player.duration > 0)
              onProgress?.(player.currentTime, player.duration);
          }}
          onError={reportPlaybackFailure}
        >
          <MediaProvider>
            {subtitles.map((subtitle) => (
              <Track
                key={subtitle.url}
                src={createMediaProxyUrl(subtitle.url, sources!)}
                type={getSubtitleFormat(subtitle)}
                kind="captions"
                label={`${getSubtitleLabel(subtitle.lang ?? '')} · ${getSubtitleFormat(subtitle).toUpperCase()}`}
                lang={subtitle.lang?.toLowerCase() ?? 'und'}
                default={subtitle.url === defaultSubtitle?.url}
              />
            ))}
            {chapterUrl && (
              <Track
                key={`${sourceKey}:chapters`}
                src={chapterUrl}
                type="vtt"
                kind="chapters"
                label="Capítulos"
                lang="pt"
                default
              />
            )}
          </MediaProvider>
          <DefaultVideoLayout
            icons={defaultLayoutIcons}
            thumbnails={
              sources?.subtitles.find((track) => track.kind === 'thumbnails')
                ? createMediaProxyUrl(
                    sources.subtitles.find(
                      (track) => track.kind === 'thumbnails',
                    )!.url,
                    sources,
                  )
                : undefined
            }
          />
        </MediaPlayer>
      )}
      {useEmbed && embedUrl && (
        <iframe
          src={embedUrl}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      )}
      {skip && (
        <button
          type="button"
          onClick={() => playerRef.current?.remoteControl.seek(skip.time)}
          className="absolute right-4 bottom-16 z-10 rounded-lg border border-white/25 bg-black/80 px-3 py-2 text-xs font-bold text-white hover:border-[#49d77a]"
        >
          {skip.label} →
        </button>
      )}
    </div>
  );
}
