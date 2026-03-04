import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  confirmed: 'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-red-500/10 text-red-400',
  completed: 'bg-slate-500/10 text-slate-400',
};

const statusLabel: Record<string, string> = {
  confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Completada',
};

const sourceLabel: Record<string, string> = {
  direct: 'Directo', airbnb: 'Airbnb',
  booking: 'Booking', vrbo: 'Vrbo', manual_block: 'Bloqueo',
};

const emptyBooking = { clientId:'', propertyId:'', checkInDate:'', checkOutDate:'', totalAmount:'', source:'direct' };
const emptyClient = { firstName:'', lastName:'', dniPassport:'', nationality:'', birthDate:'', email:'', phone:'' };

export default function Bookings() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [newClientMode, setNewClientMode] = useState(false);
  const [booking, setBooking] = useState(emptyBooking);
  const [client, setClient] = useState(emptyClient);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      let clientId = booking.clientId;
      if (newClientMode) {
        const res = await api.post('/clients', { ...client, birthDate: client.birthDate || undefined });
        clientId = res.data.id;
        qc.invalidateQueries({ queryKey: ['clients'] });
      }
      await api.post('/bookings', { ...booking, clientId, totalAmount: Number(booking.totalAmount), status: 'confirmed' });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      setShowForm(false);
      setBooking(emptyBooking);
      setClient(emptyClient);
      setNewClientMode(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear la reserva. Comprueba las fechas.');
    } finally {
      setSubmitting(false);
    }
  };

  const nights = (checkIn: string, checkOut: string) =>
    Math.max(0, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));

  const bf = (k: keyof typeof emptyBooking) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setBooking({ ...booking, [k]: e.target.value });
  const cf = (k: keyof typeof emptyClient) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setClient({ ...client, [k]: e.target.value });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reservas</h1>
          <p className="text-slate-400 text-sm mt-1">{bookings.length} reservas registradas</p>
        </div>
        <button onClick={() => { setShowForm(true); setError(''); }}
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
              </tr>
            </thead>
            <tbody>
              {bookings.map((b: Booking) => (
                <tr key={b.id}
                  onClick={() => navigate(`/bookings/${b.id}`)}
                  className="border-b border-slate-800 hover:bg-slate-800/70 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-medium">{b.client.firstName} {b.client.lastName}</td>
                  <td className="px-4 py-3 text-slate-400">{b.property.name}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(b.checkInDate).toLocaleDateString('es-ES')}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(b.checkOutDate).toLocaleDateString('es-ES')}</td>
                  <td className="px-4 py-3 text-slate-400">{nights(b.checkInDate, b.checkOutDate)}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-400">€{b.totalAmount}</td>
                  <td className="px-4 py-3 text-slate-400">{sourceLabel[b.source] || b.source}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[b.status] || 'bg-slate-500/10 text-slate-400'}`}>
                      {statusLabel[b.status] || b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-5">Nueva reserva</h2>
            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente *</label>
                  <button type="button" onClick={() => { setNewClientMode(!newClientMode); setBooking({...booking, clientId:''}); }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                    {newClientMode ? '← Seleccionar existente' : '+ Crear nuevo cliente'}
                  </button>
                </div>
                {newClientMode ? (
                  <div className="bg-slate-800 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-slate-400 mb-2">Datos del nuevo cliente</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[['firstName','Nombre *',true],['lastName','Apellidos *',true],['dniPassport','DNI/Pasaporte',false],['nationality','Nacionalidad',false],['email','Email',false],['phone','Teléfono',false]].map(([k,label,req]) => (
                        <div key={k as string}>
                          <label className="block text-xs text-slate-500 mb-1">{label as string}</label>
                          <input value={client[k as keyof typeof emptyClient]} onChange={cf(k as keyof typeof emptyClient)}
                            required={req as boolean}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <select value={booking.clientId} onChange={bf('clientId')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required>
                    <option value="">Seleccionar cliente existente...</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.dniPassport ? ` — ${c.dniPassport}` : ''}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Propiedad *</label>
                <select value={booking.propertyId} onChange={bf('propertyId')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required>
                  <option value="">Seleccionar propiedad...</option>
                  {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.city}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Check-in *</label>
                  <input type="date" value={booking.checkInDate} onChange={bf('checkInDate')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Check-out *</label>
                  <input type="date" value={booking.checkOutDate} onChange={bf('checkOutDate')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total (€) *</label>
                  <input type="number" min="0" value={booking.totalAmount} onChange={bf('totalAmount')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Origen</label>
                  <select value={booking.source} onChange={bf('source')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                    <option value="direct">Directo</option>
                    <option value="airbnb">Airbnb</option>
                    <option value="booking">Booking</option>
                    <option value="vrbo">Vrbo</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setNewClientMode(false); setError(''); }}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  {submitting ? 'Creando...' : 'Crear reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
