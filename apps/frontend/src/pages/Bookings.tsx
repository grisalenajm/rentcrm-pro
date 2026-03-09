import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

// ── Datos de países ───────────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'ES', name: 'España',          phone: '+34',  flag: '🇪🇸' },
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

// ── Validación de documentos por país ────────────────────────────────────
function validateDoc(docType: string, docNumber: string, country: string): string | null {
  const n = docNumber.toUpperCase().trim();
  if (!n) return null;
  if (docType === 'dni' && country === 'ES') {
    if (!/^\d{8}[A-Z]$/.test(n)) return 'DNI español: 8 dígitos + letra (ej: 12345678A)';
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    if (letters[parseInt(n.slice(0, 8)) % 23] !== n[8]) return 'Letra del DNI incorrecta';
  }
  if (docType === 'passport') {
    if (country === 'ES' && !/^[A-Z]{3}\d{6}$/.test(n)) return 'Pasaporte español: 3 letras + 6 dígitos (ej: AAA123456)';
    if (country === 'GB' && !/^\d{9}$/.test(n)) return 'Pasaporte UK: 9 dígitos';
    if (country === 'DE' && !/^[CFGHJKLMNPRTVWXYZ0-9]{9}$/.test(n)) return 'Pasaporte alemán: 9 caracteres alfanuméricos';
    if (country === 'FR' && !/^\d{9}$/.test(n)) return 'Pasaporte francés: 9 dígitos';
    if (country === 'US' && !/^[A-Z0-9]{9}$/.test(n)) return 'Pasaporte USA: 9 caracteres alfanuméricos';
  }
  if (docType === 'nie' && country === 'ES') {
    if (!/^[XYZ]\d{7}[A-Z]$/.test(n)) return 'NIE: X/Y/Z + 7 dígitos + letra (ej: X1234567A)';
  }
  return null;
}

const statusColor: Record<string, string> = {
  confirmed: 'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-red-500/10 text-red-400',
  completed: 'bg-slate-500/10 text-slate-400',
  pending:   'bg-amber-500/10 text-amber-400',
};

const emptyGuest = () => ({
  firstName: '', lastName: '', docType: 'passport', docNumber: '',
  docCountry: 'ES', birthDate: '', phoneCode: '+34', phoneNumber: '',
});

const inputCls = "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500";
const labelCls = "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1";

function DocFields({ prefix, docType, docNumber, docCountry, onDocType, onDocNumber, onDocCountry, readonly, warnings }: {
  prefix: string; docType: string; docNumber: string; docCountry: string;
  onDocType: any; onDocNumber: any; onDocCountry: any; readonly?: boolean;
  warnings: Record<string, string>;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Tipo doc.</label>
          <select value={docType} onChange={onDocType} disabled={readonly}
            className={`${inputCls} ${readonly ? 'opacity-60 cursor-default' : ''}`}>
            <option value="dni">DNI Nacional</option>
            <option value="passport">Pasaporte</option>
            <option value="nie">NIE</option>
            <option value="other">Otro</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>País expedición</label>
          <select value={docCountry} onChange={onDocCountry} disabled={readonly}
            className={`${inputCls} ${readonly ? 'opacity-60 cursor-default' : ''}`}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Nº documento *</label>
        <input value={docNumber} onChange={onDocNumber} readOnly={readonly}
          placeholder={docType === 'dni' ? '12345678A' : docType === 'passport' ? 'AAA123456' : ''}
          className={`${inputCls} ${readonly ? 'opacity-60 cursor-default' : ''}`} />
        {warnings[prefix] && (
          <p className="text-amber-400 text-xs mt-1">⚠ {warnings[prefix]}</p>
        )}
      </div>
    </div>
  );
}

