'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import Button from '../components/ui/Button';

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface DialogState extends ConfirmOptions {
  message: string;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((message, options) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setDialog({ message, ...options });
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setDialog(null);
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4"
          onClick={() => close(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {dialog.title && <h2 className="text-lg font-bold mb-2 text-white">{dialog.title}</h2>}
            <p className="text-sm text-gray-200 whitespace-pre-line">{dialog.message}</p>
            <div className="flex gap-3 justify-end mt-5">
              <Button variant="secondary" onClick={() => close(false)}>
                {dialog.cancelLabel ?? 'Annuleren'}
              </Button>
              <Button variant={dialog.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
                {dialog.confirmLabel ?? 'Bevestigen'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
