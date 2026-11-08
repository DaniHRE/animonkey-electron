import { useLocalPreference } from '@/hooks/use-local-preference';
import { SUBTITLE_SCALE } from '@/types/subtitle';
import type { SubtitleSize } from '@/types/subtitle';

export function useSubtitleSize() {
  const preference = useLocalPreference<SubtitleSize>(
    'player.subtitle-size',
    'medium',
  );
  const size = (
    SUBTITLE_SCALE[preference.value] ? preference.value : 'medium'
  ) as SubtitleSize;
  return {
    size,
    scale: SUBTITLE_SCALE[size],
    setSize: preference.update,
  };
}
