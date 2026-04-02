import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getMaterials, createMaterial, updateMaterial, deleteMaterial, getMaterialBarcodeUrl } from '../lib/api';
import {
  inputCls, labelCls, selCls, badgeCls,
  BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER,
  CARD, MODAL_OVERLAY, MODAL_PANEL,
} from '../lib/ui';

const TYPE_COLORS: Record<string, string> = {
  limpieza: 'bg-blue-500/15 text-blue-400',
  baño:     'bg-purple-500/15 text-purple-400',
  regalos:  'bg-pink-500/15 text-pink-400',
  otros:    'bg-slate-500/15 text-slate-400',
};

const TYPES = ['limpieza', 'baño', 'regalos', 'otros'] as const;
const UNITS = ['ud', 'kg', 'g', 'l', 'ml', 'm', 'm2', 'pack', 'caja', 'rollo', 'paquete', 'botella', 'unidad', 'docena', 'bolsa', 'tubo', 'bote'] as const;

const EMPTY_FORM = {
  name: '',
  description: '',
  type: 'limpieza',
  unit: 'ud',
  standardPrice: '',
  minStock: '0',
};

export default function Materials() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [search, setSearch]     = useState('');
  const [filterType, setFilterType]   = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'true' | 'false'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<any>(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);

  const queryKey = ['materials', search, filterType, filterStatus];

  const { data: materials = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getMaterials({
      ...(search ? { search } : {}),
      ...(filterType ? { type: filterType } : {}),
      ...(filterStatus !== 'all' ? { isActive: filterStatus === 'true' } : {}),
    }),
    staleTime: 30_000,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => updateMaterial(id, { isActive: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials'] }),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(mat: any) {
    setEditing(mat);
    setForm({
      name: mat.name,
      description: mat.description ?? '',
      type: mat.type,
      unit: mat.unit,
      standardPrice: String(mat.standardPrice),
      minStock: String(mat.minStock ?? 0),
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        type: form.type,
        unit: form.unit,
        standardPrice: parseFloat(form.standardPrice),
        minStock: parseFloat(form.minStock) || 0,
      };
      if (editing) {
        await updateMaterial(editing.id, payload);
      } else {
        await createMaterial(payload);
      }
      await qc.invalidateQueries({ queryKey: ['materials'] });
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function handleDeactivate(mat: any) {
    if (!window.confirm(t('inventory.confirmDelete'))) return;
    deactivateMutation.mutate(mat.id);
  }

  function f(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('inventory.materials')}</h1>
          <p className="text-sm text-slate-400 mt-0.5">{materials.length} {t('inventory.materials').toLowerCase()}</p>
        </div>
        <button onClick={openCreate} className={BTN_PRIMARY}>
          + {t('inventory.addMaterial')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          className={inputCls + ' flex-1'}
          placeholder={t('inventory.searchMaterial')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={selCls + ' sm:w-44'} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">{t('common.type')}: {t('common.noData') === 'Sin datos registrados' ? 'Todos' : 'All'}</option>
          {TYPES.map((tp) => (
            <option key={tp} value={tp}>{t(`inventory.types.${tp}`)}</option>
          ))}
        </select>
        <select className={selCls + ' sm:w-44'} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
          <option value="all">{t('common.status')}: {t('common.noData') === 'Sin datos registrados' ? 'Todos' : 'All'}</option>
          <option value="true">{t('inventory.active')}</option>
          <option value="false">{t('inventory.inactive')}</option>
        </select>
      </div>

      {/* Table */}
      <div className={CARD + ' p-0 overflow-hidden'}>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">{t('common.loading')}</div>
        ) : materials.length === 0 ? (
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
                {materials.map((mat: any) => (
                  <tr key={mat.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{mat.barcode}</td>
                    <td className="px-4 py-3 font-medium text-white">{mat.name}</td>
                    <td className="px-4 py-3">
                      <span className={`${badgeCls} ${TYPE_COLORS[mat.type] ?? TYPE_COLORS.otros}`}>
                        {t(`inventory.types.${mat.type}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{t(`inventory.units.${mat.unit}`)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {mat.standardPrice.toFixed(2)} €
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{mat.minStock}</td>
                    <td className="px-4 py-3">
                      <span className={`${badgeCls} ${mat.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                        {mat.isActive ? t('inventory.active') : t('inventory.inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(mat)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => window.open(getMaterialBarcodeUrl(mat.id), '_blank')}
                          className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          🖨
                        </button>
                        {mat.isActive && (
                          <button
                            onClick={() => handleDeactivate(mat)}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                          >
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

      {/* Modal */}
      {modalOpen && (
        <div className={MODAL_OVERLAY} onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className={MODAL_PANEL + ' md:max-w-lg'}>
            <h2 className="text-lg font-semibold text-white mb-5">
              {editing ? t('inventory.editMaterial') : t('inventory.addMaterial')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>{t('common.name')}</label>
                <input className={inputCls} value={form.name} onChange={f('name')} required />
              </div>
              <div>
                <label className={labelCls}>Descripción</label>
                <textarea
                  className={inputCls + ' resize-none'}
                  rows={2}
                  value={form.description}
                  onChange={f('description')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('inventory.type')}</label>
                  <select className={selCls} value={form.type} onChange={f('type')}>
                    {TYPES.map((tp) => (
                      <option key={tp} value={tp}>{t(`inventory.types.${tp}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t('inventory.unit')}</label>
                  <select className={selCls} value={form.unit} onChange={f('unit')}>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{t(`inventory.units.${u}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('inventory.standardPrice')} (€)</label>
                  <input
                    className={inputCls}
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.standardPrice}
                    onChange={f('standardPrice')}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('inventory.minStock')}</label>
                  <input
                    className={inputCls}
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.minStock}
                    onChange={f('minStock')}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className={BTN_PRIMARY + ' flex-1'}>
                  {saving ? t('common.saving') : t('common.save')}
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className={BTN_SECONDARY}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
