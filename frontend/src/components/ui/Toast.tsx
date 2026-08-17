import * as ToastPrimitive from '@radix-ui/react-toast';
import { clsx } from 'clsx';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type ToastTone = 'default' | 'success' | 'error' | 'warning';

interface ToastData {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (title: string, description?: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined });

export function useToast() {
  return useContext(ToastContext);
}

const TONE_ICON: Record<ToastTone, { name: string; filled?: boolean; cls: string }> = {
  default: { name: 'info', cls: 'text-primary' },
  success: { name: 'check_circle', filled: true, cls: 'text-primary' },
  error: { name: 'error', filled: true, cls: 'text-error' },
  warning: { name: 'warning', filled: true, cls: 'text-on-tertiary-container' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const toast = useCallback((title: string, description?: string, tone: ToastTone = 'default') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current.slice(-2), { id, title, description, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((item) => {
          const icon = TONE_ICON[item.tone];
          return (
            <ToastPrimitive.Root
              key={item.id}
              className={clsx(
                'pointer-events-auto flex items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-lg py-md shadow-card-hover',
              )}
            >
              <Icon name={icon.name} filled={icon.filled} size={22} className={icon.cls} />
              <div className="min-w-0">
                <ToastPrimitive.Title className="font-label-md text-label-md font-semibold text-on-surface">
                  {item.title}
                </ToastPrimitive.Title>
                {item.description ? (
                  <ToastPrimitive.Description className="mt-0.5 font-body-md text-body-md text-sm text-on-surface-variant">
                    {item.description}
                  </ToastPrimitive.Description>
                ) : null}
              </div>
              <ToastPrimitive.Close
                aria-label="Cerrar"
                className="ml-auto flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
              >
                <Icon name="close" size={16} />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[80] flex w-[calc(100%-2rem)] max-w-md flex-col gap-2" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
