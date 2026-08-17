import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types/models';

/**
 * Route guard (FR-017.1–FR-017.3).
 *
 * - No JWT → redirect to /login preserving the intended destination.
 * - With a `role` requirement, a wrong role → redirect to that user's home
 *   layout (403-behavior at the routing layer).
 */
export function homeForRole(role: UserRole): string {
  switch (role) {
    case 'prestador':
      return '/provider';
    case 'administrador':
      return '/admin';
    default:
      return '/';
  }
}

export function ProtectedRoute({
  role,
  children,
}: {
  role?: UserRole;
  children?: React.ReactNode;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userRole = useAuthStore((s) => s.user?.role ?? null);
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && userRole !== role) {
    return <Navigate to={homeForRole(userRole ?? 'usuario')} replace />;
  }

  return children ?? <Outlet />;
}
