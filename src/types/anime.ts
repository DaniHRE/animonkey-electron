export interface AnimeTitle {
  english?: string | null;
  romaji?: string | null;
  native?: string | null;
}

export interface AnimeArtworkBridge {
  getMetadata(
    identities: AnimeArtworkIdentity[],
  ): Promise<AnimeArtworkMetadataResponse>;
}

export interface AnimeArtworkIdentity {
  animeId: string;
  expectedTitles: string[];
}

export interface AnimeTaizenMetadata {
  animeId: string;
  background?: string;
  logo?: string;
}

export interface AnimeArtworkMetadataResponse {
  items: AnimeTaizenMetadata[];
  retryable: boolean;
}

export interface AnimeResult {
  id: string;
  mediaType: 'ANIME';
  isAdult: boolean;
  title: AnimeTitle;
  image?: string;
  banner?: string;
  logo?: string;
  color?: string;
  description?: string;
  genres: string[];
  rating?: number;
  ratingCount?: number;
  releaseDate?: number;
  season?: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
  type?: string;
  status?: string;
  totalEpisodes?: number;
  duration?: number;
  airingAt?: number;
  airingEpisode?: number;
}

export interface AnimeSearchResponse {
  currentPage: number;
  hasNextPage: boolean;
  totalPages: number;
  totalResults: number;
  results: AnimeResult[];
}

export interface AnimeSearchFilters {
  statusIn?: Array<
    'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS'
  >;
  statusNotIn?: AnimeSearchFilters['statusIn'];
  formatIn?: AnimeFormat[];
  formatNotIn?: AnimeFormat[];
  season?: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
  seasonYear?: number;
  startDate?: number;
  startDateLike?: string;
  startDateGreater?: number;
  startDateLesser?: number;
  endDate?: number;
  endDateGreater?: number;
  endDateLesser?: number;
  episodesGreater?: number;
  episodesLesser?: number;
  durationGreater?: number;
  durationLesser?: number;
  averageScoreGreater?: number;
  averageScoreLesser?: number;
  popularityGreater?: number;
  popularityLesser?: number;
  countryOfOrigin?: string;
  countryOfOriginNotIn?: string[];
  source?: AnimeSource;
  isLicensed?: boolean;
  licensedBy?: string;
  licensedByIdIn?: number[];
  genreIn?: string[];
  genreNotIn?: string[];
  tagIn?: string[];
  tagNotIn?: string[];
  tagCategoryIn?: string[];
  tagCategoryNotIn?: string[];
  minimumTagRank?: number;
  idsIn?: number[];
  idsNotIn?: number[];
  idsMalIn?: number[];
  idsMalNotIn?: number[];
  adultMode?: 'include' | 'exclude' | 'only';
  sort?: AnimeMediaSort;
}

export type AnimeFormat =
  'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC';

export type AnimeSource =
  | 'ORIGINAL'
  | 'MANGA'
  | 'LIGHT_NOVEL'
  | 'VISUAL_NOVEL'
  | 'VIDEO_GAME'
  | 'OTHER'
  | 'NOVEL'
  | 'DOUJINSHI'
  | 'ANIME'
  | 'WEB_NOVEL'
  | 'LIVE_ACTION'
  | 'GAME'
  | 'COMIC'
  | 'MULTIMEDIA_PROJECT'
  | 'PICTURE_BOOK';

export type AnimeMediaSort =
  | 'ID'
  | 'ID_DESC'
  | 'TITLE_ROMAJI'
  | 'TITLE_ROMAJI_DESC'
  | 'TITLE_ENGLISH'
  | 'TITLE_ENGLISH_DESC'
  | 'TITLE_NATIVE'
  | 'TITLE_NATIVE_DESC'
  | 'TYPE'
  | 'TYPE_DESC'
  | 'FORMAT'
  | 'FORMAT_DESC'
  | 'START_DATE'
  | 'START_DATE_DESC'
  | 'END_DATE'
  | 'END_DATE_DESC'
  | 'SCORE'
  | 'SCORE_DESC'
  | 'POPULARITY'
  | 'POPULARITY_DESC'
  | 'TRENDING'
  | 'TRENDING_DESC'
  | 'EPISODES'
  | 'EPISODES_DESC'
  | 'DURATION'
  | 'DURATION_DESC'
  | 'STATUS'
  | 'STATUS_DESC'
  | 'UPDATED_AT'
  | 'UPDATED_AT_DESC'
  | 'SEARCH_MATCH'
  | 'FAVOURITES'
  | 'FAVOURITES_DESC';

export interface AnimeSearchTag {
  id: number;
  name: string;
  category: string;
  isAdult: boolean;
}

export interface AnimeSearchOptions {
  genres: string[];
  tags: AnimeSearchTag[];
}

export interface AnimeCharacter {
  id: number;
  name: string;
  image?: string;
  role: string;
  voiceActor?: AnimeVoiceActor;
}

export interface AnimeVoiceActor {
  id: number;
  name: string;
  image?: string;
}

export interface AnimeInfo extends AnimeResult {
  trailer?: { id: string; site: string; thumbnail?: string };
  nextAiringEpisode?: { airingAt: number; episode: number };
  characters: AnimeCharacter[];
  relations: Array<AnimeResult & { relationType: string }>;
  recommendations: AnimeResult[];
}

export interface WatchLaterItem {
  animeId: string;
  title: AnimeTitle;
  image?: string;
  type?: string;
  totalEpisodes?: number;
  genres: string[];
  releaseDate?: number;
  addedAt: number;
}

export interface AnimeRating {
  animeId: string;
  score: number;
  review: string | null;
  updatedAt: number;
}
