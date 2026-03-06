import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

const statusColor: Record<string, string> = {
  confirmed: 'bg-emerald-500/10 text-emerald-400',
  cancelled:  'bg-red-500/10 text-red-400',
  completed:  'bg-slate-500/10 text-slate-400',
};

export default function Bookings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    clientId: '', propertyId: '',
    checkIn: '', checkOut: '',
    totalAmount: '', source: 'direct', status: 'confirmed', notes: '',
  });

  const { data: bookingsRaw, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings').then(r => r.data),
  });
  const bookings = bookingsRaw?.data || bookingsRaw || [];

  const { data: clientsRaw } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then(r => r.data),
  });
  const clients = clientsRaw?.data || clientsRaw || [];

  const { data: propertiesRaw } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then(r => r.data),
  });
  const properties = propertiesRaw?.data || propertiesRaw || [];

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/bookings', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      setShowForm(false);
      setForm({ clientId: '', propertyId: '', checkIn: '', checkOut: '', totalAmount: '', source: 'direct', status: 'confirmed', notes: '' });
    },
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const handleSubmit = () => {
    createMutation.mutate({
      clientId:    form.clientId,
      propertyId:  form.propertyId,
      checkIn:     form.checkIn,
      checkOut:    form.checkOut,
      totalAmount: Number(form.totalAmount),
      source:      form.source,
      status:      form.status,
      notes:       form.notes || undefined,
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('bookings.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{bookings.length} {t('bookings.registered')}</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
          + {t('bookings.new')}
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-20">{t('common.loading')}</div>
      ) : bookings.length === 0 ? (
        <div className="text-slate-400 text-center py-20">{t('common.noData')}</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('bookings.client')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('bookings.property')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('bookings.checkIn')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('bookings.checkOut')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('common.total')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('bookings.source')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b: any) => (
                <tr key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}
                  className="border-b border-slate-800 hover:bg-slate-800/70 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-medium">{b.client?.firstName} {b.client?.lastName}</td>
                  <td className="px-4 py-3 text-slate-400">{b.property?.name}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(b.checkIn || b.checkInDate).toLocaleDateString('es-ES')}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(b.checkOut || b.checkOutDate).toLocaleDateString('es-ES')}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-400">€{b.totalAmount}</td>
                  <td className="px-4 py-3 text-slate-400">{t(`bookings.sources.${b.source}`) || b.source}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[b.status] || 'bg-slate-500/10 text-slate-400'}`}>
                      {t(`bookings.statuses.${b.status}`) || b.status}
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-5">{t('bookings.new')}</h2>

            {createMutation.isError && (
              <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                Error al crear la reserva. Comprueba los campos e inténtalo de nuevo.
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('bookings.client')} *</label>
                <select value={form.clientId} onChange={f('clientId')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                  <option value="">— {t('bookings.client')} —</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('bookings.property')} *</label>
                <select value={form.propertyId} onChange={f('propertyId')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                  <option value="">— {t('bookings.property')} —</option>
                  {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('bookings.checkIn')} *</label>
                  <input type="date" value={form.checkIn} onChange={f('checkIn')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('bookings.checkOut')} *</label>
                  <input type="date" value={form.checkOut} onChange={f('checkOut')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('common.total')} (€) *</label>
                  <input type="number" value={form.totalAmount} onChange={f('totalAmount')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('bookings.source')}</label>
                  <select value={form.source} onChange={f('source')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                    {['direct','airbnb','booking','vrbo','manual_block'].map(s => (
                      <option key={s} value={s}>{t(`bookings.sources.${s}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('common.notes')}</label>
                <textarea value={form.notes} onChange={f('notes')} rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.clientId || !form.propertyId || !form.checkIn || !form.checkOut || !form.totalAmount || createMutation.isPending}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  {createMutation.isPending ? t('common.saving') : t('bookings.new')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
