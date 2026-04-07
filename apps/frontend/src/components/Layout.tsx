import { useState, useEffect } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Cerrar drawer al cambiar de ruta
  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  // Bloquear scroll del body cuando el drawer está abierto
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const nav = user?.role === 'inventario'
    ? [
        { to: '/inventory', icon: '📦', label: t('nav.inventory') },
      ]
    : [
        { to: '/',                    icon: '📊', label: t('nav.dashboard')  },
        { to: '/properties',          icon: '🏠', label: t('nav.properties') },
        { to: '/clients',             icon: '👥', label: t('nav.clients')    },
        { to: '/bookings',            icon: '📅', label: t('nav.bookings')   },
        { to: '/financials',          icon: '💶', label: t('nav.financials') },
        { to: '/contracts',           icon: '📄', label: t('nav.contracts')  },
        { to: '/calendar',            icon: '🗓️', label: t('nav.calendar')  },
        { to: '/transmision-datos',   icon: '📡', label: t('nav.transmision') },
        { to: '/logs',                icon: '🖥️', label: t('nav.logs')       },
        ...(['admin', 'gestor'].includes(user?.role ?? '') ? [{ to: '/inventory', icon: '📦', label: t('nav.inventory') }] : []),
        ...(user?.role === 'admin' ? [{ to: '/users', icon: '👤', label: t('nav.users') }] : []),
        { to: '/settings',            icon: '⚙️', label: t('nav.settings')  },
      ];

  const handleLogout = () => { logout(); navigate('/login'); };

  const SidebarContent = () => (
    <>
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
        <Link to="/profile" className="block px-3 py-2 mb-1 rounded-lg hover:bg-slate-800 transition-colors">
          <div className="text-xs font-medium text-white truncate">{user?.name}</div>
          <div className="text-xs text-slate-400 truncate">{user?.email}</div>
        </Link>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
          <span>🚪</span>
          <span>{t('nav.settings') === 'Settings' ? 'Log out' : 'Cerrar sesión'}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-white">
      {/* Sidebar desktop */}
      <aside className="w-56 bg-slate-900 border-r border-slate-800 hidden md:flex flex-col">
        <SidebarContent />
      </aside>

      {/* Drawer móvil */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button
          onClick={() => setMenuOpen(false)}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white">
          ✕
        </button>
        <SidebarContent />
      </div>

      {/* Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Contenedor principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header móvil */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col gap-1 w-9 h-9 justify-center">
            <span className="w-5 h-0.5 bg-white block"></span>
            <span className="w-5 h-0.5 bg-white block"></span>
            <span className="w-5 h-0.5 bg-white block"></span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-600 rounded flex items-center justify-center text-xs">🏘️</div>
            <span className="text-sm font-bold">RentCRM Pro</span>
          </div>
          <div className="w-9" />
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
