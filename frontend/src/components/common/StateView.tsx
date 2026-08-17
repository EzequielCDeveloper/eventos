import { clsx } from 'clsx';
import { Icon } from '../ui/Icon';

/** Shimmer skeleton (states.css convention, FR-015 states). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-busy="true" className={clsx('fe-skeleton rounded-lg', className)} />;
}

export function SkeletonCard() {
  return <div className="fe-skeleton fe-skeleton-card rounded-xl" aria-busy="true" />;
}

export type ViewState = 'loading' | 'empty' | 'error' | 'no-results';

export interface StateViewProps {
  state: ViewState;
  icon?: string;
  title?: string;
  copy?: string;
  action?: React.ReactNode;
  className?: string;
}

const STATE_META: Record<ViewState, { icon: string; title: string; copy: string }> = {
  loading: { icon: 'hourglass_top', title: '', copy: '' },
  empty: { icon: 'inbox', title: 'Sin resultados', copy: 'No hay elementos para mostrar.' },
  'no-results': {
    icon: 'search_off',
    title: 'No encontramos resultados',
    copy: 'Sugerimos ampliar tus filtros para ver más opciones.',
  },
  error: {
    icon: 'error',
    title: 'Algo salió mal',
    copy: 'No pudimos cargar la información. Intenta de nuevo.',
  },
};

/** Shared empty/error/no-results view (states.css fe-state, FR-015 states). */
export function StateView({ state, icon, title, copy, action, className }: StateViewProps) {
  if (state === 'loading') return null;
  const meta = STATE_META[state];
  return (
    <div className={clsx('fe-state flex flex-col items-center justify-center text-center gap-2 py-xl min-h-[12rem]', className)}>
      <span className="rounded-full bg-surface-container-lowest shadow-sm border border-surface-container-high flex h-24 w-24 items-center justify-center mb-lg">
        <Icon name={icon ?? meta.icon} filled={state === 'error'} size={40} className={state === 'error' ? 'text-error' : 'text-primary'} />
      </span>
      <p className="font-headline-md text-headline-md text-on-surface">{title ?? meta.title}</p>
      <p className="font-body-lg text-body-lg text-on-surface-variant max-w-md">{copy ?? meta.copy}</p>
      {action ? <div className="mt-md">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx('inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent', className)}
      role="status"
      aria-label="Cargando"
    />
  );
}
