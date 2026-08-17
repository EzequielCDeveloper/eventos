import { Fragment } from 'react';
import { Icon } from '../ui/Icon';

/** 1–5 star rating display (FR-005.4). */
export function Rating({
  value,
  size = 18,
  count,
  className,
}: {
  value: number | null | undefined;
  size?: number;
  count?: number;
  className?: string;
}) {
  const rounded = Math.round(value ?? 0);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className ?? ''}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Fragment key={star}>
          <Icon
            name="star"
            filled={star <= rounded}
            size={size}
            className={star <= rounded && (value ?? 0) > 0 ? 'text-secondary' : 'text-outline'}
          />
        </Fragment>
      ))}
      {value != null ? <span className="ml-1 font-label-sm text-label-sm font-semibold text-on-surface">{Number(value).toFixed(1)}</span> : null}
      {count != null ? <span className="font-label-sm text-label-sm text-on-surface-variant">({count})</span> : null}
    </span>
  );
}
