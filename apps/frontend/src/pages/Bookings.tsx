import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Booking {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: string;
  status: string;
  source: string;
  client: { firstName: string; lastName: string };
  property: { name: string; city: string };
}

const statusColor: Record<string, string> = {
  pending:   'bg-amber-500/10 text-amber-400',
  confirmed: 'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-red-500/10 text-red-400',
  completed: 'bg-slate-500/10 text-slate-400',
};

const statusLabel: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmada',
  cancelled: 'Cancelada', completed: 'Completada',
};

const sourceLabel: Record<string, string> = {
  direct: 'Directo', airbnb: 'Airbnb',
  booking: 'Booking', vrbo: 'Vrbo', manual_block: 'Bloqueo',
};

const emptyForm = { clientId:'', propertyId:'', checkInDate:'', checkOutDate:'', totalAmount:'', source:'direct', status:'pending' };

export default function Bookings() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings').then(r => r.data),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then(r => r.data),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/bookings', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); setShowForm(false); setForm(emptyForm); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bookings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ ...form, totalAmount: Number(form.totalAmount) });
  };

  const nights = (checkIn: string, checkOut: string) => {
    const d = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
    return d > 0 ? d : 0;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reservas</h1>
          <p className="text-slate-400 text-sm mt-1">{bookings.length} reservas registradas</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
          + Nueva reserva
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-20">Cargando...</div>
      ) : bookings.length === 0 ? (
        <div className="text-slate-400 text-center py-20">No hay reservas registradas</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">Cliente</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">Propiedad</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">Check-in</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">Check-out</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">Noches</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">Total</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">Origen</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b: Booking) => (
                <tr key={b.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{b.client.firstName} {b.client.lastName}</td>
                  <td className="px-4 py-3 text-slate-400">{b.property.name}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(b.checkInDate).toLocaleDateString('es-ES')}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(b.checkOutDate).toLocaleDateString('es-ES')}</td>
                  <td className="px-4 py-3 text-slate-400">{nights(b.checkInDate, b.checkOutDate)}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-400">€{b.totalAmount}</td>
                  <td className="px-4 py-3 text-slate-400">{sourceLabel[b.source] || b.source}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[b.status]}`}>
                      {statusLabel[b.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {b.status !== 'cancelled' && (
                      <button onClick={() => { if(confirm('¿Cancelar reserva?')) cancelMutation.mutate(b.id); }}
                        className="px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-5">Nueva reserva</h2>
            {createMutation.isError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                Error: las fechas pueden estar ocupadas o hay un conflicto.
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Cliente *</label>
                <select value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required>
                  <option value="">Seleccionar cliente...</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Propiedad *</label>
                <select value={form.propertyId} onChange={e => setForm({...form, propertyId: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required>
                  <option value="">Seleccionar propiedad...</option>
                  {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.city}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Check-in *</label>
                  <input type="date" value={form.checkInDate} onChange={e => setForm({...form, checkInDate: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Check-out *</label>
                  <input type="date" value={form.checkOutDate} onChange={e => setForm({...form, checkOutDate: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total (€) *</label>
                  <input type="number" min="0" value={form.totalAmount} onChange={e => setForm({...form, totalAmount: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Origen</label>
                  <select value={form.source} onChange={e => setForm({...form, source: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                    <option value="direct">Directo</option>
                    <option value="airbnb">Airbnb</option>
                    <option value="booking">Booking</option>
                    <option value="vrbo">Vrbo</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); createMutation.reset(); }}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={createMutation.isPending}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  {createMutation.isPending ? 'Creando...' : 'Crear reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
