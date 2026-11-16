import { ImageOff } from 'lucide-react';
import { useState } from 'react';

function getEpisodeImageUrl(image?: string): string | null {
  if (!image) return null;
  try {
    const url = new URL(image.trim());
    if (
      url.protocol !== 'https:' ||
      url.origin !== 'https://artworks.thetvdb.com' ||
      url.username ||
      url.password
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function EpisodeThumbnail({
  image,
  className = '',
}: {
  image?: string;
  className?: string;
}) {
  const imageUrl = getEpisodeImageUrl(image);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const imageAvailable = imageUrl !== null && failedImage !== imageUrl;

  return (
    <span
      aria-hidden="true"
      className={[
        'relative flex aspect-video shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/[0.05]',
        className,
      ].join(' ')}
    >
      {imageAvailable ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedImage(imageUrl)}
          className="size-full object-cover"
        />
      ) : (
        <ImageOff size={16} className="text-white/30" aria-hidden="true" />
      )}
    </span>
  );
}
