export interface NewEpisodeNotificationInput {
  animeId: string;
  title: string;
  episode: number;
}

export interface DesktopNotificationsBridge {
  isSupported(): Promise<boolean>;
  showNewEpisode(input: NewEpisodeNotificationInput): Promise<boolean>;
}
