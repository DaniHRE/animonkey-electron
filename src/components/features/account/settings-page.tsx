import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bell,
  Bug,
  Captions,
  Cloud,
  Download,
  HardDrive,
  Keyboard,
  Languages,
  LogOut,
  MessageSquareText,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import { useAccount } from '@/context/account-state';
import { useAdultContentPreference } from '@/hooks/use-adult-content-preference';
import { useAiringNotificationPreferences } from '@/hooks/use-airing-notification-preferences';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { useTitleLanguage } from '@/hooks/use-title-language';
import {
  useContinueWatchingVisibilityPreference,
  useRecordWatchProgressPreference,
  useSyncWatchProgressPreference,
} from '@/hooks/use-watch-history-preferences';
import {
  DEFAULT_SUBTITLE_SIZE,
  isSubtitleSize,
  normalizeSubtitleSize,
  SUBTITLE_SIZE_PREFERENCE_KEY,
} from '@/lib/subtitle-appearance';
import { PROVIDER_FAILURE_REPORTING_PREFERENCE_KEY } from '@/lib/provider-failure-reporting';
import {
  createShortcutBinding,
  DEFAULT_SHORTCUT_PREFERENCES,
  findShortcutCollision,
  formatShortcutBinding,
  normalizeShortcutPreferences,
  SHORTCUT_COMMANDS,
  SHORTCUT_PREFERENCE_KEY,
} from '@/lib/keyboard-shortcuts';
import type { ShortcutCommandId } from '@/lib/keyboard-shortcuts';
import {
  DEFAULT_SIDEBAR_ROUTE_ORDER,
  moveSidebarRoute,
  normalizeSidebarRouteOrder,
  SIDEBAR_ORDER_PREFERENCE_KEY,
} from '@/lib/sidebar-route-order';
import type { SidebarRouteId } from '@/lib/sidebar-route-order';
import {
  exportLocalBackup,
  importLocalBackup,
} from '@/services/cache/local-db';
import { SettingsDebugPanel } from './settings-debug-panel';
import { FeedbackSettingsSection } from './feedback-settings-section';

const settingsSections = [
  { id: 'account', label: 'Conta', icon: UserRound },
  { id: 'feedback', label: 'Feedback', icon: MessageSquareText },
  { id: 'privacy', label: 'Privacidade', icon: Shield },
  { id: 'notifications', label: 'Notificações', icon: Bell },
  { id: 'preferences', label: 'Preferências', icon: Languages },
  { id: 'shortcuts', label: 'Atalhos', icon: Keyboard },
  { id: 'navigation', label: 'Navegação', icon: ArrowUpDown },
  { id: 'diagnostics', label: 'Debug', icon: Bug },
  { id: 'captions', label: 'Legendas', icon: Captions },
  { id: 'backup', label: 'Backup', icon: HardDrive },
] as const;

type SettingsSectionId = (typeof settingsSections)[number]['id'];

const sidebarRouteLabels: Record<SidebarRouteId, string> = {
  schedule: 'Agenda',
  activity: 'Feed',
  updates: 'Lançamentos',
  trending: 'Em alta',
  'continue-watching': 'Continuar assistindo',
  'watch-later': 'Assistir Depois',
};

const sidebarOrderSections = [
  { id: 'primary', title: 'Navegação principal' },
  { id: 'more', title: 'Mais opções' },
] as const;

