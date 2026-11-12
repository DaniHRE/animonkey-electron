import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export function HorizontalCarousel({
  children,
  label,
  className = '',
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const updateControls = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setCanScrollBack(viewport.scrollLeft > 2);
    setCanScrollForward(
      viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 2,
    );
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    updateControls();
    viewport.addEventListener('scroll', updateControls, { passive: true });
    const resizeObserver = new ResizeObserver(updateControls);
    resizeObserver.observe(viewport);
    if (viewport.firstElementChild)
      resizeObserver.observe(viewport.firstElementChild);
    return () => {
      viewport.removeEventListener('scroll', updateControls);
      resizeObserver.disconnect();
    };
  }, [updateControls, children]);

  function scroll(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({
      left: direction * Math.max(viewport.clientWidth * 0.82, 240),
      behavior: 'smooth',
    });
  }

  return (
    <div className={`group/carousel relative min-w-0 ${className}`}>
      <div
        ref={viewportRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-0.5 pb-3 outline-none focus-visible:ring-1 focus-visible:ring-[#49d77a]/50"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label={`Rolar ${label} para a esquerda`}
        onClick={() => scroll(-1)}
        disabled={!canScrollBack}
        className="absolute top-1/2 left-1 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-[#101012]/90 text-white shadow-xl backdrop-blur transition hover:bg-[#202023] disabled:pointer-events-none disabled:opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100 md:opacity-0"
      >
        <ChevronLeft size={19} />
      </button>
      <button
        type="button"
        aria-label={`Rolar ${label} para a direita`}
        onClick={() => scroll(1)}
        disabled={!canScrollForward}
        className="absolute top-1/2 right-1 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-[#101012]/90 text-white shadow-xl backdrop-blur transition hover:bg-[#202023] disabled:pointer-events-none disabled:opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100 md:opacity-0"
      >
        <ChevronRight size={19} />
      </button>
    </div>
  );
}
