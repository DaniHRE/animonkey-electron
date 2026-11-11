import type { EpisodeProgressRecord } from '@/services/cache/local-db';
import type { AnimeRating, AnimeTitle, WatchLaterItem } from '@/types/anime';

export interface AccountUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export interface AccountSession {
  user: AccountUser;
  expiresAt: string;
}

export interface AccountCredentials {
  email: string;
  password: string;
}

export interface AccountRegistration extends AccountCredentials {
  name?: string;
}

export type WatchLaterRemoteItem = WatchLaterItem & {
  title: AnimeTitle;
};

export type EpisodeProgressInput = Pick<
  EpisodeProgressRecord,
  'animeId' | 'episodeId' | 'episodeNumber' | 'currentTime' | 'duration'
>;

export interface RemoteSyncTombstone {
  recordKey: string;
  deletedAt: number;
}

export interface WatchLaterSyncSnapshot {
  items: WatchLaterRemoteItem[];
  tombstones: RemoteSyncTombstone[];
}

export interface EpisodeProgressSyncSnapshot {
  records: EpisodeProgressRecord[];
  tombstones: RemoteSyncTombstone[];
}

export interface AnimeRatingsSyncSnapshot {
  ratings: AnimeRating[];
  tombstones: RemoteSyncTombstone[];
}

export interface AccountBridge {
  register(input: AccountRegistration): Promise<AccountSession>;
  login(input: AccountCredentials): Promise<AccountSession>;
  logout(): Promise<void>;
  getSession(): Promise<AccountSession | null>;
  listWatchLater(): Promise<WatchLaterSyncSnapshot>;
  upsertWatchLater(item: WatchLaterRemoteItem): Promise<void>;
  removeWatchLater(animeId: string, deletedAt: number): Promise<void>;
  listEpisodeProgress(): Promise<EpisodeProgressSyncSnapshot>;
  upsertEpisodeProgress(
    input: EpisodeProgressInput,
  ): Promise<EpisodeProgressRecord>;
  removeEpisodeProgressForAnime(
    animeId: string,
    deletedAt: number,
  ): Promise<void>;
  listAnimeRatings(): Promise<AnimeRatingsSyncSnapshot>;
  upsertAnimeRating(rating: AnimeRating): Promise<AnimeRating>;
  removeAnimeRating(animeId: string, deletedAt: number): Promise<void>;
}
