export type AnivexaDesktopRequest =
  | { kind: 'episodes'; animeId: string }
  | {
      kind: 'watch';
      provider: string;
      animeId: string;
      audio: 'sub' | 'dub';
      episodeId: string;
    };

export interface AnivexaDesktopResponse {
  status: number;
  body: string;
}

export interface AnivexaBridge {
  request: (
    request: AnivexaDesktopRequest,
    requestId: string,
  ) => Promise<AnivexaDesktopResponse>;
  cancel: (requestId: string) => void;
}
