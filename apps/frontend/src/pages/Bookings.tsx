import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { bookingStatusColor, badgeCls, inputCls, labelCls, selCls, BTN_PRIMARY, BTN_SECONDARY, MODAL_OVERLAY, MODAL_PANEL } from '../lib/ui';
import FormField from '../components/FormField';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import ExcelButtons from '../components/ExcelButtons';

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

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch',
  it: 'Italiano', pt: 'Português', nl: 'Nederlands', da: 'Dansk',
  nb: 'Norsk', sv: 'Svenska',
};


const emptyGuest = () => ({
  firstName: '', lastName: '', docType: 'passport', docNumber: '',
  docCountry: 'ES', birthDate: '', phoneCode: '+34', phoneNumber: '',
});


function DocFields({ prefix, docType, docNumber, docCountry, onDocType, onDocNumber, onDocCountry, readonly, warnings }: {
  prefix: string; docType: string; docNumber: string; docCountry: string;
  onDocType: any; onDocNumber: any; onDocCountry: any; readonly?: boolean;
  warnings: Record<string, string>;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="Tipo doc.">
          <select value={docType} onChange={onDocType} disabled={readonly} className={inputCls}>
            <option value="dni">DNI Nacional</option>
            <option value="passport">Pasaporte</option>
            <option value="nie">NIE</option>
            <option value="other">Otro</option>
          </select>
        </FormField>
        <FormField label="País expedición">
          <select value={docCountry} onChange={onDocCountry} disabled={readonly} className={inputCls}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </FormField>
      </div>
      <FormField label="Nº documento" required error={warnings[prefix] ? `⚠ ${warnings[prefix]}` : undefined}>
        <input value={docNumber} onChange={onDocNumber} disabled={readonly}
          placeholder={docType === 'dni' ? '12345678A' : docType === 'passport' ? 'AAA123456' : ''}
          className={inputCls} />
      </FormField>
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
          className="px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 w-28 disabled:opacity-50 disabled:cursor-not-allowed">
          {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.phone} {c.code}</option>)}
        </select>
        <input value={phoneNumber} onChange={onNumber} disabled={readonly} placeholder="600000000"
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed" />
      </div>
    </div>
  );
}

