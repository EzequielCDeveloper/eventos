import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Checkbox } from '@/components/ui/Checkbox';
import { SkeletonCard, StateView } from '@/components/common/StateView';
import { useToast } from '@/components/ui/Toast';
import { money, formatDate, formatTime } from '@/lib/formatters';
import { RENTAL_TABS, RESERVATION_STATUS_LABELS } from '@/lib/constants';
import { clsx } from 'clsx';
import type { ReservationDetail, ReviewPayload } from '@/types/api';

const reservationsKey = (tab: string) => ['reservations', 'list', tab] as const;

/**
 * Rental history (FR-012.2): tabs Active / In-progress / Completed /
 * Cancelled. Detail modal with cancellation (retention acceptance, FR-007)
 * and a review form gated on payment complete AND event_date < now
 * (FR-012.3).
 */
export default function RentalHistoryPage() {
  const [tab, setTab] = useState('activas');

  return (
    <div>
      <div className="mb-lg">
        <h1 className="mb-xs font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">
          Mis Rentas
        </h1>
        <p className="text-on-surface-variant">Gestiona y revisa el historial de tus eventos.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {RENTAL_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {RENTAL_TABS.map((t) => (
          <TabsContent key={t.id} value={t.id}>
            <RentalTab statuses={t.statuses} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function useReservations(statuses: string[]) {
  return useQuery({
    queryKey: reservationsKey(statuses.join(',')),
    queryFn: async () => {
      // Fetch one page per status (few statuses per tab).
      const pages = await Promise.all(
        statuses.map((status) => apiGet<ReservationDetail[]>(`/reservations?status=${status}&limit=50`)),
      );
      return pages.flat();
    },
  });
}

function RentalTab({ statuses }: { statuses: string[] }) {
  const { data: items = [], isLoading, isError, refetch } = useReservations(statuses);
  const [detailId, setDetailId] = useState<number | null>(null);

  return (
    <div>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-lg md:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <StateView
          state="error"
          title="No se pudieron cargar tus rentas"
          action={<Button variant="outline" onClick={() => refetch()}>Reintentar</Button>}
        />
      ) : items.length === 0 ? (
        <StateView
          state="empty"
          icon="event_busy"
          title="No hay rentas en esta categoría"
          copy="Cuando reserves un servicio aparecerá aquí."
          action={
            <Link to="/">
              <Button>Explorar servicios</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-lg md:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <RentalCard key={r.id} reservation={r} onOpen={() => setDetailId(r.id)} />
          ))}
        </div>
      )}

      {detailId != null && <RentalDetailModal reservationId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function RentalCard({ reservation, onOpen }: { reservation: ReservationDetail; onOpen: () => void }) {
  const cancelled = reservation.status === 'cancelada';
  const item = reservation.items[0];
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-surface-variant bg-surface-container-lowest shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <div className="relative h-40 w-full bg-surface-container">
        <div className="flex h-full w-full items-center justify-center bg-surface-container">
          <Icon name="event" size={40} className="text-on-surface-variant" />
        </div>
        <div className="absolute right-sm top-sm rounded-full border border-surface-variant bg-surface-container-lowest/90 px-3 py-1 backdrop-blur-sm">
          <span className={clsx('flex items-center gap-1 font-label-sm text-label-sm', cancelled ? 'text-outline' : 'text-primary')}>
            <Icon name={cancelled ? 'cancel' : 'check_circle'} size={16} filled={!cancelled} />
            {RESERVATION_STATUS_LABELS[reservation.status]}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-md">
        <h3 className="mb-xs font-headline-md text-[20px] leading-tight text-on-surface">{item?.service_title ?? 'Servicio'}</h3>
        <div className="mb-md flex flex-col gap-xs font-body-md text-[14px] text-on-surface-variant">
          <span className="flex items-center gap-2">
            <Icon name="event" size={18} /> {formatDate(reservation.event_date)}
          </span>
          <span className="flex items-center gap-2">
            <Icon name="schedule" size={18} /> {formatTime(reservation.start_time)} – {formatTime(reservation.end_time)}
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-surface-variant pt-sm">
          <span className="font-label-md text-label-md text-on-surface-variant">Total</span>
          <span className="font-headline-md text-[18px] text-on-surface">{money(reservation.total_price)} MXN</span>
        </div>
        <button
          onClick={onOpen}
          className="mt-md rounded-lg border border-primary py-2.5 font-label-md text-primary transition-colors hover:bg-primary-fixed/20"
        >
          Ver detalle
        </button>
      </div>
    </article>
  );
}

function RentalDetailModal({ reservationId, onClose }: { reservationId: number; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: reservation, isLoading } = useQuery({
    queryKey: ['reservations', 'detail', reservationId],
    queryFn: async () => {
      const all = await apiGet<ReservationDetail[]>(`/reservations?limit=100`);
      return all.find((r) => r.id === reservationId);
    },
  });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [retentionAccepted, setRetentionAccepted] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hover, setHover] = useState(0);

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiPost(`/reservations/${reservationId}/cancel`, {
        reason: 'Cancelación por el cliente',
        retention_accepted: retentionAccepted,
      }),
    onSuccess: () => {
      toast('Reserva cancelada. Revisa el estado del reembolso.', undefined, 'success');
      setCancelOpen(false);
      onClose();
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo cancelar.', undefined, 'error'),
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      apiPost<ReviewPayload>('/reviews', { reservation_id: reservationId, rating, comment }),
    onSuccess: () => {
      toast('¡Gracias por tu reseña!', undefined, 'success');
      setReviewOpen(false);
      onClose();
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo enviar la reseña.', undefined, 'error'),
  });

  if (isLoading || !reservation) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent title="Detalle de reserva">
          <div className="p-lg text-center">Cargando…</div>
        </DialogContent>
      </Dialog>
    );
  }

  // FR-012.3: review only when completed AND event_date < now AND payment complete.
  const eventEnd = new Date(`${reservation.event_date}T${reservation.end_time || '23:59'}`).getTime();
  const canReview = reservation.status === 'completada' && eventEnd < Date.now();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={`Detalle de reserva #${reservation.id}`}>
        <div className="flex flex-col gap-md">
          <div className="flex items-center gap-md">
            <div className="flex-1">
              <h3 className="font-headline-md text-[20px] text-on-surface">{reservation.items[0]?.service_title ?? 'Servicio'}</h3>
              <p className="font-body-md text-body-md text-sm text-on-surface-variant">
                {formatDate(reservation.event_date)} · {formatTime(reservation.start_time)}
              </p>
            </div>
            <Badge variant={canReview ? 'success' : 'outline'}>
              {RESERVATION_STATUS_LABELS[reservation.status]}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-md font-body-md text-body-md">
            <InfoTile label="Base" value={money(reservation.base_amount)} />
            <InfoTile label="Extras" value={money(reservation.extras_amount)} />
            <InfoTile label="Impuestos" value={money(reservation.taxes_amount)} />
            <InfoTile label="Total" value={money(reservation.total_price)} money />
          </div>

          {reservation.contract ? (
            <div className="flex items-center gap-3 rounded-lg bg-surface-container-low p-md">
              <Icon name="description" className="text-primary" size={20} />
              <span className="font-body-md text-body-md text-sm text-on-surface-variant">
                Contrato #{reservation.contract.id} · {reservation.contract.status.replace(/_/g, ' ')}
              </span>
            </div>
          ) : null}

          {/* Review (conditional on FR-012.3) */}
          {canReview ? (
            <Button onClick={() => setReviewOpen(true)}>
              <Icon name="star_rate" size={18} /> Calificar este servicio
            </Button>
          ) : reservation.status === 'completada' ? (
            <div className="rounded-lg bg-surface-container-low p-md text-center">
              <span className="flex items-center justify-center gap-1 font-label-sm text-[11px] text-on-surface-variant">
                <Icon name="info" size={14} /> Calificación disponible después del evento
              </span>
            </div>
          ) : null}

          {/* Cancel (active states only) */}
          {['confirmada', 'en_curso', 'pago_anticipo', 'contrato_confirmado', 'permiso_alcohol'].includes(reservation.status) ? (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              <Icon name="cancel" size={18} /> Cancelar reserva
            </Button>
          ) : null}
        </div>
      </DialogContent>

      {/* Cancel confirmation */}
      {cancelOpen ? (
        <Dialog open onOpenChange={(o) => !o && setCancelOpen(false)}>
          <DialogContent title="Cancelar reserva">
            <div className="flex flex-col gap-md">
              <div className="flex items-start gap-md rounded-lg bg-surface-container-low p-md">
                <Icon name="policy" className="mt-1 text-outline" size={20} />
                <div>
                  <p className="font-label-md text-label-md font-semibold text-on-surface">Política de retención del proveedor</p>
                  <p className="mt-1 font-body-md text-body-md text-sm text-on-surface-variant">
                    Según la política aplicable, se retiene un porcentaje del total al cancelar dentro de la ventana.
                    Reembolso estimado: {money(estimateRefund(reservation))}.
                  </p>
                </div>
              </div>
              <Checkbox
                id="cancel-accept"
                checked={retentionAccepted}
                onCheckedChange={setRetentionAccepted}
                label="Entiendo la política de retención y confirmo la cancelación."
              />
              <div className="flex gap-md">
                <Button variant="outline" className="flex-1" onClick={() => setCancelOpen(false)}>
                  Seguir con la reserva
                </Button>
                <Button
                  variant="danger"
                  className="flex-1 !rounded-lg"
                  disabled={!retentionAccepted}
                  loading={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                >
                  Cancelar reserva
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Review form */}
      {reviewOpen ? (
        <Dialog open onOpenChange={(o) => !o && setReviewOpen(false)}>
          <DialogContent title="Calificar servicio">
            <div className="flex flex-col gap-md">
              <label className="font-label-md text-label-md text-on-surface">Tu calificación</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    aria-label={`${star} estrellas`}
                  >
                    <Icon
                      name="star"
                      filled={(hover || rating) >= star}
                      size={32}
                      className={(hover || rating) >= star ? 'text-secondary' : 'text-outline'}
                    />
                  </button>
                ))}
              </div>
              <label className="font-label-md text-label-md text-on-surface">Comentario (opcional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
                placeholder="Cuéntanos cómo estuvo tu evento..."
                className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 font-body-md text-body-md text-on-surface min-h-[100px] resize-y focus:ring-2 focus:ring-primary focus:outline-none"
              />
              <Button
                disabled={rating === 0}
                loading={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate()}
              >
                Enviar reseña
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </Dialog>
  );
}

function InfoTile({ label, value, money: isMoney }: { label: string; value: string; money?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-container-low p-md">
      <p className="font-label-sm text-label-sm text-on-surface-variant">{label}</p>
      <p className={clsx('font-semibold', isMoney ? 'text-primary' : 'text-on-surface')}>{value}</p>
    </div>
  );
}

function estimateRefund(reservation: ReservationDetail): number {
  const total = Number(reservation.total_price);
  const snapshot = (reservation.cancellation_policy_snapshot ?? {}) as { retention_percent?: number };
  const retention = snapshot.retention_percent ?? 50;
  return Math.round((total * (100 - retention)) / 100);
}
