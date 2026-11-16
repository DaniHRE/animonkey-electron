import { useMemo, useState } from 'react';
import { Captions, Check, MonitorPlay } from 'lucide-react';
import type { EpisodeServer } from '@/types/player';

interface Props {
  servers: EpisodeServer[];
  activeId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
}

function languagePriority(server: EpisodeServer): number {
  if (server.subtitleLanguages.includes('pt-BR')) return 0;
  if (server.subtitlePresentation === 'embedded') return 1;
  if (server.subtitleLanguages.includes('en')) return 2;
  return 3;
}

function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    reiname: 'Reanime',
    anikoto: 'AniKoto',
    animegg: 'AnimeGG',
    anineko: 'AniNeko',
    anibdapp: 'AniBD App',
    '2dhive': '2DHive',
    anibd: 'AniBD',
    aniwaves: 'AniWaves',
    senshi: 'Senshi',
    anizone: 'AniZone',
    animeonsen: 'AnimeOnsen',
    animedunya: 'Animedunia',
    kaa: 'KAA',
    animenosub: 'AnimeNoSub',
    mkissa: 'MKissa',
  };
  const knownLabel = labels[provider.toLowerCase()];
  if (knownLabel) return knownLabel;
  return provider
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ServerSelector({
  servers,
  activeId,
  disabled = false,
  onSelect,
}: Props) {
  const activeServer = servers.find((server) => server.id === activeId);
  const providerGroups = useMemo(() => {
    const groups = new Map<string, EpisodeServer[]>();
    for (const server of servers) {
      const group = groups.get(server.provider) ?? [];
      group.push(server);
      groups.set(server.provider, group);
    }
    return [...groups]
      .map(([provider, entries]) => ({
        provider,
        label: providerLabel(provider),
        servers: entries.sort(
          (first, second) => languagePriority(first) - languagePriority(second),
        ),
        priority: Math.min(...entries.map(languagePriority)),
      }))
      .sort((first, second) => first.priority - second.priority);
  }, [servers]);
  const firstProvider = providerGroups[0]?.provider ?? '';
  const [providerSelection, setProviderSelection] = useState<{
    activeId: string;
    provider: string;
  } | null>(null);
  const selectedProvider =
    providerSelection?.activeId === activeId
      ? providerSelection.provider
      : (activeServer?.provider ?? firstProvider);

  if (servers.length === 0)
    return <p className="text-xs text-white/45">Nenhum servidor disponível</p>;

  const selectedGroup =
    providerGroups.find((group) => group.provider === selectedProvider) ??
    providerGroups[0];

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Selecionar provedor de reprodução"
        className="flex flex-wrap gap-2"
      >
        {providerGroups.map((group) => (
          <button
            key={group.provider}
            type="button"
            aria-pressed={group.provider === selectedGroup.provider}
            disabled={disabled}
            onClick={() =>
              setProviderSelection({ activeId, provider: group.provider })
            }
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors disabled:cursor-wait disabled:opacity-55 ${group.provider === selectedGroup.provider ? 'border-[#49d77a]/55 bg-[#49d77a]/10 text-white' : 'border-white/[0.09] bg-white/[0.025] text-white/65 hover:border-white/20 hover:bg-white/[0.06]'}`}
          >
            {group.label}
            <span className="ml-2 text-[10px] font-medium text-white/45">
              {group.servers.length}
            </span>
          </button>
        ))}
      </div>

      {selectedGroup && (
        <div
          role="group"
          aria-label={`Servidores do provedor ${selectedGroup.label}`}
          className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"
        >
          {selectedGroup.servers.map((server) => {
            const selected = server.id === activeId;
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
                  <span className="block truncate text-xs font-bold">
                    {server.serverName}
                  </span>
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
                          {server.subtitleType === 'softsub'
                            ? 'Sem idioma compatível'
                            : 'Idioma não identificado'}
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
      )}
    </div>
  );
}
