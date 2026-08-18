import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiPut, relocateUpload, uploadFile } from '@/lib/api';
import {
  addServicePhoto,
  deleteServicePhoto,
  fetchCancellationPolicy,
  fetchService,
  fetchServicePhotos,
  providerKeys,
  reorderServicePhotos,
  updateCancellationPolicy,
} from './providerApi';
import { useProviderServiceIds, useProviderServicesStore } from './providerServices';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { StateView, SkeletonCard, Spinner } from '@/components/common/StateView';
import { useToast } from '@/components/ui/Toast';
import { money, formatDateShort } from '@/lib/formatters';
import { SERVICE_TYPE_LABELS } from '@/lib/constants';
import type { ServiceDetail } from '@/types/api';
import type { ServicePhoto } from './providerApi';
import type { ServicesStatus } from '@/types/models';
import { clsx } from 'clsx';

/**
 * Anuncios (FR-011.7) — manage the provider's published listings.
 *
 * The list is driven by GET /services/me (backend source of truth, via
 * `useProviderServiceIds`); details come from GET /services/:id. The edit
 * dialog manages photos (add via upload → relocate → POST /services/:id/photos,
 * remove via DELETE, reorder via PUT .../reorder) and the provider's
 * cancellation policy (GET/PUT /users/me/cancellation-policy).
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
  const { ids: knownIds } = useProviderServiceIds();
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
      void queryClient.invalidateQueries({ queryKey: providerKeys.myServices() });
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

      {/* Editar anuncio (datos + fotos) */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent title={editing ? `Editar — ${editing.title}` : 'Editar anuncio'} className="max-w-2xl">
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
              <PhotoManager serviceId={editing.id} />
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

      {/* Política de cancelación */}
      <CancellationPolicyCard />
    </div>
  );
}

/**
 * Photo management (FR-011.7): lists ALL photos of the own service (any
 * moderation status) and lets the owner add (upload → relocate → POST),
 * remove (DELETE) and reorder (PUT /photos/reorder, move one slot at a time).
 */
