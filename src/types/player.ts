export interface AnimeEpisode {
  id: string;
  number: number;
  title?: string;
  description?: string;
  image?: string;
  isSubbed: boolean;
  isDubbed: boolean;
}

export interface EpisodeTimestamp {
  start: number;
  end: number;
}

export interface EpisodeServer {
  id: string;
  provider: string;
  serverName: string;
  subtitleLanguages: Array<'pt-BR' | 'en'>;
  subtitlePresentation?: 'tracks' | 'embedded';
  subtitleType?: 'softsub' | 'hardsub' | 'unknown';
}

export interface EpisodeSubtitle {
  kind: 'captions' | 'thumbnails';
  url: string;
  lang?: string;
  format?: 'ass' | 'ssa';
}

export interface EpisodeSources {
  headers: Record<string, string>;
  sourceUrl?: string;
  format?: 'hls' | 'dash' | 'mp4' | 'embed';
  subtitles: EpisodeSubtitle[];
  embedUrl?: string;
  subtitleType?: 'softsub' | 'hardsub' | 'unknown';
  playlistKey?: string;
  intro?: EpisodeTimestamp;
  outro?: EpisodeTimestamp;
}
