import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'da', name: 'Dansk' },
  { code: 'nb', name: 'Norsk' },
  { code: 'sv', name: 'Svenska' },
];

function Stars({ score, onChange }: { score: number; onChange?: (s: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" onClick={() => onChange?.(s)}
          className={`text-xl transition-transform ${onChange ? 'cursor-pointer hover:scale-125' : 'cursor-default'} ${s <= score ? 'text-amber-400' : 'text-slate-600'}`}>
          ★
        </button>
      ))}
    </div>
  );
}

export default function BookingDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showRating, setShowRating] = useState(false);
  const [sendingCheckin, setSendingCheckin] = useState(false);
  const [sesSending, setSesSending] = useState(false);
  const [sesResult, setSesResult] = useState<{ok: boolean; message: string} | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingNotes, setRatingNotes] = useState('');
  const [checkinLang, setCheckinLang] = useState('es');

  const statusColor: Record<string, string> = {
    confirmed: 'bg-emerald-500/10 text-emerald-400',
    cancelled:  'bg-red-500/10 text-red-400',
    completed:  'bg-slate-500/10 text-slate-400',
  };

  const contractStatusColor: Record<string, string> = {
    draft:     'bg-slate-500/10 text-slate-400',
    sent:      'bg-amber-500/10 text-amber-400',
    signed:    'bg-emerald-500/10 text-emerald-400',
    cancelled: 'bg-red-500/10 text-red-400',
  };

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get(`/bookings/${id}`).then(r => r.data),
    enabled: !!id,
  });

  useEffect(() => {
    if (booking?.client?.language) setCheckinLang(booking.client.language);
  }, [booking?.client?.language]);

  const { data: evaluation } = useQuery({
    queryKey: ['evaluation-booking', id],
    queryFn: () => api.get(`/evaluations/booking/${id}`).then(r => r.data).catch(() => null),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/bookings/${id}`, { status: 'cancelled' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking', id] }),
  });

  const createEvalMutation = useMutation({
    mutationFn: (data: any) => api.post('/evaluations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evaluation-booking', id] });
      setShowRating(false);
      setRatingScore(5);
      setRatingNotes('');
    },
  });

  const updateEvalMutation = useMutation({
    mutationFn: ({ evalId, data }: any) => api.put(`/evaluations/${evalId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evaluation-booking', id] }),
  });

  const handleSendCheckin = async () => {
    setSendingCheckin(true);
    try {
      await api.post(`/bookings/${booking.id}/checkin/send`, { language: checkinLang });
      qc.invalidateQueries({ queryKey: ['booking', id] });
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al enviar el checkin');
    } finally {
      setSendingCheckin(false);
    }
  };

  const sendSes = async () => {
    setSesSending(true);
    setSesResult(null);
    try {
      const res = await api.post(`/bookings/${id}/ses/send`);
      setSesResult({ ok: res.data.ok, message: res.data.ok
        ? `✅ Parte enviado correctamente. Lote: ${res.data.lote}`
        : `⚠️ Enviado con advertencias. Código: ${res.data.codigo}` });
    } catch (err: any) {
      setSesResult({ ok: false, message: `❌ ${err?.response?.data?.message || 'Error al enviar'}` });
    } finally {
      setSesSending(false);
    }
  };

  const viewContract = async (contractId: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`http://${window.location.hostname}:3001/api/contracts/view/${contractId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const html = await res.text();
    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  if (isLoading) return <div className="p-6 text-slate-400">{t('common.loading')}</div>;
  if (!booking) return <div className="p-6 text-slate-400">{t('common.noData')}</div>;

  const nights = Math.round((new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / 86400000);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/bookings')} className="text-slate-400 hover:text-white text-sm transition-colors">
          {t('common.back')}
        </button>
        {booking.status !== 'cancelled' && (
          <button onClick={() => { if (confirm(t('bookings.cancel'))) cancelMutation.mutate(); }}
            className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
            {t('bookings.cancel')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Info principal */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <h2 className="font-bold text-lg">{booking.property?.name}</h2>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[booking.status]}`}>
              {t(`bookings.statuses.${booking.status}`)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('bookings.checkIn')}</div>
              <div className="font-semibold">{new Date(booking.checkInDate).toLocaleDateString('es-ES')}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('bookings.checkOut')}</div>
              <div className="font-semibold">{new Date(booking.checkOutDate).toLocaleDateString('es-ES')}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('bookings.nights')}</div>
              <div className="font-semibold">{nights}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('bookings.source')}</div>
              <div className="font-semibold">{t(`bookings.sources.${booking.source}`)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('common.total')}</div>
              <div className="font-bold text-emerald-400 text-lg">€{booking.totalAmount}</div>
            </div>
            {booking.depositAmount && (
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('bookings.deposit')}</div>
                <div className="font-semibold">€{booking.depositAmount}</div>
              </div>
            )}
          </div>
        </div>

        {/* Cliente */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider mb-3">{t('bookings.client')}</h3>
          <button onClick={() => navigate(`/clients/${booking.client?.id}`)}
            className="text-lg font-bold hover:text-emerald-400 transition-colors text-left">
            {booking.client?.firstName} {booking.client?.lastName}
          </button>
          <div className="mt-3 space-y-1 text-sm text-slate-400">
            {booking.client?.dniPassport && <div>{t('clients.dni')}: <span className="font-mono text-white">{booking.client.dniPassport}</span></div>}
            {booking.client?.email && <div>{t('common.email')}: <span className="text-white">{booking.client.email}</span></div>}
            {booking.client?.phone && <div>{t('common.phone')}: <span className="text-white">{booking.client.phone}</span></div>}
            {booking.client?.nationality && <div>{t('clients.nationality')}: <span className="text-white">{booking.client.nationality}</span></div>}
          </div>
        </div>
      </div>

      {/* Huéspedes adicionales */}
      {booking.guests?.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider mb-3">{t('bookings.additionalGuests')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {booking.guests.map((g: any) => (
              <div key={g.id} className="bg-slate-800 rounded-lg p-3 text-sm">
                <div className="font-medium">{g.firstName} {g.lastName}</div>
                {g.dniPassport && <div className="text-slate-400 font-mono text-xs mt-0.5">{g.dniPassport}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Valoración */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider">{t('bookings.rating')}</h3>
          <button onClick={() => setShowRating(true)}
            className="px-3 py-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors">
            {evaluation ? t('common.edit') : t('evaluations.rate')}
          </button>
        </div>
        {evaluation ? (
          <div className="flex items-center gap-3">
            <Stars score={evaluation.score} />
            <span className="text-slate-400 text-sm">{(t('evaluations.scores') as any)[evaluation.score]}</span>
            {evaluation.notes && <span className="text-slate-400 text-sm">· {evaluation.notes}</span>}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">{t('bookings.noRating')}</p>
        )}
      </div>

      {/* Contratos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider">{t('bookings.contract')}</h3>
          <button onClick={() => navigate('/contracts')} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
            {t('common.view')} →
          </button>
        </div>
        {booking.contracts?.length === 0 ? (
          <p className="text-slate-500 text-sm">{t('bookings.noContract')}</p>
        ) : (
          <div className="space-y-2">
            {booking.contracts?.map((c: any) => (
              <div key={c.id} className="flex flex-col md:flex-row md:items-center md:justify-between bg-slate-800 rounded-lg px-4 py-3 gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${contractStatusColor[c.status]}`}>
                    {t(`contracts.statuses.${c.status}`)}
                  </span>
                  <span className="text-sm text-slate-400">{c.template?.name}</span>
                  {c.signedAt && <span className="text-xs text-slate-500">· {t('contracts.signed')}: {new Date(c.signedAt).toLocaleDateString('es-ES')}</span>}
                </div>
                <button onClick={() => viewContract(c.id)}
                  className="self-start md:self-auto px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                  {t('contracts.viewContract')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Financiero */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider mb-3">{t('bookings.financials')}</h3>
        {booking.financials?.length === 0 ? (
          <p className="text-slate-500 text-sm">{t('bookings.noFinancials')}</p>
        ) : (
          <div className="space-y-2">
            {booking.financials?.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3 text-sm gap-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${f.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {f.type === 'income' ? t('financials.income') : t('financials.expense')}
                  </span>
                  <span className="text-slate-400 truncate">{f.description || f.category?.name || '—'}</span>
                </div>
                <span className={`shrink-0 font-semibold ${f.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {f.type === 'income' ? '+' : '-'}€{Number(f.amount).toLocaleString('es-ES')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* SES Hospedajes */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-2">
          <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider">🚔 SES Hospedajes</h3>
          <div className="flex flex-wrap items-center gap-2">
            {booking.sesStatus && (
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                booking.sesStatus === 'enviado' ? 'bg-emerald-500/10 text-emerald-400' :
                booking.sesStatus === 'error'   ? 'bg-red-500/10 text-red-400' :
                'bg-amber-500/10 text-amber-400'
              }`}>
                {booking.sesStatus === 'enviado' ? '✅ Enviado' :
                 booking.sesStatus === 'error'   ? '❌ Error' : '⏳ Pendiente'}
              </span>
            )}
            <a href={`http://${window.location.hostname}:3001/api/bookings/${id}/ses/pdf`}
              target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
              📄 PDF
            </a>
            <a href={`http://${window.location.hostname}:3001/api/bookings/${id}/ses/xml`}
              target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
              📋 XML
            </a>
            <button onClick={sendSes} disabled={sesSending}
              className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg transition-colors font-semibold">
              {sesSending ? '⏳ Enviando...' : '📤 Enviar al SES'}
            </button>
          </div>
        </div>

        {booking.sesSentAt && (
          <p className="text-xs text-slate-500 mb-2">
            Último envío: {new Date(booking.sesSentAt).toLocaleString('es-ES')}
            {booking.sesLote && ` · Lote: ${booking.sesLote}`}
          </p>
        )}

        {sesResult && (
          <div className={`mt-2 p-3 rounded-lg text-sm ${sesResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {sesResult.message}
          </div>
        )}

        {/* Huéspedes SES */}
        <div className="mt-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Viajeros del parte</p>
          <div className="space-y-2">
            {/* Titular */}
            <div className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2 text-sm">
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">Titular</span>
              <span className="font-medium">{booking.client?.firstName} {booking.client?.lastName}</span>
              {booking.client?.dniPassport && <span className="text-slate-400 font-mono text-xs">{booking.client.dniPassport}</span>}
            </div>
            {/* Huéspedes adicionales */}
            {(booking.guestsSes || []).map((g: any) => (
              <div key={g.id} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2 text-sm">
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">Viajero</span>
                <span className="font-medium">{g.firstName} {g.lastName}</span>
                <span className="text-slate-400 font-mono text-xs">{g.docType?.toUpperCase()} {g.docNumber}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Checkin online */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <span>✅</span> Checkin online
        </h3>
        <div className="mb-4">
          {!booking.checkinStatus && (
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full">No enviado</span>
          )}
          {booking.checkinStatus === 'pending' && (
            <div>
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">Pendiente</span>
              {booking.checkinSentAt && (
                <p className="text-xs text-slate-400 mt-1">
                  Enviado el {new Date(booking.checkinSentAt).toLocaleDateString('es-ES')}
                </p>
              )}
            </div>
          )}
          {booking.checkinStatus === 'completed' && (
            <div>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">✓ Completado</span>
              {booking.checkinDoneAt && (
                <p className="text-xs text-slate-400 mt-1">
                  Completado el {new Date(booking.checkinDoneAt).toLocaleDateString('es-ES')} a las {new Date(booking.checkinDoneAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          )}
        </div>

        {booking.checkinStatus !== 'completed' && (
          <div>
            <div className="mb-3">
              <label className="text-xs text-slate-400 mb-1 block">Idioma del email</label>
              <select value={checkinLang} onChange={e => setCheckinLang(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </div>
            <button onClick={handleSendCheckin} disabled={sendingCheckin}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
              {sendingCheckin ? 'Enviando...' : booking.checkinStatus === 'pending' ? '🔄 Reenviar enlace' : '📧 Enviar checkin al cliente'}
            </button>
          </div>
        )}
      </div>

      {/* Modal valoración */}
      {showRating && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-sm max-h-[95vh] md:max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold mb-4">{evaluation ? t('evaluations.editTitle') : t('evaluations.title')}</h2>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('evaluations.score')}</label>
              <Stars score={ratingScore} onChange={setRatingScore} />
              <p className="text-xs text-slate-400 mt-1">{(t('evaluations.scores') as any)[ratingScore]}</p>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('evaluations.comment')}</label>
              <textarea value={ratingNotes} onChange={e => setRatingNotes(e.target.value)} rows={3}
                placeholder={t('evaluations.commentPlaceholder')}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRating(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  if (evaluation) {
                    updateEvalMutation.mutate({ evalId: evaluation.id, data: { score: ratingScore, notes: ratingNotes } });
                    setShowRating(false);
                  } else {
                    createEvalMutation.mutate({ bookingId: id, clientId: booking.client?.id, score: ratingScore, notes: ratingNotes });
                  }
                }}
                disabled={createEvalMutation.isPending || updateEvalMutation.isPending}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                {(createEvalMutation.isPending || updateEvalMutation.isPending) ? t('common.saving') : t('evaluations.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
