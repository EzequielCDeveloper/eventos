import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { SkeletonCard, StateView } from '@/components/common/StateView';
import { useFiltersStore, anyActiveFilter, EVENT_TYPE_SUGGESTIONS, useSearch } from './useSearch';
import { ServiceCard } from './ServiceCard';
import { useToggleFavorite } from '@/features/favorites/hooks';
import { useUiStore } from '@/stores/uiStore';
import { todayISO } from '@/lib/formatters';
import { clsx } from 'clsx';
import type { SearchSort, ServiceSummary } from '@/types/api';
import type { ServiceType } from '@/types/models';

const CATEGORIES: Array<{ value: ServiceType; label: string }> = [
  { value: 'salon', label: 'Salones' },
  { value: 'sonido', label: 'Sonidos' },
  { value: 'servicio_persona', label: 'Servicios' },
];

const SORT_OPTIONS: Array<{ value: SearchSort; label: string }> = [
  { value: 'created:desc', label: 'Más recientes' },
  { value: 'rating:desc', label: 'Mejor calificados' },
  { value: 'price:asc', label: 'Menor precio' },
  { value: 'price:desc', label: 'Mayor precio' },
  { value: 'name:asc', label: 'Nombre (A-Z)' },
];

const RATING_OPTIONS = [
  { value: '', label: 'Cualquiera' },
  { value: '4', label: '4+ estrellas' },
  { value: '4.5', label: '4.5+ estrellas' },
];

function FavoriteToggle({ service }: { service: ServiceSummary }) {
  const { isFavorite, toggle } = useToggleFavorite(service.id);
  return (
    <button
      type="button"
      aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      className={`absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-lowest/80 transition-colors ${
        isFavorite ? 'text-error' : 'text-on-surface-variant hover:text-error'
      }`}
    >
      <Icon name="favorite" filled={isFavorite} size={20} />
    </button>
  );
}

/**
 * Multi-filter search (FR-004). Filters persist across navigation via the
 * Zustand store (FR-004.2); results come from GET /services (D-002).
 */
