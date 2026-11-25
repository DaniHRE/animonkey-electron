import {
  APP_ACTION_FEEDBACK_EVENT,
  isAniListCoverUrl,
  type ActionFeedbackTone,
} from '@/lib/app-notifications';
import { addAppNotification } from '@/services/cache/local-db';

export interface ActionFeedbackInput {
  tone: ActionFeedbackTone;
  title: string;
  message: string;
  animeId?: string;
  posterUrl?: string;
}

export interface ActionFeedbackToast extends ActionFeedbackInput {
  id: string;
}

function makeToast(input: ActionFeedbackInput): ActionFeedbackToast | null {
  const tones: ActionFeedbackTone[] = ['success', 'error', 'warning', 'info'];
  if (!tones.includes(input.tone)) return null;
  const title =
    typeof input.title === 'string' ? input.title.trim().slice(0, 120) : '';
  const message =
    typeof input.message === 'string' ? input.message.trim().slice(0, 300) : '';
  if (!title || !message) return null;
  const animeId =
    typeof input.animeId === 'string' && /^[1-9]\d{0,9}$/.test(input.animeId)
      ? input.animeId
      : undefined;
  const posterUrl =
    animeId && isAniListCoverUrl(input.posterUrl) ? input.posterUrl : undefined;

  return {
    id: `action-feedback:${crypto.randomUUID()}`,
    tone: input.tone,
    title,
    message,
    ...(animeId ? { animeId } : {}),
    ...(posterUrl ? { posterUrl } : {}),
  };
}

function dispatchToast(toast: ActionFeedbackToast): void {
  window.dispatchEvent(
    new CustomEvent<ActionFeedbackToast>(APP_ACTION_FEEDBACK_EVENT, {
      detail: toast,
    }),
  );
}

export function notifyActionFeedback(input: ActionFeedbackInput): void {
  const toast = makeToast(input);
  if (!toast) return;

  dispatchToast(toast);
  void addAppNotification({
    id: toast.id,
    kind: 'action-feedback',
    tone: toast.tone,
    title: toast.title,
    message: toast.message,
    ...(toast.animeId ? { animeId: toast.animeId } : {}),
    ...(toast.posterUrl ? { posterUrl: toast.posterUrl } : {}),
  }).catch(() => {
    dispatchToast({
      id: `action-feedback:${crypto.randomUUID()}`,
      tone: 'warning',
      title: 'Histórico indisponível',
      message:
        'A ação foi concluída, mas não foi possível salvá-la no histórico de notificações.',
    });
  });
}
