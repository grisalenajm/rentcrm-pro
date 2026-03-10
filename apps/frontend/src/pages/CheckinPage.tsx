import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/api' : 'http://192.168.1.123:3001/api';

export default function CheckinPage() {
  const { token } = useParams<{ token: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    docType: 'passport',
    docNumber: '',
    docCountry: 'ES',
    phone: ''
  });

  useEffect(() => {
    axios.get(`${API}/bookings/checkin/${token}`)
      .then(r => {
        setBooking(r.data);
        setForm(f => ({
          ...f,
          firstName: r.data.clientFirstName || '',
          lastName: r.data.clientLastName || '',
        }));
      })
      .catch(e => setError(e.response?.data?.message || 'Enlace no válido o expirado'))
      .finally(() => setLoading(false));
  }, [token]);

  const DOC_TYPES = useMemo(() => [
    { value: 'dni',      label: booking?.ui?.docTypeDni      ?? 'DNI' },
    { value: 'passport', label: booking?.ui?.docTypePassport ?? 'Pasaporte' },
    { value: 'nie',      label: booking?.ui?.docTypeNie      ?? 'NIE' },
    { value: 'other',    label: booking?.ui?.docTypeOther    ?? 'Otro' },
  ], [booking?.ui]);

  const COUNTRIES = useMemo(() => [
    { code: 'ES',    name: booking?.ui?.countryES    ?? 'España' },
    { code: 'GB',    name: booking?.ui?.countryGB    ?? 'Reino Unido' },
    { code: 'FR',    name: booking?.ui?.countryFR    ?? 'Francia' },
    { code: 'DE',    name: booking?.ui?.countryDE    ?? 'Alemania' },
    { code: 'IT',    name: booking?.ui?.countryIT    ?? 'Italia' },
    { code: 'PT',    name: booking?.ui?.countryPT    ?? 'Portugal' },
    { code: 'US',    name: booking?.ui?.countryUS    ?? 'Estados Unidos' },
    { code: 'OTHER', name: booking?.ui?.countryOther ?? 'Otro' },
  ], [booking?.ui]);

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.docNumber || !form.docCountry) {
      setError(booking?.ui?.requiredFieldsError ?? 'Por favor completa todos los campos obligatorios');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await axios.post(`${API}/bookings/checkin/${token}`, form);
      setCompleted(true);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error al completar el checkin');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-lg">🏘️</div>
        <span className="text-xl font-bold">RentCRM Pro</span>
      </div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6">

        {loading && (
          <div className="text-center text-slate-400 py-8">...</div>
        )}

        {!loading && error && !completed && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">❌</div>
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        )}

        {!loading && completed && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-emerald-400 mb-2">{booking?.ui?.successTitle ?? '¡Checkin completado!'}</h2>
            <p className="text-slate-400 text-sm">{booking?.ui?.successMessage ?? 'Tus datos han sido registrados. ¡Que disfrutes tu estancia!'}</p>
          </div>
        )}

        {!loading && !error && !completed && booking && (
          <>
            {/* Info reserva */}
            <div className="mb-6 p-4 bg-slate-800 rounded-xl">
              <h2 className="font-bold text-lg">{booking.propertyName}</h2>
              <p className="text-slate-400 text-sm">{booking.propertyCity}</p>
              <div className="flex gap-4 mt-2 text-sm">
                <div>
                  <span className="text-slate-400">{booking.ui?.labelCheckin ?? 'Entrada'} </span>
                  <span className="text-white">{new Date(booking.startDate).toLocaleDateString('es-ES')}</span>
                </div>
                <div>
                  <span className="text-slate-400">{booking.ui?.labelCheckout ?? 'Salida'} </span>
                  <span className="text-white">{new Date(booking.endDate).toLocaleDateString('es-ES')}</span>
                </div>
              </div>
            </div>

            <h3 className="font-semibold mb-4">{booking.ui?.sectionTitle ?? 'Tus datos'}</h3>

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelFirstName ?? 'Nombre'} *</label>
                  <input value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelLastName ?? 'Apellidos'} *</label>
                  <input value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelDocType ?? 'Tipo de documento'} *</label>
                <select value={form.docType} onChange={e => setForm({...form, docType: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500">
                  {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelDocNumber ?? 'Número de documento'} *</label>
                <input value={form.docNumber} onChange={e => setForm({...form, docNumber: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelDocCountry ?? 'País del documento'} *</label>
                <select value={form.docCountry} onChange={e => setForm({...form, docCountry: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500">
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelPhone ?? 'Teléfono (opcional)'}</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                  placeholder="+34 600 000 000"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
              </div>

              <button onClick={handleSubmit} disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors mt-2">
                {submitting ? (booking.ui?.sendingText ?? '...') : (booking.ui?.buttonText ?? 'Completar checkin')}
              </button>
            </div>
          </>
        )}

      </div>

      <p className="text-slate-600 text-xs mt-6">Powered by RentCRM Pro</p>
    </div>
  );
}
