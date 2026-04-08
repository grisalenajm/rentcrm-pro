import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import ExcelButtons from '../components/ExcelButtons';
import { useAuth } from '../context/AuthContext';
import { inputCls, labelCls, MODAL_OVERLAY, MODAL_PANEL, BTN_PRIMARY, BTN_SECONDARY } from '../lib/ui';
import PageSizeSelector, { getStoredPageSize } from '../components/PageSizeSelector';

const EXPENSE_TYPES = [
  { value: 'tasas',    label: 'Tasas' },
  { value: 'agua',     label: 'Agua' },
  { value: 'luz',      label: 'Luz' },
  { value: 'internet', label: 'Internet' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'otros',    label: 'Otros' },
];

const FREQUENCIES = [
  { value: 'monthly',   label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'yearly',    label: 'Anual' },
];

const EMPTY_REC_FORM = {
  propertyId: '',
  type: 'otros',
  amount: '',
  deductible: false,
  frequency: 'monthly',
  dayOfMonth: '1',
  notes: '',
  nextRunDate: '',
};

const EMPTY_FORM    = { propertyId: '', date: '', amount: '', type: 'otros', notes: '', deductible: false };
const EMPTY_FILTERS = { propertyId: '', type: '', from: '', to: '' };

async function openPaperlessDoc(documentId: number) {
  const res = await api.post(`/paperless/document/${documentId}/token`);
  const token: string = res.data.token;
  window.open(`/api/paperless/document/${documentId}?access_token=${token}`, '_blank');
}

