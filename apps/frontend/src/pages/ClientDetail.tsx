import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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

export default function ClientDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as { ids: string[]; index: number } | null);
  const qc = useQueryClient();
  const [ratingBookingId, setRatingBookingId] = useState<string | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingNotes, setRatingNotes] = useState('');
  const [editingEval, setEditingEval] = useState<any | null>(null);

  const sourceLabel: Record<string, string> = {
    direct: t('bookings.sources.direct'),
    airbnb: 'Airbnb',
    booking: 'Booking',
    vrbo: 'Vrbo',
    manual_block: t('bookings.sources.manual_block'),
  };

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['client-bookings', id],
    queryFn: () => api.get(`/bookings?clientId=${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: client } = useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get(`/clients/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const createEvalMutation = useMutation({
    mutationFn: (data: any) => api.post('/evaluations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-bookings', id] });
      setRatingBookingId(null);
      setRatingScore(5);
      setRatingNotes('');
    },
  });

  const updateEvalMutation = useMutation({
    mutationFn: ({ evalId, data }: any) => api.put(`/evaluations/${evalId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-bookings', id] });
      setEditingEval(null);
    },
  });

  const handleRating = () => {
    if (!ratingBookingId) return;
    createEvalMutation.mutate({ bookingId: ratingBookingId, clientId: id, score: ratingScore, notes: ratingNotes });
  };

  const handleUpdateRating = () => {
    if (!editingEval) return;
    updateEvalMutation.mutate({ evalId: editingEval.id, data: { score: editingEval.score, notes: editingEval.notes } });
  };

  if (isLoading) return <div className="p-6 text-slate-400">{t('common.loading')}</div>;

  const bookings = bookingsData || [];
  const evaluated = bookings.filter((b: any) => b.evaluation);
  const avgScore = evaluated.length
    ? evaluated.reduce((s: number, b: any) => s + b.evaluation.score, 0) / evaluated.length
    : null;
  const totalBookings = bookings.length;
  const totalSpent = bookings.reduce((s: number, b: any) => s + Number(b.totalAmount || 0), 0);
  const lastStay = bookings.length
    ? bookings.reduce((latest: any, b: any) => new Date(b.checkOutDate) > new Date(latest.checkOutDate) ? b : latest, bookings[0])
    : null;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/clients')}
          className="text-slate-400 hover:text-white transition-colors text-sm">
          {t('common.back')}
        </button>
        {navState && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(`/clients/${navState.ids[navState.index - 1]}`, { state: { ids: navState.ids, index: navState.index - 1 } })}
              disabled={navState.index === 0}
              className="p-1.5 bg-slate-800 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm transition-colors">
              ←
            </button>
            <span className="text-xs text-slate-500 px-2">{navState.index + 1} / {navState.ids.length}</span>
            <button
              onClick={() => navigate(`/clients/${navState.ids[navState.index + 1]}`, { state: { ids: navState.ids, index: navState.index + 1 } })}
              disabled={navState.index === navState.ids.length - 1}
              className="p-1.5 bg-slate-800 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm transition-colors">
              →
            </button>
          </div>
        )}
      </div>

      {/* Layout dos columnas */}
      <div className="flex flex-col md:flex-row gap-6">

        {/* ── Columna izquierda: datos del cliente + resumen ─────────── */}
        <div className="md:w-1/3 space-y-6">

          {/* Datos cliente */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="font-bold text-lg mb-4">{client?.firstName} {client?.lastName}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {client?.dniPassport && (
                <div>
                  <span className="text-slate-400">{t('clients.dni')}: </span>
                  <span className="font-mono">{client.dniPassport}</span>
                </div>
              )}
              {client?.nationality && (
                <div>
                  <span className="text-slate-400">{t('clients.nationality')}: </span>
                  <span>{client.nationality}</span>
                </div>
              )}
              {client?.email && (
                <div>
                  <span className="text-slate-400">{t('common.email')}: </span>
                  <span>{client.email}</span>
                </div>
              )}
              {client?.phone && (
                <div>
                  <span className="text-slate-400">{t('common.phone')}: </span>
                  <span>{client.phone}</span>
                </div>
              )}
              {client?.birthDate && (
                <div>
                  <span className="text-slate-400">{t('clients.birthDate')}: </span>
                  <span>{new Date(client.birthDate).toLocaleDateString('es-ES')}</span>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400">Idioma de contacto</p>
                <p className="text-white text-sm">
                  {LANGUAGES.find(l => l.code === client?.language)?.name || 'Español'}
                </p>
              </div>
            </div>
            {(client?.street || client?.city || client?.postalCode) && (
              <div className="mt-3 text-sm">
                <span className="text-slate-400">Dirección: </span>
                <span>
                  {[client.street, client.postalCode && client.city ? `${client.postalCode} ${client.city}` : (client.city || client.postalCode), client.province, client.country]
                    .filter(Boolean).join(', ')}
                </span>
              </div>
            )}
            {client?.notes && (
              <div className="mt-3 text-sm text-slate-400 border-t border-slate-800 pt-3">{client.notes}</div>
            )}
          </div>

          {/* Resumen */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('evaluations.totalBookings')}</div>
              <div className="text-2xl font-bold">{totalBookings}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('evaluations.totalSpent')}</div>
              <div className="text-2xl font-bold text-emerald-400">€{Number(totalSpent).toLocaleString('es-ES')}</div>
            </div>
            {lastStay && (
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('evaluations.lastStay')}</div>
                <div className="text-base font-semibold">{new Date(lastStay.checkOutDate).toLocaleDateString('es-ES')}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('evaluations.avgRating')}</div>
              {avgScore ? (
                <div className="flex items-center gap-2">
                  <Stars score={Math.round(avgScore)} />
                  <span className="text-sm text-slate-400">({avgScore.toFixed(1)})</span>
                </div>
              ) : (
                <div className="text-slate-500 text-sm">{t('evaluations.noRating')}</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Columna derecha: historial de reservas ─────────────────── */}
        <div className="md:w-2/3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="font-semibold">{t('bookings.title')}</h3>
          </div>
          {bookings.length === 0 ? (
            <div className="text-slate-400 text-center py-10 text-sm">{t('common.noData')}</div>
          ) : (
            <>
              {/* Desktop: tabla */}
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-5 py-3 text-slate-400 font-semibold">{t('bookings.property')}</th>
                      <th className="text-left px-5 py-3 text-slate-400 font-semibold">{t('bookings.checkIn')}</th>
                      <th className="text-left px-5 py-3 text-slate-400 font-semibold">{t('bookings.checkOut')}</th>
                      <th className="text-left px-5 py-3 text-slate-400 font-semibold">{t('common.total')}</th>
                      <th className="text-left px-5 py-3 text-slate-400 font-semibold">{t('clients.rating')}</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b: any) => (
                      <tr key={b.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                        <td className="px-5 py-3 font-medium">{b.property?.name || '—'}</td>
                        <td className="px-5 py-3 text-slate-400">{new Date(b.checkInDate).toLocaleDateString('es-ES')}</td>
                        <td className="px-5 py-3 text-slate-400">{new Date(b.checkOutDate).toLocaleDateString('es-ES')}</td>
                        <td className="px-5 py-3 font-semibold text-emerald-400">€{b.totalAmount}</td>
                        <td className="px-5 py-3">
                          {b.evaluation ? (
                            <div className="flex items-center gap-2">
                              <Stars score={b.evaluation.score} />
                              <button onClick={() => setEditingEval({ ...b.evaluation })}
                                className="text-xs text-slate-400 hover:text-white transition-colors">
                                {t('common.edit')}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">{t('clients.noRating')}</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {!b.evaluation && (
                            <button onClick={() => { setRatingBookingId(b.id); setRatingScore(5); setRatingNotes(''); }}
                              className="px-3 py-1 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors">
                              {t('evaluations.rate')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Móvil: tarjetas */}
              <div className="md:hidden space-y-3 p-4">
                {bookings.map((b: any) => (
                  <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-white">{b.property?.name || '—'}</span>
                      <span className="text-xs font-semibold text-emerald-400">€{b.totalAmount}</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-1">
                      {new Date(b.checkInDate).toLocaleDateString('es-ES')} → {new Date(b.checkOutDate).toLocaleDateString('es-ES')}
                    </p>
                    <p className="text-xs text-slate-500 mb-2">{sourceLabel[b.source] || b.source}</p>
                    {b.evaluation ? (
                      <div className="flex items-center gap-2">
                        <Stars score={b.evaluation.score} />
                        <button onClick={() => setEditingEval({ ...b.evaluation })}
                          className="text-xs text-slate-400 hover:text-white transition-colors">
                          {t('common.edit')}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setRatingBookingId(b.id); setRatingScore(5); setRatingNotes(''); }}
                        className="mt-1 px-3 py-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors">
                        {t('evaluations.rate')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal crear valoración */}
      {ratingBookingId && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-sm max-h-[95vh] md:max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold mb-4">{t('evaluations.title')}</h2>
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
              <button onClick={() => setRatingBookingId(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={handleRating} disabled={createEvalMutation.isPending}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                {createEvalMutation.isPending ? t('common.saving') : t('evaluations.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar valoración */}
      {editingEval && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-sm max-h-[95vh] md:max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold mb-4">{t('evaluations.editTitle')}</h2>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('evaluations.score')}</label>
              <Stars score={editingEval.score} onChange={s => setEditingEval({ ...editingEval, score: s })} />
              <p className="text-xs text-slate-400 mt-1">{(t('evaluations.scores') as any)[editingEval.score]}</p>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('evaluations.comment')}</label>
              <textarea value={editingEval.notes || ''} onChange={e => setEditingEval({ ...editingEval, notes: e.target.value })} rows={3}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingEval(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={handleUpdateRating} disabled={updateEvalMutation.isPending}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                {updateEvalMutation.isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
