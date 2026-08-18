import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ToastProvider } from '@/components/ui/Toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProviderLayout } from '@/components/layout/ProviderLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ProtectedRoute, homeForRole } from '@/components/routing/ProtectedRoute';
import { Spinner } from '@/components/common/StateView';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types/models';

/**
 * App root + nested lazy routes (FR-017.1, FR-017.4).
 *
 * `/` → client (AppLayout, 5-tab bottom nav); `/provider/*` and `/admin/*`
 * → their own layouts with role guards. Feature bundles are code-split via
 * React.lazy per route.
 */

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));

const SearchPage = lazy(() => import('@/features/search/SearchPage'));
const ServiceDetailPage = lazy(() => import('@/features/booking/ServiceDetailPage'));
const BookingFlowPage = lazy(() => import('@/features/booking/BookingFlow'));
const FavoritesPage = lazy(() => import('@/features/favorites/FavoritesPage'));
const RentalHistoryPage = lazy(() => import('@/features/rentals/RentalHistoryPage'));
const ChatPage = lazy(() => import('@/features/chat/ChatPage'));
const NotificationCenter = lazy(() => import('@/features/notifications/NotificationCenter'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));

// Provider features (Slice S7 — Hoy, Calendario, Anuncios, Estadísticas,
// onboarding + KYC) and admin panel (Slice S7 — 5 function areas).
const ProviderDashboard = lazy(() => import('@/features/provider/ProviderDashboard'));
const CalendarTab = lazy(() => import('@/features/provider/CalendarTab'));
const ListingsTab = lazy(() => import('@/features/provider/ListingsTab'));
const StatsTab = lazy(() => import('@/features/provider/StatsTab'));
const OnboardingWizard = lazy(() => import('@/features/provider/OnboardingWizard'));
const VerificationFlow = lazy(() => import('@/features/provider/VerificationFlow'));

const AdminDashboard = lazy(() => import('@/features/admin/AdminDashboard'));
const ModerationPanel = lazy(() => import('@/features/admin/ModerationPanel'));
const ProviderManagement = lazy(() => import('@/features/admin/ProviderManagement'));
const AdminStats = lazy(() => import('@/features/admin/AdminStats'));
const AdminDisputes = lazy(() => import('@/features/admin/AdminDisputes'));
const CommissionConfig = lazy(() => import('@/features/admin/CommissionConfig'));

function LazyFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

function withSuspense(node: ReactNode) {
  return <Suspense fallback={<LazyFallback />}>{node}</Suspense>;
}

/** Post-login landing — routes an authenticated user to their role home. */
function RoleHome() {
  const role = useAuthStore((s) => s.user?.role);
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <Navigate to={homeForRole((role ?? 'usuario') as UserRole)} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public auth */}
            <Route path="/login" element={withSuspense(<LoginPage />)} />
            <Route path="/register" element={withSuspense(<RegisterPage />)} />

            {/* Client layout */}
            <Route element={<AppLayout />}>
              <Route index element={withSuspense(<SearchPage />)} />
              <Route path="service/:id" element={withSuspense(<ServiceDetailPage />)} />
              <Route
                path="booking/:serviceId"
                element={
                  <ProtectedRoute role="usuario">
                    {withSuspense(<BookingFlowPage />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="favorites"
                element={
                  <ProtectedRoute role="usuario">
                    {withSuspense(<FavoritesPage />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="rentals"
                element={
                  <ProtectedRoute role="usuario">
                    {withSuspense(<RentalHistoryPage />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="chat"
                element={
                  <ProtectedRoute role="usuario">
                    {withSuspense(<ChatPage />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="notifications"
                element={
                  <ProtectedRoute role="usuario">
                    {withSuspense(<NotificationCenter />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="profile"
                element={
                  <ProtectedRoute role="usuario">
                    {withSuspense(<ProfilePage />)}
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Provider layout (Slice S7 — real tabs) */}
            <Route
              path="/provider/*"
              element={
                <ProtectedRoute role="prestador">
                  <ProviderLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={withSuspense(<ProviderDashboard />)} />
              <Route path="messages" element={withSuspense(<ChatPage />)} />
              <Route path="calendar" element={withSuspense(<CalendarTab />)} />
              <Route path="listings" element={withSuspense(<ListingsTab />)} />
              <Route path="stats" element={withSuspense(<StatsTab />)} />
              <Route path="onboarding" element={withSuspense(<OnboardingWizard />)} />
              <Route path="verification" element={withSuspense(<VerificationFlow />)} />
              <Route path="*" element={<Navigate to="/provider" replace />} />
            </Route>

            {/* Admin layout (Slice S7 — 5 function areas) */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute role="administrador">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={withSuspense(<AdminDashboard />)} />
              <Route path="moderation" element={withSuspense(<ModerationPanel />)} />
              <Route path="providers" element={withSuspense(<ProviderManagement />)} />
              <Route path="stats" element={withSuspense(<AdminStats />)} />
              <Route path="disputes" element={withSuspense(<AdminDisputes />)} />
              <Route path="commission" element={withSuspense(<CommissionConfig />)} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>

            {/* Role-aware fallback */}
            <Route path="/redirect" element={<RoleHome />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
