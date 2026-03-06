import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  province?: string;
  rooms: number;
  isActive: boolean;
  sesCodigoEstablecimiento?: string;
}

const emptyForm = { name:'', address:'', city:'', province:'', rooms:'1', isActive: true, sesCodigoEstablecimiento:'' };

export default function Properties() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/properties', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setShowForm(false); setForm(emptyForm); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/properties/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setEditing(null); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/properties/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (p: Property) => {
    setEditing(p);
    setForm({ name: p.name, address: p.address, city: p.city, province: p.province||'', rooms: String(p.rooms), isActive: p.isActive, sesCodigoEstablecimiento: (p as any).sesCodigoEstablecimiento||'' });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form, rooms: Number(form.rooms) };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('properties.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{properties.length} {t('properties.registered')}</p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
          + {t('properties.new')}
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-20">{t('common.loading')}</div>
      ) : properties.length === 0 ? (
        <div className="text-slate-400 text-center py-20">{t('common.noData')}</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('common.name')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('common.address')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('common.city')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('properties.province')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('properties.rooms')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('common.status')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p: Property) => (
                <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-slate-400">{p.address}</td>
                  <td className="px-4 py-3 text-slate-400">{p.city}</td>
                  <td className="px-4 py-3 text-slate-400">{p.province || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{p.rooms}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${p.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {p.isActive ? (t('common.status') === 'Status' ? 'Active' : 'Activa') : (t('common.status') === 'Status' ? 'Inactive' : 'Inactiva')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(p)}
                        className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">{t('common.edit')}</button>
                      <button onClick={() => { if(confirm(t('common.confirm_delete'))) deleteMutation.mutate(p.id); }}
                        className="px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">{t('common.delete')}</button>
                    </div>
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
            <h2 className="text-lg font-bold mb-5">{editing ? t('common.edit') : t('properties.new')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('common.name')} *</label>
                  <input value={form.name} onChange={f('name')} required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('common.address')} *</label>
                  <input value={form.address} onChange={f('address')} required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('common.city')} *</label>
                  <input value={form.city} onChange={f('city')} required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('properties.province')}</label>
                  <input value={form.province} onChange={f('province')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('properties.rooms')} *</label>
                  <input type="number" min="1" value={form.rooms} onChange={f('rooms')} required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">🚔 Código SES Establecimiento</label>
                  <input value={form.sesCodigoEstablecimiento} onChange={f('sesCodigoEstablecimiento')}
                    placeholder="0000000002"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                  <p className="text-xs text-slate-500 mt-1">Código asignado a esta propiedad en SES Hospedajes</p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">{t('common.cancel')}</button>
                <button type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
                  {editing ? t('common.save') : t('properties.new')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
