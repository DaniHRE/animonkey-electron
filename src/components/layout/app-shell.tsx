import {
  Bookmark,
  Activity,
  CalendarDays,
  ChevronDown,
  Clapperboard,
  Compass,
  Flame,
  History,
  House,
  ListVideo,
  Search,
  Sparkles,
  Languages,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAccount } from '@/context/account-state';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { useTitleLanguage } from '@/hooks/use-title-language';

const navItems = [
  { label: 'Início', path: '/', icon: House, end: true },
  { label: 'Explorar', path: '/search', icon: Compass },
  { label: 'Em alta', path: '/trending', icon: Flame },
  { label: 'Lançamentos', path: '/updates', icon: Sparkles },
  { label: 'Agenda', path: '/schedule', icon: CalendarDays },
  { label: 'Feed', path: '/activity', icon: Activity },
];

const libraryItems = [
  { label: 'Continuar assistindo', icon: History, path: '/continue-watching' },
  { label: 'Assistir Depois', icon: Bookmark, path: '/watch-later' },
  { label: 'Adicionados recentemente', icon: ListVideo, path: '/recent' },
  { label: 'Mais populares', icon: Flame, path: '/popular' },
  { label: 'Concluídos', icon: Clapperboard, path: '/completed' },
];

export function AppShell() {
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(true);
  const searchFormRef = useRef<HTMLFormElement>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { session } = useAccount();
  const { titleLanguage, toggleTitleLanguage } = useTitleLanguage();
  const useContentFrame =
    pathname !== '/' &&
    !pathname.startsWith('/anime/') &&
    !pathname.startsWith('/watch/');

  useEffect(() => {
    let previousY = window.scrollY;
    const updateSearchVisibility = () => {
      const currentY = window.scrollY;
      if (Math.abs(currentY - previousY) < 8) return;

      const searchIsFocused = searchFormRef.current?.contains(
        document.activeElement,
      );
      if (currentY < 48 || currentY < previousY || searchIsFocused) {
        setSearchVisible(true);
      } else if (currentY > 120) {
        setSearchVisible(false);
      }
      previousY = currentY;
    };

    window.addEventListener('scroll', updateSearchVisibility, {
      passive: true,
    });
    return () => window.removeEventListener('scroll', updateSearchVisibility);
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
  }

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-[#f5f5f5]">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[244px] flex-col border-r border-white/[0.06] bg-[#0d0d0f] px-4 py-6">
        <NavLink to="/" className="mb-10 flex items-center gap-3 px-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#49d77a] text-[#07110a]">
            <Clapperboard size={21} strokeWidth={2.2} />
          </span>
          <span className="text-[19px] font-extrabold tracking-tight">
            ani<span className="text-[#49d77a]">monkey</span>
          </span>
        </NavLink>

        <p className="px-3 pb-3 text-[10px] font-bold tracking-[0.2em] text-white/35 uppercase">
          Descobrir
        </p>
        <nav className="space-y-1" aria-label="Navegação principal">
          {navItems.map(({ label, path, icon: Icon, end }) => (
            <NavLink
              key={label}
              to={path}
              end={end}
              className={({ isActive }) =>
                `flex h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition ${
                  isActive
                    ? 'bg-[#49d77a]/10 text-[#67e58f]'
                    : 'text-white/55 hover:bg-white/[0.05] hover:text-white'
                }`
              }
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>

        <p className="mt-9 px-3 pb-3 text-[10px] font-bold tracking-[0.2em] text-white/35 uppercase">
          Minha biblioteca
        </p>
        <nav className="space-y-1" aria-label="Biblioteca">
          {libraryItems.map(({ label, icon: Icon, path }) =>
            path ? (
              <NavLink
                key={label}
                to={path}
                className={({ isActive }) =>
                  `flex h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition ${
                    isActive
                      ? 'bg-[#49d77a]/10 text-[#67e58f]'
                      : 'text-white/55 hover:bg-white/[0.05] hover:text-white'
                  }`
                }
              >
                <Icon size={18} strokeWidth={1.8} />
                {label}
              </NavLink>
            ) : (
              <button
                key={label}
                type="button"
                disabled
                title="Esta seção será conectada na próxima etapa da migração"
                className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium text-white/35"
              >
                <Icon size={18} strokeWidth={1.8} />
                {label}
                <span className="ml-auto text-[9px] text-white/25">
                  EM BREVE
                </span>
              </button>
            ),
          )}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-white/80">
            <Clapperboard size={15} className="text-[#49d77a]" />
            Animonkey Desktop
          </div>
          <p className="text-[11px] leading-relaxed text-white/40">
            Sua biblioteca de animes, agora no desktop.
          </p>
        </div>
      </aside>

      <div className="ml-[244px] min-h-screen">
        <a
          href="#main-content"
          className="sr-only z-50 rounded bg-[#49d77a] p-3 text-sm font-bold text-black focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Pular para o conteúdo
        </a>
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-white/[0.06] bg-[#0b0b0c]/85 px-10 backdrop-blur-xl">
          {pathname !== '/search' && (
            <form
              ref={searchFormRef}
              onSubmit={submitSearch}
              aria-hidden={!searchVisible}
              className={`absolute top-1/2 left-1/2 z-10 w-[min(520px,calc(100%-430px))] -translate-x-1/2 transition-[opacity,transform] duration-200 ${searchVisible ? '-translate-y-1/2 opacity-100' : '-translate-y-[140%] pointer-events-none opacity-0'}`}
            >
              <Search
                size={17}
                className="absolute top-1/2 left-4 -translate-y-1/2 text-white/35"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Busque por anime, gênero ou temporada..."
                aria-label="Buscar animes"
                tabIndex={searchVisible ? 0 : -1}
                className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.035] pr-16 pl-11 text-[13px] text-white outline-none transition placeholder:text-white/30 focus:border-[#49d77a]/45 focus:bg-white/[0.05]"
              />
              <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md border border-white/10 px-1.5 py-1 text-[9px] text-white/30">
                ENTER
              </kbd>
            </form>
          )}

          <div className="ml-auto flex items-center gap-4">
            <div
              className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] p-1"
              aria-label="Idioma dos títulos"
            >
              <Languages size={14} className="ml-1 text-white/35" />
              {(['en', 'jp'] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => {
                    if (titleLanguage !== language) toggleTitleLanguage();
                  }}
                  aria-pressed={titleLanguage === language}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${titleLanguage === language ? 'bg-[#2caf57] text-[#0d0d0d]' : 'text-white/45 hover:text-white'}`}
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
          className="min-h-[calc(100vh-76px)] w-full p-0 outline-none"
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
