import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminKeys, fetchDisputes, resolveDispute } from './adminApi';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Input';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { StateView, SkeletonCard } from '@/components/common/StateView';
import { useToast } from '@/components/ui/Toast';
import { formatDateShort } from '@/lib/formatters';
import { money } from '@/lib/formatters';
import type { Dispute } from '@/types/api';
import { clsx } from 'clsx';

/**
 * Disputas técnicas — claims between users and providers that need admin
 * review. Wires to GET /admin/disputes (?status=) and
 * POST /admin/disputes/:id/resolve.
 */
type Filter = 'all' | 'abierta' | 'resuelta';

export default function AdminDisputes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [resolving, setResolving] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState('');

  const listQ = useQuery({
    queryKey: adminKeys.disputes(filter === 'all' ? undefined : filter, 1),
    queryFn: () => fetchDisputes({ status: filter === 'all' ? undefined : (filter as 'abierta' | 'resuelta'), limit: 100 }),
  });

  const resolveQ = useMutation({
    mutationFn: () => resolveDispute(resolving!.id, { resolution: resolution.trim() }),
    onSuccess: () => {
      toast('Disputa resuelta.');
      setResolving(null);
      setResolution('');
      void queryClient.invalidateQueries({ queryKey: adminKeys.disputes() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats });
    },
    onError: (e) => toast('No se pudo resolver la disputa.', String(e), 'error'),
  });

  const disputes = listQ.data?.items ?? [];
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

  return (
    <div className="flex flex-col gap-xxl">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Disputas Técnicas
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">
            Reclamos entre usuarios y proveedores que requieren revisión.
          </p>
        </div>
        <div className="flex flex-wrap gap-sm">
          {filterBtn('all', 'Todas')}
          {filterBtn('abierta', 'Abiertas')}
          {filterBtn('resuelta', 'Resueltas')}
        </div>
      </section>

      {loading ? (
        <div className="flex flex-col gap-md"><SkeletonCard /><SkeletonCard /></div>
      ) : null}
      {!loading && disputes.length === 0 ? (
        <StateView state="empty" icon="gavel" title="No hay disputas en esta categoría" copy="Todas las disputas fueron revisadas." />
      ) : null}

      {!loading && disputes.length > 0 ? (
        <div className="flex flex-col gap-md">
          {disputes.map((d) => (
            <div key={d.id} className="flex flex-col gap-md rounded-xl border border-surface-container-high bg-surface-container-lowest p-lg shadow-sm md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="mb-xs flex flex-wrap items-center gap-sm">
                  <Badge variant={d.status === 'abierta' ? 'warning' : 'success'}>
                    {d.status === 'abierta' ? 'Abierta' : 'Resuelta'}
                  </Badge>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    Reserva #{d.reservation_id} · {formatDateShort(d.created_at)}
                  </span>
                </div>
                <h3 className="font-headline-md text-[20px] leading-tight text-on-surface">
                  {d.reservation
                    ? `Reserva #${d.reservation.id} — ${d.reservation.status}`
                    : `Disputa #${d.id}`}
                </h3>
                <p className="mt-xs font-body-md text-body-md text-sm text-on-surface-variant">
                  Reportada por {d.reporter?.full_name ?? `usuario #${d.reported_by}`}
                  {d.reservation ? ` · Total ${money(d.reservation.total_price)}` : ''}
                </p>
                {d.resolution ? (
                  <p className="mt-sm font-label-sm text-label-sm text-on-surface-variant">
                    Resolución: <span className="font-semibold">{d.resolution}</span>
                  </p>
                ) : null}
              </div>
              {d.status === 'abierta' ? (
                <Button variant="outline" onClick={() => { setResolving(d); setResolution(''); }}>
                  <Icon name="gavel" size={16} /> Resolver
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <Dialog open={Boolean(resolving)} onOpenChange={(open) => { if (!open) setResolving(null); }}>
        <DialogContent title={`Resolver disputa #${resolving?.id}`}>
          <div className="flex flex-col gap-md">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Registra la resolución técnica de la disputa. Quedará visible para ambas partes.
            </p>
            <Textarea
              label="Resolución"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Describe la decisión…"
            />
            <div className="mt-md flex justify-end gap-sm">
              <Button variant="outline" onClick={() => setResolving(null)}>Cancelar</Button>
              <Button
                disabled={resolution.trim().length === 0}
                loading={resolveQ.isPending}
                onClick={() => resolveQ.mutate()}
              >
                <Icon name="check" size={16} /> Resolver disputa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
