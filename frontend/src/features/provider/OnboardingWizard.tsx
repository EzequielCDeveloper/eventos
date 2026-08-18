import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { apiPost, apiPut, uploadFile } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/common/StateView';
import { useToast } from '@/components/ui/Toast';
import { useProviderServicesStore } from './providerServices';
import type { ServiceType, ServicesApprovalMode } from '@/types/models';

/**
 * Onboarding wizard — 3 steps (FR-011.1–FR-011.4, FR-002.3–FR-002.4).
 *
 * Step 1 · tipo de servicio / ubicación / capacidad
 * Step 2 · fotos (mínimo 5) / título / descripción
 * Step 3 · tarifas / políticas / cancelación / depósito
 *
 * Every field auto-saves to localStorage (`fiestaexpert-onboarding`) so the
 * provider resumes exactly where they left off after closing the app
 * (FR-002.4). On publish it calls the real POST /services aggregate (with
 * pricing by service_type) and, optionally, PUT /services/:id →
 * `pendiente_verificacion` (the publish gate stays in `publicado`).
 */
const STORAGE_KEY = 'fiestaexpert-onboarding';
const MIN_PHOTOS = 5;

export type WizardPaso = 1 | 2 | 3;

export interface OnboardingDraft {
  paso: WizardPaso;
  tipo: ServiceType | null;
  ubicacion: string;
  latitud: string;
  longitud: string;
  cobertura: string;
  capacidad: string;
  fotos: string[];
  titulo: string;
  descripcion: string;
  precio: string;
  extraHora: string;
  bloqueHoras: string;
  deposito: string;
  retencion: string;
  ventana: string;
  aprobacion: ServicesApprovalMode;
}

const EMPTY: OnboardingDraft = {
  paso: 1,
  tipo: null,
  ubicacion: '',
  latitud: '',
  longitud: '',
  cobertura: '',
  capacidad: '',
  fotos: [],
  titulo: '',
  descripcion: '',
  precio: '',
  extraHora: '',
  bloqueHoras: '',
  deposito: '',
  retencion: '50',
  ventana: '30',
  aprobacion: 'manual',
};

function loadDraft(): OnboardingDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<OnboardingDraft>) };
  } catch {
    return { ...EMPTY };
  }
}

const STEPS = [
  { n: 1, label: 'Tipo y ubicación' },
  { n: 2, label: 'Fotos y descripción' },
  { n: 3, label: 'Tarifas y políticas' },
];

const TYPE_META: Record<
  ServiceType,
  { label: string; icon: string; help: string; capHint: string }
