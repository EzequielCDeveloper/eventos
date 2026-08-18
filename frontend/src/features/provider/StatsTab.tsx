import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { fetchMonthlyReport, fetchProviderReservations, providerKeys } from './providerApi';
import { useProviderServicesStore } from './providerServices';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard, StateView } from '@/components/common/StateView';
import { money, formatDateShort } from '@/lib/formatters';
import type { ConversationSummary } from '@/types/api';
import { clsx } from 'clsx';

/**
 * Estadísticas (FR-011.8) — payment history, earnings, response/acceptance
 * rate and average rating. Every figure is derived from real endpoints:
 *   GET /reservations                 → earnings, pending, rates, payment history
 *   GET /payments/reports/monthly     → monthly tax report (BR-006.8)
 *   GET /conversations                → response rate (provider responding)
 *   GET /services/:id/reviews         → average rating per service
 */

const WEEK_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function startOfWeek(): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

const EARNED_STATUSES = ['confirmada', 'en_curso', 'completada'];
const ACCEPT_STATUSES = ['confirmada', 'en_curso', 'completada'];

export default function StatsTab() {
  const token = useAuthStore((s) => s.accessToken);
  const meId = useAuthStore((s) => s.user?.id ?? null);
  const knownIds = useProviderServicesStore((s) => s.ids);
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());

  const t = new Date();
  const currentMonth = t.getMonth() + 1 === month && t.getFullYear() === year;

  const reservationsQ = useQuery({
    queryKey: providerKeys.reservations(),
    queryFn: () => fetchProviderReservations(),
    enabled: Boolean(token),
  });
  const reportQ = useQuery({
    queryKey: providerKeys.report(year, month),
    queryFn: () => fetchMonthlyReport(year, month),
    enabled: Boolean(token),
  });
  const convQ = useQuery({
    queryKey: ['conversations', 'list'],
    queryFn: () => apiGet<ConversationSummary[]>(`/conversations`),
    enabled: Boolean(token),
  });
  const reviewsQ = useQuery({
    queryKey: ['provider', 'reviews', knownIds.join(',')],
    queryFn: async () => {
      const rows = await Promise.all(
        knownIds.map(async (id) => {
          const reviews = await apiGet<Array<{ rating: number }>>(`/services/${id}/reviews?limit=100`);
          return { serviceId: id, reviews };
        }),
      );
      return rows.flatMap((r) => r.reviews.map((rev) => rev.rating));
    },
    enabled: knownIds.length > 0,
  });

  const reservations = useMemo(() => reservationsQ.data ?? [], [reservationsQ.data]);
  const conversations = useMemo(() => convQ.data ?? [], [convQ.data]);
  const report = reportQ.data;
  const ratings = reviewsQ.data ?? [];

  // ---- Derived metrics -------------------------------------------------------
  const weekStart = startOfWeek();

  const pendingCount = reservations.filter(
    (r) => !EARNED_STATUSES.includes(r.status) && r.status !== 'cancelada',
  ).length;

  const totalEarned = reservations
    .filter((r) => EARNED_STATUSES.includes(r.status))
    .reduce((sum, r) => sum + Number(r.total_price), 0);

  const accepted = reservations.filter((r) => ACCEPT_STATUSES.includes(r.status)).length;
  const nonCancelled = reservations.filter((r) => r.status !== 'cancelada').length;
  const acceptanceRate = nonCancelled > 0 ? Math.round((accepted / nonCancelled) * 100) : null;

  const responded = conversations.filter((c) => c.last_message && c.last_message.sender_id === meId).length;
  const responseRate = conversations.length > 0 ? Math.round((responded / conversations.length) * 100) : null;

  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  // Weekly income buckets (Mon..Sun) from reservation totals.
  const weekRows = useMemo(() => {
    const buckets = Array.from({ length: 7 }, () => 0);
    const today = new Date();
    for (const r of reservations) {
      if (!EARNED_STATUSES.includes(r.status)) continue;
      const d = new Date(`${r.event_date}T12:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      const diffDays = Math.round((d.getTime() - weekStart.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < 7 && d <= today) buckets[diffDays] += Number(r.total_price);
    }
    return buckets;
  }, [reservations, weekStart]);
  const weekTotal = weekRows.reduce((a, b) => a + b, 0);
  const maxBucket = Math.max(1, ...weekRows);

  // Payment history: last completed/confirmed reservations with amounts.
  const paymentRows = useMemo(
    () =>
      reservations
        .filter((r) => EARNED_STATUSES.includes(r.status))
        .slice(0, 6)
        .map((r) => ({ id: r.id, title: r.items[0]?.service_title ?? `Reserva #${r.id}`, date: r.event_date, amount: r.total_price, status: r.status })),
    [reservations],
  );

  const loading = reservationsQ.isLoading && reservations.length === 0;

  return (
    <div className="flex flex-col gap-xxl">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Estadísticas
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">
            Desempeño de tu negocio.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-2 gap-md md:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}

      {!loading && reservationsQ.isError ? (
        <StateView state="error" title="No pudimos cargar tus estadísticas" copy="Intenta de nuevo en un momento." />
      ) : null}

      {!loading && !reservationsQ.isError ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-md md:grid-cols-4">
            <KpiCard icon="payments" tone="primary" label="Ingresos (confirmadas)" value={money(totalEarned)} />
            <KpiCard icon="event_available" tone="secondary" label="Reservas pendientes" value={String(pendingCount)} />
            <KpiCard icon="star" tone="secondary" label="Calificación" value={avgRating != null ? avgRating.toFixed(1) : '—'} />
            <KpiCard icon="flag" tone="primary" label="Transacciones del mes" value={String(report?.transactions ?? '—')} />
          </div>

          {/* Ranking metrics */}
          <div className="grid grid-cols-2 gap-md md:grid-cols-4">
            <KpiCard icon="quick_reply" tone="secondary" label="Tasa de respuesta" value={responseRate != null ? `${responseRate}%` : '—'} />
            <KpiCard icon="event_available" tone="secondary" label="Tasa de aceptación" value={acceptanceRate != null ? `${acceptanceRate}%` : '—'} />
          </div>

          {/* Ingresos por día (weekly bar chart) */}
          <Card>
            <CardContent>
              <h3 className="mb-md font-headline-md text-headline-md text-on-surface">Ingresos confirmados por día</h3>
              {weekTotal === 0 ? (
                <p className="py-lg font-body-md text-body-md text-on-surface-variant">
                  Sin ingresos esta semana. Publica tu anuncio y recibe reservas para ver tu desempeño aquí.
                </p>
              ) : (
                <div className="flex h-48 items-end gap-sm md:gap-md">
                  {WEEK_DAYS.map((day, i) => (
                    <div key={day} className="flex h-full flex-1 flex-col items-center justify-end gap-sm" title={money(weekRows[i])}>
                      <div
                        className={clsx('w-full rounded-t-md transition-all', i === new Date().getDay() ? 'bg-secondary' : 'bg-primary')}
                        style={{ height: `${Math.max(4, (weekRows[i] / maxBucket) * 100)}%` }}
                      />
                      <span className="font-label-sm text-label-sm text-on-surface-variant">{day}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reporte mensual */}
          <Card>
            <CardContent>
              <div className="mb-md flex flex-col justify-between gap-md md:flex-row md:items-center">
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface">Reporte mensual</h3>
                  <p className="mt-xs font-body-md text-body-md text-sm text-on-surface-variant">
                    Resumen de transacciones del mes. La generación de CFDI está diferida.
                  </p>
                </div>
                <div className="flex items-center gap-sm">
                  <button
                    type="button"
                    aria-label="Mes anterior"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
                    onClick={() => { if (month === 1) { setYear((y) => y - 1); setMonth(12); } else setMonth((m) => m - 1); }}
                  >
                    <Icon name="chevron_left" size={20} />
                  </button>
                  <Badge variant="secondary">
                    {['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][month]} {year}
                    {currentMonth ? ' · actual' : ''}
                  </Badge>
                  <button
                    type="button"
                    aria-label="Mes siguiente"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low disabled:opacity-40"
                    disabled={currentMonth}
                    onClick={() => { if (month === 12) { setYear((y) => y + 1); setMonth(1); } else setMonth((m) => m + 1); }}
                  >
                    <Icon name="chevron_right" size={20} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-md md:grid-cols-5">
                <ReportMetric label="Transacciones" value={String(report?.transactions ?? '—')} />
                <ReportMetric label="Bruto" value={money(report?.gross)} />
                <ReportMetric label="Impuestos" value={money(report?.taxes)} />
                <ReportMetric label="Comisión" value={money(report?.commission)} />
                <ReportMetric label="Neto" value={money(report?.net)} primary />
              </div>
              <p className="mt-md flex flex-wrap items-center gap-x-lg gap-y-xs font-label-sm text-label-sm text-on-surface-variant">
                <span className="flex items-center gap-xs"><Icon name="receipt_long" size={16} /> Sin generación de CFDI (diferido)</span>
                <span className="flex items-center gap-xs"><Icon name="lock" size={16} /> Descarga disponible en una próxima entrega</span>
              </p>
            </CardContent>
          </Card>

          {/* Historial de pagos */}
          <Card>
            <CardContent>
              <h3 className="mb-md font-headline-md text-headline-md text-on-surface">Historial de pagos</h3>
              {paymentRows.length === 0 ? (
                <p className="font-body-md text-body-md text-on-surface-variant">Aún no hay pagos registrados.</p>
              ) : (
                <div className="flex flex-col gap-sm">
                  {paymentRows.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-surface-container-low px-md py-sm">
                      <div>
                        <p className="font-body-md text-body-md text-on-surface">{p.title}</p>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">{formatDateShort(p.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-label-md text-label-md text-on-surface font-semibold">{money(p.amount)}</p>
                        <p className="font-label-sm text-label-sm text-primary">{p.status === 'completada' ? 'Completada' : 'Confirmada'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({ icon, tone, label, value }: { icon: string; tone: 'primary' | 'secondary'; label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <p className="mb-xs flex items-center gap-sm font-label-md text-label-md text-on-surface-variant">
          <Icon name={icon} size={18} className={tone === 'primary' ? 'text-primary' : 'text-secondary'} />
          {label}
        </p>
        <h4 className="font-display-lg text-[28px] leading-none text-on-surface">{value}</h4>
      </CardContent>
    </Card>
  );
}

function ReportMetric({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-container-low p-md">
      <p className="mb-xs font-label-sm text-label-sm text-on-surface-variant">{label}</p>
      <h4 className={clsx('font-display-lg text-[24px] leading-none', primary ? 'text-primary' : 'text-on-surface')}>
        {value}
      </h4>
    </div>
  );
}
