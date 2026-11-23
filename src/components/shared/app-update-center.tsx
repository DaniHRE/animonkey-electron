import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowDownToLine,
  BookmarkCheck,
  CircleAlert,
  CircleCheck,
  Compass,
  History,
  LoaderCircle,
  Play,
  RefreshCw,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import releaseNotes from '@/data/release-notes.json';
import type { AppUpdateSnapshot, AppUpdateStatus } from '@/types/updates';
import './app-update-center.css';

type ReleaseNoteIcon = 'discover' | 'library' | 'sync' | 'play';

interface ReleaseNotesEntry {
  eyebrow: string;
  title: string;
  summary: string;
  highlights: Array<{
    icon: ReleaseNoteIcon;
    title: string;
    description: string;
  }>;
}

const releaseNotesByVersion = releaseNotes as Record<string, ReleaseNotesEntry>;
const releaseVersions = Object.keys(releaseNotesByVersion).sort(
  (first, second) =>
    second.localeCompare(first, undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
);
const noteIcons = {
  discover: Compass,
  library: BookmarkCheck,
  sync: RefreshCw,
  play: Play,
} satisfies Record<ReleaseNoteIcon, LucideIcon>;
const VERSION_STORAGE_KEY = 'animonkey:last-seen-app-version';
type UpdateCenterPanel = 'update' | 'whats-new' | 'history';

const updateCopy: Record<
  AppUpdateStatus,
  { label: string; title: string; detail: string }
> = {
  unsupported: {
    label: 'Atualizações automáticas indisponíveis',
    title: 'Atualizações para Windows',
    detail:
      'O canal automático está disponível para a versão Windows x64 do Animonkey.',
  },
  idle: {
    label: 'Atualização ainda não verificada',
    title: 'Confira se há novidades',
    detail: 'O Animonkey verifica atualizações estáveis automaticamente.',
  },
  checking: {
    label: 'Verificando atualizações',
    title: 'Procurando uma versão nova',
    detail: 'Isso pode levar alguns instantes.',
  },
  downloading: {
    label: 'Baixando uma atualização',
    title: 'A atualização está a caminho',
    detail:
      'O download acontece em segundo plano. Você pode continuar usando o Animonkey.',
  },
  ready: {
    label: 'Atualização pronta para instalar',
    title: 'Uma nova versão está pronta',
    detail:
      'Reinicie o Animonkey para instalar. As novidades desta versão aparecem depois da atualização.',
  },
  current: {
    label: 'Animonkey atualizado',
    title: 'Você está em dia',
    detail: 'Esta é a versão estável mais recente disponível.',
  },
  error: {
    label: 'Não foi possível verificar atualizações',
    title: 'Não conseguimos verificar agora',
    detail: 'Confira sua conexão e tente novamente.',
  },
};

function AppUpdateIcon({
  status,
  className,
  size,
}: {
  status: AppUpdateStatus;
  className?: string;
  size: number;
}) {
  const iconProps = { size, strokeWidth: 1.9, className, 'aria-hidden': true };
  switch (status) {
    case 'checking':
      return <LoaderCircle {...iconProps} />;
    case 'downloading':
      return <LoaderCircle {...iconProps} />;
    case 'ready':
      return <ArrowDownToLine {...iconProps} />;
    case 'current':
      return <CircleCheck {...iconProps} />;
    case 'error':
      return <CircleAlert {...iconProps} />;
    default:
      return <Sparkles {...iconProps} />;
  }
}

function ReleaseHighlights({ release }: { release: ReleaseNotesEntry }) {
  return (
    <ul className="app-update-dialog__highlights">
      {release.highlights.map((highlight) => {
        const Icon = noteIcons[highlight.icon];
        return (
          <li key={highlight.title}>
            <span className="app-update-dialog__highlight-icon">
              <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span>
              <strong>{highlight.title}</strong>
              <span>{highlight.description}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AppUpdateCenter() {
  const [snapshot, setSnapshot] = useState<AppUpdateSnapshot | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [panel, setPanel] = useState<UpdateCenterPanel>('whats-new');
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<
    string | null
  >(null);
  const [bridgeError, setBridgeError] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const processedVersion = useRef<string | null>(null);
  const previousStatus = useRef<AppUpdateStatus | null>(null);

  useEffect(() => {
    let active = true;
    const applySnapshot = (next: AppUpdateSnapshot) => {
      if (!active) return;
      setSnapshot((current) =>
        !current || next.revision >= current.revision ? next : current,
      );

      if (processedVersion.current !== next.currentVersion) {
        processedVersion.current = next.currentVersion;
        try {
          const previousVersion =
            window.localStorage.getItem(VERSION_STORAGE_KEY);
          if (previousVersion && previousVersion !== next.currentVersion) {
            setPanel('whats-new');
            setIsOpen(true);
          }
          window.localStorage.setItem(VERSION_STORAGE_KEY, next.currentVersion);
        } catch {
          // Release notes remain available from the header if storage is unavailable.
        }
      }

      if (next.status === 'ready' && previousStatus.current !== 'ready') {
        setPanel('update');
        setIsOpen(true);
      }
      previousStatus.current = next.status;
    };
    const unsubscribe = window.animonkey.updates.onStateChanged(applySnapshot);
    void window.animonkey.updates
      .getState()
      .then(applySnapshot)
      .catch(() => {
        if (active) setBridgeError(true);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const status = snapshot?.status ?? 'idle';
  const currentVersion = snapshot?.currentVersion ?? '—';
  const statusMessage = bridgeError
    ? 'Não foi possível acessar as atualizações. Tente novamente.'
    : updateCopy[status].detail;
  const release = releaseNotesByVersion[currentVersion];
  const historyVersion = releaseVersions.includes(selectedHistoryVersion ?? '')
    ? selectedHistoryVersion
    : (releaseVersions[0] ?? null);
  const historyRelease = historyVersion
    ? releaseNotesByVersion[historyVersion]
    : null;
  const canBrowseHistory = releaseVersions.length > 1;
  const isBusy = status === 'checking' || status === 'downloading';
  const busyActionLabel =
    status === 'downloading' ? 'Baixando…' : 'Verificando…';

  const openCenter = () => {
    setPanel('update');
    setIsOpen(true);
  };

  const openHistory = () => {
    setSelectedHistoryVersion(
      releaseVersions.includes(currentVersion)
        ? currentVersion
        : (releaseVersions[0] ?? null),
    );
    setPanel('history');
  };

  const checkNow = () => {
    setBridgeError(false);
    void window.animonkey.updates.checkNow().catch(() => setBridgeError(true));
  };

  const installUpdate = () => {
    setBridgeError(false);
    void window.animonkey.updates.install().catch(() => setBridgeError(true));
  };

  return (
    <div className="app-update-center">
      <button
        type="button"
        className="app-update-center__trigger"
        data-status={status}
        onClick={openCenter}
        aria-label={`Atualizações e novidades. ${updateCopy[status].label}.`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="Atualizações e novidades"
      >
        <AppUpdateIcon
          status={status}
          size={18}
          className={isBusy ? 'app-update-center__spin' : undefined}
        />
        {status !== 'idle' &&
          status !== 'current' &&
          status !== 'unsupported' && (
            <span className="app-update-center__indicator" aria-hidden="true" />
          )}
      </button>

      <dialog
        ref={dialogRef}
        className="app-update-dialog"
        aria-labelledby="app-update-dialog-title"
        onClose={() => setIsOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          setIsOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setIsOpen(false);
        }}
      >
        <div className="app-update-dialog__surface">
          <div className="app-update-dialog__topline">
            <div className="app-update-dialog__brand-mark" aria-hidden="true">
              <Sparkles size={21} strokeWidth={1.8} />
            </div>
            <span className="app-update-dialog__version">
              ANIMONKEY <span>·</span> v{currentVersion}
            </span>
            <button
              type="button"
              className="app-update-dialog__close"
              aria-label="Fechar"
              onClick={() => setIsOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {panel === 'update' ? (
            <section className="app-update-dialog__content">
              <div className={`app-update-dialog__status-icon is-${status}`}>
                <AppUpdateIcon
                  status={status}
                  size={24}
                  className={isBusy ? 'app-update-center__spin' : undefined}
                />
              </div>
              <p className="app-update-dialog__eyebrow">ATUALIZAÇÃO</p>
              <h2 id="app-update-dialog-title">{updateCopy[status].title}</h2>
              <p className="app-update-dialog__summary">{statusMessage}</p>
              <div className="app-update-dialog__status-line" role="status">
                <span
                  className={`app-update-center__indicator is-${status}`}
                  aria-hidden="true"
                />
                {updateCopy[status].label}
              </div>
              <div className="app-update-dialog__actions">
                {status === 'ready' ? (
                  <>
                    <Button onClick={installUpdate}>
                      <ArrowDownToLine aria-hidden="true" />
                      Reiniciar para atualizar
                    </Button>
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>
                      Mais tarde
                    </Button>
                  </>
                ) : (
                  <>
                    {status !== 'unsupported' && (
                      <Button onClick={checkNow} disabled={isBusy}>
                        {isBusy ? (
                          <LoaderCircle
                            className="app-update-center__spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <RefreshCw aria-hidden="true" />
                        )}
                        {isBusy ? busyActionLabel : 'Verificar novamente'}
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>
                      Fechar
                    </Button>
                  </>
                )}
                {release && (
                  <Button variant="ghost" onClick={() => setPanel('whats-new')}>
                    Ver novidades da v{currentVersion}
                  </Button>
                )}
                {canBrowseHistory && (
                  <Button variant="ghost" onClick={openHistory}>
                    <History aria-hidden="true" />
                    Histórico de versões
                  </Button>
                )}
              </div>
            </section>
          ) : panel === 'history' ? (
            <section className="app-update-dialog__content">
              <p className="app-update-dialog__eyebrow">
                HISTÓRICO DE ATUALIZAÇÕES
              </p>
              <h2 id="app-update-dialog-title">Novidades por versão</h2>
              <p className="app-update-dialog__summary">
                Consulte as mudanças incluídas nas versões anteriores do
                Animonkey.
              </p>

              {historyRelease && historyVersion ? (
                <div className="app-update-dialog__history-layout">
                  <nav
                    className="app-update-dialog__history-versions"
                    aria-label="Versões com notas de atualização"
                  >
                    {releaseVersions.map((version) => (
                      <button
                        key={version}
                        type="button"
                        className="app-update-dialog__history-version"
                        data-selected={historyVersion === version}
                        aria-pressed={historyVersion === version}
                        onClick={() => setSelectedHistoryVersion(version)}
                      >
                        <span>v{version}</span>
                        <span>{releaseNotesByVersion[version].eyebrow}</span>
                      </button>
                    ))}
                  </nav>
                  <article
                    className="app-update-dialog__history-entry"
                    aria-live="polite"
                  >
                    <p className="app-update-dialog__eyebrow">
                      {historyRelease.eyebrow}
                    </p>
                    <h3>{historyRelease.title}</h3>
                    <p className="app-update-dialog__summary">
                      {historyRelease.summary}
                    </p>
                    <ReleaseHighlights release={historyRelease} />
                  </article>
                </div>
              ) : (
                <p className="app-update-dialog__missing-notes">
                  Ainda não há notas de versão disponíveis.
                </p>
              )}

              <div className="app-update-dialog__actions">
                <Button variant="ghost" onClick={() => setPanel('update')}>
                  <ArrowLeft aria-hidden="true" />
                  Estado da atualização
                </Button>
                <Button variant="ghost" onClick={() => setIsOpen(false)}>
                  Fechar
                </Button>
              </div>
            </section>
          ) : (
            <section className="app-update-dialog__content">
              <p className="app-update-dialog__eyebrow">
                {release?.eyebrow ?? 'NOVIDADES'}
              </p>
              <h2 id="app-update-dialog-title">
                {release?.title ?? `Novidades da versão ${currentVersion}`}
              </h2>
              <p className="app-update-dialog__summary">
                {release?.summary ??
                  'As notas desta versão ainda não foram adicionadas.'}
              </p>

              {release ? (
                <ReleaseHighlights release={release} />
              ) : (
                <p className="app-update-dialog__missing-notes">
                  As notas serão exibidas assim que forem incluídas nesta
                  versão.
                </p>
              )}

              <div className="app-update-dialog__actions">
                <Button variant="ghost" onClick={() => setPanel('update')}>
                  Estado da atualização
                </Button>
                {canBrowseHistory && (
                  <Button variant="ghost" onClick={openHistory}>
                    <History aria-hidden="true" />
                    Histórico de versões
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setIsOpen(false)}>
                  Fechar
                </Button>
                {status !== 'unsupported' && (
                  <Button onClick={checkNow} disabled={isBusy}>
                    {isBusy ? (
                      <LoaderCircle
                        className="app-update-center__spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <RefreshCw aria-hidden="true" />
                    )}
                    {isBusy ? busyActionLabel : 'Verificar atualização'}
                  </Button>
                )}
              </div>
            </section>
          )}
        </div>
      </dialog>
    </div>
  );
}
