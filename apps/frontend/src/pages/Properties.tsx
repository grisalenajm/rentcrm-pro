import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import ExcelButtons from '../components/ExcelButtons';

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  province?: string;
  rooms: number;
  status: string;
  sesCodigoEstablecimiento?: string;
  photo?: string;
}

interface Feed {
  id: string;
  propertyId: string;
  icalUrl: string;
  platform: string;
  lastSyncAt: string | null;
  lastSyncStatus: string;
}

const emptyForm = { name:'', address:'', city:'', province:'', rooms:'1', status: 'active', sesCodigoEstablecimiento:'' };

const fmtEur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export default function Properties() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [detailProperty, setDetailProperty] = useState<Property | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // iCal state
  const [icalProperty, setIcalProperty] = useState<Property | null>(null);
  const [icalFeeds, setIcalFeeds] = useState<Feed[]>([]);
  const [icalLoading, setIcalLoading] = useState(false);
  const [icalSyncing, setIcalSyncing] = useState<string | null>(null);
  const [icalSyncResult, setIcalSyncResult] = useState<{ feedId: string; imported: number; skipped: number; total: number } | null>(null);
  const [icalShowAdd, setIcalShowAdd] = useState(false);
  const [icalForm, setIcalForm] = useState({ url: '', platform: 'airbnb' });
  const [icalSaving, setIcalSaving] = useState(false);
  const [icalError, setIcalError] = useState('');

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then(r => r.data),
  });

  // Financial data for detail panel
  const { data: financialRecords = [] } = useQuery({
    queryKey: ['financials-property', detailProperty?.id],
    queryFn: () => api.get(`/financials?propertyId=${detailProperty!.id}`).then(r => r.data),
    enabled: !!detailProperty,
  });

  const { data: expensesSummary = {} } = useQuery({
    queryKey: ['expenses-summary-property', detailProperty?.id],
    queryFn: () => api.get(`/expenses/summary?propertyId=${detailProperty!.id}`).then(r => r.data),
    enabled: !!detailProperty,
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
    setForm({ name: p.name, address: p.address, city: p.city, province: p.province||'', rooms: String(p.rooms), status: p.status || 'active', sesCodigoEstablecimiento: (p as any).sesCodigoEstablecimiento||'' });
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

  // Photo upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !detailProperty) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no puede superar 2MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten imágenes');
      return;
    }
    setPhotoUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        await api.put(`/properties/${detailProperty.id}`, { photo: base64 });
        await qc.invalidateQueries({ queryKey: ['properties'] });
        setDetailProperty({ ...detailProperty, photo: base64 });
      } finally {
        setPhotoUploading(false);
        if (photoInputRef.current) photoInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  // Financial summary by year
  const incomeSummary: Record<number, number> = {};
  for (const r of financialRecords as any[]) {
    if (r.type === 'income') {
      const year = new Date(r.date).getFullYear();
      incomeSummary[year] = (incomeSummary[year] || 0) + Number(r.amount);
    }
  }
  const expYears = Object.keys(expensesSummary as Record<string, number>).map(Number);
  const incYears = Object.keys(incomeSummary).map(Number);
  const allYears = [...new Set([...expYears, ...incYears])].sort((a, b) => b - a);

  // iCal helpers
  const exportUrl = (propertyId: string) =>
    `${(import.meta as any).env.VITE_API_URL || 'http://192.168.1.123:3001'}/api/ical/export/${propertyId}`;

  const platformBadge = (platform: string) => {
    const colors: Record<string, string> = {
      airbnb: 'bg-rose-500/10 text-rose-400',
      booking: 'bg-blue-500/10 text-blue-400',
      other: 'bg-slate-700 text-slate-400',
    };
    return colors[platform] || colors.other;
  };

  const loadFeeds = async (propertyId: string) => {
    setIcalLoading(true);
    try {
      const res = await api.get('/ical/feeds');
      setIcalFeeds((res.data as Feed[]).filter(fd => fd.propertyId === propertyId));
    } finally {
      setIcalLoading(false);
    }
  };

  const openIcal = async (p: Property) => {
    setIcalProperty(p);
    setIcalFeeds([]);
    setIcalShowAdd(false);
    setIcalSyncResult(null);
    setIcalError('');
    await loadFeeds(p.id);
  };

  const handleAddFeed = async () => {
    if (!icalForm.url) { setIcalError(t('properties.ical.errorRequired')); return; }
    setIcalSaving(true);
    setIcalError('');
    try {
      await api.post('/ical/feeds', { propertyId: icalProperty!.id, url: icalForm.url, platform: icalForm.platform });
      setIcalShowAdd(false);
      setIcalForm({ url: '', platform: 'airbnb' });
      await loadFeeds(icalProperty!.id);
    } catch (e: any) {
      setIcalError(e.response?.data?.message || t('properties.ical.errorSave'));
    } finally {
      setIcalSaving(false);
    }
  };

  const handleDeleteFeed = async (id: string) => {
    if (!confirm(t('properties.ical.confirmDelete'))) return;
    await api.delete(`/ical/feeds/${id}`);
    await loadFeeds(icalProperty!.id);
  };

  const handleSyncFeed = async (id: string) => {
    setIcalSyncing(id);
    setIcalSyncResult(null);
    try {
      const res = await api.post(`/ical/feeds/${id}/sync`);
      setIcalSyncResult({ feedId: id, ...res.data });
    } catch (e: any) {
      alert(e.response?.data?.message || t('properties.ical.errorSync'));
    } finally {
      setIcalSyncing(null);
    }
  };

  const statusLabel = (s: string) =>
    s === 'active' ? 'Activa' : s === 'maintenance' ? 'Mantenimiento' : 'Inactiva';
  const statusClass = (s: string) =>
    s === 'active' ? 'bg-emerald-500/10 text-emerald-400' : s === 'maintenance' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('properties.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{properties.length} {t('properties.registered')}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelButtons entity="properties" showImport={false} />
          <button onClick={openCreate}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
            + {t('properties.new')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-20">{t('common.loading')}</div>
      ) : properties.length === 0 ? (
        <div className="text-slate-400 text-center py-20">{t('common.noData')}</div>
      ) : (
        <>
          {/* Desktop: tabla */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
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
                  <tr key={p.id} className="border-b border-slate-800 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => setDetailProperty(p)}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">
                        {p.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{p.address}</td>
                    <td className="px-4 py-3 text-slate-400">{p.city}</td>
                    <td className="px-4 py-3 text-slate-400">{p.province || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{p.rooms}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusClass(p.status)}`}>
                        {statusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={(e) => { e.stopPropagation(); openIcal(p); }}
                          className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors">
                          📅 iCal
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                          className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">{t('common.edit')}</button>
                        <button onClick={(e) => { e.stopPropagation(); if(confirm(t('common.confirm_delete'))) deleteMutation.mutate(p.id); }}
                          className="px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">{t('common.delete')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: tarjetas */}
          <div className="md:hidden space-y-3">
            {properties.map((p: Property) => (
              <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer" onClick={() => setDetailProperty(p)}>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-white hover:text-emerald-400 transition-colors">
                    {p.name}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusClass(p.status)}`}>
                    {statusLabel(p.status)}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-1">{p.address}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                  <span>{p.city}{p.province ? `, ${p.province}` : ''}</span>
                  <span>·</span>
                  <span>{p.rooms} {t('properties.rooms')}</span>
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openIcal(p)}
                    className="flex-1 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors text-center">
                    📅 iCal
                  </button>
                  <button onClick={() => openEdit(p)}
                    className="flex-1 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-center">{t('common.edit')}</button>
                  <button onClick={() => { if(confirm(t('common.confirm_delete'))) deleteMutation.mutate(p.id); }}
                    className="flex-1 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-center">{t('common.delete')}</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Property detail modal */}
      {detailProperty && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl max-h-[95vh] md:max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <h2 className="text-lg font-bold">{detailProperty.name}</h2>
              <div className="flex items-center gap-3">
                <button onClick={() => { setDetailProperty(null); openEdit(detailProperty); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  {t('common.edit')}
                </button>
                <button onClick={() => { setDetailProperty(null); openIcal(detailProperty); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg text-sm font-semibold transition-colors">
                  📅 iCal
                </button>
                <button onClick={() => setDetailProperty(null)}
                  className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Bloque superior: foto + datos */}
              <div className="flex gap-4 p-6">
                {/* Foto pequeña izquierda */}
                <div className="shrink-0 w-32 h-32 rounded-xl overflow-hidden bg-slate-800 flex items-center justify-center">
                  {detailProperty.photo
                    ? <img src={detailProperty.photo} alt={detailProperty.name} className="w-full h-full object-cover" />
                    : <span className="text-3xl">🏠</span>
                  }
                </div>

                {/* Datos derecha */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <p className="text-xs text-slate-400">Dirección</p>
                    <p className="text-white text-sm">{detailProperty.address}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-slate-400">Ciudad</p>
                      <p className="text-white text-sm">{detailProperty.city}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Provincia</p>
                      <p className="text-white text-sm">{detailProperty.province || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Habitaciones</p>
                      <p className="text-white text-sm">{detailProperty.rooms}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Estado</p>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusClass(detailProperty.status)}`}>
                        {statusLabel(detailProperty.status)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón cambiar foto */}
              <div className="px-6 pb-2">
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <button onClick={() => photoInputRef.current?.click()} disabled={photoUploading}
                  className="text-xs text-slate-400 hover:text-emerald-400 transition-colors">
                  {photoUploading ? 'Subiendo...' : '📷 Cambiar foto'}
                </button>
              </div>

              <div className="border-t border-slate-800 mx-6" />

              {/* iCal */}
              <div className="px-6 py-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">iCal</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">URL exportación</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-emerald-400 bg-slate-800 px-2 py-1 rounded flex-1 truncate">
                        {exportUrl(detailProperty.id)}
                      </code>
                      <button onClick={() => navigator.clipboard.writeText(exportUrl(detailProperty.id))}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded transition-colors">
                        Copiar
                      </button>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setDetailProperty(null); openIcal(detailProperty); }}
                  className="mt-2 text-xs text-slate-400 hover:text-emerald-400 transition-colors">
                  ⚙️ Gestionar feeds iCal
                </button>
              </div>

              <div className="border-t border-slate-800 mx-6" />

              {/* SES */}
              <div className="px-6 py-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">SES Hospedajes</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-slate-400">Código establecimiento</p>
                    <p className="text-white text-sm font-mono">
                      {detailProperty.sesCodigoEstablecimiento || <span className="text-slate-500">No configurado</span>}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 mx-6" />

              {/* Financial summary */}
              <div className="px-6 py-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Resumen financiero</h3>

                {allYears.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-700 rounded-xl text-slate-500 text-sm">
                    Sin datos financieros
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block bg-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left px-4 py-3 text-slate-400 font-semibold">Año</th>
                            <th className="text-right px-4 py-3 text-slate-400 font-semibold">Ingresos</th>
                            <th className="text-right px-4 py-3 text-slate-400 font-semibold">Gastos</th>
                            <th className="text-right px-4 py-3 text-slate-400 font-semibold">Neto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allYears.map(year => {
                            const income = incomeSummary[year] || 0;
                            const expenses = (expensesSummary as Record<string, number>)[year] || 0;
                            const net = income - expenses;
                            return (
                              <tr key={year} className="border-b border-slate-700/50 last:border-0">
                                <td className="px-4 py-3 font-semibold">{year}</td>
                                <td className="px-4 py-3 text-right text-emerald-400">{fmtEur(income)}</td>
                                <td className="px-4 py-3 text-right text-red-400">{fmtEur(expenses)}</td>
                                <td className={`px-4 py-3 text-right font-semibold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {fmtEur(net)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3">
                      {allYears.map(year => {
                        const income = incomeSummary[year] || 0;
                        const expenses = (expensesSummary as Record<string, number>)[year] || 0;
                        const net = income - expenses;
                        return (
                          <div key={year} className="bg-slate-800 rounded-xl p-4">
                            <p className="font-bold text-white mb-3">{year}</p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Ingresos</p>
                                <p className="text-sm font-semibold text-emerald-400">{fmtEur(income)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Gastos</p>
                                <p className="text-sm font-semibold text-red-400">{fmtEur(expenses)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Neto</p>
                                <p className={`text-sm font-semibold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtEur(net)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Property create/edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[95vh] md:max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold mb-5">{editing ? t('common.edit') : t('properties.new')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {editing && (
                <div className="border-t border-slate-800 pt-4 mt-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">iCal</p>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">URL exportación</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-emerald-400 bg-slate-800 px-2 py-1 rounded flex-1 truncate">
                        {exportUrl(editing.id)}
                      </code>
                      <button type="button" onClick={() => navigator.clipboard.writeText(exportUrl(editing.id))}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded transition-colors shrink-0">
                        Copiar
                      </button>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setShowForm(false); openIcal(editing); }}
                    className="mt-2 text-xs text-slate-400 hover:text-emerald-400 transition-colors">
                    ⚙️ Gestionar feeds iCal
                  </button>
                </div>
              )}
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

      {/* iCal sync modal */}
      {icalProperty && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl max-h-[95vh] md:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <div>
                <h2 className="text-lg font-bold">{t('properties.ical.sectionTitle')}</h2>
                <p className="text-sm text-slate-400">{icalProperty.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setIcalShowAdd(true); setIcalError(''); }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
                  + {t('properties.ical.addFeed')}
                </button>
                <button onClick={() => setIcalProperty(null)}
                  className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Export URL */}
              <div className="bg-slate-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('properties.ical.exportUrl')}</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-emerald-400 bg-slate-900 px-3 py-2 rounded-lg flex-1 truncate">
                    {exportUrl(icalProperty.id)}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(exportUrl(icalProperty.id))}
                    className="text-xs text-slate-400 hover:text-white px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors shrink-0">
                    📋 {t('properties.ical.copy')}
                  </button>
                </div>
              </div>

              {/* Add feed form */}
              {icalShowAdd && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-bold">{t('properties.ical.addFeedTitle')}</h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('properties.ical.platform')}</label>
                    <select
                      value={icalForm.platform}
                      onChange={(e) => setIcalForm({ ...icalForm, platform: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                      <option value="airbnb">Airbnb</option>
                      <option value="booking">Booking.com</option>
                      <option value="other">{t('properties.ical.other')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('properties.ical.icalUrl')}</label>
                    <input
                      type="url"
                      value={icalForm.url}
                      onChange={(e) => setIcalForm({ ...icalForm, url: e.target.value })}
                      placeholder="https://www.airbnb.com/calendar/ical/..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                    <p className="text-xs text-slate-500 mt-1">{t('properties.ical.icalUrlHint')}</p>
                  </div>
                  {icalError && (
                    <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{icalError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setIcalShowAdd(false); setIcalError(''); }}
                      className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors">
                      {t('properties.ical.cancel')}
                    </button>
                    <button
                      onClick={handleAddFeed}
                      disabled={icalSaving}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                      {icalSaving ? t('properties.ical.saving') : t('properties.ical.save')}
                    </button>
                  </div>
                </div>
              )}

              {/* Feed list */}
              {icalLoading ? (
                <div className="text-slate-400 text-center py-8">{t('properties.ical.loading')}</div>
              ) : icalFeeds.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-xl">
                  <div className="text-3xl mb-2">📅</div>
                  <p className="text-slate-400 text-sm">{t('properties.ical.noFeeds')}</p>
                  <p className="text-slate-500 text-xs mt-1">{t('properties.ical.noFeedsHint')}</p>
                </div>
              ) : (
                icalFeeds.map((feed) => (
                  <div key={feed.id} className="bg-slate-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${platformBadge(feed.platform)}`}>
                            {feed.platform.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">{feed.icalUrl}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {feed.lastSyncAt
                            ? `${t('properties.ical.lastSync')}: ${new Date(feed.lastSyncAt).toLocaleString()}`
                            : t('properties.ical.neverSynced')}
                        </p>
                        {icalSyncResult?.feedId === feed.id && (
                          <div className="mt-2 text-xs bg-emerald-500/10 text-emerald-400 rounded-lg px-3 py-2">
                            ✅ {t('properties.ical.syncResult', { imported: icalSyncResult.imported, skipped: icalSyncResult.skipped, total: icalSyncResult.total })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleSyncFeed(feed.id)}
                          disabled={icalSyncing === feed.id}
                          className="text-xs bg-slate-700 hover:bg-slate-600 text-blue-400 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50">
                          {icalSyncing === feed.id ? '⏳' : '🔄'} {t('properties.ical.sync')}
                        </button>
                        <button
                          onClick={() => handleDeleteFeed(feed.id)}
                          className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg font-medium transition-colors">
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
