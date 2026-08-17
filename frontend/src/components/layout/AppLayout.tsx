import { NavLink, Outlet, Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { useUiStore } from '@/stores/uiStore';
import { Icon } from '@/components/ui/Icon';
import { useUnreadNotifications } from '@/features/notifications/hooks';

/**
 * Client layout (FR-001.1–FR-001.4) — mirrors the mockup shell:
 * mobile top bar + desktop nav + 5-tab bottom nav (Inicio, Favoritos,
 * Rentas, Chat, Perfil). Notification badge renders on the top bar.
 */
interface NavTarget {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const TABS: NavTarget[] = [
  { to: '/', label: 'Inicio', icon: 'home', end: true },
  { to: '/favorites', label: 'Favoritos', icon: 'favorite' },
  { to: '/rentals', label: 'Rentas', icon: 'calendar_today' },
  { to: '/chat', label: 'Chat', icon: 'chat' },
  { to: '/profile', label: 'Perfil', icon: 'person' },
];

export function AppLayout() {
  const unread = useUnreadNotifications();
  const socketConnected = useUiStore((s) => s.socketConnected);

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body-md">
      {/* Connection lost banner (D-014) */}
      {!socketConnected ? (
        <div className="fixed top-0 left-0 right-0 z-[95] flex items-center justify-center gap-2 bg-inverse-surface text-inverse-on-surface px-4 py-2 font-label-sm font-semibold text-[12px]">
          <Icon name="wifi_off" size={16} />
          Conexión perdida. Reconectando…
        </div>
      ) : null}

      {/* Mobile top bar */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between bg-surface px-margin-mobile h-14 shadow-sm md:hidden">
        <Link to="/" className="flex items-center gap-2 text-primary" aria-label="Buscar">
          <Icon name="search" size={22} className="text-on-surface-variant" />
        </Link>
        <Link to="/" className="font-display-lg text-headline-md text-primary tracking-tight">
          FiestaExpert
        </Link>
        <Link
          to="/notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors"
          aria-label="Notificaciones"
        >
          <Icon name="notifications" size={22} />
          {unread > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-error text-on-error px-1 font-label-sm text-[10px]">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Link>
      </header>

      {/* Desktop nav */}
      <header className="hidden md:flex fixed top-0 w-full z-50 items-center justify-between bg-surface px-margin-desktop h-20 shadow-sm">
        <Link to="/" className="font-display-lg text-headline-lg text-primary tracking-tight">
          FiestaExpert
        </Link>
        <nav className="flex items-center gap-lg">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2 rounded-full px-4 py-2 font-label-md transition-colors',
                  isActive
                    ? 'text-primary font-bold bg-primary-fixed/20'
                    : 'text-on-surface-variant hover:bg-surface-container-low',
                )
              }
            >
              <Icon name={tab.icon} size={20} filled={false} />
              <span>{tab.label}</span>
            </NavLink>
          ))}
          <NavLink
            to="/notifications"
            aria-label="Notificaciones"
            className={({ isActive }) =>
              clsx(
                'relative flex items-center gap-2 rounded-full px-4 py-2 font-label-md transition-colors',
                isActive ? 'text-primary font-bold bg-primary-fixed/20' : 'text-on-surface-variant hover:bg-surface-container-low',
              )
            }
          >
            <Icon name="notifications" size={20} />
            <span>Notificaciones</span>
            {unread > 0 ? (
              <span className="absolute top-0 right-0 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-error text-on-error px-1 font-label-sm text-[10px]">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </NavLink>
        </nav>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-[1280px] px-margin-mobile md:px-margin-desktop pt-16 md:pt-28 pb-24 md:pb-10">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 w-full z-50 flex items-center justify-around bg-surface-container-lowest border-t border-outline-variant rounded-t-xl shadow-lg pb-safe h-16 md:hidden">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center min-w-[48px] min-h-[48px] rounded-full px-4 py-1',
                isActive ? 'text-primary bg-primary-fixed scale-90' : 'text-on-surface-variant',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={tab.icon} size={22} filled={isActive} />
                <span className={clsx('mt-0.5 font-label-sm text-[11px]', isActive && 'font-bold')}>{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
