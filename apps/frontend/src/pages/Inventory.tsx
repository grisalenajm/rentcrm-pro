import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  api,
  getMaterials, createMaterial, updateMaterial,
  getMaterialBarcodeUrl,
  getStock, getStockMovements, getStockValuation,
  createStockMovement,
} from '../lib/api';
import {
  CARD, badgeCls,
  BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER,
  inputCls, labelCls, selCls,
  MODAL_OVERLAY, MODAL_PANEL,
  SKELETON,
} from '../lib/ui';

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  limpieza: 'bg-blue-500/15 text-blue-400',
  baño:     'bg-purple-500/15 text-purple-400',
  regalos:  'bg-pink-500/15 text-pink-400',
  otros:    'bg-slate-500/15 text-slate-400',
};

const MOV_COLORS: Record<string, string> = {
  entrada:  'bg-emerald-500/15 text-emerald-400',
  salida:   'bg-red-500/15 text-red-400',
  recuento: 'bg-amber-500/15 text-amber-400',
};

const TYPES = ['limpieza', 'baño', 'regalos', 'otros'] as const;
const UNITS = ['ud', 'kg', 'g', 'l', 'ml', 'm', 'm2', 'pack', 'caja', 'rollo', 'paquete', 'botella', 'unidad', 'docena', 'bolsa', 'tubo', 'bote'] as const;

const EMPTY_MAT_FORM = {
  name: '', description: '', type: 'limpieza', unit: 'ud', standardPrice: '', minStock: '0',
};

