import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useServiceDetail } from '@/features/search/useSearch';
import { useServiceSlots, useServiceReviews, openConversation, type ServiceReview } from './slots';
import { useToggleFavorite } from '@/features/favorites/hooks';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Rating } from '@/components/common/Rating';
import { Skeleton, StateView } from '@/components/common/StateView';
import { useToast } from '@/components/ui/Toast';
import { money, formatDate } from '@/lib/formatters';
import { SERVICE_TYPE_LABELS } from '@/lib/constants';
import { clsx } from 'clsx';
import type { ServiceDetail, SlotAvailabilityRow } from '@/types/api';

/**
 * Service detail (FR-005): gallery (≥5 swipeable photos), pricing, rating,
 * amenities, extras, slots, cancellation policy, reviews, favorite toggle.
 */
export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: service, isLoading, isError } = useServiceDetail(id);

  // Slot selection is shared by the desktop widget and mobile panel.
  const [selectedDate, setSelectedDate] = useState('');
  const { data: slots = [], isLoading: slotsLoading } = useServiceSlots(id, selectedDate || undefined);
  const [selectedSlot, setSelectedSlot] = useState<SlotAvailabilityRow | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-lg">
        <Skeleton className="h-[350px] w-full rounded-xl" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !service) {
    return (
      <StateView
        state="error"
        title="No encontramos este servicio"
        copy="Es posible que haya sido retirado o que la URL sea incorrecta."
        action={
          <Link to="/">
            <Button>
              <Icon name="arrow_back" size={18} /> Volver al inicio
            </Button>
          </Link>
        }
      />
    );
  }

  const svc = service;

  async function handleContact() {
    if (!user || !accessToken) {
      navigate('/login', { state: { from: `/service/${svc.id}` } });
      return;
    }
    try {
      const conversation = await openConversation({
        clientId: user.id,
        providerId: svc.provider.id,
        serviceId: svc.id,
      });
      navigate('/chat', { state: { conversationId: conversation.id } });
    } catch {
      toast('No se pudo abrir la conversación.', undefined, 'error');
    }
  }

  function handleRent() {
    if (!selectedSlot) {
      toast('Selecciona un horario disponible.', undefined, 'warning');
      return;
    }
    if (!user || !accessToken) {
      navigate('/login', { state: { from: `/service/${svc.id}` } });
      return;
    }
    // Persist the draft so the 6-step flow preserves it on back (FR-006.9).
    sessionStorage.setItem(
      'fiestaexpert-booking-draft',
      JSON.stringify({
        serviceId: svc.id,
        slot_id: selectedSlot.slot_id,
        slot_date: selectedSlot.slot_date,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
      }),
    );
    navigate(`/booking/${svc.id}`);
  }

  const slotProps = {
    slots,
    loading: slotsLoading,
    selectedDate,
    onDateChange: (value: string) => {
      setSelectedDate(value);
      setSelectedSlot(null);
    },
    selectedSlot,
    onSelectSlot: setSelectedSlot,
  };

  return (
    <div>
      <MobileDetailBar favoriteId={svc.id} />

      <main className="mx-auto max-w-[1280px] md:grid md:grid-cols-12 md:gap-lg">
        {/* Left: imagery + details */}
        <div className="md:col-span-8">
          <Gallery photos={svc.photos.map((p) => p.url)} title={svc.title} />

          <div className="space-y-lg py-6">
            <TitleSection service={svc} />
            <DescriptionSection description={svc.description} />
            {svc.amenities.length > 0 ? <AmenitiesSection amenities={svc.amenities} /> : null}
            {svc.extras.length > 0 ? <ExtrasSection extras={svc.extras} /> : null}
            <PolicySection
              retentionPercent={svc.cancellation_policy.retention_percent}
              penaltyFreeDays={svc.cancellation_policy.penalty_free_window_days}
              depositRefundable={svc.cancellation_policy.deposit_refundable}
            />
            <ReviewsSection serviceId={svc.id} />
          </div>
        </div>

        {/* Right: booking widget (desktop) */}
        <div className="hidden md:block md:col-span-4 relative">
          <div className="sticky top-24 rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-card">
            <PriceSummary service={svc} {...slotProps} />
            <Button onClick={handleRent} size="lg" className="mb-4 w-full !rounded-lg">
              Rentar ahora
            </Button>
            <Button variant="outline" size="lg" className="w-full !rounded-lg" onClick={handleContact}>
              <Icon name="chat" size={20} /> Contactar al Anfitrión
            </Button>
            <p className="mt-4 text-center font-body-md text-body-md text-xs text-on-surface-variant">
              No se te cobrará nada aún.
            </p>
          </div>
        </div>
      </main>

      {/* Mobile: slot picker + sticky booking bar */}
      <div className="md:hidden pb-32">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-card">
          <h3 className="mb-2 font-headline-md text-headline-md text-on-surface">Fecha y horario</h3>
          <SlotPickerPanel {...slotProps} />
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between bg-surface-container-lowest border-t border-outline-variant px-margin-mobile py-3 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] md:hidden">
        <div>
          <span className="block font-label-sm text-label-sm text-on-surface-variant">Desde</span>
          <span className="block font-headline-md text-headline-md text-on-surface">
            {money(basePriceOf(svc))} MXN
          </span>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" aria-label="Chatear con el anfitrión" className="!rounded-lg" onClick={handleContact}>
            <Icon name="chat" size={22} />
          </Button>
          <Button onClick={handleRent} size="lg" className="!rounded-lg">
            Rentar ahora
          </Button>
        </div>
      </div>
    </div>
  );
}

