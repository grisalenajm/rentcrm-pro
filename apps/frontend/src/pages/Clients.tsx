import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { inputCls, labelCls, selCls, LANGUAGES, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, MODAL_OVERLAY, MODAL_PANEL } from '../lib/ui';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import ExcelButtons from '../components/ExcelButtons';
import { WORLD_COUNTRIES } from '../data/countries';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dniPassport?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  notes?: string;
  language?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
}

const COUNTRIES = WORLD_COUNTRIES;


const NATIONALITY_LANG: Record<string, string> = {
  ES: 'es', FR: 'fr', DE: 'de', IT: 'it', PT: 'pt',
  NL: 'nl', DK: 'da', NO: 'nb', SE: 'sv',
};

function langFromNationality(nationalityName: string): string {
  const country = WORLD_COUNTRIES.find(c => c.name === nationalityName);
  if (!country) return 'en';
  return NATIONALITY_LANG[country.code] || 'en';
}


function validateDoc(docType: string, docNumber: string, country: string): string | null {
  const n = docNumber.toUpperCase().trim();
  if (!n) return null;
  if (docType === 'dni' && country === 'ES') {
    if (!/^\d{8}[A-Z]$/.test(n)) return 'DNI español: 8 dígitos + letra (ej: 12345678A)';
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    if (letters[parseInt(n.slice(0, 8)) % 23] !== n[8]) return 'Letra del DNI incorrecta';
  }
  if (docType === 'passport') {
    if (country === 'ES' && !/^[A-Z]{3}\d{6}$/.test(n)) return 'Pasaporte español: 3 letras + 6 dígitos';
    if (country === 'GB' && !/^\d{9}$/.test(n)) return 'Pasaporte UK: 9 dígitos';
    if (country === 'DE' && !/^[CFGHJKLMNPRTVWXYZ0-9]{9}$/.test(n)) return 'Pasaporte alemán: 9 caracteres';
    if (country === 'FR' && !/^\d{9}$/.test(n)) return 'Pasaporte francés: 9 dígitos';
    if (country === 'US' && !/^[A-Z0-9]{9}$/.test(n)) return 'Pasaporte USA: 9 caracteres';
  }
  if (docType === 'nie' && country === 'ES') {
    if (!/^[XYZ]\d{7}[A-Z]$/.test(n)) return 'NIE: X/Y/Z + 7 dígitos + letra';
  }
  return null;
}

const ADDRESS_COUNTRIES = WORLD_COUNTRIES;

