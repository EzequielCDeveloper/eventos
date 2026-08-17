import { clsx } from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-primary-fixed text-on-primary-fixed-variant',
  secondary: 'bg-secondary-container text-on-secondary-container',
  success: 'bg-surface-container-low text-primary',
  warning: 'bg-on-tertiary-container text-white',
  danger: 'bg-error text-on-error',
  outline: 'bg-surface-container-lowest border border-outline-variant text-on-surface-variant',
};

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 font-label-sm text-label-sm font-semibold',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
