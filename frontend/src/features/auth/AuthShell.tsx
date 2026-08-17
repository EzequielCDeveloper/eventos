import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';

/**
 * Shared centered layout for auth screens (login/register), styled after
 * the mockup surface tokens.
 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-margin-mobile py-12">
      <Link to="/" className="mb-lg font-display-lg text-headline-lg text-primary tracking-tight">
        FiestaExpert
      </Link>
      <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-card">
        <h1 className="font-headline-md text-headline-md text-on-surface mb-xs">{title}</h1>
        {subtitle ? <p className="font-body-md text-body-md text-on-surface-variant mb-lg">{subtitle}</p> : null}
        {children}
      </div>
      <p className="mt-md flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
        <Icon name="lock" size={16} /> Tus datos se tratan conforme a la LFPDPPP.
      </p>
    </div>
  );
}
