import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { homeForRole } from '@/components/routing/ProtectedRoute';
import { apiPost, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Icon } from '@/components/ui/Icon';
import { AuthShell } from './AuthShell';
import type { AuthResult } from '@/types/api';
import type { UserRole, UserSegment } from '@/types/models';

/**
 * Register (BR-002.7, UR-003.1) with role + segment selection and explicit
 * privacy consent (BR-012 / LFPDPPP) captured at data collection.
 */
export default function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('usuario');
  const [segment, setSegment] = useState<UserSegment>('particular');
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!acceptPrivacy) {
      setError('Debes aceptar el aviso de privacidad para continuar.');
      return;
    }
    setLoading(true);
    try {
      const result = await apiPost<AuthResult>('/auth/register', {
        full_name: fullName,
        email,
        phone,
        password,
        role,
        segment,
        accept_privacy_policy: true,
      });
      setSession(result);
      navigate(homeForRole(result.user.role), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo crear la cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Crear cuenta" subtitle="Únete a FiestaExpert para encontrar y ofrecer servicios para eventos.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-md">
        <Input
          label="Nombre completo"
          required
          minLength={2}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Juan Pérez"
          leading={<Icon name="person" size={20} />}
        />
        <Input
          label="Correo electrónico"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          leading={<Icon name="mail" size={20} />}
        />
        <Input
          label="Teléfono"
          type="tel"
          required
          minLength={7}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+52 55 1234 5678"
          leading={<Icon name="phone" size={20} />}
        />
        <Input
          label="Contraseña"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          leading={<Icon name="lock" size={20} />}
        />

        <div>
          <span className="mb-2 block font-label-md text-label-md text-on-surface">Quiero participar como</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole('usuario')}
              className={`flex-1 rounded-full px-4 py-2 font-label-md transition-all ${role === 'usuario' ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant text-on-surface-variant bg-surface-container-lowest'}`}
            >
              Cliente
            </button>
            <button
              type="button"
              onClick={() => setRole('prestador')}
              className={`flex-1 rounded-full px-4 py-2 font-label-md transition-all ${role === 'prestador' ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant text-on-surface-variant bg-surface-container-lowest'}`}
            >
              Proveedor
            </button>
          </div>
          {role === 'prestador' ? (
            <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant">
              Como proveedor crearás una lista de servicios que requerirá verificación de identidad.
            </p>
          ) : null}
        </div>

        <div>
          <span className="mb-2 block font-label-md text-label-md text-on-surface">Segmento</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSegment('particular')}
              className={`flex-1 rounded-full px-4 py-2 font-label-md transition-all ${segment === 'particular' ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant text-on-surface-variant bg-surface-container-lowest'}`}
            >
              Particular
            </button>
            <button
              type="button"
              onClick={() => setSegment('empresa')}
              className={`flex-1 rounded-full px-4 py-2 font-label-md transition-all ${segment === 'empresa' ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant text-on-surface-variant bg-surface-container-lowest'}`}
            >
              Empresa
            </button>
          </div>
        </div>

        <Checkbox
          id="register-privacy"
          checked={acceptPrivacy}
          onCheckedChange={setAcceptPrivacy}
          label={
            <span>
              Acepto el <span className="text-primary font-semibold">aviso de privacidad</span> y el tratamiento de mis datos
              conforme a la LFPDPPP.
            </span>
          }
        />

        {error ? (
          <p className="font-label-sm text-label-sm text-error font-semibold" data-state="invalid">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" loading={loading}>
          Crear cuenta
        </Button>
      </form>
      <p className="mt-lg text-center font-body-md text-body-md text-on-surface-variant">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="text-primary font-semibold hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}