function basePriceOf(service: ServiceDetail): string {
  return (
    service.pricing.salon?.base_block_price ??
    service.pricing.sound_packages[0]?.base_price ??
    service.pricing.persona?.price_per_person_per_hour ??
    '0'
  );
}

function MobileDetailBar({ favoriteId }: { favoriteId: number }) {
  const navigate = useNavigate();
  const { isFavorite, toggle } = useToggleFavorite(favoriteId);
  return (
    <header className="mb-md flex items-center justify-between md:hidden">
      <button
        onClick={() => navigate(-1)}
        aria-label="Volver"
        className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
      >
        <Icon name="arrow_back" size={22} />
      </button>
      <button
        onClick={toggle}
        aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${isFavorite ? 'text-error' : 'text-on-surface-variant'}`}
      >
        <Icon name="favorite" filled={isFavorite} size={24} />
      </button>
    </header>
  );
}

function Gallery({ photos, title }: { photos: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const count = photos.length;

  function shift(delta: number) {
    if (count === 0) return;
    setIndex((i) => (i + delta + count) % count);
  }

  return (
    <div className="relative h-[350px] w-full overflow-hidden md:h-[500px] md:rounded-xl">
      {count === 0 ? (
        <div className="flex h-full w-full items-center justify-center bg-surface-container">
          <Icon name="image" size={64} className="text-on-surface-variant" />
        </div>
      ) : (
        <div
          className="flex h-full snap-x snap-mandatory overflow-x-auto no-scrollbar"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== index) setIndex(i);
          }}
        >
          {photos.map((url, i) => (
            <img key={`${url}-${i}`} src={url} alt={`${title} foto ${i + 1}`} className="h-full w-full shrink-0 snap-center object-cover" loading="lazy" />
          ))}
        </div>
      )}
      {count > 1 ? (
        <>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-md">
            {photos.map((_, i) => (
              <span key={i} className={`h-2 w-2 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/50'}`} />
            ))}
          </div>
          <button onClick={() => shift(-1)} aria-label="Foto anterior" className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50">
            <Icon name="chevron_left" size={24} />
          </button>
          <button onClick={() => shift(1)} aria-label="Foto siguiente" className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50">
            <Icon name="chevron_right" size={24} />
          </button>
        </>
      ) : null}
    </div>
  );
}

function TitleSection({ service }: { service: ServiceDetail }) {
  return (
    <section className="border-b border-outline-variant pb-lg">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          <Icon name="workspace_premium" size={16} /> {SERVICE_TYPE_LABELS[service.service_type]}
        </Badge>
        {service.provider.verified ? (
          <span className="flex items-center gap-1 font-label-md text-primary">
            <Icon name="verified" size={16} filled /> Verificado
          </span>
        ) : null}
      </div>
      <h1 className="mb-2 font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
        {service.title}
      </h1>
      <div className="flex flex-wrap items-center gap-2 font-label-md text-on-surface-variant">
        <Rating value={service.rating.avg} size={18} count={service.rating.count} />
        <span>·</span>
        <span className="flex items-center gap-1">
          <Icon name="location_on" size={16} />
          {(service.location as { address?: string } | null)?.address ?? 'Ubicación no especificada'}
        </span>
        <span>· Capacidad {service.max_capacity} pers</span>
      </div>
    </section>
  );
}

