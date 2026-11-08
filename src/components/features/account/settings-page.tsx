import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';
import { useLocalPreference } from '@/hooks/use-local-preference';
import {
  exportLocalBackup,
  importLocalBackup,
} from '@/services/cache/local-db';

const subtitleSizes = [
  ['small', 'Pequena'],
  ['medium', 'Média'],
  ['large', 'Grande'],
  ['xlarge', 'Extra grande'],
] as const;
type SubtitleSize = (typeof subtitleSizes)[number][0];

export function SettingsPage() {
  const backupInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subtitleSize = useLocalPreference<SubtitleSize>(
    'player.subtitle-size',
    'medium',
  );

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
          <h2 className="text-sm font-bold">Legendas</h2>
          <label className="mt-4 grid max-w-xs gap-2 text-xs font-semibold text-white/55">
            Tamanho padrão
            <select
              value={subtitleSize.value}
              disabled={!subtitleSize.loaded}
              onChange={(event) =>
                subtitleSize.update(event.target.value as SubtitleSize)
              }
              className="h-10 rounded-lg border border-white/10 bg-[#151517] px-3 text-xs text-white/80 outline-none focus:border-[#49d77a]/60"
            >
              {subtitleSizes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
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
