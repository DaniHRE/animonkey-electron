import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import {
  Activity,
  Cloud,
  Download,
  HardDrive,
  LogOut,
  RefreshCw,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import { useAccount } from '@/context/account-state';
import {
  exportLocalBackup,
  importLocalBackup,
} from '@/services/cache/local-db';
import type { AnivexaDiagnosticsSnapshot } from '@/types/anivexa';

const settingsSections = [
  { id: 'account', label: 'Conta', icon: UserRound },
  { id: 'diagnostics', label: 'Anivexa', icon: Activity },
  // Re-enable this section when caption controls are available in the player.
  // { id: 'captions', label: 'Legendas', icon: Captions },
  { id: 'backup', label: 'Backup', icon: HardDrive },
] as const;

type SettingsSectionId = (typeof settingsSections)[number]['id'];

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
  const [anivexaDiagnostics, setAnivexaDiagnostics] =
    useState<AnivexaDiagnosticsSnapshot>({
      revision: -1,
      status: 'stopped',
      entries: [],
    });
  const [anivexaDiagnosticsError, setAnivexaDiagnosticsError] = useState<
    string | null
  >(null);
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
    let active = true;
    const applySnapshot = (snapshot: AnivexaDiagnosticsSnapshot) => {
      if (!active) return;
      setAnivexaDiagnostics((current) =>
        snapshot.revision >= current.revision ? snapshot : current,
      );
    };
    const unsubscribe =
      window.animonkey.anivexa.onDiagnosticsChanged(applySnapshot);
    void window.animonkey.anivexa
      .getDiagnostics()
      .then(applySnapshot)
      .catch(() => {
        if (active) {
          setAnivexaDiagnosticsError(
            'Não foi possível carregar o diagnóstico da Anivexa.',
          );
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

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

  const clearAnivexaDiagnostics = async () => {
    setAnivexaDiagnosticsError(null);
    try {
      const snapshot = await window.animonkey.anivexa.clearDiagnostics();
      setAnivexaDiagnostics(snapshot);
    } catch {
      setAnivexaDiagnosticsError(
        'Não foi possível limpar os registros da Anivexa.',
      );
    }
  };

  const runtimeStatusLabel = {
    stopped: 'Parado',
    starting: 'Iniciando',
    ready: 'Ativo',
    error: 'Falha',
  }[anivexaDiagnostics.status];

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
                <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/[0.07] pt-4">
                  <div>
                    <h3 className="text-xs font-semibold text-white/80">
                      Privacidade da atividade
                    </h3>
                    <p className="mt-1 max-w-lg text-xs text-white/40">
                      Quando ativada, atividades de episódios e avaliações podem
                      aparecer no feed.
                    </p>
                  </div>
                  <label className="flex shrink-0 items-center gap-2 text-xs text-white/65">
                    <input
                      type="checkbox"
                      checked={activityPrivacy ?? false}
                      disabled={activityPrivacy === null || accountBusy}
                      onChange={(event) =>
                        void toggleActivityPrivacy(event.target.checked)
                      }
                      className="accent-[#49d77a]"
                    />
                    Compartilhar
                  </label>
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

        <section
          id="settings-panel-diagnostics"
          role="tabpanel"
          aria-labelledby="settings-tab-diagnostics"
          tabIndex={0}
          hidden={activeSettingsSection !== 'diagnostics'}
          className="min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#49d77a]"
        >
          <header className="mb-6">
            <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
              Integração
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Diagnóstico
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Acompanhe o runtime da Anivexa e os eventos recentes desta sessão.
            </p>
          </header>

          <section className="rounded-xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012)_58%)] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.16)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#49d77a]/10 text-[#49d77a]">
                <Activity size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-bold">Diagnóstico da Anivexa</h2>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      anivexaDiagnostics.status === 'ready'
                        ? 'border-[#49d77a]/20 bg-[#49d77a]/10 text-[#70e793]'
                        : anivexaDiagnostics.status === 'error'
                          ? 'border-red-300/20 bg-red-300/[0.08] text-red-200'
                          : 'border-white/10 bg-white/[0.04] text-white/55'
                    }`}
                  >
                    Runtime {runtimeStatusLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/45">
                  Eventos recentes do processo Anivexa e das chamadas feitas
                  pelo app. Os últimos 100 ficam somente na memória desta
                  sessão; URLs, headers, payloads e credenciais não são
                  exibidos.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-white/40">
                {anivexaDiagnostics.entries.length} de 100 eventos
              </p>
              <button
                type="button"
                disabled={anivexaDiagnostics.entries.length === 0}
                onClick={() => void clearAnivexaDiagnostics()}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/70 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={13} /> Limpar registros
              </button>
            </div>

            {anivexaDiagnosticsError && (
              <p role="alert" className="mt-3 text-xs text-red-200/80">
                {anivexaDiagnosticsError}
              </p>
            )}

            <ol
              role="log"
              aria-label="Registros recentes da Anivexa"
              aria-relevant="additions"
              className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-white/[0.07] bg-black/15 p-3"
            >
              {anivexaDiagnostics.entries.length ? (
                [...anivexaDiagnostics.entries].reverse().map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-white/[0.05] pb-2 last:border-0 last:pb-0"
                  >
                    <time
                      dateTime={new Date(entry.timestamp).toISOString()}
                      className="shrink-0 font-mono text-[11px] text-white/35"
                    >
                      {new Date(entry.timestamp).toLocaleTimeString('pt-BR')}
                    </time>
                    <span
                      className={`shrink-0 text-[11px] font-bold uppercase ${
                        entry.level === 'error'
                          ? 'text-red-200'
                          : entry.level === 'warning'
                            ? 'text-amber-200'
                            : 'text-[#70e793]'
                      }`}
                    >
                      {entry.level === 'warning'
                        ? 'Aviso'
                        : entry.level === 'error'
                          ? 'Erro'
                          : 'Info'}
                    </span>
                    <span className="min-w-0 flex-1 break-words text-xs leading-relaxed text-white/70">
                      {entry.message}
                    </span>
                  </li>
                ))
              ) : (
                <li className="py-5 text-center text-xs text-white/35">
                  Ainda não há eventos registrados nesta sessão.
                </li>
              )}
            </ol>
          </section>
        </section>

        {/* Caption settings are unavailable until configurable player controls exist.
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
              Ajuste a aparência das legendas enquanto assiste a um episódio.
            </p>
          </header>

          <section className="rounded-xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012)_58%)] p-4 sm:p-6">
            <h2 className="text-base font-semibold">Estilos de legenda</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/45">
              Durante a reprodução, ajuste o tamanho e a aparência em
              Acessibilidade → Estilos de legenda no menu do Vidstack.
            </p>
          </section>
        </section>
        */}

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
