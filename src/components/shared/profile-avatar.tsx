import { useState } from 'react';

interface Props {
  image: string | null;
  name: string | null;
  className: string;
}

export function ProfileAvatar({ image, name, className }: Props) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const initials = name?.trim().charAt(0).toUpperCase() || '?';
  const showImage = image && failedImage !== image;

  return showImage ? (
    <img
      src={image}
      alt=""
      className={className}
      onError={() => setFailedImage(image)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${className} grid place-items-center bg-[#49d77a]/15 font-bold text-[#49d77a]`}
    >
      {initials}
    </span>
  );
}
