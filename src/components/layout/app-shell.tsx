import {
  Bookmark,
  Activity,
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
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { useAccount } from '@/context/account-state';
import animonkeyLogoUrl from '@/assets/brand/animonkey-logo.svg';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { SidebarTooltip } from '@/components/layout/sidebar-tooltip';
import { useTitleLanguage } from '@/hooks/use-title-language';
import './app-shell.css';

const navItems = [
  { label: 'Início', path: '/', icon: House, end: true },
  { label: 'Explorar', path: '/search', icon: Compass, end: false },
  { label: 'Agenda', path: '/schedule', icon: CalendarDays, end: false },
  { label: 'Feed', path: '/activity', icon: Activity, end: false },
  { label: 'Lançamentos', path: '/updates', icon: Sparkles, end: false },
] as const;

const moreItems = [
  { label: 'Em alta', icon: Flame, path: '/trending' },
  { label: 'Continuar assistindo', icon: History, path: '/continue-watching' },
  { label: 'Assistir Depois', icon: Bookmark, path: '/watch-later' },
] as const;

export function AppShell() {
  const [search, setSearch] = useState('');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const shouldReduceMotion = useReducedMotion() ?? false;
  const shellRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const showSidebarRef = useRef<HTMLButtonElement | null>(null);
  const previousSidebarVisibility = useRef(sidebarVisible);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const moreRouteActive = moreItems.some(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const showMoreItems = moreExpanded || moreRouteActive;
  const navigate = useNavigate();
  const { session } = useAccount();
  const { titleLanguage, toggleTitleLanguage } = useTitleLanguage();
  const useContentFrame =
    pathname !== '/' &&
    !pathname.startsWith('/anime/') &&
    !pathname.startsWith('/watch/');

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

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    void navigate({
      to: '/search',
      search: query ? { q: query } : {},
    });
  }

  return (
    <div
      ref={shellRef}
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
        className="app-sidebar fixed top-[81px] bottom-0 left-0 z-30"
      >
        <div className="app-sidebar__nav-stack">
          <nav
            className="app-sidebar__main-nav"
            aria-label="Navegação principal"
          >
            {navItems.map(({ label, path, icon: Icon, end }) => (
              <SidebarTooltip key={label} label={label}>
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
              {moreItems.map(({ label, icon: Icon, path }, index) => (
                <SidebarTooltip key={label} label={label}>
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
              ))}
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
        <header className="app-header fixed inset-x-0 top-0 z-40 h-[81px] pr-4 pl-6">
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

          {pathname !== '/search' && (
            <form
              onSubmit={submitSearch}
              className="app-header__search relative"
            >
              <Search
                size={20}
                className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar anime..."
                aria-label="Buscar anime"
                className="app-header__search-input"
              />
            </form>
          )}

          <div className="app-header__actions flex items-center gap-4">
            <button
              type="button"
              className="app-header__language"
              onClick={toggleTitleLanguage}
              aria-pressed={titleLanguage === 'jp'}
              aria-label={`EN/JP: títulos em ${titleLanguage === 'jp' ? 'japonês (romaji). Mudar para inglês' : 'inglês. Mudar para japonês (romaji)'}`}
              title={`Títulos em ${titleLanguage === 'jp' ? 'japonês (romaji)' : 'inglês'}`}
            >
              <span className="app-header__language-thumb" aria-hidden="true" />
              {(['en', 'jp'] as const).map((language) => (
                <span
                  key={language}
                  aria-hidden="true"
                  className={`app-header__language-option ${titleLanguage === language ? 'is-active' : ''}`}
                >
                  {language.toUpperCase()}
                </span>
              ))}
            </button>
            <Link
              to="/settings"
              className="app-header__account flex items-center gap-3 rounded-full border border-white/[0.07] bg-white/[0.03] py-1.5 pr-3 pl-1.5 text-left"
              title="Configurações locais"
            >
              <ProfileAvatar
                image={session?.user.image ?? null}
                name={session?.user.name ?? null}
                className="size-8 shrink-0 rounded-full object-cover text-xs"
              />
              <span className="max-w-32 truncate text-xs font-semibold">
                {session?.user.name?.trim() || 'Perfil'}
              </span>
              <ChevronDown size={14} className="text-white/40" />
            </Link>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-[calc(100vh-81px)] w-full p-0 outline-none"
        >
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
