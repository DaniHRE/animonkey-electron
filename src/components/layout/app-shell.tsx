import {
  Bookmark,
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flame,
  History,
  House,
  Menu,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, KeyboardEvent } from 'react';
import {
  Link,
  Outlet,
  useNavigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/context/account-state';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { useTitleLanguage } from '@/hooks/use-title-language';
import animonkeyLogoUrl from '@/assets/brand/animonkey-logo-navbar.svg';
import { resolveAnimeTitle } from '@/lib/anime';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { AppUpdateCenter } from '@/components/shared/app-update-center';
import { SidebarTooltip } from '@/components/layout/sidebar-tooltip';
import { WindowControls } from '@/components/layout/window-controls';
import {
  DEFAULT_SHORTCUT_PREFERENCES,
  isShortcutEditableTarget,
  matchesShortcut,
  normalizeShortcutPreferences,
  SHORTCUT_COMMANDS,
  SHORTCUT_PREFERENCE_KEY,
} from '@/lib/keyboard-shortcuts';
import {
  DEFAULT_SIDEBAR_ROUTE_ORDER,
  normalizeSidebarRouteOrder,
  SIDEBAR_ORDER_PREFERENCE_KEY,
} from '@/lib/sidebar-route-order';
import { animeQueries } from '@/services/anime-queries';
import './app-shell.css';

const pinnedNavItems = [
  { id: 'home', label: 'Início', path: '/', icon: House, end: true },
  {
    id: 'search',
    label: 'Explorar',
    path: '/search',
    icon: Compass,
    end: false,
  },
] as const;

const primaryNavItems = [
  {
    id: 'schedule',
    label: 'Agenda',
    path: '/schedule',
    icon: CalendarDays,
    end: false,
  },
  {
    id: 'activity',
    label: 'Feed',
    path: '/activity',
    icon: Activity,
    end: false,
  },
  {
    id: 'updates',
    label: 'Lançamentos',
    path: '/updates',
    icon: Sparkles,
    end: false,
  },
] as const;

const moreItems = [
  {
    id: 'trending',
    label: 'Em alta',
    icon: Flame,
    path: '/trending',
  },
  {
    id: 'continue-watching',
    label: 'Continuar assistindo',
    icon: History,
    path: '/continue-watching',
  },
  {
    id: 'watch-later',
    label: 'Assistir Depois',
    icon: Bookmark,
    path: '/watch-later',
  },
] as const;

function orderSidebarItems<T extends { id: string }>(
  items: readonly T[],
  order: readonly string[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item] as const));
  const orderedItems: T[] = [];
  const included = new Set<string>();

  for (const id of order) {
    const item = byId.get(id);
    if (!item || included.has(id)) continue;
    orderedItems.push(item);
    included.add(id);
  }

  return [...orderedItems, ...items.filter((item) => !included.has(item.id))];
}

function hasInAppHistory(router: ReturnType<typeof useRouter>): boolean {
  const historyIndex = router.history.location.state.__TSR_index;
  return (
    Number.isSafeInteger(historyIndex) &&
    historyIndex > 0 &&
    router.history.canGoBack()
  );
}

interface NavigationHistoryButtonsProps {
  variant: 'header' | 'titlebar';
  canGoBack: boolean;
  canGoForward: boolean;
  backLabel: string;
  onBack: () => void;
  onForward: () => void;
}

function NavigationHistoryButtons({
  variant,
  canGoBack,
  canGoForward,
  backLabel,
  onBack,
  onForward,
}: NavigationHistoryButtonsProps) {
  const buttonClassName =
    variant === 'titlebar'
      ? 'app-window-titlebar__navigation-button'
      : 'app-header__history-button';
  const iconSize = variant === 'titlebar' ? 16 : 18;

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        aria-label={backLabel}
        title={backLabel}
        onClick={onBack}
        disabled={!canGoBack}
      >
        <ArrowLeft size={iconSize} strokeWidth={1.7} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={buttonClassName}
        aria-label="Avançar"
        title="Avançar"
        onClick={onForward}
        disabled={!canGoForward}
      >
        <ArrowRight size={iconSize} strokeWidth={1.7} aria-hidden="true" />
      </button>
    </>
  );
}

