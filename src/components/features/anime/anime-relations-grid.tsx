import {
  CalendarDays,
  Clapperboard,
  ListVideo,
  Network,
  Star,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AnimeInfo } from '@/types/anime';
import { getAnimeImage, resolveAnimeTitle } from '@/lib/anime';
import './anime-relations-grid.css';

interface AnimeRelationsGridProps {
  relations: AnimeInfo['relations'];
  titleLanguage: 'en' | 'jp';
}

export function AnimeRelationsGrid({
  relations,
  titleLanguage,
}: AnimeRelationsGridProps) {
  if (relations.length === 0) {
    return (
      <div
        role="tabpanel"
        aria-label="Relações do anime"
        className="anime-relations-empty"
      >
        <span className="anime-relations-empty-icon">
          <Network size={21} aria-hidden="true" />
        </span>
        <p>Não existem animes relacionados para esta obra.</p>
        <span>
          Quando houver continuações, especiais ou adaptações, elas aparecerão
          aqui.
        </span>
      </div>
    );
  }

  return (
    <div
      role="tabpanel"
      aria-label="Relações do anime"
      className="anime-relations-grid"
    >
      {relations.map((relation) => (
        <RelationCard
          key={`${relation.id}-${relation.relationType}`}
          relation={relation}
          titleLanguage={titleLanguage}
        />
      ))}
    </div>
  );
}

function RelationCard({
  relation,
  titleLanguage,
}: {
  relation: AnimeInfo['relations'][number];
  titleLanguage: 'en' | 'jp';
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const title = resolveAnimeTitle(relation.title, titleLanguage);
  const relationLabel = getRelationLabel(relation.relationType, title);
  const image = getAnimeImage(relation);
  const year = relation.releaseDate;
  const format = relation.type?.replaceAll('_', ' ');
  const summary = [format, relation.duration ? `${relation.duration}m` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      to={`/anime/${relation.id}`}
      className="anime-relation-card"
      title={title}
    >
      <span className="anime-relation-poster">
        {image && !imageFailed ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="anime-relation-placeholder">
            <Clapperboard size={28} aria-hidden="true" />
          </span>
        )}
        <span className="anime-relation-poster-shade" aria-hidden="true" />
        <span className="anime-relation-top-badges">
          {relation.rating != null && (
            <span className="anime-relation-rating">
              <Star size={11} fill="currentColor" aria-hidden="true" />
              {relation.rating.toFixed(1)}
            </span>
          )}
          {relation.isAdult && (
            <span className="anime-relation-adult" aria-label="Conteúdo adulto">
              18+
            </span>
          )}
        </span>
        <span className="anime-relation-facts" aria-label="Metadados">
          <span className="anime-relation-fact" title={relationLabel}>
            <Network size={11} aria-hidden="true" />
            <span>{relationLabel}</span>
          </span>
          {year != null && (
            <span className="anime-relation-fact" title={`Ano ${year}`}>
              <CalendarDays size={11} aria-hidden="true" />
              <span>{year}</span>
            </span>
          )}
          {relation.totalEpisodes != null && (
            <span
              className="anime-relation-fact"
              title={`${relation.totalEpisodes} episódios`}
            >
              <ListVideo size={11} aria-hidden="true" />
              <span>{relation.totalEpisodes}</span>
            </span>
          )}
        </span>
      </span>
      <span className="anime-relation-copy">
        <span
          className={`anime-relation-status-dot${relation.status === 'RELEASING' ? ' is-airing' : ''}`}
          aria-hidden="true"
        />
        <span className="anime-relation-title">{title}</span>
        {relation.status && (
          <span className="sr-only">
            Status: {formatStatus(relation.status)}
          </span>
        )}
      </span>
      <span className="anime-relation-summary">
        {summary || formatStatus(relation.status ?? '') || 'Anime'}
      </span>
    </Link>
  );
}

function getRelationLabel(relationType: string, title: string): string {
  const seasonMatch = title.match(
    /(?:season\s+(\d+)(?:\s*part\s+(\d+))?|(?:(\d+)(?:st|nd|rd|th)\s+season)(?:\s*part\s+(\d+))?)/i,
  );
  const season = seasonMatch
    ? `Season ${seasonMatch[1] ?? seasonMatch[3]}${(seasonMatch[2] ?? seasonMatch[4]) ? ` Part ${seasonMatch[2] ?? seasonMatch[4]}` : ''}`
    : null;
  const readableType =
    relationType === 'SEQUEL'
      ? 'Direct Sequel'
      : relationType
          .toLowerCase()
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');

  return season ? `${season} · ${readableType}` : readableType;
}

function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
