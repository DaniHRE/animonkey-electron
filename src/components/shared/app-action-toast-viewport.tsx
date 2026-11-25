import {
  forwardRef,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  APP_ACTION_FEEDBACK_EVENT,
  APP_NOTIFICATION_CENTER_OPEN_EVENT,
} from '@/lib/app-notifications';
import type { ActionFeedbackToast } from '@/lib/action-feedback';
import {
  reduceActionToastQueue,
  type ActionToastQueueState,
} from '@/lib/action-toast-queue.mts';
import './app-action-toast-viewport.css';

const toneIcons = {
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
} as const;

const INITIAL_TOAST_STATE: ActionToastQueueState<ActionFeedbackToast> = {
  visible: [],
  queued: [],
};

function isActionFeedbackToast(value: unknown): value is ActionFeedbackToast {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    record.id.length > 0 &&
    record.id.length <= 160 &&
    ['success', 'error', 'warning', 'info'].includes(String(record.tone)) &&
    typeof record.title === 'string' &&
    record.title.length > 0 &&
    record.title.length <= 120 &&
    typeof record.message === 'string' &&
    record.message.length > 0 &&
    record.message.length <= 300
  );
}

const ActionToast = forwardRef<
  HTMLLIElement,
  {
    toast: ActionFeedbackToast;
    onDismiss: (id: string) => void;
  }
>(function ActionToast({ toast, onDismiss }, ref) {
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const Icon = toneIcons[toast.tone];
  const duration =
    toast.tone === 'error' || toast.tone === 'warning' ? 9000 : 6000;
  const remainingDuration = useRef(duration);
  const paused = pointerInside || focusInside;

  useEffect(() => {
    if (paused) return;
    const startedAt = performance.now();
    const timeout = window.setTimeout(() => {
      remainingDuration.current = 0;
      onDismiss(toast.id);
    }, remainingDuration.current);
    return () => {
      window.clearTimeout(timeout);
      if (remainingDuration.current > 0)
        remainingDuration.current = Math.max(
          0,
          remainingDuration.current - (performance.now() - startedAt),
        );
    };
  }, [duration, onDismiss, paused, toast.id]);

  return (
    <motion.li
      ref={ref}
      layout="position"
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ type: 'spring', visualDuration: 0.28, bounce: 0.12 }}
      className="app-action-toast"
      data-tone={toast.tone}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      onPointerEnter={() => setPointerInside(true)}
      onPointerLeave={() => setPointerInside(false)}
      onFocusCapture={() => setFocusInside(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (
          !(nextTarget instanceof Node) ||
          !event.currentTarget.contains(nextTarget)
        )
          setFocusInside(false);
      }}
    >
      <span className="app-action-toast__icon" aria-hidden="true">
        <Icon size={18} strokeWidth={2} />
      </span>
      <div className="app-action-toast__content">
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
        <button
          type="button"
          className="app-action-toast__history"
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent(APP_NOTIFICATION_CENTER_OPEN_EVENT, {
                detail: { section: 'actions' },
              }),
            );
            onDismiss(toast.id);
          }}
        >
          Ver no histórico
        </button>
      </div>
      <button
        type="button"
        className="app-action-toast__dismiss"
        aria-label={`Fechar aviso: ${toast.title}`}
        onClick={() => onDismiss(toast.id)}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </motion.li>
  );
});

export function AppActionToastViewport() {
  const [toasts, dispatch] = useReducer(
    reduceActionToastQueue<ActionFeedbackToast>,
    INITIAL_TOAST_STATE,
  );

  useEffect(() => {
    const onActionFeedback = (event: Event) => {
      if (
        !(event instanceof CustomEvent) ||
        !isActionFeedbackToast(event.detail)
      )
        return;
      const toast = event.detail;
      dispatch({ type: 'enqueue', toast });
    };
    window.addEventListener(APP_ACTION_FEEDBACK_EVENT, onActionFeedback);
    return () =>
      window.removeEventListener(APP_ACTION_FEEDBACK_EVENT, onActionFeedback);
  }, []);

  const dismiss = useCallback(
    (id: string) => dispatch({ type: 'dismiss', id }),
    [],
  );

  return (
    <div className="app-action-toast-viewport" aria-label="Feedback das ações">
      <motion.ol layout className="app-action-toast-viewport__list">
        <AnimatePresence initial={false} mode="popLayout">
          {[...toasts.visible].reverse().map((toast) => (
            <ActionToast key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </motion.ol>
    </div>
  );
}
