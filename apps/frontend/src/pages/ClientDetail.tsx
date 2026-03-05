import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const sourceLabel: Record<string, string> = {
  direct: 'Directo', airbnb: 'Airbnb',
  booking: 'Booking', vrbo: 'Vrbo', manual_block: 'Bloqueo',
};

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
  const qc = useQueryClient();
  const [ratingBookingId, setRatingBookingId] = useState<string | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingNotes, setRatingNotes] = useState('');
  const [editingEval, setEditingEval] = useState<any | null>(null);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['client-summary', id],
    queryFn: () => api.get(`/evaluations/client/${id}/summary`).then(r => r.data),
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
      qc.invalidateQueries({ queryKey: ['client-summary', id] });
      setRatingBookingId(null);
      setRatingScore(5);
      setRatingNotes('');
    },
  });

  const updateEvalMutation = useMutation({
    mutationFn: ({ evalId, data }: any) => api.put(`/evaluations/${evalId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-summary', id] });
      setEditingEval(null);
    },
  });

  const handleRating = () => {
    if (!ratingBookingId) return;
    createEvalMutation.mutate({ bookingId: ratingBookingId, clientId: id, score: ratingScore, notes: ratingNotes || undefined });
  };

  const handleUpdateRating = () => {
    if (!editingEval) return;
    updateEvalMutation.mutate({ evalId: editingEval.id, data: { score: ratingScore, notes: ratingNotes || undefined } });
  };

  const openRating = (bookingId: string) => {
    setRatingBookingId(bookingId);
    setRatingScore(5);
    setRatingNotes('');
  };

  const openEditRating = (eval_: any) => {
    setEditingEval(eval_);
    setRatingScore(eval_.score);
    setRatingNotes(eval_.notes || '');
  };

  if (isLoading) return <div className="p-6 text-slate-400">Cargando...</div>;
  if (!summary) return <div className="p-6 text-slate-400">Cliente no encontrado</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/clients')} className="text-slate-400 hover:text-white transition-colors">{t('common.back')}</button>
        <span className="text-slate-600">/</span>
        <h1 className="text-xl font-bold">{client?.firstName} {client?.lastName}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-slate-300 text-sm uppercase tracking-wider">Datos del cliente</h2>
          {client && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {client.dniPassport && <><span className="text-slate-400">DNI/Pasaporte</span><span className="font-mono">{client.dniPassport}</span></>}
              {client.nationality && <><span className="text-slate-400">Nacionalidad</span><span>{client.nationality}</span></>}
              {client.birthDate && <><span className="text-slate-400">Nacimiento</span><span>{new Date(client.birthDate).toLocaleDateString('es-ES')}</span></>}
              {client.email && <><span className="text-slate-400">Email</span><a href={`mailto:${client.email}`} className="text-emerald-400 hover:underline">{client.email}</a></>}
              {client.phone && <><span className="text-slate-400">Teléfono</span><a href={`tel:${client.phone}`} className="text-emerald-400 hover:underline">{client.phone}</a></>}
              {client.notes && <><span className="text-slate-400">Notas</span><span className="text-slate-300">{client.notes}</span></>}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-slate-300 text-sm uppercase tracking-wider">Resumen</h2>
          <div>
            <div className="text-xs text-slate-400 mb-1">Reservas totales</div>
            <div className="text-2xl font-bold">{summary.totalBookings}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Total gastado</div>
            <div className="text-2xl font-bold text-emerald-400">€{Number(summary.totalSpent).toLocaleString('es-ES', {minimumFractionDigits:2})}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Valoración media</div>
            {summary.avgScore ? (
              <div className="flex items-center gap-2">
                <Stars score={Math.round(summary.avgScore)} />
                <span className="text-sm text-slate-400">({summary.avgScore.toFixed(1)})</span>
              </div>
            ) : <span className="text-slate-500 text-sm">Sin valoraciones</span>}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="font-semibold mb-4 text-slate-300 text-sm uppercase tracking-wider">Historial de reservas</h2>
        {summary.bookings.length === 0 ? (
          <p className="text-slate-500 text-sm">Sin reservas registradas</p>
        ) : (
          <div className="space-y-3">
            {summary.bookings.map((b: any) => {
              const nights = Math.round((new Date(b.checkOutDate).getTime() - new Date(b.checkInDate).getTime()) / 86400000);
              return (
                <div key={b.id} className="border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <Link to={`/bookings/${b.id}`} className="font-semibold text-emerald-400 hover:underline">
                        {b.property.name}
                      </Link>
                      <div className="text-xs text-slate-400 mt-0.5">{b.property.city} · {sourceLabel[b.source] || b.source}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400">€{b.totalAmount}</div>
                      <div className="text-xs text-slate-400">{nights} noches</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm text-slate-400">
                      {new Date(b.checkInDate).toLocaleDateString('es-ES')} → {new Date(b.checkOutDate).toLocaleDateString('es-ES')}
                    </div>
                    {b.evaluation ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Stars score={b.evaluation.score} />
                        {b.evaluation.notes && <span className="text-xs text-slate-400 italic">"{b.evaluation.notes}"</span>}
                        <button onClick={() => openEditRating(b.evaluation)}
                          className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors">
                          Editar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => openRating(b.id)}
                        className="px-3 py-1 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors">
                        {t('evaluations.rate')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal nueva valoración */}
      {ratingBookingId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-2">Valorar estancia</h2>
            <p className="text-slate-400 text-sm mb-5">
              {(() => { const b = summary.bookings.find((b: any) => b.id === ratingBookingId);
                return b ? `${b.property.name} · ${new Date(b.checkInDate).toLocaleDateString('es-ES')} – ${new Date(b.checkOutDate).toLocaleDateString('es-ES')}` : ''; })()}
            </p>
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Puntuación *</label>
              <Stars score={ratingScore} onChange={setRatingScore} />
              <div className="text-xs text-slate-500 mt-2">{['','Muy malo','Malo','Normal','Bueno','Excelente'][ratingScore]}</div>
            </div>
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Comentario</label>
              <input value={ratingNotes} onChange={e => setRatingNotes(e.target.value)}
                placeholder="Ej: Cliente muy cuidadoso, dejó la casa perfecta"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRatingBookingId(null)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">{t('common.cancel')}</button>
              <button onClick={handleRating} disabled={createEvalMutation.isPending}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                {createEvalMutation.isPending ? 'Guardando...' : {t('evaluations.save')}}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar valoración */}
      {editingEval && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-5">Editar valoración</h2>
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Puntuación *</label>
              <Stars score={ratingScore} onChange={setRatingScore} />
              <div className="text-xs text-slate-500 mt-2">{['','Muy malo','Malo','Normal','Bueno','Excelente'][ratingScore]}</div>
            </div>
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Comentario</label>
              <input value={ratingNotes} onChange={e => setRatingNotes(e.target.value)}
                placeholder="Ej: Cliente muy cuidadoso, dejó la casa perfecta"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingEval(null)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">{t('common.cancel')}</button>
              <button onClick={handleUpdateRating} disabled={updateEvalMutation.isPending}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                {updateEvalMutation.isPending ? 'Guardando...' : {t('common.save')}}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
