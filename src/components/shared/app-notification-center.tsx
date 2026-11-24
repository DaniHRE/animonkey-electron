import {
  Bell,
  CheckCheck,
  Download,
  Film,
  Flame,
  Radio,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  APP_NOTIFICATIONS_CHANGED_EVENT,
  APP_NOTIFICATION_CENTER_OPEN_EVENT,
  APP_UPDATE_CENTER_OPEN_EVENT,
  type AppNotification,
} from '@/lib/app-notifications';
import {
  dismissAppNotification,
  getAppNotifications,
  markAllAppNotificationsRead,
  markAppNotificationRead,
} from '@/services/cache/local-db';
import './app-notification-center.css';

const APP_NOTIFICATIONS_QUERY_KEY = ['app-notifications'] as const;
const EMPTY_APP_NOTIFICATIONS: AppNotification[] = [];

function formatCreatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

export function AppNotificationCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: APP_NOTIFICATIONS_QUERY_KEY,
    queryFn: getAppNotifications,
  });
  const notifications = notificationsQuery.data ?? EMPTY_APP_NOTIFICATIONS;
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: APP_NOTIFICATIONS_QUERY_KEY,
    });
  }, [queryClient]);

  useEffect(() => {
    void refresh();
    window.addEventListener(APP_NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () =>
      window.removeEventListener(APP_NOTIFICATIONS_CHANGED_EVENT, refresh);
  }, [refresh]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const unreadCount = useMemo(
    () =>
      notifications.filter((notification) => notification.readAt === null)
        .length,
    [notifications],
  );
  const errorMessage =
    error ??
    (notificationsQuery.isError
      ? 'Não foi possível carregar as notificações locais.'
      : null);

  const markAllRead = async () => {
    setError(null);
    try {
      await markAllAppNotificationsRead();
      await refresh();
      setError(null);
    } catch {
      setError('Não foi possível marcar as notificações como lidas.');
    }
  };

  const openNotification = async (notification: AppNotification) => {
    setError(null);
    try {
      await markAppNotificationRead(notification.id);
      await refresh();
      setError(null);
      setIsOpen(false);
      if (notification.kind === 'episode-ready' && notification.animeId) {
        void navigate({
          to: '/anime/$id',
          params: { id: notification.animeId },
        });
        return;
      }
      if (notification.kind === 'remote') {
        if (notification.action === 'anime' && notification.animeId) {
          void navigate({
            to: '/anime/$id',
            params: { id: notification.animeId },
          });
        }
        return;
      }
      window.dispatchEvent(new Event(APP_UPDATE_CENTER_OPEN_EVENT));
    } catch {
      setError('Não foi possível abrir esta notificação.');
    }
  };

  const dismissNotification = async (notification: AppNotification) => {
    setError(null);
    try {
      await dismissAppNotification(notification.id);
      await refresh();
      setError(null);
    } catch {
      setError('Não foi possível dispensar esta notificação.');
    }
  };

  const openCenter = () => {
    setError(null);
    setIsOpen(true);
    window.dispatchEvent(new Event(APP_NOTIFICATION_CENTER_OPEN_EVENT));
    void refresh();
  };

  return (
    <div className="app-notification-center">
      <button
        ref={triggerRef}
        type="button"
        className="app-notification-center__trigger"
        aria-label={
          unreadCount > 0
            ? `Notificações. ${unreadCount} não lidas.`
            : 'Notificações'
        }
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="Notificações"
        onClick={openCenter}
      >
        <Bell size={18} strokeWidth={1.9} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="app-notification-center__badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <dialog
        ref={dialogRef}
        className="app-notification-dialog"
        aria-labelledby="app-notification-dialog-title"
        onClose={() => setIsOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          setIsOpen(false);
          triggerRef.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setIsOpen(false);
        }}
      >
        <div className="app-notification-dialog__surface">
          <div className="app-notification-dialog__topline">
            <span
              className="app-notification-dialog__brand-mark"
              aria-hidden="true"
            >
              <Bell size={19} strokeWidth={1.8} />
            </span>
            <span className="app-notification-dialog__eyebrow">
              CENTRAL DE NOTIFICAÇÕES
            </span>
            <button
              type="button"
              className="app-notification-dialog__close"
              aria-label="Fechar notificações"
              onClick={() => {
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <section className="app-notification-dialog__content">
            <div className="app-notification-dialog__heading">
              <div>
                <h2 id="app-notification-dialog-title">
                  Notificações recentes
                </h2>
                <p>
                  Avisos de sistema, provedores, animes e eventos locais. O
                  histórico fica disponível offline por até 30 dias, limitado a
                  100 itens.
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="app-notification-dialog__mark-all"
                  onClick={() => void markAllRead()}
                >
                  <CheckCheck size={15} aria-hidden="true" />
                  Marcar tudo como lido
                </button>
              )}
            </div>

            {errorMessage && (
              <p role="alert" className="app-notification-dialog__error">
                {errorMessage}
              </p>
            )}
            {notificationsQuery.isPending ? (
              <p className="app-notification-dialog__empty" role="status">
                Carregando notificações…
              </p>
            ) : notificationsQuery.isError ? null : notifications.length ===
              0 ? (
              <p className="app-notification-dialog__empty">
                Nenhuma notificação recente.
              </p>
            ) : (
              <ul className="app-notification-dialog__list">
                {notifications.map((notification) => {
                  const isEpisode = notification.kind === 'episode-ready';
                  const isRemote = notification.kind === 'remote';
                  const hasAnimeAction =
                    notification.kind === 'remote' &&
                    notification.action === 'anime';
                  const Icon = isRemote
                    ? notification.category === 'maintenance'
                      ? Wrench
                      : notification.category === 'provider_health'
                        ? Radio
                        : notification.category === 'moderation'
                          ? ShieldAlert
                          : notification.category === 'new_anime'
                            ? Sparkles
                            : notification.category === 'spotlight'
                              ? Film
                              : Flame
                    : isEpisode
                      ? Film
                      : Download;
                  const categoryLabel = isRemote
                    ? {
                        maintenance: 'Sistema',
                        provider_health: 'Provedor',
                        moderation: 'Política',
                        new_anime: 'Novo anime',
                        spotlight: 'Destaque',
                        trending: 'Em alta',
                      }[notification.category]
                    : null;
                  return (
                    <li
                      key={notification.id}
                      className="app-notification-dialog__item"
                      data-unread={notification.readAt === null}
                    >
                      <span
                        className="app-notification-dialog__item-icon"
                        aria-hidden="true"
                      >
                        <Icon size={17} strokeWidth={1.8} />
                      </span>
                      <div className="app-notification-dialog__item-content">
                        <div className="app-notification-dialog__item-heading">
                          <h3>{notification.title}</h3>
                          <time
                            dateTime={new Date(
                              notification.createdAt,
                            ).toISOString()}
                          >
                            {formatCreatedAt(notification.createdAt)}
                          </time>
                        </div>
                        {isRemote && (
                          <div className="app-notification-dialog__labels">
                            <span>{categoryLabel}</span>
                            <span
                              data-severity={notification.severity}
                              className="app-notification-dialog__severity"
                            >
                              {notification.severity === 'critical'
                                ? 'Crítico'
                                : notification.severity === 'warning'
                                  ? 'Atenção'
                                  : 'Informativo'}
                            </span>
                          </div>
                        )}
                        <p>{notification.message}</p>
                        {(!isRemote || hasAnimeAction) && (
                          <button
                            type="button"
                            className="app-notification-dialog__action"
                            onClick={() => void openNotification(notification)}
                          >
                            {isEpisode || hasAnimeAction
                              ? 'Abrir anime'
                              : 'Abrir atualizações'}
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        className="app-notification-dialog__dismiss"
                        aria-label={`Dispensar: ${notification.title}`}
                        title="Dispensar notificação"
                        onClick={() => void dismissNotification(notification)}
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </dialog>
    </div>
  );
}
