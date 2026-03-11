import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { WORLD_COUNTRIES } from '../data/countries';

const API = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/api' : 'http://192.168.1.123:3001/api';

const browserLang = navigator.language?.slice(0, 2) || 'en';

const LOADING_TEXTS: Record<string, string> = {
  es: 'Cargando...',
  en: 'Loading...',
  fr: 'Chargement...',
  de: 'Laden...',
  it: 'Caricamento...',
  pt: 'Carregando...',
  nl: 'Laden...',
  da: 'Indlæser...',
  nb: 'Laster...',
  sv: 'Laddar...',
};

const CHECKIN_TEXTS: Record<string, string> = {
  es: 'Preparando tu checkin',
  en: 'Preparing your check-in',
  fr: 'Préparation de votre check-in',
  de: 'Ihr Check-in wird vorbereitet',
  it: 'Preparazione del tuo check-in',
  pt: 'Preparando o seu check-in',
  nl: 'Uw check-in wordt voorbereid',
  da: 'Forbereder dit check-in',
  nb: 'Forbereder din innsjekking',
  sv: 'Förbereder din incheckning',
};

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
    phone: '',
    street: '',
    city: '',
    postalCode: '',
    province: '',
    country: 'ES',
  });
  const [guests, setGuests] = useState<Array<{
    firstName: string;
    lastName: string;
    docType: string;
    docNumber: string;
    docCountry: string;
    birthDate: string;
    street: string;
    city: string;
    postalCode: string;
    province: string;
    country: string;
    sameAddress: boolean;
  }>>([]);

  const addGuest = () => setGuests([...guests, {
    firstName: '', lastName: '', docType: 'passport', docNumber: '', docCountry: 'ES', birthDate: '',
    street: '', city: '', postalCode: '', province: '', country: 'ES', sameAddress: false,
  }]);

  const removeGuest = (i: number) => setGuests(guests.filter((_, idx) => idx !== i));

  const updateGuest = (i: number, field: string, value: string | boolean) => {
    if (field === 'sameAddress') {
      const checked = value as boolean;
      setGuests(guests.map((g, idx) => idx === i ? {
        ...g,
        sameAddress: checked,
        ...(checked ? { street: form.street, city: form.city, postalCode: form.postalCode, province: form.province, country: form.country } : {}),
      } : g));
    } else {
      setGuests(guests.map((g, idx) => idx === i ? { ...g, [field]: value } : g));
    }
  };

  useEffect(() => {
    axios.get(`${API}/bookings/checkin/${token}`)
      .then(r => {
        setBooking(r.data);
        setForm(f => ({
          ...f,
          firstName:  r.data.clientFirstName  || '',
          lastName:   r.data.clientLastName   || '',
          street:     r.data.clientStreet     || '',
          city:       r.data.clientCity       || '',
          postalCode: r.data.clientPostalCode || '',
          province:   r.data.clientProvince   || '',
          country:    r.data.clientCountry    || 'ES',
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
    { code: 'DK',    name: booking?.ui?.countryDK    ?? 'Dinamarca' },
    { code: 'NO',    name: booking?.ui?.countryNO    ?? 'Noruega' },
    { code: 'SE',    name: booking?.ui?.countrySE    ?? 'Suecia' },
    { code: 'NL',    name: booking?.ui?.countryNL    ?? 'Países Bajos' },
    { code: 'BE',    name: booking?.ui?.countryBE    ?? 'Bélgica' },
    { code: 'CH',    name: booking?.ui?.countryCH    ?? 'Suiza' },
    { code: 'AT',    name: booking?.ui?.countryAT    ?? 'Austria' },
    { code: 'PL',    name: booking?.ui?.countryPL    ?? 'Polonia' },
    { code: 'CZ',    name: booking?.ui?.countryCZ    ?? 'República Checa' },
    { code: 'HU',    name: booking?.ui?.countryHU    ?? 'Hungría' },
    { code: 'RO',    name: booking?.ui?.countryRO    ?? 'Rumanía' },
    { code: 'BG',    name: booking?.ui?.countryBG    ?? 'Bulgaria' },
    { code: 'GR',    name: booking?.ui?.countryGR    ?? 'Grecia' },
    { code: 'HR',    name: booking?.ui?.countryHR    ?? 'Croacia' },
    { code: 'MX',    name: booking?.ui?.countryMX    ?? 'México' },
    { code: 'AR',    name: booking?.ui?.countryAR    ?? 'Argentina' },
    { code: 'CO',    name: booking?.ui?.countryCO    ?? 'Colombia' },
    { code: 'BR',    name: booking?.ui?.countryBR    ?? 'Brasil' },
    { code: 'CN',    name: booking?.ui?.countryCN    ?? 'China' },
    { code: 'JP',    name: booking?.ui?.countryJP    ?? 'Japón' },
    { code: 'AU',    name: booking?.ui?.countryAU    ?? 'Australia' },
    { code: 'CA',    name: booking?.ui?.countryCA    ?? 'Canadá' },
    { code: 'RU',    name: booking?.ui?.countryRU    ?? 'Rusia' },
    { code: 'MA',    name: booking?.ui?.countryMA    ?? 'Marruecos' },
    { code: 'DZ',    name: booking?.ui?.countryDZ    ?? 'Argelia' },
    { code: 'TR',    name: booking?.ui?.countryTR    ?? 'Turquía' },
    { code: 'IL',    name: booking?.ui?.countryIL    ?? 'Israel' },
    { code: 'AE',    name: booking?.ui?.countryAE    ?? 'Emiratos Árabes Unidos' },
    { code: 'OTHER', name: booking?.ui?.countryOther ?? 'Otro' },
  ].sort((a, b) => a.name.localeCompare(b.name)), [booking?.ui]);

  const ADDRESS_COUNTRIES = WORLD_COUNTRIES;

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.docNumber || !form.docCountry) {
      setError(booking?.ui?.requiredFieldsError ?? 'Por favor completa todos los campos obligatorios');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const guestsPayload = guests.map(({ sameAddress, ...g }) => g);
      await axios.post(`${API}/bookings/checkin/${token}`, { ...form, guests: guestsPayload });
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
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-medium">{CHECKIN_TEXTS[browserLang] || CHECKIN_TEXTS['en']}</p>
            <p className="text-slate-400 text-sm mt-1">{LOADING_TEXTS[browserLang] || LOADING_TEXTS['en']}</p>
          </div>
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

              {/* Dirección titular */}
              <div className="border-t border-slate-700 pt-4">
                <p className="text-xs font-semibold text-slate-300 mb-3">{booking.ui?.labelAddress ?? 'Dirección'}</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelStreet ?? 'Calle y número'}</label>
                    <input value={form.street} onChange={e => setForm({...form, street: e.target.value})}
                      placeholder="Calle Mayor 1, 2º A"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelPostalCode ?? 'Código postal'}</label>
                      <input value={form.postalCode} onChange={e => setForm({...form, postalCode: e.target.value})}
                        placeholder="28001"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelCity ?? 'Ciudad'}</label>
                      <input value={form.city} onChange={e => setForm({...form, city: e.target.value})}
                        placeholder="Madrid"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelProvince ?? 'Provincia'}</label>
                      <input value={form.province} onChange={e => setForm({...form, province: e.target.value})}
                        placeholder="Madrid"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelCountryRes ?? 'País de residencia'}</label>
                      <select value={form.country} onChange={e => setForm({...form, country: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500">
                        {ADDRESS_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-4 mt-2">
                <h4 className="font-semibold text-white mb-1">{booking.ui?.guestsTitle ?? 'Otros huéspedes (mayores de 14 años)'}</h4>
                <p className="text-xs text-slate-400 mb-3">
                  {booking.ui?.guestsNotice ?? 'Es obligatorio registrar todos los huéspedes mayores de 14 años según la normativa de hospedaje.'}
                </p>

                {guests.map((g, i) => (
                  <div key={i} className="bg-slate-800 rounded-xl p-4 mb-3 relative">
                    <button onClick={() => removeGuest(i)}
                      className="absolute top-3 right-3 text-slate-400 hover:text-red-400 transition-colors text-lg">✕</button>
                    <p className="text-xs font-semibold text-emerald-400 mb-3">{booking.ui?.guestLabel ?? 'Huésped'} {i + 1}</p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelFirstName ?? 'Nombre'} *</label>
                          <input value={g.firstName} onChange={e => updateGuest(i, 'firstName', e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelLastName ?? 'Apellidos'} *</label>
                          <input value={g.lastName} onChange={e => updateGuest(i, 'lastName', e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelDocType ?? 'Tipo de documento'} *</label>
                        <select value={g.docType} onChange={e => updateGuest(i, 'docType', e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500">
                          {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelDocNumber ?? 'Número de documento'} *</label>
                        <input value={g.docNumber} onChange={e => updateGuest(i, 'docNumber', e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelDocCountry ?? 'País del documento'} *</label>
                        <select value={g.docCountry} onChange={e => updateGuest(i, 'docCountry', e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500">
                          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelBirthDate ?? 'Fecha de nacimiento'}</label>
                        <input type="date" value={g.birthDate} onChange={e => updateGuest(i, 'birthDate', e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                      </div>
                      {/* Dirección huésped */}
                      <div className="pt-2">
                        <label className="flex items-center gap-2 cursor-pointer mb-3">
                          <input type="checkbox" checked={g.sameAddress} onChange={e => updateGuest(i, 'sameAddress', e.target.checked)}
                            className="w-4 h-4 accent-emerald-500" />
                          <span className="text-xs text-slate-300">{booking.ui?.labelSameAddress ?? 'Misma dirección que el titular'}</span>
                        </label>
                        {!g.sameAddress && (
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelStreet ?? 'Calle y número'}</label>
                              <input value={g.street} onChange={e => updateGuest(i, 'street', e.target.value)}
                                placeholder="Calle Mayor 1"
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelPostalCode ?? 'CP'}</label>
                                <input value={g.postalCode} onChange={e => updateGuest(i, 'postalCode', e.target.value)}
                                  placeholder="28001"
                                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelCity ?? 'Ciudad'}</label>
                                <input value={g.city} onChange={e => updateGuest(i, 'city', e.target.value)}
                                  placeholder="Madrid"
                                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelProvince ?? 'Provincia'}</label>
                                <input value={g.province} onChange={e => updateGuest(i, 'province', e.target.value)}
                                  placeholder="Madrid"
                                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 mb-1 block">{booking.ui?.labelCountryRes ?? 'País'}</label>
                                <select value={g.country} onChange={e => updateGuest(i, 'country', e.target.value)}
                                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500">
                                  {ADDRESS_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <button onClick={addGuest}
                  className="w-full py-2.5 border border-dashed border-slate-600 hover:border-emerald-500 text-slate-400 hover:text-emerald-400 rounded-xl text-sm transition-colors">
                  + {booking.ui?.addGuestButton ?? 'Añadir huésped'}
                </button>
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
