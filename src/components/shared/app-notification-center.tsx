import {
  Bell,
  Check,
  CircleAlert,
  CircleCheck,
  Download,
  Film,
  Flame,
  Info,
  Radio,
  ShieldAlert,
  Sparkles,
  Trash2,
  TriangleAlert,
  Wrench,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  APP_NOTIFICATIONS_CHANGED_EVENT,
  APP_NOTIFICATION_CENTER_OPEN_EVENT,
  APP_UPDATE_CENTER_OPEN_EVENT,
  isAniListCoverUrl,
  type AppNotification,
  type RemoteAppNotification,
} from '@/lib/app-notifications';
import { resolveAnimeTitle } from '@/lib/anime';
import { useAdultContentPreference } from '@/hooks/use-adult-content-preference';
import { useTitleLanguage } from '@/hooks/use-title-language';
import { animeQueries } from '@/services/anime-queries';
import {
  deleteAppNotification,
  dismissAppNotification,
  getAppNotifications,
  markAllAppNotificationsRead,
  markAppNotificationRead,
} from '@/services/cache/local-db';
import { formatRelativeTime } from '@/lib/relative-time.mts';
import './app-notification-center.css';

const APP_NOTIFICATIONS_QUERY_KEY = ['app-notifications'] as const;
const EMPTY_APP_NOTIFICATIONS: AppNotification[] = [];
type NotificationSection = 'all' | 'actions' | 'system' | 'anime' | 'updates';

const sections: Array<{ id: NotificationSection; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'actions', label: 'Ações' },
  { id: 'system', label: 'Sistema' },
  { id: 'anime', label: 'Animes' },
  { id: 'updates', label: 'Atualizações' },
];

const emptyStates: Record<
  NotificationSection,
  { title: string; message: string }
> = {
  all: {
    title: 'Tudo em dia',
    message: 'As próximas notificações vão aparecer aqui.',
  },
  actions: {
    title: 'Nenhuma ação recente',
    message: 'Os resultados das suas ações ficam salvos nesta categoria.',
  },
  system: {
    title: 'Sem avisos do sistema',
    message: 'Avisos importantes do aplicativo aparecem aqui.',
  },
  anime: {
    title: 'Sem novidades de anime',
    message: 'Novos episódios e destaques aparecem nesta categoria.',
  },
  updates: {
    title: 'Sem atualizações',
    message: 'Você verá aqui quando houver novidades do aplicativo.',
  },
};

function getSection(
  notification: AppNotification,
): Exclude<NotificationSection, 'all'> {
  if (notification.kind === 'action-feedback') return 'actions';
  if (notification.kind === 'episode-ready') return 'anime';
  if (notification.kind === 'remote') {
    if (
      notification.category === 'maintenance' ||
      notification.category === 'provider_health' ||
      notification.category === 'moderation'
    )
      return 'system';
    return 'anime';
  }
  return 'updates';
}

function matchesSection(
  notification: AppNotification,
  section: NotificationSection,
): boolean {
  if (section === 'all') return true;
  if (section === 'anime' && notification.kind === 'action-feedback')
    return notification.animeId !== undefined;
  return getSection(notification) === section;
}

function formatCreatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function getRemoteIcon(notification: RemoteAppNotification) {
  switch (notification.category) {
    case 'maintenance':
      return Wrench;
    case 'provider_health':
      return Radio;
    case 'moderation':
      return ShieldAlert;
    case 'new_anime':
      return Sparkles;
    case 'spotlight':
      return Film;
    case 'trending':
      return Flame;
  }
}

function getCategoryLabel(notification: AppNotification): string {
  if (notification.kind === 'action-feedback') {
    return {
      success: 'Concluída',
      error: 'Falhou',
      warning: 'Atenção',
      info: 'Informação',
    }[notification.tone];
  }
  if (notification.kind === 'episode-ready') return 'Novo episódio';
  if (notification.kind !== 'remote')
    return notification.kind === 'update-ready'
      ? 'Atualização disponível'
      : 'Atualização instalada';
  return {
    maintenance: 'Manutenção',
    provider_health: 'Provedores',
    moderation: 'Moderação',
    new_anime: 'Novo anime',
    spotlight: 'Acompanhar',
    trending: 'Em alta',
  }[notification.category];
}

