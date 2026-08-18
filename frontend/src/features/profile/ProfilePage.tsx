import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { apiPost, apiPut, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/common/StateView';
import { APP_NAME } from '@/lib/constants';
import { arcoKeys, ARCO_STATUS_LABELS, ARCO_TIPO_LABELS, createArcoRequest, fetchArcoRequests } from './profileApi';
import { formatDateShort } from '@/lib/formatters';
import type { MeResponse } from '@/types/api';
import type { SafeUser } from '@/types/models';
import type { ArcoRequestTipo } from '@/types/models';

const CONSENT_KEY = 'fiestaexpert-consent';
const COOKIE_KEY = 'fiestaexpert-cookie';

/**
 * Profile (FR-016 + profile actions): edit profile, identity badge, ARCO
 * rights form (servers-backed — POST/GET /users/arco-requests, BR-012 /
 * FR-016.2), notification center access, logout, and first-use privacy
 * consent + cookie banner (FR-016.1 / FR-016.6).
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);

  const [editOpen, setEditOpen] = useState(false);
  const [arcoOpen, setArcoOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(CONSENT_KEY);
  });
  const [cookieOpen, setCookieOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    // privacy accepted on a previous visit, but no cookie choice yet
    return Boolean(localStorage.getItem(CONSENT_KEY) && !localStorage.getItem(COOKIE_KEY));
  });

  // Edit profile form
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

  // ARCO form (server-backed, BR-012 / FR-016.2)
  const [arcoDerecho, setArcoDerecho] = useState<ArcoRequestTipo>('acceso');
  const [arcoSaving, setArcoSaving] = useState(false);
  const [arcoError, setArcoError] = useState<string | null>(null);
  const arcoQuery = useQuery({
    queryKey: arcoKeys.list,
    queryFn: fetchArcoRequests,
    enabled: arcoOpen,
  });
  const arcoRequests = arcoQuery.data ?? [];

  if (!user) return null;

  async function handleSaveProfile() {
    setSaving(true);
    try {
      const result = await apiPut<MeResponse>('/users/me', { full_name: fullName, phone });
      setSession({ user: result.user as SafeUser, tokens: { accessToken: useAuthStore.getState().accessToken ?? '', refreshToken: useAuthStore.getState().refreshToken ?? '' } });
      setEditOpen(false);
      toast('Perfil actualizado.', undefined, 'success');
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'No se pudo actualizar.', undefined, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleArcoSubmit() {
    setArcoError(null);
    setArcoSaving(true);
    try {
      const created = await createArcoRequest(arcoDerecho);
      const deadline = created.deadline_at
        ? ` Te contactaremos a más tardar el ${formatDateShort(created.deadline_at)}.`
        : '';
      toast(
        `Solicitud ARCO (${ARCO_TIPO_LABELS[arcoDerecho]}) registrada.${deadline}`,
        undefined,
        'success',
      );
      void queryClient.invalidateQueries({ queryKey: arcoKeys.list });
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'No se pudo registrar la solicitud.';
      setArcoError(msg);
    } finally {
      setArcoSaving(false);
    }
  }

  function acceptConsent() {
    localStorage.setItem(CONSENT_KEY, String(Date.now()));
    setConsentOpen(false);
    if (!localStorage.getItem(COOKIE_KEY)) setCookieOpen(true);
  }

  function setCookiePref(pref: string) {
    localStorage.setItem(COOKIE_KEY, pref);
    setCookieOpen(false);
    toast(pref === 'aceptadas' ? 'Preferencias de cookies guardadas.' : 'Se usarán solo cookies necesarias.', undefined, 'success');
  }

  async function handleLogout() {
    try {
      const token = useAuthStore.getState().refreshToken;
      if (token) await apiPost('/auth/logout', { refresh_token: token });
    } catch {
      /* best-effort revocation */
    } finally {
      logout();
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="mx-auto max-w-[1280px] py-xl">
      {/* Privacy consent (first visit) */}
      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent title={`Aviso de privacidad — ${APP_NAME}`} hideClose>
          <div className="space-y-2 font-body-md text-body-md text-on-surface-variant">
            <p>
              {APP_NAME} trata tus datos personales conforme a la Ley Federal de Protección de Datos Personales en
              Posesión de los Particulares (LFPDPPP). Tus datos se utilizan para gestionar reservas, mensajes y pagos
              de la plataforma.
            </p>
            <p>
              Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición (ARCO) desde tu perfil en
              cualquier momento.
            </p>
          </div>
          <div className="mt-md flex justify-end">
            <Button onClick={acceptConsent}>Aceptar y continuar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cookie banner */}
      {cookieOpen ? (
        <div className="fixed bottom-24 left-1/2 z-[75] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-lg md:bottom-6">
          <div className="flex items-start gap-md sm:items-center">
            <Icon name="cookie" size={28} className="shrink-0 text-primary" />
            <div className="flex-1">
              <p className="font-label-md text-label-md font-semibold text-on-surface">Usamos cookies</p>
              <p className="font-body-md text-body-md text-sm text-on-surface-variant">
                Para mejorar tu experiencia y recordar tus preferencias.
              </p>
            </div>
            <div className="flex shrink-0 gap-sm">
              <Button variant="outline" size="sm" onClick={() => setCookiePref('necesarias')}>
                Solo necesarias
              </Button>
              <Button size="sm" onClick={() => setCookiePref('aceptadas')}>
                Aceptar todas
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Header */}
      <section className="mb-xxl flex flex-col items-center gap-6 rounded-xl border border-surface-container-highest bg-surface-container-lowest p-lg shadow-sm md:flex-row md:items-start md:gap-10">
        <Avatar name={user.full_name} src={user.avatar_url} size={128} className="!text-4xl border-4 border-surface-container shadow-md" />
        <div className="flex flex-1 flex-col items-center text-center md:items-start md:text-left">
          <div className="mb-2 flex flex-col items-center gap-2 md:flex-row md:items-center md:gap-4">
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              {user.full_name}
            </h2>
            {user.verified ? (
              <Badge variant="secondary">
                <Icon name="verified" filled size={16} /> Identidad Verificada
              </Badge>
            ) : (
              <Badge variant="outline">Verificación pendiente</Badge>
            )}
          </div>
          <p className="mb-1 flex items-center gap-2 font-body-md text-body-md text-on-surface-variant">
            <Icon name="mail" size={18} /> {user.email}
          </p>
          <p className="flex items-center gap-2 font-body-md text-body-md text-on-surface-variant">
            <Icon name="phone" size={18} /> {user.phone}
          </p>
          <div className="mt-4 flex gap-2">
            <Badge variant="default">{user.segment === 'empresa' ? 'Empresa' : 'Particular'}</Badge>
            <Badge variant="outline">{user.role === 'prestador' ? 'Proveedor' : user.role === 'administrador' ? 'Administrador' : 'Cliente'}</Badge>
          </div>
        </div>
      </section>

      {/* Action list */}
      <section className="overflow-hidden rounded-xl border border-surface-container-highest bg-surface-container-lowest shadow-sm">
        <ul className="divide-y divide-surface-container-highest">
          <ProfileAction icon="person_edit" title="Editar Perfil" onClick={() => setEditOpen(true)} />
          <ProfileAction icon="shield" title="Verificación de Identidad" subtitle={user.verified ? 'Estado: Verificada' : 'Estado: Pendiente'} onClick={() => toast('La verificación de identidad se habilitará en la siguiente versión.', undefined, 'warning')} />
          <ProfileAction icon="privacy_tip" title="Derechos ARCO" subtitle="Acceso, rectificación, cancelación y oposición" onClick={() => setArcoOpen(true)} />
          <li>
            <Link to="/notifications" className="flex w-full items-center justify-between p-md text-left hover:bg-surface-container-low transition-colors md:p-lg">
              <div className="flex items-center gap-4">
                <IconContainer>
                  <Icon name="notifications" size={22} />
                </IconContainer>
                <span className="font-body-lg text-body-lg font-medium text-on-surface">Centro de Notificaciones</span>
              </div>
              <Icon name="chevron_right" size={22} className="text-on-surface-variant" />
            </Link>
          </li>
          <ProfileAction icon="help_center" title="Centro de Ayuda" onClick={() => toast('El centro de ayuda estará disponible próximamente.', undefined, 'warning')} />
          <li>
            <button onClick={handleLogout} className="flex w-full items-center justify-between p-md text-left hover:bg-error-container transition-colors md:p-lg">
              <div className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-error-container text-on-error-container">
                  <Icon name="logout" size={22} />
                </span>
                <span className="font-body-lg text-body-lg font-medium text-error">Cerrar Sesión</span>
              </div>
            </button>
          </li>
        </ul>
      </section>

      {/* Edit profile dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent title="Editar Perfil">
          <div className="flex flex-col gap-md">
            <Input label="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveProfile} loading={saving}>Guardar cambios</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ARCO dialog */}
      <Dialog open={arcoOpen} onOpenChange={setArcoOpen}>
        <DialogContent title="Derechos ARCO" className="max-w-xl">
          <div className="flex flex-col gap-md">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Ejerce tus derechos de acceso, rectificación, cancelación u oposición sobre tus datos personales conforme
              a la LFPDPPP. Tu solicitud queda registrada y atendemos en un plazo máximo de 20 días hábiles.
            </p>
            <label className="block font-label-md text-label-md text-on-surface">Derecho a ejercer</label>
            <Select
              value={arcoDerecho}
              onValueChange={(v) => setArcoDerecho(v as ArcoRequestTipo)}
              options={(Object.keys(ARCO_TIPO_LABELS) as ArcoRequestTipo[]).map((value) => ({
                value,
                label: ARCO_TIPO_LABELS[value],
              }))}
            />
            {arcoError ? (
              <p className="font-label-sm text-label-sm text-error font-semibold">{arcoError}</p>
            ) : null}
            <Button size="lg" onClick={() => void handleArcoSubmit()} loading={arcoSaving}>
              Enviar solicitud
            </Button>

            <div className="mt-xs border-t border-outline-variant pt-md">
              <h4 className="mb-sm font-label-md text-label-md text-on-surface">Mis solicitudes</h4>
              {arcoQuery.isLoading ? (
                <Spinner />
              ) : arcoRequests.length === 0 ? (
                <p className="font-body-md text-body-md text-sm text-on-surface-variant">
                  Aún no has enviado solicitudes ARCO.
                </p>
              ) : (
                <ul className="flex flex-col gap-sm">
                  {arcoRequests.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-sm rounded-lg bg-surface-container-low px-md py-sm"
                    >
                      <div>
                        <p className="font-body-md text-body-md text-on-surface font-semibold">
                          {ARCO_TIPO_LABELS[r.tipo]}
                        </p>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">
                          Enviada {formatDateShort(r.requested_at)} ·
                          plazo {r.deadline_at ? formatDateShort(r.deadline_at) : '—'}
                        </p>
                      </div>
                      <Badge variant={r.status === 'completado' ? 'success' : 'outline'}>
                        {ARCO_STATUS_LABELS[r.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IconContainer({ children }: { children: React.ReactNode }) {
  return <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-highest text-on-surface-variant">{children}</span>;
}

function ProfileAction({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center justify-between p-md text-left hover:bg-surface-container-low transition-colors md:p-lg">
        <div className="flex items-center gap-4">
          <IconContainer>
            <Icon name={icon} size={22} />
          </IconContainer>
          <div className="flex flex-col">
            <span className="font-body-lg text-body-lg font-medium text-on-surface">{title}</span>
            {subtitle ? <span className="font-label-sm text-label-sm text-on-surface-variant">{subtitle}</span> : null}
          </div>
        </div>
        <Icon name="chevron_right" size={22} className="text-on-surface-variant" />
      </button>
    </li>
  );
}