function getInAppHistoryIndex(
  router: ReturnType<typeof useRouter>,
): number | null {
  const index = router.history.location.state.__TSR_index;
  return Number.isSafeInteger(index) && index >= 0 ? index : null;
}

interface InAppHistoryChange {
  action: { type: string };
  location: { state: { __TSR_index: number } };
}

function useInAppHistory(router: ReturnType<typeof useRouter>) {
  const [maxKnownIndex, setMaxKnownIndex] = useState(
    () => getInAppHistoryIndex(router) ?? 0,
  );
  const [historyIndex, setHistoryIndex] = useState(() =>
    getInAppHistoryIndex(router),
  );

  useEffect(
    () =>
      router.history.subscribe(({ action, location }: InAppHistoryChange) => {
        const nextIndex = location.state.__TSR_index;
        if (!Number.isSafeInteger(nextIndex) || nextIndex < 0) {
          setHistoryIndex(null);
          return;
        }

        setHistoryIndex(nextIndex);
        setMaxKnownIndex((currentMax) =>
          action.type === 'PUSH' ? nextIndex : Math.max(currentMax, nextIndex),
        );
      }),
    [router],
  );

  const canGoBack =
    historyIndex !== null && historyIndex > 0 && router.history.canGoBack();

  return {
    canGoBack,
    canGoForward: historyIndex !== null && historyIndex < maxKnownIndex,
  };
}

