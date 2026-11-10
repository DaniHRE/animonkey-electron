import Hls from 'hls.js';
import PlyrCore from 'plyr';
import type { PlyrSource } from 'plyr-react';
import { LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EpisodeSources } from '@/types/player';
import { useSubtitleSize } from '@/hooks/use-subtitle-size';
import { createMediaProxyUrl } from '@/lib/media-proxy';
import { filterSubtitles, getSubtitleLabel } from '@/lib/subtitle';
import { SUBTITLE_LABEL, SUBTITLE_SIZES } from '@/types/subtitle';
import type { SubtitleSize } from '@/types/subtitle';
import plyrIconsUrl from '@/assets/plyr.svg?url';
import './video-player.css';
import jassubWorkerUrl from 'jassub/dist/wasm/jassub-worker.js?url';
import jassubWasmUrl from 'jassub/dist/wasm/jassub-worker.wasm?url';
import jassubModernWasmUrl from 'jassub/dist/wasm/jassub-worker-modern.wasm?url';

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

function scaleAssSubtitleContent(content: string, scale: number): string {
  let inStylesSection = false;
  let fontSizeColumn = 2;
  return content
    .split('\n')
    .map((line) => {
      const section = line.match(/^\s*\[([^\]]+)\]/)?.[1];
      if (section) {
        inStylesSection = /^(?:v4 styles|v4\+ styles)$/i.test(section);
        return line;
      }
      if (inStylesSection && /^\s*Format\s*:/i.test(line)) {
        const columns = line.slice(line.indexOf(':') + 1).split(',');
        const declaredColumn = columns.findIndex((column) =>
          /^\s*Fontsize\s*$/i.test(column),
        );
        if (declaredColumn >= 0) fontSizeColumn = declaredColumn;
        return line;
      }
      if (inStylesSection && /^\s*Style\s*:/i.test(line)) {
        const colon = line.indexOf(':');
        const fields = line.slice(colon + 1).split(',');
        const size = Number(fields[fontSizeColumn]);
        if (Number.isFinite(size) && size > 0) {
          fields[fontSizeColumn] = String(Number((size * scale).toFixed(2)));
          return `${line.slice(0, colon + 1)}${fields.join(',')}`;
        }
        return line;
      }
      if (/^\s*Dialogue\s*:/i.test(line)) {
        return line.replace(
          /\\fs([+-]?)(\d+(?:\.\d+)?)/gi,
          (_match, sign: string, value: string) => {
            const size = Number(value);
            return size > 0
              ? `\\fs${sign}${Number((size * scale).toFixed(2))}`
              : `\\fs${sign}${value}`;
          },
        );
      }
      return line;
    })
    .join('\n');
}

interface SubtitleSizeMenu {
  cleanup: () => void;
  update: (size: SubtitleSize) => void;
}

