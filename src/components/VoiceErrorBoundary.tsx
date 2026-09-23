import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

// Qualquer exceção na renderização da call vira mensagem legível em vez da
// "tela cinza da morte" (root desmontado com fundo #313338).
export class VoiceErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[voz] crash capturado:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex-1 min-w-0 bg-[#313338] flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-[#f23f43] font-bold">A call travou, mas o app continua vivo.</div>
        <div className="max-w-md text-xs text-[#b5bac1] break-words">
          {String(this.state.error?.message || this.state.error)}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
            className="px-4 py-2 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm transition"
          >
            Tentar de novo
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-[#1e1f22] hover:bg-[#35373c] text-white text-sm transition"
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }
}
