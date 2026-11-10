import { Captions, Check, MonitorPlay } from 'lucide-react';
import type { EpisodeServer } from '@/types/player';

interface Props {
  servers: EpisodeServer[];
  activeId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
}

export function ServerSelector({
  servers,
  activeId,
  disabled = false,
  onSelect,
}: Props) {
  if (servers.length === 0)
    return <p className="text-xs text-white/45">Nenhum servidor disponível</p>;

  return (
    <div
      role="group"
      aria-label="Selecionar servidor de reprodução"
      className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"
    >
      {servers.map((server) => {
        const selected = server.id === activeId;
        const label = server.name.split(' · ').at(-1) ?? server.name;
        return (
          <button
            key={server.id}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onSelect(server.id)}
            className={`group flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-wait disabled:opacity-55 ${selected ? 'border-[#49d77a]/55 bg-[#49d77a]/10 text-white shadow-[0_0_18px_rgba(73,215,122,0.08)]' : 'border-white/[0.09] bg-white/[0.025] text-white/70 hover:border-white/20 hover:bg-white/[0.06]'}`}
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-lg ${selected ? 'bg-[#49d77a]/15 text-[#6feb92]' : 'bg-white/[0.06] text-white/45'}`}
            >
              <MonitorPlay size={16} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold">{label}</span>
              <span className="mt-1 flex flex-wrap gap-1.5">
                {server.subtitleLanguages.map((language) => (
                  <span
                    key={language}
                    className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[9px] font-semibold text-white/55"
                  >
                    <Captions
                      className="mr-1 inline"
                      size={10}
                      aria-hidden="true"
                    />
                    {language === 'pt-BR' ? 'PT-BR' : 'EN'}
                  </span>
                ))}
                {server.subtitlePresentation === 'embedded' && (
                  <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200/80">
                    H-SUB · EMBUTIDA
                  </span>
                )}
                {server.subtitleLanguages.length === 0 &&
                  server.subtitlePresentation !== 'embedded' && (
                    <span className="text-[9px] text-white/35">
                      Sem faixas detectadas
                    </span>
                  )}
              </span>
            </span>
            {selected && (
              <Check
                size={15}
                className="shrink-0 text-[#6feb92]"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