function PhotoManager({ serviceId }: { serviceId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const photosQ = useQuery({
    queryKey: providerKeys.photos(serviceId),
    queryFn: () => fetchServicePhotos(serviceId),
  });
  const photos: ServicePhoto[] = photosQ.data ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: providerKeys.photos(serviceId) });
    void queryClient.invalidateQueries({ queryKey: providerKeys.detail(serviceId) });
  };

  const addQ = useMutation({
    mutationFn: async (file: File) => {
      // Upload to the pre-creation bucket, then relocate to the real service
      // id so the persisted url is a RAW path (work-unit C TTL fix).
      const { url } = await uploadFile(file, 'services', 0);
      const { path } = await relocateUpload(url, 'services', serviceId);
      const nextPosition = photos.reduce((max, p) => Math.max(max, p.position), -1) + 1;
      return addServicePhoto(serviceId, path, nextPosition);
    },
    onSuccess: () => {
      toast('Foto agregada.');
      invalidate();
    },
    onError: (e) => toast('No se pudo agregar la foto.', String(e), 'error'),
  });

  const removeQ = useMutation({
    mutationFn: (photoId: number) => deleteServicePhoto(serviceId, photoId),
    onSuccess: () => {
      toast('Foto eliminada.');
      invalidate();
    },
    onError: (e) => toast('No se pudo eliminar la foto.', String(e), 'error'),
  });

  const reorderQ = useMutation<
    Array<{ id: number; position: number }> | null,
    unknown,
    { photoId: number; dir: -1 | 1 }
  >({
    mutationFn: async ({ photoId, dir }) => {
      const ids = photos.map((p) => p.id);
      const index = ids.indexOf(photoId);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= ids.length) return null;
      [ids[index], ids[target]] = [ids[target], ids[index]];
      return reorderServicePhotos(serviceId, ids);
    },
    onSuccess: (result) => {
      if (result) {
        toast('Orden actualizado.');
        invalidate();
      }
    },
    onError: (e) => toast('No se pudo reordenar.', String(e), 'error'),
  });

  return (
    <div className="rounded-lg bg-surface-container-low p-md">
      <div className="mb-sm flex items-center justify-between">
        <p className="font-label-md text-label-md text-on-surface">Fotos ({photos.length})</p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-outline-variant px-md py-sm font-label-sm text-label-sm text-primary transition-colors hover:bg-primary-fixed/20">
          <Icon name="upload" size={16} />
          {addQ.isPending ? 'Subiendo…' : 'Subir foto'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={addQ.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) addQ.mutate(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {photosQ.isLoading ? <Spinner /> : null}

      {!photosQ.isLoading && photos.length === 0 ? (
        <p className="py-lg text-center font-body-md text-body-md text-sm text-on-surface-variant">
          Sin fotos. Sube la primera para armar la galería del anuncio.
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-sm md:grid-cols-4">
        {photos.map((p, i) => (
          <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-outline-variant">
            <img src={p.url} alt="Foto del servicio" className="h-full w-full object-cover" />
            {p.status !== 'aprobada' ? (
              <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 font-label-sm text-[10px] text-white">
                {p.status === 'pendiente_moderacion' ? 'En moderación' : p.status}
              </span>
            ) : null}
            <div
              className={clsx(
                'absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100',
              )}
            >
              <button
                type="button"
                disabled={i === 0}
                onClick={() => reorderQ.mutate({ photoId: p.id, dir: -1 })}
                aria-label="Mover a la izquierda"
                className="rounded-full p-1 text-white hover:bg-white/20 disabled:opacity-30"
              >
                <Icon name="chevron_left" size={16} />
              </button>
              <button
                type="button"
                onClick={() => removeQ.mutate(p.id)}
                aria-label="Eliminar foto"
                className="rounded-full bg-error p-1 text-on-error hover:scale-105 transition-transform"
              >
                <Icon name="delete" size={14} />
              </button>
              <button
                type="button"
                disabled={i === photos.length - 1}
                onClick={() => reorderQ.mutate({ photoId: p.id, dir: 1 })}
                aria-label="Mover a la derecha"
                className="rounded-full p-1 text-white hover:bg-white/20 disabled:opacity-30"
              >
                <Icon name="chevron_right" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-sm font-label-sm text-label-sm text-on-surface-variant">
        Toca las imágenes para reordenar (◀ ▶) o eliminar. Las fotos nuevas entran a moderación antes
        de publicarse.
      </p>
    </div>
  );
}

/**
 * Provider cancellation policy editor (FR-011.7): GET /users/me/cancellation-policy
 * (auto-created with defaults on first read) and PUT to save the provider's
 * per-account terms (retention %, penalty-free window, deposit refundable).
 */
function CancellationPolicyCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const policyQ = useQuery({
    queryKey: providerKeys.cancellationPolicy(),
    queryFn: fetchCancellationPolicy,
  });
  const policy = policyQ.data;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ retention_percent: number; penalty_free_window_days: number; deposit_refundable: boolean }>({
    retention_percent: 50,
    penalty_free_window_days: 30,
    deposit_refundable: true,
  });

  useEffect(() => {
    if (policy) {
      setForm({
        retention_percent: policy.retention_percent,
        penalty_free_window_days: policy.penalty_free_window_days,
        deposit_refundable: policy.deposit_refundable,
      });
    }
  }, [policy]);

  const saveQ = useMutation({
    mutationFn: () =>
      updateCancellationPolicy({
        retention_percent: form.retention_percent,
        penalty_free_window_days: form.penalty_free_window_days,
        deposit_refundable: form.deposit_refundable,
      }),
    onSuccess: () => {
      toast('Política de cancelación actualizada.');
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: providerKeys.cancellationPolicy() });
    },
    onError: (e) => toast('No se pudo guardar la política.', String(e), 'error'),
  });

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-md">
          <div className="flex items-start justify-between gap-md">
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface">Política de cancelación</h3>
              <p className="mt-xs font-body-md text-body-md text-sm text-on-surface-variant">
                Aplica a tus servicios y a las reservas cercanas a la fecha del evento.
              </p>
            </div>
            <Button variant="outline" onClick={() => setOpen(true)} disabled={!policy}>
              <Icon name="edit" size={16} /> Editar
            </Button>
          </div>
          {policyQ.isLoading ? (
            <Spinner />
          ) : policy ? (
            <div className="grid grid-cols-1 gap-sm md:grid-cols-3">
              <div className="rounded-lg bg-surface-container-low px-md py-sm">
                <p className="font-label-sm text-label-sm text-on-surface-variant">Retención</p>
                <p className="font-headline-md text-[20px] text-primary">{policy.retention_percent}%</p>
              </div>
              <div className="rounded-lg bg-surface-container-low px-md py-sm">
                <p className="font-label-sm text-label-sm text-on-surface-variant">Ventana sin penalización</p>
                <p className="font-headline-md text-[20px] text-primary">{policy.penalty_free_window_days} días</p>
              </div>
              <div className="rounded-lg bg-surface-container-low px-md py-sm">
                <p className="font-label-sm text-label-sm text-on-surface-variant">Depósito reembolsable</p>
                <p className="font-headline-md text-[20px] text-primary">
                  {policy.deposit_refundable ? 'Sí' : 'No'}
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Política de cancelación">
          <div className="flex flex-col gap-md">
            <div>
              <label htmlFor="policy-retention" className="mb-sm block font-label-md text-label-md text-on-surface">
                Retención por cancelación cercana: <strong className="text-primary">{form.retention_percent}%</strong>
              </label>
              <input
                id="policy-retention"
                type="range"
                min={0}
                max={100}
                step={1}
                value={form.retention_percent}
                onChange={(e) => setForm((f) => ({ ...f, retention_percent: Number(e.target.value) }))}
                className="w-full"
                style={{ accentColor: '#000666' }}
              />
              <div className="mt-xs flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                <span>0% (reembolso total)</span>
                <span>100% (sin reembolso)</span>
              </div>
            </div>
            <Input
              label="Ventana sin penalización (días, 1–90)"
              type="number"
              min={1}
              max={90}
              value={String(form.penalty_free_window_days)}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setForm((f) => ({ ...f, penalty_free_window_days: Math.min(90, Math.max(1, v)) }));
              }}
            />
            <label className="flex w-fit cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.deposit_refundable}
                onChange={(e) => setForm((f) => ({ ...f, deposit_refundable: e.target.checked }))}
                className="h-5 w-5 rounded border border-outline-variant accent-primary"
              />
              <span className="font-body-md text-body-md text-on-surface">Depósito de garantía reembolsable</span>
            </label>
            <p className="rounded-lg bg-surface-container-low p-md font-label-sm text-label-sm text-on-surface-variant">
              La ventana define a partir de cuándo una cancelación cuenta como <em>cercana</em> (aplica la
              retención). El reembolso del anticipo se calcula 100% − retención.
            </p>
            <div className="mt-md flex justify-end gap-sm">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveQ.mutate()} loading={saveQ.isPending}>
                <Icon name="save" size={16} /> Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