function PhoneField({ phoneCode, phoneNumber, onCode, onNumber, readonly }: {
  phoneCode: string; phoneNumber: string; onCode: any; onNumber: any; readonly?: boolean;
}) {
  return (
    <div>
      <label className={labelCls}>Teléfono</label>
      <div className="flex gap-2">
        <select value={phoneCode} onChange={onCode} disabled={readonly}
          className={`px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 w-28 ${readonly ? 'opacity-60 cursor-default' : ''}`}>
          {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.phone} {c.code}</option>)}
        </select>
        <input value={phoneNumber} onChange={onNumber} readOnly={readonly} placeholder="600000000"
          className={`flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 ${readonly ? 'opacity-60 cursor-default' : ''}`} />
      </div>
    </div>
  );
}

export default function Bookings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [form, setForm] = useState({
    clientId: '', propertyId: '',
    checkInDate: '', checkOutDate: '',
    totalAmount: '', source: 'direct', status: 'confirmed', notes: '',
  });
  const [newClient, setNewClient] = useState({
    firstName: '', lastName: '', docType: 'dni', dniPassport: '',
    docCountry: 'ES', nationality: '', birthDate: '',
    phoneCode: '+34', phoneNumber: '', email: '',
  });
  const [guests, setGuests] = useState<ReturnType<typeof emptyGuest>[]>([]);
  const [docWarnings, setDocWarnings] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState('');

  const { data: bookingsRaw, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings').then(r => r.data),
  });
  const bookings = bookingsRaw?.data || bookingsRaw || [];

  const { data: clientsRaw } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then(r => r.data),
  });
  const clients = clientsRaw?.data || clientsRaw || [];

  const { data: propertiesRaw } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then(r => r.data),
  });
  const properties = propertiesRaw?.data || propertiesRaw || [];

  const createClientMutation = useMutation({
    mutationFn: (data: any) => api.post('/clients', data).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/bookings', data),
    onSuccess: async (res) => {
      const bookingId = res.data.id;
      // Crear huéspedes SES
      for (const g of guests) {
        if (!g.firstName || !g.lastName || !g.docNumber) continue;
        await api.post(`/bookings/${bookingId}/guests-ses`, {
          firstName:  g.firstName,
          lastName:   g.lastName,
          docType:    g.docType,
          docNumber:  g.docNumber,
          docCountry: g.docCountry,
          birthDate:  g.birthDate || undefined,
          phone:      g.phoneNumber ? `${g.phoneCode}${g.phoneNumber}` : undefined,
        });
      }
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      setShowForm(false);
      setErrorMsg('');
      resetForm();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg || 'Error al crear la reserva.');
    },
  });

  const resetForm = () => {
    setForm({ clientId: '', propertyId: '', checkInDate: '', checkOutDate: '', totalAmount: '', source: 'direct', status: 'confirmed', notes: '' });
    setNewClient({ firstName: '', lastName: '', docType: 'dni', dniPassport: '', docCountry: 'ES', nationality: '', birthDate: '', phoneCode: '+34', phoneNumber: '', email: '' });
    setGuests([]);
    setDocWarnings({});
    setClientMode('existing');
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const validationTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const scheduleValidation = (key: string, fn: () => void) => {
    if (validationTimers.current[key]) clearTimeout(validationTimers.current[key]);
    validationTimers.current[key] = setTimeout(fn, 600);
  };

  const fc = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const updated = { ...newClient, [k]: e.target.value };
    setNewClient(updated);
    if (k === 'dniPassport' || k === 'docType' || k === 'docCountry') {
      scheduleValidation('main', () => {
        const warn = validateDoc(updated.docType, updated.dniPassport, updated.docCountry);
        setDocWarnings(w => ({ ...w, main: warn || '' }));
      });
    }
  };

  const handleClientSelect = (id: string) => {
    const client = clients.find((c: any) => c.id === id);
    if (client) {
      setNewClient({
        firstName:   client.firstName   || '',
        lastName:    client.lastName    || '',
        docType:     'dni',
        dniPassport: client.dniPassport || '',
        docCountry:  'ES',
        nationality: client.nationality || '',
        birthDate:   client.birthDate ? client.birthDate.substring(0, 10) : '',
        phoneCode:   '+34',
        phoneNumber: client.phone || '',
        email:       client.email || '',
      });
    }
    setForm({ ...form, clientId: id });
  };

  const addGuest = () => setGuests(g => [...g, emptyGuest()]);

  const updateGuest = (i: number, k: string, v: string) => {
    const updated = guests.map((g, idx) => idx === i ? { ...g, [k]: v } : g);
    setGuests(updated);
    if (k === 'docNumber' || k === 'docType' || k === 'docCountry') {
      scheduleValidation(`guest_${i}`, () => {
        const g = updated[i];
        const warn = validateDoc(g.docType, g.docNumber, g.docCountry);
        setDocWarnings(w => ({ ...w, [`guest_${i}`]: warn || '' }));
      });
    }
  };

  const removeGuest = (i: number) => {
    setGuests(g => g.filter((_, idx) => idx !== i));
    setDocWarnings(w => { const n = { ...w }; delete n[`guest_${i}`]; return n; });
  };

  const handleSubmit = async () => {
    setErrorMsg('');
    try {
      let clientId = form.clientId;
      if (clientMode === 'new') {
        if (!newClient.firstName || !newClient.lastName) {
          setErrorMsg('El nombre y apellido del cliente son obligatorios.');
          return;
        }
        const created = await createClientMutation.mutateAsync({
          firstName:   newClient.firstName,
          lastName:    newClient.lastName,
          dniPassport: newClient.dniPassport || undefined,
          nationality: newClient.nationality || undefined,
          birthDate:   newClient.birthDate   || undefined,
          email:       newClient.email       || undefined,
          phone:       newClient.phoneNumber ? `${newClient.phoneCode}${newClient.phoneNumber}` : undefined,
        });
        clientId = created.id;
      }
      createMutation.mutate({
        clientId,
        propertyId:   form.propertyId,
        checkInDate:  form.checkInDate,
        checkOutDate: form.checkOutDate,
        totalAmount:  Number(form.totalAmount),
        source:       form.source,
        status:       form.status,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg || 'Error al crear el cliente.');
    }
  };

  const isSubmitDisabled =
    !form.propertyId || !form.checkInDate || !form.checkOutDate || !form.totalAmount ||
    (clientMode === 'existing' ? !form.clientId : !newClient.firstName || !newClient.lastName) ||
    createMutation.isPending || createClientMutation.isPending;


  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('bookings.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{bookings.length} {t('bookings.registered')}</p>
        </div>
        <button onClick={() => { setShowForm(true); setErrorMsg(''); resetForm(); }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
          + {t('bookings.new')}
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-20">{t('common.loading')}</div>
      ) : bookings.length === 0 ? (
        <div className="text-slate-400 text-center py-20">{t('common.noData')}</div>
      ) : (
        <>
          {/* Desktop: tabla */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('bookings.client')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('bookings.property')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('bookings.checkIn')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('bookings.checkOut')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('common.total')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('bookings.source')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b: any) => (
                  <tr key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}
                    className="border-b border-slate-800 hover:bg-slate-800/70 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-medium">{b.client?.firstName} {b.client?.lastName}</td>
                    <td className="px-4 py-3 text-slate-400">{b.property?.name}</td>
                    <td className="px-4 py-3 text-slate-400">{new Date(b.checkInDate).toLocaleDateString('es-ES')}</td>
                    <td className="px-4 py-3 text-slate-400">{new Date(b.checkOutDate).toLocaleDateString('es-ES')}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">€{b.totalAmount}</td>
                    <td className="px-4 py-3 text-slate-400">{t(`bookings.sources.${b.source}`) || b.source}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[b.status] || 'bg-slate-500/10 text-slate-400'}`}>
                        {t(`bookings.statuses.${b.status}`) || b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Móvil: tarjetas */}
          <div className="md:hidden space-y-3">
            {bookings.map((b: any) => (
              <div key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer active:bg-slate-800/70">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-white">{b.client?.firstName} {b.client?.lastName}</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[b.status] || 'bg-slate-500/10 text-slate-400'}`}>
                    {t(`bookings.statuses.${b.status}`) || b.status}
                  </span>
                </div>
                <p className="text-slate-400 text-sm mb-2">{b.property?.name}</p>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>{new Date(b.checkInDate).toLocaleDateString('es-ES')} → {new Date(b.checkOutDate).toLocaleDateString('es-ES')}</span>
                  <span className="font-semibold text-emerald-400">€{b.totalAmount}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl p-6 w-full md:max-w-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-5 text-white">{t('bookings.new')}</h2>

            {errorMsg && (
              <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                {errorMsg}
              </div>
            )}

            <div className="space-y-5">

              {/* ── Cliente titular ───────────────────────────────── */}
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-4">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Cliente titular</p>

                <div className="flex gap-2">
                  <button onClick={() => setClientMode('existing')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${clientMode === 'existing' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                    Cliente existente
                  </button>
                  <button onClick={() => { setClientMode('new'); setForm({ ...form, clientId: '' }); setNewClient({ firstName: '', lastName: '', docType: 'dni', dniPassport: '', docCountry: 'ES', nationality: '', birthDate: '', phoneCode: '+34', phoneNumber: '', email: '' }); }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${clientMode === 'new' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                    + Nuevo cliente
                  </button>
                </div>

                {clientMode === 'existing' && (
                  <select value={form.clientId} onChange={e => handleClientSelect(e.target.value)} className={inputCls}>
                    <option value="">— Seleccionar cliente —</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                  </select>
                )}

                {(clientMode === 'new' || form.clientId) && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Nombre *</label>
                        <input value={newClient.firstName} onChange={fc('firstName')}
                          readOnly={clientMode === 'existing'}
                          className={`${inputCls} text-white ${clientMode === 'existing' ? 'opacity-60 cursor-default' : ''}`} />
                      </div>
                      <div>
                        <label className={labelCls}>Apellido *</label>
                        <input value={newClient.lastName} onChange={fc('lastName')}
                          readOnly={clientMode === 'existing'}
                          className={`${inputCls} text-white ${clientMode === 'existing' ? 'opacity-60 cursor-default' : ''}`} />
                      </div>
                    </div>
                    <DocFields
                      prefix="main"
                      docType={newClient.docType} docNumber={newClient.dniPassport} docCountry={newClient.docCountry}
                      onDocType={fc('docType')} onDocNumber={fc('dniPassport')} onDocCountry={fc('docCountry')}
                      readonly={clientMode === 'existing'}
                      warnings={docWarnings}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Nacionalidad</label>
                        <select value={newClient.nationality} onChange={fc('nationality')}
                          disabled={clientMode === 'existing'}
                          className={`${inputCls} ${clientMode === 'existing' ? 'opacity-60 cursor-default' : ''}`}>
                          <option value="">— Seleccionar —</option>
                          {COUNTRIES.map(c => (
                            <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Fecha nacimiento</label>
                        <input type="date" value={newClient.birthDate} onChange={fc('birthDate')}
                          readOnly={clientMode === 'existing'}
                          className={`${inputCls} ${clientMode === 'existing' ? 'opacity-60 cursor-default' : ''}`} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Email</label>
                        <input type="email" value={newClient.email} onChange={fc('email')}
                          readOnly={clientMode === 'existing'}
                          className={`${inputCls} ${clientMode === 'existing' ? 'opacity-60 cursor-default' : ''}`} />
                      </div>
                      <PhoneField
                        phoneCode={newClient.phoneCode} phoneNumber={newClient.phoneNumber}
                        onCode={fc('phoneCode')} onNumber={fc('phoneNumber')}
                        readonly={clientMode === 'existing'}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Huéspedes adicionales SES ─────────────────────── */}
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Huéspedes adicionales <span className="text-slate-500 normal-case font-normal">(para SES)</span>
                  </p>
                  {guests.length < 4 && (
                    <button onClick={addGuest}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors">
                      + Añadir huésped
                    </button>
                  )}
                </div>

                {guests.length === 0 && (
                  <p className="text-slate-500 text-xs text-center py-2">No hay huéspedes adicionales</p>
                )}

                {guests.map((g, i) => (
                  <div key={i} className="border border-slate-600 rounded-xl p-4 space-y-3 relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-400">Huésped {i + 1}</span>
                      <button onClick={() => removeGuest(i)}
                        className="text-red-400 hover:text-red-300 text-xs font-semibold">✕ Eliminar</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Nombre *</label>
                        <input value={g.firstName} onChange={e => updateGuest(i, 'firstName', e.target.value)}
                          className={`${inputCls} text-white`} />
                      </div>
                      <div>
                        <label className={labelCls}>Apellido *</label>
                        <input value={g.lastName} onChange={e => updateGuest(i, 'lastName', e.target.value)}
                          className={`${inputCls} text-white`} />
                      </div>
                    </div>
                    <DocFields
                      prefix={`guest_${i}`}
                      docType={g.docType} docNumber={g.docNumber} docCountry={g.docCountry}
                      onDocType={e => updateGuest(i, 'docType', e.target.value)}
                      onDocNumber={e => updateGuest(i, 'docNumber', e.target.value)}
                      onDocCountry={e => updateGuest(i, 'docCountry', e.target.value)}
                      warnings={docWarnings}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Fecha nacimiento</label>
                        <input type="date" value={g.birthDate} onChange={e => updateGuest(i, 'birthDate', e.target.value)}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Teléfono</label>
                        <div className="flex gap-2">
                          <select value={g.phoneCode} onChange={e => updateGuest(i, 'phoneCode', e.target.value)}
                            className="px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 w-28">
                            {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.phone} {c.code}</option>)}
                          </select>
                          <input value={g.phoneNumber} onChange={e => updateGuest(i, 'phoneNumber', e.target.value)}
                            placeholder="600000000"
                            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Datos de la reserva ───────────────────────────── */}
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-4">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Datos de la reserva</p>

                <div>
                  <label className={labelCls}>{t('bookings.property')} *</label>
                  <select value={form.propertyId} onChange={f('propertyId')} className={inputCls}>
                    <option value="">— {t('bookings.property')} —</option>
                    {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>{t('bookings.checkIn')} *</label>
                    <input type="date" value={form.checkInDate} onChange={f('checkInDate')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('bookings.checkOut')} *</label>
                    <input type="date" value={form.checkOutDate} onChange={f('checkOutDate')} className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>{t('common.total')} (€) *</label>
                    <input type="number" value={form.totalAmount} onChange={f('totalAmount')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('bookings.source')}</label>
                    <select value={form.source} onChange={f('source')} className={inputCls}>
                      {['direct','airbnb','booking','vrbo','manual_block'].map(s => (
                        <option key={s} value={s}>{t(`bookings.sources.${s}`)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>{t('common.notes')}</label>
                  <textarea value={form.notes} onChange={f('notes')} rows={2}
                    className={`${inputCls} resize-none`} />
                </div>
              </div>

              {/* ── Botones ───────────────────────────────────────── */}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setShowForm(false); setErrorMsg(''); resetForm(); }}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold text-white transition-colors">
                  {t('common.cancel')}
                </button>
                <button onClick={handleSubmit} disabled={isSubmitDisabled}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold text-white transition-colors">
                  {createMutation.isPending || createClientMutation.isPending ? t('common.saving') : t('bookings.new')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
