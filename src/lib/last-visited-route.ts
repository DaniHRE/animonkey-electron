const STORAGE_KEY = 'animonkey:last-visited-route:v1';
const INTERNAL_ORIGIN = 'https://animonkey.invalid';
const MAX_HREF_LENGTH = 4096;
const MAX_SEARCH_ENTRIES = 64;
const STATIC_ROUTES = new Set([
  '/',
  '/schedule',
  '/watch-later',
  '/continue-watching',
  '/settings',
  '/activity',
]);

function isValidId(value: string): boolean {
  if (!/^[1-9]\d{0,15}$/.test(value)) return false;
  return Number.isSafeInteger(Number(value));
}

function hasOnlySearchKeys(
  params: URLSearchParams,
  allowedKeys: ReadonlySet<string>,
): boolean {
  const seen = new Set<string>();
  for (const [key, value] of params) {
    if (!allowedKeys.has(key) || seen.has(key) || value.length > 1024) {
      return false;
    }
    seen.add(key);
  }
  return true;
}

function hasValidPage(params: URLSearchParams): boolean {
  const page = params.get('page');
  return (
    page === null ||
    (/^[1-9]\d{0,8}$/.test(page) && Number.isSafeInteger(Number(page)))
  );
}

function normalizeInternalRoute(href: string): string | null {
  if (
    !href.startsWith('/') ||
    href.startsWith('//') ||
    href.length > MAX_HREF_LENGTH
  ) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(href, INTERNAL_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== INTERNAL_ORIGIN || url.hash) return null;

  const { pathname, searchParams } = url;
  if (searchParams.size > MAX_SEARCH_ENTRIES) return null;

  if (STATIC_ROUTES.has(pathname)) {
    if (searchParams.size) return null;
  } else if (/^\/anime\/[1-9]\d{0,15}$/.test(pathname)) {
    if (!isValidId(pathname.slice('/anime/'.length)) || searchParams.size)
      return null;
  } else if (/^\/watch\/[1-9]\d{0,15}$/.test(pathname)) {
    if (!isValidId(pathname.slice('/watch/'.length))) return null;
    if (
      !hasOnlySearchKeys(searchParams, new Set(['ep'])) ||
      (searchParams.has('ep') &&
        !/^[A-Za-z0-9._~-]{1,128}$/.test(searchParams.get('ep') ?? ''))
    ) {
      return null;
    }
  } else if (pathname === '/search') {
    const seenKeys = new Set<string>();
    for (const [key, value] of searchParams) {
      if (
        !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(key) ||
        seenKeys.has(key) ||
        value.length > 1024
      ) {
        return null;
      }
      seenKeys.add(key);
    }
    if (!hasValidPage(searchParams)) return null;
  } else if (pathname === '/trending' || pathname === '/updates') {
    if (
      !hasOnlySearchKeys(searchParams, new Set(['page'])) ||
      !hasValidPage(searchParams)
    ) {
      return null;
    }
  } else {
    return null;
  }

  return `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ''}`;
}

export function getPersistableRoute(
  pathname: string,
  search: unknown,
): string | null {
  if (!search || typeof search !== 'object' || Array.isArray(search)) {
    return normalizeInternalRoute(pathname);
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (typeof value !== 'string') return null;
    params.set(key, value);
  }

  const query = params.toString();
  return normalizeInternalRoute(`${pathname}${query ? `?${query}` : ''}`);
}

export function readLastVisitedRoute(): string | null {
  let rawValue: string | null;
  try {
    rawValue = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!rawValue) return null;

  try {
    const storedValue: unknown = JSON.parse(rawValue);
    if (
      !storedValue ||
      typeof storedValue !== 'object' ||
      !('version' in storedValue) ||
      storedValue.version !== 1 ||
      !('href' in storedValue) ||
      typeof storedValue.href !== 'string'
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const normalizedRoute = normalizeInternalRoute(storedValue.href);
    if (!normalizedRoute) window.localStorage.removeItem(STORAGE_KEY);
    return normalizedRoute;
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Invalid or inaccessible storage must not interrupt startup.
    }
    return null;
  }
}

export function saveLastVisitedRoute(href: string | null): void {
  if (!href) return;
  const normalizedRoute = normalizeInternalRoute(href);
  if (!normalizedRoute) return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, href: normalizedRoute }),
    );
  } catch {
    // Route persistence is best effort; navigation must keep working without storage.
  }
}
