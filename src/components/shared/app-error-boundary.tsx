import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(): void {
    // Error details can contain remote URLs or provider data; keep them out of persistent logs.
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center bg-[#0b0b0c] p-6 text-white">
          <section
            role="alert"
            className="max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center"
          >
            <h1 className="text-lg font-bold">Algo deu errado</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              A tela encontrou um erro inesperado. Recarregue o aplicativo para
              continuar.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 h-10 rounded-lg bg-[#49d77a] px-4 text-xs font-bold text-[#07110a]"
            >
              Recarregar aplicativo
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
