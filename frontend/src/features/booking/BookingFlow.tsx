import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServiceDetail } from '@/features/search/useSearch';
import { useServiceSlots } from './slots';
import {
  createReservation,
  transitionReservation,
  createPayment,
  readBookingDraft,
  clearBookingDraft,
  computeClientPrices,
} from './bookingApi';
import { tokenizeCard, isValidCardNumber } from '@/lib/conekta';
import { ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Skeleton, StateView, Spinner } from '@/components/common/StateView';
import { useToast } from '@/components/ui/Toast';
import { money, formatDate } from '@/lib/formatters';
import { IVA_RATE, SERVICE_TYPE_LABELS } from '@/lib/constants';
import { clsx } from 'clsx';
import type { ReservationDetail, SlotAvailabilityRow } from '@/types/api';

/**
 * 6-step booking flow (FR-006.1–FR-006.9, D-007):
 *   1 fecha/hora · 2 extras · 3 resumen (renta+impuestos, comisión oculta) ·
 *   4 pago Conekta.js · 5 contrato (solo salones) · 6 confirmación (+ T&C)
 *
 * Backend state-machine conformance (backend reservation.state):
 *   - salón:    creado → pendiente_firma (creates the contract row); the
 *     advance payment unlocks when the provider confirms the contract
 *     (bilateral, BR-012.6) — the flow acknowledges and defers the charge.
 *   - sonido/servicio_persona: creado → disponibilidad_verificada →
 *     disponible_para_reserva → pago_anticipo → (POST /payments anticipo) →
 *     confirmada.
 * Alcohol prompt (FR-006.8): after payment, when alcohol was requested, the
 * H-5 continue/cancel modal is shown (server job alcohol-h5 triggers the
 * real timed notification).
 */
