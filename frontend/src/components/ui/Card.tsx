import { clsx } from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
}

export function Card({ children, className, hover = false, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-surface-container-lowest rounded-xl overflow-hidden shadow-card border border-surface-variant',
        hover && 'hover:shadow-card-hover transition-all duration-300',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('p-lg', className)} {...props}>{children}</div>;
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={clsx('font-headline-md text-headline-md text-on-surface', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('px-lg pb-lg', className)} {...props}>{children}</div>;
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('px-lg py-md border-t border-surface-variant flex items-center gap-2', className)} {...props}>
      {children}
    </div>
  );
}