function injectSubtitleSizeMenu(
  menuContainer: HTMLElement,
  currentSize: SubtitleSize,
  onSelect: (size: SubtitleSize) => void,
): SubtitleSizeMenu | null {
  const mainPanel = menuContainer.children[0] as HTMLElement | undefined;
  const mainMenu = mainPanel?.querySelector<HTMLElement>('[role="menu"]');
  if (!mainPanel || !mainMenu) return null;

  const submenu = document.createElement('div');
  submenu.hidden = true;
  const submenuId = `${menuContainer.id || 'plyr-settings'}-subtitle-size`;
  const forward = document.createElement('button');
  forward.type = 'button';
  forward.className = 'plyr__control plyr__control--forward';
  forward.setAttribute('role', 'menuitem');
  forward.setAttribute('aria-haspopup', 'true');
  forward.setAttribute('aria-controls', submenuId);
  forward.dataset.plyrSubtitleSize = '';
  const title = document.createElement('span');
  title.textContent = 'Tamanho da legenda';
  const value = document.createElement('span');
  value.className = 'plyr__menu__value';
  forward.append(title, value);
  mainMenu.append(forward);

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'plyr__control plyr__control--back';
  back.setAttribute('role', 'menuitem');
  back.setAttribute('aria-controls', menuContainer.id);
  const backTitle = document.createElement('span');
  backTitle.textContent = 'Tamanho da legenda';
  back.append(backTitle);
  const options = document.createElement('div');
  options.setAttribute('role', 'menu');
  const radios = new Map<SubtitleSize, HTMLButtonElement>();

  for (const size of SUBTITLE_SIZES) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'plyr__control';
    option.setAttribute('role', 'menuitemradio');
    const label = document.createElement('span');
    label.textContent = SUBTITLE_LABEL[size];
    option.append(label);
    option.addEventListener('click', () => {
      onSelect(size);
      update(size);
    });
    options.append(option);
    radios.set(size, option);
  }
  submenu.id = submenuId;
  submenu.append(back, options);
  menuContainer.append(submenu);

  const show = (panel: HTMLElement) => {
    for (const child of Array.from(menuContainer.children)) {
      (child as HTMLElement).hidden = child !== panel;
    }
    menuContainer.style.setProperty(
      '--plyr-dropdown-height',
      `${options.scrollHeight}px`,
    );
  };
  forward.addEventListener('click', () => show(submenu));
  back.addEventListener('click', () => show(mainPanel));

  const update = (size: SubtitleSize) => {
    value.textContent = SUBTITLE_LABEL[size];
    for (const [optionSize, button] of radios) {
      button.setAttribute(
        'aria-checked',
        optionSize === size ? 'true' : 'false',
      );
    }
  };
  update(currentSize);

  return {
    cleanup: () => {
      forward.remove();
      submenu.remove();
    },
    update,
  };
}

