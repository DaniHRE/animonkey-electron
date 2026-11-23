import { Copy, Minus, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = window.animonkey.windowControls.onStateChanged(
      (state) => {
        setIsMaximized(state.isMaximized);
      },
    );

    void window.animonkey.windowControls
      .getState()
      .then((state) => {
        if (isMounted) setIsMaximized(state.isMaximized);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <div
      className="app-window-controls"
      role="group"
      aria-label="Controles da janela"
    >
      <button
        type="button"
        className="app-window-controls__button"
        aria-label="Minimizar janela"
        title="Minimizar"
        onClick={() => window.animonkey.windowControls.minimize()}
      >
        <Minus size={15} strokeWidth={1.6} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="app-window-controls__button"
        aria-label={isMaximized ? 'Restaurar janela' : 'Maximizar janela'}
        title={isMaximized ? 'Restaurar' : 'Maximizar'}
        onClick={() => window.animonkey.windowControls.toggleMaximize()}
      >
        {isMaximized ? (
          <Copy size={13} strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <Square size={12} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className="app-window-controls__button app-window-controls__button--close"
        aria-label="Fechar janela"
        title="Fechar"
        onClick={() => window.animonkey.windowControls.close()}
      >
        <X size={16} strokeWidth={1.6} aria-hidden="true" />
      </button>
    </div>
  );
}
