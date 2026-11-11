import type { EpisodeProgressRecord } from '@/services/cache/local-db';
import type { AnimeTitle, WatchLaterItem } from '@/types/anime';

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

export interface AccountBridge {
  register(input: AccountRegistration): Promise<AccountSession>;
  login(input: AccountCredentials): Promise<AccountSession>;
  logout(): Promise<void>;
  getSession(): Promise<AccountSession | null>;
  listWatchLater(): Promise<WatchLaterRemoteItem[]>;
  upsertWatchLater(item: WatchLaterRemoteItem): Promise<void>;
  removeWatchLater(animeId: string): Promise<void>;
  listEpisodeProgress(): Promise<EpisodeProgressRecord[]>;
  upsertEpisodeProgress(
    input: EpisodeProgressInput,
  ): Promise<EpisodeProgressRecord>;
  removeEpisodeProgressForAnime(animeId: string): Promise<void>;
}
