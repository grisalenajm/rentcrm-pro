import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then(r => r.data),
  });

  const active = properties.filter((p: any) => p.status === 'active').length;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Bienvenido, {user?.name}</h1>
        <p className="text-slate-400 text-sm mt-1">Panel de control · RentCRM Pro</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Propiedades', value: properties.length, icon: '🏠', color: 'text-emerald-400' },
          { label: 'Activas',     value: active,             icon: '✅', color: 'text-emerald-400' },
          { label: 'Clientes',    value: '—',                icon: '👥', color: 'text-slate-400'   },
          { label: 'Reservas',    value: '—',                icon: '📅', color: 'text-slate-400'   },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="text-2xl mb-2">{icon}</div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-slate-400 text-sm">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="font-semibold mb-4">Próximas funcionalidades</h2>
        <div className="space-y-2 text-sm text-slate-400">
          <div className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Gestión de propiedades</div>
          <div className="flex items-center gap-2"><span className="text-slate-600">○</span> Gestión de clientes</div>
          <div className="flex items-center gap-2"><span className="text-slate-600">○</span> Reservas y check-in</div>
          <div className="flex items-center gap-2"><span className="text-slate-600">○</span> Partes SES automáticos</div>
          <div className="flex items-center gap-2"><span className="text-slate-600">○</span> Sincronización iCal</div>
          <div className="flex items-center gap-2"><span className="text-slate-600">○</span> P&L financiero</div>
        </div>
      </div>
    </div>
  );
}
