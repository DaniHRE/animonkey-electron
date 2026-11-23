export interface WindowControlsState {
  isMaximized: boolean;
}

export interface WindowControlsBridge {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  getState: () => Promise<WindowControlsState>;
  onStateChanged: (
    callback: (state: WindowControlsState) => void,
  ) => () => void;
}

export function isWindowControlsState(
  value: unknown,
): value is WindowControlsState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return typeof (value as Record<string, unknown>).isMaximized === 'boolean';
}
