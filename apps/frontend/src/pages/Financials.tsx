import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import ExcelButtons from '../components/ExcelButtons';

const EXPENSE_TYPES = [
  { value: 'tasas',    label: 'Tasas' },
  { value: 'agua',     label: 'Agua' },
  { value: 'luz',      label: 'Luz' },
  { value: 'internet', label: 'Internet' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'otros',    label: 'Otros' },
];

const EMPTY_FORM    = { propertyId: '', date: '', amount: '', type: 'otros', notes: '', deductible: false };
const EMPTY_FILTERS = { propertyId: '', type: '', from: '', to: '' };

const inputCls = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500';

export default function Financials() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [selectedYear,     setSelectedYear]     = useState(new Date().getFullYear());
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense,   setEditingExpense]   = useState<any>(null);
  const [expenseForm,      setExpenseForm]      = useState({ ...EMPTY_FORM });
  const [showPropertyTable, setShowPropertyTable] = useState(true);
  const [filters,          setFilters]          = useState({ ...EMPTY_FILTERS });
  const [showFilters,      setShowFilters]      = useState(false);

  // Derived query params — from/to default to selected year when not set manually
  const queryFrom = filters.from || `${selectedYear}-01-01`;
  const queryTo   = filters.to   || `${selectedYear}-12-31`;

  const financialsParams: Record<string, string> = { from: queryFrom, to: queryTo };
  if (filters.type)       financialsParams.type       = filters.type;
  if (filters.propertyId) financialsParams.propertyId = filters.propertyId;

  const { data: allFinancials = [] } = useQuery({
    queryKey: ['financials', filters, selectedYear],
    queryFn: () => api.get('/financials', { params: financialsParams }).then((r) => r.data),
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
  });

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses', selectedYear, filters.propertyId],
    queryFn: () =>
      api
        .get('/expenses', {
          params: { year: selectedYear, ...(filters.propertyId && { propertyId: filters.propertyId }) },
        })
        .then((r) => r.data),
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then((r) => r.data),
  });

  const createExpense = useMutation({
    mutationFn: (data: any) => api.post('/expenses', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); closeModal(); },
  });

  const updateExpense = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/expenses/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); closeModal(); },
  });

  const deleteExpense = useMutation({
    mutationFn: (id: number) => api.delete(`/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });

  function openCreate() {
    setEditingExpense(null);
    setExpenseForm({ ...EMPTY_FORM });
    setShowExpenseModal(true);
  }

  function openEdit(exp: any) {
    setEditingExpense(exp);
    setExpenseForm({
      propertyId: exp.propertyId || '',
      date:       exp.date ? exp.date.slice(0, 10) : '',
      amount:     String(exp.amount),
      type:       exp.type || 'otros',
      notes:      exp.notes || '',
      deductible: exp.deductible ?? false,
    });
    setShowExpenseModal(true);
  }

  function closeModal() {
    setShowExpenseModal(false);
    setEditingExpense(null);
    setExpenseForm({ ...EMPTY_FORM });
  }

  function handleSave() {
    const payload = {
      propertyId: expenseForm.propertyId || undefined,
      date:       expenseForm.date,
      amount:     parseFloat(expenseForm.amount),
      type:       expenseForm.type,
      notes:      expenseForm.notes || undefined,
      deductible: expenseForm.deductible,
    };
    if (editingExpense) updateExpense.mutate({ id: editingExpense.id, data: payload });
    else                createExpense.mutate(payload);
  }

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setExpenseForm((prev) => ({ ...prev, [k]: e.target.value }));

  const fCheck = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setExpenseForm((prev) => ({ ...prev, [k]: e.target.checked }));

  const setFilter = (k: keyof typeof EMPTY_FILTERS) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFilters((prev) => ({ ...prev, [k]: e.target.value }));

  function clearFilters() { setFilters({ ...EMPTY_FILTERS }); }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Totals — income from financial ledger, expenses from CRUD table
  const incomeRecords = (allFinancials as any[]).filter((r: any) => r.type === 'income');
  const totalIncome   = incomeRecords.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalExpenses = (expenses as any[]).reduce((s: number, e: any) => s + Number(e.amount), 0);
  const netProfit     = totalIncome - totalExpenses;

  // Per-property breakdown
  const propMap: Record<string, { name: string; income: number; expenses: number }> = {};
  for (const r of incomeRecords) {
    const pid = r.propertyId || '__none__';
    if (!propMap[pid]) propMap[pid] = { name: r.property?.name || 'Sin propiedad', income: 0, expenses: 0 };
    propMap[pid].income += Number(r.amount);
  }
  for (const e of expenses as any[]) {
    const pid = e.propertyId || '__none__';
    if (!propMap[pid]) propMap[pid] = { name: e.property?.name || 'Sin propiedad', income: 0, expenses: 0 };
    propMap[pid].expenses += Number(e.amount);
  }
  const propRows = Object.entries(propMap).map(([, v]) => v).sort((a, b) => b.income - a.income);

  const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const expenseTypeLabel = (val: string) => EXPENSE_TYPES.find((t) => t.value === val)?.label ?? val;
  const isPending = createExpense.isPending || updateExpense.isPending;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">{t('financials.title')}</h1>
        <div className="flex items-center gap-3">
          {/* Year nav */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-1">
            <button
              onClick={() => setSelectedYear((y) => y - 1)}
              className="px-2 py-2 text-slate-400 hover:text-white transition-colors"
            >‹</button>
            <span className="px-3 py-2 text-sm font-bold tabular-nums min-w-[4rem] text-center">
              {selectedYear}
            </span>
            <button
              onClick={() => setSelectedYear((y) => y + 1)}
              className="px-2 py-2 text-slate-400 hover:text-white transition-colors"
            >›</button>
          </div>
          <ExcelButtons entity="expenses" onImportSuccess={() => qc.invalidateQueries({ queryKey: ['expenses'] })} />
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
          >
            + Añadir gasto
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Ingresos</div>
          <div className="text-lg md:text-2xl font-bold tabular-nums text-emerald-400">€{fmt(totalIncome)}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Gastos</div>
          <div className="text-lg md:text-2xl font-bold tabular-nums text-red-400">€{fmt(totalExpenses)}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 col-span-2">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Beneficio neto</div>
          <div className={`text-lg md:text-2xl font-bold tabular-nums ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {netProfit >= 0 ? '+' : ''}€{fmt(netProfit)}
          </div>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl mb-6 overflow-hidden">
        {/* Mobile toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="md:hidden w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors"
        >
          <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            Filtros
            {activeFilterCount > 0 && (
              <span className="bg-emerald-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </span>
          <span className="text-slate-500 text-xs">{showFilters ? '▲' : '▼'}</span>
        </button>

        {/* Filter fields — always visible on md+, collapsible on mobile */}
        <div className={`${showFilters ? 'block' : 'hidden'} md:block px-4 py-3 border-t border-slate-800 md:border-0`}>
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            {/* Propiedad */}
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Propiedad
              </label>
              <select value={filters.propertyId} onChange={setFilter('propertyId')} className={inputCls}>
                <option value="">Todas</option>
                {(properties as any[]).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Tipo */}
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Tipo
              </label>
              <select value={filters.type} onChange={setFilter('type')} className={inputCls}>
                <option value="">Todos</option>
                <option value="income">Ingresos</option>
                <option value="expense">Gastos</option>
              </select>
            </div>

            {/* Desde */}
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Desde
              </label>
              <input
                type="date"
                value={filters.from}
                onChange={setFilter('from')}
                className={inputCls}
              />
            </div>

            {/* Hasta */}
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={filters.to}
                onChange={setFilter('to')}
                className={inputCls}
              />
            </div>

            {/* Clear */}
            <div className="shrink-0">
              <button
                onClick={clearFilters}
                disabled={activeFilterCount === 0}
                className="w-full md:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-slate-300 font-semibold transition-colors whitespace-nowrap"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Per-property table */}
      {propRows.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl mb-6 overflow-hidden">
          <button
            onClick={() => setShowPropertyTable((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors"
          >
            <span className="text-sm font-semibold text-slate-300">Desglose por propiedad</span>
            <span className="text-slate-500 text-xs">{showPropertyTable ? '▲' : '▼'}</span>
          </button>
          {showPropertyTable && (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-slate-800">
                      <th className="text-left px-4 py-3 text-slate-400 font-semibold">Propiedad</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-semibold">Ingresos</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-semibold">Gastos</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-semibold">Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propRows.map((row, i) => {
                      const net = row.income - row.expenses;
                      return (
                        <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{row.name}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-emerald-400">€{fmt(row.income)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-red-400">€{fmt(row.expenses)}</td>
                          <td className={`px-4 py-3 text-right tabular-nums font-semibold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {net >= 0 ? '+' : ''}€{fmt(net)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-700 bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-300">Total</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-400">€{fmt(totalIncome)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-400">€{fmt(totalExpenses)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {netProfit >= 0 ? '+' : ''}€{fmt(netProfit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* Mobile */}
              <div className="md:hidden border-t border-slate-800">
                {propRows.map((row, i) => {
                  const net = row.income - row.expenses;
                  return (
                    <div key={i} className="px-4 py-3 border-b border-slate-800 last:border-0">
                      <div className="font-medium mb-2">{row.name}</div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-slate-500 mb-0.5">Ingresos</div>
                          <div className="tabular-nums text-emerald-400">€{fmt(row.income)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-0.5">Gastos</div>
                          <div className="tabular-nums text-red-400">€{fmt(row.expenses)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-0.5">Neto</div>
                          <div className={`tabular-nums font-semibold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {net >= 0 ? '+' : ''}€{fmt(net)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="px-4 py-3 bg-slate-800/40">
                  <div className="font-semibold text-slate-300 mb-2">Total {selectedYear}</div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Ingresos</div>
                      <div className="tabular-nums text-emerald-400 font-semibold">€{fmt(totalIncome)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Gastos</div>
                      <div className="tabular-nums text-red-400 font-semibold">€{fmt(totalExpenses)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Neto</div>
                      <div className={`tabular-nums font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {netProfit >= 0 ? '+' : ''}€{fmt(netProfit)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Expenses list */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Gastos {selectedYear} ({(expenses as any[]).length})
          {filters.propertyId && (
            <span className="ml-2 text-xs font-normal text-slate-500 normal-case">
              · {(properties as any[]).find((p: any) => p.id === filters.propertyId)?.name}
            </span>
          )}
        </h2>
      </div>

      {loadingExpenses ? (
        <div className="text-slate-400 text-center py-16">{t('common.loading')}</div>
      ) : (expenses as any[]).length === 0 ? (
        <div className="text-slate-500 text-center py-16 text-sm">
          No hay gastos registrados para {selectedYear}
          {filters.propertyId ? ' en esta propiedad' : ''}
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Fecha</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Tipo</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Propiedad</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Notas</th>
                  <th className="text-center px-4 py-3 text-slate-400 font-semibold">Ded.</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-semibold">Importe</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(expenses as any[]).map((exp: any) => (
                  <tr key={exp.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 tabular-nums text-slate-300">
                      {new Date(exp.date).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                        {expenseTypeLabel(exp.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{exp.property?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{exp.notes || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {exp.deductible
                        ? <span className="text-emerald-400 font-bold">✓</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-400">
                      €{fmt(Number(exp.amount))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(exp)}
                          className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => { if (confirm(t('common.confirm_delete'))) deleteExpense.mutate(exp.id); }}
                          className="px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {(expenses as any[]).map((exp: any) => (
              <div key={exp.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                      {expenseTypeLabel(exp.type)}
                    </span>
                    {exp.deductible && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 ml-1">
                        Deducible
                      </span>
                    )}
                    {exp.property?.name && (
                      <span className="text-xs text-slate-500 ml-2">{exp.property.name}</span>
                    )}
                  </div>
                  <span className="font-bold tabular-nums text-red-400">€{fmt(Number(exp.amount))}</span>
                </div>
                {exp.notes && <div className="text-sm text-white mb-2">{exp.notes}</div>}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">
                    {new Date(exp.date).toLocaleDateString('es-ES')}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(exp)}
                      className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => { if (confirm(t('common.confirm_delete'))) deleteExpense.mutate(exp.id); }}
                      className="px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Expense modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[95vh] md:max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold mb-5">
              {editingExpense ? 'Editar gasto' : 'Nuevo gasto'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Fecha *</label>
                  <input type="date" value={expenseForm.date} onChange={f('date')} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Importe (€) *</label>
                  <input type="number" step="0.01" min="0" value={expenseForm.amount} onChange={f('amount')} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tipo *</label>
                  <select value={expenseForm.type} onChange={f('type')} className={inputCls}>
                    {EXPENSE_TYPES.map((et) => (
                      <option key={et.value} value={et.value}>{et.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Propiedad</label>
                  <select value={expenseForm.propertyId} onChange={f('propertyId')} className={inputCls}>
                    <option value="">—</option>
                    {(properties as any[]).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Notas</label>
                  <input
                    value={expenseForm.notes}
                    onChange={f('notes')}
                    placeholder="Descripción opcional"
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={expenseForm.deductible}
                      onChange={fCheck('deductible')}
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                    <span className="text-sm text-slate-300">Deducible (100% factura)</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!expenseForm.date || !expenseForm.amount || isPending}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors"
                >
                  {isPending ? t('common.saving') : editingExpense ? 'Guardar cambios' : 'Añadir gasto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
