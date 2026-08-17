import { clsx } from 'clsx';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Material Symbols icon (FR-015.4). Mirrors the mockup's use of the
 * `material-symbols-outlined` font (loaded in index.html).
 */
export interface IconProps {
  name: string;
  filled?: boolean;
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  'aria-label'?: string;
}

export function Icon({
  name,
  filled = false,
  size = 24,
  className,
  style,
  title,
  ...rest
}: IconProps): ReactNode {
  const variation = `'FILL' ${filled ? 1 : 0}`;
  return (
    <span
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      title={title}
      className={clsx('material-symbols-outlined select-none', className)}
      style={{
        fontSize: typeof size === 'number' ? `${size}px` : size,
        fontVariationSettings: variation,
        ...style,
      }}
      {...rest}
    >
      {name}
    </span>
  );
}