export default function Financials() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [selectedYear,     setSelectedYear]     = useState(new Date().getFullYear());
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense,   setEditingExpense]   = useState<any>(null);
  const [expenseForm,      setExpenseForm]      = useState({ ...EMPTY_FORM });
  const [showPropertyTable, setShowPropertyTable] = useState(true);
  const [filters,          setFilters]          = useState({ ...EMPTY_FILTERS });
  const [showFilters,      setShowFilters]      = useState(false);

  // ── Edición masiva (gastos) ────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);

  // Recurring expenses state
  const [showRecModal,   setShowRecModal]   = useState(false);
  const [editingRec,     setEditingRec]     = useState<any>(null);
  const [recForm,        setRecForm]        = useState({ ...EMPTY_REC_FORM });
  const canEditRec = user?.role === 'admin' || user?.role === 'owner';

  // ── Paginación client-side para gastos ────────────────────────────────
  const [pageSize, setPageSize]             = useState(() => getStoredPageSize('expenses'));
  const [displayCount, setDisplayCount]     = useState(() => getStoredPageSize('expenses'));
  const expenseSentinelRef                  = useRef<HTMLDivElement | null>(null);
  const expenseObserverRef                  = useRef<IntersectionObserver | null>(null);

  // Reset displayCount when year/property filter changes
  useEffect(() => {
    setDisplayCount(pageSize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, filters.propertyId, pageSize]);

  const loadMoreExpenses = useCallback(() => {
    setDisplayCount(n => n + pageSize);
  }, [pageSize]);

  const loadMoreExpensesRef = useRef(loadMoreExpenses);
  useEffect(() => { loadMoreExpensesRef.current = loadMoreExpenses; });

  const expenseSentinel = useCallback((el: HTMLDivElement | null) => {
    expenseSentinelRef.current = el;
    expenseObserverRef.current?.disconnect();
    if (!el) { expenseObserverRef.current = null; return; }
    expenseObserverRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMoreExpensesRef.current();
    }, { threshold: 0 });
    expenseObserverRef.current.observe(el);
  }, []);

  useEffect(() => () => { expenseObserverRef.current?.disconnect(); }, []);

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

  const { data: org } = useQuery({
    queryKey: ['organization'],
    queryFn: () => api.get('/organization').then((r) => r.data),
    staleTime: 60_000,
  });

  // Ingresos de reservas (Booking.totalAmount, status != cancelled)
  const { data: bookingsRaw = [] } = useQuery({
    queryKey: ['bookings-income', selectedYear, filters.propertyId],
    queryFn: () =>
      api.get('/bookings', { params: { limit: 1000 } }).then((r) => {
        const data = r.data?.data || r.data;
        return Array.isArray(data) ? data : [];
      }),
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
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

  // Recurring expenses queries/mutations
  const { data: recurringExpenses = [] } = useQuery({
    queryKey: ['recurring-expenses', filters.propertyId],
    queryFn: () =>
      api.get('/recurring-expenses', {
        params: filters.propertyId ? { propertyId: filters.propertyId } : {},
      }).then((r) => r.data),
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
  });

  const createRec = useMutation({
    mutationFn: (data: any) => api.post('/recurring-expenses', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring-expenses'] }); closeRecModal(); },
  });

  const updateRec = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/recurring-expenses/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring-expenses'] }); closeRecModal(); },
  });

  const deleteRec = useMutation({
    mutationFn: (id: string) => api.delete(`/recurring-expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-expenses'] }),
  });

  const toggleRec = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.put(`/recurring-expenses/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-expenses'] }),
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

  function openCreateRec() {
    setEditingRec(null);
    setRecForm({ ...EMPTY_REC_FORM });
    setShowRecModal(true);
  }

  function openEditRec(rec: any) {
    setEditingRec(rec);
    setRecForm({
      propertyId:  rec.propertyId || '',
      type:        rec.type || 'otros',
      amount:      String(rec.amount),
      deductible:  rec.deductible ?? false,
      frequency:   rec.frequency || 'monthly',
      dayOfMonth:  String(rec.dayOfMonth),
      notes:       rec.notes || '',
      nextRunDate: rec.nextRunDate ? rec.nextRunDate.slice(0, 10) : '',
    });
    setShowRecModal(true);
  }

  function closeRecModal() {
    setShowRecModal(false);
    setEditingRec(null);
    setRecForm({ ...EMPTY_REC_FORM });
  }

  function handleSaveRec() {
    const payload: any = {
      propertyId:  recForm.propertyId,
      type:        recForm.type,
      amount:      parseFloat(recForm.amount),
      deductible:  recForm.deductible,
      frequency:   recForm.frequency,
      dayOfMonth:  parseInt(recForm.dayOfMonth, 10),
      notes:       recForm.notes || undefined,
      nextRunDate: recForm.nextRunDate,
    };
    if (editingRec) updateRec.mutate({ id: editingRec.id, data: payload });
    else            createRec.mutate(payload);
  }

  const rf = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setRecForm((prev) => ({ ...prev, [k]: e.target.value }));
  const rfCheck = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRecForm((prev) => ({ ...prev, [k]: e.target.checked }));

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Totals — income from financial ledger + bookings, expenses from CRUD table
  const incomeRecords = (allFinancials as any[]).filter((r: any) => r.type === 'income');
  const financialIncome = incomeRecords.reduce((s: number, r: any) => s + Number(r.amount), 0);

  // Booking income: non-cancelled bookings whose checkInDate falls in the selected year
  const bookingIncomeRecords = (bookingsRaw as any[]).filter((b: any) => {
    if (b.status === 'cancelled') return false;
    const year = new Date(b.checkInDate || b.checkIn || '').getFullYear();
    if (year !== selectedYear) return false;
    if (filters.propertyId && b.property?.id !== filters.propertyId) return false;
    return true;
  });
  console.log('[Financials] allFinancials:', allFinancials, 'bookingIncomeRecords:', bookingIncomeRecords);

  const bookingIncome = bookingIncomeRecords.reduce((s: number, b: any) => s + Number(b.totalAmount || 0), 0);
  const totalIncome   = financialIncome + bookingIncome;
  const totalExpenses = (expenses as any[]).reduce((s: number, e: any) => s + Number(e.amount), 0);
  const netProfit     = totalIncome - totalExpenses;

  // Per-property breakdown
  const propMap: Record<string, { name: string; income: number; expenses: number }> = {};
  for (const r of incomeRecords) {
    const pid = r.propertyId || '__none__';
    if (!propMap[pid]) propMap[pid] = { name: r.property?.name || 'Sin propiedad', income: 0, expenses: 0 };
    propMap[pid].income += Number(r.amount);
  }
  for (const b of bookingIncomeRecords) {
    const pid = b.property?.id || b.propertyId || '__none__';
    if (!propMap[pid]) propMap[pid] = { name: b.property?.name || 'Sin propiedad', income: 0, expenses: 0 };
    propMap[pid].income += Number(b.totalAmount || 0);
  }
  for (const e of expenses as any[]) {
    const pid = e.propertyId || '__none__';
    if (!propMap[pid]) propMap[pid] = { name: e.property?.name || 'Sin propiedad', income: 0, expenses: 0 };
    propMap[pid].expenses += Number(e.amount);
  }
  const propRows = Object.entries(propMap).map(([, v]) => v).sort((a, b) => b.income - a.income);

  // ── Bulk helpers (expenses) ────────────────────────────────────────────
  const displayedExpenses = (expenses as any[]).slice(0, displayCount);
  const allVisibleSelected = displayedExpenses.length > 0 && displayedExpenses.every((e: any) => selectedIds.has(e.id));
  const toggleAll = () => {
    if (allVisibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayedExpenses.map((e: any) => e.id)));
  };
  const toggleOne = (id: number) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const cancelBulk = () => { setSelectedIds(new Set()); setBulkAction(''); setBulkValue(''); setBulkResult(null); };
  const applyBulk = async () => {
    if (!bulkAction || !bulkValue || bulkLoading) return;
    setBulkLoading(true); setBulkResult(null);
    const results = await Promise.allSettled(
      Array.from(selectedIds).map(id => {
        const exp = (expenses as any[]).find((e: any) => e.id === id);
        if (!exp) return Promise.reject('Not found');
        const payload = {
          propertyId: exp.propertyId || undefined,
          date: exp.date,
          amount: Number(exp.amount),
          type: bulkAction === 'type' ? bulkValue : exp.type,
          notes: exp.notes || undefined,
          deductible: bulkAction === 'deductible' ? bulkValue === 'true' : exp.deductible,
        };
        return api.put(`/expenses/${id}`, payload);
      })
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    const errors = [...new Set(rejected.map(r => r.reason?.response?.data?.message || r.reason?.message || 'Error desconocido'))];
    setBulkLoading(false); setBulkResult({ ok, fail: rejected.length, errors });
    qc.invalidateQueries({ queryKey: ['expenses'] });
    if (rejected.length === 0) cancelBulk();
  };

  const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const expenseTypeLabel = (val: string) => EXPENSE_TYPES.find((t) => t.value === val)?.label ?? val;
  const freqLabel = (val: string) => FREQUENCIES.find((f) => f.value === val)?.label ?? val;
  const isPending = createExpense.isPending || updateExpense.isPending;
  const isRecPending = createRec.isPending || updateRec.isPending;

  return (
    <div className={`p-4 md:p-6 max-w-6xl mx-auto${selectedIds.size > 0 ? ' pb-24' : ''}`}>
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
              <label className={labelCls}>
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
              <label className={labelCls}>
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
              <label className={labelCls}>
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
              <label className={labelCls}>
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
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Gastos {selectedYear} ({(expenses as any[]).length})
          {filters.propertyId && (
            <span className="ml-2 text-xs font-normal text-slate-500 normal-case">
              · {(properties as any[]).find((p: any) => p.id === filters.propertyId)?.name}
            </span>
          )}
        </h2>
        <PageSizeSelector
          listKey="expenses"
          value={pageSize}
          onChange={size => { setPageSize(size); setDisplayCount(size); }}
        />
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
                  <th className="pl-4 py-3 w-10">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer" />
                  </th>
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
                {displayedExpenses.map((exp: any) => (
                  <tr key={exp.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <td className="pl-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(exp.id)} onChange={() => toggleOne(exp.id)}
                        className="w-4 h-4 accent-emerald-500 rounded cursor-pointer" />
                    </td>
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
                        {exp.paperlessDocumentId && (
                          <button
                            onClick={() => openPaperlessDoc(exp.paperlessDocumentId!)}
                            className="px-3 py-1 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Ver factura
                          </button>
                        )}
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
            {displayedExpenses.map((exp: any) => (
              <div key={exp.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={selectedIds.has(exp.id)} onChange={() => toggleOne(exp.id)}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer shrink-0" />
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
                    {exp.paperlessDocumentId && (
                      <button
                        onClick={() => openPaperlessDoc(exp.paperlessDocumentId!)}
                        className="px-2 py-1 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Ver factura
                      </button>
                    )}
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

          {/* Sentinel infinite scroll (client-side) */}
          <div ref={expenseSentinel} className="h-1" />
          {displayCount < (expenses as any[]).length && (
            <div className="text-slate-400 text-center py-6 text-sm">{t('common.loading')}</div>
          )}
          {displayCount >= (expenses as any[]).length && (expenses as any[]).length > 0 && (
            <div className="text-slate-500 text-center py-4 text-xs">No hay más registros</div>
          )}
        </>
      )}

      {/* ── Barra de edición masiva (gastos) ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 px-4 py-3 flex flex-wrap items-center gap-3 shadow-2xl">
          <span className="text-sm font-semibold text-white whitespace-nowrap">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div className="hidden sm:block h-4 w-px bg-slate-600" />
          <select value={bulkAction} onChange={e => { setBulkAction(e.target.value); setBulkValue(''); setBulkResult(null); }}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
            <option value="">— Acción —</option>
            <option value="type">Cambiar tipo</option>
            <option value="deductible">Marcar deducible</option>
          </select>
          {bulkAction === 'type' && (
            <select value={bulkValue} onChange={e => { setBulkValue(e.target.value); setBulkResult(null); }}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
              <option value="">— Tipo —</option>
              {EXPENSE_TYPES.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
            </select>
          )}
          {bulkAction === 'deductible' && (
            <select value={bulkValue} onChange={e => { setBulkValue(e.target.value); setBulkResult(null); }}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
              <option value="">— Valor —</option>
              <option value="true">Sí (deducible)</option>
              <option value="false">No (no deducible)</option>
            </select>
          )}
          {bulkResult && (
            <div className="flex flex-col gap-1 text-xs font-semibold">
              <span className={bulkResult.fail > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                {bulkResult.fail > 0 ? `✓ ${bulkResult.ok} OK · ✗ ${bulkResult.fail} error` : `✓ ${bulkResult.ok} actualizados`}
              </span>
              {bulkResult.errors.length > 0 && (
                <ul className="max-h-16 overflow-y-auto space-y-0.5">
                  {bulkResult.errors.map((e, i) => (
                    <li key={i} className="text-red-400 font-normal">{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={applyBulk} disabled={!bulkAction || !bulkValue || bulkLoading}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors">
              {bulkLoading ? '...' : 'Aplicar'}
            </button>
            <button onClick={cancelBulk}
              className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Gastos recurrentes ───────────────────────────────────────────── */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Gastos recurrentes ({(recurringExpenses as any[]).length})
          </h2>
          {canEditRec && (
            <button
              onClick={openCreateRec}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
            >
              + Nuevo gasto recurrente
            </button>
          )}
        </div>

        {(recurringExpenses as any[]).length === 0 ? (
          <div className="text-slate-500 text-center py-10 text-sm">
            No hay gastos recurrentes configurados
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-4 py-3 text-slate-400 font-semibold">Propiedad</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-semibold">Tipo</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-semibold">Importe</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-semibold">Frecuencia</th>
                    <th className="text-center px-4 py-3 text-slate-400 font-semibold">Día</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-semibold">Próxima gen.</th>
                    <th className="text-center px-4 py-3 text-slate-400 font-semibold">Activo</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {(recurringExpenses as any[]).map((rec: any) => (
                    <tr key={rec.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-slate-300">{rec.property?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                          {expenseTypeLabel(rec.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-400">
                        €{fmt(Number(rec.amount))}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{freqLabel(rec.frequency)}</td>
                      <td className="px-4 py-3 text-center text-slate-400">{rec.dayOfMonth}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-300">
                        {rec.nextRunDate ? new Date(rec.nextRunDate).toLocaleDateString('es-ES') : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {canEditRec ? (
                          <button
                            onClick={() => toggleRec.mutate({ id: rec.id, active: !rec.active })}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rec.active ? 'bg-emerald-600' : 'bg-slate-700'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${rec.active ? 'translate-x-4' : 'translate-x-1'}`} />
                          </button>
                        ) : (
                          <span className={rec.active ? 'text-emerald-400' : 'text-slate-600'}>
                            {rec.active ? '✓' : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canEditRec && (
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => openEditRec(rec)}
                              className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => { if (confirm(t('common.confirm_delete'))) deleteRec.mutate(rec.id); }}
                              className="px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                            >
                              {t('common.delete')}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3">
              {(recurringExpenses as any[]).map((rec: any) => (
                <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                        {expenseTypeLabel(rec.type)}
                      </span>
                      {rec.property?.name && (
                        <span className="text-xs text-slate-500 ml-2">{rec.property.name}</span>
                      )}
                    </div>
                    <span className="font-bold tabular-nums text-red-400">€{fmt(Number(rec.amount))}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-slate-400 mb-3">
                    <div><span className="text-slate-500">Frecuencia:</span> {freqLabel(rec.frequency)}</div>
                    <div><span className="text-slate-500">Día:</span> {rec.dayOfMonth}</div>
                    <div><span className="text-slate-500">Próxima:</span> {rec.nextRunDate ? new Date(rec.nextRunDate).toLocaleDateString('es-ES') : '—'}</div>
                  </div>
                  {rec.notes && <div className="text-sm text-white mb-2">{rec.notes}</div>}
                  <div className="flex justify-between items-center">
                    {canEditRec ? (
                      <button
                        onClick={() => toggleRec.mutate({ id: rec.id, active: !rec.active })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rec.active ? 'bg-emerald-600' : 'bg-slate-700'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${rec.active ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    ) : (
                      <span className={`text-xs ${rec.active ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {rec.active ? 'Activo' : 'Inactivo'}
                      </span>
                    )}
                    {canEditRec && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditRec(rec)}
                          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => { if (confirm(t('common.confirm_delete'))) deleteRec.mutate(rec.id); }}
                          className="px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Recurring expense modal */}
      {showRecModal && (
        <div className={MODAL_OVERLAY}>
          <div className={`${MODAL_PANEL} max-h-[95vh] md:max-h-[90vh] overflow-y-auto`}>
            <h2 className="text-lg font-bold mb-5">
              {editingRec ? 'Editar gasto recurrente' : 'Nuevo gasto recurrente'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Propiedad *</label>
                  <select value={recForm.propertyId} onChange={rf('propertyId')} className={inputCls}>
                    <option value="">— Selecciona propiedad —</option>
                    {(properties as any[]).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tipo *</label>
                  <select value={recForm.type} onChange={rf('type')} className={inputCls}>
                    {EXPENSE_TYPES.map((et) => (
                      <option key={et.value} value={et.value}>{et.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Importe (€) *</label>
                  <input type="number" step="0.01" min="0" value={recForm.amount} onChange={rf('amount')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Frecuencia *</label>
                  <select value={recForm.frequency} onChange={rf('frequency')} className={inputCls}>
                    {FREQUENCIES.map((fr) => (
                      <option key={fr.value} value={fr.value}>{fr.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Día del mes (1-28) *</label>
                  <input type="number" min="1" max="28" value={recForm.dayOfMonth} onChange={rf('dayOfMonth')} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Primera generación *</label>
                  <input type="date" value={recForm.nextRunDate} onChange={rf('nextRunDate')} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Notas</label>
                  <textarea
                    value={recForm.notes}
                    onChange={rf('notes')}
                    rows={2}
                    placeholder="Descripción opcional"
                    className={inputCls + ' resize-none'}
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={recForm.deductible}
                      onChange={rfCheck('deductible')}
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                    <span className="text-sm text-slate-300">Deducible (100% factura)</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeRecModal}
                  className={`flex-1 ${BTN_SECONDARY}`}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSaveRec}
                  disabled={!recForm.propertyId || !recForm.amount || !recForm.nextRunDate || isRecPending}
                  className={`flex-1 ${BTN_PRIMARY}`}
                >
                  {isRecPending ? t('common.saving') : editingRec ? 'Guardar cambios' : 'Crear gasto recurrente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expense modal */}
      {showExpenseModal && (
        <div className={MODAL_OVERLAY}>
          <div className={`${MODAL_PANEL} max-h-[95vh] md:max-h-[90vh] overflow-y-auto`}>
            <h2 className="text-lg font-bold mb-5">
              {editingExpense ? 'Editar gasto' : 'Nuevo gasto'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Fecha *</label>
                  <input type="date" value={expenseForm.date} onChange={f('date')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Importe (€) *</label>
                  <input type="number" step="0.01" min="0" value={expenseForm.amount} onChange={f('amount')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Tipo *</label>
                  <select value={expenseForm.type} onChange={f('type')} className={inputCls}>
                    {EXPENSE_TYPES.map((et) => (
                      <option key={et.value} value={et.value}>{et.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Propiedad</label>
                  <select value={expenseForm.propertyId} onChange={f('propertyId')} className={inputCls}>
                    <option value="">—</option>
                    {(properties as any[]).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Notas</label>
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
                  className={`flex-1 ${BTN_SECONDARY}`}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!expenseForm.date || !expenseForm.amount || isPending}
                  className={`flex-1 ${BTN_PRIMARY}`}
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