const emptyForm = {
  firstName: '', lastName: '',
  docType: 'dni', dniPassport: '', docCountry: 'ES',
  nationality: '',
  birthDate: '',
  phoneCode: '+34', phoneNumber: '',
  email: '', notes: '',
  language: 'es',
  street: '', city: '', postalCode: '', province: '', country: '',
};


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

  // ── Filtros y ordenación ───────────────────────────────────────────────
  const [filterSearch, setFilterSearch] = useState('');
  const [filterNationality, setFilterNationality] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ── Formulario ────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  // ── Edición masiva ─────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [docWarning, setDocWarning] = useState('');
  const validationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageManuallySet = useRef(false);

  const STALE_5MIN = 5 * 60 * 1000;

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then(r => {
      const d = r.data; return d?.data || d || [];
    }),
    staleTime: STALE_5MIN,
    placeholderData: keepPreviousData,
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
    staleTime: STALE_5MIN,
    placeholderData: keepPreviousData,
  });

  // ── Ordenación ────────────────────────────────────────────────────────
  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };


  // ── Filtrado + ordenación ─────────────────────────────────────────────
  const filteredSorted = useMemo(() => {
    let r = [...clients];
    if (filterSearch) {
      const s = filterSearch.toLowerCase();
      r = r.filter((c: Client) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(s) ||
        (c.dniPassport || '').toLowerCase().includes(s)
      );
    }
    if (filterNationality) r = r.filter((c: Client) => c.nationality === filterNationality);
    if (filterLanguage)    r = r.filter((c: Client) => c.language === filterLanguage);
    if (sortKey) {
      r.sort((a: Client, b: Client) => {
        if (sortKey === 'bookings') {
          const sa = (summaries as any)[a.id]?.totalBookings ?? 0;
          const sb = (summaries as any)[b.id]?.totalBookings ?? 0;
          return sortDir === 'asc' ? sa - sb : sb - sa;
        }
        if (sortKey === 'rating') {
          const sa = (summaries as any)[a.id]?.avgScore ?? 0;
          const sb = (summaries as any)[b.id]?.avgScore ?? 0;
          return sortDir === 'asc' ? sa - sb : sb - sa;
        }
        let va = '', vb = '';
        if      (sortKey === 'name')     { va = `${a.firstName} ${a.lastName}`; vb = `${b.firstName} ${b.lastName}`; }
        else if (sortKey === 'dni')      { va = a.dniPassport || ''; vb = b.dniPassport || ''; }
        else if (sortKey === 'email')    { va = a.email || ''; vb = b.email || ''; }
        else if (sortKey === 'language') { va = a.language || ''; vb = b.language || ''; }
        const cmp = va.localeCompare(vb, 'es');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return r;
  }, [clients, summaries, filterSearch, filterNationality, filterLanguage, sortKey, sortDir]);

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

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDocWarning(''); languageManuallySet.current = false; setShowForm(true); };

  const openEdit = (e: React.MouseEvent, c: Client) => {
    e.stopPropagation();
    setEditing(c);
    let phoneCode = '+34';
    let phoneNumber = c.phone || '';
    const match = (c.phone || '').match(/^(\+\d{1,4})(.*)$/);
    if (match) { phoneCode = match[1]; phoneNumber = match[2]; }
    setForm({
      firstName: c.firstName, lastName: c.lastName,
      docType: 'dni', dniPassport: c.dniPassport || '', docCountry: 'ES',
      nationality: c.nationality || '',
      birthDate: '',
      phoneCode, phoneNumber,
      email: c.email || '', notes: c.notes || '',
      language: c.language || 'es',
      street: c.street || '', city: c.city || '', postalCode: c.postalCode || '',
      province: c.province || '', country: c.country || '',
    });
    setDocWarning('');
    languageManuallySet.current = false;
    setShowForm(true);
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const updated = { ...form, [k]: e.target.value };
    if (k === 'nationality' && !languageManuallySet.current) {
      updated.language = langFromNationality(e.target.value);
    }
    setForm(updated);
    if (k === 'dniPassport' || k === 'docType' || k === 'docCountry') {
      if (validationTimer.current) clearTimeout(validationTimer.current);
      validationTimer.current = setTimeout(() => {
        const warn = validateDoc(updated.docType, updated.dniPassport, updated.docCountry);
        setDocWarning(warn || '');
      }, 600);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const phone = form.phoneNumber ? `${form.phoneCode}${form.phoneNumber}` : undefined;
    const data = {
      firstName:   form.firstName,
      lastName:    form.lastName,
      dniPassport: form.dniPassport || undefined,
      nationality: form.nationality || undefined,
      birthDate:   form.birthDate   || undefined,
      email:       form.email       || undefined,
      phone,
      notes:       form.notes       || undefined,
      language:    form.language    || 'es',
      street:      form.street      || undefined,
      city:        form.city        || undefined,
      postalCode:  form.postalCode  || undefined,
      province:    form.province    || undefined,
      country:     form.country     || undefined,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const hasFilters = filterSearch || filterNationality || filterLanguage;

  // ── Bulk helpers ───────────────────────────────────────────────────────
  const allVisibleSelected = filteredSorted.length > 0 && filteredSorted.every((c: Client) => selectedIds.has(c.id));
  const toggleAll = () => {
    if (allVisibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredSorted.map((c: Client) => c.id)));
  };
  const toggleOne = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const cancelBulk = () => { setSelectedIds(new Set()); setBulkAction(''); setBulkValue(''); setBulkResult(null); };
  const applyBulk = async () => {
    if (!bulkAction || !bulkValue || bulkLoading) return;
    setBulkLoading(true); setBulkResult(null);
    const results = await Promise.allSettled(
      Array.from(selectedIds).map(id =>
        api.put(`/clients/${id}`, { [bulkAction]: bulkValue })
      )
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    const errors = [...new Set(rejected.map(r => r.reason?.response?.data?.message || r.reason?.message || 'Error desconocido'))];
    setBulkLoading(false); setBulkResult({ ok, fail: rejected.length, errors });
    qc.invalidateQueries({ queryKey: ['clients'] });
    if (rejected.length === 0) cancelBulk();
  };

  // ── Columnas de la tabla ─────────────────────────────────────────────
  const clientColumns: Column<Client>[] = [
    {
      header: <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="w-4 h-4 accent-emerald-500 rounded cursor-pointer" />,
      thClassName: 'pl-4 py-3 w-10',
      tdClassName: 'pl-4 py-3',
      stopPropagation: true,
      render: (c) => (
        <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleOne(c.id)}
          className="w-4 h-4 accent-emerald-500 rounded cursor-pointer" />
      ),
    },
    {
      header: t('common.name'), sortKey: 'name',
      tdClassName: 'px-4 py-3 font-medium',
      render: (c) => `${c.firstName} ${c.lastName}`,
    },
    {
      header: t('clients.dni'), sortKey: 'dni',
      tdClassName: 'px-4 py-3 text-slate-400 font-mono text-xs',
      render: (c) => c.dniPassport || '—',
    },
    {
      header: t('common.email'), sortKey: 'email',
      tdClassName: 'px-4 py-3 text-slate-400',
      render: (c) => c.email || '—',
    },
    {
      header: t('common.phone'),
      tdClassName: 'px-4 py-3 text-slate-400',
      render: (c) => c.phone || '—',
    },
    {
      header: t('clients.bookings'), sortKey: 'bookings',
      tdClassName: 'px-4 py-3 text-slate-400',
      render: (c) => { const s = (summaries as any)[c.id]; return s ? s.totalBookings : '—'; },
    },
    {
      header: t('clients.rating'), sortKey: 'rating',
      tdClassName: 'px-4 py-3',
      render: (c) => {
        const s = (summaries as any)[c.id];
        return s?.avgScore
          ? <Stars score={s.avgScore} />
          : <span className="text-slate-600 text-xs">{t('clients.noRating')}</span>;
      },
    },
    {
      header: 'Idioma', sortKey: 'language',
      tdClassName: 'px-4 py-3 text-slate-400 text-xs',
      render: (c) => LANGUAGES.find(l => l.code === c.language)?.name || 'Español',
    },
    {
      header: '',
      tdClassName: 'px-4 py-3',
      stopPropagation: true,
      render: (c) => (
        <div className="flex gap-2 justify-end">
          <button onClick={e => openEdit(e, c)}
            className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
            {t('common.edit')}
          </button>
          <button onClick={e => { e.stopPropagation(); if (confirm(t('common.confirm_delete'))) deleteMutation.mutate(c.id); }}
            className={BTN_DANGER}>
            {t('common.delete')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className={`p-6${selectedIds.size > 0 ? ' pb-24' : ''}`}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('clients.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {filteredSorted.length} {t('clients.registered')}
            {hasFilters && clients.length !== filteredSorted.length ? ` (de ${clients.length})` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelButtons entity="clients" onImportSuccess={() => qc.invalidateQueries({ queryKey: ['clients'] })} />
          <button onClick={openCreate}
            className={BTN_PRIMARY}>
            + {t('clients.new')}
          </button>
        </div>
      </div>

      {/* ── Barra de filtros ────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          placeholder="Buscar por nombre o DNI..."
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          className="flex-1 min-w-48 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
        />
        <select value={filterNationality} onChange={e => setFilterNationality(e.target.value)} className={selCls}>
          <option value="">Todas las nac.</option>
          {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
        </select>
        <select value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)} className={selCls}>
          <option value="">Todos los idiomas</option>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setFilterSearch(''); setFilterNationality(''); setFilterLanguage(''); }}
            className="px-3 py-2 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors">
            Limpiar
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-20">{t('common.loading')}</div>
      ) : clients.length === 0 ? (
        <div className="text-slate-400 text-center py-20">{t('common.noData')}</div>
      ) : (
        <DataTable
          columns={clientColumns}
          rows={filteredSorted}
          getRowKey={(c) => c.id}
          onRowClick={(c, i) => navigate(`/clients/${c.id}`, { state: { ids: filteredSorted.map((x: any) => x.id), index: i } })}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          emptyMessage="No se encontraron resultados"
          renderCard={(c, i) => {
            const s = (summaries as any)[c.id];
            return (
              <div key={c.id}
                onClick={() => navigate(`/clients/${c.id}`, { state: { ids: filteredSorted.map((x: any) => x.id), index: i } })}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer active:bg-slate-800/70 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleOne(c.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer shrink-0" />
                    <span className="font-medium text-white truncate">{c.firstName} {c.lastName}</span>
                  </div>
                  {s?.avgScore
                    ? <Stars score={s.avgScore} />
                    : <span className="text-xs text-slate-500">{t('clients.noRating')}</span>}
                </div>
                {c.dniPassport && <p className="text-xs text-slate-400 font-mono mb-1">{c.dniPassport}</p>}
                {c.email && <p className="text-xs text-slate-400 mb-1">{c.email}</p>}
                {c.phone && <p className="text-xs text-slate-400 mb-1">{c.phone}</p>}
                {s && <p className="text-xs text-slate-500 mb-1">{s.totalBookings} {t('clients.bookings')}</p>}
                {c.language && <p className="text-xs text-slate-500 mb-2">{LANGUAGES.find(l => l.code === c.language)?.name || 'Español'}</p>}
                <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                  <button onClick={e => openEdit(e, c)}
                    className="flex-1 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-white">
                    {t('common.edit')}
                  </button>
                  <button onClick={e => { e.stopPropagation(); if (confirm(t('common.confirm_delete'))) deleteMutation.mutate(c.id); }}
                    className={`flex-1 ${BTN_DANGER}`}>
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            );
          }}
        />
      )}

      {/* ── Barra de edición masiva ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 px-4 py-3 flex flex-wrap items-center gap-3 shadow-2xl">
          <span className="text-sm font-semibold text-white whitespace-nowrap">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div className="hidden sm:block h-4 w-px bg-slate-600" />
          <select value={bulkAction} onChange={e => { setBulkAction(e.target.value); setBulkValue(''); setBulkResult(null); }}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
            <option value="">— Acción —</option>
            <option value="language">Cambiar idioma</option>
            <option value="country">Cambiar país</option>
          </select>
          {bulkAction === 'language' && (
            <select value={bulkValue} onChange={e => { setBulkValue(e.target.value); setBulkResult(null); }}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
              <option value="">— Idioma —</option>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          )}
          {bulkAction === 'country' && (
            <select value={bulkValue} onChange={e => { setBulkValue(e.target.value); setBulkResult(null); }}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
              <option value="">— País —</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
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
              className={BTN_PRIMARY}>
              {bulkLoading ? '...' : 'Aplicar'}
            </button>
            <button onClick={cancelBulk}
              className={BTN_SECONDARY}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className={MODAL_OVERLAY}>
          <div className={`${MODAL_PANEL} max-h-[95vh] md:max-h-[90vh] overflow-y-auto`}>
            <h2 className="text-lg font-bold mb-5 text-white">{editing ? t('common.edit') : t('clients.new')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Nombre y apellido */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t('clients.firstName')} *</label>
                  <input value={form.firstName} onChange={f('firstName')} required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t('clients.lastName')} *</label>
                  <input value={form.lastName} onChange={f('lastName')} required className={inputCls} />
                </div>
              </div>

              {/* Documento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Tipo documento</label>
                  <select value={form.docType} onChange={f('docType')} className={inputCls}>
                    <option value="dni">DNI Nacional</option>
                    <option value="passport">Pasaporte</option>
                    <option value="nie">NIE</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>País expedición</label>
                  <select value={form.docCountry} onChange={f('docCountry')} className={inputCls}>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('clients.dni')}</label>
                <input value={form.dniPassport} onChange={f('dniPassport')}
                  placeholder={form.docType === 'dni' ? '12345678A' : form.docType === 'passport' ? 'AAA123456' : ''}
                  className={inputCls} />
                {docWarning && <p className="text-amber-400 text-xs mt-1">⚠ {docWarning}</p>}
              </div>

              {/* Nacionalidad y fecha nacimiento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t('clients.nationality')}</label>
                  <select value={form.nationality} onChange={f('nationality')} className={inputCls}>
                    <option value="">— Seleccionar —</option>
                    {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t('clients.birthDate')}</label>
                  <input type="date" value={form.birthDate} onChange={f('birthDate')} className={inputCls} />
                </div>
              </div>

              {/* Teléfono */}
              <div>
                <label className={labelCls}>{t('common.phone')}</label>
                <div className="flex gap-2">
                  <select value={form.phoneCode} onChange={f('phoneCode')}
                    className="px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 w-28">
                    {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.flag} {c.phone}</option>)}
                  </select>
                  <input value={form.phoneNumber} onChange={f('phoneNumber')} placeholder="600000000"
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className={labelCls}>{t('common.email')}</label>
                <input type="email" value={form.email} onChange={f('email')} className={inputCls} />
              </div>

              {/* Idioma */}
              <div>
                <label className={labelCls}>Idioma de contacto</label>
                <select
                  value={form.language || 'es'}
                  onChange={e => { languageManuallySet.current = true; f('language')(e); }}
                  className={inputCls}>
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
                {!languageManuallySet.current && form.nationality && (
                  <p className="text-xs text-sky-400 mt-1">🌐 Asignado automáticamente por nacionalidad</p>
                )}
              </div>

              {/* Dirección */}
              <div className="border-t border-slate-700 pt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Dirección</p>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Calle y número</label>
                    <input value={form.street} onChange={f('street')} placeholder="Calle Mayor 1, 2º A" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Código postal</label>
                      <input value={form.postalCode} onChange={f('postalCode')} placeholder="28001" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Ciudad</label>
                      <input value={form.city} onChange={f('city')} placeholder="Madrid" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Provincia</label>
                      <input value={form.province} onChange={f('province')} placeholder="Madrid" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>País</label>
                      <select value={form.country} onChange={f('country')} className={inputCls}>
                        <option value="">— País —</option>
                        {ADDRESS_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className={labelCls}>{t('common.notes')}</label>
                <textarea value={form.notes} onChange={f('notes')} rows={3}
                  className={`${inputCls} resize-none`} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className={`flex-1 ${BTN_SECONDARY}`}>
                  {t('common.cancel')}
                </button>
                <button type="submit"
                  className={`flex-1 ${BTN_PRIMARY}`}>
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
