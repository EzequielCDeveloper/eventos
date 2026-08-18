import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useNotifications } from '@/features/notifications/hooks';
import { fetchMonthlyReport, fetchProviderReservations, providerKeys } from './providerApi';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard, StateView } from '@/components/common/StateView';
import { money, formatDateShort, formatTime, timeAgo } from '@/lib/formatters';
import { RESERVATION_STATUS_LABELS } from '@/lib/constants';
import { CRITICAL_NOTIFICATION_TYPES } from '@/lib/constants';
import type { ReservationDetail } from '@/types/api';
import type { NotificationType } from '@/types/models';

/**
 * Provider dashboard — Hoy tab (FR-011.5): urgent alerts, weekly summary,
 * reminders and quick actions. Mirrors the mockup bento grid; every number
 * comes from real endpoints (GET /reservations — actor-scoped for the
 * provider — plus GET /notifications and GET /payments/reports/monthly).
 */

const ATTENTION_STATUSES = [
  'creado',
  'disponibilidad_verificada',
  'pendiente_firma',
  'contrato_confirmado',
  'permiso_alcohol',
  'pago_anticipo',
] as const;

const QUICK_ACTIONS = [
  { to: '/provider/messages', label: 'Ver Mensajes', icon: 'chat', cls: 'bg-primary-fixed text-on-primary-fixed' },
  { to: '/provider/stats', label: 'Pagos', icon: 'payments', cls: 'bg-secondary-fixed text-on-secondary-fixed' },
  { to: '/provider/listings', label: 'Mis anuncios', icon: 'storefront', cls: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  { to: '/provider/onboarding', label: 'Nuevo anuncio', icon: 'add_circle', cls: 'bg-surface-variant text-on-surface-variant' },
] as const;

function todayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday-first
  d.setDate(d.getDate() - day);
  return d;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ProviderDashboard() {
  const user = useAuthStore((s) => s.user);
  const tokens = useAuthStore((s) => s.accessToken);

  const reservationsQuery = useQuery({
    queryKey: providerKeys.reservations(),
    queryFn: () => fetchProviderReservations(),
    enabled: Boolean(tokens),
  });
  const notificationsQuery = useNotifications();

  const now = todayLocal();
  const nowISO = iso(now);
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekISO = iso(weekStart);

  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const reportQuery = useQuery({
    queryKey: providerKeys.report(year, month),
    queryFn: () => fetchMonthlyReport(year, month),
    enabled: Boolean(tokens),
  });

  const reservations = useMemo(() => reservationsQuery.data ?? [], [reservationsQuery.data]);
  const notifications = useMemo(() => notificationsQuery.data ?? [], [notificationsQuery.data]);

  const pending = useMemo(
    () =>
      reservations
        .filter((r) => (ATTENTION_STATUSES as readonly string[]).includes(r.status))
        .sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [reservations],
  );

  const upcoming = useMemo(
    () =>
      reservations
        .filter((r) => r.status === 'confirmada' && r.event_date >= nowISO)
        .filter((r) => r.event_date >= nowISO && r.event_date <= iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)))
        .sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [reservations, nowISO, now],
  );

  const weekIncome = useMemo(() => {
    const earned = ['confirmada', 'en_curso', 'completada'];
    return reservations
      .filter((r) => earned.includes(r.status) && r.event_date >= weekISO)
      .reduce((sum, r) => sum + Number(r.total_price), 0);
  }, [reservations, weekISO]);

  const urgentNotifs = useMemo(
    () =>
      notifications.filter(
        (n) => n.is_critical || (CRITICAL_NOTIFICATION_TYPES as NotificationType[]).includes(n.type),
      ),
    [notifications],
  );

  const loading =
    reservationsQuery.isLoading ||
    (reportQuery.isLoading && reportQuery.isFetching) ||
    notificationsQuery.isLoading;

  const report = reportQuery.data;

  const isLoadingState = loading && reservations.length === 0;

  const renderRow = (r: ReservationDetail) => (
    <div key={r.id} className="flex items-center gap-md rounded-lg bg-surface-container-low px-md py-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
        <Icon name="event" size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-body-md text-body-md text-on-surface font-semibold">
          {r.items[0]?.service_title ?? `Reserva #${r.id}`}
        </p>
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          {formatDateShort(r.event_date)} · {formatTime(r.start_time)}
        </p>
      </div>
      <Badge variant="outline">{RESERVATION_STATUS_LABELS[r.status]}</Badge>
    </div>
  );

  return (
    <div className="flex flex-col gap-xxl">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Hola, {user?.full_name?.split(' ')[0] ?? 'proveedor'}.
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">
            Tienes <strong className="text-primary">{pending.length} reservas pendientes</strong> para
            revisar.
          </p>
        </div>
        <Button asChild>
          <Link to="/provider/onboarding">
            <Icon name="add" size={18} /> Nuevo Anuncio
          </Link>
        </Button>
      </section>

      {isLoadingState ? (
        <div className="grid grid-cols-1 gap-lg">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}

      {!isLoadingState && reservationsQuery.isError ? (
        <StateView
          state="error"
          title="No pudimos cargar el panel"
          copy="Revisa tu conexión e intenta de nuevo."
        />
      ) : null}

      {!isLoadingState && !reservationsQuery.isError ? (
        <>
          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-lg">
            {/* Atención requerida */}
            <div className="md:col-span-8 flex flex-col gap-md">
              <h3 className="font-headline-md text-headline-md text-on-surface">Atención Requerida</h3>
              <Card className="flex-1">
                <CardContent className="flex flex-col gap-sm">
                  {pending.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-sm py-lg text-center">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-primary">
                        <Icon name="event_available" size={32} />
                      </span>
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        No tienes reservas pendientes de revisión.
                      </p>
                    </div>
                  ) : (
                    pending.slice(0, 4).map(renderRow)
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Resumen de ingresos */}
            <div className="md:col-span-4 flex flex-col gap-md">
              <h3 className="font-headline-md text-headline-md text-on-surface">Resumen de Ingresos</h3>
              <Card className="flex-1">
                <CardContent className="flex h-full flex-col justify-between gap-md">
                  <div>
                    <p className="mb-xs font-label-md text-label-md text-on-surface-variant">
                      Esta semana (bruto)
                    </p>
                    <h4 className="font-display-lg text-[36px] leading-none text-primary">
                      {money(weekIncome)}
                    </h4>
                    <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant">
                      vs reporte de {report ? `#${report.transactions} transacciones` : '—'} este mes.
                    </p>
                  </div>
                  <div>
                    <div className="mb-xs flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                      <span>Neto del mes</span>
                      <span>{money(report?.net)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                      <div
                        className="h-2 rounded-full bg-secondary"
                        style={{ width: `${Math.min(100, (weekIncome / Math.max(1, Number(report?.net ?? weekIncome * 4))) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <Link
                    to="/provider/stats"
                    className="rounded-lg py-sm text-center font-label-md text-label-md text-primary transition-colors hover:bg-primary-fixed-dim"
                  >
                    Ver Reporte Completo
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Acciones rápidas */}
            <div className="md:col-span-12 mt-md grid grid-cols-2 gap-md md:grid-cols-4">
              {QUICK_ACTIONS.map((qa) => (
                <Link
                  key={qa.to}
                  to={qa.to}
                  className="group flex flex-col items-center justify-center gap-sm rounded-xl border border-surface-container-high bg-surface-container-lowest p-md transition-shadow hover:shadow-md"
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${qa.cls}`}
                  >
                    <Icon name={qa.icon as Parameters<typeof Icon>[0]['name']} />
                  </span>
                  <span className="font-label-md text-label-md text-on-surface">{qa.label}</span>
                </Link>
              ))}
            </div>

            {/* Alertas urgentes + recordatorios */}
            <div className="md:col-span-12 grid grid-cols-1 gap-lg lg:grid-cols-2">
              <Card>
                <CardContent>
                  <h3 className="mb-md font-headline-md text-headline-md text-on-surface">Alertas urgentes</h3>
                  <div className="flex flex-col gap-sm">
                    {urgentNotifs.length === 0 && pending.length === 0 ? (
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        Todo en orden. Sin alertas urgentes.
                      </p>
                    ) : null}
                    {urgentNotifs.slice(0, 4).map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start gap-md rounded-lg bg-error-container/40 px-md py-sm"
                      >
                        <Icon name="notifications_active" size={18} className="mt-0.5 shrink-0 text-error" />
                        <div className="min-w-0 flex-1">
                          <p className="font-body-md text-body-md text-on-surface">{n.payload?.title as string ?? n.type}</p>
                          <p className="font-label-sm text-label-sm text-on-surface-variant">{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    ))}
                    {urgentNotifs.length === 0 &&
                      pending.slice(0, 3).map((r) => (
                        <div
                          key={r.id}
                          className="flex items-start gap-md rounded-lg bg-error-container/40 px-md py-sm"
                        >
                          <Icon name="pending_actions" size={18} className="mt-0.5 shrink-0 text-error" />
                          <div className="min-w-0 flex-1">
                            <p className="font-body-md text-body-md text-on-surface">
                              {r.items[0]?.service_title ?? `Reserva #${r.id}`}
                            </p>
                            <p className="font-label-sm text-label-sm text-on-surface-variant">
                              {RESERVATION_STATUS_LABELS[r.status]}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <h3 className="mb-md font-headline-md text-headline-md text-on-surface">Recordatorios</h3>
                  <div className="flex flex-col gap-sm">
                    {upcoming.length === 0 ? (
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        Sin reservas confirmadas en los próximos 7 días.
                      </p>
                    ) : (
                      upcoming.slice(0, 5).map((r) => (
                        <div key={r.id} className="flex items-center gap-md rounded-lg bg-surface-container-low px-md py-sm">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
                            <Icon name="schedule" size={18} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-body-md text-body-md text-on-surface font-semibold">
                              {r.items[0]?.service_title ?? `Reserva #${r.id}`}
                            </p>
                            <p className="font-label-sm text-label-sm text-on-surface-variant">
                              {formatDateShort(r.event_date)} · {formatTime(r.start_time)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
