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

export type FeedbackSubmissionType = 'suggestion' | 'bug_report';

export type FeedbackFunctionalArea =
  | 'discovery'
  | 'catalog'
  | 'player'
  | 'library'
  | 'account'
  | 'notifications'
  | 'interface'
  | 'other';

export interface FeedbackSubmissionInput {
  type: FeedbackSubmissionType;
  area: FeedbackFunctionalArea;
  title: string;
  description: string;
  consentVersion: 'feedback-v1';
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

export interface AccountDataExport {
  exportedAt: string;
  user: AccountUser & { displayName: string | null; showActivity: boolean };
  watchLater: Record<string, unknown>[];
  episodeProgress: Record<string, unknown>[];
  ratings: Record<string, unknown>[];
  activity: Record<string, unknown>[];
  feedback: Record<string, unknown>[];
}

export type ActivityType =
  'started_watching' | 'episode_completed' | 'rated_anime';

export interface ActivityFeedItem {
  id: string;
  userId: string;
  type: ActivityType;
  animeId: string;
  payload: { score?: number; episode_number?: number };
  createdAt: number;
  actor: { id: string; name: string | null; image: string | null };
}

export interface ActivityFeedPage {
  items: ActivityFeedItem[];
  nextCursor: ActivityFeedCursor | null;
}

export interface ActivityFeedCursor {
  createdAt: string;
  id: string;
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
  updateProfile(name: string): Promise<AccountUser>;
  exportAccountData(): Promise<AccountDataExport>;
  uploadAvatar(contentType: string, base64: string): Promise<AccountUser>;
  removeAvatar(): Promise<AccountUser>;
  getActivityPrivacy(): Promise<boolean>;
  setActivityPrivacy(showActivity: boolean): Promise<void>;
  listActivity(
    cursor: ActivityFeedCursor | null,
    limit: number,
  ): Promise<ActivityFeedPage>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  submitFeedback(input: FeedbackSubmissionInput): Promise<void>;
}
