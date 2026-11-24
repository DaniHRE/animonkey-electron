import { useEffect, useState } from 'react';
import {
  Activity,
  CircleAlert,
  Download,
  LoaderCircle,
  TriangleAlert,
  Trash2,
} from 'lucide-react';
import type {
  AnivexaDiagnosticEntry,
  AnivexaDiagnosticLevel,
  AnivexaDiagnosticsSnapshot,
} from '@/types/anivexa';

type DebugFilter = 'all' | AnivexaDiagnosticLevel;
type ActionFeedback = { kind: 'success' | 'error'; message: string } | null;

interface SettingsDebugPanelProps {
  isActive: boolean;
}

const levelPresentation = {
  info: {
    label: 'Info',
    icon: Activity,
    className: 'border-sky-300/15 bg-sky-300/[0.07] text-sky-200',
  },
  warning: {
    label: 'Aviso',
    icon: TriangleAlert,
    className: 'border-amber-200/15 bg-amber-200/[0.07] text-amber-100',
  },
  error: {
    label: 'Erro',
    icon: CircleAlert,
    className: 'border-red-200/15 bg-red-200/[0.07] text-red-100',
  },
} as const;

export function SettingsDebugPanel({ isActive }: SettingsDebugPanelProps) {
  const [diagnostics, setDiagnostics] = useState<AnivexaDiagnosticsSnapshot>({
    revision: -1,
    status: 'stopped',
    entries: [],
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [filter, setFilter] = useState<DebugFilter>('all');

  useEffect(() => {
    let active = true;
    const applySnapshot = (snapshot: AnivexaDiagnosticsSnapshot) => {
      if (!active) return;
      setDiagnostics((current) =>
        snapshot.revision >= current.revision ? snapshot : current,
      );
      setLoadError(null);
    };
    const unsubscribe =
      window.animonkey.anivexa.onDiagnosticsChanged(applySnapshot);
    void window.animonkey.anivexa
      .getDiagnostics()
      .then(applySnapshot)
      .catch(() => {
        if (active) {
          setLoadError('Não foi possível carregar os registros de debug.');
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const errorCount = diagnostics.entries.filter(
    (entry) => entry.level === 'error',
  ).length;
  const warningCount = diagnostics.entries.filter(
    (entry) => entry.level === 'warning',
  ).length;
  const infoCount = diagnostics.entries.filter(
    (entry) => entry.level === 'info',
  ).length;
  const filterOptions: Array<{
    value: DebugFilter;
    label: string;
    count: number;
  }> = [
    { value: 'all', label: 'Todos', count: diagnostics.entries.length },
    { value: 'error', label: 'Erros', count: errorCount },
    { value: 'warning', label: 'Avisos', count: warningCount },
    { value: 'info', label: 'Info', count: infoCount },
  ];
  const visibleEntries = [...diagnostics.entries]
    .reverse()
    .filter((entry) => filter === 'all' || entry.level === filter);

  const clearDiagnostics = async () => {
    setFeedback(null);
    setLoadError(null);
    try {
      const snapshot = await window.animonkey.anivexa.clearDiagnostics();
      setDiagnostics(snapshot);
      setFeedback({ kind: 'success', message: 'Registros limpos.' });
    } catch {
      setFeedback({
        kind: 'error',
        message: 'Não foi possível limpar os registros de debug.',
      });
    }
  };

  const exportDiagnostics = async () => {
    setFeedback(null);
    setIsExporting(true);
    try {
      const result = await window.animonkey.anivexa.exportDiagnostics();
      if (result.status === 'saved') {
        setFeedback({
          kind: 'success',
          message: 'Arquivo de debug exportado.',
        });
      }
    } catch {
      setFeedback({
        kind: 'error',
        message: 'Não foi possível exportar os registros de debug.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const runtimeStatusLabel = {
    stopped: 'Parado',
    starting: 'Iniciando',
    ready: 'Ativo',
    error: 'Falha',
  }[diagnostics.status];
  const runtimeStatusClass = {
    stopped: 'border-white/10 bg-white/[0.04] text-white/55',
    starting: 'border-amber-200/15 bg-amber-200/[0.07] text-amber-100',
    ready: 'border-[#49d77a]/20 bg-[#49d77a]/10 text-[#70e793]',
    error: 'border-red-200/15 bg-red-200/[0.07] text-red-100',
  }[diagnostics.status];

  return (
    <section
      id="settings-panel-diagnostics"
      role="tabpanel"
      aria-labelledby="settings-tab-diagnostics"
      tabIndex={0}
      hidden={!isActive}
      className="min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#49d77a]"
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
            Ferramentas
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Debug
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">
            Consulte e exporte os eventos recentes do runtime local da Anivexa.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${runtimeStatusClass}`}
        >
          <span
            className="size-1.5 rounded-full bg-current"
            aria-hidden="true"
          />
          Runtime {runtimeStatusLabel}
        </span>
      </header>

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101113] shadow-[0_16px_50px_rgba(0,0,0,0.2)]">
        <div className="border-b border-white/[0.07] p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#49d77a]/15 bg-[#49d77a]/[0.07] text-[#70e793]">
                <Activity size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white">
                  Eventos da sessão
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-white/45">
                  Até 100 registros sanitizados ficam na memória enquanto o app
                  está aberto.
                </p>
              </div>
            </div>
            <p className="shrink-0 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 font-mono text-[11px] text-white/45">
              {diagnostics.entries.length} / 100
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={`inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-[11px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#49d77a] ${
                    filter === option.value
                      ? 'border-white/15 bg-white/[0.07] text-white'
                      : 'border-white/[0.06] text-white/45 hover:border-white/10 hover:text-white/75'
                  }`}
                >
                  {option.label}
                  <span className="font-mono text-white/35">
                    {option.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={diagnostics.entries.length === 0 || isExporting}
                onClick={() => void exportDiagnostics()}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#49d77a]/20 bg-[#49d77a]/[0.08] px-3 text-xs font-semibold text-[#9af0b2] transition hover:bg-[#49d77a]/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isExporting ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {isExporting ? 'Exportando…' : 'Exportar logs'}
              </button>
              <button
                type="button"
                disabled={diagnostics.entries.length === 0 || isExporting}
                onClick={() => void clearDiagnostics()}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200/10 px-3 text-xs font-semibold text-red-100/75 transition hover:border-red-200/20 hover:bg-red-200/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={13} /> Limpar logs
              </button>
            </div>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-white/35">
            O arquivo inclui horários, status e resumos de chamadas, que podem
            indicar provedores e IDs de anime. URLs, headers, payloads e
            credenciais não são incluídos; revise o arquivo antes de
            compartilhar.
          </p>

          {loadError && (
            <p role="alert" className="mt-3 text-xs text-red-200/80">
              {loadError}
            </p>
          )}
          {feedback && (
            <p
              role={feedback.kind === 'error' ? 'alert' : 'status'}
              className={`mt-3 text-xs ${
                feedback.kind === 'error' ? 'text-red-200/80' : 'text-[#70e793]'
              }`}
            >
              {feedback.message}
            </p>
          )}
        </div>

        <ol
          role="log"
          aria-label="Registros recentes do runtime Anivexa"
          aria-relevant="additions"
          className="max-h-[min(58vh,540px)] min-h-64 divide-y divide-white/[0.05] overflow-y-auto bg-black/10 px-4 sm:px-6"
        >
          {visibleEntries.length ? (
            visibleEntries.map((entry: AnivexaDiagnosticEntry) => {
              const presentation = levelPresentation[entry.level];
              const Icon = presentation.icon;
              const time = new Date(entry.timestamp);
              return (
                <li
                  key={entry.id}
                  className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2 py-3 sm:grid-cols-[88px_82px_minmax(0,1fr)] sm:items-start sm:gap-x-4"
                >
                  <time
                    dateTime={time.toISOString()}
                    className="pt-0.5 font-mono text-[11px] tabular-nums text-white/35"
                  >
                    {time.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </time>
                  <span
                    className={`inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${presentation.className}`}
                  >
                    <Icon size={12} aria-hidden="true" />
                    {presentation.label}
                  </span>
                  <span className="col-span-2 min-w-0 break-words font-mono text-[11px] leading-relaxed text-white/70 sm:col-span-1 sm:text-xs">
                    {entry.message}
                  </span>
                </li>
              );
            })
          ) : (
            <li className="flex min-h-64 flex-col items-center justify-center px-4 py-10 text-center">
              <Activity
                size={19}
                className="mb-3 text-white/25"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-white/65">
                {diagnostics.entries.length === 0
                  ? 'Nenhum evento registrado nesta sessão.'
                  : `Nenhum evento de ${filter === 'error' ? 'erro' : filter === 'warning' ? 'aviso' : 'informação'} nesta sessão.`}
              </p>
              <p className="mt-1 text-xs text-white/35">
                Os novos eventos aparecerão aqui automaticamente.
              </p>
            </li>
          )}
        </ol>
      </section>
    </section>
  );
}
