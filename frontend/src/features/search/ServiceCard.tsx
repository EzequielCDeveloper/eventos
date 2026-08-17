import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Rating } from '@/components/common/Rating';
import { money } from '@/lib/formatters';
import { SERVICE_TYPE_LABELS } from '@/lib/constants';
import type { ServiceSummary } from '@/types/api';

/**
 * Service result card (FR-004.3): photo, title, rating, capacity, price,
 * location + favorite toggle. Reused by search and favorites.
 */
export function ServiceCard({
  service,
  isFavorite = false,
  onToggleFavorite,
}: {
  service: ServiceSummary;
  isFavorite?: boolean;
  onToggleFavorite?: (id: number) => void;
}) {
  const address = (service.location as { address?: string } | null)?.address ?? '';

  return (
    <article className="group flex cursor-pointer flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-card hover:shadow-card-hover transition-all duration-300">
      <Link to={`/service/${service.id}`} className="relative block h-56 w-full overflow-hidden">
        {service.main_photo_url ? (
          <img
            src={service.main_photo_url}
            alt={service.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-container">
            <Icon name="photo_camera" size={40} className="text-on-surface-variant" />
          </div>
        )}
      </Link>
      {onToggleFavorite ? (
        <button
          type="button"
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(service.id);
          }}
          className={`absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-lowest/80 transition-colors m-3 ${
            isFavorite ? 'text-error' : 'text-on-surface-variant hover:text-error'
          }`}
        >
          <Icon name="favorite" filled={isFavorite} size={20} />
        </button>
      ) : null}

      <Link to={`/service/${service.id}`} className="flex flex-1 flex-col p-lg">
        <div className="mb-sm flex items-start justify-between gap-2">
          <div>
            <span className="mb-1 inline-block rounded bg-secondary-container px-2 py-0.5 font-label-sm text-[11px] text-on-secondary-container">
              {SERVICE_TYPE_LABELS[service.service_type]}
            </span>
            <h2 className="font-headline-md text-[20px] leading-tight text-on-surface group-hover:text-primary transition-colors">
              {service.title}
            </h2>
          </div>
          <Rating value={service.avg_rating} size={16} count={service.review_count} />
        </div>
        <p className="mb-md flex-1 font-body-md text-body-md text-sm text-on-surface-variant">
          Capacidad hasta {service.max_capacity} personas
          {service.provider_verified ? ' · Verificado' : ''}
        </p>
        <div className="flex items-center justify-between border-t border-surface-variant pt-4">
          <div>
            <p className="font-label-sm text-label-sm text-on-surface-variant">Desde</p>
            <p className="font-headline-md text-[18px] text-primary">
              {money(service.price)} MXN
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            {address ? (
              <span className="flex items-center gap-1 font-label-sm text-[12px] text-on-surface-variant">
                <Icon name="location_on" size={14} />
                {address}
              </span>
            ) : null}
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
              <Icon name="arrow_forward" size={20} />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
