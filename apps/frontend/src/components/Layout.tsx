import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const nav = [
    { to: '/',                    icon: '📊', label: t('nav.dashboard')  },
    { to: '/properties',          icon: '🏠', label: t('nav.properties') },
    { to: '/clients',             icon: '👥', label: t('nav.clients')    },
    { to: '/bookings',            icon: '📅', label: t('nav.bookings')   },
    { to: '/financials',          icon: '💶', label: t('nav.financials') },
    { to: '/contracts',           icon: '📄', label: t('nav.contracts')  },
    { to: '/contracts/templates', icon: '📝', label: t('nav.templates')  },
    { to: '/ical',                icon: '📅', label: t('nav.ical')      },
    { to: '/calendar',            icon: '🗓️', label: t('nav.calendar')  },
    { to: '/police',              icon: '📡', label: t('nav.police')     },
    ...(user?.role === 'admin' ? [{ to: '/users', icon: '👤', label: t('nav.users') }] : []),
    { to: '/settings',            icon: '⚙️', label: t('nav.settings')  },
  ];

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen bg-slate-950 text-white">
      <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-sm">🏘️</div>
            <div>
              <div className="text-sm font-bold">RentCRM Pro</div>
              <div className="text-xs text-slate-400">v1.0</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {nav.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                  isActive ? 'bg-emerald-600/20 text-emerald-400 font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <div className="px-3 py-2 mb-1">
            <div className="text-xs font-medium text-white truncate">{user?.name}</div>
            <div className="text-xs text-slate-400 truncate">{user?.email}</div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <span>🚪</span>
            <span>{t('nav.settings') === 'Settings' ? 'Log out' : 'Cerrar sesión'}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
