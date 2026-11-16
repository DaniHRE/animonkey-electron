import { useMemo, useState } from 'react';
import { Captions, Check } from 'lucide-react';
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
    <div className="watch-server-selector">
      <div
        role="group"
        aria-label="Selecionar provedor de reprodução"
        className="watch-server-providers"
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
            className={`watch-server-provider ${group.provider === selectedGroup.provider ? 'is-active' : ''}`}
          >
            {group.label}
            <span className="watch-server-count">{group.servers.length}</span>
          </button>
        ))}
      </div>

      {selectedGroup && (
        <div
          role="group"
          aria-label={`Servidores do provedor ${selectedGroup.label}`}
          className="watch-server-options"
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
                className={`watch-server-option ${selected ? 'is-active' : ''}`}
              >
                <span className="watch-server-name">{server.serverName}</span>
                <span className="watch-server-languages">
                  {server.subtitleLanguages.map((language) => (
                    <span key={language} className="watch-server-language">
                      <Captions
                        className="mr-1 inline"
                        size={10}
                        aria-hidden="true"
                      />
                      {language === 'pt-BR' ? 'PT-BR' : 'EN'}
                    </span>
                  ))}
                  {server.subtitlePresentation === 'embedded' && (
                    <span className="watch-server-language is-embedded">
                      H-SUB · EMBUTIDA
                    </span>
                  )}
                  {server.subtitleLanguages.length === 0 &&
                    server.subtitlePresentation !== 'embedded' && (
                      <span className="watch-server-language is-unknown">
                        {server.subtitleType === 'softsub'
                          ? 'Sem idioma compatível'
                          : 'Idioma não identificado'}
                      </span>
                    )}
                </span>
                {selected && (
                  <Check
                    size={15}
                    className="watch-server-check"
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
