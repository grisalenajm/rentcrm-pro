import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const emptyForm = { propertyId:'', categoryId:'', type:'income', amount:'', description:'', date:'' };

export default function Financials() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: summary } = useQuery({
    queryKey: ['financials-summary'],
    queryFn: () => api.get('/financials/summary').then(r => r.data),
  });

  const { data: records = [], isLoading } = useQuery({
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financials'] });
      qc.invalidateQueries({ queryKey: ['financials-summary'] });
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/financials/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financials'] });
      qc.invalidateQueries({ queryKey: ['financials-summary'] });
    },
  });

  const filteredCategories = categories.filter((c: any) => c.type === form.type);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ ...form, categoryId: Number(form.categoryId), amount: Number(form.amount), propertyId: form.propertyId || undefined });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Financiero</h1>
          <p className="text-slate-400 text-sm mt-1">Control de ingresos y gastos</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
          + Nuevo registro
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Ingresos</div>
            <div className="text-2xl font-bold text-emerald-400">€{summary.income.toLocaleString('es-ES', {minimumFractionDigits:2})}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Gastos</div>
            <div className="text-2xl font-bold text-red-400">€{summary.expense.toLocaleString('es-ES', {minimumFractionDigits:2})}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Beneficio</div>
            <div className={`text-2xl font-bold ${summary.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              €{summary.profit.toLocaleString('es-ES', {minimumFractionDigits:2})}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-slate-400 text-center py-20">Cargando...</div>
      ) : records.length === 0 ? (
        <div className="text-slate-400 text-center py-20">No hay registros financieros</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">Fecha</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">Categoría</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">Propiedad</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">Descripción</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">Importe</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r: any) => (
                <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-slate-400">{new Date(r.date).toLocaleDateString('es-ES')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${r.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {r.category?.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{r.property?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{r.description || '—'}</td>
                  <td className={`px-4 py-3 font-semibold ${r.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {r.type === 'income' ? '+' : '-'}€{Number(r.amount).toLocaleString('es-ES', {minimumFractionDigits:2})}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { if(confirm('¿Eliminar registro?')) deleteMutation.mutate(r.id); }}
                      className="px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-5">Nuevo registro</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tipo *</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value, categoryId: ''})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                    <option value="income">{t('financials.income')}</option>
                    <option value="expense">{t('financials.expense')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Fecha *</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Categoría *</label>
                <select value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required>
                  <option value="">{t('common.search') + '...'}</option>
                  {filteredCategories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Propiedad</label>
                <select value={form.propertyId} onChange={e => setForm({...form, propertyId: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                  <option value="">—</option>
                  {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Importe (€) *</label>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Descripción</label>
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={createMutation.isPending}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  {createMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
