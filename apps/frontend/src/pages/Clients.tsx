import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dniPassport?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

const emptyForm = { firstName:'', lastName:'', dniPassport:'', nationality:'', birthDate:'', email:'', phone:'', notes:'' };

function Stars({ score }: { score: number }) {
  return (
    <span className="text-amber-400 text-xs">
      {'★'.repeat(Math.round(score))}{'☆'.repeat(5 - Math.round(score))}
      <span className="text-slate-400 ml-1">({score.toFixed(1)})</span>
    </span>
  );
}

export default function Clients() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => api.get('/clients', { params: { search: search || undefined } }).then(r => r.data),
  });

  const { data: summaries = {} } = useQuery({
    queryKey: ['clients-summaries', clients.map((c: Client) => c.id).join(',')],
    queryFn: async () => {
      if (clients.length === 0) return {};
      const results = await Promise.all(
        clients.map((c: Client) =>
          api.get(`/evaluations/client/${c.id}/summary`)
            .then(r => ({ id: c.id, avgScore: r.data.avgScore, totalBookings: r.data.totalBookings }))
            .catch(() => ({ id: c.id, avgScore: null, totalBookings: 0 }))
        )
      );
      return Object.fromEntries(results.map(r => [r.id, r]));
    },
    enabled: clients.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/clients', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setShowForm(false); setForm(emptyForm); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/clients/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setEditing(null); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (e: React.MouseEvent, c: Client) => {
    e.stopPropagation();
    setEditing(c);
    setForm({ firstName: c.firstName, lastName: c.lastName, dniPassport: c.dniPassport||'',
      nationality: c.nationality||'', birthDate: '', email: c.email||'', phone: c.phone||'', notes: c.notes||'' });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form, birthDate: form.birthDate || undefined };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('clients.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{clients.length} {t('clients.registered')}</p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
          + {t('clients.new')}
        </button>
      </div>

      <div className="mb-4">
        <input placeholder={`${t('common.search')}...`} value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-20">{t('common.loading')}</div>
      ) : clients.length === 0 ? (
        <div className="text-slate-400 text-center py-20">{t('common.noData')}</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('common.name')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('clients.dni')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('common.email')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('common.phone')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('clients.bookings')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('clients.rating')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c: Client) => {
                const s = (summaries as any)[c.id];
                return (
                  <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)}
                    className="border-b border-slate-800 hover:bg-slate-800/70 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-medium">{c.firstName} {c.lastName}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{c.dniPassport || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{s ? s.totalBookings : '—'}</td>
                    <td className="px-4 py-3">
                      {s?.avgScore ? <Stars score={s.avgScore} /> : <span className="text-slate-600 text-xs">{t('clients.noRating')}</span>}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2 justify-end">
                        <button onClick={e => openEdit(e, c)}
                          className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                          {t('common.edit')}
                        </button>
                        <button onClick={e => { e.stopPropagation(); if(confirm(t('common.confirm_delete'))) deleteMutation.mutate(c.id); }}
                          className="px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-5">{editing ? t('common.edit') : t('clients.new')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('clients.firstName')} *</label>
                  <input value={form.firstName} onChange={f('firstName')} required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('clients.lastName')} *</label>
                  <input value={form.lastName} onChange={f('lastName')} required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('clients.dni')}</label>
                  <input value={form.dniPassport} onChange={f('dniPassport')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('clients.nationality')}</label>
                  <input value={form.nationality} onChange={f('nationality')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('clients.birthDate')}</label>
                  <input type="date" value={form.birthDate} onChange={f('birthDate')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('common.phone')}</label>
                  <input value={form.phone} onChange={f('phone')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('common.email')}</label>
                  <input type="email" value={form.email} onChange={f('email')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('common.notes')}</label>
                  <textarea value={form.notes} onChange={f('notes')} rows={3}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">{t('common.cancel')}</button>
                <button type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
                  {editing ? t('common.save') : t('clients.new')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