export default function Bookings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);

  // ── Filtros y ordenación ───────────────────────────────────────────────
  const [filterSearch, setFilterSearch]       = useState('');
  const [filterProperty, setFilterProperty]   = useState('');
  const [filterStatus, setFilterStatus]       = useState('');
  const [filterDateFrom, setFilterDateFrom]   = useState('');
  const [filterDateTo, setFilterDateTo]       = useState('');
  const [showBlocks, setShowBlocks]           = useState(() => localStorage.getItem('bookings.showBlocks') === 'true');
  const [sortKey, setSortKey]                 = useState('checkin');
  const [sortDir, setSortDir]                 = useState<'asc' | 'desc'>('desc');

  // ── Estado búsqueda cliente ───────────────────────────────────────────
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [creatingNewClient, setCreatingNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState({ firstName: '', lastName: '' });
  const [form, setForm] = useState({
    clientId: '', propertyId: '',
    checkInDate: '', checkOutDate: '',
    totalAmount: '', source: 'direct', status: 'confirmed', notes: '',
  });
  const [guests, setGuests] = useState<ReturnType<typeof emptyGuest>[]>([]);
  const [docWarnings, setDocWarnings] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [dateError, setDateError] = useState('');
  const [overlapError, setOverlapError] = useState('');

  // ── Actualización masiva de precios ───────────────────────────────────
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceFile, setPriceFile] = useState<File | null>(null);
  const [priceUploading, setPriceUploading] = useState(false);
  const [priceResult, setPriceResult] = useState<{ processed: number; updated: number; errors: string[] } | null>(null);
  const priceFileRef = useRef<HTMLInputElement>(null);

  const handleDownloadPriceTemplate = async () => {
    try {
      const response = await api.get('/excel/template/bookings-price', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'plantilla_precios_reservas.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch { alert('Error al descargar plantilla'); }
  };

  const handlePriceImport = async () => {
    if (!priceFile) return;
    setPriceUploading(true);
    setPriceResult(null);
    const formData = new FormData();
    formData.append('file', priceFile);
    try {
      const res = await api.post('/excel/import/bookings-price', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPriceResult(res.data);
      qc.invalidateQueries({ queryKey: ['bookings'] });
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al importar');
    } finally {
      setPriceUploading(false);
      setPriceFile(null);
      if (priceFileRef.current) priceFileRef.current.value = '';
    }
  };

  // ── Edición masiva ─────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);

  // Validación local de fechas (inmediata)
  useEffect(() => {
    if (form.checkInDate && form.checkOutDate) {
      setDateError(
        new Date(form.checkOutDate) <= new Date(form.checkInDate)
          ? 'La fecha de salida debe ser posterior a la de entrada'
          : ''
      );
    } else {
      setDateError('');
    }
  }, [form.checkInDate, form.checkOutDate]);

  // Limpiar error de solapamiento cuando cambian fechas o propiedad
  useEffect(() => {
    setOverlapError('');
  }, [form.checkInDate, form.checkOutDate, form.propertyId]);

  // Búsqueda con debounce 300ms
  useEffect(() => {
    if (!clientSearch.trim()) {
      setClientResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/clients', { params: { search: clientSearch } });
        const data = res.data?.data || res.data || [];
        setClientResults(Array.isArray(data) ? data : []);
        setShowDropdown(true);
      } catch {
        setClientResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const { data: bookingsRaw, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings?includeBlocks=true').then(r => r.data),
  });
  const bookings = bookingsRaw?.data || bookingsRaw || [];

  const { data: propertiesRaw } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then(r => r.data),
  });
  const properties = propertiesRaw?.data || propertiesRaw || [];

  // ── Ordenación ────────────────────────────────────────────────────────
  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Filtrado + ordenación ─────────────────────────────────────────────
  const filteredSorted = useMemo(() => {
    let r = [...bookings];
    if (!showBlocks) r = r.filter((b: any) => b.source !== 'manual_block');
    if (filterSearch) {
      const s = filterSearch.toLowerCase();
      r = r.filter((b: any) =>
        `${b.client?.firstName || ''} ${b.client?.lastName || ''}`.toLowerCase().includes(s) ||
        (b.property?.name || '').toLowerCase().includes(s)
      );
    }
    if (filterProperty) r = r.filter((b: any) => b.propertyId === filterProperty || b.property?.id === filterProperty);
    if (filterStatus)   r = r.filter((b: any) => b.status === filterStatus);
    if (filterDateFrom) r = r.filter((b: any) => new Date(b.checkInDate) >= new Date(filterDateFrom));
    if (filterDateTo)   r = r.filter((b: any) => new Date(b.checkInDate) <= new Date(filterDateTo));
    if (sortKey) {
      r.sort((a: any, b: any) => {
        if (sortKey === 'checkin')  {
          const va = new Date(a.checkInDate).getTime();
          const vb = new Date(b.checkInDate).getTime();
          return sortDir === 'asc' ? va - vb : vb - va;
        }
        if (sortKey === 'checkout') {
          const va = new Date(a.checkOutDate).getTime();
          const vb = new Date(b.checkOutDate).getTime();
          return sortDir === 'asc' ? va - vb : vb - va;
        }
        if (sortKey === 'total') {
          const va = Number(a.totalAmount) || 0;
          const vb = Number(b.totalAmount) || 0;
          return sortDir === 'asc' ? va - vb : vb - va;
        }
        let va = '', vb = '';
        if      (sortKey === 'client')   { va = `${a.client?.firstName || ''} ${a.client?.lastName || ''}`; vb = `${b.client?.firstName || ''} ${b.client?.lastName || ''}`; }
        else if (sortKey === 'property') { va = a.property?.name || ''; vb = b.property?.name || ''; }
        else if (sortKey === 'source')   { va = a.source || ''; vb = b.source || ''; }
        else if (sortKey === 'status')   { va = a.status || ''; vb = b.status || ''; }
        const cmp = va.localeCompare(vb, 'es');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return r;
  }, [bookings, showBlocks, filterSearch, filterProperty, filterStatus, filterDateFrom, filterDateTo, sortKey, sortDir]);

  const createClientMutation = useMutation({
    mutationFn: (data: any) => api.post('/clients', data).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/bookings', data),
    onSuccess: async (res) => {
      const bookingId = res.data.id;
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
    setForm({ clientId: '', propertyId: '', checkInDate: '', checkOutDate: '', totalAmount: '', source: 'direct', status: 'created', notes: '' });
    setDateError('');
    setOverlapError('');
    setClientSearch('');
    setClientResults([]);
    setShowDropdown(false);
    setSelectedClient(null);
    setCreatingNewClient(false);
    setNewClientName({ firstName: '', lastName: '' });
    setGuests([]);
    setDocWarnings({});
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const validationTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const scheduleValidation = (key: string, fn: () => void) => {
    if (validationTimers.current[key]) clearTimeout(validationTimers.current[key]);
    validationTimers.current[key] = setTimeout(fn, 600);
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
    if (dateError) return;

    // Verificar solapamiento contra la API
    if (form.propertyId && form.checkInDate && form.checkOutDate) {
      try {
        const res = await api.get('/bookings', { params: { propertyId: form.propertyId } });
        const existing: any[] = res.data?.data || res.data || [];
        const newIn  = new Date(form.checkInDate).getTime();
        const newOut = new Date(form.checkOutDate).getTime();
        const fmt = (d: string) => new Date(d).toLocaleDateString('es-ES');
        for (const b of existing) {
          if (b.status === 'cancelled') continue;
          const bIn  = new Date(b.checkInDate).getTime();
          const bOut = new Date(b.checkOutDate).getTime();
          if (newIn < bOut && newOut > bIn) {
            setOverlapError(`La propiedad ya tiene una reserva del ${fmt(b.checkInDate)} al ${fmt(b.checkOutDate)}`);
            return;
          }
        }
        setOverlapError('');
      } catch { /* si falla la comprobación, no bloquear */ }
    }

    try {
      let clientId = form.clientId;
      if (creatingNewClient) {
        if (!newClientName.firstName || !newClientName.lastName) {
          setErrorMsg('El nombre y apellido del cliente son obligatorios.');
          return;
        }
        const created = await createClientMutation.mutateAsync({
          firstName: newClientName.firstName,
          lastName:  newClientName.lastName,
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
    (!form.clientId && (!creatingNewClient || !newClientName.firstName || !newClientName.lastName)) ||
    !!dateError || !!overlapError ||
    createMutation.isPending || createClientMutation.isPending;

  const hasFilters = filterSearch || filterProperty || filterStatus || filterDateFrom || filterDateTo;

  // ── Bulk helpers ───────────────────────────────────────────────────────
  const allVisibleSelected = filteredSorted.length > 0 && filteredSorted.every((b: any) => selectedIds.has(b.id));
  const toggleAll = () => {
    if (allVisibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredSorted.map((b: any) => b.id)));
  };
  const toggleOne = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const cancelBulk = () => { setSelectedIds(new Set()); setBulkAction(''); setBulkValue(''); setBulkResult(null); };
  const applyBulk = async () => {
    if (!bulkAction || !bulkValue || bulkLoading) return;
    setBulkLoading(true); setBulkResult(null);
    let ok = 0;
    const errors: string[] = [];
    for (const id of Array.from(selectedIds)) {
      try {
        if (bulkAction === 'status') {
          await api.patch(`/bookings/${id}/status`, { status: bulkValue });
        } else {
          await api.patch(`/bookings/${id}`, { source: bulkValue });
        }
        ok++;
      } catch (err: any) {
        errors.push(err?.response?.data?.message || err?.message || 'Error desconocido');
      }
      await new Promise(r => setTimeout(r, 300));
    }
    const uniqueErrors = [...new Set(errors)];
    setBulkLoading(false); setBulkResult({ ok, fail: errors.length, errors: uniqueErrors });
    qc.invalidateQueries({ queryKey: ['bookings'] });
    if (errors.length === 0) cancelBulk();
  };

  // ── Columnas de la tabla ──────────────────────────────────────────────
  const bookingColumns: Column[] = [
    {
      header: <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="w-4 h-4 accent-emerald-500 rounded cursor-pointer" />,
      thClassName: 'pl-4 py-3 w-10',
      tdClassName: 'pl-4 py-3',
      stopPropagation: true,
      render: (b) => (
        <input type="checkbox" checked={selectedIds.has(b.id)} onChange={() => toggleOne(b.id)}
          className="w-4 h-4 accent-emerald-500 rounded cursor-pointer" />
      ),
    },
    {
      header: t('bookings.client'), sortKey: 'client',
      tdClassName: 'px-4 py-3 font-medium',
      render: (b) => `${b.client?.firstName ?? ''} ${b.client?.lastName ?? ''}`.trim() || '—',
    },
    {
      header: t('bookings.property'), sortKey: 'property',
      tdClassName: 'px-4 py-3 text-slate-400',
      render: (b) => b.property?.name ?? '—',
    },
    {
      header: t('bookings.checkIn'), sortKey: 'checkin',
      tdClassName: 'px-4 py-3 text-slate-400',
      render: (b) => new Date(b.checkInDate).toLocaleDateString('es-ES'),
    },
    {
      header: t('bookings.checkOut'), sortKey: 'checkout',
      tdClassName: 'px-4 py-3 text-slate-400',
      render: (b) => new Date(b.checkOutDate).toLocaleDateString('es-ES'),
    },
    {
      header: t('common.total'), sortKey: 'total',
      tdClassName: 'px-4 py-3 font-semibold text-emerald-400',
      render: (b) => `€${b.totalAmount}`,
    },
    {
      header: t('bookings.source'), sortKey: 'source',
      tdClassName: 'px-4 py-3 text-slate-400',
      render: (b) => b.source === 'manual_block'
        ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-500/20 text-slate-400 border border-slate-600/50">Bloqueo</span>
        : t(`bookings.sources.${b.source}`) || b.source,
    },
    {
      header: t('common.status'), sortKey: 'status',
      tdClassName: 'px-4 py-3',
      render: (b) => (
        <div className="flex items-center gap-2">
          <span className={`${badgeCls} ${bookingStatusColor[b.status] ?? 'bg-slate-500/10 text-slate-400'}`}>
            {t(`bookings.statuses.${b.status}`) || b.status}
          </span>
          {b.sesStatus === 'enviado' && (
            <span title="SES enviado" className="text-emerald-400 text-xs">🚔</span>
          )}
          {b.sesStatus === 'error' && (
            <span title="Error SES" className="text-red-400 text-xs">⚠️</span>
          )}
          {b.sesStatus === 'pendiente' && (
            <span title="SES pendiente" className="text-amber-400 text-xs">⏳</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className={`p-4 md:p-6${selectedIds.size > 0 ? ' pb-24' : ''}`}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('bookings.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {filteredSorted.length} {t('bookings.registered')}
            {hasFilters && bookings.length !== filteredSorted.length ? ` (de ${bookings.length})` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelButtons entity="bookings" onImportSuccess={() => qc.invalidateQueries({ queryKey: ['bookings'] })} />
          <button
            onClick={() => { setShowPriceModal(true); setPriceResult(null); setPriceFile(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-colors"
          >
            💰 {t('bookings.priceUpdate')}
          </button>
          <button onClick={() => { setShowForm(true); setErrorMsg(''); resetForm(); }}
            className={BTN_PRIMARY}>
            + {t('bookings.new')}
          </button>
        </div>
      </div>

      {/* ── Barra de filtros ────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-col md:flex-row gap-2">
        <input
          placeholder="Buscar cliente o propiedad..."
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
        />
        <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 md:w-44">
          <option value="">Todas las propiedades</option>
          {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 md:w-40">
          <option value="">Todos los estados</option>
          {['created','registered','processed','error','cancelled'].map(s => (
            <option key={s} value={s}>{t(`bookings.statuses.${s}`)}</option>
          ))}
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={e => setFilterDateFrom(e.target.value)}
          title="Check-in desde"
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 md:w-40"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={e => setFilterDateTo(e.target.value)}
          title="Check-in hasta"
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 md:w-40"
        />
        <label className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer whitespace-nowrap select-none">
          <input
            type="checkbox"
            checked={showBlocks}
            onChange={e => { setShowBlocks(e.target.checked); localStorage.setItem('bookings.showBlocks', String(e.target.checked)); }}
            className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
          />
          <span className="text-sm text-slate-300">Mostrar bloqueos de calendario</span>
        </label>
        {hasFilters && (
          <button onClick={() => { setFilterSearch(''); setFilterProperty(''); setFilterStatus(''); setFilterDateFrom(''); setFilterDateTo(''); }}
            className="px-3 py-2 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors whitespace-nowrap">
            Limpiar
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-20">{t('common.loading')}</div>
      ) : bookings.length === 0 ? (
        <div className="text-slate-400 text-center py-20">{t('common.noData')}</div>
      ) : (
        <DataTable
          columns={bookingColumns}
          rows={filteredSorted}
          getRowKey={(b) => b.id}
          onRowClick={(b, i) => { if (b.source !== 'manual_block') navigate(`/bookings/${b.id}`, { state: { ids: filteredSorted.map((x: any) => x.id), index: i } }); }}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          emptyMessage="No se encontraron resultados"
          renderCard={(b, i) => (
            <div key={b.id}
              onClick={() => { if (b.source !== 'manual_block') navigate(`/bookings/${b.id}`, { state: { ids: filteredSorted.map((x: any) => x.id), index: i } }); }}
              className={`bg-slate-900 border border-slate-800 rounded-xl p-4 ${b.source !== 'manual_block' ? 'cursor-pointer active:bg-slate-800/70' : 'cursor-default opacity-75'}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <input type="checkbox" checked={selectedIds.has(b.id)} onChange={() => toggleOne(b.id)}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer shrink-0" />
                  <span className="font-medium text-white truncate">{b.client?.firstName} {b.client?.lastName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {b.sesStatus === 'enviado' && <span title="SES enviado" className="text-emerald-400 text-xs">🚔</span>}
                  {b.sesStatus === 'error'   && <span title="Error SES"   className="text-red-400 text-xs">⚠️</span>}
                  <span className={`${badgeCls} ${bookingStatusColor[b.status] ?? 'bg-slate-500/10 text-slate-400'}`}>
                    {t(`bookings.statuses.${b.status}`) || b.status}
                  </span>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-2">{b.property?.name}</p>
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>{new Date(b.checkInDate).toLocaleDateString('es-ES')} → {new Date(b.checkOutDate).toLocaleDateString('es-ES')}</span>
                <span className="font-semibold text-emerald-400">€{b.totalAmount}</span>
              </div>
            </div>
          )}
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
            <option value="status">Cambiar estado</option>
            <option value="source">Cambiar origen</option>
          </select>
          {bulkAction === 'status' && (
            <select value={bulkValue} onChange={e => { setBulkValue(e.target.value); setBulkResult(null); }}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
              <option value="">— Estado —</option>
              {['created','registered','processed','error','cancelled'].map(s => (
                <option key={s} value={s}>{t(`bookings.statuses.${s}`)}</option>
              ))}
            </select>
          )}
          {bulkAction === 'source' && (
            <select value={bulkValue} onChange={e => { setBulkValue(e.target.value); setBulkResult(null); }}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
              <option value="">— Origen —</option>
              {['direct','airbnb','booking','vrbo','manual_block'].map(s => (
                <option key={s} value={s}>{t(`bookings.sources.${s}`)}</option>
              ))}
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
          <div className={`${MODAL_PANEL} md:max-w-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto`}>
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

                {selectedClient ? (
                  /* Cliente seleccionado */
                  <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-white">{selectedClient.firstName} {selectedClient.lastName}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {selectedClient.dniPassport && <span className="text-xs text-slate-400">{selectedClient.dniPassport}</span>}
                        {selectedClient.nationality && <span className="text-xs text-slate-400">{selectedClient.nationality}</span>}
                        {selectedClient.language && (
                          <span className="text-xs text-sky-400 font-medium">
                            🌐 {LANGUAGE_NAMES[selectedClient.language] || selectedClient.language}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedClient(null); setForm({ ...form, clientId: '' }); setClientSearch(''); setCreatingNewClient(false); }}
                      className="text-slate-400 hover:text-white text-lg leading-none ml-3">✕</button>
                  </div>
                ) : creatingNewClient ? (
                  /* Formulario nuevo cliente (solo nombre) */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-emerald-400">Nuevo cliente</p>
                      <button
                        onClick={() => { setCreatingNewClient(false); setClientSearch(''); setNewClientName({ firstName: '', lastName: '' }); }}
                        className="text-slate-400 hover:text-white text-xs">✕ Cancelar</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <FormField label="Nombre" required>
                        <input
                          autoFocus
                          value={newClientName.firstName}
                          onChange={e => setNewClientName({ ...newClientName, firstName: e.target.value })}
                          placeholder="Nombre"
                          className={inputCls} />
                      </FormField>
                      <FormField label="Apellido" required>
                        <input
                          value={newClientName.lastName}
                          onChange={e => setNewClientName({ ...newClientName, lastName: e.target.value })}
                          placeholder="Apellido"
                          className={inputCls} />
                      </FormField>
                    </div>
                  </div>
                ) : (
                  /* Campo de búsqueda con desplegable */
                  <div className="relative">
                    <FormField label="Buscar cliente" required>
                      <input
                        value={clientSearch}
                        onChange={e => { setClientSearch(e.target.value); }}
                        onFocus={() => clientSearch.trim() && setShowDropdown(true)}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                        placeholder="Nombre, apellido o DNI..."
                        className={inputCls}
                      />
                    </FormField>
                    {showDropdown && (clientResults.length > 0 || clientSearch.trim()) && (
                      <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-xl max-h-60 overflow-y-auto">
                        {clientResults.map((c: any) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { setSelectedClient(c); setForm({ ...form, clientId: c.id }); setShowDropdown(false); setClientSearch(''); }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0">
                            <p className="text-sm font-medium text-white">{c.firstName} {c.lastName}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {c.dniPassport && <span className="mr-2">{c.dniPassport}</span>}
                              {c.nationality && <span>{c.nationality}</span>}
                            </p>
                          </button>
                        ))}
                        {clientSearch.trim() && (
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { setShowDropdown(false); setCreatingNewClient(true); setNewClientName({ firstName: '', lastName: '' }); }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors text-emerald-400 text-sm font-semibold">
                            ➕ Crear cliente nuevo
                          </button>
                        )}
                      </div>
                    )}
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
                      <FormField label="Nombre" required>
                        <input value={g.firstName} onChange={e => updateGuest(i, 'firstName', e.target.value)}
                          className={inputCls} />
                      </FormField>
                      <FormField label="Apellido" required>
                        <input value={g.lastName} onChange={e => updateGuest(i, 'lastName', e.target.value)}
                          className={inputCls} />
                      </FormField>
                    </div>
                    <DocFields
                      prefix={`guest_${i}`}
                      docType={g.docType} docNumber={g.docNumber} docCountry={g.docCountry}
                      onDocType={(e: React.ChangeEvent<HTMLSelectElement>) => updateGuest(i, 'docType', e.target.value)}
                      onDocNumber={(e: React.ChangeEvent<HTMLInputElement>) => updateGuest(i, 'docNumber', e.target.value)}
                      onDocCountry={(e: React.ChangeEvent<HTMLSelectElement>) => updateGuest(i, 'docCountry', e.target.value)}
                      warnings={docWarnings}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <FormField label="Fecha nacimiento">
                        <input type="date" value={g.birthDate} onChange={e => updateGuest(i, 'birthDate', e.target.value)}
                          className={inputCls} />
                      </FormField>
                      <div>
                        <label className={labelCls}>Teléfono</label>
                        <div className="flex gap-2">
                          <select value={g.phoneCode} onChange={e => updateGuest(i, 'phoneCode', e.target.value)}
                            className="px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 w-28 disabled:opacity-50 disabled:cursor-not-allowed">
                            {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.phone} {c.code}</option>)}
                          </select>
                          <input value={g.phoneNumber} onChange={e => updateGuest(i, 'phoneNumber', e.target.value)}
                            placeholder="600000000"
                            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Datos de la reserva ───────────────────────────── */}
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-4">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Datos de la reserva</p>

                <FormField label={t('bookings.property')} required>
                  <select value={form.propertyId} onChange={f('propertyId')} className={inputCls}>
                    <option value="">— {t('bookings.property')} —</option>
                    {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label={t('bookings.checkIn')} required>
                    <input type="date" value={form.checkInDate} onChange={f('checkInDate')}
                      className={`${inputCls} ${dateError ? 'border-red-500' : ''}`} />
                  </FormField>
                  <FormField label={t('bookings.checkOut')} required>
                    <input type="date" value={form.checkOutDate} onChange={f('checkOutDate')}
                      className={`${inputCls} ${dateError ? 'border-red-500' : ''}`} />
                  </FormField>
                </div>
                {dateError && (
                  <p className="text-red-400 text-xs -mt-2">⚠ {dateError}</p>
                )}
                {overlapError && (
                  <p className="text-red-400 text-xs -mt-2">⚠ {overlapError}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label={`${t('common.total')} (€)`} required>
                    <input type="number" value={form.totalAmount} onChange={f('totalAmount')} className={inputCls} />
                  </FormField>
                  <FormField label={t('bookings.source')}>
                    <select value={form.source} onChange={f('source')} className={inputCls}>
                      {['direct','airbnb','booking','vrbo','manual_block'].map(s => (
                        <option key={s} value={s}>{t(`bookings.sources.${s}`)}</option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <FormField label={t('common.notes')}>
                  <textarea value={form.notes} onChange={f('notes')} rows={2}
                    className={`${inputCls} resize-none`} />
                </FormField>
              </div>

              {/* ── Botones ───────────────────────────────────────── */}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setShowForm(false); setErrorMsg(''); resetForm(); }}
                  className={`flex-1 ${BTN_SECONDARY}`}>
                  {t('common.cancel')}
                </button>
                <button onClick={handleSubmit} disabled={isSubmitDisabled}
                  className={`flex-1 ${BTN_PRIMARY}`}>
                  {createMutation.isPending || createClientMutation.isPending ? t('common.saving') : t('bookings.new')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal actualización masiva de precios ───────────────────────── */}
      {showPriceModal && (
        <div className={MODAL_OVERLAY}>
          <div className={`${MODAL_PANEL} max-w-md`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">{t('bookings.priceUpdateTitle')}</h2>
              <button onClick={() => setShowPriceModal(false)} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            <p className="text-slate-400 text-sm mb-5">{t('bookings.priceUpdateDesc')}</p>

            <div className="space-y-4">
              {/* Paso 1: descargar plantilla */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">1. {t('bookings.downloadTemplate')}</p>
                <button
                  onClick={handleDownloadPriceTemplate}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors w-full justify-center"
                >
                  📋 {t('bookings.downloadTemplate')}
                </button>
              </div>

              {/* Paso 2: subir Excel */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">2. {t('bookings.uploadFile')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => priceFileRef.current?.click()}
                    className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors justify-center"
                  >
                    📂 {priceFile ? priceFile.name : t('bookings.uploadFile')}
                  </button>
                  {priceFile && (
                    <button
                      onClick={handlePriceImport}
                      disabled={priceUploading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {priceUploading ? t('bookings.uploading') : '⬆️'}
                    </button>
                  )}
                </div>
                <input
                  ref={priceFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) { setPriceFile(e.target.files[0]); setPriceResult(null); } }}
                />
              </div>

              {/* Resultado */}
              {priceResult && (
                <div className="mt-2 p-4 bg-slate-800 rounded-xl space-y-2">
                  <p className="text-sm font-semibold text-white">{t('bookings.priceUpdateResult')}</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-slate-400">{priceResult.processed} {t('bookings.rowsProcessed')}</span>
                    <span className="text-emerald-400 font-medium">✅ {priceResult.updated} {t('bookings.rowsUpdated')}</span>
                  </div>
                  {priceResult.errors.length > 0 && (
                    <div>
                      <p className="text-red-400 text-xs font-medium mb-1">⚠️ {priceResult.errors.length} errores:</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {priceResult.errors.map((err, i) => (
                          <p key={i} className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">{err}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowPriceModal(false)}
              className="mt-5 w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
