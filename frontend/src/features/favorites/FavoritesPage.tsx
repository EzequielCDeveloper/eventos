import { Link } from 'react-router-dom';
import { useFavorites, useRemoveFavorite } from './hooks';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard, StateView } from '@/components/common/StateView';
import { SERVICE_TYPE_LABELS } from '@/lib/constants';
import type { FavoriteItem } from '@/types/api';

/**
 * Favorites list (FR-012.1) — persistent across sessions, synced with the
 * backend (GET/DELETE /favorites).
 */
export default function FavoritesPage() {
  const { data: items = [], isLoading, isError, refetch } = useFavorites();
  const remove = useRemoveFavorite();

  if (isLoading) {
    return (
      <div>
        <div className="mb-lg">
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-xs">Favoritos</h1>
          <p className="text-on-surface-variant">Servicios que guardaste para tus próximos eventos.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <StateView
        state="error"
        title="No pudimos cargar tus favoritos"
        copy="Intenta de nuevo en unos momentos."
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (items.length === 0) {
    return (
      <StateView
        state="empty"
        icon="favorite"
        title="Aún no tienes favoritos"
        copy="Toca el corazón en cualquier servicio para guardarlo aquí."
        action={
          <Link to="/">
            <Button>
              <Icon name="search" size={18} /> Explorar servicios
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-lg flex items-end justify-between gap-md">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-xs">Favoritos</h1>
          <p className="text-on-surface-variant">Servicios que guardaste para tus próximos eventos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
        {items.map((item) => (
          <FavoriteCard key={item.id} item={item} onRemove={() => remove.mutate(item.id)} />
        ))}
      </div>
    </div>
  );
}

function FavoriteCard({ item, onRemove }: { item: FavoriteItem; onRemove: () => void }) {
  const photo = item.service.photo?.url;
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-card hover:shadow-card-hover transition-all duration-300">
      <Link to={`/service/${item.service_id}`} className="relative block h-56 w-full overflow-hidden">
        {photo ? (
          <img src={photo} alt={item.service.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-container">
            <Icon name="storefront" size={40} className="text-on-surface-variant" />
          </div>
        )}
        <button
          type="button"
          aria-label="Quitar de favoritos"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-lowest/80 text-error transition-colors"
        >
          <Icon name="favorite" filled size={20} />
        </button>
      </Link>
      <div className="flex flex-1 flex-col p-lg">
        <span className="mb-1 inline-block w-fit rounded bg-secondary-container px-2 py-0.5 font-label-sm text-[11px] text-on-secondary-container">
          {SERVICE_TYPE_LABELS[item.service.service_type]}
        </span>
        <Link to={`/service/${item.service_id}`}>
          <h2 className="font-headline-md text-[20px] leading-tight text-on-surface group-hover:text-primary transition-colors">
            {item.service.title}
          </h2>
        </Link>
        <p className="mb-3 font-body-md text-body-md text-sm text-on-surface-variant">
          Capacidad hasta {item.service.max_capacity} personas
          {item.service.provider.verified ? ' · Verificado' : ''}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-surface-variant pt-4">
          <p className="font-label-sm text-label-sm text-on-surface-variant">Desde</p>
        </div>
        <Link
          to={`/service/${item.service_id}`}
          className="mt-md flex items-center justify-center gap-2 rounded-full border border-primary py-2.5 font-label-md text-primary hover:bg-primary-fixed/20 transition-colors"
        >
          <Icon name="arrow_forward" size={18} /> Ver servicio
        </Link>
      </div>
    </article>
  );
}
