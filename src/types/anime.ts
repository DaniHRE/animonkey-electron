export interface AnimeTitle {
  english?: string | null;
  romaji?: string | null;
  native?: string | null;
}

export interface AnimeResult {
  id: string;
  mediaType: 'ANIME';
  isAdult: boolean;
  title: AnimeTitle;
  image?: string;
  banner?: string;
  description?: string;
  genres: string[];
  rating?: number;
  releaseDate?: number;
  type?: string;
  status?: string;
  totalEpisodes?: number;
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
  status?: 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED';
  format?: 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC';
  genre?: string;
}

export interface AnimeCharacter {
  id: number;
  name: string;
  image?: string;
  role: string;
}

export interface AnimeInfo extends AnimeResult {
  duration?: number;
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
