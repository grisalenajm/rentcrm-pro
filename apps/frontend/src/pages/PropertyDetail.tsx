import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import ContentEditor from '../components/ContentEditor';
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
  nrua?: string;
  photo?: string;
  notes?: string;
}

const fmtEur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const statusLabel = (s: string) =>
  s === 'active' ? 'Activa' : s === 'maintenance' ? 'Mantenimiento' : 'Inactiva';
const statusClass = (s: string) =>
  s === 'active' ? 'bg-emerald-500/10 text-emerald-400' : s === 'maintenance' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400';

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [tab, setTab] = useState<'info' | 'contenido'>('info');
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Notas inline
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  const { data: property, isLoading } = useQuery<Property>({
    queryKey: ['property', id],
    queryFn: () => api.get(`/properties/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: globalContent } = useQuery({
    queryKey: ['property-content', 'global'],
    queryFn: () => api.get('/property-content').then(r => r.data),
  });

  const { data: financialRecords = [] } = useQuery({
    queryKey: ['financials-property', id],
    queryFn: () => api.get(`/financials?propertyId=${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: expensesSummary = {} } = useQuery({
    queryKey: ['expenses-summary-property', id],
    queryFn: () => api.get(`/expenses/summary?propertyId=${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: propertyBookings = [] } = useQuery({
    queryKey: ['bookings-property', id],
    queryFn: () => api.get(`/bookings?propertyId=${id}`).then(r => {
      const res = r.data;
      return Array.isArray(res) ? res : (res?.data ?? []);
    }),
    enabled: !!id,
  });

  // Financial summary (Financial type=income + Booking.totalAmount status!=cancelled)
  const incomeSummary: Record<number, number> = {};
  for (const r of financialRecords as any[]) {
    if (r.type === 'income') {
      const year = new Date(r.date).getFullYear();
      incomeSummary[year] = (incomeSummary[year] || 0) + Number(r.amount);
    }
  }
  for (const b of propertyBookings as any[]) {
    if (b.status !== 'cancelled' && b.totalAmount) {
      const year = new Date(b.checkInDate).getFullYear();
      incomeSummary[year] = (incomeSummary[year] || 0) + Number(b.totalAmount);
    }
  }
  const expYears = Object.keys(expensesSummary as Record<string, number>).map(Number);
  const incYears = Object.keys(incomeSummary).map(Number);
  const allYears = [...new Set([...expYears, ...incYears])].sort((a, b) => b - a);

  // Photo upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !property) return;
    if (file.size > 2 * 1024 * 1024) { alert('La imagen no puede superar 2MB'); return; }
    if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return; }
    setPhotoUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        await api.put(`/properties/${property.id}`, { photo: base64 });
        await qc.invalidateQueries({ queryKey: ['property', id] });
        await qc.invalidateQueries({ queryKey: ['properties'] });
      } finally {
        setPhotoUploading(false);
        if (photoInputRef.current) photoInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return <div className="p-6 text-slate-400">Cargando…</div>;
  }

  if (!property) {
    return (
      <div className="p-6">
        <button onClick={() => navigate('/properties')}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg transition-colors text-slate-300 mb-4">
          ← Volver
        </button>
        <p className="text-red-400">Propiedad no encontrada.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/properties')}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg transition-colors text-slate-300">
          ← Volver
        </button>
        <h1 className="text-xl font-bold flex-1">{property.name}</h1>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusClass(property.status)}`}>
          {statusLabel(property.status)}
        </span>
        <button onClick={() => navigate(`/properties/${property.id}/financials`)}
          className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm rounded-lg transition-colors font-semibold">
          💰 Ver finanzas
        </button>

        <button onClick={() => navigate(`/properties/${property.id}/edit`)}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg transition-colors">
          Editar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 -mt-2">
        {(['info', 'contenido'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}>
            {t === 'info' ? '📋 Info' : '📄 Contenido'}
          </button>
        ))}
      </div>

      {/* Pestaña Contenido */}
      {tab === 'contenido' && (
        <ContentEditor propertyId={property.id} globalContent={globalContent} />
      )}

      {/* Pestaña Info */}
      {tab === 'info' && (
        <div className="space-y-4">

          {/* Card: foto + datos */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex gap-5">
              {/* Foto */}
              <div className="shrink-0 w-32 h-32 rounded-xl overflow-hidden bg-slate-800 flex items-center justify-center">
                {property.photo
                  ? <img src={property.photo} alt={property.name} className="w-full h-full object-cover" />
                  : <span className="text-3xl">🏠</span>
                }
              </div>

              {/* Datos */}
              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400">Dirección</p>
                    <p className="text-white">{property.address || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Ciudad</p>
                    <p className="text-white">{property.city || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Provincia</p>
                    <p className="text-white">{property.province || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">País</p>
                    <p className="text-white">
                      {property.country
                        ? (WORLD_COUNTRIES.find(c => c.code === property.country)?.name || property.country)
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Código Postal</p>
                    <p className="text-white">{property.postalCode || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Habitaciones</p>
                    <p className="text-white">{property.rooms}{property.bathrooms ? ` · ${property.bathrooms} baños` : ''}</p>
                  </div>
                  {property.maxGuests && (
                    <div>
                      <p className="text-xs text-slate-400">Máx. huéspedes</p>
                      <p className="text-white">{property.maxGuests}</p>
                    </div>
                  )}
                  {property.pricePerNight && (
                    <div>
                      <p className="text-xs text-slate-400">Precio/noche</p>
                      <p className="text-white">{fmtEur(Number(property.pricePerNight))}</p>
                    </div>
                  )}
                  {property.purchasePrice && (
                    <div>
                      <p className="text-xs text-slate-400">Precio de compra</p>
                      <p className="text-white">{fmtEur(Number(property.purchasePrice))}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800">
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              <button onClick={() => photoInputRef.current?.click()} disabled={photoUploading}
                className="text-xs text-slate-400 hover:text-emerald-400 transition-colors">
                {photoUploading ? 'Subiendo...' : '📷 Cambiar foto'}
              </button>
            </div>
          </div>

          {/* Card: iCal */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">iCal</p>
            <button onClick={() => navigate(`/properties/${property.id}/ical`)}
              className="text-xs text-slate-400 hover:text-emerald-400 transition-colors">
              ⚙️ Gestionar feeds iCal
            </button>
          </div>

          {/* Card: SES */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">SES Hospedajes</p>
            <p className="text-xs text-slate-400">Código establecimiento</p>
            <p className="text-white text-sm font-mono mt-1 mb-3">
              {property.sesCodigoEstablecimiento || <span className="text-slate-500">No configurado</span>}
            </p>
            <p className="text-xs text-slate-400">NRUA</p>
            <p className="text-white text-sm font-mono mt-1">
              {property.nrua || <span className="text-slate-500">No configurado</span>}
            </p>
          </div>

          {/* Card: Notas */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Notas</p>
              {!notesEditing && (
                <button
                  onClick={() => { setNotesDraft(property.notes || ''); setNotesEditing(true); }}
                  className="text-xs text-slate-400 hover:text-emerald-400 transition-colors">
                  {property.notes ? 'Editar' : 'Añadir'}
                </button>
              )}
            </div>
            {notesEditing ? (
              <div className="space-y-3">
                <textarea
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  rows={4}
                  autoFocus
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setNotesEditing(false)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                    Cancelar
                  </button>
                  <button
                    disabled={notesSaving}
                    onClick={async () => {
                      setNotesSaving(true);
                      try {
                        await api.put(`/properties/${property.id}`, { notes: notesDraft });
                        await qc.invalidateQueries({ queryKey: ['property', id] });
                        setNotesEditing(false);
                      } finally {
                        setNotesSaving(false);
                      }
                    }}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors">
                    {notesSaving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : property.notes ? (
              <p
                onClick={() => { setNotesDraft(property.notes || ''); setNotesEditing(true); }}
                className="text-sm text-slate-300 whitespace-pre-wrap cursor-pointer hover:text-white transition-colors">
                {property.notes}
              </p>
            ) : (
              <p
                onClick={() => { setNotesDraft(''); setNotesEditing(true); }}
                className="text-sm text-slate-500 cursor-pointer hover:text-slate-400 transition-colors">
                Sin notas
              </p>
            )}
          </div>

          {/* Card: Resumen financiero */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Resumen financiero</h3>
              <button onClick={() => navigate(`/properties/${property.id}/financials`)}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                Ver detalle →
              </button>
            </div>

            {allYears.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-700 rounded-xl text-slate-500 text-sm">
                Sin datos financieros
              </div>
            ) : (
              <>
                {/* Desktop */}
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

                {/* Mobile */}
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
      )}

    </div>
  );
}
