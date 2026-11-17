import {
  Bookmark,
  Activity,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
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
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAccount } from '@/context/account-state';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { SidebarTooltip } from '@/components/layout/sidebar-tooltip';
import { useTitleLanguage } from '@/hooks/use-title-language';
import './app-shell.css';

const navItems = [
  { label: 'Início', path: '/', icon: House, end: true },
  { label: 'Explorar', path: '/search', icon: Compass },
  { label: 'Agenda', path: '/schedule', icon: CalendarDays },
  { label: 'Feed', path: '/activity', icon: Activity },
  { label: 'Lançamentos', path: '/updates', icon: Sparkles },
];

const moreItems = [
  { label: 'Em alta', icon: Flame, path: '/trending' },
  { label: 'Continuar assistindo', icon: History, path: '/continue-watching' },
  { label: 'Assistir Depois', icon: Bookmark, path: '/watch-later' },
];

export function AppShell() {
  const [search, setSearch] = useState('');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const showSidebarRef = useRef<HTMLButtonElement | null>(null);
  const previousSidebarVisibility = useRef(sidebarVisible);
  const { pathname } = useLocation();
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
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
  }

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-[#f5f5f5]">
      <aside
        ref={sidebarRef}
        id="app-sidebar"
        aria-label="Navegação do aplicativo"
        aria-hidden={!sidebarVisible}
        inert={!sidebarVisible}
        data-visible={sidebarVisible}
        className="app-sidebar fixed top-[81px] bottom-0 left-0 z-30 border-r border-white/[0.045] bg-[#0b0b0c]"
      >
        <div className="app-sidebar__nav-stack">
          <nav
            className="app-sidebar__main-nav"
            aria-label="Navegação principal"
          >
            {navItems.map(({ label, path, icon: Icon, end }) => (
              <SidebarTooltip key={label} label={label}>
                <NavLink
                  to={path}
                  end={end}
                  data-sidebar-link="true"
                  aria-label={label}
                  className={({ isActive }) =>
                    `app-sidebar__nav-link ${isActive ? 'is-active' : ''}`
                  }
                >
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                </NavLink>
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
                  <NavLink
                    to={path}
                    data-sidebar-link="true"
                    aria-label={label}
                    style={{ '--sidebar-index': index } as CSSProperties}
                    className={({ isActive }) =>
                      `app-sidebar__nav-link app-sidebar__more-link ${
                        isActive ? 'is-active' : ''
                      }`
                    }
                  >
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  </NavLink>
                </SidebarTooltip>
              ))}
            </div>
          </nav>
        </div>

        <div className="app-sidebar__foot" aria-label="Controles da navegação">
          <SidebarTooltip label="Configurações">
            <NavLink
              to="/settings"
              data-sidebar-link="true"
              aria-label="Configurações"
              className={({ isActive }) =>
                `app-sidebar__nav-link ${isActive ? 'is-active' : ''}`
              }
            >
              <Settings size={19} strokeWidth={1.8} aria-hidden="true" />
            </NavLink>
          </SidebarTooltip>
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
              <ChevronLeft size={19} strokeWidth={1.8} aria-hidden="true" />
            </button>
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
        <header className="app-header fixed inset-x-0 top-0 z-40 flex h-[81px] items-center gap-8 border-b border-white/[0.06] bg-[#0b0b0c] px-6">
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
          <NavLink
            to="/"
            aria-label="Ir para o início do Animonkey"
            className="app-header__brand flex shrink-0 items-center gap-2"
          >
            <span className="grid size-10 place-items-center rounded-lg bg-[#49d77a] text-[#07110a]">
              <Clapperboard size={21} strokeWidth={2.2} />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-white">
              ani<span className="text-[#49d77a]">monkey</span>
            </span>
          </NavLink>

          {pathname !== '/search' && (
            <form
              onSubmit={submitSearch}
              className="app-header__search relative w-[min(320px,calc(100vw-520px))] shrink-0"
            >
              <Search
                size={17}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-white/40"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Busque por anime, gênero ou temporada..."
                aria-label="Buscar animes"
                className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.025] pr-12 pl-10 text-[13px] text-white outline-none transition placeholder:text-white/45 focus:border-[#49d77a]/45 focus:bg-white/[0.04]"
              />
              <kbd className="absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-white/35">
                ENTER
              </kbd>
            </form>
          )}

          <div className="ml-auto flex items-center gap-4">
            <div
              role="group"
              className="app-header__language flex items-center gap-1 rounded-md bg-white/[0.045] p-1"
              aria-label="Idioma dos títulos"
            >
              {(['en', 'jp'] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => {
                    if (titleLanguage !== language) toggleTitleLanguage();
                  }}
                  aria-pressed={titleLanguage === language}
                  className={`rounded px-2 py-1 text-[10px] font-bold transition ${titleLanguage === language ? 'bg-white/[0.12] text-white' : 'text-white/50 hover:text-white'}`}
                >
                  {language.toUpperCase()}
                </button>
              ))}
            </div>
            <NavLink
              to="/settings"
              className="flex items-center gap-3 rounded-full border border-white/[0.07] bg-white/[0.03] py-1.5 pr-3 pl-1.5 text-left"
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
            </NavLink>
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
