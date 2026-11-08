import { CalendarDays, Clock3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AniListCatalog } from '@/services/anilist.service';
import type { AnimeResult } from '@/types/anime';
import { getAnimeImage, resolveAnimeTitle } from '@/lib/anime';

const DAY_MS = 24 * 60 * 60 * 1000;
const TIME_ZONE = 'America/Sao_Paulo';

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

export function SchedulePage() {
  const today = useMemo(() => getSãoPauloToday(), []);
  const startOfWeek = useMemo(() => {
    const offset = (today.getUTCDay() + 6) % 7;
    return new Date(today.getTime() - offset * DAY_MS);
  }, [today]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [state, setState] = useState<{
    date: number;
    items: AnimeResult[];
    error: string | null;
  }>({ date: Number.NaN, items: [], error: null });
  const days = useMemo(
    () =>
      Array.from(
        { length: 7 },
        (_, index) => new Date(startOfWeek.getTime() + index * DAY_MS),
      ),
    [startOfWeek],
  );

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

  return (
    <section>
      <div className="mb-7">
        <p className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
          <CalendarDays size={13} /> Temporada
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Agenda de episódios
        </h1>
        <p className="mt-2 text-xs text-white/40">
          Horários apresentados no fuso de Brasília.
        </p>
      </div>
      <div className="mb-7 grid grid-cols-7 gap-2">
        {days.map((day) => {
          const active = day.getTime() === selectedDate.getTime();
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDate(day)}
              className={`rounded-xl border px-3 py-3 text-center transition ${active ? 'border-[#49d77a]/50 bg-[#49d77a]/10 text-[#77e997]' : 'border-white/[0.07] bg-white/[0.02] text-white/50 hover:bg-white/[0.05]'}`}
            >
              <span className="block text-[10px] font-bold uppercase">
                {new Intl.DateTimeFormat('pt-BR', {
                  timeZone: TIME_ZONE,
                  weekday: 'short',
                })
                  .format(day)
                  .replace('.', '')}
              </span>
              <span className="mt-1 block text-lg font-bold tabular-nums">
                {new Intl.DateTimeFormat('pt-BR', {
                  timeZone: TIME_ZONE,
                  day: '2-digit',
                }).format(day)}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="h-[92px] animate-pulse rounded-xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300/10 bg-red-400/[0.04] p-5 text-sm text-red-200/80"
        >
          {error}
        </div>
      ) : items.length ? (
        <div className="space-y-2">
          {items.map((anime) => {
            const image = getAnimeImage(anime);
            return (
              <Link
                key={`${anime.id}-${anime.airingEpisode}`}
                to={`/anime/${anime.id}`}
                className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-white/10 hover:bg-white/[0.04]"
              >
                {image ? (
                  <img
                    src={image}
                    alt=""
                    className="h-16 w-12 rounded-md object-cover"
                  />
                ) : (
                  <span className="h-16 w-12 rounded-md bg-white/[0.05]" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-white/85">
                    {resolveAnimeTitle(anime.title)}
                  </span>
                  <span className="mt-1 block text-[10px] text-white/40">
                    Episódio {anime.airingEpisode}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-2 text-xs font-bold tabular-nums text-white/65">
                  <Clock3 size={13} className="text-[#65e48e]" />
                  {new Intl.DateTimeFormat('pt-BR', {
                    timeZone: TIME_ZONE,
                    hour: '2-digit',
                    minute: '2-digit',
                    hourCycle: 'h23',
                  }).format(new Date((anime.airingAt ?? 0) * 1000))}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-10 text-center text-sm text-white/45">
          Não há episódios programados para este dia.
        </div>
      )}
    </section>
  );
}
