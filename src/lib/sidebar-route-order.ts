export const SIDEBAR_PRIMARY_ROUTE_IDS = [
  'schedule',
  'activity',
  'updates',
] as const;

export const SIDEBAR_MORE_ROUTE_IDS = [
  'trending',
  'continue-watching',
  'watch-later',
] as const;

export type SidebarRouteId =
  | (typeof SIDEBAR_PRIMARY_ROUTE_IDS)[number]
  | (typeof SIDEBAR_MORE_ROUTE_IDS)[number];

export interface SidebarRouteOrder {
  primary: SidebarRouteId[];
  more: SidebarRouteId[];
}

export const SIDEBAR_ORDER_PREFERENCE_KEY = 'sidebar-route-order-v1';

export const DEFAULT_SIDEBAR_ROUTE_ORDER = {
  primary: [...SIDEBAR_PRIMARY_ROUTE_IDS],
  more: [...SIDEBAR_MORE_ROUTE_IDS],
} satisfies SidebarRouteOrder;

function normalizeGroupOrder<T extends SidebarRouteId>(
  value: unknown,
  allowedIds: readonly T[],
  defaultOrder: readonly T[],
): T[] {
  if (!Array.isArray(value)) return [...defaultOrder];

  const normalized: T[] = [];
  const seen = new Set<T>();
  for (const candidate of value) {
    if (typeof candidate !== 'string') continue;
    const routeId = allowedIds.find((allowedId) => allowedId === candidate);
    if (!routeId || seen.has(routeId)) continue;
    normalized.push(routeId);
    seen.add(routeId);
  }

  for (const routeId of defaultOrder) {
    if (seen.has(routeId)) continue;
    normalized.push(routeId);
    seen.add(routeId);
  }

  return normalized;
}

export function normalizeSidebarRouteOrder(value: unknown): SidebarRouteOrder {
  const stored =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    primary: normalizeGroupOrder(
      stored.primary,
      SIDEBAR_PRIMARY_ROUTE_IDS,
      DEFAULT_SIDEBAR_ROUTE_ORDER.primary,
    ),
    more: normalizeGroupOrder(
      stored.more,
      SIDEBAR_MORE_ROUTE_IDS,
      DEFAULT_SIDEBAR_ROUTE_ORDER.more,
    ),
  };
}

export function isSidebarRouteOrder(
  value: unknown,
): value is SidebarRouteOrder {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;
  const stored = value as Record<string, unknown>;
  if (
    Object.keys(stored).length !== 2 ||
    !Array.isArray(stored.primary) ||
    !Array.isArray(stored.more)
  )
    return false;

  const hasExactRouteSet = (
    routes: unknown[],
    allowedRoutes: readonly SidebarRouteId[],
  ) =>
    routes.length === allowedRoutes.length &&
    routes.every(
      (route): route is SidebarRouteId =>
        typeof route === 'string' &&
        allowedRoutes.includes(route as SidebarRouteId),
    ) &&
    new Set(routes).size === allowedRoutes.length;

  return (
    hasExactRouteSet(stored.primary, SIDEBAR_PRIMARY_ROUTE_IDS) &&
    hasExactRouteSet(stored.more, SIDEBAR_MORE_ROUTE_IDS)
  );
}

export function moveSidebarRoute<T extends SidebarRouteId>(
  order: readonly T[],
  routeId: T,
  direction: -1 | 1,
): T[] | null {
  const currentIndex = order.indexOf(routeId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= order.length)
    return null;

  const nextOrder = [...order];
  [nextOrder[currentIndex], nextOrder[nextIndex]] = [
    nextOrder[nextIndex],
    nextOrder[currentIndex],
  ];
  return nextOrder;
}
