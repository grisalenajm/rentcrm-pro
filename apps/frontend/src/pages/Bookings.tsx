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
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [form, setForm] = useState({
    clientId: '', propertyId: '',
    checkInDate: '', checkOutDate: '',
    totalAmount: '', source: 'direct', status: 'confirmed', notes: '',
  });
  const [newClient, setNewClient] = useState({
    firstName: '', lastName: '', dniPassport: '', nationality: '',
    birthDate: '', email: '', phone: '',
  });
  const [errorMsg, setErrorMsg] = useState('');

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

  const createClientMutation = useMutation({
    mutationFn: (data: any) => api.post('/clients', data).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/bookings', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      setShowForm(false);
      setErrorMsg('');
      setForm({ clientId: '', propertyId: '', checkInDate: '', checkOutDate: '', totalAmount: '', source: 'direct', status: 'confirmed', notes: '' });
      setNewClient({ firstName: '', lastName: '', dniPassport: '', nationality: '', birthDate: '', email: '', phone: '' });
      setClientMode('existing');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg || 'Error al crear la reserva.');
    },
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const fc = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setNewClient({ ...newClient, [k]: e.target.value });

  // Al seleccionar cliente existente, rellena sus datos
  const handleClientSelect = (id: string) => {
    const client = clients.find((c: any) => c.id === id);
    if (client) {
      setNewClient({
        firstName:   client.firstName  || '',
        lastName:    client.lastName   || '',
        dniPassport: client.dniPassport|| '',
        nationality: client.nationality|| '',
        birthDate:   client.birthDate ? client.birthDate.substring(0, 10) : '',
        email:       client.email      || '',
        phone:       client.phone      || '',
      });
    }
    setForm({ ...form, clientId: id });
  };

  const handleSubmit = async () => {
    setErrorMsg('');
    try {
      let clientId = form.clientId;

      if (clientMode === 'new') {
        if (!newClient.firstName || !newClient.lastName) {
          setErrorMsg('El nombre y apellido del cliente son obligatorios.');
          return;
        }
        const created = await createClientMutation.mutateAsync({
          firstName:   newClient.firstName,
          lastName:    newClient.lastName,
          dniPassport: newClient.dniPassport || undefined,
          nationality: newClient.nationality || undefined,
          birthDate:   newClient.birthDate   || undefined,
          email:       newClient.email       || undefined,
          phone:       newClient.phone       || undefined,
        });
        clientId = created.id;
      }

      createMutation.mutate({
        clientId,
        propertyId:   form.propertyId,
        checkInDate:  form.checkInDate,
        checkOutDate: form.checkOutDate,
        totalAmount:  Number(form.totalAmount),
        source:       form.source,
        status:       form.status,
        notes:        form.notes || undefined,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg || 'Error al crear el cliente.');
    }
  };

  const isSubmitDisabled =
    !form.propertyId || !form.checkInDate || !form.checkOutDate || !form.totalAmount ||
    (clientMode === 'existing' ? !form.clientId : !newClient.firstName || !newClient.lastName) ||
    createMutation.isPending || createClientMutation.isPending;

  const inputCls = "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500";
  const labelCls = "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1";

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('bookings.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{bookings.length} {t('bookings.registered')}</p>
        </div>
        <button onClick={() => { setShowForm(true); setErrorMsg(''); }}
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
                  <td className="px-4 py-3 text-slate-400">{new Date(b.checkInDate).toLocaleDateString('es-ES')}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(b.checkOutDate).toLocaleDateString('es-ES')}</td>
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-5">{t('bookings.new')}</h2>

            {errorMsg && (
              <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">

              {/* Selector cliente existente / nuevo */}
              <div>
                <label className={labelCls}>{t('bookings.client')} *</label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setClientMode('existing')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${clientMode === 'existing' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                    Cliente existente
                  </button>
                  <button
                    onClick={() => { setClientMode('new'); setForm({...form, clientId:''}); setNewClient({ firstName:'', lastName:'', dniPassport:'', nationality:'', birthDate:'', email:'', phone:'' }); }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${clientMode === 'new' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                    + Nuevo cliente
                  </button>
                </div>

                {clientMode === 'existing' ? (
                  <select value={form.clientId} onChange={e => handleClientSelect(e.target.value)} className={inputCls}>
                    <option value="">— Seleccionar cliente —</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                  </select>
                ) : null}
              </div>

              {/* Datos del cliente (siempre visibles: rellenos si existente, editables si nuevo) */}
              {(clientMode === 'new' || form.clientId) && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {clientMode === 'new' ? 'Datos del nuevo cliente' : 'Datos del cliente'}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Nombre *</label>
                      <input value={newClient.firstName} onChange={fc('firstName')}
                        readOnly={clientMode === 'existing'}
                        className={`${inputCls} ${clientMode === 'existing' ? 'opacity-60 cursor-default' : ''}`} />
                    </div>
                    <div>
                      <label className={labelCls}>Apellido *</label>
                      <input value={newClient.lastName} onChange={fc('lastName')}
                        readOnly={clientMode === 'existing'}
                        className={`${inputCls} ${clientMode === 'existing' ? 'opacity-60 cursor-default' : ''}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>DNI / Pasaporte</label>
                      <input value={newClient.dniPassport} onChange={fc('dniPassport')}
                        readOnly={clientMode === 'existing'}
                        className={`${inputCls} ${clientMode === 'existing' ? 'opacity-60 cursor-default' : ''}`} />
                    </div>
                    <div>
                      <label className={labelCls}>Nacionalidad</label>
                      <input value={newClient.nationality} onChange={fc('nationality')}
                        readOnly={clientMode === 'existing'}
                        className={`${inputCls} ${clientMode === 'existing' ? 'opacity-60 cursor-default' : ''}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Email</label>
                      <input type="email" value={newClient.email} onChange={fc('email')}
                        readOnly={clientMode === 'existing'}
                        className={`${inputCls} ${clientMode === 'existing' ? 'opacity-60 cursor-default' : ''}`} />
                    </div>
                    <div>
                      <label className={labelCls}>Teléfono</label>
                      <input value={newClient.phone} onChange={fc('phone')}
                        readOnly={clientMode === 'existing'}
                        className={`${inputCls} ${clientMode === 'existing' ? 'opacity-60 cursor-default' : ''}`} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Fecha de nacimiento</label>
                    <input type="date" value={newClient.birthDate} onChange={fc('birthDate')}
                      readOnly={clientMode === 'existing'}
                      className={`${inputCls} ${clientMode === 'existing' ? 'opacity-60 cursor-default' : ''}`} />
                  </div>
                </div>
              )}

              {/* Propiedad */}
              <div>
                <label className={labelCls}>{t('bookings.property')} *</label>
                <select value={form.propertyId} onChange={f('propertyId')} className={inputCls}>
                  <option value="">— {t('bookings.property')} —</option>
                  {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t('bookings.checkIn')} *</label>
                  <input type="date" value={form.checkInDate} onChange={f('checkInDate')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t('bookings.checkOut')} *</label>
                  <input type="date" value={form.checkOutDate} onChange={f('checkOutDate')} className={inputCls} />
                </div>
              </div>

              {/* Importe y origen */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t('common.total')} (€) *</label>
                  <input type="number" value={form.totalAmount} onChange={f('totalAmount')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t('bookings.source')}</label>
                  <select value={form.source} onChange={f('source')} className={inputCls}>
                    {['direct','airbnb','booking','vrbo','manual_block'].map(s => (
                      <option key={s} value={s}>{t(`bookings.sources.${s}`)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className={labelCls}>{t('common.notes')}</label>
                <textarea value={form.notes} onChange={f('notes')} rows={2}
                  className={`${inputCls} resize-none`} />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowForm(false); setErrorMsg(''); }}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  {t('common.cancel')}
                </button>
                <button onClick={handleSubmit} disabled={isSubmitDisabled}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  {createMutation.isPending || createClientMutation.isPending ? t('common.saving') : t('bookings.new')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