> = {
  salon: {
    label: 'Salón',
    icon: 'meeting_room',
    help: 'Salón: capacidad concurrente forzada a 1 evento por slot.',
    capHint: 'Salón forzado a 1 evento por slot.',
  },
  sonido: {
    label: 'Sonido',
    icon: 'speaker',
    help: 'Sonido: capacidad concurrente configurable (default 2).',
    capHint: 'Número de servicios concurrentes por slot.',
  },
  servicio_persona: {
    label: 'Servicio',
    icon: 'person',
    help: 'Servicio: capacidad 1 (tarifa por hora o paquete).',
    capHint: 'Servicio: capacidad 1 por slot.',
  },
};

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const addProviderService = useProviderServicesStore((s) => s.add);

  const [draft, setDraft] = useState<OnboardingDraft>(loadDraft);
  const [photoUrl, setPhotoUrl] = useState('');
  const [policiesOk, setPoliciesOk] = useState(false);
  const [updatingFile, setUpdatingFile] = useState(false);
  const [published, setPublished] = useState<{ id: number } | null>(null);
  const savingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autoguardado entre pasos (FR-002.3): cada cambio persiste el borrador.
  useEffect(() => {
    if (savingRef.current) clearTimeout(savingRef.current);
    savingRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch {
        /* quota — ignore, wizard keeps working in-memory */
      }
    }, 250);
    return () => {
      if (savingRef.current) clearTimeout(savingRef.current);
    };
  }, [draft]);

  const patch = useCallback(
    (p: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...p })),
    [],
  );

  const submitService = useMutation({
    mutationFn: async () => {
      const body = buildServiceBody(draft);
      const created = await apiPost<{ id: number }>('/services', body);
      addProviderService(created.id);
      localStorage.removeItem(STORAGE_KEY);
      return created;
    },
  });

  const sendToReview = useMutation({
    mutationFn: async (id: number) => {
      await apiPut<{ id: number }>(`/services/${id}`, { status: 'pendiente_verificacion' });
      return id;
    },
  });

  const guardarPaso = useCallback(
    (n: WizardPaso): boolean => {
      if (n === 1) {
        if (!draft.tipo) {
          toast('Selecciona el tipo de servicio.');
          return false;
        }
        if (!draft.ubicacion.trim()) {
          toast('Ingresa la ubicación.');
          return false;
        }
        const cap = Number(draft.capacidad);
        if (!cap || cap < 1) {
          toast('Ingresa una capacidad válida.');
          return false;
        }
        return true;
      }
      if (n === 2) {
        if (draft.fotos.length < MIN_PHOTOS) {
          toast(`Mínimo ${MIN_PHOTOS} fotos requeridas.`);
          return false;
        }
        if (!draft.titulo.trim()) {
          toast('Ingresa el título del anuncio.');
          return false;
        }
        if (draft.descripcion.trim().length < 10) {
          toast('La descripción debe tener al menos 10 caracteres.');
          return false;
        }
        return true;
      }
      if (n === 3) {
        const precio = Number(draft.precio);
        if (!precio || precio <= 0) {
          toast('Ingresa un precio base válido.');
          return false;
        }
        if (!policiesOk) {
          toast('Debes aceptar las políticas de la plataforma.');
          return false;
        }
        return true;
      }
      return true;
    },
    [draft, policiesOk, toast],
  );

  const irA = (n: WizardPaso) => {
    setDraft((d) => ({ ...d, paso: n }));
    window.scrollTo(0, 0);
  };

  const siguiente = () => {
    if (!guardarPaso(draft.paso)) return;
    if (draft.paso === 3) {
      submitService.mutate(undefined, {
        onError: (e) => toast('No pudimos publicar el servicio.', String(e), 'error'),
      });
    } else {
      irA(((draft.paso + 1) as WizardPaso));
    }
  };

  const agregarFoto = (foto: string) => {
    const url = foto.trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      toast('Ingresa una URL válida (https://…).');
      return;
    }
    if (draft.fotos.length >= 20) {
      toast('Máximo 20 fotos por anuncio.');
      return;
    }
    patch({ fotos: [...draft.fotos, url] });
    setPhotoUrl('');
  };

  const agregarArchivo = async (file: File) => {
    setUpdatingFile(true);
    try {
      const { url } = await uploadFile(file, 'services');
      if (draft.fotos.length >= 20) {
        toast('Máximo 20 fotos por anuncio.');
        return;
      }
      patch({ fotos: [...draft.fotos, url] });
      toast('Foto subida correctamente.');
    } catch (e) {
      // POST /uploads is not mounted by the backend yet (S5/S7 gap) — fail
      // closed with guidance instead of a silent no-op (see S6 notes).
      toast(
        'Subida no disponible aún',
        'El endpoint de subida no está activo. Usa una URL de imagen por ahora.',
        'warning',
      );
      void e;
    } finally {
      setUpdatingFile(false);
    }
  };

  const tipoBtn = (t: ServiceType) => {
    const meta = TYPE_META[t];
    const on = draft.tipo === t;
    return (
      <button
        key={t}
        type="button"
        onClick={() => {
          patch({ tipo: t, capacidad: t === 'salon' || t === 'servicio_persona' ? '1' : draft.capacidad || '2' });
        }}
        className={`flex flex-col items-center gap-sm rounded-xl p-md transition-colors ${
          on
            ? 'border-2 border-primary bg-primary-fixed/20'
            : 'border border-outline-variant hover:border-primary'
        }`}
      >
        <Icon name={meta.icon} size={32} className="text-primary" />
        <span className="font-label-md text-label-md text-on-surface">{meta.label}</span>
        {on ? (
          <span className="flex items-center gap-1 font-label-sm text-label-sm text-primary">
            <Icon name="check_circle" size={14} filled /> Seleccionado
          </span>
        ) : null}
      </button>
    );
  };

  const isSalon = draft.tipo === 'salon';
  const isSonido = draft.tipo === 'sonido';
  const isPersona = draft.tipo === 'servicio_persona';
  const pricingFields = useMemo(() => {
    if (isSonido) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
          <Input
            label="Nombre del paquete de sonido"
            value={draft.titulo ? `${draft.titulo} — Paquete base` : ''}
            onChange={() => undefined}
            hint="Se usa el nombre de tu anuncio como paquete inicial."
          />
          <Input
            label="Precio base del paquete (MXN)"
            type="number"
            min="0"
            value={draft.precio}
            onChange={(e) => patch({ precio: e.target.value })}
            placeholder="Ej. 4500"
          />
          <Input
            label="Horas base del paquete"
            type="number"
            min="1"
            max="24"
            value={draft.bloqueHoras || '4'}
            onChange={(e) => patch({ bloqueHoras: e.target.value })}
            hint="Horas incluidas en el precio base."
          />
          <Input
            label="Precio por hora extra (MXN)"
            type="number"
            min="0"
            value={draft.extraHora}
            onChange={(e) => patch({ extraHora: e.target.value })}
            placeholder="Ej. 800"
          />
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
        <Input
          label={isPersona ? 'Precio por persona por hora (MXN)' : 'Precio base por bloque (MXN)'}
          type="number"
          min="0"
          value={draft.precio}
          onChange={(e) => patch({ precio: e.target.value })}
          placeholder={isPersona ? 'Ej. 350' : 'Ej. 8000'}
        />
        {!isPersona ? (
          <>
            <Input
              label="Horas del bloque base"
              type="number"
              min="1"
              max="24"
              value={draft.bloqueHoras || '4'}
              onChange={(e) => patch({ bloqueHoras: e.target.value })}
              hint="Ej. 4 (bloque de 4 horas)."
            />
            <Input
              label="Precio por hora extra (MXN)"
              type="number"
              min="0"
              value={draft.extraHora}
              onChange={(e) => patch({ extraHora: e.target.value })}
              placeholder="Ej. 1200"
            />
          </>
        ) : (
          <Input
            label="Depósito de garantía (MXN)"
            type="number"
            min="0"
            value={draft.deposito}
            onChange={(e) => patch({ deposito: e.target.value })}
            placeholder="Ej. 1000"
          />
        )}
      </div>
    );
  }, [draft, isPersona, isSonido, patch]);

  // ---- Rendering ----------------------------------------------------------

  if (published) {
    return (
      <div className="flex flex-col gap-xxl">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              ¡Servicio creado!
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">
              Tu anuncio quedó en borrador. Envíalo a revisión para que entre a la cola de
              moderación.
            </p>
          </div>
        </section>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-md py-xl text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-fixed text-primary">
              <Icon name="campaign" size={40} />
            </span>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              Anuncio #{published.id}
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
              Estado actual: <Badge variant="secondary">Borrador</Badge>. Para publicarlo en el
              marketplace tu identidad debe estar verificada (BR-010.1).
            </p>
            <div className="flex flex-wrap items-center justify-center gap-sm">
              <Button
                loading={sendToReview.isPending}
                onClick={() =>
                  sendToReview.mutate(published.id, {
                    onSuccess: () => {
                      toast('Enviado a revisión.');
                      setPublished(null);
                      setPoliciesOk(false);
                      setDraft({ ...EMPTY });
                      navigate('/provider/listings');
                    },
                    onError: (e) => toast('No se pudo enviar a revisión.', String(e), 'error'),
                  })
                }
              >
                <Icon name="send" size={18} /> Enviar a revisión
              </Button>
              <Button variant="outline" asChild>
                <Link to="/provider">Volver al panel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-xxl">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Alta de servicio
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">
            Completa los 3 pasos para publicar tu anuncio. Tus datos se guardan automáticamente.
          </p>
        </div>
        <Link
          to="/provider"
          className="font-label-md text-label-md text-primary hover:underline"
        >
          ← Volver al panel
        </Link>
      </section>

      {/* Indicador de progreso */}
      <div className="flex items-center gap-sm overflow-x-auto pb-2" role="tablist" aria-label="Progreso del alta">
        {STEPS.map((s, i) => {
          const estado = s.n < draft.paso ? 'done' : s.n === draft.paso ? 'current' : 'todo';
          return (
            <div key={s.n} className="flex items-center gap-xs shrink-0" aria-current={estado === 'current' ? 'step' : 'false'}>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full font-label-md text-label-md ${
                  estado === 'done'
                    ? 'bg-primary text-on-primary'
                    : estado === 'current'
                      ? 'bg-primary-container text-on-primary-container ring-2 ring-primary'
                      : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                <Icon name={estado === 'done' ? 'check' : 'radio_button_unchecked'} size={16} />
              </span>
              <span className={`whitespace-nowrap font-label-sm text-label-sm ${estado === 'current' ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 ? (
                <Icon name="chevron_right" size={16} className="mx-xs text-on-surface-variant/40" />
              ) : null}
            </div>
          );
        })}
      </div>

      {submitService.isError ? (
        <div
          aria-hidden="false"
          className="flex items-center gap-md rounded-xl border border-error/40 bg-error-container p-md font-body-md text-body-md text-on-error-container"
        >
          <Icon name="error" filled size={22} />
          <span>No pudimos publicar el servicio. Verifica tus datos o tu conexión.</span>
        </div>
      ) : null}

      {/* Paso 1 */}
      {draft.paso === 1 ? (
        <Card>
          <CardContent className="flex flex-col gap-lg">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-md">
              Paso 1 · Tipo de servicio, ubicación y capacidad
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-md mb-lg">
              {tipoBtn('salon')}
              {tipoBtn('sonido')}
              {tipoBtn('servicio_persona')}
            </div>
            {draft.tipo ? (
              <p className="font-body-md text-body-md text-sm text-on-surface-variant mb-lg">
                {TYPE_META[draft.tipo].help}
              </p>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              <Input
                label="Ubicación"
                value={draft.ubicacion}
                onChange={(e) => patch({ ubicacion: e.target.value })}
                placeholder="Ej. Polanco, CDMX"
              />
              <div className="grid grid-cols-2 gap-lg">
                <Input
                  label="Latitud"
                  value={draft.latitud}
                  onChange={(e) => patch({ latitud: e.target.value })}
                  placeholder="19.43"
                  hint="Opcional"
                />
                <Input
                  label="Longitud"
                  value={draft.longitud}
                  onChange={(e) => patch({ longitud: e.target.value })}
                  placeholder="-99.16"
                  hint="Opcional"
                />
              </div>
              <Input
                label="Capacidad"
                type="number"
                min="1"
                value={draft.capacidad}
                disabled={isSalon || isPersona}
                onChange={(e) => patch({ capacidad: e.target.value })}
                placeholder="Ej. 300"
                hint={draft.tipo ? TYPE_META[draft.tipo].capHint : 'Número de servicios concurrentes por slot.'}
              />
              <Input
                label="Zona de cobertura"
                value={draft.cobertura}
                onChange={(e) => patch({ cobertura: e.target.value })}
                placeholder="Ej. CDMX y zona metropolitana"
                hint="Opcional, para servicios con área de servicio."
              />
            </div>
            <div className="flex justify-end mt-lg">
              <Button onClick={siguiente} loading={false}>
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Paso 2 */}
      {draft.paso === 2 ? (
        <Card>
          <CardContent className="flex flex-col gap-lg">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-md">
              Paso 2 · Fotos, título y descripción
            </h3>
            <div>
              <label className="mb-2 block font-label-md text-label-md text-on-surface">
                Fotos del servicio{' '}
                <span className={`font-semibold ${draft.fotos.length >= MIN_PHOTOS ? 'text-primary' : 'text-error'}`}>
                  ({draft.fotos.length}/{MIN_PHOTOS})
                </span>
              </label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-sm">
                {draft.fotos.map((f) => (
                  <div
                    key={f}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-outline-variant"
                  >
                    <img src={f} alt="Foto del servicio" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label="Quitar foto"
                      onClick={() => patch({ fotos: draft.fotos.filter((x) => x !== f) })}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-col gap-sm">
                <div className="flex gap-sm">
                  <Input
                    placeholder="Pega una URL de imagen (https://…)"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="secondary" onClick={() => agregarFoto(photoUrl)}>
                    <Icon name="add_photo_alternate" size={18} /> Agregar
                  </Button>
                </div>
                <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant px-md py-sm font-label-md text-label-md text-primary transition-colors hover:bg-primary-fixed/20 md:w-auto">
                  <Icon name="upload" size={18} />
                  {updatingFile ? 'Subiendo…' : 'Subir desde archivo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={updatingFile}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void agregarArchivo(file);
                      e.target.value = '';
                    }}
                  />
                </label>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  {draft.fotos.length >= MIN_PHOTOS
                    ? '¡Listo! Mínimo cumplido.'
                    : `Mínimo ${MIN_PHOTOS} fotos requeridas.`}
                </p>
              </div>
            </div>
            <div className="mt-lg grid grid-cols-1 gap-lg">
              <Input
                label="Título del anuncio"
                value={draft.titulo}
                onChange={(e) => patch({ titulo: e.target.value })}
                placeholder="Ej. Salón Las Palmas — Fines de semana"
              />
              <Textarea
                label="Descripción"
                value={draft.descripcion}
                onChange={(e) => patch({ descripcion: e.target.value })}
                placeholder="Describe los detalles de tu oferta..."
              />
            </div>
            <div className="mt-lg flex justify-between">
              <Button variant="outline" onClick={() => irA(1)}>
                Volver
              </Button>
              <Button onClick={siguiente}>Continuar</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Paso 3 */}
      {draft.paso === 3 ? (
        <Card>
          <CardContent className="flex flex-col gap-lg">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-md">
              Paso 3 · Tarifas, políticas y cancelación
            </h3>
            {draft.tipo ? (
              <Badge variant="secondary" className="self-start">
                {TYPE_META[draft.tipo].label}
              </Badge>
            ) : null}
            {pricingFields}
            <div className="mt-lg grid grid-cols-1 md:grid-cols-2 gap-lg">
              <Input
                label="Depósito de garantía (MXN)"
                type="number"
                min="0"
                value={draft.deposito}
                onChange={(e) => patch({ deposito: e.target.value })}
                placeholder="Ej. 2000"
              />
              <Select
                value={draft.aprobacion}
                onValueChange={(v) => patch({ aprobacion: v as ServicesApprovalMode })}
                options={[
                  { value: 'manual', label: 'Manual (revisión humana)' },
                  { value: 'inmediata', label: 'Inmediata (automática)' },
                ]}
                className="mt-[26px]"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              <Input
                label="Retención por cancelación (%)"
                type="number"
                min="0"
                max="100"
                value={draft.retencion}
                onChange={(e) => patch({ retencion: e.target.value })}
                placeholder="Ej. 50"
              />
              <Input
                label="Ventana sin penalización (días)"
                type="number"
                min="0"
                value={draft.ventana}
                onChange={(e) => patch({ ventana: e.target.value })}
                placeholder="Ej. 30"
              />
            </div>
            <div className="rounded-lg bg-surface-container-low p-md">
              <Checkbox
                id="wizard-politicas-check"
                checked={policiesOk}
                onCheckedChange={setPoliciesOk}
                label="Acepto las políticas de la plataforma para publicar este servicio."
              />
            </div>
            <div className="mt-lg flex justify-between">
              <Button variant="outline" onClick={() => irA(2)}>
                Volver
              </Button>
              <Button onClick={siguiente} loading={submitService.isPending}>
                <Icon name="publish" size={18} /> Publicar servicio
              </Button>
            </div>
            {submitService.isPending ? (
              <p className="flex items-center gap-sm font-label-sm text-label-sm text-on-surface-variant">
                <Spinner /> Creando tu anuncio…
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/**
 * Build the POST /services aggregate from the persisted draft, mirroring the
 * backend createServiceSchema exactly (services.routes.ts).
 */
function buildServiceBody(draft: OnboardingDraft) {
  const base = {
    service_type: draft.tipo as ServiceType,
    title: draft.titulo.trim(),
    description: draft.descripcion.trim(),
    location_type: 'fija' as const,
    location: {
      lat: draft.latitud ? Number(draft.latitud) : 19.4326,
      lng: draft.longitud ? Number(draft.longitud) : -99.1332,
      address: draft.ubicacion.trim(),
    },
    max_capacity: Number(draft.capacidad),
    approval_mode: draft.aprobacion,
    deposit_amount: draft.deposito !== '' ? Number(draft.deposito) : undefined,
    photos:
      draft.fotos.length > 0
        ? draft.fotos.map((url, position) => ({ url, position }))
        : undefined,
  };

  if (draft.tipo === 'salon') {
    return {
      ...base,
      pricing: {
        salon: {
          base_block_hours: Number(draft.bloqueHoras || 4),
          base_block_price: Number(draft.precio),
          extra_hour_price: Number(draft.extraHora || 0),
        },
      },
    };
  }
  if (draft.tipo === 'sonido') {
    return {
      ...base,
      pricing: {
        sound_packages: [
          {
            name: `${draft.titulo.trim()} — Paquete base`,
            description: draft.descripcion.trim(),
            base_price: Number(draft.precio),
            base_hours: Number(draft.bloqueHoras || 4),
            extra_hour_price: Number(draft.extraHora || 0),
          },
        ],
      },
    };
  }
  return {
    ...base,
    pricing: {
      persona: {
        price_per_person_per_hour: Number(draft.precio),
      },
    },
  };
}
