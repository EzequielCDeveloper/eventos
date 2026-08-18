import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminKeys,
  blockProvider,
  fetchAdminProviders,
  unblockProvider,
} from './adminApi';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Input';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { StateView, SkeletonCard } from '@/components/common/StateView';
import { useToast } from '@/components/ui/Toast';
import { formatDateShort } from '@/lib/formatters';
import type { AdminProvider } from '@/types/api';
import { clsx } from 'clsx';

/**
 * Gestión de proveedores (FR-003.2) — provider listing with verification
 * status, service/review counts and block/unblock. Wires to
 * GET /admin/providers + POST /admin/providers/:id/(un)block.
 */
type Filter = 'all' | 'true' | 'false';

export default function ProviderManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [blocking, setBlocking] = useState<AdminProvider | null>(null);
  const [reason, setReason] = useState('');

  const listQ = useQuery({
    queryKey: adminKeys.providers(filter === 'all' ? undefined : filter, 1),
    queryFn: () =>
      fetchAdminProviders({
        verified: filter === 'all' ? undefined : (filter as 'true' | 'false'),
        limit: 100,
      }),
  });

  const blockQ = useMutation({
    mutationFn: () => blockProvider(blocking!.id, { reason: reason.trim() }),
    onSuccess: () => {
      toast('Proveedor bloqueado.');
      setBlocking(null);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: adminKeys.providers() });
    },
    onError: (e) => toast('No se pudo bloquear al proveedor.', String(e), 'error'),
  });

  const unblockQ = useMutation({
    mutationFn: (id: number) => unblockProvider(id),
    onSuccess: () => {
      toast('Bloqueo levantado.');
      void queryClient.invalidateQueries({ queryKey: adminKeys.providers() });
    },
    onError: (e) => toast('No se pudo levantar el bloqueo.', String(e), 'error'),
  });

  const providers = listQ.data?.items ?? [];
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
            Proveedores
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">
            Estado de verificación y bloqueos de los proveedores.
          </p>
        </div>
        <div className="flex flex-wrap gap-sm">
          {filterBtn('all', 'Todos')}
          {filterBtn('true', 'Verificados')}
          {filterBtn('false', 'No verificados')}
        </div>
      </section>

      {loading ? (
        <div className="flex flex-col gap-md"><SkeletonCard /><SkeletonCard /></div>
      ) : null}
      {!loading && providers.length === 0 ? (
        <StateView state="empty" icon="person_off" title="No hay proveedores" copy="No se encontraron proveedores con ese filtro." />
      ) : null}

      {!loading && providers.length > 0 ? (
        <div className="flex flex-col gap-md">
          {providers.map((p) => (
            <div key={p.id} className="flex flex-col gap-md rounded-xl border border-surface-container-high bg-surface-container-lowest p-lg shadow-sm md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-md">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-fixed font-label-md text-label-md text-on-primary-fixed-variant">
                  {p.full_name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-sm">
                    <h3 className="font-headline-md text-[20px] leading-tight text-on-surface">{p.full_name}</h3>
                    {p.verified ? (
                      <Badge variant="success"><Icon name="verified" filled size={14} /> Verificado</Badge>
                    ) : (
                      <Badge variant="outline">Sin verificar</Badge>
                    )}
                    {p.active_block ? (
                      <Badge variant="danger"><Icon name="block" size={14} /> Bloqueado</Badge>
                    ) : null}
                  </div>
                  <p className="mt-xs truncate font-body-md text-body-md text-sm text-on-surface-variant">
                    {p.email} · {p.phone}
                  </p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Alta: {formatDateShort(p.created_at)} · Servicios: {p.stats.services} · Reseñas: {p.stats.reviews}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-sm">
                {p.active_block ? (
                  <Button variant="outline" onClick={() => unblockQ.mutate(p.id)} loading={unblockQ.isPending}>
                    <Icon name="lock_open" size={16} /> Desbloquear
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="text-error border-error hover:bg-error-container"
                    onClick={() => { setBlocking(p); setReason(''); }}
                  >
                    <Icon name="block" size={16} /> Bloquear
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Block with reason */}
      <Dialog open={Boolean(blocking)} onOpenChange={(open) => { if (!open) setBlocking(null); }}>
        <DialogContent title={blocking ? `Bloquear a ${blocking.full_name}` : 'Bloquear proveedor'}>
          <div className="flex flex-col gap-md">
            <p className="font-body-md text-body-md text-on-surface-variant">
              El proveedor no podrá operar sus servicios mientras el bloqueo esté activo.
            </p>
            <Textarea
              label="Motivo del bloqueo"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe el motivo (obligatorio)…"
            />
            <div className="mt-md flex justify-end gap-sm">
              <Button variant="outline" onClick={() => setBlocking(null)}>Cancelar</Button>
              <Button
                variant="danger"
                disabled={reason.trim().length === 0}
                loading={blockQ.isPending}
                onClick={() => blockQ.mutate()}
              >
                <Icon name="block" size={16} /> Bloquear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
