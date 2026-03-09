import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: properties = [] } = useQuery({ queryKey: ['properties'], queryFn: () => api.get('/properties').then(r => r.data) });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/clients').then(r => r.data) });
  const { data: bookings = [] } = useQuery({ queryKey: ['bookings'], queryFn: () => api.get('/bookings').then(r => r.data) });
  const { data: financials = [] } = useQuery({ queryKey: ['financials'], queryFn: () => api.get('/financials').then(r => r.data) });

  const activeBookings = bookings.filter((b: any) => b.status === 'confirmed').length;
  const totalRevenue = financials.filter((f: any) => f.type === 'income').reduce((s: number, f: any) => s + Number(f.amount), 0);
  const recentBookings = [...bookings].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  const stats = [
    { label: t('dashboard.totalProperties'), value: properties.length, icon: '🏠', color: 'text-emerald-400', path: '/properties' },
    { label: t('dashboard.totalClients'),    value: clients.length,    icon: '👥', color: 'text-blue-400',    path: '/clients' },
    { label: t('dashboard.activeBookings'),  value: activeBookings,    icon: '📅', color: 'text-amber-400',   path: '/bookings' },
    { label: t('dashboard.totalRevenue'),    value: `€${totalRevenue.toLocaleString('es-ES', { minimumFractionDigits: 0 })}`, icon: '💶', color: 'text-emerald-400', path: '/financials' },
  ];

  const statusColor: Record<string, string> = {
    confirmed: 'bg-emerald-500/10 text-emerald-400',
    cancelled:  'bg-red-500/10 text-red-400',
    completed:  'bg-slate-500/10 text-slate-400',
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{t('common.name') === 'Name' ? `Welcome, ${user?.name}` : `Bienvenido, ${user?.name}`}</h1>
        <p className="text-slate-400 text-sm mt-1">{t('dashboard.title')} · RentCRM Pro</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon, color, path }) => (
          <button key={label} onClick={() => navigate(path)}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-left hover:border-slate-700 transition-colors">
            <div className="text-2xl mb-2">{icon}</div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-slate-400 text-sm mt-1">{label}</div>
          </button>
        ))}
      </div>

      {/* Reservas recientes */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold">{t('dashboard.recentBookings')}</h2>
          <button onClick={() => navigate('/bookings')} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
            {t('common.view')} →
          </button>
        </div>
        {recentBookings.length === 0 ? (
          <div className="text-slate-400 text-center py-10 text-sm">{t('common.noData')}</div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-5 py-3 text-slate-400 font-semibold">{t('bookings.client')}</th>
                    <th className="text-left px-5 py-3 text-slate-400 font-semibold">{t('bookings.property')}</th>
                    <th className="text-left px-5 py-3 text-slate-400 font-semibold">{t('bookings.checkIn')}</th>
                    <th className="text-left px-5 py-3 text-slate-400 font-semibold">{t('bookings.checkOut')}</th>
                    <th className="text-left px-5 py-3 text-slate-400 font-semibold">{t('common.total')}</th>
                    <th className="text-left px-5 py-3 text-slate-400 font-semibold">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((b: any) => (
                    <tr key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}
                      className="border-b border-slate-800 hover:bg-slate-800/70 cursor-pointer transition-colors">
                      <td className="px-5 py-3 font-medium">{b.client?.firstName} {b.client?.lastName}</td>
                      <td className="px-5 py-3 text-slate-400">{b.property?.name}</td>
                      <td className="px-5 py-3 text-slate-400">{new Date(b.checkInDate).toLocaleDateString('es-ES')}</td>
                      <td className="px-5 py-3 text-slate-400">{new Date(b.checkOutDate).toLocaleDateString('es-ES')}</td>
                      <td className="px-5 py-3 font-semibold text-emerald-400">€{b.totalAmount}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[b.status] || 'bg-slate-500/10 text-slate-400'}`}>
                          {t(`bookings.statuses.${b.status}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Móvil */}
            <div className="md:hidden space-y-3 p-4">
              {recentBookings.map((b: any) => (
                <div key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-white">{b.client?.firstName} {b.client?.lastName}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[b.status] || 'bg-slate-500/10 text-slate-400'}`}>
                      {t(`bookings.statuses.${b.status}`)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mb-1">{b.property?.name}</div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-slate-400">
                      {new Date(b.checkInDate).toLocaleDateString('es-ES')} → {new Date(b.checkOutDate).toLocaleDateString('es-ES')}
                    </span>
                    <span className="font-semibold text-emerald-400 text-sm">€{b.totalAmount}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
