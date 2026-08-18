import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/common/StateView';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import type { KycBody, VerificationResult } from '@/types/api';

/**
 * KYC verification flow (FR-010.1–FR-010.4) — consent → capture → result.
 *
 * Wires to POST /users/verify-kyc (backend verification.service): the INE
 * data (CURP / clave de elector / nombre) is used in-flight only and is
 * never persisted client-side (BR-010.6) — it lives only in this hook's
 * local state for the single request.
 *
 * On success the authStore user is updated to `verified: true` so the
 * provider badge shows everywhere.
 */
type Phase = 'consent' | 'capture' | 'result';

export default function VerificationFlow() {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [phase, setPhase] = useState<Phase>(user?.verified ? 'result' : 'consent');
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState<KycBody>({ curp: '', clave_elector: '', nombre_completo: '' });
  const [result, setResult] = useState<VerificationResult | null>(null);

  const run = useMutation({
    mutationFn: (body: KycBody) => apiPost<VerificationResult>('/users/verify-kyc', body),
    onSuccess: (r) => {
      setResult(r);
      setPhase('result');
      if (r.user_verified) {
        updateUser({ verified: true });
        toast('¡Identidad verificada!', 'Tu badge de proveedor verificado ya está activo.');
      } else {
        toast('La verificación no concluyó.', 'Consulta el motivo e intenta de nuevo.', 'warning');
      }
    },
    onError: (e) => {
      toast('No pudimos completar la verificación.', String(e), 'error');
    },
  });

  const start = () => {
    if (!consent) {
      toast('Debes aceptar el consentimiento para continuar.');
      return;
    }
    setPhase('capture');
  };

  const submit = () => {
    const curp = form.curp.trim().toUpperCase();
    const clave = form.clave_elector.trim().toUpperCase();
    const nombre = form.nombre_completo.trim();
    if (curp.length < 15 || curp.length > 18) {
      toast('Ingresa un CURP válido (15–18 caracteres).');
      return;
    }
    if (clave.length < 5) {
      toast('Ingresa la clave de elector.');
      return;
    }
    if (nombre.length < 2) {
      toast('Ingresa tu nombre completo.');
      return;
    }
    run.mutate({ curp, clave_elector: clave, nombre_completo: nombre });
  };

  const retry = () => {
    setResult(null);
    setPhase('capture');
  };

  const back = () => {
    setResult(null);
    setPhase('consent');
  };

  return (
    <div className="flex flex-col gap-xxl">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Verificación de identidad
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">
            Completa la verificación KYC para publicar servicios en el marketplace (BR-010).
          </p>
        </div>
        {user?.verified ? (
          <Badge variant="success">
            <Icon name="verified" filled size={16} /> Verificado
          </Badge>
        ) : (
          <Badge variant="outline">
            <Icon name="pending" size={16} /> Pendiente
          </Badge>
        )}
      </section>

      <Card>
        <CardContent className="flex flex-col gap-lg">
          {/* Estado ya verificado */}
          {phase === 'result' && user?.verified && !result ? (
            <div className="flex flex-col items-center gap-md py-xl text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-fixed text-primary">
                <Icon name="verified" filled size={44} />
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface">Ya estás verificado</h3>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                Tu identidad fue verificada con éxito y ya puedes publicar servicios.
              </p>
              <Button asChild variant="outline">
                <Link to="/provider">Volver al panel</Link>
              </Button>
            </div>
          ) : null}

          {/* Paso 1 — consentimiento (BR-010.1) */}
          {phase === 'consent' ? (
            <div className="flex flex-col gap-md">
              <h3 className="font-headline-md text-headline-md text-on-surface">
                Paso 1 · Consentimiento
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Para verificar tu identidad enviaremos tus datos (CURP, clave de elector y nombre)
                al proveedor de verificación <strong>Verificamex</strong>. Tus datos se usan
                únicamente para este trámite y no quedan almacenados en la plataforma (BR-010.6).
              </p>
              <div className="rounded-lg bg-surface-container-low p-md">
                <Checkbox
                  id="kyc-consent"
                  checked={consent}
                  onCheckedChange={setConsent}
                  label="Acepto que mis datos sean enviados a Verificamex para la verificación de identidad."
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={start}>Comenzar verificación</Button>
              </div>
            </div>
          ) : null}

          {/* Paso 2 — captura (BR-010.4) */}
          {phase === 'capture' ? (
            <div className="flex flex-col gap-md">
              <h3 className="font-headline-md text-headline-md text-on-surface">
                Paso 2 · Datos de tu INE
              </h3>
              <p className="font-body-md text-body-md text-sm text-on-surface-variant">
                Los datos se envían cifrados en la solicitud y no se guardan en tus archivos ni en
                los registros de la plataforma.
              </p>
              <Input
                label="CURP"
                value={form.curp}
                maxLength={18}
                onChange={(e) => setForm({ ...form, curp: e.target.value })}
                placeholder="15–18 caracteres"
                hint="Lo encontrarás al reverso de tu credencial."
              />
              <Input
                label="Clave de elector"
                value={form.clave_elector}
                maxLength={20}
                onChange={(e) => setForm({ ...form, clave_elector: e.target.value })}
                placeholder="Clave que aparece en tu INE"
              />
              <Input
                label="Nombre completo (tal como aparece en la credencial)"
                value={form.nombre_completo}
                onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
                placeholder="Ej. JUAN PÉREZ LÓPEZ"
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={back}>
                  Volver
                </Button>
                <Button onClick={submit} loading={run.isPending}>
                  <Icon name="verified_user" size={18} /> Verificar identidad
                </Button>
              </div>
              {run.isPending ? (
                <p className="flex items-center gap-sm font-label-sm text-label-sm text-on-surface-variant">
                  <Spinner /> Consultando con Verificamex…
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Paso 3 — resultado (BR-010.7) */}
          {phase === 'result' && result ? (
            <div className="flex flex-col items-center gap-md py-xl text-center">
              <span
                className={`flex h-20 w-20 items-center justify-center rounded-full ${
                  result.user_verified
                    ? 'bg-primary-fixed text-primary'
                    : 'bg-error-container text-error'
                }`}
              >
                <Icon name={result.user_verified ? 'verified' : 'error'} filled size={44} />
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface">
                {result.user_verified ? 'Verificado' : 'No pudimos verificar tu identidad'}
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                {result.user_verified
                  ? 'Tu badge de proveedor verificado está activo (vía Verificamex).'
                  : `Motivo: ${result.motivo ?? 'datos_no_coinciden'}. Puedes volver a intentarlo.`}
              </p>
              {!result.user_verified ? (
                <div className="flex gap-sm">
                  <Button onClick={retry}>Reintentar</Button>
                  <Button variant="outline" asChild>
                    <Link to="/provider">Volver al panel</Link>
                  </Button>
                </div>
              ) : (
                <Button asChild>
                  <Link to="/provider">Ir al panel</Link>
                </Button>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