function DescriptionSection({ description }: { description: string }) {
  const [readMore, setReadMore] = useState(false);
  return (
    <section className="border-b border-outline-variant pb-lg">
      <h2 className="mb-md font-headline-md text-headline-md text-on-surface">Acerca de este espacio</h2>
      <p className={clsx('font-body-md text-body-md text-on-surface-variant', !readMore && 'text-clamp-3')}>{description}</p>
      {!readMore ? (
        <button onClick={() => setReadMore(true)} className="mt-2 font-label-md text-primary font-semibold hover:underline">
          Leer más
        </button>
      ) : null}
    </section>
  );
}

function AmenitiesSection({ amenities }: { amenities: ServiceDetail['amenities'] }) {
  return (
    <section className="border-b border-outline-variant pb-lg">
      <h2 className="mb-md font-headline-md text-headline-md text-on-surface">Comodidades</h2>
      <div className="grid grid-cols-2 gap-md md:grid-cols-4">
        {amenities.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3">
            <Icon name="check_circle" filled className="text-primary" size={24} />
            <span className="font-body-md text-body-md text-on-surface">{a.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExtrasSection({ extras }: { extras: ServiceDetail['extras'] }) {
  return (
    <section className="border-b border-outline-variant pb-lg">
      <h2 className="mb-md font-headline-md text-headline-md text-on-surface">Servicios Extra (Opcional)</h2>
      <div className="space-y-3">
        {extras.map((extra) => (
          <div key={extra.id} className="flex items-start justify-between rounded-lg border border-outline-variant p-4">
            <div>
              <span className="block font-label-md text-label-md font-semibold text-on-surface">{extra.name}</span>
              <span className="block font-body-md text-body-md text-sm text-on-surface-variant">{extra.description}</span>
            </div>
            <span className="font-label-md text-label-md text-on-surface">{money(extra.price)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PolicySection({
  retentionPercent,
  penaltyFreeDays,
  depositRefundable,
}: {
  retentionPercent: number;
  penaltyFreeDays: number;
  depositRefundable: boolean;
}) {
  return (
    <section className="pb-2">
      <div className="flex items-start gap-3 rounded-lg bg-surface-container-low p-4">
        <Icon name="policy" className="text-on-surface-variant" size={22} />
        <div>
          <span className="block font-label-md text-label-md font-semibold text-on-surface">Política de Cancelación</span>
          <p className="mt-1 font-body-md text-body-md text-sm text-on-surface-variant">
            {depositRefundable ? 'Depósito reembolsable. ' : 'Depósito no reembolsable. '}
            Cancelación sin penalización hasta {penaltyFreeDays} días antes del evento; después aplica una retención del{' '}
            {retentionPercent}% del total.
          </p>
        </div>
      </div>
    </section>
  );
}

function ReviewsSection({ serviceId }: { serviceId: number }) {
  const { data: reviews = [], isLoading } = useServiceReviews(serviceId);
  return (
    <section className="pb-2">
      <h2 className="mb-md font-headline-md text-headline-md text-on-surface">Reseñas</h2>
      {isLoading ? (
        <div className="space-y-md">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant">Aún no hay reseñas para este servicio.</p>
      ) : (
        <div className="space-y-md">
          {reviews.slice(0, 6).map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewCard({ review }: { review: ServiceReview }) {
  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-md">
      <div className="mb-xs flex items-center justify-between">
        <Rating value={review.rating} size={16} />
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          {(review.client as { full_name?: string } | undefined)?.full_name ?? formatDate(review.created_at)}
        </span>
      </div>
      <p className="font-body-md text-body-md text-on-surface">{review.comment ?? 'Sin comentario'}</p>
    </div>
  );
}

export interface SlotPickerSlot {
  slot: SlotAvailabilityRow;
}

/**
 * Date + time-slot picker (FR-005.6). Shared by the desktop widget and the
 * mobile panel — state lives in the parent so "Rentar ahora" always sees
 * the current selection.
 */
function SlotPickerPanel({
  slots,
  loading,
  selectedDate,
  onDateChange,
  selectedSlot,
  onSelectSlot,
}: {
  slots: SlotAvailabilityRow[];
  loading: boolean;
  selectedDate: string;
  onDateChange: (value: string) => void;
  selectedSlot: SlotAvailabilityRow | null;
  onSelectSlot: (slot: SlotAvailabilityRow) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, SlotAvailabilityRow[]>();
    for (const slot of slots) {
      const list = map.get(slot.slot_date) ?? [];
      list.push(slot);
      map.set(slot.slot_date, list);
    }
    return map;
  }, [slots]);

  const dates = useMemo(() => Array.from(grouped.keys()).slice(0, 15), [grouped]);

  return (
    <div className="mb-lg">
      <h3 className="mb-2 font-label-md text-label-md font-semibold text-on-surface">Selecciona fecha y horario</h3>
      <select
        aria-label="Fecha del evento"
        value={selectedDate}
        onChange={(e) => onDateChange(e.target.value)}
        className="mb-2 w-full rounded-lg border border-outline-variant bg-surface p-3 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
      >
        <option value="">Selecciona la fecha</option>
        {dates.map((d) => (
          <option key={d} value={d}>
            {formatDate(d)}
          </option>
        ))}
      </select>
      <select
        aria-label="Horario disponible"
        value={selectedSlot?.start_time ?? ''}
        onChange={(e) => {
          const slot = (grouped.get(selectedDate) ?? []).find((s) => s.start_time === e.target.value);
          if (slot) onSelectSlot(slot);
        }}
        className="w-full rounded-lg border border-outline-variant bg-surface p-3 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
      >
        <option value="">Elige un horario</option>
        {(grouped.get(selectedDate) ?? []).map((slot) => {
          const available = slot.status_indicator !== 'lleno';
          return (
            <option key={slot.slot_id} value={slot.start_time} disabled={!available}>
              {slot.start_time} – {slot.end_time} {available ? '' : '(lleno)'}
            </option>
          );
        })}
      </select>
      {loading ? (
        <div className="mt-2">
          <Skeleton className="h-8 w-full" />
        </div>
      ) : null}
    </div>
  );
}

function PriceSummary({
  service,
  ...slotProps
}: { service: ServiceDetail } & {
  slots: SlotAvailabilityRow[];
  loading: boolean;
  selectedDate: string;
  onDateChange: (value: string) => void;
  selectedSlot: SlotAvailabilityRow | null;
  onSelectSlot: (slot: SlotAvailabilityRow) => void;
}) {
  const salon = service.pricing.salon;
  const persona = service.pricing.persona;
  const packages = service.pricing.sound_packages;

  return (
    <>
      <div className="mb-lg border-b border-outline-variant pb-md">
        <span className="mb-1 block font-body-md text-body-md text-on-surface-variant">Renta desde</span>
        <div className="flex items-baseline gap-1">
          <span className="font-headline-lg text-headline-lg text-on-surface">
            {money(basePriceOf(service)).replace('$', '')}
          </span>
          <span className="font-body-md text-body-md text-on-surface-variant">MXN</span>
        </div>
        <div className="mt-2 space-y-1 font-body-md text-body-md text-sm text-on-surface-variant">
          {salon ? (
            <div className="flex justify-between">
              <span>Bloque base:</span>
              <span className="font-medium text-on-surface">{salon.base_block_hours} horas</span>
            </div>
          ) : null}
          {salon ? (
            <div className="flex justify-between">
              <span>Hora extra:</span>
              <span className="font-medium text-on-surface">{money(salon.extra_hour_price)} MXN</span>
            </div>
          ) : null}
          {persona ? (
            <div className="flex justify-between">
              <span>Tarifa:</span>
              <span className="font-medium text-on-surface">{money(persona.price_per_person_per_hour)} /persona/hora</span>
            </div>
          ) : null}
          {packages.length > 0 ? (
            <div className="flex justify-between">
              <span>Paquetes:</span>
              <span className="font-medium text-on-surface">{packages.length}</span>
            </div>
          ) : null}
        </div>
      </div>
      <SlotPickerPanel {...slotProps} />
    </>
  );
}
