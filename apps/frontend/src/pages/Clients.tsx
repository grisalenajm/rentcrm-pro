import { useState, useRef } from 'react';
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

const COUNTRIES = [
  { code: 'ES', name: 'España',         phone: '+34',  flag: '🇪🇸' },
  { code: 'DE', name: 'Alemania',        phone: '+49',  flag: '🇩🇪' },
  { code: 'FR', name: 'Francia',         phone: '+33',  flag: '🇫🇷' },
  { code: 'GB', name: 'Reino Unido',     phone: '+44',  flag: '🇬🇧' },
  { code: 'IT', name: 'Italia',          phone: '+39',  flag: '🇮🇹' },
  { code: 'PT', name: 'Portugal',        phone: '+351', flag: '🇵🇹' },
  { code: 'NL', name: 'Países Bajos',    phone: '+31',  flag: '🇳🇱' },
  { code: 'BE', name: 'Bélgica',         phone: '+32',  flag: '🇧🇪' },
  { code: 'CH', name: 'Suiza',           phone: '+41',  flag: '🇨🇭' },
  { code: 'AT', name: 'Austria',         phone: '+43',  flag: '🇦🇹' },
  { code: 'SE', name: 'Suecia',          phone: '+46',  flag: '🇸🇪' },
  { code: 'NO', name: 'Noruega',         phone: '+47',  flag: '🇳🇴' },
  { code: 'DK', name: 'Dinamarca',       phone: '+45',  flag: '🇩🇰' },
  { code: 'FI', name: 'Finlandia',       phone: '+358', flag: '🇫🇮' },
  { code: 'PL', name: 'Polonia',         phone: '+48',  flag: '🇵🇱' },
  { code: 'CZ', name: 'Rep. Checa',      phone: '+420', flag: '🇨🇿' },
  { code: 'HU', name: 'Hungría',         phone: '+36',  flag: '🇭🇺' },
  { code: 'RO', name: 'Rumanía',         phone: '+40',  flag: '🇷🇴' },
  { code: 'GR', name: 'Grecia',          phone: '+30',  flag: '🇬🇷' },
  { code: 'US', name: 'Estados Unidos',  phone: '+1',   flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá',          phone: '+1',   flag: '🇨🇦' },
  { code: 'MX', name: 'México',          phone: '+52',  flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina',       phone: '+54',  flag: '🇦🇷' },
  { code: 'BR', name: 'Brasil',          phone: '+55',  flag: '🇧🇷' },
  { code: 'CO', name: 'Colombia',        phone: '+57',  flag: '🇨🇴' },
  { code: 'CL', name: 'Chile',           phone: '+56',  flag: '🇨🇱' },
  { code: 'MA', name: 'Marruecos',       phone: '+212', flag: '🇲🇦' },
  { code: 'CN', name: 'China',           phone: '+86',  flag: '🇨🇳' },
  { code: 'JP', name: 'Japón',           phone: '+81',  flag: '🇯🇵' },
  { code: 'AU', name: 'Australia',       phone: '+61',  flag: '🇦🇺' },
  { code: 'RU', name: 'Rusia',           phone: '+7',   flag: '🇷🇺' },
  { code: 'UA', name: 'Ucrania',         phone: '+380', flag: '🇺🇦' },
  { code: 'TR', name: 'Turquía',         phone: '+90',  flag: '🇹🇷' },
  { code: 'IN', name: 'India',           phone: '+91',  flag: '🇮🇳' },
];

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

const emptyForm = {
  firstName: '', lastName: '',
  docType: 'dni', dniPassport: '', docCountry: 'ES',
  nationality: '',
  birthDate: '',
  phoneCode: '+34', phoneNumber: '',
  email: '', notes: '',
};

const inputCls = "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500";
const labelCls = "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1";

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
  const [docWarning, setDocWarning] = useState('');
  const validationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => api.get('/clients', { params: { search: search || undefined } }).then(r => {
      const d = r.data; return d?.data || d || [];
    }),
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

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDocWarning(''); setShowForm(true); };

  const openEdit = (e: React.MouseEvent, c: Client) => {
    e.stopPropagation();
    setEditing(c);
    // Parse phone: try to split code from number
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
    });
    setDocWarning('');
    setShowForm(true);
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const updated = { ...form, [k]: e.target.value };
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
    };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

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
        <>
          {/* Desktop: tabla */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
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

          {/* Móvil: tarjetas */}
          <div className="md:hidden space-y-3">
            {clients.map((c: Client) => {
              const s = (summaries as any)[c.id];
              return (
                <div key={c.id} onClick={() => navigate(`/clients/${c.id}`)}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer active:bg-slate-800/70 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-white">{c.firstName} {c.lastName}</span>
                    {s?.avgScore
                      ? <Stars score={s.avgScore} />
                      : <span className="text-xs text-slate-500">{t('clients.noRating')}</span>}
                  </div>
                  {c.dniPassport && (
                    <p className="text-xs text-slate-400 font-mono mb-1">{c.dniPassport}</p>
                  )}
                  {c.email && (
                    <p className="text-xs text-slate-400 mb-1">{c.email}</p>
                  )}
                  {c.phone && (
                    <p className="text-xs text-slate-400 mb-1">{c.phone}</p>
                  )}
                  {s && (
                    <p className="text-xs text-slate-500 mb-3">{s.totalBookings} {t('clients.bookings')}</p>
                  )}
                  <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                    <button onClick={e => openEdit(e, c)}
                      className="flex-1 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-white">
                      {t('common.edit')}
                    </button>
                    <button onClick={e => { e.stopPropagation(); if(confirm(t('common.confirm_delete'))) deleteMutation.mutate(c.id); }}
                      className="flex-1 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[95vh] md:max-h-[90vh] overflow-y-auto p-6">
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

              {/* Notas */}
              <div>
                <label className={labelCls}>{t('common.notes')}</label>
                <textarea value={form.notes} onChange={f('notes')} rows={3}
                  className={`${inputCls} resize-none`} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold text-white transition-colors">
                  {t('common.cancel')}
                </button>
                <button type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold text-white transition-colors">
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