const fmtEur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
const fmtNum = (n: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(n);
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

type MainTab = 'masterData' | 'stock' | 'recount';
type StockSubTab = 'current' | 'movements' | 'valuation';

// ── Movement Modal (inline) ────────────────────────────────────────────────────

interface MovModalProps {
  propertyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function MovementModal({ propertyId, onClose, onSuccess }: MovModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [movType, setMovType] = useState<'entrada' | 'salida'>('entrada');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: materialResults = [] } = useQuery({
    queryKey: ['materials-search', materialSearch],
    queryFn: () => getMaterials({ search: materialSearch, isActive: true }),
    enabled: materialSearch.length >= 2,
    staleTime: 10_000,
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !searchRef.current?.contains(e.target as Node)
      ) setShowDropdown(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function selectMaterial(mat: any) {
    setSelectedMaterial(mat);
    setMaterialSearch(mat.name);
    setShowDropdown(false);
    if (movType === 'entrada' && mat.standardPrice) setUnitPrice(String(mat.standardPrice));
  }

  async function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const val = materialSearch.trim();
    if (!val.toUpperCase().startsWith('MAT-')) return;
    e.preventDefault();
    try {
      const results = await getMaterials({ search: val, isActive: true });
      if (results.length > 0) selectMaterial(results[0]);
    } catch { /* ignore */ }
  }

  const mutation = useMutation({
    mutationFn: createStockMovement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock', propertyId] });
      qc.invalidateQueries({ queryKey: ['stock-movements', propertyId] });
      qc.invalidateQueries({ queryKey: ['stock-valuation', propertyId] });
      onSuccess();
    },
    onError: (err: any) => setError(err.response?.data?.message || err.message || 'Error'),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedMaterial) { setError('Selecciona un material'); return; }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { setError('La cantidad debe ser mayor que 0'); return; }
    setSaving(true);
    try {
      await mutation.mutateAsync({
        propertyId,
        materialId: selectedMaterial.id,
        type: movType,
        quantity: movType === 'salida' ? -Math.abs(qty) : qty,
        unitPrice: movType === 'entrada' ? parseFloat(unitPrice) || 0 : 0,
        notes: notes.trim() || undefined,
      });
    } finally { setSaving(false); }
  }

  return (
    <div className={MODAL_OVERLAY} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${MODAL_PANEL} md:max-w-md w-full`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{t('inventory.addMovement')}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Material search */}
          <div className="relative">
            <label className={labelCls}>{t('inventory.material')}</label>
            <input
              ref={searchRef}
              type="text"
              className={inputCls}
              placeholder={t('inventory.selectMaterial')}
              value={materialSearch}
              onChange={(e) => {
                setMaterialSearch(e.target.value);
                setSelectedMaterial(null);
                setShowDropdown(e.target.value.length >= 2);
              }}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => materialSearch.length >= 2 && setShowDropdown(true)}
              autoComplete="off"
            />
            {showDropdown && (materialResults as any[]).length > 0 && (
              <div ref={dropdownRef} className="absolute z-50 w-full mt-1 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                {(materialResults as any[]).map((mat: any) => (
                  <button key={mat.id} type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 text-sm text-white/80 transition-colors"
                    onMouseDown={() => selectMaterial(mat)}>
                    <span className="font-medium text-white">{mat.name}</span>
                    <span className="ml-2 text-white/40 text-xs">{mat.unit} · {mat.barcode}</span>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && materialSearch.length >= 2 && (materialResults as any[]).length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl px-4 py-3 text-sm text-white/40">
                Sin resultados
              </div>
            )}
          </div>

          {/* Movement type */}
          <div>
            <label className={labelCls}>{t('inventory.movementType')}</label>
            <div className="flex gap-2">
              {(['entrada', 'salida'] as const).map((type) => (
                <button key={type} type="button"
                  onClick={() => {
                    setMovType(type);
                    if (type === 'entrada' && selectedMaterial?.standardPrice) setUnitPrice(String(selectedMaterial.standardPrice));
                    else if (type === 'salida') setUnitPrice('');
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    movType === type
                      ? type === 'entrada' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
                  }`}>
                  {t(`inventory.${type}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className={labelCls}>
              {t('inventory.quantity')}
              {selectedMaterial && <span className="ml-1 text-white/30 normal-case font-normal">({selectedMaterial.unit})</span>}
            </label>
            <input type="number" min="0.001" step="any" className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>

          {/* Unit price — entrada only */}
          {movType === 'entrada' && (
            <div>
              <label className={labelCls}>{t('inventory.unitPrice')} (€)</label>
              <input type="number" min="0" step="0.01" className={inputCls} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0.00" />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelCls}>{t('common.notes')} <span className="text-white/30 normal-case font-normal">(opcional)</span></label>
            <input type="text" className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={255} />
          </div>

          {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={`${BTN_SECONDARY} flex-1`}>{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className={`${BTN_PRIMARY} flex-1`}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Inventory() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<MainTab>('masterData');

  // ── Master Data state ──────────────────────────────────────────────────────
  const [matSearch, setMatSearch] = useState('');
  const [matFilterType, setMatFilterType] = useState('');
  const [matFilterStatus, setMatFilterStatus] = useState<'all' | 'true' | 'false'>('all');
  const [matModalOpen, setMatModalOpen] = useState(false);
  const [matEditing, setMatEditing] = useState<any>(null);
  const [matForm, setMatForm] = useState({ ...EMPTY_MAT_FORM });
  const [matSaving, setMatSaving] = useState(false);

  // ── Stock state ────────────────────────────────────────────────────────────
  const [stockPropertyId, setStockPropertyId] = useState('');
  const [stockSubTab, setStockSubTab] = useState<StockSubTab>('current');
  const [stockTypeFilter, setStockTypeFilter] = useState('');
  const [alertsOpen, setAlertsOpen] = useState(true);
  const [movModalOpen, setMovModalOpen] = useState(false);
  // Movement filters
  const [movMaterialFilter, setMovMaterialFilter] = useState('');
  const [movTypeFilter, setMovTypeFilter] = useState('');
  const [movFrom, setMovFrom] = useState('');
  const [movTo, setMovTo] = useState('');

  // ── Recount state ──────────────────────────────────────────────────────────
  const [rcPropertyId, setRcPropertyId] = useState('');
  const [rcObserved, setRcObserved] = useState<Record<string, string>>({});
  const [rcSaving, setRcSaving] = useState(false);
  const [rcSaved, setRcSaved] = useState(false);
  const [rcSavedCount, setRcSavedCount] = useState(0);

  // ── Queries: Properties ────────────────────────────────────────────────────
  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then((r) => r.data),
    staleTime: 60_000,
  });

  // ── Queries: Materials ─────────────────────────────────────────────────────
  const { data: materials = [], isLoading: matLoading } = useQuery({
    queryKey: ['materials', matSearch, matFilterType, matFilterStatus],
    queryFn: () => getMaterials({
      ...(matSearch ? { search: matSearch } : {}),
      ...(matFilterType ? { type: matFilterType } : {}),
      ...(matFilterStatus !== 'all' ? { isActive: matFilterStatus === 'true' } : {}),
    }),
    staleTime: 30_000,
    enabled: mainTab === 'masterData',
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => updateMaterial(id, { isActive: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials'] }),
  });

  // ── Queries: Stock current ─────────────────────────────────────────────────
  const { data: stockItems = [], isLoading: stockLoading } = useQuery({
    queryKey: ['stock', stockPropertyId],
    queryFn: () => getStock(stockPropertyId),
    enabled: !!stockPropertyId && mainTab === 'stock',
    staleTime: 30_000,
  });

  const movParams = useMemo(() => ({
    ...(movMaterialFilter ? { materialId: movMaterialFilter } : {}),
    ...(movTypeFilter ? { type: movTypeFilter } : {}),
    ...(movFrom ? { from: movFrom } : {}),
    ...(movTo ? { to: movTo } : {}),
  }), [movMaterialFilter, movTypeFilter, movFrom, movTo]);

  const { data: movements = [], isLoading: movLoading } = useQuery({
    queryKey: ['stock-movements', stockPropertyId, movParams],
    queryFn: () => getStockMovements(stockPropertyId, movParams),
    enabled: !!stockPropertyId && mainTab === 'stock' && stockSubTab === 'movements',
    staleTime: 30_000,
    keepPreviousData: true,
  } as any);

  const { data: valuation, isLoading: valLoading } = useQuery({
    queryKey: ['stock-valuation', stockPropertyId],
    queryFn: () => getStockValuation(stockPropertyId),
    enabled: !!stockPropertyId && mainTab === 'stock' && stockSubTab === 'valuation',
    staleTime: 30_000,
  });

  // ── Queries: Recount stock ─────────────────────────────────────────────────
  const { data: rcStockItems = [], isLoading: rcLoading } = useQuery({
    queryKey: ['stock', rcPropertyId],
    queryFn: () => getStock(rcPropertyId),
    enabled: !!rcPropertyId && mainTab === 'recount',
    staleTime: 30_000,
  });

  // ── Derived: Stock current ─────────────────────────────────────────────────
  const filteredStock = useMemo(() => {
    const items = stockItems as any[];
    return stockTypeFilter ? items.filter((i) => i.material?.type === stockTypeFilter) : items;
  }, [stockItems, stockTypeFilter]);

  const stockTypes = useMemo(() => {
    const types = new Set((stockItems as any[]).map((i: any) => i.material?.type).filter(Boolean));
    return Array.from(types) as string[];
  }, [stockItems]);

  const movMaterials = useMemo(() => {
    const seen = new Map<string, string>();
    (movements as any[]).forEach((m: any) => { if (m.materialId && m.material?.name) seen.set(m.materialId, m.material.name); });
    return Array.from(seen.entries()) as [string, string][];
  }, [movements]);

  // ── Derived: Recount ──────────────────────────────────────────────────────
  const rcActiveMaterials = useMemo(
    () => (rcStockItems as any[]).filter((i: any) => i.material?.isActive !== false),
    [rcStockItems],
  );

  const rcRows = useMemo(() =>
    rcActiveMaterials.map((item: any) => {
      const calculated = item.currentStock ?? 0;
      const rawObs = rcObserved[item.materialId];
      const observedQty = rawObs !== undefined && rawObs !== '' ? parseFloat(rawObs) : calculated;
      const diff = isNaN(observedQty) ? 0 : observedQty - calculated;
      return { ...item, calculated, observedQty, diff, rawObs };
    }),
    [rcActiveMaterials, rcObserved],
  );

  const rcChangedRows = useMemo(() => rcRows.filter((r) => !isNaN(r.diff) && r.diff !== 0), [rcRows]);
  const rcHasChanges = rcChangedRows.length > 0;

  // ── Handlers: Master Data ─────────────────────────────────────────────────
  function openMatCreate() {
    setMatEditing(null);
    setMatForm({ ...EMPTY_MAT_FORM });
    setMatModalOpen(true);
  }

  function openMatEdit(mat: any) {
    setMatEditing(mat);
    setMatForm({
      name: mat.name, description: mat.description ?? '',
      type: mat.type, unit: mat.unit,
      standardPrice: String(mat.standardPrice), minStock: String(mat.minStock ?? 0),
    });
    setMatModalOpen(true);
  }

  async function handleMatSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMatSaving(true);
    try {
      const payload = {
        name: matForm.name, description: matForm.description || undefined,
        type: matForm.type, unit: matForm.unit,
        standardPrice: parseFloat(matForm.standardPrice),
        minStock: parseFloat(matForm.minStock) || 0,
      };
      if (matEditing) await updateMaterial(matEditing.id, payload);
      else await createMaterial(payload);
      await qc.invalidateQueries({ queryKey: ['materials'] });
      setMatModalOpen(false);
    } finally { setMatSaving(false); }
  }

  function handleMatDeactivate(mat: any) {
    if (!window.confirm(t('inventory.confirmDelete'))) return;
    deactivateMutation.mutate(mat.id);
  }

  function matField(field: keyof typeof matForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setMatForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  // ── Handler: Recount ──────────────────────────────────────────────────────
  async function handleRcSave() {
    if (!rcHasChanges || !rcPropertyId) return;
    setRcSaving(true);
    try {
      const items = rcChangedRows.map((r) => ({ materialId: r.materialId, quantity: r.observedQty }));
      await api.post(`/stock/recount/${rcPropertyId}`, { items });
      setRcSavedCount(items.length);
      setRcSaved(true);
      setRcObserved({});
      qc.invalidateQueries({ queryKey: ['stock', rcPropertyId] });
    } catch (err) { console.error(err); }
    finally { setRcSaving(false); }
  }

  // ── Render: Tab pills ──────────────────────────────────────────────────────
  const mainTabs: { id: MainTab; label: string }[] = [
    { id: 'masterData', label: t('inventory.masterData') },
    { id: 'stock',      label: t('inventory.stock') },
    { id: 'recount',    label: t('inventory.recount') },
  ];

  const stockSubTabs: { id: StockSubTab; label: string }[] = [
    { id: 'current',   label: t('inventory.currentStock') },
    { id: 'movements', label: t('inventory.movements') },
    { id: 'valuation', label: t('inventory.valuation') },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t('nav.inventory')}</h1>
      </div>

      {/* Main tabs */}
      <div className="flex border-b border-slate-800">
        {mainTabs.map((tab) => (
          <button key={tab.id} onClick={() => setMainTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              mainTab === tab.id ? 'border-indigo-500 text-white' : 'border-transparent text-white/40 hover:text-white/70'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1 — MASTER DATA
      ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'masterData' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <input
                className={`${inputCls} flex-1`}
                placeholder={t('inventory.searchMaterial')}
                value={matSearch}
                onChange={(e) => setMatSearch(e.target.value)}
              />
              <select className={`${selCls} sm:w-44`} value={matFilterType} onChange={(e) => setMatFilterType(e.target.value)}>
                <option value="">Todos los tipos</option>
                {TYPES.map((tp) => <option key={tp} value={tp}>{t(`inventory.types.${tp}`)}</option>)}
              </select>
              <select className={`${selCls} sm:w-44`} value={matFilterStatus} onChange={(e) => setMatFilterStatus(e.target.value as any)}>
                <option value="all">Todos los estados</option>
                <option value="true">{t('inventory.active')}</option>
                <option value="false">{t('inventory.inactive')}</option>
              </select>
            </div>
            <button onClick={openMatCreate} className={BTN_PRIMARY}>
              + {t('inventory.addMaterial')}
            </button>
          </div>

          {/* Table */}
          <div className={`${CARD} p-0 overflow-hidden`}>
            {matLoading ? (
              <div className="p-8 text-center text-slate-400">{t('common.loading')}</div>
            ) : (materials as any[]).length === 0 ? (
              <div className="p-8 text-center text-slate-400">{t('inventory.noMaterials')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-xs text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">{t('inventory.barcode')}</th>
                      <th className="px-4 py-3 text-left">{t('common.name')}</th>
                      <th className="px-4 py-3 text-left">{t('inventory.type')}</th>
                      <th className="px-4 py-3 text-left">{t('inventory.unit')}</th>
                      <th className="px-4 py-3 text-right">{t('inventory.standardPrice')}</th>
                      <th className="px-4 py-3 text-right">{t('inventory.minStock')}</th>
                      <th className="px-4 py-3 text-left">{t('common.status')}</th>
                      <th className="px-4 py-3 text-left">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(materials as any[]).map((mat: any) => (
                      <tr key={mat.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{mat.barcode}</td>
                        <td className="px-4 py-3 font-medium text-white">{mat.name}</td>
                        <td className="px-4 py-3">
                          <span className={`${badgeCls} ${TYPE_COLORS[mat.type] ?? TYPE_COLORS.otros}`}>
                            {t(`inventory.types.${mat.type}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{t(`inventory.units.${mat.unit}`)}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{mat.standardPrice.toFixed(2)} €</td>
                        <td className="px-4 py-3 text-right text-slate-300">{mat.minStock}</td>
                        <td className="px-4 py-3">
                          <span className={`${badgeCls} ${mat.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                            {mat.isActive ? t('inventory.active') : t('inventory.inactive')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openMatEdit(mat)} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                              {t('common.edit')}
                            </button>
                            <button onClick={() => window.open(getMaterialBarcodeUrl(mat.id), '_blank')} className="text-xs text-amber-400 hover:text-amber-300 transition-colors" title={t('inventory.printBarcode')}>
                              🖨
                            </button>
                            {mat.isActive && (
                              <button onClick={() => handleMatDeactivate(mat)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                                {t('common.delete')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Material modal */}
          {matModalOpen && (
            <div className={MODAL_OVERLAY} onClick={(e) => e.target === e.currentTarget && setMatModalOpen(false)}>
              <div className={`${MODAL_PANEL} md:max-w-lg`}>
                <h2 className="text-lg font-semibold text-white mb-5">
                  {matEditing ? t('inventory.editMaterial') : t('inventory.addMaterial')}
                </h2>
                <form onSubmit={handleMatSubmit} className="space-y-4">
                  <div>
                    <label className={labelCls}>{t('common.name')}</label>
                    <input className={inputCls} value={matForm.name} onChange={matField('name')} required />
                  </div>
                  <div>
                    <label className={labelCls}>Descripción <span className="text-white/30 normal-case font-normal">(opcional)</span></label>
                    <textarea className={`${inputCls} resize-none`} rows={2} value={matForm.description} onChange={matField('description')} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{t('inventory.type')}</label>
                      <select className={selCls} value={matForm.type} onChange={matField('type')}>
                        {TYPES.map((tp) => <option key={tp} value={tp}>{t(`inventory.types.${tp}`)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>{t('inventory.unit')}</label>
                      <select className={selCls} value={matForm.unit} onChange={matField('unit')}>
                        {UNITS.map((u) => <option key={u} value={u}>{t(`inventory.units.${u}`)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{t('inventory.standardPrice')} (€)</label>
                      <input className={inputCls} type="number" step="0.01" min="0" value={matForm.standardPrice} onChange={matField('standardPrice')} required />
                    </div>
                    <div>
                      <label className={labelCls}>{t('inventory.minStock')}</label>
                      <input className={inputCls} type="number" step="0.01" min="0" value={matForm.minStock} onChange={matField('minStock')} />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={matSaving} className={`${BTN_PRIMARY} flex-1`}>
                      {matSaving ? t('common.saving') : t('common.save')}
                    </button>
                    <button type="button" onClick={() => setMatModalOpen(false)} className={BTN_SECONDARY}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2 — STOCK
      ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'stock' && (
        <div className="space-y-4">
          {/* Property selector */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] max-w-xs">
              <label className={labelCls}>{t('inventory.property')}</label>
              <select
                className={selCls}
                value={stockPropertyId}
                onChange={(e) => { setStockPropertyId(e.target.value); setStockSubTab('current'); setStockTypeFilter(''); }}
              >
                <option value="">{t('inventory.selectProperty')}</option>
                {(properties as any[]).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            {stockPropertyId && (
              <button onClick={() => setMovModalOpen(true)} className={BTN_PRIMARY}>
                + {t('inventory.addMovement')}
              </button>
            )}
          </div>

          {!stockPropertyId ? (
            <div className={`${CARD} text-center py-12 text-white/30`}>
              {t('inventory.selectProperty')}
            </div>
          ) : (
            <>
              {/* Stock subtabs */}
              <div className="flex border-b border-slate-800/60">
                {stockSubTabs.map((st) => (
                  <button key={st.id} onClick={() => setStockSubTab(st.id)}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      stockSubTab === st.id ? 'border-indigo-400 text-white' : 'border-transparent text-white/40 hover:text-white/70'
                    }`}>
                    {st.label}
                  </button>
                ))}
              </div>

              {/* ── Subtab: Stock Actual ── */}
              {stockSubTab === 'current' && (
                <div className="space-y-4">
                  {/* Alerts banner */}
                  {(() => {
                    const alerts = (stockItems as any[]).filter((i: any) => (i.material?.minStock ?? 0) > 0 && i.currentStock <= i.material.minStock);
                    if (alerts.length === 0) return null;
                    return (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl overflow-hidden">
                        <button onClick={() => setAlertsOpen((v) => !v)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left">
                          <span className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                            <span>⚠</span>
                            <span>{alerts.length} {t('inventory.materialsBelow')}</span>
                          </span>
                          <span className="text-amber-400 text-xs">{alertsOpen ? '▲' : '▼'}</span>
                        </button>
                        {alertsOpen && (
                          <ul className="px-4 pb-3 space-y-1">
                            {alerts.map((i: any) => (
                              <li key={i.materialId} className="text-amber-200/70 text-xs flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                {i.material?.name ?? i.materialId}
                                <span className="text-amber-400/50 ml-auto">
                                  {i.currentStock} / {i.material?.minStock} {i.material?.unit}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })()}

                  {/* Type filter pills */}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setStockTypeFilter('')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${!stockTypeFilter ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>
                      Todos
                    </button>
                    {stockTypes.map((type) => (
                      <button key={type} onClick={() => setStockTypeFilter(type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${stockTypeFilter === type ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>
                        {t(`inventory.types.${type}` as any)}
                      </button>
                    ))}
                  </div>

                  {stockLoading ? (
                    <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className={`${SKELETON} h-12`} />)}</div>
                  ) : filteredStock.length === 0 ? (
                    <div className={`${CARD} text-center py-12 text-white/30`}>{t('inventory.noStock')}</div>
                  ) : (
                    <div className={`${CARD} overflow-x-auto p-0`}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.material')}</th>
                            <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.type')}</th>
                            <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.unit')}</th>
                            <th className="text-right px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.currentStock')}</th>
                            <th className="text-right px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.lastPrice')}</th>
                            <th className="text-right px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.totalValue')}</th>
                            <th className="text-center px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.alert')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStock.map((item: any) => {
                            const isAlert = (item.material?.minStock ?? 0) > 0 && item.currentStock <= item.material.minStock;
                            return (
                              <tr key={item.materialId} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                                <td className="px-4 py-3 font-medium text-white">{item.material?.name ?? item.materialId}</td>
                                <td className="px-4 py-3">
                                  <span className={`${badgeCls} ${TYPE_COLORS[item.material?.type] ?? 'bg-slate-500/15 text-slate-400'}`}>
                                    {t(`inventory.types.${item.material?.type}` as any)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-white/60">{item.material?.unit}</td>
                                <td className="px-4 py-3 text-right font-mono font-semibold text-white">{fmtNum(item.currentStock)}</td>
                                <td className="px-4 py-3 text-right text-white/60 font-mono">{item.lastEntryPrice != null ? fmtEur(item.lastEntryPrice) : '—'}</td>
                                <td className="px-4 py-3 text-right font-mono text-white/80">{item.totalValue != null ? fmtEur(item.totalValue) : '—'}</td>
                                <td className="px-4 py-3 text-center">
                                  {isAlert && <span title={`Stock mínimo: ${item.material?.minStock}`} className="text-red-400 text-base">⚠</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Subtab: Movimientos ── */}
              {stockSubTab === 'movements' && (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="flex flex-wrap gap-3 items-end">
                    <div>
                      <label className={labelCls}>{t('inventory.material')}</label>
                      <select className={`${selCls} w-48`} value={movMaterialFilter} onChange={(e) => setMovMaterialFilter(e.target.value)}>
                        <option value="">Todos</option>
                        {movMaterials.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>{t('inventory.movementType')}</label>
                      <select className={`${selCls} w-36`} value={movTypeFilter} onChange={(e) => setMovTypeFilter(e.target.value)}>
                        <option value="">Todos</option>
                        <option value="entrada">{t('inventory.entrada')}</option>
                        <option value="salida">{t('inventory.salida')}</option>
                        <option value="recuento">{t('inventory.recuento')}</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Desde</label>
                      <input type="date" className={`${inputCls} w-40`} value={movFrom} onChange={(e) => setMovFrom(e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Hasta</label>
                      <input type="date" className={`${inputCls} w-40`} value={movTo} onChange={(e) => setMovTo(e.target.value)} />
                    </div>
                    {(movMaterialFilter || movTypeFilter || movFrom || movTo) && (
                      <button onClick={() => { setMovMaterialFilter(''); setMovTypeFilter(''); setMovFrom(''); setMovTo(''); }} className={BTN_SECONDARY}>
                        Limpiar
                      </button>
                    )}
                  </div>

                  {movLoading ? (
                    <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className={`${SKELETON} h-12`} />)}</div>
                  ) : (movements as any[]).length === 0 ? (
                    <div className={`${CARD} text-center py-12 text-white/30`}>{t('inventory.noMovements')}</div>
                  ) : (
                    <div className={`${CARD} overflow-x-auto p-0`}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('common.date')}</th>
                            <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.material')}</th>
                            <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.movementType')}</th>
                            <th className="text-right px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.quantity')}</th>
                            <th className="text-right px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.unitPrice')}</th>
                            <th className="text-right px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('common.total')}</th>
                            <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">Usuario</th>
                            <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('common.notes')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(movements as any[]).map((mov: any) => (
                            <tr key={mov.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                              <td className="px-4 py-3 text-white/60 whitespace-nowrap font-mono text-xs">{fmtDate(mov.createdAt)}</td>
                              <td className="px-4 py-3 font-medium text-white">{mov.material?.name ?? mov.materialId}</td>
                              <td className="px-4 py-3">
                                <span className={`${badgeCls} ${MOV_COLORS[mov.type] ?? 'bg-slate-500/15 text-slate-400'}`}>
                                  {t(`inventory.${mov.type}` as any)}
                                </span>
                              </td>
                              <td className={`px-4 py-3 text-right font-mono font-semibold ${mov.quantity < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {mov.quantity > 0 ? '+' : ''}{fmtNum(mov.quantity)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-white/60">{mov.unitPrice ? fmtEur(mov.unitPrice) : '—'}</td>
                              <td className="px-4 py-3 text-right font-mono text-white/80">{mov.unitPrice && mov.quantity ? fmtEur(Math.abs(mov.quantity) * mov.unitPrice) : '—'}</td>
                              <td className="px-4 py-3 text-white/50 text-xs">{mov.user?.name ?? mov.userId ?? '—'}</td>
                              <td className="px-4 py-3 text-white/40 text-xs max-w-[12rem] truncate">{mov.notes ?? ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Subtab: Valoración ── */}
              {stockSubTab === 'valuation' && (
                <div className="space-y-4">
                  {valLoading ? (
                    <div className="space-y-3">{[1, 2].map((i) => <div key={i} className={`${SKELETON} h-32`} />)}</div>
                  ) : !valuation ? (
                    <div className={`${CARD} text-center py-12 text-white/30`}>{t('inventory.noStock')}</div>
                  ) : (
                    <>
                      {(valuation as any).alertCount > 0 && (
                        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                          <span className="text-red-400 text-lg">⚠</span>
                          <span className="text-red-300 text-sm font-medium">
                            {(valuation as any).alertCount} {t('inventory.belowMinStock')}
                          </span>
                        </div>
                      )}
                      <div className="grid gap-4">
                        {((valuation as any).byType ?? []).map((group: any) => (
                          <div key={group.type} className={CARD}>
                            <div className="flex items-center justify-between mb-4">
                              <span className={`${badgeCls} ${TYPE_COLORS[group.type] ?? 'bg-slate-500/15 text-slate-400'} text-sm`}>
                                {t(`inventory.types.${group.type}` as any)}
                              </span>
                              <span className="font-bold text-white font-mono">{fmtEur(group.subtotal ?? 0)}</span>
                            </div>
                            <div className="space-y-2">
                              {(group.materials ?? []).map((mat: any) => (
                                <div key={mat.materialId} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {mat.isAlert && <span className="text-red-400 flex-shrink-0 text-xs">⚠</span>}
                                    <span className="text-white/80 truncate">{mat.name}</span>
                                    <span className="text-white/30 flex-shrink-0">{fmtNum(mat.currentStock)} {mat.unit}</span>
                                  </div>
                                  <span className="font-mono text-white/70 flex-shrink-0 ml-4">{fmtEur(mat.totalValue ?? 0)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-6">
                          <div className="flex items-center justify-between">
                            <span className="text-white/70 font-semibold">{t('inventory.totalValuation')}</span>
                            <span className="text-2xl font-bold text-white font-mono">{fmtEur((valuation as any).grandTotal ?? 0)}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Movement modal */}
          {movModalOpen && stockPropertyId && (
            <MovementModal
              propertyId={stockPropertyId}
              onClose={() => setMovModalOpen(false)}
              onSuccess={() => setMovModalOpen(false)}
            />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3 — RECOUNT
      ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'recount' && (
        <div className="space-y-4">
          {/* Property selector */}
          <div className="max-w-xs">
            <label className={labelCls}>{t('inventory.property')}</label>
            <select
              className={selCls}
              value={rcPropertyId}
              onChange={(e) => { setRcPropertyId(e.target.value); setRcObserved({}); setRcSaved(false); }}
            >
              <option value="">{t('inventory.selectProperty')}</option>
              {(properties as any[]).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {!rcPropertyId ? (
            <div className={`${CARD} text-center py-12 text-white/30`}>{t('inventory.selectProperty')}</div>
          ) : rcLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className={`${SKELETON} h-12`} />)}</div>
          ) : rcActiveMaterials.length === 0 ? (
            <div className={`${CARD} text-center py-12 text-white/30`}>{t('inventory.noStock')}</div>
          ) : (
            <>
              {/* Recount table */}
              <div className={`${CARD} overflow-x-auto p-0`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.material')}</th>
                      <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.type')}</th>
                      <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.unit')}</th>
                      <th className="text-right px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.currentStock')}</th>
                      <th className="text-right px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.observedQuantity')}</th>
                      <th className="text-right px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">{t('inventory.difference')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rcRows.map((row) => {
                      const diffColor = row.diff > 0 ? 'text-emerald-400' : row.diff < 0 ? 'text-red-400' : 'text-white/30';
                      return (
                        <tr key={row.materialId} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                          <td className="px-4 py-3 font-medium text-white">{row.material?.name ?? row.materialId}</td>
                          <td className="px-4 py-3">
                            <span className={`${badgeCls} ${TYPE_COLORS[row.material?.type] ?? 'bg-slate-500/15 text-slate-400'}`}>
                              {t(`inventory.types.${row.material?.type}` as any)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white/60">{row.material?.unit}</td>
                          <td className="px-4 py-3 text-right font-mono text-white/70">{fmtNum(row.calculated)}</td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              step="any"
                              className={`${inputCls} w-28 text-right py-1.5 px-2`}
                              value={row.rawObs !== undefined ? row.rawObs : String(row.calculated)}
                              onChange={(e) => {
                                setRcObserved((prev) => ({ ...prev, [row.materialId]: e.target.value }));
                                setRcSaved(false);
                              }}
                            />
                          </td>
                          <td className={`px-4 py-3 text-right font-mono font-semibold ${diffColor}`}>
                            {isNaN(row.diff) ? '—' : `${row.diff > 0 ? '+' : ''}${fmtNum(row.diff)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Confirmation */}
              {rcSaved && (
                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                  <span className="text-emerald-400 text-lg">✓</span>
                  <span className="text-emerald-300 text-sm font-medium">
                    {rcSavedCount} {t('inventory.adjustmentsSaved')}
                  </span>
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-end">
                <button onClick={handleRcSave} disabled={!rcHasChanges || rcSaving || rcSaved} className={BTN_PRIMARY}>
                  {rcSaving ? t('common.saving') : !rcHasChanges ? t('inventory.noChanges') : t('inventory.saveRecount')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
