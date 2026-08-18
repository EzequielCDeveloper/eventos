import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBlock,
  createDynamicRule,
  deleteBlock,
  deleteDynamicRule,
  fetchBlocks,
  fetchDynamicRules,
  fetchService,
  fetchSlots,
  providerKeys,
} from './providerApi';
import { useProviderServicesStore } from './providerServices';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Card, CardContent } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { StateView, SkeletonCard } from '@/components/common/StateView';
import { useToast } from '@/components/ui/Toast';
import { money } from '@/lib/formatters';
import { SERVICE_TYPE_LABELS } from '@/lib/constants';
import type { DynamicPriceRule, SlotAvailabilityRow, ServiceDetail, AvailabilityBlock } from '@/types/api';
import { clsx } from 'clsx';

/**
 * Calendario (FR-011.6, FR-011.9) — monthly view, slot inventory, date
 * blocking and dynamic pricing configuration. Mirrors the mockup calendar
 * screen; wiring hits real inventory/pricing routes for the provider's
 * selected service.
 */

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function fmtYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthRange(cursor: Date): { from: string; to: string } {
  return {
    from: fmtYMD(new Date(cursor.getFullYear(), cursor.getMonth(), 1)),
    to: fmtYMD(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)),
  };
}
function dayKey(datetimeISO: string): string {
  return datetimeISO.slice(0, 10);
}
function toISODateOffset(day: string): { start: string; end: string } {
  const start = new Date(`${day}T00:00:00-06:00`);
  const end = new Date(+start + 24 * 3600 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

const RULE_TYPE_LABELS: Record<DynamicPriceRule['adjustment_type'], string> = {
  temporada: 'Temporada',
  demanda: 'Demanda',
  dia_semana: 'Día de semana',
  bloque_turno: 'Bloque / turno',
};

const BLOCK_TYPE_LABELS: Record<AvailabilityBlock['type'], string> = {
  mantenimiento: 'Mantenimiento',
  inoperacion: 'Bloqueo temporal',
  evento_privado: 'Evento privado',
};

function basePriceOf(service?: ServiceDetail): number {
  if (!service) return 0;
  if (service.service_type === 'salon') return Number(service.pricing.salon?.base_block_price ?? 0);
  const pk = service.pricing.sound_packages[0];
  if (service.service_type === 'sonido') return Number(pk?.base_price ?? 0);
  return Number(service.pricing.persona?.price_per_person_per_hour ?? 0);
}

export default function CalendarTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const knownIds = useProviderServicesStore((s) => s.ids);

  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(fmtYMD(new Date()));
  const [serviceId, setServiceId] = useState<number | null>(knownIds[0] ?? null);
  const [blockMenu, setBlockMenu] = useState(false);
  const [blockType, setBlockType] = useState<AvailabilityBlock['type']>('inoperacion');
  const [ruleMenu, setRuleMenu] = useState(false);
  const [ruleType, setRuleType] = useState<DynamicPriceRule['adjustment_type']>('dia_semana');
  const [rulePct, setRulePct] = useState('10');

  // Service details of the provider's known services (single grouped query).
  const servicesQ = useQuery({
    queryKey: ['provider', 'services', knownIds.join(',')],
    queryFn: () => Promise.all(knownIds.map((id) => fetchService(id))),
    enabled: knownIds.length > 0,
  });
  const services = servicesQ.data ?? [];

  const active: ServiceDetail | undefined = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  // Auto-select the first service once known services load (e.g. right after
  // the onboarding wizard publishes the first listing).
  useEffect(() => {
    if (serviceId === null && services.length > 0) setServiceId(services[0].id);
  }, [serviceId, services]);

  const range = monthRange(cursor);

  const slotsQ = useQuery({
    queryKey: providerKeys.slots(serviceId ?? 0, range.from, range.to),
    queryFn: () => fetchSlots(serviceId!, range),
    enabled: Boolean(serviceId),
  });
  const blocksQ = useQuery({
    queryKey: providerKeys.blocks(serviceId ?? 0),
    queryFn: () => fetchBlocks(serviceId!),
    enabled: Boolean(serviceId),
  });
  const rulesQ = useQuery({
    queryKey: providerKeys.rules(serviceId ?? 0),
    queryFn: () => fetchDynamicRules(serviceId!),
    enabled: Boolean(serviceId),
  });

  const slots = slotsQ.data ?? [];
  const blocks = blocksQ.data ?? [];
  const rules = rulesQ.data ?? [];

  const slotDays = useMemo(() => new Map<string, SlotAvailabilityRow[]>(), []);
  for (const s of slots) {
    const list = slotDays.get(s.slot_date) ?? [];
    list.push(s);
    slotDays.set(s.slot_date, list);
  }
  const filledDays = useMemo(() => {
    const set = new Set<string>();
    for (const [day, rows] of slotDays.entries()) {
      if (rows.every((r) => r.status_indicator === 'lleno')) set.add(day);
    }
    return set;
  }, [slotDays]);
  const blockedDays = useMemo(() => {
    const set = new Set<string>();
    for (const b of blocks) {
      const start = dayKey(b.start_datetime);
      const end = dayKey(b.end_datetime);
      let cur = new Date(`${start}T00:00:00`);
      const last = new Date(`${end}T00:00:00`);
      while (cur <= last) {
        set.add(fmtYMD(cur));
        cur = new Date(+cur + 86400000);
      }
    }
    return set;
  }, [blocks]);

  const basePrice = basePriceOf(active);
  const totalPct = rules.reduce((acc, r) => acc + Number(r.adjustment_value), 0);
  const vigente = Math.round(basePrice * (1 + totalPct / 100));

  // ---- Mutations ------------------------------------------------------------

  const createBlockMut = useMutation({
    mutationFn: () => {
      const d = toISODateOffset(selectedDay ?? fmtYMD(new Date()));
      return createBlock(serviceId!, { start_datetime: d.start, end_datetime: d.end, type: blockType });
    },
    onSuccess: () => {
      toast('Fecha bloqueada.', 'El día ya no acepta reservas.');
      setBlockMenu(false);
      void queryClient.invalidateQueries({ queryKey: providerKeys.blocks(serviceId!) });
    },
    onError: (e) => toast('No se pudo bloquear la fecha.', String(e), 'error'),
  });

  const deleteBlockMut = useMutation({
    mutationFn: (id: number) => deleteBlock(serviceId!, id),
    onSuccess: () => {
      toast('Bloqueo eliminado.');
      void queryClient.invalidateQueries({ queryKey: providerKeys.blocks(serviceId!) });
    },
  });

  const createRuleMut = useMutation({
    mutationFn: () =>
      createDynamicRule(serviceId!, {
        adjustment_type: ruleType,
        adjustment_value: Number(rulePct),
        scope: {},
      }),
    onSuccess: () => {
      toast('Regla creada.');
      setRuleMenu(false);
      setRulePct('10');
      void queryClient.invalidateQueries({ queryKey: providerKeys.rules(serviceId!) });
    },
    onError: (e) => toast('No se pudo crear la regla.', String(e), 'error'),
  });

  const deleteRuleMut = useMutation({
    mutationFn: (id: number) => deleteDynamicRule(serviceId!, id),
    onSuccess: () => {
      toast('Regla eliminada.');
      void queryClient.invalidateQueries({ queryKey: providerKeys.rules(serviceId!) });
    },
  });

  // ---- Calendar grid ---------------------------------------------------------

  const firstDow = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7;
  const dim = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const today = fmtYMD(new Date());
  const isCurrentMonth =
    new Date().getFullYear() === cursor.getFullYear() && new Date().getMonth() === cursor.getMonth();

  const cells: Array<{ d: number; day: string; blocked: boolean; filled: boolean; available: boolean; isToday: boolean; selected: boolean }> = [];
  for (let d = 1; d <= dim; d += 1) {
    const day = `${fmtYMD(new Date(cursor.getFullYear(), cursor.getMonth(), d))}`;
    cells.push({
      d,
      day,
      blocked: blockedDays.has(day),
      filled: filledDays.has(day),
      available: slotDays.has(day) && !blockedDays.has(day),
      isToday: isCurrentMonth && day === today,
      selected: selectedDay === day,
    });
  }

  const selectedSlots = selectedDay ? (slotDays.get(selectedDay) ?? []) : [];
  const dayBlocks = selectedDay ? blocks.filter((b) => dayKey(b.start_datetime) <= selectedDay && selectedDay <= dayKey(b.end_datetime)) : [];

  const dayBusy =
    slotsQ.isLoading || blocksQ.isLoading || services.length === 0;

  return (
    <div className="flex flex-col gap-xxl">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Calendario
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">
            Tus reservas y eventos del mes.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/provider/onboarding">
            <Icon name="add" size={18} /> Nuevo anuncio
          </Link>
        </Button>
      </section>

      {services.length === 0 ? (
        <StateView
          state="empty"
          icon="calendar_month"
          title="Aún no tienes anuncios"
          copy="Publica tu primer servicio para gestionar inventario, bloqueos y precios dinámicos."
          action={
            <Button asChild>
              <Link to="/provider/onboarding">Crear mi primer anuncio</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-lg">
            {/* Service selector */}
            <div className="max-w-xs">
              <Select
                value={serviceId?.toString() ?? ''}
                onValueChange={(v) => setServiceId(Number(v))}
                options={services.map((s) => ({
                  value: String(s.id),
                  label: `${s.title} · ${SERVICE_TYPE_LABELS[s.service_type]}`,
                }))}
                placeholder="Selecciona un servicio"
              />
            </div>

            {/* Month grid */}
            <Card>
              <CardContent>
                <div className="mb-lg flex items-center justify-between">
                  <button
                    type="button"
                    aria-label="Mes anterior"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low"
                    onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                  >
                    <Icon name="chevron_left" />
                  </button>
                  <h3 className="font-headline-md text-headline-md text-on-surface">
                    {MESES[cursor.getMonth()]} {cursor.getFullYear()}
                  </h3>
                  <button
                    type="button"
                    aria-label="Mes siguiente"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low"
                    onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                  >
                    <Icon name="chevron_right" />
                  </button>
                </div>
                <div className="mb-sm grid grid-cols-7 gap-xs text-center font-label-sm text-label-sm text-on-surface-variant">
                  {WEEKDAYS.map((w) => (
                    <div key={w} className="py-sm">{w}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-xs">
                  {Array.from({ length: firstDow }, (_, i) => (
                    <div key={`pad-${i}`} className="min-h-[72px] md:min-h-[92px]" />
                  ))}
                  {cells.map((c) => (
                    <button
                      key={c.day}
                      type="button"
                      onClick={() => setSelectedDay(c.day)}
                      className={clsx(
                        'flex min-h-[72px] flex-col gap-1 overflow-hidden rounded-lg border p-1.5 text-left md:min-h-[92px]',
                        c.selected
                          ? 'border-primary ring-2 ring-primary'
                          : c.blocked
                            ? 'border-error bg-error-container/40'
                            : c.isToday
                              ? 'border-primary bg-primary-fixed/10 ring-2 ring-primary'
                              : 'border-surface-container-high bg-surface-container-lowest',
                      )}
                    >
                      <span
                        className={clsx(
                          'font-label-sm text-label-sm',
                          c.isToday ? 'font-bold text-primary' : c.blocked ? 'font-bold text-error' : 'text-on-surface',
                        )}
                      >
                        {c.d}
                      </span>
                      {c.blocked ? (
                        <span className="truncate rounded-md bg-error-container px-1.5 py-0.5 font-label-sm text-[10px] leading-tight text-on-error-container">
                          Bloqueado
                        </span>
                      ) : null}
                      {c.filled && !c.blocked ? (
                        <span className="truncate rounded-md bg-tertiary-fixed-dim px-1.5 py-0.5 font-label-sm text-[10px] leading-tight text-on-tertiary-fixed">
                          Lleno
                        </span>
                      ) : null}
                      {c.available && !c.filled && !c.blocked ? (
                        <span className="truncate rounded-md bg-primary-fixed px-1.5 py-0.5 font-label-sm text-[10px] leading-tight text-on-primary-fixed-variant">
                          Disponible
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
                <div className="mt-lg flex flex-wrap items-center gap-x-md gap-y-xs font-label-sm text-label-sm text-on-surface-variant">
                  <span className="inline-block h-3 w-3 rounded bg-secondary-container" /> Reservas
                  <span className="inline-block h-3 w-3 rounded bg-error-container" /> Bloqueado
                  <span className="inline-block h-3 w-3 rounded bg-primary-fixed" /> Disponible
                  <span className="inline-block h-3 w-3 rounded bg-tertiary-fixed-dim" /> Parcial / Lleno
                </div>
              </CardContent>
            </Card>

            {/* Inventario por slot del día */}
            <Card>
              <CardContent>
                <div className="mb-md flex flex-col justify-between gap-md md:flex-row md:items-center">
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface">Inventario por slot</h3>
                    <p className="mt-xs font-body-md text-body-md text-sm text-on-surface-variant">
                      {active?.title} · {selectedDay ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Selecciona un día en el calendario.'}
                    </p>
                  </div>
                  <Button variant="outline" className="text-error border-error" onClick={() => setBlockMenu(true)} disabled={!selectedDay}>
                    <Icon name="block" size={16} /> Bloquear fecha
                  </Button>
                </div>
                {dayBusy ? (
                  <div className="grid grid-cols-1 gap-md md:grid-cols-3">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </div>
                ) : selectedSlots.length === 0 && dayBlocks.length === 0 ? (
                  <p className="py-lg font-body-md text-body-md text-on-surface-variant">
                    {blockedDays.has(selectedDay ?? '')
                      ? 'Este día está bloqueado.'
                      : 'No hay slots configurados para este día.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-md md:grid-cols-3">
                    {dayBlocks.map((b) => (
                      <div key={`blk-${b.id}`} className="rounded-xl border border-error/40 bg-error-container/30 p-md">
                        <div className="mb-xs flex items-center justify-between">
                          <span className="font-label-md text-label-md text-on-surface font-semibold">Bloqueado</span>
                          <span className="rounded-full bg-error-container px-2 py-0.5 font-label-sm text-[10px] text-on-error-container">
                            {BLOCK_TYPE_LABELS[b.type]}
                          </span>
                        </div>
                        <p className="font-body-md text-body-md text-sm text-on-surface-variant">
                          {new Date(b.start_datetime).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} — {new Date(b.end_datetime).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <div className="mt-sm flex justify-end">
                          <button
                            type="button"
                            onClick={() => deleteBlockMut.mutate(b.id)}
                            className="rounded-md px-2 py-1 font-label-sm text-label-sm text-error hover:bg-error-container"
                          >
                            Desbloquear
                          </button>
                        </div>
                      </div>
                    ))}
                    {selectedSlots.map((s) => {
                      const full = s.status_indicator === 'lleno';
                      const parcial = s.status_indicator === 'parcial';
                      const badge = full
                        ? 'bg-tertiary-fixed-dim text-on-tertiary-fixed'
                        : parcial
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'bg-primary-fixed text-on-primary-fixed';
                      const label = full ? 'Lleno' : parcial ? 'Parcial' : 'Disponible';
                      return (
                        <div key={s.slot_id} className="rounded-xl border border-outline-variant p-md">
                          <div className="mb-xs flex items-center justify-between">
                            <span className="font-label-md text-label-md text-on-surface font-semibold">
                              {s.start_time.slice(0, 5)} — {s.end_time.slice(0, 5)}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 font-label-sm text-[10px] ${badge}`}>{label}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-body-md text-body-md text-sm text-on-surface-variant">
                              {active?.service_type === 'salon' ? 'Salón: 1 evento' : `Capacidad: ${s.capacity}`}
                            </span>
                            <span className="font-body-md text-body-md text-sm text-on-surface-variant">
                              {s.active_reservations}/{s.capacity} ocupados
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Precios dinámicos */}
            <Card>
              <CardContent>
                <div className="mb-md flex flex-col justify-between gap-md md:flex-row md:items-center">
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface">Precios dinámicos</h3>
                    <p className="mt-xs font-body-md text-body-md text-sm text-on-surface-variant">
                      Ajustes por temporada, día de la semana o demanda. Sin reglas = tasa fija.
                    </p>
                  </div>
                  <Button onClick={() => setRuleMenu(true)}>
                    <Icon name="add" size={16} /> Nueva regla
                  </Button>
                </div>
                <div className="flex flex-col gap-sm">
                  {rules.length === 0 ? (
                    <div className="flex items-center gap-sm rounded-lg bg-surface-container-low px-md py-sm">
                      <Icon name="sell" size={18} className="text-on-surface-variant" />
                      <span className="font-body-md text-body-md text-on-surface-variant">
                        Tasa fija: sin ajustes dinámicos configurados.
                      </span>
                    </div>
                  ) : (
                    rules.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg bg-surface-container-low px-md py-sm">
                        <div>
                          <p className="font-body-md text-body-md text-on-surface font-semibold">
                            {RULE_TYPE_LABELS[r.adjustment_type]}
                          </p>
                          <p className="font-label-sm text-label-sm text-on-surface-variant">
                            {typeof r.scope === 'object' && r.scope && 'note' in r.scope
                              ? String((r.scope as { note?: string }).note ?? '—')
                              : 'Aplica a todos los slots'}
                          </p>
                        </div>
                        <div className="flex items-center gap-md">
                          <span className="font-label-md text-label-md font-bold text-primary">
                            +{Number(r.adjustment_value)}%
                          </span>
                          <button
                            type="button"
                            aria-label="Eliminar regla"
                            onClick={() => deleteRuleMut.mutate(r.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-error"
                          >
                            <Icon name="delete" size={18} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <p className="mt-md font-label-md text-label-md text-on-surface-variant">
                  Precio base {money(basePrice)} → vigente {money(vigente)} (ajuste +{totalPct}%).
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Dialog: bloquear fecha */}
      <Dialog open={blockMenu} onOpenChange={setBlockMenu}>
        <DialogContent
          title={selectedDay ? `Bloquear ${new Date(`${selectedDay}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Bloquear fecha'}
        >
          <div className="flex flex-col gap-md">
            <p className="font-body-md text-body-md text-on-surface-variant">
              El día dejará de aceptar reservas para <strong>{active?.title}</strong>.
            </p>
            <Select
              value={blockType}
              onValueChange={(v) => setBlockType(v as AvailabilityBlock['type'])}
              options={[
                { value: 'mantenimiento', label: 'Mantenimiento' },
                { value: 'inoperacion', label: 'Bloqueo temporal' },
                { value: 'evento_privado', label: 'Evento privado' },
              ]}
            />
            <div className="mt-md flex justify-end gap-sm">
              <Button variant="outline" onClick={() => setBlockMenu(false)}>Cancelar</Button>
              <Button variant="danger" onClick={() => createBlockMut.mutate()} loading={createBlockMut.isPending}>
                <Icon name="block" size={16} /> Bloquear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: nueva regla de precio */}
      <Dialog open={ruleMenu} onOpenChange={setRuleMenu}>
        <DialogContent title="Nueva regla de precio">
          <div className="flex flex-col gap-md">
            <Select
              value={ruleType}
              onValueChange={(v) => setRuleType(v as DynamicPriceRule['adjustment_type'])}
              options={Object.entries(RULE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Input
              label="Ajuste (%)"
              type="number"
              min="0"
              step="1"
              value={rulePct}
              onChange={(e) => setRulePct(e.target.value)}
              hint="Se suma al precio base (solo incrementos positivos por ahora)."
            />
            <div className="flex justify-between font-label-md text-label-md text-on-surface-variant">
              <span>Nuevo precio</span>
              <span className="text-primary font-semibold">
                {money(Math.round(basePrice * (1 + (totalPct + Number(rulePct || 0)) / 100)))}
              </span>
            </div>
            <div className="mt-md flex justify-end gap-sm">
              <Button variant="outline" onClick={() => setRuleMenu(false)}>Cancelar</Button>
              <Button onClick={() => createRuleMut.mutate()} loading={createRuleMut.isPending}>
                <Icon name="add" size={16} /> Crear regla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
