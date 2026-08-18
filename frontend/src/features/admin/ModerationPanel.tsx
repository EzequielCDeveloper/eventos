import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminKeys, fetchModeration, moderationAction } from './adminApi';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { StateView, SkeletonCard } from '@/components/common/StateView';
import { useToast } from '@/components/ui/Toast';
import { formatDateShort } from '@/lib/formatters';
import { SERVICE_TYPE_LABELS } from '@/lib/constants';
import type { ModerationActionBody } from '@/types/api';
import { clsx } from 'clsx';

/**
 * Moderación (FR-003.2) — content reports queue with status filter and
 * decision actions. Wires to GET/POST /admin/moderation | :id/action.
 */
type Filter = 'pendiente' | 'resuelto';

export default function ModerationPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('pendiente');
  const [confirm, setConfirm] = useState<{ reportId: number; action: ModerationActionBody['action'] } | null>(null);

  const listQ = useQuery({
    queryKey: adminKeys.moderation(filter, 1),
    queryFn: () => fetchModeration({ status: filter, limit: 50 }),
  });

  const act = useMutation({
    mutationFn: async (c: { reportId: number; action: ModerationActionBody['action'] }) =>
      moderationAction(c.reportId, { action: c.action }),
    onSuccess: (_data, c) => {
      toast(`Reporte ${c.action === 'eliminar' ? 'eliminado' : c.action === 'aprobar' ? 'aprobado' : 'advertido'}.`);
      setConfirm(null);
      void queryClient.invalidateQueries({ queryKey: adminKeys.moderation(filter, 1) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats });
    },
    onError: (e) => toast('No se pudo procesar la decisión.', String(e), 'error'),
  });

  const reports = listQ.data?.items ?? [];
  const loading = listQ.isLoading;

  const filterBtn = (f: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(f)}
      className={clsx(
        'rounded-full px-md py-sm font-label-md text-label-md transition-colors',
        filter === f
          ? 'bg-primary text-on-primary'
          : 'border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low',
      )}
    >
      {label}
    </button>
  );

  const reportAction = (reportId: number, action: ModerationActionBody['action']) => {
    if (action === 'eliminar') {
      setConfirm({ reportId, action });
    } else {
      act.mutate({ reportId, action });
    }
  };

  return (
    <div className="flex flex-col gap-xxl">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Moderación
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">
            Revisando reportes de contenido y solicitudes de alta.
          </p>
        </div>
        <div className="flex flex-wrap gap-sm">{filterBtn('pendiente', 'Pendientes')}{filterBtn('resuelto', 'Resueltos')}</div>
      </section>

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-12">
        <div className="lg:col-span-8 flex flex-col gap-md">
          <h3 className="font-headline-md text-headline-md text-on-surface">Cola de moderación</h3>
          {loading ? (
            <div className="flex flex-col gap-md"><SkeletonCard /><SkeletonCard /></div>
          ) : null}
          {!loading && reports.length === 0 ? (
            <StateView
              state="empty"
              icon="rule"
              title={filter === 'pendiente' ? 'No hay reportes pendientes' : 'No hay reportes resueltos'}
              copy={filter === 'pendiente' ? 'Todas las solicitudes fueron revisadas.' : 'No hay decisiones registradas.'}
            />
          ) : null}
          {!loading ? (
            <div className="flex flex-col gap-md">
              {reports.map((r) => (
                <div key={r.id} className="rounded-xl border border-surface-container-high bg-surface-container-lowest p-lg shadow-sm">
                  <div className="mb-xs flex flex-wrap items-center gap-sm">
                    <Badge variant={r.status === 'pendiente' ? 'warning' : 'success'}>
                      {r.status === 'pendiente' ? 'Pendiente' : 'Resuelto'}
                    </Badge>
                    <span className="rounded-full bg-primary-fixed px-2 py-0.5 font-label-sm text-[10px] uppercase tracking-wider text-on-primary-fixed-variant">
                      {r.service ? SERVICE_TYPE_LABELS[r.service.service_type] : 'Servicio'}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{formatDateShort(r.created_at)}</span>
                  </div>
                  <h4 className="font-headline-md text-[20px] leading-tight text-on-surface">
                    {r.service?.title ?? `Reporte #${r.id}`}
                  </h4>
                  <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
                    Reportado por {r.reporter?.full_name ?? 'usuario'} — {r.reason}
                  </p>
                  {r.action ? (
                    <p className="mt-sm font-label-sm text-label-sm text-on-surface-variant">
                      Decisión: <span className="font-semibold capitalize">{r.action}</span>
                      {r.handled_at ? ` · ${formatDateShort(r.handled_at)}` : ''}
                    </p>
                  ) : null}
                  {r.status === 'pendiente' ? (
                    <div className="mt-md flex flex-wrap gap-sm">
                      <Button size="sm" onClick={() => reportAction(r.id, 'aprobar')}>
                        <Icon name="check" size={16} /> Aprobar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => reportAction(r.id, 'advertir')}>
                        <Icon name="warning" size={16} /> Advertir
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => reportAction(r.id, 'eliminar')}>
                        <Icon name="delete" size={16} /> Eliminar servicio
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-4 flex flex-col gap-md">
          <h3 className="font-headline-md text-headline-md text-on-surface">Reglas</h3>
          <div className="flex flex-col gap-sm rounded-xl border border-surface-container-high bg-surface-container-lowest p-lg shadow-sm">
            <PolicyRow icon="check" text="Aprobar: la solicitud cumple con las políticas y se autoriza." />
            <PolicyRow icon="warning" text="Advertir: se notifica la falta, el reporte queda como resuelto." />
            <PolicyRow icon="delete" text="Eliminar: el servicio se da de baja (soft-delete) inmediatamente." />
          </div>
        </div>
      </div>

      {/* Confirm elimination (destructive) */}
      <Dialog open={Boolean(confirm)} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <DialogContent title={`¿Eliminar el servicio del reporte #${confirm?.reportId}?`}>
          <div className="flex flex-col gap-md">
            <p className="font-body-md text-body-md text-on-surface-variant">
              El servicio dejará de aparecer en el marketplace (soft-delete). La acción es
              irreversible desde el panel.
            </p>
            <div className="mt-md flex justify-end gap-sm">
              <Button variant="outline" onClick={() => setConfirm(null)}>Cancelar</Button>
              <Button
                variant="danger"
                loading={act.isPending}
                onClick={() => confirm && act.mutate({ reportId: confirm.reportId, action: 'eliminar' })}
              >
                <Icon name="delete" size={16} /> Eliminar servicio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PolicyRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-md">
      <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-primary" />
      <p className="font-body-md text-body-md text-sm text-on-surface-variant">{text}</p>
    </div>
  );
}
