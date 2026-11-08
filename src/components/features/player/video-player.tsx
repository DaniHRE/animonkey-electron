import Hls from 'hls.js';
import PlyrCore from 'plyr';
import type { PlyrSource } from 'plyr-react';
import { LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EpisodeSources } from '@/types/player';
import { useSubtitleSize } from '@/hooks/use-subtitle-size';
import { createMediaProxyUrl } from '@/lib/media-proxy';
import { filterSubtitles, getSubtitleLabel } from '@/lib/subtitle';
import { SUBTITLE_LABEL, SUBTITLE_SCALE } from '@/types/subtitle';
import type { SubtitleSize } from '@/types/subtitle';
import plyrIconsUrl from '@/assets/plyr.svg?url';
import './video-player.css';
import jassubWorkerUrl from 'jassub/dist/wasm/jassub-worker.js?url';
import jassubWasmUrl from 'jassub/dist/wasm/jassub-worker.wasm?url';
import jassubModernWasmUrl from 'jassub/dist/wasm/jassub-worker-modern.wasm?url';

interface Props {
  sources: EpisodeSources | null;
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

const playerControls = [
  'play-large',
  'rewind',
  'play',
  'fast-forward',
  'progress',
  'current-time',
  'duration',
  'mute',
  'volume',
  'settings',
  'pip',
  'fullscreen',
];

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);
  return [hours, minutes, rest]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export function VideoPlayer({
  sources,
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
  const rootRef = useRef<HTMLDivElement>(null);
  const playerMountRef = useRef<HTMLDivElement>(null);
  const plyrRef = useRef<PlyrCore | null>(null);
  const playerInstance = useRef<Hls | null>(null);
  const dashInstance = useRef<import('dashjs').MediaPlayerClass | null>(null);
  const assRenderer = useRef<import('jassub').default | null>(null);
  const assVersion = useRef(0);
  const resumed = useRef(false);
  const failureReported = useRef(false);
  const sourceKey = `${sources?.format ?? ''}:${sources?.sourceUrl ?? ''}:${sources?.embedUrl ?? ''}`;
  const [fallbackState, setFallbackState] = useState({
    key: '',
    direct: false,
    embed: false,
    failed: false,
  });
  const fallback =
    fallbackState.key === sourceKey
      ? fallbackState
      : { key: sourceKey, direct: false, embed: false, failed: false };
  const failed = fallback.failed;
  const [playerInitError, setPlayerInitError] = useState<{
    key: string;
    message: string;
  }>({ key: '', message: '' });
  const [trackSelection, setTrackSelection] = useState<{
    key: string;
    url: string;
  }>({ key: '', url: '' });
  const [captionBlobUrls, setCaptionBlobUrls] = useState<{
    key: string;
    urls: Record<string, string>;
  }>({ key: '', urls: {} });
  const [skip, setSkip] = useState<{ label: string; time: number } | null>(
    null,
  );
  const [mediaLoading, setMediaLoading] = useState(false);
  const { size, scale, setSize } = useSubtitleSize();

  const subtitles = useMemo(
    () => filterSubtitles(sources?.subtitles ?? []),
    [sources?.subtitles],
  );
  const defaultSubtitle =
    subtitles.find((track) => track.lang?.toLowerCase().startsWith('pt')) ??
    subtitles.find((track) => track.lang?.toLowerCase().startsWith('en'));
  const webVttSubtitles = useMemo(
    () => subtitles.filter((track) => !track.format),
    [subtitles],
  );
  const selectedTrack =
    trackSelection.key === sourceKey
      ? trackSelection.url
      : (defaultSubtitle?.url ?? '');

  const sourceUrl = sources?.sourceUrl ?? '';
  const hasPlaylistKey = Boolean(sources?.playlistKey);
  const proxiedSource =
    sourceUrl && sources ? createMediaProxyUrl(sourceUrl, sources) : '';
  const activeSource = fallback.direct ? sourceUrl : proxiedSource;
  const isDash = sources?.format === 'dash';
  const embedUrl =
    sources?.embedUrl && /^https:\/\//i.test(sources.embedUrl)
      ? sources.embedUrl
      : '';
  const useEmbed = fallback.embed || (!sourceUrl && Boolean(embedUrl));
  const auth = sources?.headers.Authorization ?? sources?.headers.authorization;
  const setFallback = useCallback(
    (patch: Partial<typeof fallback>) => {
      setFallbackState((current) => ({
        ...(current.key === sourceKey
          ? current
          : { key: sourceKey, direct: false, embed: false, failed: false }),
        ...patch,
        key: sourceKey,
      }));
    },
    [sourceKey],
  );
  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    if (!sources || webVttSubtitles.length === 0) {
      return () => {
        active = false;
      };
    }
    void Promise.all(
      webVttSubtitles.map(async (track) => {
        try {
          const response = await fetch(createMediaProxyUrl(track.url, sources));
          if (!response.ok) return null;
          const blob = new Blob([await response.arrayBuffer()], {
            type: 'text/vtt',
          });
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          return [track.url, url] as const;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (active)
        setCaptionBlobUrls({
          key: sourceKey,
          urls: Object.fromEntries(
            entries.filter(
              (entry): entry is readonly [string, string] => entry !== null,
            ),
          ),
        });
    });
    return () => {
      active = false;
      objectUrls.forEach(URL.revokeObjectURL);
    };
  }, [sourceKey, sources, webVttSubtitles]);
  const captionTracks = useMemo(
    () =>
      webVttSubtitles.flatMap((track) => {
        const src =
          captionBlobUrls.key === sourceKey
            ? captionBlobUrls.urls[track.url]
            : undefined;
        return src
          ? [
              {
                kind: 'captions' as const,
                label: getSubtitleLabel(track.lang ?? ''),
                srcLang: track.lang?.toLowerCase() ?? 'und',
                src,
                default: track.url === defaultSubtitle?.url,
              },
            ]
          : [];
      }),
    [captionBlobUrls, defaultSubtitle?.url, sourceKey, webVttSubtitles],
  );
  const intro = sources?.intro;
  const outro = sources?.outro;
  const chapters = useMemo(() => {
    if (!intro && !outro) return '';
    const toVtt = (time: number) => `${formatTime(time)}.000`;
    const parts = ['WEBVTT', ''];
    if (intro)
      parts.push(`${toVtt(intro.start)} --> ${toVtt(intro.end)}`, 'Intro', '');
    if (outro)
      parts.push(
        `${toVtt(outro.start)} --> ${toVtt(outro.end)}`,
        'Encerramento',
        '',
      );
    return parts.join('\n');
  }, [intro, outro]);
  const chapterUrl = useMemo(
    () =>
      chapters
        ? URL.createObjectURL(new Blob([chapters], { type: 'text/vtt' }))
        : '',
    [chapters],
  );
  useEffect(
    () => () => {
      if (chapterUrl) URL.revokeObjectURL(chapterUrl);
    },
    [chapterUrl],
  );
  const thumbnail = sources?.subtitles.find(
    (track) => track.kind === 'thumbnails',
  );
  const thumbnailUrl =
    thumbnail && sources
      ? createMediaProxyUrl(thumbnail.url, sources)
      : undefined;

  const playerSource = useMemo<PlyrSource>(
    () => ({
      type: 'video',
      title,
      sources:
        isDash || useEmbed
          ? []
          : activeSource
            ? [
                {
                  src: activeSource,
                  type:
                    sources?.format === 'hls'
                      ? 'application/x-mpegURL'
                      : 'video/mp4',
                },
              ]
            : [],
      tracks: [
        ...captionTracks,
        ...(chapterUrl
          ? [
              {
                kind: 'chapters' as const,
                label: 'Capítulos',
                srcLang: 'pt',
                src: chapterUrl,
                default: false,
              },
            ]
          : []),
      ],
      poster,
    }),
    [
      activeSource,
      captionTracks,
      chapterUrl,
      isDash,
      poster,
      sources?.format,
      title,
      useEmbed,
    ],
  );

  const canMountPlayer = Boolean(
    sources && !useEmbed && (activeSource || isDash),
  );
  const plyrOptions = useMemo(
    () => ({
      controls: playerControls,
      iconUrl: plyrIconsUrl,
      settings: [
        webVttSubtitles.length ? 'captions' : '',
        'quality',
        'speed',
      ].filter(Boolean),
      captions: { active: true, update: true },
      preload: 'none' as const,
      previewThumbnails: thumbnailUrl
        ? { enabled: true, src: thumbnailUrl }
        : { enabled: false },
    }),
    [thumbnailUrl, webVttSubtitles.length],
  );
  useEffect(() => {
    const mount = playerMountRef.current;
    if (!mount || !canMountPlayer) return;
    const video = document.createElement('video');
    video.className = 'plyr-react plyr';
    video.playsInline = true;
    mount.replaceChildren(video);
    failureReported.current = false;
    try {
      const player = new PlyrCore(video, plyrOptions);
      plyrRef.current = player;
      player.source = playerSource;
      return () => {
        if (plyrRef.current === player) plyrRef.current = null;
        player.destroy();
        mount.replaceChildren();
      };
    } catch {
      mount.replaceChildren();
      queueMicrotask(() =>
        setPlayerInitError({
          key: sourceKey,
          message:
            'Não foi possível iniciar o reprodutor. Tente outro servidor.',
        }),
      );
      return () => mount.replaceChildren();
    }
  }, [canMountPlayer, plyrOptions, playerSource, sourceKey]);

  const reportPlaybackFailure = useCallback(() => {
    if (failureReported.current) return;
    failureReported.current = true;
    if (
      sources?.format === 'hls' &&
      sourceUrl &&
      !hasPlaylistKey &&
      !fallback.direct
    ) {
      setFallback({ direct: true });
      return;
    }
    const advanced = onSourceFailure?.() ?? false;
    if (advanced) return;
    if (embedUrl && !fallback.embed) setFallback({ embed: true });
    else setFallback({ failed: true });
  }, [
    embedUrl,
    fallback.direct,
    fallback.embed,
    onSourceFailure,
    setFallback,
    hasPlaylistKey,
    sourceUrl,
    sources?.format,
  ]);

  const retryPlayback = useCallback(() => {
    failureReported.current = false;
    resumed.current = false;
    setFallbackState({ key: '', direct: false, embed: false, failed: false });
    setPlayerInitError({ key: '', message: '' });
    setMediaLoading(false);
    onRetry?.();
  }, [onRetry]);

  useEffect(() => {
    resumed.current = false;
    failureReported.current = false;
  }, [fallback.direct, sourceKey]);

  useEffect(() => {
    const video = rootRef.current?.querySelector('video');
    if (
      !(video instanceof HTMLVideoElement) ||
      !sources ||
      isDash ||
      useEmbed ||
      sources.format !== 'hls'
    )
      return;
    if (!Hls.isSupported()) {
      video.src = activeSource;
      const onError = reportPlaybackFailure;
      video.addEventListener('error', onError);
      return () => video.removeEventListener('error', onError);
    }
    const hls = new Hls({
      manifestLoadingMaxRetry: 1,
      manifestLoadingRetryDelay: 750,
      manifestLoadingMaxRetryTimeout: 3000,
      fragLoadingMaxRetry: 2,
      fragLoadingRetryDelay: 750,
      fragLoadingMaxRetryTimeout: 3000,
      xhrSetup: (xhr, requestUrl) => {
        if (auth && requestUrl.startsWith('animonkey-media://proxy/'))
          xhr.setRequestHeader('Authorization', auth);
      },
    });
    playerInstance.current = hls;
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      hls.destroy();
      reportPlaybackFailure();
    });
    hls.loadSource(activeSource);
    hls.attachMedia(video);
    return () => {
      hls.destroy();
      if (playerInstance.current === hls) playerInstance.current = null;
    };
  }, [
    activeSource,
    auth,
    embedUrl,
    isDash,
    sourceUrl,
    sources,
    reportPlaybackFailure,
    useEmbed,
  ]);

  useEffect(() => {
    if (!sources || isDash || sources.format === 'hls' || useEmbed) return;
    const video = rootRef.current?.querySelector('video');
    if (!(video instanceof HTMLVideoElement)) return;
    video.addEventListener('error', reportPlaybackFailure);
    return () => video.removeEventListener('error', reportPlaybackFailure);
  }, [reportPlaybackFailure, isDash, sources, useEmbed]);

  useEffect(() => {
    const video = rootRef.current?.querySelector('video');
    if (!(video instanceof HTMLVideoElement) || !sources || !isDash || useEmbed)
      return;
    let active = true;
    void import('dashjs')
      .then((dashjs) => {
        if (!active) return;
        const dash = dashjs.MediaPlayer().create();
        dash.addRequestInterceptor((request) => {
          if (/^https?:\/\//i.test(request.url))
            request.url = createMediaProxyUrl(request.url, sources);
          if (auth)
            request.headers = { ...request.headers, Authorization: auth };
          return Promise.resolve(request);
        });
        dash.on(dashjs.MediaPlayer.events.ERROR, reportPlaybackFailure);
        dash.initialize(video, proxiedSource, false);
        dashInstance.current = dash;
      })
      .catch(reportPlaybackFailure);
    return () => {
      active = false;
      dashInstance.current?.reset();
      dashInstance.current = null;
    };
  }, [auth, isDash, proxiedSource, reportPlaybackFailure, sources, useEmbed]);

  useEffect(() => {
    const container = rootRef.current;
    if (!container) return;
    let video: HTMLVideoElement | null = null;
    let lastSaved = 0;
    const syncVideo = () => {
      const next = container.querySelector('video');
      if (!(next instanceof HTMLVideoElement) || next === video) return;
      video?.removeEventListener('timeupdate', onTimeUpdate);
      video?.removeEventListener('pause', onPause);
      video?.removeEventListener('canplay', onCanPlay);
      video?.removeEventListener('loadstart', onLoadStart);
      video?.removeEventListener('waiting', onLoadStart);
      video?.removeEventListener('playing', onPlaying);
      video = next;
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('pause', onPause);
      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('loadstart', onLoadStart);
      video.addEventListener('waiting', onLoadStart);
      video.addEventListener('playing', onPlaying);
      setMediaLoading(true);
    };
    const onTimeUpdate = () => {
      if (!video) return;
      const now = Date.now();
      if (video.duration > 0 && now - lastSaved > 5000) {
        lastSaved = now;
        onProgress?.(video.currentTime, video.duration);
      }
      const intro = sources?.intro;
      const outro = sources?.outro;
      if (
        intro &&
        video.currentTime >= intro.start &&
        video.currentTime < intro.end
      )
        setSkip({ label: 'Pular abertura', time: intro.end });
      else if (
        outro &&
        video.currentTime >= outro.start &&
        video.currentTime < outro.end
      )
        setSkip({ label: 'Pular encerramento', time: outro.end });
      else setSkip(null);
    };
    const onPause = () => {
      if (video && video.duration > 0)
        onProgress?.(video.currentTime, video.duration);
    };
    const onLoadStart = () => setMediaLoading(true);
    const onPlaying = () => setMediaLoading(false);
    const onCanPlay = () => {
      setMediaLoading(false);
      if (
        !video ||
        resumed.current ||
        !initialTime ||
        initialTime <= 0 ||
        video.duration <= initialTime
      )
        return;
      resumed.current = true;
      video.currentTime = initialTime;
    };
    const observer = new MutationObserver(syncVideo);
    observer.observe(container, { childList: true, subtree: true });
    syncVideo();
    return () => {
      observer.disconnect();
      video?.removeEventListener('timeupdate', onTimeUpdate);
      video?.removeEventListener('pause', onPause);
      video?.removeEventListener('canplay', onCanPlay);
      video?.removeEventListener('loadstart', onLoadStart);
      video?.removeEventListener('waiting', onLoadStart);
      video?.removeEventListener('playing', onPlaying);
      if (video?.duration && video.duration > 0)
        onProgress?.(video.currentTime, video.duration);
      const current = assRenderer.current;
      assRenderer.current = null;
      if (current) void current.destroy();
      video?.classList.remove('plyr-video--ass-active');
      video
        ?.closest('.plyr__video-wrapper')
        ?.classList.remove('plyr-video-wrapper--ass-active');
    };
  }, [initialTime, onProgress, sources]);

  useEffect(() => {
    const video = rootRef.current?.querySelector('video');
    if (!(video instanceof HTMLVideoElement)) return;
    if (!selectedTrack) {
      assVersion.current += 1;
      const old = assRenderer.current;
      assRenderer.current = null;
      if (old) void old.destroy();
      video.classList.remove('plyr-video--ass-active');
      video
        .closest('.plyr__video-wrapper')
        ?.classList.remove('plyr-video-wrapper--ass-active');
      return;
    }
    const subtitle = subtitles.find((track) => track.url === selectedTrack);
    if (!subtitle?.format || !sources) {
      assVersion.current += 1;
      const old = assRenderer.current;
      assRenderer.current = null;
      if (old) void old.destroy();
      video.classList.remove('plyr-video--ass-active');
      video
        .closest('.plyr__video-wrapper')
        ?.classList.remove('plyr-video-wrapper--ass-active');
      return;
    }
    const version = ++assVersion.current;
    let active = true;
    void (async () => {
      const old = assRenderer.current;
      assRenderer.current = null;
      if (old) await old.destroy();
      if (!active || version !== assVersion.current) return;
      try {
        const { default: JASSUB } = await import('jassub');
        const target = rootRef.current?.querySelector('video');
        if (!(target instanceof HTMLVideoElement) || !active) return;
        target.classList.add('plyr-video--ass-active');
        target
          .closest('.plyr__video-wrapper')
          ?.classList.add('plyr-video-wrapper--ass-active');
        const instance = new JASSUB({
          video: target,
          subUrl: createMediaProxyUrl(subtitle.url, sources),
          workerUrl: jassubWorkerUrl,
          wasmUrl: jassubWasmUrl,
          modernWasmUrl: jassubModernWasmUrl,
        });
        assRenderer.current = instance;
        await instance.ready;
      } catch {
        if (version === assVersion.current)
          setTrackSelection({ key: sourceKey, url: '' });
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedTrack, sourceKey, sources, subtitles]);

  useEffect(() => {
    const instance = plyrRef.current;
    if (!instance) return;
    const index = webVttSubtitles.findIndex(
      (track) => track.url === selectedTrack,
    );
    const video = rootRef.current?.querySelector('video');
    if (!(video instanceof HTMLVideoElement)) return;
    if (index >= 0 && index < video.textTracks.length) {
      const track = video.textTracks[index];
      if (track.language) {
        try {
          instance.currentTrack = index;
          instance.toggleCaptions(true);
          return;
        } catch {
          // Fall back to the native track mode if Plyr has not indexed it yet.
        }
      }
    }
    for (
      let trackIndex = 0;
      trackIndex < video.textTracks.length;
      trackIndex++
    ) {
      video.textTracks[trackIndex].mode =
        trackIndex === index ? 'showing' : 'disabled';
    }
  }, [selectedTrack, webVttSubtitles, proxiedSource]);

  const playerError =
    error ??
    (playerInitError.key === sourceKey ? playerInitError.message : null) ??
    (failed
      ? 'Não foi possível reproduzir esta fonte.'
      : !loading && !activeSource && !embedUrl
        ? 'Nenhuma fonte disponível para este episódio.'
        : null);
  const showOverlay = loading || mediaLoading || Boolean(playerError);
  const statusLabel = loading
    ? loadingLabel
    : mediaLoading
      ? 'Carregando vídeo…'
      : null;

  return (
    <div
      ref={rootRef}
      style={{ '--subtitle-scale': String(scale) } as React.CSSProperties}
      className="relative aspect-video w-full overflow-hidden rounded-xl bg-black [&_.plyr]:h-full [&_.plyr]:w-full"
    >
      {showOverlay && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 backdrop-blur-[2px]">
          <div className="max-w-md rounded-2xl border border-white/10 bg-[#101012]/90 px-7 py-5 text-center shadow-2xl">
            {statusLabel && !playerError && (
              <LoaderCircle
                aria-hidden="true"
                className="mx-auto mb-3 size-6 animate-spin text-[#49d77a]"
              />
            )}
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
      <div
        ref={playerMountRef}
        className="absolute inset-0 [&_.plyr]:h-full [&_.plyr]:w-full"
      />
      {useEmbed && embedUrl && (
        <iframe
          src={embedUrl}
          title={title}
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      )}
      {skip && (
        <button
          type="button"
          onClick={() => {
            const video = rootRef.current?.querySelector('video');
            if (video) video.currentTime = skip.time;
          }}
          className="absolute right-4 bottom-16 z-20 rounded-lg border border-white/25 bg-black/80 px-3 py-2 text-xs font-bold text-white hover:border-[#49d77a]"
        >
          {skip.label} →
        </button>
      )}
      {subtitles.length > 0 && (
        <label className="absolute top-3 right-3 z-10 flex items-center gap-2 rounded-lg bg-black/75 px-2 py-1.5 text-[10px] text-white/75">
          Legenda
          <select
            value={selectedTrack}
            aria-label="Selecionar legenda"
            onChange={(event) => {
              setTrackSelection({ key: sourceKey, url: event.target.value });
              const selectedIndex = webVttSubtitles.findIndex(
                (track) => track.url === event.target.value,
              );
              if (plyrRef.current) {
                const player = plyrRef.current;
                const video = rootRef.current?.querySelector('video');
                const textTrack =
                  video instanceof HTMLVideoElement && selectedIndex >= 0
                    ? video.textTracks[selectedIndex]
                    : undefined;
                if (selectedIndex < 0) {
                  for (
                    let index = 0;
                    video instanceof HTMLVideoElement &&
                    index < video.textTracks.length;
                    index++
                  ) {
                    video.textTracks[index].mode = 'disabled';
                  }
                  return;
                }
                if (
                  textTrack?.language &&
                  typeof player.toggleCaptions === 'function'
                ) {
                  try {
                    player.currentTrack = selectedIndex;
                    player.toggleCaptions(true);
                  } catch {
                    textTrack.mode = 'showing';
                  }
                } else {
                  if (video instanceof HTMLVideoElement) {
                    for (
                      let index = 0;
                      index < video.textTracks.length;
                      index++
                    ) {
                      video.textTracks[index].mode =
                        index === selectedIndex ? 'showing' : 'disabled';
                    }
                  }
                }
              }
            }}
            className="max-w-40 bg-transparent text-[10px] outline-none"
          >
            <option value="">Desativada</option>
            {subtitles.map((track) => (
              <option key={track.url} value={track.url}>
                {getSubtitleLabel(track.lang ?? '')}
                {track.format ? ` · ${track.format.toUpperCase()}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <div
        className="absolute right-3 bottom-3 z-10 flex gap-1 rounded-lg bg-black/75 p-1"
        aria-label="Tamanho da legenda"
      >
        {(['small', 'medium', 'large', 'xlarge'] as SubtitleSize[]).map(
          (option) => (
            <button
              key={option}
              type="button"
              aria-label={`Legenda ${SUBTITLE_LABEL[option]}`}
              aria-pressed={size === option}
              title={SUBTITLE_LABEL[option]}
              onClick={() => setSize(option)}
              className={`grid size-7 place-items-center rounded text-[10px] font-bold ${size === option ? 'bg-[#49d77a] text-black' : 'text-white/65 hover:bg-white/10'}`}
            >
              A
              {SUBTITLE_SCALE[option] > 1
                ? '+'
                : SUBTITLE_SCALE[option] < 1
                  ? '−'
                  : ''}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
