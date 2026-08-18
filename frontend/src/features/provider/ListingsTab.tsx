import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiPut } from '@/lib/api';
import { fetchService } from './providerApi';
import { useProviderServicesStore } from './providerServices';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { StateView, SkeletonCard } from '@/components/common/StateView';
import { useToast } from '@/components/ui/Toast';
import { money, formatDateShort } from '@/lib/formatters';
import { SERVICE_TYPE_LABELS } from '@/lib/constants';
import type { ServiceDetail } from '@/types/api';
import type { ServicesStatus } from '@/types/models';

/**
 * Anuncios (FR-011.7) — manage the provider's published listings.
 *
 * Description/title/status edits go to the real PUT /services/:id; photos
 * are shown read-only (the backend lacks a service-photos update route yet —
 * S8 gap), and dynamic pricing/cancellation policy are managed from the
 * Calendario tab where their real endpoints live.
 */

const STATUS_META: Record<ServicesStatus, { label: string; variant: BadgeVariant }> = {
  borrador: { label: 'Borrador', variant: 'outline' },
  pendiente_verificacion: { label: 'En revisión', variant: 'warning' },
  publicado: { label: 'Publicado', variant: 'success' },
  rechazado: { label: 'Rechazado', variant: 'danger' },
};

function basePriceOf(service: ServiceDetail): number {
  if (service.service_type === 'salon') return Number(service.pricing.salon?.base_block_price ?? 0);
  if (service.service_type === 'sonido') return Number(service.pricing.sound_packages[0]?.base_price ?? 0);
  return Number(service.pricing.persona?.price_per_person_per_hour ?? 0);
}

export default function ListingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const knownIds = useProviderServicesStore((s) => s.ids);
  const removeId = useProviderServicesStore((s) => s.remove);

  const servicesQ = useQuery({
    queryKey: ['provider', 'services', knownIds.join(',')],
    queryFn: () => Promise.all(knownIds.map((id) => fetchService(id))),
    enabled: knownIds.length > 0,
  });
  const services = useMemo(() => (servicesQ.data ?? []).filter(Boolean) as ServiceDetail[], [servicesQ.data]);

  const [editing, setEditing] = useState<ServiceDetail | null>(null);
  const [form, setForm] = useState({ title: '', description: '', status: 'borrador' as ServicesStatus });

  useEffect(() => {
    if (editing) setForm({ title: editing.title, description: editing.description, status: editing.status });
  }, [editing]);

  const updateQ = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
      };
      if (form.status !== (editing?.status ?? 'borrador')) body.status = form.status;
      return apiPut<{ id: number }>(`/services/${editing?.id}`, body);
    },
    onSuccess: () => {
      toast('Anuncio actualizado.');
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['provider', 'services', knownIds.join(',')] });
    },
    onError: (e) => toast('No se pudo actualizar el anuncio.', String(e), 'error'),
  });

  const deleteQ = useMutation({
    mutationFn: (id: number) => apiDelete<{ deleted: true }>(`/services/${id}`),
    onSuccess: (_data, id) => {
      removeId(id);
      toast('Anuncio eliminado.');
      void queryClient.invalidateQueries({ queryKey: ['provider', 'services', knownIds.join(',')] });
    },
    onError: (e) => toast('No se pudo eliminar el anuncio.', String(e), 'error'),
  });

  return (
    <div className="flex flex-col gap-xxl">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Anuncios
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">
            Administra tus anuncios publicados.
          </p>
        </div>
        <Button asChild>
          <Link to="/provider/onboarding">
            <Icon name="add" size={18} /> Nuevo Anuncio
          </Link>
        </Button>
      </section>

      {servicesQ.isLoading && services.length === 0 ? (
        <div className="flex flex-col gap-md">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}

      {!servicesQ.isLoading && services.length === 0 ? (
        <StateView
          state="empty"
          icon="campaign"
          title="Aún no tienes anuncios publicados"
          copy="Crea tu primer anuncio con el asistente de alta."
          action={
            <Button asChild>
              <Link to="/provider/onboarding">Nuevo Anuncio</Link>
            </Button>
          }
        />
      ) : null}

      {services.length > 0 ? (
        <div className="flex flex-col gap-md">
          {services.map((s) => {
            const status = STATUS_META[s.status];
            const catCls =
              s.service_type === 'salon'
                ? 'bg-primary-fixed text-on-primary-fixed'
                : s.service_type === 'sonido'
                  ? 'bg-secondary-fixed text-on-secondary-fixed'
                  : 'bg-tertiary-fixed text-on-tertiary-fixed';
            return (
              <Card key={s.id}>
                <CardContent className="flex flex-col gap-md md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="mb-xs flex flex-wrap items-center gap-sm">
                      <span className={`rounded-full px-2 py-0.5 font-label-sm text-[10px] uppercase tracking-wider ${catCls}`}>
                        {SERVICE_TYPE_LABELS[s.service_type]}
                      </span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {s.photos.length > 0 ? (
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          {s.photos.length} fotos
                        </span>
                      ) : null}
                    </div>
                    <h3 className="font-headline-md text-[20px] leading-tight text-on-surface">{s.title}</h3>
                    <p className="mt-xs font-label-sm text-label-sm text-on-surface-variant">
                      {formatDateShort(s.created_at)} · {s.max_capacity} pax ·{' '}
                      {s.location && typeof s.location === 'object' && 'address' in s.location
                        ? String((s.location as { address?: string }).address ?? '')
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-md md:justify-end md:min-w-[300px]">
                    <span className="font-headline-md text-[20px] text-primary">{money(basePriceOf(s))}</span>
                    <div className="flex gap-sm">
                      <Button variant="outline" onClick={() => setEditing(s)}>
                        <Icon name="edit" size={16} /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-error hover:bg-error-container"
                        onClick={() => {
                          if (window.confirm(`Eliminar el anuncio "${s.title}"?`)) deleteQ.mutate(s.id);
                        }}
                      >
                        <Icon name="delete" size={16} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Editar anuncio */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent title={editing ? `Editar — ${editing.title}` : 'Editar anuncio'}>
          {editing ? (
            <div className="flex flex-col gap-md">
              <Input
                label="Título"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <Textarea
                label="Descripción"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as ServicesStatus }))}
                options={Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))}
              />
              <div className="rounded-lg bg-surface-container-low p-md">
                <p className="mb-sm font-label-md text-label-md text-on-surface">Fotos ({editing.photos.length})</p>
                <div className="grid grid-cols-5 gap-sm">
                  {editing.photos.slice(0, 5).map((p) => (
                    <div key={p.id} className="aspect-square overflow-hidden rounded-lg border border-outline-variant">
                      <img src={p.url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                  {editing.photos.length === 0 ? (
                    <p className="col-span-5 font-body-md text-body-md text-sm text-on-surface-variant">
                      Sin fotos. Agrégalas al publicar el anuncio (la edición de fotos llega con el
                      endpoint de subida, S8).
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="font-label-sm text-label-sm text-on-surface-variant flex items-start gap-xs">
                <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                Las reglas de precio se administran en Calendario; la política de cancelación es fija
                por proveedor (50% retención / 30 días sin penalización).
              </p>
              <div className="mt-md flex justify-end gap-sm">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={() => updateQ.mutate()} loading={updateQ.isPending}>
                  <Icon name="save" size={16} /> Guardar cambios
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
