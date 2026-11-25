export const MAX_VISIBLE_ACTION_TOASTS = 3;

export interface ActionToastQueueState<T extends { id: string }> {
  visible: T[];
  queued: T[];
}

export type ActionToastQueueChange<T extends { id: string }> =
  { type: 'enqueue'; toast: T } | { type: 'dismiss'; id: string };

export function reduceActionToastQueue<T extends { id: string }>(
  state: ActionToastQueueState<T>,
  change: ActionToastQueueChange<T>,
): ActionToastQueueState<T> {
  if (change.type === 'enqueue') {
    const visible = state.visible.filter(
      (toast) => toast.id !== change.toast.id,
    );
    const queued = state.queued.filter((toast) => toast.id !== change.toast.id);
    if (visible.length < MAX_VISIBLE_ACTION_TOASTS)
      return { visible: [change.toast, ...visible], queued };
    return { visible, queued: [...queued, change.toast] };
  }

  const visible = state.visible.filter((toast) => toast.id !== change.id);
  if (visible.length === state.visible.length) return state;
  const queued = [...state.queued];
  while (visible.length < MAX_VISIBLE_ACTION_TOASTS && queued.length > 0) {
    const next = queued.shift();
    if (next) visible.unshift(next);
  }
  return { visible, queued };
}