export function AppShell() {
  const hasCustomWindowChrome = window.animonkey.platform === 'win32';
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchPreviewOpen, setSearchPreviewOpen] = useState(false);
  const [activeSearchPreviewIndex, setActiveSearchPreviewIndex] = useState(-1);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const { value: storedShortcuts, loaded: shortcutsLoaded } =
    useLocalPreference<unknown>(
      SHORTCUT_PREFERENCE_KEY,
      DEFAULT_SHORTCUT_PREFERENCES,
    );
  const { value: storedSidebarRouteOrder, loaded: sidebarRouteOrderLoaded } =
    useLocalPreference<unknown>(
      SIDEBAR_ORDER_PREFERENCE_KEY,
      DEFAULT_SIDEBAR_ROUTE_ORDER,
    );
  const shortcutPreferences = useMemo(
    () => normalizeShortcutPreferences(storedShortcuts),
    [storedShortcuts],
  );
  const normalizedSidebarRouteOrder = useMemo(
    () => normalizeSidebarRouteOrder(storedSidebarRouteOrder),
    [storedSidebarRouteOrder],
  );
  const sidebarRouteOrder = sidebarRouteOrderLoaded
    ? normalizedSidebarRouteOrder
    : DEFAULT_SIDEBAR_ROUTE_ORDER;
  const orderedPrimaryNavItems = useMemo(
    () => orderSidebarItems(primaryNavItems, sidebarRouteOrder.primary),
    [sidebarRouteOrder.primary],
  );
  const orderedMoreItems = useMemo(
    () => orderSidebarItems(moreItems, sidebarRouteOrder.more),
    [sidebarRouteOrder.more],
  );
  const navItems = [...pinnedNavItems, ...orderedPrimaryNavItems];
  const shouldReduceMotion = useReducedMotion() ?? false;
  const shellRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const showSidebarRef = useRef<HTMLButtonElement | null>(null);
  const previousSidebarVisibility = useRef(sidebarVisible);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const moreRouteActive = orderedMoreItems.some(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const showMoreItems = moreExpanded || moreRouteActive;
  const router = useRouter();
  const navigate = useNavigate();
  const platform = window.animonkey.platform;
  const { canGoBack, canGoForward } = useInAppHistory(router);
  const canNavigateBack = canGoBack || pathname !== '/';
  const backLabel = canGoBack ? 'Voltar' : 'Ir para o início';
  const { session } = useAccount();
  const { titleLanguage } = useTitleLanguage();
  const searchPreviewQuery = useQuery({
    ...animeQueries.search(debouncedSearch, 1, {}),
    enabled:
      pathname !== '/search' &&
      searchPreviewOpen &&
      debouncedSearch.trim().length >= 2,
    select: (response) => response.results.slice(0, 5),
  });
  const searchPreviewResults =
    search.trim() === debouncedSearch ? (searchPreviewQuery.data ?? []) : [];
  const isSearchPreviewVisible =
    pathname !== '/search' && searchPreviewOpen && search.trim().length > 0;
  const isSearchPreviewLoading =
    search.trim() !== debouncedSearch || searchPreviewQuery.isFetching;
  const useContentFrame =
    pathname !== '/' &&
    !pathname.startsWith('/anime/') &&
    !pathname.startsWith('/watch/');

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let frame: number | undefined;
    const updateSurface = () => {
      frame = undefined;
      shellRef.current?.style.setProperty(
        '--app-scroll-progress',
        String(Math.min(1, Math.max(0, window.scrollY / 150))),
      );
    };
    const onScroll = () => {
      if (frame === undefined)
        frame = window.requestAnimationFrame(updateSurface);
    };
    updateSurface();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    const wasVisible = previousSidebarVisibility.current;
    if (wasVisible === sidebarVisible) return;

    if (sidebarVisible) {
      const activeLink = sidebarRef.current?.querySelector<HTMLElement>(
        '[aria-current="page"]',
      );
      (
        activeLink ??
        sidebarRef.current?.querySelector<HTMLElement>('[data-sidebar-link]')
      )?.focus({
        preventScroll: true,
      });
    } else {
      showSidebarRef.current?.focus({ preventScroll: true });
    }

    previousSidebarVisibility.current = sidebarVisible;
  }, [sidebarVisible]);

  useEffect(() => {
    if (!shortcutsLoaded) return;

    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        isShortcutEditableTarget(event.target)
      )
        return;

      const command = SHORTCUT_COMMANDS.find(({ id }) =>
        matchesShortcut(event, shortcutPreferences[id], platform),
      );
      if (!command) return;

      event.preventDefault();
      switch (command.id) {
        case 'toggleSidebar':
          setSidebarVisible((visible) => !visible);
          break;
        case 'focusSearch':
          if (pathname !== '/search') setSearchPreviewOpen(true);
          document
            .querySelector<HTMLInputElement>('[data-app-shortcut-search]')
            ?.focus();
          break;
        case 'openSettings':
          void navigate({ to: '/settings' });
          break;
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [navigate, pathname, platform, shortcutPreferences, shortcutsLoaded]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchPreviewOpen(false);
    setActiveSearchPreviewIndex(-1);
    const query = search.trim();
    void navigate({
      to: '/search',
      search: query ? { q: query } : {},
    });
  }

  function openAnimePreviewResult(animeId: string) {
    setSearchPreviewOpen(false);
    setActiveSearchPreviewIndex(-1);
    void navigate({ to: '/anime/$id', params: { id: animeId } });
  }

  function handleSearchPreviewKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSearchPreviewOpen(false);
      setActiveSearchPreviewIndex(-1);
      return;
    }

    if (!isSearchPreviewVisible || searchPreviewResults.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSearchPreviewIndex((index) =>
        index >= searchPreviewResults.length - 1 ? 0 : index + 1,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSearchPreviewIndex((index) =>
        index <= 0 ? searchPreviewResults.length - 1 : index - 1,
      );
    } else if (
      event.key === 'Enter' &&
      searchPreviewResults[activeSearchPreviewIndex]
    ) {
      event.preventDefault();
      openAnimePreviewResult(searchPreviewResults[activeSearchPreviewIndex].id);
    }
  }

  function goBack() {
    if (hasInAppHistory(router)) {
      router.history.back();
      return;
    }
    if (pathname !== '/') void navigate({ to: '/', replace: true });
  }

  function goForward() {
    if (canGoForward) router.history.forward();
  }

  return (
    <div
      ref={shellRef}
      data-custom-window-chrome={hasCustomWindowChrome}
      data-sidebar-visible={sidebarVisible}
      className="app-shell min-h-screen bg-[#0b0b0c] text-[#f5f5f5]"
    >
      <aside
        ref={sidebarRef}
        id="app-sidebar"
        aria-label="Navegação do aplicativo"
        aria-hidden={!sidebarVisible}
        inert={!sidebarVisible}
        data-visible={sidebarVisible}
        className="app-sidebar fixed bottom-0 left-0 z-30"
      >
        <div className="app-sidebar__nav-stack">
          <nav
            className="app-sidebar__main-nav"
            aria-label="Navegação principal"
          >
            {navItems.map(({ id, label, path, icon: Icon, end }) => (
              <SidebarTooltip key={id} label={label}>
                <Link
                  to={path}
                  activeOptions={{ exact: end }}
                  data-sidebar-link="true"
                  aria-label={label}
                  className={`app-sidebar__nav-link ${pathname === path || (!end && pathname.startsWith(`${path}/`)) ? 'is-active' : ''}`}
                >
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                </Link>
              </SidebarTooltip>
            ))}
          </nav>

          <SidebarTooltip
            label={
              showMoreItems ? 'Recolher mais seções' : 'Mostrar mais seções'
            }
          >
            <button
              type="button"
              data-sidebar-link="true"
              aria-label={
                showMoreItems ? 'Recolher mais seções' : 'Mostrar mais seções'
              }
              aria-expanded={showMoreItems}
              aria-controls="app-sidebar-more"
              onClick={() => setMoreExpanded((expanded) => !expanded)}
              className={`app-sidebar__more-toggle ${showMoreItems ? 'is-active' : ''}`}
            >
              <ChevronDown
                size={19}
                strokeWidth={1.8}
                aria-hidden="true"
                className={`app-sidebar__more-chevron ${showMoreItems ? 'is-open' : ''}`}
              />
            </button>
          </SidebarTooltip>
          <nav
            id="app-sidebar-more"
            aria-label="Mais seções"
            aria-hidden={!showMoreItems}
            inert={!showMoreItems}
            data-expanded={showMoreItems}
            className="app-sidebar__more-list"
          >
            <div className="app-sidebar__more-list-inner">
              {orderedMoreItems.map(
                ({ id, label, icon: Icon, path }, index) => (
                  <SidebarTooltip key={id} label={label}>
                    <Link
                      to={path}
                      data-sidebar-link="true"
                      aria-label={label}
                      style={{ '--sidebar-index': index } as CSSProperties}
                      className={`app-sidebar__nav-link app-sidebar__more-link ${pathname === path || pathname.startsWith(`${path}/`) ? 'is-active' : ''}`}
                    >
                      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    </Link>
                  </SidebarTooltip>
                ),
              )}
            </div>
          </nav>
          <span className="app-sidebar__divider" aria-hidden="true" />
          <SidebarTooltip label="Ocultar navegação">
            <button
              type="button"
              data-sidebar-link="true"
              aria-label="Ocultar navegação lateral"
              aria-expanded={sidebarVisible}
              aria-controls="app-sidebar"
              onClick={() => setSidebarVisible(false)}
              className="app-sidebar__nav-link app-sidebar__hide-toggle"
            >
              <ChevronLeft size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </SidebarTooltip>
        </div>

        <div className="app-sidebar__foot" aria-label="Controles da navegação">
          <span className="app-sidebar__divider" aria-hidden="true" />
          <SidebarTooltip label="Configurações">
            <Link
              to="/settings"
              data-sidebar-link="true"
              aria-label="Configurações"
              className={`app-sidebar__nav-link ${pathname === '/settings' ? 'is-active' : ''}`}
            >
              <Settings size={18} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </SidebarTooltip>
        </div>
      </aside>

      {!sidebarVisible && (
        <SidebarTooltip label="Mostrar navegação">
          <button
            ref={showSidebarRef}
            type="button"
            aria-label="Mostrar navegação lateral"
            aria-expanded={sidebarVisible}
            aria-controls="app-sidebar"
            onClick={() => setSidebarVisible(true)}
            className="app-sidebar__show-handle"
          >
            <ChevronRight size={19} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </SidebarTooltip>
      )}

      <div
        data-sidebar-visible={sidebarVisible}
        className="app-shell-content min-h-screen"
      >
        <a
          href="#main-content"
          className="sr-only z-50 rounded bg-[#49d77a] p-3 text-sm font-bold text-black focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Pular para o conteúdo
        </a>
        {hasCustomWindowChrome && (
          <div className="app-window-titlebar">
            <div
              className="app-window-titlebar__navigation"
              role="group"
              aria-label="Navegação do histórico"
            >
              <NavigationHistoryButtons
                variant="titlebar"
                canGoBack={canNavigateBack}
                canGoForward={canGoForward}
                backLabel={backLabel}
                onBack={goBack}
                onForward={goForward}
              />
            </div>
            <div
              className="app-window-titlebar__drag-region"
              aria-hidden="true"
            />
            <WindowControls />
          </div>
        )}
        <header className="app-header fixed inset-x-0 z-40 h-[81px] pr-4 pl-6">
          <div
            className="app-header__edge app-header__edge--left"
            aria-hidden="true"
          />
          <div
            className="app-header__edge app-header__edge--right"
            aria-hidden="true"
          />
          {!sidebarVisible && (
            <SidebarTooltip label="Mostrar navegação">
              <button
                type="button"
                aria-label="Mostrar navegação lateral"
                aria-expanded={sidebarVisible}
                aria-controls="app-sidebar"
                onClick={() => setSidebarVisible(true)}
                className="app-header__show-sidebar"
              >
                <Menu size={19} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </SidebarTooltip>
          )}
          <Link
            to="/"
            aria-label="Ir para o início do Animonkey"
            className="app-header__brand flex shrink-0 items-center"
          >
            <motion.span
              className="app-header__brand-motion"
              whileHover={shouldReduceMotion ? undefined : { scale: 1.025 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            >
              <img
                src={animonkeyLogoUrl}
                alt=""
                draggable={false}
                className="app-header__brand-logo"
              />
            </motion.span>
          </Link>

          <div className="app-header__navigation-actions">
            {!hasCustomWindowChrome && (
              <NavigationHistoryButtons
                variant="header"
                canGoBack={canNavigateBack}
                canGoForward={canGoForward}
                backLabel={backLabel}
                onBack={goBack}
                onForward={goForward}
              />
            )}
            {pathname !== '/search' && (
              <form
                onSubmit={submitSearch}
                className="app-header__search"
                autoComplete="off"
              >
                <Search
                  size={20}
                  className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setActiveSearchPreviewIndex(-1);
                    setSearchPreviewOpen(event.target.value.trim().length > 0);
                  }}
                  onFocus={() => {
                    if (search.trim()) setSearchPreviewOpen(true);
                  }}
                  onBlur={() => {
                    setSearchPreviewOpen(false);
                    setActiveSearchPreviewIndex(-1);
                  }}
                  onKeyDown={handleSearchPreviewKeyDown}
                  placeholder="Buscar anime..."
                  aria-label="Buscar anime"
                  role="combobox"
                  aria-autocomplete="list"
                  data-app-shortcut-search="true"
                  aria-haspopup="listbox"
                  aria-expanded={isSearchPreviewVisible}
                  aria-controls={
                    isSearchPreviewVisible ? 'header-search-preview' : undefined
                  }
                  aria-activedescendant={
                    isSearchPreviewVisible &&
                    activeSearchPreviewIndex >= 0 &&
                    activeSearchPreviewIndex < searchPreviewResults.length
                      ? `header-search-option-${activeSearchPreviewIndex}`
                      : undefined
                  }
                  className="app-header__search-input"
                />
                {isSearchPreviewVisible && (
                  <div
                    id="header-search-preview"
                    aria-busy={isSearchPreviewLoading}
                    className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[min(60vh,28rem)] overflow-y-auto rounded-xl border border-white/10 bg-[#101113] py-2 shadow-[0_18px_48px_rgba(0,0,0,0.55)]"
                  >
                    {search.trim().length < 2 ? (
                      <p
                        role="status"
                        className="px-4 py-3 text-sm text-white/45"
                      >
                        Digite pelo menos 2 caracteres para ver sugestões.
                      </p>
                    ) : isSearchPreviewLoading ? (
                      <p
                        role="status"
                        className="px-4 py-3 text-sm text-white/45"
                      >
                        Buscando animes…
                      </p>
                    ) : searchPreviewQuery.error ? (
                      <p
                        role="status"
                        className="px-4 py-3 text-sm text-white/45"
                      >
                        Não foi possível carregar as sugestões.
                      </p>
                    ) : searchPreviewResults.length > 0 ? (
                      <>
                        <div
                          role="listbox"
                          aria-label="Sugestões de anime"
                          className="space-y-1 px-2"
                        >
                          {searchPreviewResults.map((anime, index) => (
                            <button
                              key={anime.id}
                              id={`header-search-option-${index}`}
                              type="button"
                              role="option"
                              aria-selected={activeSearchPreviewIndex === index}
                              tabIndex={-1}
                              onMouseDown={(event) => event.preventDefault()}
                              onMouseEnter={() =>
                                setActiveSearchPreviewIndex(index)
                              }
                              onClick={() => openAnimePreviewResult(anime.id)}
                              className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${activeSearchPreviewIndex === index ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'}`}
                            >
                              {anime.image ? (
                                <img
                                  src={anime.image}
                                  alt=""
                                  loading="lazy"
                                  className="size-11 shrink-0 rounded-md object-cover"
                                />
                              ) : (
                                <span className="grid size-11 shrink-0 place-items-center rounded-md bg-white/[0.05] text-white/30">
                                  <Search size={16} aria-hidden="true" />
                                </span>
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-white/85">
                                  {resolveAnimeTitle(
                                    anime.title,
                                    titleLanguage,
                                  )}
                                </span>
                                <span className="mt-1 block text-xs text-white/40">
                                  {anime.type ?? 'Anime'}
                                </span>
                              </span>
                              {anime.isAdult && (
                                <span className="shrink-0 rounded bg-red-400/10 px-1.5 py-1 text-[10px] font-bold text-red-200/75">
                                  18+
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                        <button
                          type="submit"
                          onMouseDown={(event) => event.preventDefault()}
                          className="mt-2 w-full border-t border-white/[0.07] px-4 pt-3 text-left text-xs font-semibold text-[#77e898] hover:text-white"
                        >
                          Ver todos os resultados
                        </button>
                      </>
                    ) : (
                      <p
                        role="status"
                        className="px-4 py-3 text-sm text-white/45"
                      >
                        Nenhum anime encontrado.
                      </p>
                    )}
                  </div>
                )}
              </form>
            )}
          </div>

          <div className="app-header__actions flex items-center gap-4">
            <AppUpdateCenter />
            <Link
              to="/settings"
              className="app-header__account"
              aria-label={`Abrir perfil e configurações${session?.user.name ? ` de ${session.user.name}` : ''}`}
              title="Perfil e configurações"
            >
              <ProfileAvatar
                image={session?.user.image ?? null}
                name={session?.user.name ?? null}
                className="app-header__account-avatar"
              />
            </Link>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="app-shell-main">
          {useContentFrame ? (
            <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 2xl:px-10">
              <Outlet />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
