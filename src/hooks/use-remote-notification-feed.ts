import { useEffect } from 'react';
import { replaceRemoteAppNotifications } from '@/services/cache/local-db';
import { APP_NOTIFICATION_CENTER_OPEN_EVENT } from '@/lib/app-notifications';

const DEFAULT_RETRY_DELAY_MS = 6 * 60 * 60 * 1000;

export function useRemoteNotificationFeed(): void {
  useEffect(() => {
    let active = true;
    let refreshing = false;
    let timeoutId: number | null = null;
    let retryDelay = DEFAULT_RETRY_DELAY_MS;
    let stopped = false;

    const schedule = (delayMs: number) => {
      if (!active || stopped) return;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(
        () => {
          timeoutId = null;
          void refresh();
        },
        Math.max(1_000, delayMs),
      );
    };

    const refresh = async () => {
      if (!active || refreshing) return;
      if (!navigator.onLine) {
        schedule(retryDelay);
        return;
      }

      refreshing = true;
      try {
        const result = await window.animonkey.notifications.refreshRemoteFeed();
        if (!active) return;
        if (result.status === 'disabled') {
          stopped = true;
          return;
        }

        retryDelay = result.retryAfterMs;
        if (result.status === 'updated') {
          const now = Date.now();
          const notifications = result.feed.notifications
            .filter((notification) => {
              const startsAt = Date.parse(notification.startsAt);
              const expiresAt = Date.parse(notification.expiresAt);
              return startsAt <= now && expiresAt > now;
            })
            .map((notification) => ({
              id: `remote:${notification.id.toLowerCase()}`,
              kind: 'remote' as const,
              category: notification.category,
              severity: notification.severity,
              title: notification.title,
              message: notification.message,
              priority: notification.priority,
              createdAt: Date.parse(notification.startsAt),
              expiresAt: Date.parse(notification.expiresAt),
              action: notification.action.type,
              ...(typeof notification.animeId === 'string'
                ? { animeId: notification.animeId }
                : {}),
              ...(typeof notification.providerId === 'string'
                ? { providerId: notification.providerId }
                : {}),
            }));
          await replaceRemoteAppNotifications(notifications);
        }
      } catch {
        retryDelay = DEFAULT_RETRY_DELAY_MS;
      } finally {
        refreshing = false;
        schedule(retryDelay);
      }
    };

    const refreshWhenOnline = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      void refresh();
    };

    void refresh();
    window.addEventListener('online', refreshWhenOnline);
    window.addEventListener(
      APP_NOTIFICATION_CENTER_OPEN_EVENT,
      refreshWhenOnline,
    );
    return () => {
      active = false;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      window.removeEventListener('online', refreshWhenOnline);
      window.removeEventListener(
        APP_NOTIFICATION_CENTER_OPEN_EVENT,
        refreshWhenOnline,
      );
    };
  }, []);
}