function getIcon(notification: AppNotification) {
  if (notification.kind === 'action-feedback')
    return {
      success: CircleCheck,
      error: CircleAlert,
      warning: TriangleAlert,
      info: Info,
    }[notification.tone];
  if (notification.kind === 'episode-ready') return Film;
  if (notification.kind === 'remote') return getRemoteIcon(notification);
  return Download;
}

function canOpen(notification: AppNotification): boolean {
  return (
    notification.kind === 'episode-ready' ||
    notification.kind === 'update-ready' ||
    notification.kind === 'update-installed' ||
    (notification.kind === 'remote' && notification.action === 'anime')
  );
}

function isSection(
  value: unknown,
): value is Exclude<NotificationSection, 'all'> {
  return (
    value === 'actions' ||
    value === 'system' ||
    value === 'anime' ||
    value === 'updates'
  );
}

export function AppNotificationCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { includeAdult } = useAdultContentPreference();
  const { titleLanguage } = useTitleLanguage();
  const notificationsQuery = useQuery({
    queryKey: APP_NOTIFICATIONS_QUERY_KEY,
    queryFn: getAppNotifications,
  });
  const notifications = notificationsQuery.data ?? EMPTY_APP_NOTIFICATIONS;
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [activeSection, setActiveSection] =
    useState<NotificationSection>('all');
  const [error, setError] = useState<string | null>(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const centerRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const markingAllReadRef = useRef(false);
  const restoreTriggerFocus = useRef(false);

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
    const onOpenCenter = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      const requestedSection =
        typeof detail === 'object' && detail !== null
          ? (detail as Record<string, unknown>).section
          : null;
      if (isSection(requestedSection)) setActiveSection(requestedSection);
      setError(null);
      setCurrentTime(Date.now());
      setIsOpen(true);
      void refresh();
    };
    window.addEventListener(APP_NOTIFICATION_CENTER_OPEN_EVENT, onOpenCenter);
    return () =>
      window.removeEventListener(
        APP_NOTIFICATION_CENTER_OPEN_EVENT,
        onOpenCenter,
      );
  }, [refresh]);

  useEffect(() => {
    if (!isOpen) {
      if (restoreTriggerFocus.current) triggerRef.current?.focus();
      restoreTriggerFocus.current = false;
      return;
    }
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        centerRef.current &&
        !centerRef.current.contains(event.target)
      )
        setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      restoreTriggerFocus.current = true;
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const unreadCount = useMemo(
    () =>
      notifications.filter((notification) => notification.readAt === null)
        .length,
    [notifications],
  );
  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) =>
        matchesSection(notification, activeSection),
      ),
    [activeSection, notifications],
  );
  const animeIdsNeedingArtwork = useMemo(() => {
    const ids = filteredNotifications.flatMap((notification) => {
      if (notification.kind === 'action-feedback' && notification.animeId)
        return [notification.animeId];
      if (
        notification.kind === 'episode-ready' &&
        notification.animeId &&
        !isAniListCoverUrl(notification.posterUrl)
      )
        return [notification.animeId];
      if (notification.kind === 'remote' && notification.animeId)
        return [notification.animeId];
      return [];
    });
    return [...new Set(ids)].slice(0, 50).sort();
  }, [filteredNotifications]);
  const animeArtworkQuery = useQuery({
    ...animeQueries.airingEpisodes(animeIdsNeedingArtwork, includeAdult),
    enabled: isOpen && animeIdsNeedingArtwork.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const animeArtworkById = useMemo(
    () =>
      new Map(
        (animeArtworkQuery.data ?? []).map((anime) => [
          anime.id,
          {
            title: resolveAnimeTitle(anime.title, titleLanguage),
            image: anime.image,
          },
        ]),
      ),
    [animeArtworkQuery.data, titleLanguage],
  );
  const errorMessage =
    error ??
    (notificationsQuery.isError
      ? 'Não foi possível carregar as notificações locais.'
      : null);

  useEffect(() => {
    if (!isOpen) return;
    const interval = window.setInterval(
      () => setCurrentTime(Date.now()),
      60_000,
    );
    return () => window.clearInterval(interval);
  }, [isOpen]);

  const markAllRead = async () => {
    if (markingAllReadRef.current) return;
    markingAllReadRef.current = true;
    setIsMarkingAllRead(true);
    setError(null);
    try {
      await markAllAppNotificationsRead();
      await refresh();
    } catch {
      setError('Não foi possível marcar as notificações como lidas.');
    } finally {
      markingAllReadRef.current = false;
      setIsMarkingAllRead(false);
    }
  };

  const openNotification = async (notification: AppNotification) => {
    setError(null);
    try {
      await markAppNotificationRead(notification.id);
      await refresh();
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
      if (notification.kind === 'action-feedback')
        await deleteAppNotification(notification.id);
      else await dismissAppNotification(notification.id);
      await refresh();
    } catch {
      setError('Não foi possível remover esta notificação.');
    }
  };

  const toggleCenter = () => {
    setError(null);
    if (isOpen) {
      restoreTriggerFocus.current = true;
      setIsOpen(false);
      return;
    }
    setCurrentTime(Date.now());
    setIsOpen(true);
    void refresh();
  };

  return (
    <div className="app-notification-center" ref={centerRef}>
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
        aria-controls="app-notification-panel"
        title="Notificações"
        onClick={toggleCenter}
      >
        <Bell size={18} strokeWidth={1.9} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="app-notification-center__badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id="app-notification-panel"
            key="notification-panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby="app-notification-panel-title"
            className="app-notification-panel"
            initial={{ opacity: 0, y: -5, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="app-notification-panel__topline">
              <span
                className="app-notification-panel__brand-mark"
                aria-hidden="true"
              >
                <Bell size={19} strokeWidth={1.8} />
              </span>
              <div className="app-notification-panel__brand-copy">
                <h2 id="app-notification-panel-title">Notificações</h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="app-notification-panel__close"
                aria-label="Fechar notificações"
                onClick={() => {
                  restoreTriggerFocus.current = true;
                  setIsOpen(false);
                }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <section className="app-notification-panel__content">
              <div
                className="app-notification-panel__filters"
                role="group"
                aria-label="Filtrar notificações"
              >
                {sections.map(({ id, label }) => {
                  const count =
                    id === 'all'
                      ? notifications.length
                      : notifications.filter((notification) =>
                          matchesSection(notification, id),
                        ).length;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={activeSection === id}
                      className="app-notification-panel__filter"
                      data-active={activeSection === id}
                      onClick={() => setActiveSection(id)}
                    >
                      {label}
                      <span>{count}</span>
                    </button>
                  );
                })}
              </div>

              {unreadCount > 0 && (
                <div className="app-notification-panel__mark-all-row">
                  <button
                    type="button"
                    className="app-notification-panel__mark-all"
                    disabled={isMarkingAllRead}
                    aria-busy={isMarkingAllRead}
                    onClick={() => void markAllRead()}
                  >
                    {isMarkingAllRead ? 'Marcando…' : 'Marcar tudo como lido'}
                  </button>
                </div>
              )}

              {errorMessage && (
                <p role="alert" className="app-notification-panel__error">
                  {errorMessage}
                </p>
              )}
              {notificationsQuery.isPending ? (
                <p className="app-notification-panel__empty" role="status">
                  Carregando notificações…
                </p>
              ) : notificationsQuery.isError ? null : filteredNotifications.length ===
                0 ? (
                <div className="app-notification-panel__empty" role="status">
                  <Bell size={34} strokeWidth={1.5} aria-hidden="true" />
                  <strong>{emptyStates[activeSection].title}</strong>
                  <p>{emptyStates[activeSection].message}</p>
                </div>
              ) : (
                <ul className="app-notification-panel__list">
                  {filteredNotifications.map((notification) => {
                    const Icon = getIcon(notification);
                    const animeId =
                      notification.kind === 'episode-ready' ||
                      notification.kind === 'remote' ||
                      notification.kind === 'action-feedback'
                        ? notification.animeId
                        : undefined;
                    const animeArtwork = animeId
                      ? animeArtworkById.get(animeId)
                      : undefined;
                    const posterUrl =
                      (notification.kind === 'episode-ready' ||
                        notification.kind === 'action-feedback') &&
                      isAniListCoverUrl(notification.posterUrl)
                        ? notification.posterUrl
                        : isAniListCoverUrl(animeArtwork?.image)
                          ? animeArtwork.image
                          : undefined;
                    const animeTitle =
                      (notification.kind === 'remote' ||
                        notification.kind === 'action-feedback') &&
                      animeArtwork?.title
                        ? animeArtwork.title
                        : undefined;
                    const notificationTitle = animeTitle ?? notification.title;
                    const notificationMessage =
                      animeTitle && notification.title !== animeTitle
                        ? `${notification.title} · ${notification.message}`
                        : notification.message;
                    const hasAnimeAction =
                      notification.kind === 'remote' &&
                      notification.action === 'anime';
                    const actionFeedback =
                      notification.kind === 'action-feedback';
                    const remote = notification.kind === 'remote';
                    return (
                      <li
                        key={notification.id}
                        className="app-notification-panel__item"
                        data-unread={notification.readAt === null}
                        data-tone={
                          actionFeedback ? notification.tone : undefined
                        }
                      >
                        {posterUrl ? (
                          <span
                            className="app-notification-panel__poster"
                            aria-hidden="true"
                          >
                            <Film size={18} strokeWidth={1.7} />
                            <img
                              src={posterUrl}
                              alt=""
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(event) => {
                                event.currentTarget.hidden = true;
                              }}
                            />
                          </span>
                        ) : (
                          <span
                            className="app-notification-panel__item-icon"
                            aria-hidden="true"
                          >
                            <Icon size={17} strokeWidth={1.8} />
                          </span>
                        )}
                        <div className="app-notification-panel__item-content">
                          <div className="app-notification-panel__item-heading">
                            <h3>{notificationTitle}</h3>
                            <time
                              dateTime={new Date(
                                notification.createdAt,
                              ).toISOString()}
                              title={`Recebida em ${formatCreatedAt(notification.createdAt)}`}
                            >
                              {formatRelativeTime(
                                notification.createdAt,
                                currentTime,
                              )}
                            </time>
                          </div>
                          <div className="app-notification-panel__labels">
                            <span>{getCategoryLabel(notification)}</span>
                            {remote && (
                              <span
                                data-severity={notification.severity}
                                className="app-notification-panel__severity"
                              >
                                {notification.severity === 'critical'
                                  ? 'Crítico'
                                  : notification.severity === 'warning'
                                    ? 'Atenção'
                                    : 'Informativo'}
                              </span>
                            )}
                          </div>
                          <p>{notificationMessage}</p>
                          {(notification.kind === 'episode-ready' ||
                            hasAnimeAction) && (
                            <button
                              type="button"
                              className="app-notification-panel__action"
                              onClick={() =>
                                void openNotification(notification)
                              }
                            >
                              Abrir anime
                            </button>
                          )}
                          {(notification.kind === 'update-ready' ||
                            notification.kind === 'update-installed') && (
                            <button
                              type="button"
                              className="app-notification-panel__action"
                              onClick={() =>
                                void openNotification(notification)
                              }
                            >
                              Abrir atualizações
                            </button>
                          )}
                          {!canOpen(notification) &&
                            notification.readAt === null && (
                              <button
                                type="button"
                                className="app-notification-panel__action"
                                onClick={() => {
                                  void markAppNotificationRead(notification.id)
                                    .then(refresh)
                                    .catch(() =>
                                      setError(
                                        'Não foi possível marcar esta notificação como lida.',
                                      ),
                                    );
                                }}
                              >
                                <Check size={13} aria-hidden="true" />
                                Marcar como lida
                              </button>
                            )}
                        </div>
                        <button
                          type="button"
                          className="app-notification-panel__dismiss"
                          aria-label={`${actionFeedback ? 'Excluir' : 'Dispensar'}: ${notification.title}`}
                          title={
                            actionFeedback
                              ? 'Excluir notificação'
                              : 'Dispensar notificação'
                          }
                          onClick={() => void dismissNotification(notification)}
                        >
                          {actionFeedback ? (
                            <Trash2 size={15} aria-hidden="true" />
                          ) : (
                            <X size={15} aria-hidden="true" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