export default function BookingFlowPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: service, isLoading } = useServiceDetail(serviceId);
  const draft = useMemo(() => readBookingDraft(), []);

  // Flow state
  const [step, setStep] = useState(1);
  const [selectedSlot, setSelectedSlot] = useState<SlotAvailabilityRow | null>(null);
  const [extrasSelected, setExtrasSelected] = useState<number[]>([]);
  const [alcoholRequested, setAlcoholRequested] = useState(false);
  const [contractAck, setContractAck] = useState(false);
  const [tcAccepted, setTcAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Payment state
  const [card, setCard] = useState({ name: '', number: '', exp: '', cvc: '' });
  const [paymentState, setPaymentState] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [createdReservation, setCreatedReservation] = useState<ReservationDetail | null>(null);
  const [alcoholModal, setAlcoholModal] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-lg">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!service) {
    return (
      <StateView state="error" title="No encontramos el servicio" copy="Regresa y elige de nuevo." />
    );
  }

  const svc = service;
  const isSalon = svc.service_type === 'salon';
  const baseNumber = Number(basePriceOf(svc));
  const extrasTotal = svc.extras
    .filter((e) => extrasSelected.includes(e.id))
    .reduce((acc, e) => acc + Number(e.price), 0);
  const prices = computeClientPrices({ base: baseNumber, extrasTotal, ivaRate: IVA_RATE });

  const stepLabels = isSalon
    ? ['Fecha y hora', 'Extras', 'Resumen', 'Pago', 'Contrato', 'Confirmación']
    : ['Fecha y hora', 'Extras', 'Resumen', 'Pago', 'Confirmación'];
  const totalSteps = stepLabels.length;

  function goTo(target: number) {
    setStep(Math.max(1, Math.min(target, totalSteps)));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function validateStep1(next: boolean) {
    if (!selectedSlot) {
      toast('Selecciona un horario disponible.', undefined, 'warning');
      return;
    }
    if (next) goTo(2);
  }

  async function handlePay() {
    if (!selectedSlot) return;
    setPaymentState('processing');
    setPaymentError(null);
    try {
      // Step 0: create the reservation (locks the slot transactionally).
      const reservation = await createReservation({
        slot_id: selectedSlot.slot_id,
        extras: extrasSelected.map((extra_id) => ({ extra_id, quantity: 1 })),
        alcohol_requested: alcoholRequested,
      });

      let current: ReservationDetail = reservation;
      if (isSalon) {
        // Contract row is created entering pendiente_firma (BR-012.6).
        current = await transitionReservation(reservation.id, 'pendiente_firma');
      } else {
        // Advance the machine to the payable state.
        current = await transitionReservation(reservation.id, 'disponibilidad_verificada');
        current = await transitionReservation(current.id, 'disponible_para_reserva');
        current = await transitionReservation(current.id, 'pago_anticipo');
        // Tokenize + charge the advance (client-visible total = rent+taxes).
        if (!isValidCardNumber(card.number)) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'El número de tarjeta es inválido.');
        }
        const { tokenId } = await tokenizeCard({
          cardNumber: card.number,
          cardName: card.name,
          expMonth: card.exp.slice(0, 2),
          expYear: card.exp.slice(-2),
          cvc: card.cvc,
        });
        assertUnused(tokenId);
        await createPayment({
          reservation_id: current.id,
          payment_type: 'anticipo',
          amount: prices.total,
          billing_model: 'anticipo',
          description: `Anticipo ${svc.title}`,
        });
        current = await transitionReservation(current.id, 'confirmada');
      }

      setCreatedReservation(current);
      setPaymentState('done');

      // FR-006.8: alcohol permit prompt after payment when requested.
      if (alcoholRequested) {
        setAlcoholModal(true);
        return;
      }
      goTo(isSalon ? 5 : 6);
    } catch (error) {
      setPaymentState('error');
      setPaymentError(
        error instanceof ApiError
          ? error.message
          : 'No se pudo completar la reserva. Intenta de nuevo.',
      );
    }
  }

  function handleAlcoholChoice(resolution: 'continuar_sin_alcohol' | 'cancelar') {
    setAlcoholModal(false);
    if (resolution === 'continuar_sin_alcohol') {
      toast('Reserva continúa sin alcohol.', undefined, 'success');
      goTo(isSalon ? 5 : 6);
    } else {
      void (async () => {
        try {
          if (createdReservation) {
            await transitionReservation(createdReservation.id, 'cancelada', {
              alcohol_resolution: 'cancelar',
            });
          }
        } catch {
          /* best-effort; the real H-5 job handles this path too */
        }
        toast('Reserva cancelada. Aplica la política de cancelación del proveedor.');
        clearBookingDraft();
        navigate('/rentals');
      })();
    }
  }

  function handleConfirm() {
    if (!tcAccepted) {
      toast('Debes aceptar los Términos y Condiciones.', undefined, 'warning');
      return;
    }
    clearBookingDraft();
    toast('¡Reserva confirmada!', undefined, 'success');
    navigate('/rentals');
  }

  return (
    <div>
      {/* Transactional header */}
      <header className="mb-lg flex items-center justify-between">
        <button
          onClick={() => navigate(`/service/${service.id}`)}
          aria-label="Volver"
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
        >
          <Icon name="arrow_back" size={22} />
        </button>
        <span className="font-body-md text-body-md text-on-surface-variant">
          {service.title} · {SERVICE_TYPE_LABELS[service.service_type]}
        </span>
        <span className="w-10" />
      </header>

      {/* Stepper */}
      <Stepper step={step} labels={stepLabels} />

      {step === 1 && (
        <StepCard
          title="Paso 1 · Fecha y horario"
          footer={
            <Button onClick={() => validateStep1(true)}>
              Continuar <Icon name="arrow_forward" size={18} />
            </Button>
          }
        >
          <SlotForm
            serviceId={service.id}
            preselected={draft}
            onSelect={setSelectedSlot}
            selectedSlot={selectedSlot}
          />
          <label className="mt-4 flex items-center gap-3">
            <span className="font-body-md text-body-md text-on-surface">Requiero permiso de alcohol</span>
            <input
              type="checkbox"
              checked={alcoholRequested}
              onChange={(e) => setAlcoholRequested(e.target.checked)}
              className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary"
            />
          </label>
        </StepCard>
      )}

      {step === 2 && (
        <StepCard
          title="Paso 2 · Servicios extra"
          footer={
            <div className="flex justify-between">
              <BackButton onClick={() => goTo(1)} />
              <Button onClick={() => goTo(3)}>
                Continuar <Icon name="arrow_forward" size={18} />
              </Button>
            </div>
          }
        >
          {service.extras.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant">
              Este servicio no ofrece extras adicionales. Continúa al resumen.
            </p>
          ) : (
            <div className="space-y-3">
              {service.extras.map((extra) => {
                const checked = extrasSelected.includes(extra.id);
                return (
                  <label
                    key={extra.id}
                    className="flex cursor-pointer items-start justify-between rounded-lg border border-outline-variant p-4 transition-colors hover:bg-surface-container-low"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setExtrasSelected((prev) =>
                            checked ? prev.filter((id) => id !== extra.id) : [...prev, extra.id],
                          )
                        }
                        className="mt-1 h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary"
                      />
                      <div>
                        <span className="block font-label-md text-label-md font-semibold text-on-surface">
                          {extra.name}
                        </span>
                        <span className="block font-body-md text-body-md text-sm text-on-surface-variant">
                          {extra.description}
                        </span>
                      </div>
                    </div>
                    <span className="font-label-md text-label-md text-on-surface">{money(extra.price)}</span>
                  </label>
                );
              })}
            </div>
          )}
        </StepCard>
      )}

      {step === 3 && (
        <StepCard
          title="Paso 3 · Resumen"
          footer={
            <div className="flex justify-between">
              <BackButton onClick={() => goTo(2)} />
              <Button onClick={() => goTo(4)}>
                Continuar <Icon name="arrow_forward" size={18} />
              </Button>
            </div>
          }
        >
          <Resumen
            base={prices.base}
            extrasTotal={prices.extras}
            taxes={prices.taxes}
            total={prices.total}
            slot={selectedSlot}
            policy={service.cancellation_policy}
          />
        </StepCard>
      )}

      {step === 4 && (
        <StepCard
          title="Paso 4 · Método de pago"
          footer={
            <div className="flex justify-between">
              <BackButton onClick={() => goTo(3)} />
              <Button onClick={handlePay} loading={paymentState === 'processing'} disabled={paymentState === 'processing'}>
                {isSalon ? 'Registrar reserva' : 'Pagar anticipo'}
              </Button>
            </div>
          }
        >
          {isSalon ? (
            <div className="mb-md rounded-lg bg-surface-container-low p-4">
              <p className="font-body-md text-body-md text-sm text-on-surface-variant">
                Este salón requiere firma del contrato físico. El anticipo quedará disponible una vez que el
                proveedor confirme el contrato (confirmación bilateral, BR-012.6).
              </p>
            </div>
          ) : (
            <CardPaymentForm card={card} onChange={setCard} total={prices.total} />
          )}
          {paymentError ? (
            <p className="mt-2 font-label-sm text-label-sm text-error font-semibold" data-state="invalid">
              {paymentError}
            </p>
          ) : null}
        </StepCard>
      )}

      {step === 5 && isSalon && (
        <StepCard
          title="Paso 5 · Contrato"
          footer={
            <div className="flex justify-between">
              <BackButton onClick={() => goTo(4)} />
              <Button
                onClick={() => {
                  if (!contractAck) {
                    toast('Debes confirmar el contrato físico.', undefined, 'warning');
                    return;
                  }
                  goTo(6);
                }}
              >
                Continuar <Icon name="arrow_forward" size={18} />
              </Button>
            </div>
          }
        >
          <div className="mb-md flex items-start gap-3 rounded-lg bg-surface-container-low p-4">
            <Icon name="description" className="mt-0.5 text-primary" size={22} />
            <div>
              <p className="font-label-md text-label-md font-semibold text-primary">Contrato físico requerido</p>
              <p className="mt-1 font-body-md text-body-md text-sm text-on-surface-variant">
                Este salón requiere firma de contrato físico presencial en las instalaciones del proveedor antes
                del evento.
              </p>
            </div>
          </div>
          <Checkbox
            id="booking-contract"
            checked={contractAck}
            onCheckedChange={setContractAck}
            label="Acepto firmar el contrato físico en las instalaciones del proveedor."
          />
        </StepCard>
      )}

      {step === 6 && (
        <StepCard
          title="Confirmación"
          footer={
            <div className="flex justify-between">
              {isSalon ? <BackButton onClick={() => goTo(5)} /> : <BackButton onClick={() => goTo(4)} />}
              <Button onClick={handleConfirm}>Confirmar reserva</Button>
            </div>
          }
        >
          <div className="py-xl text-center">
            <Icon name="check_circle" filled size={56} className="text-primary" />
            <h2 className="mt-md mb-sm font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              ¡Listo! Tu reserva está registrada
            </h2>
            <p className="mx-auto max-w-md font-body-md text-body-md text-on-surface-variant">
              {isSalon
                ? 'El proveedor confirmará el contrato y el anticipo quedará habilitado.'
                : 'El proveedor recibirá una notificación de tu reserva confirmada.'}
            </p>
          </div>
          <div className="space-y-2 rounded-lg bg-surface-container-low p-md font-body-md text-body-md">
            <ConfirmRow label="Servicio" value={service.title} />
            <ConfirmRow label="Fecha" value={selectedSlot ? formatDate(selectedSlot.slot_date) : '—'} />
            <ConfirmRow label="Horario" value={selectedSlot ? `${selectedSlot.start_time} – ${selectedSlot.end_time}` : '—'} />
            <ConfirmRow label="Total" value={money(prices.total)} />
            <ConfirmRow label="Estado" value="Registrada" highlight />
          </div>
          <div className="mt-md">
            <Checkbox
              id="booking-tc"
              checked={tcAccepted}
              onCheckedChange={setTcAccepted}
              label={
                <span>
                  Acepto los{' '}
                  <button type="button" onClick={() => setTermsOpen(true)} className="font-semibold text-primary hover:underline">
                    Términos y Condiciones
                  </button>{' '}
                  de la plataforma.
                </span>
              }
            />
          </div>
        </StepCard>
      )}

      {/* Alcohol prompt (H-5) */}
      <Dialog open={alcoholModal} onOpenChange={setAlcoholModal}>
        <DialogContent title="Atención: Permiso de alcohol no confirmado">
          <div className="mb-4 flex items-start gap-3 rounded-lg bg-surface-container-low p-md">
            <Icon name="info" className="mt-0.5 text-outline" size={20} />
            <p className="font-body-md text-body-md text-sm text-on-surface-variant">
              Según la normativa de SLRC, Sonora, para servir alcohol se requiere el permiso municipal. El permiso
              aún no ha sido reportado como aprobado.
            </p>
          </div>
          <div className="flex flex-col gap-md">
            <Button onClick={() => handleAlcoholChoice('continuar_sin_alcohol')} size="lg">
              <span className="flex flex-col items-start">
                <span>Continuar sin alcohol</span>
                <span className="text-sm opacity-90">La reserva se mantiene, el evento será sin alcohol</span>
              </span>
              <Icon name="arrow_forward" size={20} />
            </Button>
            <Button variant="danger" size="lg" onClick={() => handleAlcoholChoice('cancelar')}>
              <span className="flex flex-col items-start">
                <span>Cancelar reserva</span>
                <span className="text-sm opacity-90">Aplica la política de cancelación del proveedor</span>
              </span>
              <Icon name="cancel" size={20} />
            </Button>
          </div>
          <p className="mt-md flex items-center gap-2 font-label-sm text-label-sm text-on-surface-variant">
            <Icon name="gavel" size={16} /> La plataforma no se hace responsable por multas municipales.
          </p>
        </DialogContent>
      </Dialog>

      {/* T&C */}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent title="Términos y Condiciones">
          <div className="space-y-2 font-body-md text-body-md text-on-surface-variant">
            <p>FiestaExpert actúa como plataforma de intermediación entre clientes y proveedores.</p>
            <p>1. La plataforma no media en disputas comerciales entre las partes.</p>
            <p>2. Las cancelaciones se rigen por la política de cada proveedor.</p>
            <p>3. Los pagos se procesan mediante Conekta; FiestaExpert no almacena datos de tarjetas.</p>
            <p>4. La venta de alcohol está sujeta a permisos municipales según la normativa local.</p>
          </div>
          <Button className="mt-md w-full" onClick={() => setTermsOpen(false)}>
            Entendido
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function basePriceOf(service: NonNullable<ReturnType<typeof useServiceDetail>['data']>): string {
  return (
    service.pricing.salon?.base_block_price ??
    service.pricing.sound_packages[0]?.base_price ??
    service.pricing.persona?.price_per_person_per_hour ??
    '0'
  );
}

