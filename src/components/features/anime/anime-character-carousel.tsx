import { ChevronLeft, ChevronRight, UserRound, UsersRound } from 'lucide-react';
import { useId, useRef } from 'react';
import type { AnimeCharacter } from '@/types/anime';

interface AnimeCharacterCarouselProps {
  characters: AnimeCharacter[];
}

export function AnimeCharacterCarousel({
  characters,
}: AnimeCharacterCarouselProps) {
  const trackId = useId();
  const trackRef = useRef<HTMLDivElement>(null);

  function scroll(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    track.scrollBy({
      left: direction * Math.max(track.clientWidth * 0.8, 240),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  if (!characters.length) {
    return (
      <div
        role="tabpanel"
        className="flex min-h-40 flex-col items-center justify-center gap-3 text-center"
      >
        <UsersRound
          size={28}
          strokeWidth={1.5}
          className="text-white/35"
          aria-hidden="true"
        />
        <p className="text-sm text-white/55">Sem personagens listados.</p>
      </div>
    );
  }

  return (
    <section role="tabpanel" aria-label="Personagens do anime">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-white/45">
          {characters.length} personagens
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Mostrar personagens anteriores"
            aria-controls={trackId}
            onClick={() => scroll(-1)}
            className="grid size-9 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#49d77a]"
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Mostrar próximos personagens"
            aria-controls={trackId}
            onClick={() => scroll(1)}
            className="grid size-9 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#49d77a]"
          >
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        id={trackId}
        ref={trackRef}
        role="list"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin]"
      >
        {characters.map((character) => (
          <article
            key={character.id}
            role="listitem"
            className="flex min-h-[116px] w-[min(82vw,270px)] shrink-0 snap-start items-center gap-3 rounded-xl border border-white/[0.08] bg-[#171719] p-2.5 sm:w-[270px] sm:p-3"
          >
            <div className="relative h-[92px] w-[70px] shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
              {character.image ? (
                <img
                  src={character.image}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover object-top"
                />
              ) : (
                <div
                  className="grid size-full place-items-center text-white/30"
                  aria-hidden="true"
                >
                  <UserRound size={34} strokeWidth={1.25} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 py-1">
              <p className="line-clamp-2 text-sm font-bold leading-snug text-white">
                {character.name}
              </p>
              <span className="mt-1.5 inline-flex rounded-md bg-white/[0.07] px-2 py-1 text-xs font-semibold text-white/55">
                {character.role === 'MAIN' ? 'Principal' : 'Coadjuvante'}
              </span>
              {character.voiceActor && (
                <div className="mt-2.5 flex min-w-0 items-center gap-2">
                  {character.voiceActor.image ? (
                    <img
                      src={character.voiceActor.image}
                      alt=""
                      loading="lazy"
                      className="size-6 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/35">
                      <UserRound size={13} aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-xs leading-tight text-white/40">
                      Voz japonesa
                    </span>
                    <span className="mt-1 block truncate text-xs font-medium text-white/70">
                      {character.voiceActor.name}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
