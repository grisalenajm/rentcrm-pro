import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { inputCls, labelCls, platformBadgeColor, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, MODAL_OVERLAY, MODAL_PANEL } from '../lib/ui';
import ExcelButtons from '../components/ExcelButtons';
import { WORLD_COUNTRIES } from '../data/countries';

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  province?: string;
  postalCode?: string;
  country?: string;
  rooms: number;
  bathrooms?: number;
  maxGuests?: number;
  pricePerNight?: number;
  purchasePrice?: number;
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

const emptyForm = { name:'', address:'', city:'', province:'', postalCode:'', country:'ES', rooms:'1', bathrooms:'', maxGuests:'', pricePerNight:'', purchasePrice:'', status: 'active', sesCodigoEstablecimiento:'' };



export default function Properties() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
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
  const [icalCopied, setIcalCopied] = useState(false);
  const [icalExportUrl, setIcalExportUrl] = useState('');

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/properties', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setShowForm(false); setForm(emptyForm); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/properties/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });

  const openCreate = () => { setForm(emptyForm); setShowForm(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...form,
      rooms: Number(form.rooms),
      bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
      maxGuests: form.maxGuests ? Number(form.maxGuests) : undefined,
      pricePerNight: form.pricePerNight ? Number(form.pricePerNight) : undefined,
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
      postalCode: form.postalCode || undefined,
      country: form.country || undefined,
    };
    createMutation.mutate(data);
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  // iCal helpers
  const platformBadge = platformBadgeColor;

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
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
    setIcalExportUrl('');
    api.get(`/ical/export-url/${p.id}`).then(r => setIcalExportUrl(r.data.url)).catch(() => {});
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
            className={BTN_PRIMARY}>
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
                  <tr key={p.id} className="border-b border-slate-800 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => navigate(`/properties/${p.id}`)}>
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
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/properties/${p.id}/edit`); }}
                          className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">{t('common.edit')}</button>
                        <button onClick={(e) => { e.stopPropagation(); if(confirm(t('common.confirm_delete'))) deleteMutation.mutate(p.id); }}
                          className={BTN_DANGER}>{t('common.delete')}</button>
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
              <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer" onClick={() => navigate(`/properties/${p.id}`)}>
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
                  <button onClick={() => navigate(`/properties/${p.id}/financials`)}
                    className="flex-1 py-1.5 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors text-center">
                    💰 Finanzas
                  </button>
                  <button onClick={() => openIcal(p)}
                    className="flex-1 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors text-center">
                    📅 iCal
                  </button>
                  <button onClick={() => navigate(`/properties/${p.id}/edit`)}
                    className="flex-1 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-center">{t('common.edit')}</button>
                  <button onClick={() => { if(confirm(t('common.confirm_delete'))) deleteMutation.mutate(p.id); }}
                    className={`flex-1 ${BTN_DANGER}`}>{t('common.delete')}</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Property create/edit modal */}
      {showForm && (
        <div className={MODAL_OVERLAY}>
          <div className={`${MODAL_PANEL} md:max-w-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <h2 className="text-lg font-bold text-white">{t('properties.new')}</h2>
              <button type="button" onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Identificación */}
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-4">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Identificación</p>
                <div>
                  <label className={labelCls}>{t('common.name')} *</label>
                  <input value={form.name} onChange={f('name')} required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t('common.address')}</label>
                  <input value={form.address} onChange={f('address')} className={inputCls} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>{t('common.city')}</label>
                    <input value={form.city} onChange={f('city')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('properties.province')}</label>
                    <input value={form.province} onChange={f('province')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>País</label>
                    <select value={form.country} onChange={f('country')} className={inputCls}>
                      {WORLD_COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Código Postal</label>
                    <input value={form.postalCode} onChange={f('postalCode')} className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Capacidad */}
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-4">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Capacidad</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className={labelCls}>{t('properties.rooms')} *</label>
                    <input type="number" min="1" value={form.rooms} onChange={f('rooms')} required className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Baños</label>
                    <input type="number" min="0" value={form.bathrooms} onChange={f('bathrooms')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Máx. huéspedes</label>
                    <input type="number" min="1" value={form.maxGuests} onChange={f('maxGuests')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Precio/noche €</label>
                    <input type="number" min="0" step="0.01" value={form.pricePerNight} onChange={f('pricePerNight')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Precio de compra (€)</label>
                    <input type="number" min="0" step="1" value={form.purchasePrice} onChange={f('purchasePrice')} placeholder="Opcional — para cálculo ROI" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Configuración */}
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-4">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Configuración</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>{t('common.status')}</label>
                    <select value={form.status} onChange={f('status')} className={inputCls}>
                      <option value="active">Activa</option>
                      <option value="maintenance">Mantenimiento</option>
                      <option value="inactive">Inactiva</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Código SES Establecimiento</label>
                    <input value={form.sesCodigoEstablecimiento} onChange={f('sesCodigoEstablecimiento')}
                      placeholder="0000000002" className={inputCls} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className={`flex-1 ${BTN_SECONDARY}`}>{t('common.cancel')}</button>
                <button type="submit"
                  className={`flex-1 ${BTN_PRIMARY}`}>
                  {t('properties.new')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* iCal sync modal */}
      {icalProperty && (
        <div className={MODAL_OVERLAY}>
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl max-h-[95vh] md:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <div>
                <h2 className="text-lg font-bold">{t('properties.ical.sectionTitle')}</h2>
                <p className="text-sm text-slate-400">{icalProperty.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setIcalShowAdd(true); setIcalError(''); }}
                  className={BTN_PRIMARY}>
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
                  <input
                    readOnly
                    value={icalExportUrl}
                    className="text-xs text-emerald-400 bg-slate-900 px-3 py-2 rounded-lg w-full min-w-0 outline-none cursor-text select-all"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => {
                      copyToClipboard(icalExportUrl);
                      setIcalCopied(true);
                      setTimeout(() => setIcalCopied(false), 1500);
                    }}
                    className="text-xs text-slate-400 hover:text-white px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors shrink-0 whitespace-nowrap">
                    {icalCopied ? `✅ ${t('properties.ical.copied')}` : `📋 ${t('properties.ical.copy')}`}
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
                      className={`flex-1 ${BTN_SECONDARY}`}>
                      {t('properties.ical.cancel')}
                    </button>
                    <button
                      onClick={handleAddFeed}
                      disabled={icalSaving}
                      className={`flex-1 ${BTN_PRIMARY}`}>
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
