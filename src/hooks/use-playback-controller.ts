import { useCallback, useEffect, useRef, useState } from 'react';
import { resolvePlaybackSource } from '@/lib/player-source-resolver';
import type { EpisodeSources } from '@/types/player';

export interface PlaybackFallbackState {
  key: string;
  direct: boolean;
  embed: boolean;
  failed: boolean;
}

interface Options {
  sourceKey: string;
  sources: EpisodeSources | null;
  onSourceFailure?: () => boolean;
}

const initialFallback: PlaybackFallbackState = {
  key: '',
  direct: false,
  embed: false,
  failed: false,
};

export function usePlaybackController({
  sourceKey,
  sources,
  onSourceFailure,
}: Options) {
  const [fallbackState, setFallbackState] =
    useState<PlaybackFallbackState>(initialFallback);
  const failureReported = useRef(false);
  const fallback =
    fallbackState.key === sourceKey
      ? fallbackState
      : { ...initialFallback, key: sourceKey };

  useEffect(() => {
    failureReported.current = false;
  }, [fallback.direct, fallback.embed, sourceKey]);

  const setFallback = useCallback(
    (patch: Partial<PlaybackFallbackState>) => {
      setFallbackState((current) => ({
        ...(current.key === sourceKey
          ? current
          : { ...initialFallback, key: sourceKey }),
        ...patch,
        key: sourceKey,
      }));
    },
    [sourceKey],
  );

  const reportFailure = useCallback(() => {
    if (failureReported.current) return;
    failureReported.current = true;

    const source = resolvePlaybackSource(sources, {
      direct: fallback.direct,
    });
    if (
      source.kind === 'media' &&
      source.format === 'hls' &&
      !sources?.playlistKey &&
      !fallback.direct
    ) {
      setFallback({ direct: true });
      return;
    }
    if (onSourceFailure?.()) return;

    const embed = resolvePlaybackSource(sources, { embed: true });
    if (embed.kind === 'embed' && !fallback.embed) setFallback({ embed: true });
    else setFallback({ failed: true });
  }, [fallback.direct, fallback.embed, onSourceFailure, setFallback, sources]);

  const markHealthy = useCallback(() => {
    failureReported.current = false;
  }, []);

  const reset = useCallback(() => {
    failureReported.current = false;
    setFallbackState(initialFallback);
  }, []);

  return { fallback, setFallback, reportFailure, markHealthy, reset };
}