function assertUnused(_value: string): void {
  /* token is generated and immediately consumed server-side; nothing to do */
}

function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div className="mb-lg flex items-center gap-1 overflow-x-auto no-scrollbar pb-2">
      {labels.map((label, index) => {
        const n = index + 1;
        const state = n < step ? 'done' : n === step ? 'current' : 'todo';
        return (
          <div key={label} className="flex shrink-0 items-center gap-1">
            <span
              className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-full font-label-md',
                state === 'done' && 'bg-primary text-on-primary',
                state === 'current' && 'bg-primary-container text-white ring-2 ring-primary',
                state === 'todo' && 'bg-surface-container-high text-on-surface-variant',
              )}
            >
              <Icon name={state === 'done' ? 'check' : state === 'current' ? 'radio_button_checked' : 'radio_button_unchecked'} size={16} filled={state === 'current'} />
            </span>
            <span className={clsx('whitespace-nowrap font-label-sm', state === 'current' ? 'font-semibold text-primary' : 'text-on-surface-variant')}>
              {label}
            </span>
            {n < labels.length ? (
              <Icon name="chevron_right" size={16} className="mx-1 text-on-surface-variant/40" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StepCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm">
      <h2 className="mb-sm font-headline-md text-headline-md text-on-surface">{title}</h2>
      {children}
      <div className="mt-lg">{footer}</div>
    </section>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick}>
      <Icon name="arrow_back" size={18} /> Volver
    </Button>
  );
}

function SlotForm({
  serviceId,
  preselected,
  selectedSlot,
  onSelect,
}: {
  serviceId: number;
  preselected: { slot_id: number; slot_date: string; start_time: string; end_time: string } | null;
  selectedSlot: SlotAvailabilityRow | null;
  onSelect: (slot: SlotAvailabilityRow | null) => void;
}) {
  const [date, setDate] = useState(preselected?.slot_date ?? '');
  const { data: slots = [], isLoading: loading } = useServiceSlots(serviceId, date || undefined);

  const grouped = useMemo(() => {
    const map = new Map<string, SlotAvailabilityRow[]>();
    for (const slot of slots) {
      const list = map.get(slot.slot_date) ?? [];
      list.push(slot);
      map.set(slot.slot_date, list);
    }
    return map;
  }, [slots]);

  const option = (slot: SlotAvailabilityRow) => (
    <button
      key={slot.slot_id}
      type="button"
      disabled={slot.status_indicator === 'lleno'}
      onClick={() => onSelect(slot)}
      className={clsx(
        'rounded-lg px-3 py-2 text-center font-label-md transition-colors',
        selectedSlot?.slot_id === slot.slot_id
          ? 'border-2 border-primary bg-primary/5 font-semibold text-primary'
          : 'border border-outline-variant text-on-surface hover:bg-surface-container-low',
        slot.status_indicator === 'lleno' && 'cursor-not-allowed border border-outline-variant bg-surface-container-high text-on-surface-variant opacity-50',
      )}
    >
      {slot.start_time} – {slot.end_time}
    </button>
  );

  return (
    <div>
      <label className="mb-2 block font-label-md text-label-md text-on-surface">Fecha del evento</label>
      <select
        aria-label="Fecha del evento"
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          onSelect(null);
        }}
        className="mb-4 w-full rounded-lg border border-outline-variant bg-surface-container p-3 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
      >
        <option value="">Selecciona la fecha</option>
        {Array.from(grouped.keys()).map((d) => (
          <option key={d} value={d}>
            {formatDate(d)}
          </option>
        ))}
      </select>
      {loading ? (
        <Spinner className="mx-auto" />
      ) : date ? (
        <div className="grid grid-cols-2 gap-2">
          {(grouped.get(date) ?? []).map(option)}
        </div>
      ) : (
        <p className="font-body-md text-body-md text-sm text-on-surface-variant">
          Elige una fecha para ver los horarios disponibles.
        </p>
      )}
    </div>
  );
}

