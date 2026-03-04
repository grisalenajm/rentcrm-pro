import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/',                    icon: '📊', label: t('nav.dashboard')   },
  { to: '/properties',          icon: '🏠', label: t('nav.properties') },
  { to: '/clients',             icon: '👥', label: t('nav.clients')    },
  { to: '/bookings',            icon: '📅', label: t('nav.bookings')    },
  { to: '/financials',          icon: '💶', label: t('nav.financials')  },
  { to: '/contracts',           icon: '📄', label: t('nav.contracts')   },
  { to: '/contracts/templates', icon: '📝', label: t('nav.templates')   },
  { to: '/police',              icon: '📡', label: t('nav.police')  },
  { to: '/settings',            icon: '⚙️', label: t('nav.settings') },
];

export default function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen bg-slate-950 text-white">
      <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-sm">🏘️</div>
            <div>
              <div className="text-sm font-bold">RentCRM Pro</div>
              <div className="text-xs text-slate-500">{user?.role}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-emerald-600/20 text-emerald-400 font-semibold' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }>
              <span>{icon}</span><span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <div className="px-3 py-2 mb-1">
            <div className="text-sm font-medium text-white">{user?.name}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <span>🚪</span><span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto"><Outlet /></main>
    </div>
  );
}
