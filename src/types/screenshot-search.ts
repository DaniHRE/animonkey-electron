export type ScreenshotImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ScreenshotSearchInput {
  contentType: ScreenshotImageType;
  bytes: Uint8Array;
}

export interface ScreenshotSearchMatch {
  animeId: string;
  episode: string | null;
  startTime: number;
  endTime: number;
  similarity: number;
}

export interface ScreenshotSearchBridge {
  search(
    input: ScreenshotSearchInput,
    requestId: string,
  ): Promise<ScreenshotSearchMatch[]>;
  cancel(requestId: string): void;
}
