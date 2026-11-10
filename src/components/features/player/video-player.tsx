import { lazy, Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { EpisodeSources } from '@/types/player';

const VidstackVideoPlayer = lazy(() =>
  import('@/components/features/player/vidstack-video-player').then(
    (module) => ({ default: module.VidstackVideoPlayer }),
  ),
);

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

export function VideoPlayer(props: Props) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="grid aspect-video w-full place-items-center rounded-xl bg-black text-sm text-white/65"
        >
          <span className="inline-flex items-center gap-2">
            <LoaderCircle
              size={16}
              className="animate-spin"
              aria-hidden="true"
            />
            Preparando o reprodutor…
          </span>
        </div>
      }
    >
      <VidstackVideoPlayer {...props} />
    </Suspense>
  );
}
