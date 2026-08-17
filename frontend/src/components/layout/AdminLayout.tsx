import { NavLink, Outlet, Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';

/**
 * Admin layout shell (FR-003.1) — exactly 5 function areas: moderación,
 * gestión de proveedores, estadísticas, disputas técnicas y comisión
 * (BR-002.4). Full admin screens land in Slice S7; this shell provides
 * routing + navigation.
 */
interface AdminTab {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const TABS: AdminTab[] = [
  { to: '/admin', label: 'Moderación', icon: 'flag', end: true },
  { to: '/admin/providers', label: 'Proveedores', icon: 'badge' },
  { to: '/admin/stats', label: 'Estadísticas', icon: 'query_stats' },
  { to: '/admin/disputes', label: 'Disputas', icon: 'gavel' },
  { to: '/admin/commission', label: 'Comisión', icon: 'percent' },
];

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-surface text-on-surface font-body-md">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-72 flex-col bg-surface border-r border-outline-variant py-xl">
        <Link to="/admin" className="px-lg mb-lg font-display-lg text-headline-md text-primary tracking-tight">
          FiestaExpert
          <span className="block font-label-sm text-label-sm text-on-surface-variant font-normal">Panel de administración</span>
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
          <Icon name="logout" size={18} /> Salir del panel
        </Link>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 w-full z-40 flex items-center justify-between bg-surface px-margin-mobile h-14 shadow-sm">
        <span className="font-display-lg text-headline-md text-primary tracking-tight">FiestaExpert</span>
        <span className="font-label-sm text-label-sm text-on-surface-variant">Admin</span>
      </header>

      {/* Main */}
      <main className="md:pl-72 pt-14 md:pt-0 pb-24 md:pb-10">
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
