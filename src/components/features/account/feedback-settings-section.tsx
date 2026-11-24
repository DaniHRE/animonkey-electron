import { useState } from 'react';
import type { FormEvent } from 'react';
import type {
  AccountSession,
  FeedbackFunctionalArea,
  FeedbackSubmissionType,
} from '@/types/account';

const feedbackAreas: Array<{
  value: FeedbackFunctionalArea;
  label: string;
}> = [
  { value: 'discovery', label: 'Descoberta e busca' },
  { value: 'catalog', label: 'Catálogo e informações' },
  { value: 'player', label: 'Player e episódios' },
  { value: 'library', label: 'Biblioteca e histórico' },
  { value: 'account', label: 'Conta e sincronização' },
  { value: 'notifications', label: 'Notificações' },
  { value: 'interface', label: 'Interface e navegação' },
  { value: 'other', label: 'Outro' },
];

interface FeedbackSettingsSectionProps {
  active: boolean;
  session: AccountSession | null;
  onOpenAccount: () => void;
}

export function FeedbackSettingsSection({
  active,
  session,
  onOpenAccount,
}: FeedbackSettingsSectionProps) {
  const [type, setType] = useState<FeedbackSubmissionType>('suggestion');
  const [area, setArea] = useState<FeedbackFunctionalArea>('discovery');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || !consented || submitting) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await window.animonkey.account.submitFeedback({
        type,
        area,
        title,
        description,
        consentVersion: 'feedback-v2',
      });
      setTitle('');
      setDescription('');
      setConsented(false);
      setMessage(
        'Feedback enviado. Obrigado por ajudar a melhorar o Animonkey.',
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível enviar o feedback.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="settings-panel-feedback"
      role="tabpanel"
      aria-labelledby="settings-tab-feedback"
      tabIndex={0}
      hidden={!active}
      className="min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#49d77a]"
    >
      <header className="mb-6">
        <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
          Animonkey
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Sugestões e reports
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">
          Envie uma ideia ou relate um problema em uma única área. A equipe
          revisará cada envio antes de decidir os próximos passos.
        </p>
      </header>

      {!session ? (
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-5">
          <h2 className="text-sm font-bold">
            Entre na sua conta para continuar
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            O envio fica associado ao identificador da conta para limitar abuso.
          </p>
          <button
            type="button"
            onClick={onOpenAccount}
            className="mt-4 min-h-10 rounded-lg bg-[#49d77a] px-4 text-sm font-bold text-[#0b120d] transition-colors hover:bg-[#70e793] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70e793]"
          >
            Abrir conta
          </button>
        </section>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex max-w-3xl flex-col gap-5 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-6"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Tipo
              <select
                value={type}
                onChange={(event) =>
                  setType(event.target.value as FeedbackSubmissionType)
                }
                className="min-h-11 rounded-lg border border-white/[0.1] bg-[#17191d] px-3 text-sm text-white outline-none focus-visible:border-[#49d77a] focus-visible:ring-2 focus-visible:ring-[#49d77a]/30"
              >
                <option value="suggestion">Sugestão</option>
                <option value="bug_report">Report de problema</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Área
              <select
                value={area}
                onChange={(event) =>
                  setArea(event.target.value as FeedbackFunctionalArea)
                }
                className="min-h-11 rounded-lg border border-white/[0.1] bg-[#17191d] px-3 text-sm text-white outline-none focus-visible:border-[#49d77a] focus-visible:ring-2 focus-visible:ring-[#49d77a]/30"
              >
                {feedbackAreas.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            Título
            <input
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoComplete="off"
              className="min-h-11 rounded-lg border border-white/[0.1] bg-[#17191d] px-3 text-sm font-normal text-white outline-none placeholder:text-white/30 focus-visible:border-[#49d77a] focus-visible:ring-2 focus-visible:ring-[#49d77a]/30"
              placeholder="Resuma a sugestão ou o problema"
            />
            <span className="text-right text-xs font-normal text-white/35">
              {title.length}/120
            </span>
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            Descrição
            <textarea
              required
              maxLength={2000}
              minLength={1}
              rows={7}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="resize-y rounded-lg border border-white/[0.1] bg-[#17191d] px-3 py-3 text-sm font-normal leading-relaxed text-white outline-none placeholder:text-white/30 focus-visible:border-[#49d77a] focus-visible:ring-2 focus-visible:ring-[#49d77a]/30"
              placeholder="Explique a ideia ou os passos para reproduzir o problema"
            />
            <span className="text-right text-xs font-normal text-white/35">
              {description.length}/2000
            </span>
          </label>

          <p className="text-xs leading-relaxed text-white/45">
            O envio guarda apenas o identificador da conta, tipo, área, título,
            descrição e registro do consentimento. A equipe pode revisar e
            transformar o envio em uma Issue do projeto para planejar correções;
            a Issue não inclui identificadores da sua conta e fica visível a
            quem tem acesso ao repositório. Os registros são apagados após 180
            dias e aparecem na exportação da conta. Não inclua senhas, tokens,
            dados pessoais nem URLs de streams.
          </p>

          <label className="flex items-start gap-3 text-sm leading-relaxed text-white/70">
            <input
              type="checkbox"
              required
              checked={consented}
              onChange={(event) => setConsented(event.target.checked)}
              className="mt-1 size-4 shrink-0 accent-[#49d77a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70e793]"
            />
            <span>
              Concordo em enviar esses dados à equipe do Animonkey para análise
              e triagem, incluindo a possibilidade de uma versão revisada ser
              registrada como Issue no repositório do projeto.
            </span>
          </label>

          {message && (
            <p role="status" className="text-sm text-[#70e793]">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !consented}
            className="min-h-11 self-start rounded-lg bg-[#49d77a] px-5 text-sm font-bold text-[#0b120d] transition-colors hover:bg-[#70e793] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70e793] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Enviando…' : 'Enviar feedback'}
          </button>
        </form>
      )}
    </section>
  );
}
