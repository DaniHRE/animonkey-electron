import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Cloud, Download, LogOut, RefreshCw, Upload } from 'lucide-react';
import { useAccount } from '@/context/account-state';
import {
  exportLocalBackup,
  importLocalBackup,
} from '@/services/cache/local-db';

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
  } = useAccount();
  const backupInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<'login' | 'register'>('login');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

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
    <section className="max-w-3xl">
      <p className="mb-2 text-[10px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
        Aplicativo
      </p>
      <h1 className="text-2xl font-bold tracking-tight">
        Configurações locais
      </h1>
      <p className="mt-2 mb-7 text-xs text-white/40">
        Preferências e backups ficam neste dispositivo.
      </p>

      <div className="space-y-5">
        <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
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
              <p className="mt-2 text-[11px] text-white/40">
                {syncState === 'syncing'
                  ? 'Sincronizando alterações…'
                  : syncState === 'synced'
                    ? 'Dados sincronizados.'
                    : syncState === 'offline'
                      ? (syncError ??
                        'Offline. Os dados locais continuam disponíveis.')
                      : 'A sincronização será retomada quando houver conexão.'}
              </p>
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

        <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
          <h2 className="text-sm font-bold">Legendas</h2>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-white/45">
            Durante a reprodução, ajuste o tamanho e a aparência em
            Acessibilidade → Estilos de legenda no menu do Vidstack.
          </p>
        </section>

        <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
          <h2 className="text-sm font-bold">Backup da biblioteca</h2>
          <p className="mt-2 text-xs leading-relaxed text-white/45">
            O arquivo inclui Assistir Depois, progresso local e preferências.
            Ele não inclui cache do catálogo, sessão ou credenciais. A
            importação mescla registros e não apaga os dados existentes.
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
      </div>
    </section>
  );
}