export default function SearchPage() {
  const { filters, setFilter, reset } = useFiltersStore();
  const activeCategory = useUiStore((s) => s.activeCategory);
  const setCategory = useUiStore((s) => s.setCategory);
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useSearch(filters, query);

  const hasFilters = anyActiveFilter(filters);

  function toggleCategory(value: ServiceType | '') {
    setFilter('serviceType', value);
    setCategory(value === '' ? 'todos' : value);
  }

  function clearAll() {
    reset();
    setQuery('');
  }

  const resultCount = useMemo(() => data?.items.length ?? 0, [data]);

  return (
    <div>
      {/* Search + segments */}
      <section className="mb-lg">
        <div className="relative w-full max-w-2xl">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar lugares, servicios..."
            className="h-14 w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-12 pr-4 font-body-lg text-on-surface placeholder:text-outline shadow-card focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none transition-shadow"
          />
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={22} />
        </div>
        {/* Primary category row */}
        <div className="mt-md flex gap-4 overflow-x-auto no-scrollbar pb-2">
          <button
            onClick={() => toggleCategory('')}
            className={clsx(
              'whitespace-nowrap rounded-full px-6 py-2 font-label-md transition-colors',
              activeCategory === 'todos'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low',
            )}
          >
            Todos
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => toggleCategory(cat.value)}
              className={clsx(
                'whitespace-nowrap rounded-full px-6 py-2 font-label-md transition-colors',
                activeCategory === cat.value
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Filter chips row */}
      <section className="mb-xl">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
          <button
            onClick={() => setDialogOpen(true)}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant shadow-sm hover:bg-surface-container-low"
            aria-label="Filtros"
          >
            <Icon name="tune" size={22} />
          </button>
          <div className="mx-1 h-6 w-px bg-outline-variant" />
          <Chip label={filters.date ? new Date(`${filters.date}T12:00:00`).toLocaleDateString('es-MX') : 'Fecha'} onOpen={() => setDialogOpen(true)} active={Boolean(filters.date)} />
          <Chip label={filters.capacity !== '' ? `+${filters.capacity} pers` : 'Capacidad'} onOpen={() => setDialogOpen(true)} active={filters.capacity !== ''} />
          <Chip label={filters.zone || 'Zona'} onOpen={() => setDialogOpen(true)} active={Boolean(filters.zone)} />
          <Chip label={filters.minPrice !== '' || filters.maxPrice !== '' ? 'Presupuesto' : 'Presupuesto'} onOpen={() => setDialogOpen(true)} active={filters.minPrice !== '' || filters.maxPrice !== ''} />
          <Chip label={filters.eventTypeName || 'Tipo de Evento'} onOpen={() => setDialogOpen(true)} active={Boolean(filters.eventTypeName)} />
          <Chip label="Alberca" onOpen={() => setFilter('pool', !filters.pool)} active={filters.pool} />
          <Chip label="Internet" onOpen={() => setFilter('internet', !filters.internet)} active={filters.internet} />
          <Chip label={filters.rating !== '' ? `${filters.rating}+ ⭐` : 'Calificación'} onOpen={() => setDialogOpen(true)} active={filters.rating !== ''} />
        </div>
      </section>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <StateView
          state="error"
          title="No pudimos cargar los servicios"
          copy="Verifica tu conexión e inténtalo de nuevo."
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : data && data.items.length === 0 ? (
        <StateView
          state="no-results"
          title="No encontramos resultados"
          copy="Sugerimos ampliar tus filtros para ver más opciones en esta zona."
          action={
            <Button onClick={clearAll}>
              <Icon name="filter_alt_off" size={18} /> Limpiar filtros
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-md flex items-center justify-between">
            <p className="font-label-md text-label-md text-on-surface-variant">
              {resultCount} {resultCount === 1 ? 'servicio' : 'servicios'}
              {isFetching ? '…' : ''}
            </p>
            <div className="w-48">
              <Select
                value={filters.sort}
                onValueChange={(value) => setFilter('sort', value as SearchSort)}
                options={SORT_OPTIONS}
              />
            </div>
          </div>
          {hasFilters ? (
            <div className="mb-md flex flex-wrap items-center gap-2">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Filtros activos:</span>
              <button onClick={clearAll} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 font-label-sm text-[12px] text-on-primary">
                <Icon name="close" size={14} /> Limpiar todo
              </button>
            </div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
            {data!.items.map((service) => (
              <div key={service.id} className="relative">
                <ServiceCard service={service} />
                <FavoriteToggle service={service} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Filters dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent title="Filtros de búsqueda">
          <div className="flex flex-col gap-md">
            <Input
              label="Fecha del evento"
              type="date"
              min={todayISO()}
              value={filters.date}
              onChange={(e) => setFilter('date', e.target.value)}
            />
            <Input
              label="Capacidad mínima (personas)"
              type="number"
              min={1}
              value={filters.capacity === '' ? '' : String(filters.capacity)}
              onChange={(e) => setFilter('capacity', e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ej. 100"
            />
            <Input
              label="Zona / ubicación"
              value={filters.zone}
              onChange={(e) => setFilter('zone', e.target.value)}
              placeholder="Ej. Centro, Polanco…"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Precio mínimo (MXN)"
                type="number"
                min={0}
                value={filters.minPrice === '' ? '' : String(filters.minPrice)}
                onChange={(e) => setFilter('minPrice', e.target.value === '' ? '' : Number(e.target.value))}
              />
              <Input
                label="Precio máximo (MXN)"
                type="number"
                min={0}
                value={filters.maxPrice === '' ? '' : String(filters.maxPrice)}
                onChange={(e) => setFilter('maxPrice', e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <Select
              value={filters.eventTypeName}
              onValueChange={(value) => setFilter('eventTypeName', value)}
              options={[{ value: '', label: 'Cualquier tipo de evento' }, ...EVENT_TYPE_SUGGESTIONS.map((e) => ({ value: e, label: e }))]}
              placeholder="Tipo de evento"
            />

            <div className="flex items-center gap-6">
              <Checkbox id="filter-pool" checked={filters.pool} onCheckedChange={(v) => setFilter('pool', v)} label="Alberca" />
              <Checkbox id="filter-internet" checked={filters.internet} onCheckedChange={(v) => setFilter('internet', v)} label="Internet / Wi-Fi" />
            </div>

            <label className="font-label-md text-label-md text-on-surface mb-1">Calificación mínima</label>
            <Select
              value={filters.rating === '' ? '' : String(filters.rating)}
              onValueChange={(value) => setFilter('rating', value === '' ? '' : Number(value))}
              options={RATING_OPTIONS}
            />

            <div className="mt-md flex justify-end gap-2">
              <Button variant="outline" onClick={() => { reset(); }}>
                Limpiar
              </Button>
              <Button onClick={() => setDialogOpen(false)}>Aplicar filtros</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({
  label,
  onOpen,
  active,
}: {
  label: string;
  onOpen: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onOpen}
      className={clsx(
        'flex items-center gap-1 whitespace-nowrap rounded-full border px-4 py-2 font-label-md transition-colors',
        active
          ? 'border-primary bg-primary text-on-primary shadow-sm'
          : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low',
      )}
    >
      {label}
      <Icon name="keyboard_arrow_down" size={18} />
    </button>
  );
}