export function SettingsPage() {
  const {
    session,
    syncState,
    syncError,
    login,
    register,
    logout,
    syncNow,
    importGuestLibrary,
    updateProfile,
  } = useAccount();
  const { titleLanguage, setTitleLanguage } = useTitleLanguage();
  const recordWatchProgress = useRecordWatchProgressPreference();
  const continueWatchingVisibility = useContinueWatchingVisibilityPreference();
  const syncWatchProgress = useSyncWatchProgressPreference();
  const airingNotifications = useAiringNotificationPreferences();
  const {
    value: providerFailureReportingEnabled,
    update: setProviderFailureReportingEnabled,
    loaded: providerFailureReportingLoaded,
  } = useLocalPreference(PROVIDER_FAILURE_REPORTING_PREFERENCE_KEY, false);
  const [notificationsSupported, setNotificationsSupported] = useState<
    boolean | null
  >(null);
  const {
    includeAdult,
    setIncludeAdult,
    loaded: adultPreferenceLoaded,
  } = useAdultContentPreference();
  const {
    value: storedShortcuts,
    update: updateStoredShortcuts,
    loaded: shortcutsLoaded,
  } = useLocalPreference<unknown>(
    SHORTCUT_PREFERENCE_KEY,
    DEFAULT_SHORTCUT_PREFERENCES,
  );
  const {
    value: storedSidebarRouteOrder,
    update: updateStoredSidebarRouteOrder,
    loaded: sidebarRouteOrderLoaded,
  } = useLocalPreference<unknown>(
    SIDEBAR_ORDER_PREFERENCE_KEY,
    DEFAULT_SIDEBAR_ROUTE_ORDER,
  );
  const {
    value: storedSubtitleSize,
    update: updateStoredSubtitleSize,
    loaded: subtitlePreferenceLoaded,
  } = useLocalPreference<unknown>(
    SUBTITLE_SIZE_PREFERENCE_KEY,
    DEFAULT_SUBTITLE_SIZE,
  );
  const shortcutPreferences = useMemo(
    () => normalizeShortcutPreferences(storedShortcuts),
    [storedShortcuts],
  );
  const sidebarRouteOrder = useMemo(
    () => normalizeSidebarRouteOrder(storedSidebarRouteOrder),
    [storedSidebarRouteOrder],
  );
  const subtitleSize = normalizeSubtitleSize(storedSubtitleSize);
  const [capturingShortcut, setCapturingShortcut] =
    useState<ShortcutCommandId | null>(null);
  const [shortcutFeedback, setShortcutFeedback] = useState<string | null>(null);
  const [sidebarOrderFeedback, setSidebarOrderFeedback] = useState<
    string | null
  >(null);
  const platform = window.animonkey.platform;
  const backupInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<'login' | 'register'>('login');
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<SettingsSectionId>('account');
  const settingsTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [profileDraft, setProfileDraft] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [privacy, setPrivacy] = useState<{
    userId: string;
    value: boolean;
  } | null>(null);
  const activityPrivacy =
    privacy?.userId === session?.user.id ? (privacy?.value ?? null) : null;
  const sessionUserId = session?.user.id ?? null;

  const captureShortcut = (
    event: KeyboardEvent<HTMLButtonElement>,
    commandId: ShortcutCommandId,
  ) => {
    if (capturingShortcut !== commandId) return;

    if (event.key === 'Tab') {
      setCapturingShortcut(null);
      setShortcutFeedback('Gravação do atalho cancelada.');
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setCapturingShortcut(null);
      setShortcutFeedback('Gravação do atalho cancelada.');
      return;
    }

    event.preventDefault();
    const binding = createShortcutBinding(event.nativeEvent, platform);
    if (!binding) {
      setShortcutFeedback(
        'Atalho inválido ou reservado. Use Ctrl/⌘ com uma tecla compatível.',
      );
      return;
    }

    const collision = findShortcutCollision(
      binding,
      shortcutPreferences,
      commandId,
    );
    if (collision) {
      const conflictingCommand = SHORTCUT_COMMANDS.find(
        ({ id }) => id === collision,
      );
      setShortcutFeedback(
        `Esse atalho já está atribuído a ${conflictingCommand?.label ?? 'outra ação'}.`,
      );
      return;
    }

    updateStoredShortcuts({
      ...shortcutPreferences,
      [commandId]: binding,
    });
    setCapturingShortcut(null);
    setShortcutFeedback('Atalho atualizado.');
  };

  const restoreShortcut = (commandId: ShortcutCommandId) => {
    const defaultBinding = DEFAULT_SHORTCUT_PREFERENCES[commandId];
    const collision = findShortcutCollision(
      defaultBinding,
      shortcutPreferences,
      commandId,
    );
    if (collision) {
      const conflictingCommand = SHORTCUT_COMMANDS.find(
        ({ id }) => id === collision,
      );
      setShortcutFeedback(
        `Libere o atalho usado por ${conflictingCommand?.label ?? 'outra ação'} antes de restaurar este padrão.`,
      );
      return;
    }

    updateStoredShortcuts({
      ...shortcutPreferences,
      [commandId]: defaultBinding,
    });
    setShortcutFeedback('Atalho padrão restaurado.');
  };

  const disableShortcut = (commandId: ShortcutCommandId) => {
    updateStoredShortcuts({ ...shortcutPreferences, [commandId]: null });
    setCapturingShortcut(null);
    setShortcutFeedback('Atalho desativado.');
  };

  const moveSidebarRouteItem = (
    group: 'primary' | 'more',
    routeId: SidebarRouteId,
    direction: -1 | 1,
  ) => {
    const nextOrder = moveSidebarRoute(
      sidebarRouteOrder[group],
      routeId,
      direction,
    );
    if (!nextOrder) return;

    updateStoredSidebarRouteOrder({
      ...sidebarRouteOrder,
      [group]: nextOrder,
    });
    setSidebarOrderFeedback(
      `${sidebarRouteLabels[routeId]} movido para ${direction === -1 ? 'cima' : 'baixo'}.`,
    );
  };

  const handleSettingsTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % settingsSections.length;
    } else if (event.key === 'ArrowUp') {
      nextIndex =
        (currentIndex - 1 + settingsSections.length) % settingsSections.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = settingsSections.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    setActiveSettingsSection(settingsSections[nextIndex].id);
    settingsTabRefs.current[nextIndex]?.focus();
  };

  useEffect(() => {
    if (!sessionUserId) return;
    let active = true;
    void window.animonkey.account
      .getActivityPrivacy()
      .then((value) => {
        if (active) setPrivacy({ userId: sessionUserId, value });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [sessionUserId]);

  useEffect(() => {
    let active = true;
    void window.animonkey.notifications
      .isSupported()
      .then((supported) => {
        if (active) setNotificationsSupported(supported);
      })
      .catch(() => {
        if (active) setNotificationsSupported(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const submitAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountBusy(true);
    setAccountError(null);
    setAccountMessage(null);
    try {
      if (accountMode === 'register') {
        await register({ email, password, name: name.trim() || undefined });
        setAccountMessage('Conta criada e sessão iniciada.');
      } else {
        await login({ email, password });
        setAccountMessage('Sessão iniciada.');
      }
      setPassword('');
    } catch (cause) {
      setAccountError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível acessar a conta.',
      );
    } finally {
      setAccountBusy(false);
    }
  };

  const syncAccount = async () => {
    setAccountBusy(true);
    setAccountMessage(null);
    await syncNow();
    setAccountBusy(false);
    setAccountMessage('Solicitação concluída. Confira o estado acima.');
  };

  const importGuest = async () => {
    setAccountBusy(true);
    setAccountError(null);
    setAccountMessage(null);
    try {
      const count = await importGuestLibrary();
      setAccountMessage(
        count > 0
          ? `${count} registros da biblioteca local foram mesclados nesta conta.`
          : 'Não há registros locais novos para mesclar.',
      );
    } catch {
      setAccountError('Não foi possível mesclar a biblioteca local.');
    } finally {
      setAccountBusy(false);
    }
  };

  const signOut = async () => {
    setAccountBusy(true);
    setAccountError(null);
    try {
      await logout();
      setAccountMessage('Sessão encerrada neste dispositivo.');
    } catch {
      setAccountError('Não foi possível encerrar a sessão.');
    } finally {
      setAccountBusy(false);
    }
  };
  const downloadBackup = async () => {
    setError(null);
    try {
      const backup = await exportLocalBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `animonkey-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Backup local exportado.');
    } catch {
      setError('Não foi possível exportar os dados deste dispositivo.');
    }
  };

  const downloadAccountExport = async () => {
    setAccountBusy(true);
    setAccountError(null);
    setAccountMessage(null);
    try {
      const data = await window.animonkey.account.exportAccountData();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `animonkey-account-${session?.user.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAccountMessage('Exportação dos dados da conta concluída.');
    } catch {
      setAccountError(
        'Não foi possível exportar os dados da conta. Verifique a conexão e tente novamente.',
      );
    } finally {
      setAccountBusy(false);
    }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountBusy(true);
    setAccountError(null);
    setAccountMessage(null);
    try {
      await updateProfile(
        profileDraft?.userId === session?.user.id
          ? (profileDraft?.name ?? '')
          : (session?.user.name ?? ''),
      );
      setProfileDraft(null);
      setAccountMessage('Nome do perfil atualizado.');
    } catch {
      setAccountError('Não foi possível atualizar o perfil.');
    } finally {
      setAccountBusy(false);
    }
  };

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = event.currentTarget.files ?? [];
    event.currentTarget.value = '';
    if (!file) return;
    setAccountError(null);
    if (
      !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
        file.type,
      )
    ) {
      setAccountError('Use uma imagem JPG, PNG, WEBP ou GIF.');
      return;
    }
    if (file.size === 0 || file.size > 2 * 1024 * 1024) {
      setAccountError('A imagem precisa ter até 2 MB.');
      return;
    }
    setAccountBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      await window.animonkey.account.uploadAvatar(file.type, btoa(binary));
      setAccountMessage('Foto do perfil atualizada.');
    } catch {
      setAccountError(
        'Não foi possível enviar a imagem. Verifique o arquivo e a conexão.',
      );
    } finally {
      setAccountBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAccountBusy(true);
    setAccountError(null);
    try {
      await window.animonkey.account.removeAvatar();
      setAccountMessage('Foto do perfil removida.');
    } catch {
      setAccountError('Não foi possível remover a foto do perfil.');
    } finally {
      setAccountBusy(false);
    }
  };

  const toggleActivityPrivacy = async (showActivity: boolean) => {
    if (!session) return;
    setAccountBusy(true);
    setAccountError(null);
    try {
      await window.animonkey.account.setActivityPrivacy(showActivity);
      setPrivacy({ userId: session.user.id, value: showActivity });
      setAccountMessage(
        showActivity
          ? 'Sua atividade está visível no feed.'
          : 'Sua atividade está privada.',
      );
    } catch {
      setAccountError('Não foi possível salvar a preferência de privacidade.');
    } finally {
      setAccountBusy(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountError(null);
    setAccountMessage(null);
    if (newPassword !== confirmPassword) {
      setAccountError('A confirmação da nova senha não coincide.');
      return;
    }
    setAccountBusy(true);
    try {
      await window.animonkey.account.changePassword(
        currentPassword,
        newPassword,
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setAccountMessage('Senha atualizada.');
    } catch (cause) {
      setAccountError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível atualizar a senha.',
      );
    } finally {
      setAccountBusy(false);
    }
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = event.currentTarget.files ?? [];
    event.currentTarget.value = '';
    if (!file) return;
    setMessage(null);
    setError(null);
    try {
      const count = await importLocalBackup(await file.text());
      window.dispatchEvent(new Event('animonkey:local-data-imported'));
      setMessage(`${count} registros foram mesclados com os dados locais.`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível importar o backup.',
      );
    }
  };

  return (
    <section className="settings-page mx-auto grid w-full max-w-[1320px] grid-cols-[148px_minmax(0,1fr)] gap-4 sm:grid-cols-[168px_minmax(0,1fr)] sm:gap-6 xl:grid-cols-[200px_minmax(0,1fr)] xl:gap-8">
      <aside className="min-w-0">
        <div className="sticky top-[calc(var(--app-header-height)+1rem)]">
          <p className="mb-3 px-3 text-[11px] font-bold tracking-[0.16em] text-white/35 uppercase">
            Configurações
          </p>
          <nav
            role="tablist"
            aria-label="Seções de configurações"
            aria-orientation="vertical"
            className="flex flex-col gap-1"
          >
            {settingsSections.map(({ id, label, icon: Icon }, index) => {
              const isActive = activeSettingsSection === id;
              return (
                <button
                  key={id}
                  ref={(element) => {
                    settingsTabRefs.current[index] = element;
                  }}
                  type="button"
                  role="tab"
                  id={`settings-tab-${id}`}
                  aria-controls={`settings-panel-${id}`}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveSettingsSection(id)}
                  onKeyDown={(event) => handleSettingsTabKeyDown(event, index)}
                  className={`relative flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 text-left text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#49d77a] sm:text-sm ${isActive ? 'border-white/[0.06] bg-white/[0.055] text-white' : 'border-transparent text-white/50 hover:bg-white/[0.035] hover:text-white/85'}`}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute top-2 bottom-2 left-0 w-0.5 rounded-r-full bg-[#49d77a]"
                    />
                  )}
                  <Icon
                    size={17}
                    strokeWidth={1.8}
                    aria-hidden="true"
                    className={isActive ? 'text-[#70e793]' : 'text-white/40'}
                  />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="min-w-0">
        <section
          id="settings-panel-account"
          role="tabpanel"
          aria-labelledby="settings-tab-account"
          tabIndex={0}
          hidden={activeSettingsSection !== 'account'}
          className="min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#49d77a]"
        >
          <header className="mb-6">
            <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
              Aplicativo
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Conta
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Gerencie seu perfil, a sincronização e a privacidade da conta.
            </p>
          </header>

          <section className="rounded-xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012)_58%)] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.16)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#49d77a]/10 text-[#49d77a]">
                <Cloud size={17} />
              </span>
              <div>
                <h2 className="text-sm font-bold">Conta e sincronização</h2>
                <p className="mt-1 text-xs leading-relaxed text-white/45">
                  Sincronize Assistir Depois e progresso entre dispositivos. A
                  biblioteca de visitante fica separada até você optar por
                  mesclá-la.
                </p>
              </div>
            </div>

            {session ? (
              <div className="mt-5 rounded-lg border border-white/[0.07] bg-black/15 p-4">
                <p className="text-xs text-white/45">Conectado como</p>
                <p className="mt-1 text-sm font-semibold text-white/85">
                  {session.user.email}
                </p>
                <p className="mt-2 text-xs text-white/40">
                  {syncState === 'syncing'
                    ? 'Sincronizando alterações…'
                    : syncState === 'synced'
                      ? 'Dados sincronizados.'
                      : syncState === 'offline'
                        ? (syncError ??
                          'Offline. Os dados locais continuam disponíveis.')
                        : 'A sincronização será retomada quando houver conexão.'}
                </p>
                <form
                  onSubmit={(event) => void saveProfile(event)}
                  className="mt-4 flex flex-wrap items-end gap-2"
                >
                  <label className="min-w-56 flex-1 text-xs text-white/55">
                    Nome do perfil
                    <input
                      value={
                        profileDraft?.userId === session.user.id
                          ? (profileDraft?.name ?? '')
                          : (session.user.name ?? '')
                      }
                      onChange={(event) =>
                        setProfileDraft({
                          userId: session.user.id,
                          name: event.target.value,
                        })
                      }
                      maxLength={60}
                      autoComplete="name"
                      className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#49d77a]/50"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={accountBusy}
                    className="h-9 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/75 disabled:opacity-50"
                  >
                    Salvar perfil
                  </button>
                </form>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt="Foto do perfil"
                      className="size-14 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="grid size-14 place-items-center rounded-full bg-white/[0.07] text-lg font-bold text-white/60"
                    >
                      {(
                        session.user.name?.trim().charAt(0) || '?'
                      ).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={avatarInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(event) => void uploadAvatar(event)}
                      className="sr-only"
                      aria-label="Selecionar nova foto de perfil"
                    />
                    <button
                      type="button"
                      disabled={accountBusy}
                      onClick={() => avatarInput.current?.click()}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/75 disabled:opacity-50"
                    >
                      <Upload size={13} /> Enviar foto (até 2 MB)
                    </button>
                    {session.user.image && (
                      <button
                        type="button"
                        disabled={accountBusy}
                        onClick={() => void removeAvatar()}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-white/60 disabled:opacity-50"
                      >
                        <Trash2 size={13} /> Remover foto
                      </button>
                    )}
                  </div>
                </div>
                <form
                  onSubmit={(event) => void changePassword(event)}
                  className="mt-5 space-y-3 border-t border-white/[0.07] pt-4"
                >
                  <div>
                    <h3 className="text-xs font-semibold text-white/80">
                      Alterar senha
                    </h3>
                    <p className="mt-1 text-xs text-white/40">
                      A senha atual é verificada no servidor; a nova é
                      armazenada com bcrypt.
                    </p>
                  </div>
                  <label className="block text-xs text-white/55">
                    Senha atual
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(event) =>
                        setCurrentPassword(event.target.value)
                      }
                      autoComplete="current-password"
                      required
                      className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#49d77a]/50"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs text-white/55">
                      Nova senha
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        minLength={8}
                        maxLength={72}
                        autoComplete="new-password"
                        required
                        className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#49d77a]/50"
                      />
                    </label>
                    <label className="block text-xs text-white/55">
                      Confirmar nova senha
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        minLength={8}
                        maxLength={72}
                        autoComplete="new-password"
                        required
                        className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#49d77a]/50"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={accountBusy}
                    className="h-9 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/75 disabled:opacity-50"
                  >
                    Atualizar senha
                  </button>
                </form>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={accountBusy || syncState === 'syncing'}
                    onClick={() => void syncAccount()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#49d77a] px-3 text-xs font-bold text-[#07110a] transition hover:bg-[#6ce995] disabled:opacity-50"
                  >
                    <RefreshCw size={13} /> Sincronizar agora
                  </button>
                  <button
                    type="button"
                    disabled={accountBusy}
                    onClick={() => void importGuest()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/75 transition hover:bg-white/[0.06] disabled:opacity-50"
                  >
                    Mesclar biblioteca local
                  </button>
                  <button
                    type="button"
                    disabled={accountBusy}
                    onClick={() => void downloadAccountExport()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/75 transition hover:bg-white/[0.06] disabled:opacity-50"
                  >
                    <Download size={13} /> Exportar dados da conta
                  </button>
                  <button
                    type="button"
                    disabled={accountBusy}
                    onClick={() => void signOut()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/60 transition hover:bg-white/[0.06] disabled:opacity-50"
                  >
                    <LogOut size={13} /> Sair
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(event) => void submitAccount(event)}
                className="mt-5 space-y-3"
              >
                {accountMode === 'register' && (
                  <label className="block text-xs text-white/55">
                    Nome (opcional)
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={80}
                      autoComplete="name"
                      className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#49d77a]/50"
                    />
                  </label>
                )}
                <label className="block text-xs text-white/55">
                  E-mail
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    maxLength={254}
                    autoComplete="email"
                    required
                    className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#49d77a]/50"
                  />
                </label>
                <label className="block text-xs text-white/55">
                  Senha
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={accountMode === 'register' ? 8 : undefined}
                    autoComplete={
                      accountMode === 'register'
                        ? 'new-password'
                        : 'current-password'
                    }
                    required
                    className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#49d77a]/50"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={accountBusy}
                    className="inline-flex h-10 items-center rounded-lg bg-[#49d77a] px-4 text-xs font-bold text-[#07110a] transition hover:bg-[#6ce995] disabled:opacity-50"
                  >
                    {accountBusy
                      ? 'Aguarde…'
                      : accountMode === 'register'
                        ? 'Criar conta'
                        : 'Entrar'}
                  </button>
                  <button
                    type="button"
                    disabled={accountBusy}
                    onClick={() => {
                      setAccountMode((mode) =>
                        mode === 'login' ? 'register' : 'login',
                      );
                      setPassword('');
                      setAccountError(null);
                    }}
                    className="text-xs font-semibold text-white/55 hover:text-white"
                  >
                    {accountMode === 'login'
                      ? 'Criar uma conta'
                      : 'Já tenho uma conta'}
                  </button>
                </div>
              </form>
            )}
            {accountMessage && (
              <p role="status" className="mt-4 text-xs text-[#70e793]">
                {accountMessage}
              </p>
            )}
            {accountError && (
              <p role="alert" className="mt-4 text-xs text-red-200/80">
                {accountError}
              </p>
            )}
          </section>
        </section>

        <FeedbackSettingsSection
          active={activeSettingsSection === 'feedback'}
          session={session}
          onOpenAccount={() => setActiveSettingsSection('account')}
        />

        <section
          id="settings-panel-privacy"
          role="tabpanel"
          aria-labelledby="settings-tab-privacy"
          tabIndex={0}
          hidden={activeSettingsSection !== 'privacy'}
          className="min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#49d77a]"
        >
          <header className="mb-6">
            <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
              Seus dados
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Privacidade
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Controle separadamente a gravação, a exibição e a sincronização do
              seu progresso. Desativar uma opção não apaga dados existentes.
            </p>
          </header>

          <section className="space-y-5 rounded-xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012)_58%)] p-4 sm:p-6">
            <fieldset>
              <legend className="text-sm font-semibold text-white/90">
                Progresso neste dispositivo
              </legend>
              <label className="mt-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={recordWatchProgress.enabled}
                  disabled={!recordWatchProgress.loaded}
                  onChange={(event) =>
                    recordWatchProgress.setEnabled(event.currentTarget.checked)
                  }
                  className="mt-0.5 size-4 shrink-0 accent-[#49d77a]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white/85">
                    Salvar novos tempos assistidos
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-white/45">
                    Desative para parar de gravar novos tempos neste
                    dispositivo. O progresso já salvo permanece disponível para
                    retomar episódios, aparecer no histórico e ser incluído no
                    backup.
                  </span>
                </span>
              </label>
            </fieldset>

            <fieldset className="border-t border-white/[0.07] pt-5">
              <legend className="text-sm font-semibold text-white/90">
                Exibição do histórico
              </legend>
              <label className="mt-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={continueWatchingVisibility.enabled}
                  disabled={!continueWatchingVisibility.loaded}
                  onChange={(event) =>
                    continueWatchingVisibility.setEnabled(
                      event.currentTarget.checked,
                    )
                  }
                  className="mt-0.5 size-4 shrink-0 accent-[#49d77a]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white/85">
                    Mostrar Continuar Assistindo
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-white/45">
                    Desative para ocultar a seção da página inicial, a página do
                    histórico e seu atalho na navegação. Os registros continuam
                    salvos e voltam a aparecer quando reativar.
                  </span>
                </span>
              </label>
            </fieldset>

            <fieldset className="border-t border-white/[0.07] pt-5">
              <legend className="text-sm font-semibold text-white/90">
                Sincronização da conta
              </legend>
              <label className="mt-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={syncWatchProgress.enabled}
                  disabled={
                    !syncWatchProgress.loaded || syncState === 'syncing'
                  }
                  onChange={(event) =>
                    syncWatchProgress.setEnabled(event.currentTarget.checked)
                  }
                  className="mt-0.5 size-4 shrink-0 accent-[#49d77a]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white/85">
                    Sincronizar progresso de episódios
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-white/45">
                    Quando ativada e conectado à conta, o progresso local pode
                    ser enviado e o progresso da conta pode ser recebido.
                    Desativar pausa essa troca sem remover os dados locais ou
                    remotos.
                  </span>
                </span>
              </label>
            </fieldset>

            <fieldset className="border-t border-white/[0.07] pt-5">
              <legend className="text-sm font-semibold text-white/90">
                Visibilidade da atividade
              </legend>
              <div className="mt-3 flex items-start justify-between gap-4">
                <p className="max-w-xl text-xs leading-relaxed text-white/45">
                  {session
                    ? 'Controla se atividades de episódios e avaliações aparecem no feed. Desativar oculta a atividade sem apagar os registros da conta.'
                    : 'Entre na sua conta para controlar se atividades de episódios e avaliações aparecem no feed.'}
                </p>
                <label className="flex shrink-0 items-center gap-2 text-xs text-white/65">
                  <input
                    type="checkbox"
                    checked={activityPrivacy ?? false}
                    disabled={activityPrivacy === null || accountBusy}
                    onChange={(event) =>
                      void toggleActivityPrivacy(event.currentTarget.checked)
                    }
                    className="accent-[#49d77a]"
                  />
                  Compartilhar
                </label>
              </div>
            </fieldset>

            <fieldset className="border-t border-white/[0.07] pt-5">
              <legend className="text-sm font-semibold text-white/90">
                Relatórios de falha de provedores
              </legend>
              <div className="mt-3 flex items-start gap-3">
                <input
                  id="provider-failure-reporting-enabled"
                  type="checkbox"
                  checked={providerFailureReportingEnabled}
                  disabled={
                    !providerFailureReportingLoaded ||
                    (!session && !providerFailureReportingEnabled)
                  }
                  onChange={(event) =>
                    setProviderFailureReportingEnabled(
                      event.currentTarget.checked,
                    )
                  }
                  className="mt-0.5 size-4 shrink-0 accent-[#49d77a]"
                />
                <div className="min-w-0">
                  <label
                    htmlFor="provider-failure-reporting-enabled"
                    className="block text-sm font-semibold text-white/85"
                  >
                    Compartilhar falhas de provedores
                  </label>
                  <span className="mt-1 block text-xs leading-relaxed text-white/45">
                    Com a opção ativa e sua conta conectada, enviaremos somente
                    o identificador do provedor e respostas HTTP 502, 503 ou 504
                    ao consultar uma transmissão. Não enviamos anime, episódio,
                    URL, cabeçalhos, resposta, mensagem de erro, timeout,
                    cancelamento ou resposta 404. Cada conta pode enviar até 10
                    relatórios por dia; o mesmo provedor é registrado no máximo
                    uma vez por hora e os dados são removidos após 30 dias. O
                    relato indica uma falha observada, não confirma uma
                    indisponibilidade geral.
                  </span>
                  {!session && !providerFailureReportingEnabled ? (
                    <button
                      type="button"
                      onClick={() => setActiveSettingsSection('account')}
                      className="mt-2 text-xs font-semibold text-[#65e48e] hover:underline"
                    >
                      Entre na conta para ativar
                    </button>
                  ) : null}
                </div>
              </div>
            </fieldset>
          </section>
        </section>

        <section
          id="settings-panel-notifications"
          role="tabpanel"
          aria-labelledby="settings-tab-notifications"
          tabIndex={0}
          hidden={activeSettingsSection !== 'notifications'}
          className="min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#49d77a]"
        >
          <header className="mb-6">
            <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
              Agenda de episódios
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Notificações
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Acompanhe episódios novos dos animes que você escolher.
            </p>
          </header>
          <section className="rounded-xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012)_58%)] p-4 sm:p-6">
            <fieldset>
              <legend className="text-base font-semibold">
                Avisos de novos episódios
              </legend>
              <label className="mt-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={airingNotifications.notificationsEnabled}
                  disabled={
                    !airingNotifications.notificationsLoaded ||
                    notificationsSupported !== true
                  }
                  onChange={(event) =>
                    airingNotifications.setNotificationsEnabled(
                      event.currentTarget.checked,
                    )
                  }
                  className="mt-0.5 size-4 shrink-0 accent-[#49d77a]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white/90">
                    Notificar quando houver episódio novo
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-white/45">
                    Desativado por padrão. Com o Animonkey aberto e conectado, a
                    agenda é verificada a cada 15 minutos. Um aviso de
                    recuperação pode mencionar o episódio mais recente após um
                    período offline.
                  </span>
                </span>
              </label>
              {notificationsSupported === false && (
                <p role="status" className="mt-4 text-xs text-white/45">
                  Notificações do sistema não estão disponíveis neste ambiente.
                </p>
              )}
              {notificationsSupported === null && (
                <p role="status" className="mt-4 text-xs text-white/45">
                  Verificando suporte a notificações do sistema…
                </p>
              )}
              <p className="mt-4 border-t border-white/[0.07] pt-4 text-xs leading-relaxed text-white/45">
                Acompanhar é independente de Assistir Depois. A lista fica
                somente neste dispositivo, acompanha o backup local e não é
                sincronizada com a conta. Os avisos mostram o título e o
                episódio na notificação do sistema.
              </p>
              <p className="mt-2 text-xs text-white/40">
                {airingNotifications.followedAnimeLoaded
                  ? 'Animes acompanhados neste dispositivo: ' +
                    String(airingNotifications.followedAnime.length) +
                    ' de 50. Use o botão Acompanhar na página de cada anime para adicionar ou remover.'
                  : 'Carregando animes acompanhados…'}
              </p>
            </fieldset>
          </section>
        </section>

        <section
          id="settings-panel-preferences"
          role="tabpanel"
          aria-labelledby="settings-tab-preferences"
          tabIndex={0}
          hidden={activeSettingsSection !== 'preferences'}
          className="min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#49d77a]"
        >
          <header className="mb-6">
            <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
              Aplicativo
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Preferências
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Personalize as informações exibidas pelo Animonkey.
            </p>
          </header>

          <section className="rounded-xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012)_58%)] p-4 sm:p-6">
            <fieldset>
              <legend className="text-base font-semibold">
                Idioma dos títulos
              </legend>
              <p className="mt-2 text-sm leading-relaxed text-white/45">
                Escolha qual título deve aparecer primeiro nos cartões e nas
                páginas de anime.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['jp', 'Japonês (romaji)', 'Prioriza o título romanizado.'],
                    ['en', 'Inglês', 'Prioriza o título em inglês.'],
                  ] as const
                ).map(([language, label, description]) => (
                  <label
                    key={language}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${titleLanguage === language ? 'border-[#49d77a]/35 bg-[#49d77a]/[0.08]' : 'border-white/[0.08] bg-white/[0.015] hover:bg-white/[0.04]'}`}
                  >
                    <input
                      type="radio"
                      name="title-language"
                      value={language}
                      checked={titleLanguage === language}
                      onChange={() => setTitleLanguage(language)}
                      className="mt-0.5 size-4 shrink-0 accent-[#49d77a]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white/90">
                        {label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-white/45">
                        {description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-6 border-t border-white/[0.07] pt-5">
              <legend className="text-base font-semibold">
                Conteúdo adulto
              </legend>
              <label className="mt-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={includeAdult}
                  disabled={!adultPreferenceLoaded}
                  onChange={(event) => setIncludeAdult(event.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-[#49d77a]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white/90">
                    Incluir conteúdo adulto na descoberta
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-white/45">
                    Desativado por padrão. Quando ativado, títulos marcados como
                    adultos podem aparecer na busca, nos catálogos, na agenda e
                    nas recomendações. O filtro da busca pode substituir esta
                    preferência para uma pesquisa específica.
                  </span>
                </span>
              </label>
            </fieldset>
          </section>
        </section>

        <section
          id="settings-panel-shortcuts"
          role="tabpanel"
          aria-labelledby="settings-tab-shortcuts"
          tabIndex={0}
          hidden={activeSettingsSection !== 'shortcuts'}
          className="min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#49d77a]"
        >
          <header className="mb-6">
            <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
              Aplicativo
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Atalhos
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Personalize os comandos do aplicativo. As alterações ficam neste
              dispositivo e acompanham o backup local.
            </p>
          </header>

          <section className="rounded-xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012)_58%)] p-4 sm:p-6">
            <div className="space-y-3">
              {SHORTCUT_COMMANDS.map(({ id, label, description }) => (
                <div
                  key={id}
                  className="flex flex-col gap-3 rounded-lg border border-white/[0.07] bg-black/[0.12] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-white/90">
                      {label}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-white/45">
                      {description}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!shortcutsLoaded}
                      aria-label={
                        capturingShortcut === id
                          ? `Pressione as teclas do atalho para ${label}`
                          : `Alterar atalho para ${label}`
                      }
                      aria-pressed={capturingShortcut === id}
                      onClick={() => {
                        if (capturingShortcut === id) {
                          setCapturingShortcut(null);
                          setShortcutFeedback('Gravação do atalho cancelada.');
                          return;
                        }
                        setCapturingShortcut(id);
                        setShortcutFeedback(
                          'Pressione Ctrl/⌘ e uma tecla. Esc cancela a gravação.',
                        );
                      }}
                      onKeyDown={(event) => captureShortcut(event, id)}
                      onBlur={() => {
                        if (capturingShortcut === id)
                          setCapturingShortcut(null);
                      }}
                      className="min-h-10 min-w-32 rounded-md border border-white/[0.12] bg-white/[0.04] px-3 text-xs font-semibold text-white/85 transition hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#49d77a] disabled:cursor-wait disabled:opacity-50"
                    >
                      {capturingShortcut === id
                        ? 'Pressione as teclas…'
                        : formatShortcutBinding(
                            shortcutPreferences[id],
                            platform,
                          )}
                    </button>
                    <button
                      type="button"
                      disabled={!shortcutsLoaded}
                      aria-label={`Restaurar atalho padrão para ${label}`}
                      onClick={() => restoreShortcut(id)}
                      className="min-h-10 rounded-md border border-white/[0.08] px-3 text-xs font-medium text-white/55 transition hover:bg-white/[0.05] hover:text-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#49d77a] disabled:cursor-wait disabled:opacity-50"
                    >
                      Padrão
                    </button>
                    <button
                      type="button"
                      disabled={!shortcutsLoaded}
                      aria-label={`Desativar atalho para ${label}`}
                      onClick={() => disableShortcut(id)}
                      className="min-h-10 rounded-md border border-white/[0.08] px-3 text-xs font-medium text-white/55 transition hover:bg-white/[0.05] hover:text-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#49d77a] disabled:cursor-wait disabled:opacity-50"
                    >
                      Desativar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p
              className="mt-4 min-h-5 text-xs leading-relaxed text-white/45"
              role="status"
              aria-live="polite"
            >
              {shortcutFeedback ??
                (platform === 'darwin'
                  ? 'Use ⌘ com outra tecla. Atalhos de edição e do sistema são reservados.'
                  : 'Use Ctrl com outra tecla. Atalhos de edição e do sistema são reservados.')}
            </p>
          </section>
        </section>

        <section
          id="settings-panel-navigation"
          role="tabpanel"
          aria-labelledby="settings-tab-navigation"
          tabIndex={0}
          hidden={activeSettingsSection !== 'navigation'}
          className="min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#49d77a]"
        >
          <header className="mb-6">
            <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
              Aplicativo
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Navegação
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Início e Explorar permanecem fixos. Reordene os destinos dentro
              das seções da barra lateral; a preferência fica neste dispositivo
              e acompanha o backup local.
            </p>
          </header>

          <section className="space-y-5 rounded-xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012)_58%)] p-4 sm:p-6">
            {sidebarOrderSections.map(({ id, title }) => (
              <fieldset key={id}>
                <legend className="mb-3 text-base font-semibold">
                  {title}
                </legend>
                <ol className="space-y-2">
                  {sidebarRouteOrder[id].map((routeId, index, items) => (
                    <li
                      key={routeId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-black/[0.12] p-3"
                    >
                      <span className="min-w-0 text-sm font-medium text-white/85">
                        {sidebarRouteLabels[routeId]}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          disabled={!sidebarRouteOrderLoaded || index === 0}
                          aria-label={`Mover ${sidebarRouteLabels[routeId]} para cima`}
                          onClick={() => moveSidebarRouteItem(id, routeId, -1)}
                          className="grid size-9 place-items-center rounded-md border border-white/[0.08] text-white/55 transition hover:bg-white/[0.05] hover:text-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#49d77a] disabled:cursor-default disabled:opacity-30"
                        >
                          <ArrowUp size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={
                            !sidebarRouteOrderLoaded ||
                            index === items.length - 1
                          }
                          aria-label={`Mover ${sidebarRouteLabels[routeId]} para baixo`}
                          onClick={() => moveSidebarRouteItem(id, routeId, 1)}
                          className="grid size-9 place-items-center rounded-md border border-white/[0.08] text-white/55 transition hover:bg-white/[0.05] hover:text-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#49d77a] disabled:cursor-default disabled:opacity-30"
                        >
                          <ArrowDown size={16} aria-hidden="true" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ol>
              </fieldset>
            ))}
            <p
              className="min-h-5 text-xs leading-relaxed text-white/45"
              role="status"
              aria-live="polite"
            >
              {sidebarOrderFeedback ??
                'Use os botões para mover cada destino dentro da sua seção.'}
            </p>
          </section>
        </section>

        <SettingsDebugPanel
          isActive={activeSettingsSection === 'diagnostics'}
        />

        <section
          id="settings-panel-captions"
          role="tabpanel"
          aria-labelledby="settings-tab-captions"
          tabIndex={0}
          hidden={activeSettingsSection !== 'captions'}
          className="min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#49d77a]"
        >
          <header className="mb-6">
            <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
              Reprodução
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Legendas
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Escolha o tamanho do texto das legendas do player. A preferência é
              salva neste dispositivo.
            </p>
          </header>

          <section className="rounded-xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012)_58%)] p-4 sm:p-6">
            <label
              htmlFor="settings-subtitle-size"
              className="block text-sm font-semibold text-white/90"
            >
              Tamanho do texto
            </label>
            <p
              id="settings-subtitle-size-description"
              className="mt-1 max-w-xl text-xs leading-relaxed text-white/45"
            >
              A alteração vale para as legendas exibidas pelo player.
            </p>
            <select
              id="settings-subtitle-size"
              aria-describedby="settings-subtitle-size-description"
              value={subtitleSize}
              disabled={!subtitlePreferenceLoaded}
              onChange={(event) => {
                const nextSize = event.currentTarget.value;
                if (isSubtitleSize(nextSize))
                  updateStoredSubtitleSize(nextSize);
              }}
              className="mt-4 min-h-11 w-full max-w-xs rounded-lg border border-white/10 bg-[#111113] px-3 text-sm text-white outline-none transition-colors focus-visible:border-[#49d77a] focus-visible:ring-2 focus-visible:ring-[#49d77a]/35 disabled:cursor-wait disabled:opacity-60"
            >
              <option value="small">Pequeno</option>
              <option value="medium">Médio</option>
              <option value="large">Grande</option>
              <option value="xlarge">Extra grande</option>
            </select>
          </section>
        </section>

        <section
          id="settings-panel-backup"
          role="tabpanel"
          aria-labelledby="settings-tab-backup"
          tabIndex={0}
          hidden={activeSettingsSection !== 'backup'}
          className="min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#49d77a]"
        >
          <header className="mb-6">
            <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
              Biblioteca local
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Backup
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Exporte ou restaure os dados da biblioteca deste dispositivo.
            </p>
          </header>

          <section className="rounded-xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012)_58%)] p-4 sm:p-6">
            <h2 className="text-base font-semibold">Backup da biblioteca</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              O arquivo inclui Assistir Depois, progresso, avaliações locais e
              preferências. Ele não inclui cache do catálogo, sessão ou
              credenciais. A importação mescla registros e não apaga os dados
              existentes.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void downloadBackup()}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#49d77a] px-4 text-xs font-bold text-[#07110a] transition hover:bg-[#6ce995]"
              >
                <Download size={14} /> Exportar backup
              </button>
              <button
                type="button"
                onClick={() => backupInput.current?.click()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-xs font-semibold text-white/75 transition hover:bg-white/[0.06]"
              >
                <Upload size={14} /> Importar backup
              </button>
              <input
                ref={backupInput}
                type="file"
                accept="application/json,.json"
                onChange={(event) => void importBackup(event)}
                className="sr-only"
                aria-label="Selecionar arquivo de backup Animonkey"
              />
            </div>
            {message && (
              <p role="status" className="mt-4 text-xs text-[#70e793]">
                {message}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-4 text-xs text-red-200/80">
                {error}
              </p>
            )}
          </section>
        </section>
      </div>
    </section>
  );
}
