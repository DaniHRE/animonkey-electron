import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Star } from 'lucide-react';
import { resolveAnimeTitle } from '@/lib/anime';
import type { AnimeResult } from '@/types/anime';

type WatchRelatedVariant = 'related' | 'recommendations';

interface WatchRelatedListProps {
  variant: WatchRelatedVariant;
  title: string;
  items: Array<AnimeResult & { relationType?: string }>;
  titleLanguage: 'en' | 'jp';
}

interface WatchRelatedCardProps {
  item: AnimeResult & { relationType?: string };
  variant: WatchRelatedVariant;
  titleLanguage: 'en' | 'jp';
}

function WatchRelatedCard({
  item,
  variant,
  titleLanguage,
}: WatchRelatedCardProps) {
  const title = resolveAnimeTitle(item.title, titleLanguage);
  const relationLabels: Record<string, string> = {
    SEQUEL: 'Sequência',
    PREQUEL: 'Prequela',
    SIDE_STORY: 'História paralela',
    SPIN_OFF: 'Derivado',
    CHARACTER: 'Personagens',
    ALTERNATIVE: 'Alternativo',
    SUMMARY: 'Resumo',
    PARENT: 'Obra principal',
    ADAPTATION: 'Adaptação',
    SOURCE: 'Obra original',
    OTHER: 'Relacionado',
    COMPILATION: 'Compilação',
    CONTAINS: 'Inclui',
  };
  const relation = item.relationType
    ? (relationLabels[item.relationType] ?? 'Relacionado')
    : undefined;
  const year =
    typeof item.releaseDate === 'number' && Number.isFinite(item.releaseDate)
      ? item.releaseDate
      : undefined;
  const rating =
    typeof item.rating === 'number' &&
    Number.isFinite(item.rating) &&
    item.rating > 0
      ? item.rating
      : undefined;

  return (
    <Link
      to="/anime/$id"
      params={{ id: item.id }}
      className="watch-related__item"
    >
      <span className="watch-related__image">
        {item.image ? (
          <img src={item.image} alt="" loading="lazy" />
        ) : (
          <span aria-hidden="true">?</span>
        )}
      </span>
      <span className="watch-related__copy">
        <span className="watch-related__title" title={title}>
          {title}
        </span>
        <span className="watch-related__metadata">
          {variant === 'related' ? (
            <>
              <span className="watch-related__relation-type">
                {relation ?? 'Relacionado'}
              </span>
              {item.type && <span>{item.type}</span>}
              {year !== undefined && <span>{year}</span>}
            </>
          ) : (
            <>
              {item.type && <span>{item.type}</span>}
              {rating !== undefined && (
                <span
                  className="watch-related__rating"
                  aria-label={`Nota AniList ${rating.toFixed(1)} de 10`}
                >
                  <Star size={12} aria-hidden="true" />
                  {rating.toFixed(1)}
                </span>
              )}
              {!item.type && rating === undefined && <span>Recomendado</span>}
            </>
          )}
        </span>
      </span>
    </Link>
  );
}

export function WatchRelatedList({
  variant,
  title,
  items,
  titleLanguage,
}: WatchRelatedListProps) {
  const [showAllRelated, setShowAllRelated] = useState(false);

  if (items.length === 0) return null;

  const isScrollable = variant === 'recommendations' && items.length > 4;
  const hasMoreRelated = variant === 'related' && items.length > 5;
  const visibleItems =
    hasMoreRelated && !showAllRelated ? items.slice(0, 5) : items;
  const headingId = `watch-related-${variant}-heading`;
  const listId = `watch-related-${variant}-list`;

  return (
    <section
      className={`watch-related watch-related--${variant}`}
      aria-labelledby={headingId}
    >
      <div className="watch-related__heading">
        <span className="watch-related__marker" aria-hidden="true" />
        <h2 id={headingId}>{title}</h2>
      </div>
      <div
        id={listId}
        className={`watch-related__list ${isScrollable ? 'watch-related__list--scrollable' : ''}`}
        aria-label={isScrollable ? title : undefined}
        role={isScrollable ? 'region' : undefined}
        tabIndex={isScrollable ? 0 : undefined}
      >
        {visibleItems.map((item) => (
          <WatchRelatedCard
            key={item.id}
            item={item}
            variant={variant}
            titleLanguage={titleLanguage}
          />
        ))}
      </div>
      {hasMoreRelated && (
        <button
          className="watch-related__more"
          type="button"
          aria-controls={listId}
          aria-expanded={showAllRelated}
          onClick={() => setShowAllRelated((expanded) => !expanded)}
        >
          {showAllRelated
            ? 'Mostrar menos'
            : `Mostrar mais ${items.length - visibleItems.length}`}
        </button>
      )}
    </section>
  );
}