function Resumen({
  base,
  extrasTotal,
  taxes,
  total,
  slot,
  policy,
}: {
  base: number;
  extrasTotal: number;
  taxes: number;
  total: number;
  slot: SlotAvailabilityRow | null;
  policy: { retention_percent: number; penalty_free_window_days: number; deposit_refundable: boolean };
}) {
  return (
    <>
      <div className="space-y-3 font-body-md text-body-md">
        <ResumenRow label="Renta" value={money(base)} />
        {extrasTotal > 0 ? <ResumenRow label="Extras" value={money(extrasTotal)} /> : null}
        <ResumenRow label="IVA (16%)" value={money(taxes)} />
        <div className="flex justify-between border-t border-outline-variant pt-md font-semibold">
          <span className="text-on-surface">Total</span>
          <span className="text-primary">{money(total)}</span>
        </div>
      </div>
      <div className="mt-md flex items-start gap-3 rounded-lg bg-surface-container-low p-md">
        <Icon name="policy" className="mt-0.5 text-primary" size={22} />
        <div>
          <p className="font-label-md text-label-md font-semibold text-primary">Política de cancelación del proveedor</p>
          <p className="mt-1 font-body-md text-body-md text-sm text-on-surface-variant">
            {policy.deposit_refundable ? 'Depósito reembolsable. ' : 'Depósito no reembolsable. '}Cancelación sin
            penalización hasta {policy.penalty_free_window_days} días antes del evento; después retención del{' '}
            {policy.retention_percent}% del total.
          </p>
        </div>
      </div>
      {slot ? (
        <p className="mt-md font-label-sm text-label-sm text-on-surface-variant">
          Evento: {formatDate(slot.slot_date)} · {slot.start_time} – {slot.end_time}
        </p>
      ) : null}
    </>
  );
}

function ResumenRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-on-surface">{value}</span>
    </div>
  );
}

function ConfirmRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-on-surface-variant">{label}</span>
      <span className={clsx(highlight ? 'font-semibold text-primary' : 'text-on-surface')}>{value}</span>
    </div>
  );
}

function CardPaymentForm({
  card,
  onChange,
  total,
}: {
  card: { name: string; number: string; exp: string; cvc: string };
  onChange: (card: { name: string; number: string; exp: string; cvc: string }) => void;
  total: number;
}) {
  return (
    <div className="space-y-4">
      <Input label="Nombre en la tarjeta" placeholder="Juan Pérez" value={card.name} onChange={(e) => onChange({ ...card, name: e.target.value })} />
      <Input
        label="Número de tarjeta"
        placeholder="0000 0000 0000 0000"
        inputMode="numeric"
        value={card.number}
        onChange={(e) => onChange({ ...card, number: e.target.value })}
        leading={<Icon name="credit_card" size={20} />}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Fecha de exp." placeholder="MM/YY" value={card.exp} onChange={(e) => onChange({ ...card, exp: e.target.value })} />
        <Input label="CVC" placeholder="123" inputMode="numeric" value={card.cvc} onChange={(e) => onChange({ ...card, cvc: e.target.value })} />
      </div>
      <div className="flex items-center justify-center gap-2 text-on-surface-variant opacity-70">
        <Icon name="lock" size={14} />
        <span className="font-label-sm text-label-sm">
          Pagos seguros procesados por Conekta · Total a pagar: {money(total)}
        </span>
      </div>
    </div>
  );
}
