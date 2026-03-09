import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

export default function Financials() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: 'income', amount: '', date: '', description: '',
    categoryId: '', propertyId: '', bookingId: ''
  });

  const { data: financials = [], isLoading } = useQuery({
    queryKey: ['financials'],
    queryFn: () => api.get('/financials').then(r => r.data),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['financial-categories'],
    queryFn: () => api.get('/financials/categories').then(r => r.data),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/financials', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financials'] }); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/financials/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financials'] }),
  });

  const totalIncome  = financials.filter((f: any) => f.type === 'income' ).reduce((s: number, f: any) => s + Number(f.amount), 0);
  const totalExpense = financials.filter((f: any) => f.type === 'expense').reduce((s: number, f: any) => s + Number(f.amount), 0);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('financials.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{financials.length} {t('financials.registered')}</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
          + {t('financials.new')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('financials.income')}</div>
          <div className="text-base md:text-2xl font-bold tabular-nums text-emerald-400">€{totalIncome.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('financials.expense')}</div>
          <div className="text-base md:text-2xl font-bold tabular-nums text-red-400">€{totalExpense.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Balance</div>
          <div className={`text-base md:text-2xl font-bold tabular-nums ${totalIncome - totalExpense >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            €{(totalIncome - totalExpense).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-20">{t('common.loading')}</div>
      ) : financials.length === 0 ? (
        <div className="text-slate-400 text-center py-20">{t('common.noData')}</div>
      ) : (
        <>
          {/* Desktop: tabla */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('common.type')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('financials.category')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('common.date')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('financials.description')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('financials.amount')}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {financials.map((fin: any) => (
                  <tr key={fin.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${fin.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {fin.type === 'income' ? t('financials.income') : t('financials.expense')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{fin.category?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{new Date(fin.date).toLocaleDateString('es-ES')}</td>
                    <td className="px-4 py-3 text-slate-400">{fin.description || '—'}</td>
                    <td className={`px-4 py-3 font-semibold tabular-nums ${fin.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fin.type === 'income' ? '+' : '-'}€{Number(fin.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { if (confirm(t('common.confirm_delete'))) deleteMutation.mutate(fin.id); }}
                        className="px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Móvil: tarjetas */}
          <div className="md:hidden space-y-3">
            {financials.map((fin: any) => (
              <div key={fin.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${fin.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {fin.type === 'income' ? t('financials.income') : t('financials.expense')}
                  </span>
                  <span className={`font-bold tabular-nums ${fin.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fin.type === 'income' ? '+' : '-'}€{Number(fin.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-sm text-white mb-1">{fin.description || '—'}</div>
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>{fin.category?.name || '—'} · {new Date(fin.date).toLocaleDateString('es-ES')}</span>
                  <button onClick={() => { if (confirm(t('common.confirm_delete'))) deleteMutation.mutate(fin.id); }}
                    className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-5">{t('financials.new')}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('common.type')}</label>
                  <select value={form.type} onChange={f('type')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                    <option value="income">{t('financials.income')}</option>
                    <option value="expense">{t('financials.expense')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('financials.amount')} (€) *</label>
                  <input type="number" value={form.amount} onChange={f('amount')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('common.date')} *</label>
                  <input type="date" value={form.date} onChange={f('date')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('financials.category')}</label>
                  <select value={form.categoryId} onChange={f('categoryId')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                    <option value="">—</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('bookings.property')}</label>
                  <select value={form.propertyId} onChange={f('propertyId')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                    <option value="">—</option>
                    {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('financials.description')}</label>
                  <input value={form.description} onChange={f('description')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => createMutation.mutate({
                    ...form,
                    amount: Number(form.amount),
                    propertyId: form.propertyId || undefined,
                    bookingId: form.bookingId || undefined,
                    categoryId: form.categoryId || undefined
                  })}
                  disabled={!form.amount || !form.date || createMutation.isPending}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  {createMutation.isPending ? t('common.saving') : t('financials.new')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
