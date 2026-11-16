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
  MoreHorizontal,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAccount } from '@/context/account-state';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
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
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);
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

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
  }

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-[#f5f5f5]">
      <aside
        id="app-sidebar"
        aria-label="Navegação do aplicativo"
        data-collapsed={!sidebarExpanded ? 'true' : undefined}
        className="app-sidebar fixed top-[81px] bottom-0 left-0 z-30 flex flex-col border-r border-white/[0.045] bg-[#0b0b0c]"
      >
        <div className="app-sidebar__nav-stack">
          <nav className="space-y-2" aria-label="Navegação principal">
            {navItems.map(({ label, path, icon: Icon, end }) => (
              <NavLink
                key={label}
                to={path}
                end={end}
                data-sidebar-link="true"
                aria-label={label}
                title={!sidebarExpanded ? label : undefined}
                className={({ isActive }) =>
                  `flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition ${
                    isActive
                      ? 'relative bg-white/[0.06] text-[#67e58f]'
                      : 'text-white/55 hover:bg-white/[0.05] hover:text-white'
                  }`
                }
              >
                <Icon size={18} strokeWidth={1.8} />
                <span
                  aria-hidden={!sidebarExpanded}
                  className="app-sidebar__label"
                >
                  {label}
                </span>
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            data-sidebar-link="true"
            aria-label="Mais seções"
            aria-expanded={showMoreItems}
            aria-controls="app-sidebar-more"
            title={!sidebarExpanded ? 'Mais seções' : undefined}
            onClick={() => setMoreExpanded((expanded) => !expanded)}
            className={`app-sidebar__more-toggle mt-2 flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition ${showMoreItems ? 'bg-white/[0.05] text-[#67e58f]' : 'text-white/55 hover:bg-white/[0.05] hover:text-white'}`}
          >
            <MoreHorizontal size={18} strokeWidth={1.8} />
            <span aria-hidden={!sidebarExpanded} className="app-sidebar__label">
              Mais
            </span>
            <ChevronDown
              size={15}
              aria-hidden="true"
              className={`app-sidebar__more-chevron ml-auto transition-transform ${showMoreItems ? 'rotate-180' : ''}`}
            />
          </button>
          <nav
            id="app-sidebar-more"
            aria-label="Mais seções"
            aria-hidden={!showMoreItems}
            inert={!showMoreItems}
            data-expanded={showMoreItems}
            className="app-sidebar__more-list space-y-2"
          >
            {moreItems.map(({ label, icon: Icon, path }) => (
              <NavLink
                key={label}
                to={path}
                data-sidebar-link="true"
                aria-label={label}
                title={!sidebarExpanded ? label : undefined}
                className={({ isActive }) =>
                  `flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition ${
                    isActive
                      ? 'relative bg-white/[0.04] text-[#67e58f]'
                      : 'text-white/55 hover:bg-white/[0.05] hover:text-white'
                  }`
                }
              >
                <Icon size={18} strokeWidth={1.8} />
                <span
                  aria-hidden={!sidebarExpanded}
                  className="app-sidebar__label"
                >
                  {label}
                </span>
              </NavLink>
            ))}
          </nav>
        </div>

        <button
          type="button"
          onClick={() => setSidebarExpanded((expanded) => !expanded)}
          aria-label={
            sidebarExpanded
              ? 'Recolher navegação lateral'
              : 'Expandir navegação lateral'
          }
          aria-expanded={sidebarExpanded}
          aria-controls="app-sidebar"
          title={
            sidebarExpanded
              ? 'Recolher navegação lateral'
              : 'Expandir navegação lateral'
          }
          className="app-sidebar__toggle mt-4 flex h-10 w-full shrink-0 items-center gap-3 rounded-xl px-3 text-[12px] font-semibold text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49d77a]"
        >
          {sidebarExpanded ? (
            <ChevronLeft size={18} aria-hidden="true" />
          ) : (
            <ChevronRight size={18} aria-hidden="true" />
          )}
          <span aria-hidden={!sidebarExpanded} className="app-sidebar__label">
            {sidebarExpanded ? 'Recolher menu' : 'Expandir menu'}
          </span>
        </button>

        <NavLink
          to="/settings"
          data-sidebar-link="true"
          aria-label="Configurações"
          title={!sidebarExpanded ? 'Configurações' : undefined}
          className={({ isActive }) =>
            `app-sidebar__settings-link mt-auto flex h-10 w-full shrink-0 items-center gap-3 rounded-lg px-3 text-[12px] font-semibold transition ${
              isActive
                ? 'relative bg-white/[0.05] text-[#67e58f]'
                : 'text-white/50 hover:bg-white/[0.06] hover:text-white'
            }`
          }
        >
          <Settings size={17} strokeWidth={1.8} />
          <span aria-hidden={!sidebarExpanded} className="app-sidebar__label">
            Configurações
          </span>
        </NavLink>
      </aside>

      <div
        data-collapsed={!sidebarExpanded ? 'true' : undefined}
        className="app-shell-content min-h-screen"
      >
        <a
          href="#main-content"
          className="sr-only z-50 rounded bg-[#49d77a] p-3 text-sm font-bold text-black focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Pular para o conteúdo
        </a>
        <header className="app-header fixed inset-x-0 top-0 z-40 flex h-[81px] items-center gap-8 border-b border-white/[0.06] bg-[#0b0b0c] px-6">
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
