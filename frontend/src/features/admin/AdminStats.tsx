import { useQuery } from '@tanstack/react-query';
import { adminKeys, fetchAdminStats } from './adminApi';
import { Card, CardContent } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/common/StateView';
import { money } from '@/lib/formatters';
import { RESERVATION_STATUS_LABELS } from '@/lib/constants';

/**
 * Estadísticas (globales) — platform metrics from GET /admin/stats:
 * users, services (by status), reservations (by status) and payments.
 */
const STATUS_LABELS: Record<string, string> = {
  borrador: 'Borradores',
  pendiente_verificacion: 'En revisión',
  publicado: 'Publicados',
  rechazado: 'Rechazados',
};

export default function AdminStats() {
  const statsQ = useQuery({ queryKey: adminKeys.stats, queryFn: fetchAdminStats });
  const stats = statsQ.data;

  const kpis = stats
    ? [
        { label: 'Usuarios', value: String(stats.users.total), icon: 'group', tone: 'text-primary' },
        { label: 'Proveedores', value: String(stats.users.providers), icon: 'badge', tone: 'text-secondary' },
        { label: 'Verificados', value: String(stats.users.providers_verified), icon: 'verified', tone: 'text-secondary' },
        { label: 'Servicios', value: String(stats.services.total), icon: 'storefront', tone: 'text-primary' },
        { label: 'Reservas', value: String(stats.reservations.total), icon: 'event', tone: 'text-primary' },
        { label: 'Pagos procesados', value: String(stats.payments.processed), icon: 'payments', tone: 'text-secondary' },
      ]
    : [];

  return (
    <div className="flex flex-col gap-xxl">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Estadísticas
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">
            Métricas generales de la plataforma FiestaExpert.
          </p>
        </div>
      </section>

      {!statsQ.isLoading ? (
        <div className="grid grid-cols-2 gap-md md:grid-cols-3 lg:grid-cols-6">
          {kpis.map((k) => (
            <Card key={k.label}>
              <CardContent>
                <p className="mb-xs flex items-center gap-sm font-label-md text-label-md text-on-surface-variant">
                  <Icon name={k.icon} size={18} className={k.tone} />
                  {k.label}
                </p>
                <h4 className="font-display-lg text-[28px] leading-none text-on-surface">{k.value}</h4>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-md md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-md">
            <h3 className="font-headline-md text-headline-md text-on-surface">Servicios por estado</h3>
            <div className="flex flex-col gap-3">
              {Object.entries(stats?.services.by_status ?? {}).map(([status, count]) => (
                <div key={status}>
                  <div className="mb-xs flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                    <span>{STATUS_LABELS[status] ?? status}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className="h-2.5 rounded-full bg-primary"
                      style={{ width: `${Math.round((Number(count) / Math.max(1, stats?.services.total ?? 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-md">
            <h3 className="font-headline-md text-headline-md text-on-surface">Reservas por estado</h3>
            <div className="flex flex-col gap-3">
              {Object.entries(stats?.reservations.by_status ?? {}).map(([status, count]) => (
                <div key={status}>
                  <div className="mb-xs flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                    <span>{RESERVATION_STATUS_LABELS[status as keyof typeof RESERVATION_STATUS_LABELS] ?? status}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className="h-2.5 rounded-full bg-secondary"
                      style={{ width: `${Math.round((Number(count) / Math.max(1, stats?.reservations.total ?? 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-lg gap-y-sm font-body-md text-body-md text-on-surface-variant">
          <span className="flex items-center gap-xs">
            <Icon name="payments" size={18} className="text-primary" />
            Total procesado: <strong className="text-on-surface">{money(stats?.payments.total_amount)}</strong>
          </span>
          <span className="flex items-center gap-xs">
            <Badge variant="warning"><Icon name="flag" size={14} /> Reportes pendientes: {stats?.moderation.pending_reports ?? 0}</Badge>
          </span>
          <span className="flex items-center gap-xs">
            <Badge variant="secondary"><Icon name="gavel" size={14} /> Disputas abiertas: {stats?.disputes.open ?? 0}</Badge>
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