export function VideoPlayer({
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
  const rootRef = useRef<HTMLDivElement>(null);
  const playerMountRef = useRef<HTMLDivElement>(null);
  const plyrRef = useRef<PlyrCore | null>(null);
  const playerInstance = useRef<Hls | null>(null);
  const dashInstance = useRef<import('dashjs').MediaPlayerClass | null>(null);
  const assRenderer = useRef<import('jassub').default | null>(null);
  const assSubtitleContent = useRef<{
    url: string;
    content: string;
    ready: boolean;
  } | null>(null);
  const assVersion = useRef(0);
  const resumed = useRef(false);
  const failureReported = useRef(false);
  const sourceKey =
    sourceId ??
    `${sources?.format ?? ''}:${sources?.sourceUrl ?? ''}:${sources?.embedUrl ?? ''}`;
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
  const [subtitleError, setSubtitleError] = useState<{
    key: string;
    message: string;
  }>({ key: '', message: '' });
  const { size, scale, setSize } = useSubtitleSize();
  const sizeRef = useRef(size);
  const scaleRef = useRef(scale);
  const sizeMenuRef = useRef<SubtitleSizeMenu | null>(null);
  useEffect(() => {
    sizeRef.current = size;
    scaleRef.current = scale;
  }, [scale, size]);

  const subtitles = useMemo(
    () => filterSubtitles(sources?.subtitles ?? []),
    [sources?.subtitles],
  );
  const defaultSubtitle =
    subtitles.find((track) => track.lang?.toLowerCase().startsWith('pt')) ??
    subtitles.find((track) => track.lang?.toLowerCase().startsWith('en'));
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
    sources?.embedUrl &&
    /^https:\/\//i.test(sources.embedUrl) &&
    (() => {
      try {
        return new URL(sources.embedUrl).hostname !== 'embed.settlar.io';
      } catch {
        return false;
      }
    })()
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
    if (!sources || subtitles.length === 0) {
      return () => {
        active = false;
      };
    }
    void Promise.all(
      subtitles.map(async (track) => {
        try {
          let blob: Blob;
          if (track.format === 'ass' || track.format === 'ssa') {
            blob = new Blob(['WEBVTT\n\n'], { type: 'text/vtt' });
          } else {
            const response = await fetch(
              createMediaProxyUrl(track.url, sources),
            );
            if (!response.ok) return null;
            blob = new Blob([await response.arrayBuffer()], {
              type: 'text/vtt',
            });
          }
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
  }, [sourceKey, sources, subtitles]);
  const captionTracks = useMemo(
    () =>
      subtitles.flatMap((track) => {
        const src =
          captionBlobUrls.key === sourceKey
            ? captionBlobUrls.urls[track.url]
            : undefined;
        return src
          ? [
              {
                kind: 'captions' as const,
                label: `${getSubtitleLabel(track.lang ?? '')}${track.format ? ` · ${track.format.toUpperCase()}` : ''}`,
                srcLang: track.lang?.toLowerCase() ?? 'und',
                src,
                default: track.url === defaultSubtitle?.url,
                format: track.format,
                url: track.url,
              },
            ]
          : [];
      }),
    [captionBlobUrls, defaultSubtitle?.url, sourceKey, subtitles],
  );
  const captionsReady =
    !sources || subtitles.length === 0 || captionBlobUrls.key === sourceKey;
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
    sources && captionsReady && !useEmbed && (activeSource || isDash),
  );
  const plyrOptions = useMemo(
    () => ({
      controls: playerControls,
      iconUrl: plyrIconsUrl,
      settings: [
        captionTracks.length ? 'captions' : '',
        'quality',
        'speed',
      ].filter(Boolean),
      captions: { active: true, update: true },
      preload: 'none' as const,
      previewThumbnails: thumbnailUrl
        ? { enabled: true, src: thumbnailUrl }
        : { enabled: false },
    }),
    [captionTracks.length, thumbnailUrl],
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

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !canMountPlayer || captionTracks.length === 0) return;
    let active = true;
    let attempts = 0;
    const interval = window.setInterval(() => {
      if (!active) return;
      const menu = root.querySelector<HTMLElement>('.plyr__menu__container');
      if (!menu) {
        if (attempts++ > 40) window.clearInterval(interval);
        return;
      }
      window.clearInterval(interval);
      if (menu.querySelector('[data-plyr-subtitle-size]')) return;
      sizeMenuRef.current?.cleanup();
      sizeMenuRef.current = injectSubtitleSizeMenu(
        menu,
        sizeRef.current,
        setSize,
      );
    }, 100);
    return () => {
      active = false;
      window.clearInterval(interval);
      sizeMenuRef.current?.cleanup();
      sizeMenuRef.current = null;
    };
  }, [canMountPlayer, captionTracks.length, setSize, sourceKey]);

  useEffect(() => {
    sizeMenuRef.current?.update(size);
    const instance = assRenderer.current;
    const subtitle = assSubtitleContent.current;
    if (!instance || !subtitle?.ready || subtitle.url !== selectedTrack) return;
    void (async () => {
      await instance.renderer.setTrack(
        scaleAssSubtitleContent(subtitle.content, scale),
      );
    })().catch(() => undefined);
  }, [scale, selectedTrack, size]);

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
      !canMountPlayer ||
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
    canMountPlayer,
  ]);

  useEffect(() => {
    if (
      !canMountPlayer ||
      !sources ||
      isDash ||
      sources.format === 'hls' ||
      useEmbed
    )
      return;
    const video = rootRef.current?.querySelector('video');
    if (!(video instanceof HTMLVideoElement)) return;
    video.addEventListener('error', reportPlaybackFailure);
    return () => video.removeEventListener('error', reportPlaybackFailure);
  }, [canMountPlayer, reportPlaybackFailure, isDash, sources, useEmbed]);

  useEffect(() => {
    const video = rootRef.current?.querySelector('video');
    if (
      !(video instanceof HTMLVideoElement) ||
      !canMountPlayer ||
      !sources ||
      !isDash ||
      useEmbed
    )
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
  }, [
    auth,
    canMountPlayer,
    isDash,
    proxiedSource,
    reportPlaybackFailure,
    sources,
    useEmbed,
  ]);

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
      assSubtitleContent.current = null;
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
      assSubtitleContent.current = null;
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
      assSubtitleContent.current = null;
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
        const response = await fetch(
          createMediaProxyUrl(subtitle.url, sources),
        );
        if (!response.ok) throw new Error('Subtitle source unavailable');
        const content = await response.text();
        if (!active || version !== assVersion.current) return;
        assSubtitleContent.current = {
          url: subtitle.url,
          content,
          ready: false,
        };
        const instance = new JASSUB({
          video: target,
          subContent: scaleAssSubtitleContent(content, scaleRef.current),
          workerUrl: jassubWorkerUrl,
          wasmUrl: jassubWasmUrl,
          modernWasmUrl: jassubModernWasmUrl,
        });
        assRenderer.current = instance;
        await instance.ready;
        if (!active || version !== assVersion.current) return;
        assSubtitleContent.current = {
          url: subtitle.url,
          content,
          ready: true,
        };
        await instance.renderer.setTrack(
          scaleAssSubtitleContent(content, scaleRef.current),
        );
      } catch {
        if (version === assVersion.current)
          setSubtitleError({
            key: sourceKey,
            message:
              'Não foi possível renderizar esta legenda. Você pode continuar assistindo ou escolher outra faixa.',
          });
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedTrack, sourceKey, sources, subtitles]);

  useEffect(() => {
    const instance = plyrRef.current;
    const video = rootRef.current?.querySelector('video');
    if (!instance || !(video instanceof HTMLVideoElement)) return;
    const syncSelection = () => {
      if (video.textTracks.length < captionTracks.length) return;
      const index = instance.currentTrack;
      const selected = index >= 0 ? captionTracks[index] : undefined;
      if (selected) {
        setTrackSelection({ key: sourceKey, url: selected.url });
        return;
      }
      if (trackSelection.key !== sourceKey) {
        const preferredIndex = captionTracks.findIndex(
          (track) => track.url === defaultSubtitle?.url,
        );
        if (preferredIndex >= 0 && preferredIndex < video.textTracks.length) {
          const preferredTrack = video.textTracks[preferredIndex];
          if (preferredTrack.language) {
            try {
              instance.currentTrack = preferredIndex;
              instance.toggleCaptions(true);
              return;
            } catch {
              preferredTrack.mode = 'showing';
            }
          }
        }
        setTrackSelection({ key: sourceKey, url: '' });
      } else {
        setTrackSelection({ key: sourceKey, url: '' });
      }
    };
    video.textTracks.addEventListener('change', syncSelection);
    video.textTracks.addEventListener('addtrack', syncSelection);
    syncSelection();
    return () => {
      video.textTracks.removeEventListener('change', syncSelection);
      video.textTracks.removeEventListener('addtrack', syncSelection);
    };
  }, [captionTracks, defaultSubtitle?.url, sourceKey, trackSelection.key]);

  const playerError =
    error ??
    (playerInitError.key === sourceKey ? playerInitError.message : null) ??
    (failed
      ? 'Não foi possível reproduzir esta fonte.'
      : !loading && !activeSource && !embedUrl
        ? 'Nenhuma fonte disponível para este episódio.'
        : null);
  const currentSubtitleError =
    subtitleError.key === sourceKey ? subtitleError.message : '';
  const showOverlay =
    loading ||
    mediaLoading ||
    Boolean(playerError) ||
    (!captionsReady && Boolean(sources));
  const statusLabel = loading
    ? loadingLabel
    : !captionsReady
      ? 'Preparando legendas…'
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
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      )}
      {currentSubtitleError && !playerError && !loading && !mediaLoading && (
        <p
          role="status"
          className="absolute right-3 bottom-3 z-20 max-w-sm rounded-lg border border-amber-200/20 bg-black/80 px-3 py-2 text-xs text-amber-100"
        >
          {currentSubtitleError}
        </p>
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
    </div>
  );
}
