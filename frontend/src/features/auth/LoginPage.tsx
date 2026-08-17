import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { homeForRole } from '@/components/routing/ProtectedRoute';
import { apiPost, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthShell } from './AuthShell';
import { Icon } from '@/components/ui/Icon';
import type { AuthResult } from '@/types/api';

/**
 * Login (UR-003 / FR-013). POST /auth/login → store session → role home.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiPost<AuthResult>('/auth/login', { email, password });
      setSession(result);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/') ? from : homeForRole(result.user.role), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No se pudo iniciar sesión. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Iniciar sesión" subtitle="Accede a tu cuenta de FiestaExpert">
      <form onSubmit={handleSubmit} className="flex flex-col gap-md">
        <Input
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          leading={<Icon name="mail" size={20} />}
        />
        <Input
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          leading={<Icon name="lock" size={20} />}
        />
        {error ? (
          <p className="font-label-sm text-label-sm text-error font-semibold" data-state="invalid">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" loading={loading}>
          Entrar
        </Button>
      </form>
      <p className="mt-lg text-center font-body-md text-body-md text-on-surface-variant">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="text-primary font-semibold hover:underline">
          Regístrate
        </Link>
      </p>
    </AuthShell>
  );
}
