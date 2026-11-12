import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Play,
  Tv,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTitleLanguage } from '@/hooks/use-title-language';
import { getAnimeImage, resolveAnimeTitle } from '@/lib/anime';
import { AniListCatalog } from '@/services/anilist.service';
import type { AnimeResult } from '@/types/anime';

const DAY_MS = 24 * 60 * 60 * 1000;
const TIME_ZONE = 'America/Sao_Paulo';
const WEEKDAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

function getSãoPauloToday(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .split('-')
    .map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12));
}

function formatDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('pt-BR', {
    ...options,
    timeZone: TIME_ZONE,
  }).format(date);
}

export function SchedulePage() {
  const { titleLanguage } = useTitleLanguage();
  const today = useMemo(() => getSãoPauloToday(), []);
  const startOfWeek = useMemo(() => {
    const mondayOffset = (today.getUTCDay() + 6) % 7;
    return new Date(today.getTime() - mondayOffset * DAY_MS);
  }, [today]);
  const [weekOffset, setWeekOffset] = useState(0);
  const days = useMemo(
    () =>
      Array.from(
        { length: 7 },
        (_, index) =>
          new Date(startOfWeek.getTime() + (weekOffset * 7 + index) * DAY_MS),
      ),
    [startOfWeek, weekOffset],
  );
  const [selectedDate, setSelectedDate] = useState(today);
  const [state, setState] = useState<{
    date: number;
    items: AnimeResult[];
    error: string | null;
  }>({ date: Number.NaN, items: [], error: null });

  useEffect(() => {
    const controller = new AbortController();
    AniListCatalog.schedule(selectedDate, controller.signal)
      .then((items) =>
        setState({ date: selectedDate.getTime(), items, error: null }),
      )
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            date: selectedDate.getTime(),
            items: [],
            error:
              cause instanceof Error
                ? cause.message
                : 'Falha ao carregar a agenda.',
          });
        }
      });
    return () => controller.abort();
  }, [selectedDate]);

  const loading = state.date !== selectedDate.getTime();
  const items = loading ? [] : state.items;
  const error = loading ? null : state.error;
  const selectedIndex = days.findIndex(
    (day) => day.getTime() === selectedDate.getTime(),
  );
  const rangeLabel = `${formatDate(days[0], { day: 'numeric', month: 'short' })} — ${formatDate(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`;

  function changeWeek(direction: -1 | 1) {
    const nextOffset = weekOffset + direction;
    const nextDays = Array.from(
      { length: 7 },
      (_, index) =>
        new Date(startOfWeek.getTime() + (nextOffset * 7 + index) * DAY_MS),
    );
    setWeekOffset(nextOffset);
    setSelectedDate(nextOffset === 0 ? today : nextDays[0]);
  }

  return (
    <section className="space-y-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-2xl border border-[#49d77a]/20 bg-[#49d77a]/10 text-[#70e793] shadow-[0_0_36px_rgba(73,215,122,0.08)]">
            <CalendarDays size={23} />
          </span>
          <div>
            <p className="mb-1 text-[10px] font-bold tracking-[0.2em] text-[#70e793] uppercase">
              Programação semanal
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Agenda de episódios
            </h1>
            <p className="mt-1 text-xs text-white/45">
              Acompanhe os próximos lançamentos no horário de Brasília.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1.5">
          <button
            type="button"
            onClick={() => changeWeek(-1)}
            aria-label="Semana anterior"
            className="grid size-9 place-items-center rounded-lg text-white/60 transition hover:bg-white/[0.07] hover:text-white"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-32 text-center text-xs font-semibold tabular-nums text-white/75">
            {rangeLabel}
          </span>
          <button
            type="button"
            onClick={() => changeWeek(1)}
            aria-label="Próxima semana"
            className="grid size-9 place-items-center rounded-lg text-white/60 transition hover:bg-white/[0.07] hover:text-white"
          >
            <ChevronRight size={18} />
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => {
                setWeekOffset(0);
                setSelectedDate(today);
              }}
              className="ml-1 rounded-lg border border-white/[0.08] px-3 py-2 text-[10px] font-semibold text-white/65 transition hover:border-[#49d77a]/30 hover:text-white"
            >
              Esta semana
            </button>
          )}
        </div>
      </header>

      <nav
        aria-label="Dias da semana"
        className="grid grid-cols-7 gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2 sm:gap-3 sm:p-3"
      >
        {days.map((day, index) => {
          const active = selectedIndex === index;
          const isToday = day.getTime() === today.getTime();
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDate(day)}
              aria-pressed={active}
              className={`relative flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-xl border transition sm:min-h-[88px] ${active ? 'border-[#49d77a]/50 bg-[#49d77a]/12 text-white shadow-[0_8px_24px_rgba(73,215,122,0.08)]' : 'border-transparent text-white/55 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'}`}
            >
              <span className="text-[9px] font-bold tracking-[0.1em] text-white/45 sm:text-[10px]">
                {WEEKDAY_LABELS[index]}
              </span>
              <span
                className={`text-xl leading-none font-bold tabular-nums sm:text-2xl ${active ? 'text-[#70e793]' : ''}`}
              >
                {formatDate(day, { day: '2-digit' })}
              </span>
              {isToday && (
                <span className="text-[8px] font-bold tracking-wider text-[#70e793] uppercase">
                  Hoje
                </span>
              )}
              {active && !isToday && (
                <span className="absolute bottom-1.5 size-1 rounded-full bg-[#70e793]" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-[#70e793] uppercase">
            {formatDate(selectedDate, { weekday: 'long' })}
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">
            {formatDate(selectedDate, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-xs font-medium text-white/55">
          <Clock3 size={14} className="text-[#70e793]" />
          {loading ? 'Carregando episódios…' : `${items.length} episódios`}
        </span>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]"
            />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-300/10 bg-red-400/[0.04] p-5 text-sm text-red-200/80"
        >
          {error}
        </div>
      ) : items.length ? (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {items.map((anime) => {
            const image = getAnimeImage(anime);
            const time = new Intl.DateTimeFormat('pt-BR', {
              timeZone: TIME_ZONE,
              hour: '2-digit',
              minute: '2-digit',
              hourCycle: 'h23',
            }).format(new Date((anime.airingAt ?? 0) * 1000));
            const title = resolveAnimeTitle(anime.title, titleLanguage);
            return (
              <Link
                key={`${anime.id}-${anime.airingEpisode}`}
                to={`/anime/${anime.id}`}
                className="group flex min-h-36 gap-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 transition hover:border-[#49d77a]/25 hover:bg-white/[0.045]"
              >
                <div className="relative h-32 w-[90px] shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-white/25">
                      <Tv size={22} />
                    </div>
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/90 to-black/10 px-1 pb-2 pt-5 text-xs font-bold tabular-nums text-white">
                    <Clock3 size={12} className="text-[#70e793]" /> {time}
                  </span>
                </div>
                <span className="flex min-w-0 flex-1 flex-col py-0.5">
                  <span className="line-clamp-2 text-sm leading-snug font-semibold text-white/85 transition group-hover:text-white">
                    {title}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {(anime.genres ?? []).slice(0, 2).map((genre) => (
                      <span
                        key={genre}
                        className="rounded-md bg-white/[0.06] px-1.5 py-1 text-[9px] font-medium text-white/45"
                      >
                        {genre}
                      </span>
                    ))}
                  </span>
                  <span className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[#49d77a]/10 px-2 py-1 text-[10px] font-bold text-[#70e793]">
                      <Play size={10} fill="currentColor" /> Episódio{' '}
                      {anime.airingEpisode ?? '—'}
                    </span>
                    {anime.type && (
                      <span className="truncate text-[9px] font-medium text-white/30">
                        {anime.type}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.015] px-6 text-center">
          <span className="mb-4 grid size-14 place-items-center rounded-full bg-white/[0.04] text-white/25">
            <CalendarDays size={24} />
          </span>
          <h3 className="text-sm font-semibold text-white/75">
            Nenhum episódio programado
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-white/40">
            Não encontramos lançamentos para este dia. Escolha outra data da
            semana para conferir a programação.
          </p>
        </div>
      )}
    </section>
  );
}
