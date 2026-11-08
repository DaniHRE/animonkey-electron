import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
}

export class PlayerErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  private retry = () => {
    this.props.onRetry?.();
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <section
          role="alert"
          className="grid aspect-video w-full place-items-center rounded-xl border border-white/10 bg-[#0b0b0c] p-6 text-center"
        >
          <div className="max-w-md">
            <h2 className="text-sm font-bold text-white">
              O player encontrou um problema
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-white/55">
              Tente carregar o player novamente ou selecione outro episódio na
              lista ao lado.
            </p>
            <button
              type="button"
              onClick={this.retry}
              className="mt-4 h-9 rounded-lg bg-[#49d77a] px-4 text-xs font-bold text-[#07110a]"
            >
              Tentar novamente
            </button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
