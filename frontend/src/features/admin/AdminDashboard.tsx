import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminKeys, fetchAdminStats } from './adminApi';
import ModerationPanel from './ModerationPanel';
import { Card, CardContent } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard } from '@/components/common/StateView';
import { money } from '@/lib/formatters';
import { useAuthStore } from '@/stores/authStore';

/**
 * Admin dashboard (FR-003.1–FR-003.2) — the panel landing with the exact 5
 * function areas (moderación, proveedores, estadísticas, disputas, comisión),
 * a platform stats snapshot (GET /admin/stats) and the moderation queue.
 */
const AREAS = [
  { to: '/admin/moderation', label: 'Moderación', icon: 'rule', desc: 'Reportes y cola de moderación' },
  { to: '/admin/providers', label: 'Proveedores', icon: 'badge', desc: 'Verificación y bloqueos' },
  { to: '/admin/stats', label: 'Estadísticas', icon: 'query_stats', desc: 'Métricas generales' },
  { to: '/admin/disputes', label: 'Disputas técnicas', icon: 'gavel', desc: 'Reclamos y resoluciones' },
  { to: '/admin/commission', label: 'Comisión global', icon: 'percent', desc: 'Tasa que retiene la plataforma' },
] as const;

export default function AdminDashboard() {
  const name = useAuthStore((s) => s.user?.full_name?.split(' ')[0] ?? 'Admin');
  const statsQ = useQuery({
    queryKey: adminKeys.stats,
    queryFn: fetchAdminStats,
  });

  const stats = statsQ.data;

  const kpis = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Usuarios', value: String(stats.users.total), icon: 'group', tone: 'primary' },
      { label: 'Proveedores', value: String(stats.users.providers), icon: 'badge', tone: 'secondary' },
      { label: 'Verificados', value: String(stats.users.providers_verified), icon: 'verified', tone: 'secondary' },
      { label: 'Servicios', value: String(stats.services.total), icon: 'storefront', tone: 'primary' },
      { label: 'Reservas', value: String(stats.reservations.total), icon: 'event', tone: 'primary' },
      { label: 'Pagos procesados', value: String(stats.payments.processed), icon: 'payments', tone: 'secondary' },
    ];
  }, [stats]);

  return (
    <div className="flex flex-col gap-xxl">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Hola, {name}.
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">
            Panel de administración de FiestaExpert.
          </p>
        </div>
      </section>

      {/* 5 function areas */}
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-5">
        {AREAS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="group flex flex-col gap-sm rounded-xl border border-surface-container-high bg-surface-container-lowest p-md shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed transition-transform group-hover:scale-110">
              <Icon name={a.icon} />
            </span>
            <span className="font-label-md text-label-md text-on-surface">{a.label}</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">{a.desc}</span>
          </Link>
        ))}
      </div>

      {/* Platform stats snapshot */}
      <section className="flex flex-col gap-md">
        <h2 className="font-headline-md text-headline-md text-on-surface">Resumen de la plataforma</h2>
        {statsQ.isLoading ? (
          <div className="grid grid-cols-2 gap-md md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : null}
        {!statsQ.isLoading && kpis.length > 0 ? (
          <div className="grid grid-cols-2 gap-md md:grid-cols-3 lg:grid-cols-6">
            {kpis.map((k) => (
              <Card key={k.label}>
                <CardContent>
                  <p className="mb-xs flex items-center gap-sm font-label-md text-label-md text-on-surface-variant">
                    <Icon name={k.icon} size={18} className={k.tone === 'primary' ? 'text-primary' : 'text-secondary'} />
                    {k.label}
                  </p>
                  <h4 className="font-display-lg text-[28px] leading-none text-on-surface">{k.value}</h4>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
        {!statsQ.isLoading && !statsQ.isError ? (
          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-lg gap-y-sm font-body-md text-body-md text-on-surface-variant">
              <span className="flex items-center gap-xs">
                <Icon name="payments" size={18} className="text-primary" /> Total procesado: {money(stats?.payments.total_amount)}
              </span>
              <span className="flex items-center gap-xs">
                <Icon name="flag" size={18} className="text-primary" /> Reportes pendientes: {stats?.moderation.pending_reports}
              </span>
              <span className="flex items-center gap-xs">
                <Icon name="gavel" size={18} className="text-primary" /> Disputas abiertas: {stats?.disputes.open}
              </span>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {/* Moderación inline — the landing doubles as the moderation home. */}
      <ModerationPanel />
    </div>
  );
}
