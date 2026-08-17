import { Slot } from '@radix-ui/react-slot';
import { clsx } from 'clsx';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'warning';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  loading?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-container focus-visible:ring-primary shadow-md disabled:bg-surface-container-high disabled:text-on-surface-variant',
  secondary:
    'bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed-dim focus-visible:ring-secondary disabled:opacity-60',
  outline:
    'border border-primary text-primary bg-surface-container-lowest hover:bg-primary-fixed/50 focus-visible:ring-primary',
  ghost:
    'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface focus-visible:ring-outline',
  danger:
    'bg-error text-on-error hover:bg-error-container hover:text-on-error-container focus-visible:ring-error',
  warning:
    'bg-on-tertiary-container text-white hover:bg-on-tertiary-container/90 focus-visible:ring-on-tertiary-container',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-label-sm rounded-full',
  md: 'px-5 py-2.5 text-label-md rounded-full',
  lg: 'px-xl py-3 text-label-md rounded-full text-[16px]',
  icon: 'w-10 h-10 rounded-full',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', className, asChild, loading, children, disabled, type = 'button', ...props },
    ref,
  ) => {
    const classes = clsx(
      'inline-flex items-center justify-center gap-2 font-label-md font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:hover:scale-100',
      VARIANTS[variant],
      SIZES[size],
      className,
    );
    if (asChild) {
      return (
        <Slot className={classes} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button ref={ref} type={type} className={classes} disabled={disabled || loading} {...props}>
        {loading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
