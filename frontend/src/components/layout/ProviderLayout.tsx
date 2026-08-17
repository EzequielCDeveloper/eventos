import { NavLink, Outlet, Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { useUiStore } from '@/stores/uiStore';

/**
 * Provider layout shell (FR-002.1–FR-002.2) — 5-tab dashboard
 * (Hoy, Mensajes, Calendario, Anuncios, Estadísticas). Full feature
 * screens land in Slice S7; this shell provides routing + navigation.
 */
interface ProviderTab {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const TABS: ProviderTab[] = [
  { to: '/provider', label: 'Hoy', icon: 'today', end: true },
  { to: '/provider/messages', label: 'Mensajes', icon: 'chat' },
  { to: '/provider/calendar', label: 'Calendario', icon: 'calendar_month' },
  { to: '/provider/listings', label: 'Anuncios', icon: 'storefront' },
  { to: '/provider/stats', label: 'Estadísticas', icon: 'bar_chart' },
];

export function ProviderLayout() {
  const socketConnected = useUiStore((s) => s.socketConnected);

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body-md">
      {!socketConnected ? (
        <div className="fixed top-0 left-0 right-0 z-[95] flex items-center justify-center gap-2 bg-inverse-surface text-inverse-on-surface px-4 py-2 font-label-sm font-semibold text-[12px]">
          <Icon name="wifi_off" size={16} /> Conexión perdida. Reconectando…
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-surface border-r border-outline-variant py-xl">
        <Link to="/provider" className="px-lg mb-lg font-display-lg text-headline-md text-primary tracking-tight">
          FiestaExpert
          <span className="block font-label-sm text-label-sm text-on-surface-variant font-normal">Panel de proveedor</span>
        </Link>
        <nav className="flex-1 px-md flex flex-col gap-xs">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-md rounded-lg px-md py-sm font-label-md transition-all',
                  isActive
                    ? 'bg-secondary-container text-on-secondary-container font-bold translate-x-1'
                    : 'text-on-surface-variant hover:bg-surface-container-high',
                )
              }
            >
              <Icon name={tab.icon} size={20} />
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <Link
          to="/"
          className="mx-md mt-lg flex items-center gap-2 rounded-lg px-md py-sm text-on-surface-variant hover:bg-surface-container-high font-label-md"
        >
          <Icon name="logout" size={18} /> Volver a la app
        </Link>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 w-full z-40 flex items-center justify-between bg-surface px-margin-mobile h-14 shadow-sm">
        <span className="font-display-lg text-headline-md text-primary tracking-tight">FiestaExpert</span>
        <span className="font-label-sm text-label-sm text-on-surface-variant">Proveedor</span>
      </header>

      {/* Main */}
      <main className="md:pl-64 pt-14 md:pt-0 pb-24 md:pb-10">
        <div className="mx-auto w-full max-w-[1280px] px-margin-mobile md:px-margin-desktop pt-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 flex items-center justify-around bg-surface-container-lowest border-t border-outline-variant rounded-t-xl shadow-lg pb-safe h-16">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              clsx('flex flex-col items-center justify-center min-w-[48px] min-h-[48px] rounded-full px-4 py-1',
                isActive ? 'text-primary bg-primary-fixed scale-90' : 'text-on-surface-variant')
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={tab.icon} size={22} filled={isActive} />
                <span className="font-label-sm text-[11px]">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
