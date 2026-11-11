import { create } from 'zustand';

interface PlaybackSessionState {
  selection: { episodeId: string; serverId: string } | null;
  selectServer: (episodeId: string, serverId: string) => void;
  clearSelection: () => void;
}

export const usePlaybackSessionStore = create<PlaybackSessionState>((set) => ({
  selection: null,
  selectServer: (episodeId, serverId) =>
    set({ selection: { episodeId, serverId } }),
  clearSelection: () => set({ selection: null }),
}));
